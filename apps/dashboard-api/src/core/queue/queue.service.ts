import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { AppLoggerService } from '../logger/logger.service';

export interface QueueJob<T = any> {
  id: string;
  type: string;
  data: T;
  priority: number;
  attempts: number;
  maxAttempts: number;
  delay: number;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
}

export interface QueueOptions {
  priority?: number;
  delay?: number;
  maxAttempts?: number;
  backoff?: 'fixed' | 'exponential';
  backoffDelay?: number;
}

export interface QueueProcessor<T = any> {
  (job: QueueJob<T>): Promise<void>;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

@Injectable()
export class QueueService implements OnModuleDestroy {
  private jobs = new Map<string, QueueJob>();
  private processors = new Map<string, QueueProcessor>();
  private activeJobs = new Set<string>();
  private processingInterval: NodeJS.Timeout;
  private stats = {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
  };

  constructor(private readonly logger: AppLoggerService) {
    this.logger.setContext('QueueService');
    
    // Process jobs every second
    this.processingInterval = setInterval(() => {
      this.processJobs();
    }, 1000);
  }

  onModuleDestroy() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
  }

  async add<T>(
    type: string,
    data: T,
    options: QueueOptions = {},
  ): Promise<string> {
    const job: QueueJob<T> = {
      id: this.generateJobId(),
      type,
      data,
      priority: options.priority || 0,
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      delay: options.delay || 0,
      createdAt: new Date(),
    };

    this.jobs.set(job.id, job);
    this.updateStats();
    
    this.logger.debug(`Job added: ${job.id} (type: ${type})`);
    return job.id;
  }

  registerProcessor<T>(type: string, processor: QueueProcessor<T>): void {
    this.processors.set(type, processor);
    this.logger.debug(`Processor registered for type: ${type}`);
  }

  async getJob(jobId: string): Promise<QueueJob | undefined> {
    return this.jobs.get(jobId);
  }

  async removeJob(jobId: string): Promise<boolean> {
    const removed = this.jobs.delete(jobId);
    this.activeJobs.delete(jobId);
    this.updateStats();
    
    if (removed) {
      this.logger.debug(`Job removed: ${jobId}`);
    }
    
    return removed;
  }

  async getJobs(status?: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed'): Promise<QueueJob[]> {
    const allJobs = Array.from(this.jobs.values());
    
    if (!status) return allJobs;
    
    return allJobs.filter(job => this.getJobStatus(job) === status);
  }

  async retryJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    
    if (!job || this.getJobStatus(job) !== 'failed') {
      return false;
    }

    job.attempts = 0;
    job.failedAt = undefined;
    job.error = undefined;
    
    this.logger.debug(`Job retry scheduled: ${jobId}`);
    return true;
  }

  async retryAllFailed(): Promise<number> {
    const failedJobs = await this.getJobs('failed');
    let retried = 0;
    
    for (const job of failedJobs) {
      if (await this.retryJob(job.id)) {
        retried++;
      }
    }
    
    this.logger.debug(`Retried ${retried} failed jobs`);
    return retried;
  }

  async clean(status: 'completed' | 'failed', olderThan: number = 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - olderThan);
    const jobs = await this.getJobs(status);
    let cleaned = 0;
    
    for (const job of jobs) {
      const relevantDate = status === 'completed' ? job.completedAt : job.failedAt;
      
      if (relevantDate && relevantDate < cutoff) {
        await this.removeJob(job.id);
        cleaned++;
      }
    }
    
    this.logger.debug(`Cleaned ${cleaned} ${status} jobs older than ${olderThan}ms`);
    return cleaned;
  }

  getStats(): QueueStats {
    return { ...this.stats };
  }

  // Specific job types for the application
  async addReportGeneration(reportData: any, options?: QueueOptions): Promise<string> {
    return this.add('report-generation', reportData, {
      priority: 5,
      maxAttempts: 2,
      ...options,
    });
  }

  async addEmailNotification(emailData: any, options?: QueueOptions): Promise<string> {
    return this.add('email-notification', emailData, {
      priority: 3,
      maxAttempts: 3,
      ...options,
    });
  }

  async addDataProcessing(processData: any, options?: QueueOptions): Promise<string> {
    return this.add('data-processing', processData, {
      priority: 1,
      maxAttempts: 5,
      ...options,
    });
  }

  async addFileUpload(fileData: any, options?: QueueOptions): Promise<string> {
    return this.add('file-upload', fileData, {
      priority: 2,
      maxAttempts: 3,
      ...options,
    });
  }

  async addSecurityAlert(alertData: any, options?: QueueOptions): Promise<string> {
    return this.add('security-alert', alertData, {
      priority: 10, // High priority
      maxAttempts: 1,
      ...options,
    });
  }

  private async processJobs(): Promise<void> {
    const waitingJobs = await this.getWaitingJobs();
    
    // Sort by priority (higher first) and creation time
    waitingJobs.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    // Process up to 5 jobs concurrently
    const maxConcurrent = 5;
    const currentActive = this.activeJobs.size;
    const canProcess = Math.min(waitingJobs.length, maxConcurrent - currentActive);

    for (let i = 0; i < canProcess; i++) {
      const job = waitingJobs[i];
      this.processJob(job);
    }
  }

  private async processJob(job: QueueJob): Promise<void> {
    if (this.activeJobs.has(job.id)) return;

    // Check if job should be delayed
    if (job.delay > 0) {
      const shouldProcess = Date.now() >= job.createdAt.getTime() + job.delay;
      if (!shouldProcess) return;
    }

    const processor = this.processors.get(job.type);
    if (!processor) {
      this.logger.warn(`No processor found for job type: ${job.type}`);
      return;
    }

    this.activeJobs.add(job.id);
    job.processedAt = new Date();
    job.attempts++;
    this.updateStats();

    try {
      this.logger.debug(`Processing job: ${job.id} (attempt ${job.attempts})`);
      await processor(job);
      
      job.completedAt = new Date();
      this.activeJobs.delete(job.id);
      this.updateStats();
      
      this.logger.debug(`Job completed: ${job.id}`);
    } catch (error) {
      this.activeJobs.delete(job.id);
      job.error = error.message;
      
      if (job.attempts >= job.maxAttempts) {
        job.failedAt = new Date();
        this.logger.error(`Job failed permanently: ${job.id}`, error.stack);
      } else {
        // Schedule retry with backoff
        job.delay = this.calculateBackoffDelay(job.attempts);
        this.logger.warn(`Job failed, will retry: ${job.id} (attempt ${job.attempts}/${job.maxAttempts})`);
      }
      
      this.updateStats();
    }
  }

  private async getWaitingJobs(): Promise<QueueJob[]> {
    return Array.from(this.jobs.values()).filter(job => 
      this.getJobStatus(job) === 'waiting' || this.getJobStatus(job) === 'delayed'
    );
  }

  private getJobStatus(job: QueueJob): 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' {
    if (job.completedAt) return 'completed';
    if (job.failedAt) return 'failed';
    if (this.activeJobs.has(job.id)) return 'active';
    if (job.delay > 0 && Date.now() < job.createdAt.getTime() + job.delay) return 'delayed';
    return 'waiting';
  }

  private updateStats(): void {
    const allJobs = Array.from(this.jobs.values());
    
    this.stats = {
      waiting: allJobs.filter(job => this.getJobStatus(job) === 'waiting').length,
      active: allJobs.filter(job => this.getJobStatus(job) === 'active').length,
      completed: allJobs.filter(job => this.getJobStatus(job) === 'completed').length,
      failed: allJobs.filter(job => this.getJobStatus(job) === 'failed').length,
      delayed: allJobs.filter(job => this.getJobStatus(job) === 'delayed').length,
    };
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateBackoffDelay(attempts: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, etc.
    return Math.min(1000 * Math.pow(2, attempts - 1), 30000); // Max 30 seconds
  }
}