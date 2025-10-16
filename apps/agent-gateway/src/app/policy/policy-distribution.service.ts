import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PolicyVersion } from './policy-versioning.service';
import { WebSocketClientService } from '../control-channel/websocket-client.service';
import { CommandQueueInfrastructureService } from '../command-queue/command-queue-infrastructure.service';
import * as axios from 'axios';

export interface DistributionJob {
  id: string;
  policyId: string;
  policyVersion: string;
  targetAgents: string[];
  targetOrganizations: number[];
  distributionMethod: 'websocket' | 'rest' | 'both';
  priority: number;
  status: DistributionStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress: DistributionProgress;
  retryConfig: RetryConfig;
  metadata: Record<string, any>;
}

export enum DistributionStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PARTIALLY_COMPLETED = 'partially_completed',
}

export interface DistributionProgress {
  totalTargets: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  pendingDeliveries: number;
  deliveryDetails: DeliveryDetail[];
}

export interface DeliveryDetail {
  targetId: string;
  targetType: 'agent' | 'organization';
  method: 'websocket' | 'rest';
  status: 'pending' | 'delivered' | 'failed' | 'acknowledged';
  attempts: number;
  lastAttemptAt?: Date;
  deliveredAt?: Date;
  acknowledgedAt?: Date;
  error?: string;
  latency?: number;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface DistributionStats {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageDeliveryTime: number;
  successRate: number;
  deliveryMethodStats: {
    websocket: { attempts: number; successes: number; failures: number };
    rest: { attempts: number; successes: number; failures: number };
  };
}

@Injectable()
export class PolicyDistributionService {
  private readonly logger = new Logger(PolicyDistributionService.name);
  private readonly distributionJobs = new Map<string, DistributionJob>();
  private readonly activeDeliveries = new Set<string>();
  
  private readonly defaultRetryConfig: RetryConfig = {
    maxAttempts: 5,
    baseDelay: 1000, // 1 second
    maxDelay: 300000, // 5 minutes
    backoffMultiplier: 2,
    retryableErrors: [
      'NETWORK_ERROR',
      'TIMEOUT',
      'CONNECTION_REFUSED',
      'TEMPORARY_FAILURE',
      'RATE_LIMITED',
    ],
  };

  private readonly maxConcurrentDeliveries: number;
  private readonly deliveryTimeout: number;

  constructor(
    private readonly config: ConfigService,
    private readonly webSocketClient: WebSocketClientService,
    private readonly commandQueue: CommandQueueInfrastructureService,
  ) {
    this.maxConcurrentDeliveries = parseInt(this.config.get('DISTRIBUTION_MAX_CONCURRENT', '50'));
    this.deliveryTimeout = parseInt(this.config.get('DISTRIBUTION_TIMEOUT', '30000')); // 30 seconds
  }

  async distributePolicy(
    policy: PolicyVersion,
    targets: {
      agents?: string[];
      organizations?: number[];
    },
    options?: {
      method?: 'websocket' | 'rest' | 'both';
      priority?: number;
      retryConfig?: Partial<RetryConfig>;
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    const jobId = this.generateJobId();
    
    const targetAgents = targets.agents || [];
    const targetOrganizations = targets.organizations || [];
    const totalTargets = targetAgents.length + targetOrganizations.length;

    if (totalTargets === 0) {
      throw new Error('No distribution targets specified');
    }

    const distributionJob: DistributionJob = {
      id: jobId,
      policyId: policy.id,
      policyVersion: policy.version,
      targetAgents,
      targetOrganizations,
      distributionMethod: options?.method || 'both',
      priority: options?.priority || 3,
      status: DistributionStatus.PENDING,
      createdAt: new Date(),
      progress: {
        totalTargets,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        pendingDeliveries: totalTargets,
        deliveryDetails: [],
      },
      retryConfig: { ...this.defaultRetryConfig, ...options?.retryConfig },
      metadata: options?.metadata || {},
    };

    // Initialize delivery details
    targetAgents.forEach(agentId => {
      distributionJob.progress.deliveryDetails.push({
        targetId: agentId,
        targetType: 'agent',
        method: this.selectDeliveryMethod(distributionJob.distributionMethod),
        status: 'pending',
        attempts: 0,
      });
    });

    targetOrganizations.forEach(orgId => {
      distributionJob.progress.deliveryDetails.push({
        targetId: orgId.toString(),
        targetType: 'organization',
        method: this.selectDeliveryMethod(distributionJob.distributionMethod),
        status: 'pending',
        attempts: 0,
      });
    });

    this.distributionJobs.set(jobId, distributionJob);
    
    this.logger.log(`Policy distribution job created: ${jobId} for policy ${policy.id} v${policy.version} (${totalTargets} targets)`);
    
    // Start distribution immediately
    this.processDistributionJob(jobId).catch(error => {
      this.logger.error(`Failed to start distribution job ${jobId}: ${error.message}`);
    });

    return jobId;
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processDistributionJobs(): Promise<void> {
    try {
      const pendingJobs = Array.from(this.distributionJobs.values())
        .filter(job => job.status === DistributionStatus.PENDING || job.status === DistributionStatus.IN_PROGRESS)
        .sort((a, b) => a.priority - b.priority); // Higher priority first (lower number)

      for (const job of pendingJobs) {
        if (this.activeDeliveries.size >= this.maxConcurrentDeliveries) {
          break; // Reached concurrency limit
        }

        await this.processDistributionJob(job.id);
      }
    } catch (error) {
      this.logger.error(`Distribution job processing failed: ${error.message}`);
    }
  }

  private async processDistributionJob(jobId: string): Promise<void> {
    const job = this.distributionJobs.get(jobId);
    if (!job) {
      this.logger.warn(`Distribution job not found: ${jobId}`);
      return;
    }

    if (job.status === DistributionStatus.COMPLETED || job.status === DistributionStatus.CANCELLED) {
      return; // Job already finished
    }

    // Mark job as in progress
    if (job.status === DistributionStatus.PENDING) {
      job.status = DistributionStatus.IN_PROGRESS;
      job.startedAt = new Date();
    }

    // Get pending deliveries
    const pendingDeliveries = job.progress.deliveryDetails.filter(detail => 
      detail.status === 'pending' || 
      (detail.status === 'failed' && detail.attempts < job.retryConfig.maxAttempts)
    );

    if (pendingDeliveries.length === 0) {
      // All deliveries completed or exhausted retries
      this.completeDistributionJob(job);
      return;
    }

    // Process deliveries with concurrency limit
    const availableSlots = this.maxConcurrentDeliveries - this.activeDeliveries.size;
    const deliveriesToProcess = pendingDeliveries.slice(0, availableSlots);

    const deliveryPromises = deliveriesToProcess.map(delivery => 
      this.processDelivery(job, delivery).catch(error => {
        this.logger.error(`Delivery failed for ${delivery.targetId}: ${error.message}`);
        return false;
      })
    );

    await Promise.allSettled(deliveryPromises);
  }

  private async processDelivery(job: DistributionJob, delivery: DeliveryDetail): Promise<boolean> {
    const deliveryKey = `${job.id}_${delivery.targetId}`;
    
    if (this.activeDeliveries.has(deliveryKey)) {
      return false; // Already processing
    }

    this.activeDeliveries.add(deliveryKey);
    
    try {
      delivery.attempts++;
      delivery.lastAttemptAt = new Date();

      this.logger.debug(`Attempting delivery ${delivery.attempts}/${job.retryConfig.maxAttempts} to ${delivery.targetId} via ${delivery.method}`);

      const startTime = Date.now();
      let success = false;

      // Attempt delivery based on method
      if (delivery.method === 'websocket') {
        success = await this.deliverViaWebSocket(job, delivery);
      } else if (delivery.method === 'rest') {
        success = await this.deliverViaRest(job, delivery);
      }

      const latency = Date.now() - startTime;
      delivery.latency = latency;

      if (success) {
        delivery.status = 'delivered';
        delivery.deliveredAt = new Date();
        job.progress.successfulDeliveries++;
        job.progress.pendingDeliveries--;
        
        this.logger.debug(`Policy delivered to ${delivery.targetId} in ${latency}ms`);
      } else {
        await this.handleDeliveryFailure(job, delivery);
      }

      return success;

    } catch (error) {
      delivery.error = error.message;
      await this.handleDeliveryFailure(job, delivery);
      return false;
      
    } finally {
      this.activeDeliveries.delete(deliveryKey);
    }
  }

  private async deliverViaWebSocket(job: DistributionJob, delivery: DeliveryDetail): Promise<boolean> {
    if (!this.webSocketClient.isConnected()) {
      throw new Error('WebSocket not connected');
    }

    const policy = await this.getPolicyData(job.policyId, job.policyVersion);
    if (!policy) {
      throw new Error(`Policy not found: ${job.policyId} v${job.policyVersion}`);
    }

    const message = {
      type: 'policy_update',
      data: {
        policyId: job.policyId,
        policyVersion: job.policyVersion,
        policy: policy.policy,
        targetId: delivery.targetId,
        targetType: delivery.targetType,
        distributionJobId: job.id,
        metadata: job.metadata,
      },
      timestamp: new Date(),
    };

    const success = this.webSocketClient.sendMessage(message);
    
    if (!success) {
      throw new Error('Failed to send WebSocket message');
    }

    // For WebSocket, we consider it delivered when sent
    // In a real implementation, you'd wait for acknowledgment
    return true;
  }

  private async deliverViaRest(job: DistributionJob, delivery: DeliveryDetail): Promise<boolean> {
    const policy = await this.getPolicyData(job.policyId, job.policyVersion);
    if (!policy) {
      throw new Error(`Policy not found: ${job.policyId} v${job.policyVersion}`);
    }

    const restEndpoint = this.getRestEndpoint(delivery.targetId, delivery.targetType);
    const payload = {
      policyId: job.policyId,
      policyVersion: job.policyVersion,
      policy: policy.policy,
      distributionJobId: job.id,
      metadata: job.metadata,
    };

    try {
      const response = await axios.default.post(restEndpoint, payload, {
        timeout: this.deliveryTimeout,
        headers: {
          'Content-Type': 'application/json',
          'X-Distribution-Job-Id': job.id,
        },
      });

      return response.status >= 200 && response.status < 300;
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('TIMEOUT');
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error('CONNECTION_REFUSED');
      } else if (error.response?.status === 429) {
        throw new Error('RATE_LIMITED');
      } else if (error.response?.status >= 500) {
        throw new Error('TEMPORARY_FAILURE');
      } else {
        throw new Error(`HTTP ${error.response?.status || 'NETWORK_ERROR'}`);
      }
    }
  }

  private async handleDeliveryFailure(job: DistributionJob, delivery: DeliveryDetail): Promise<void> {
    if (delivery.attempts >= job.retryConfig.maxAttempts) {
      // Exhausted all retries
      delivery.status = 'failed';
      job.progress.failedDeliveries++;
      job.progress.pendingDeliveries--;
      
      this.logger.warn(`Delivery permanently failed for ${delivery.targetId} after ${delivery.attempts} attempts`);
    } else {
      // Schedule retry
      const retryDelay = this.calculateRetryDelay(delivery.attempts, job.retryConfig);
      
      // In a real implementation, you'd schedule the retry
      // For now, we'll just mark it as pending and it will be retried in the next cycle
      delivery.status = 'pending';
      
      this.logger.debug(`Delivery retry scheduled for ${delivery.targetId} in ${retryDelay}ms (attempt ${delivery.attempts + 1}/${job.retryConfig.maxAttempts})`);
    }
  }

  private calculateRetryDelay(attemptNumber: number, retryConfig: RetryConfig): number {
    const delay = retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attemptNumber - 1);
    return Math.min(delay, retryConfig.maxDelay);
  }

  private completeDistributionJob(job: DistributionJob): void {
    job.completedAt = new Date();
    
    if (job.progress.failedDeliveries === 0) {
      job.status = DistributionStatus.COMPLETED;
    } else if (job.progress.successfulDeliveries > 0) {
      job.status = DistributionStatus.PARTIALLY_COMPLETED;
    } else {
      job.status = DistributionStatus.FAILED;
    }

    const duration = job.completedAt.getTime() - (job.startedAt?.getTime() || job.createdAt.getTime());
    
    this.logger.log(`Distribution job ${job.id} completed: ${job.progress.successfulDeliveries}/${job.progress.totalTargets} successful in ${duration}ms`);
  }

  private selectDeliveryMethod(distributionMethod: DistributionJob['distributionMethod']): 'websocket' | 'rest' {
    if (distributionMethod === 'websocket') return 'websocket';
    if (distributionMethod === 'rest') return 'rest';
    
    // For 'both', prefer WebSocket if available, fallback to REST
    return this.webSocketClient.isConnected() ? 'websocket' : 'rest';
  }

  private getRestEndpoint(targetId: string, targetType: 'agent' | 'organization'): string {
    const baseUrl = this.config.get('POLICY_REST_BASE_URL', 'http://localhost:3000');
    
    if (targetType === 'agent') {
      return `${baseUrl}/agents/${targetId}/policies`;
    } else {
      return `${baseUrl}/organizations/${targetId}/policies`;
    }
  }

  private async getPolicyData(policyId: string, version: string): Promise<PolicyVersion | null> {
    // In a real implementation, this would fetch from the policy versioning service
    // For now, return a mock policy
    return {
      id: policyId,
      version: version,
      name: 'Mock Policy',
      policy: { rules: [], settings: {} },
      checksum: 'mock-checksum',
      createdAt: new Date(),
      createdBy: 'system',
      organizationId: 1,
      status: 'active',
      tags: [],
      metadata: {},
    };
  }

  async getDistributionJob(jobId: string): Promise<DistributionJob | undefined> {
    return this.distributionJobs.get(jobId);
  }

  async cancelDistributionJob(jobId: string): Promise<boolean> {
    const job = this.distributionJobs.get(jobId);
    if (!job) {
      return false;
    }

    if (job.status === DistributionStatus.COMPLETED || job.status === DistributionStatus.CANCELLED) {
      return false; // Already finished
    }

    job.status = DistributionStatus.CANCELLED;
    job.completedAt = new Date();

    this.logger.log(`Distribution job cancelled: ${jobId}`);
    return true;
  }

  async retryFailedDeliveries(jobId: string): Promise<boolean> {
    const job = this.distributionJobs.get(jobId);
    if (!job) {
      return false;
    }

    // Reset failed deliveries to pending
    let retriedCount = 0;
    job.progress.deliveryDetails.forEach(delivery => {
      if (delivery.status === 'failed') {
        delivery.status = 'pending';
        delivery.attempts = 0;
        delivery.error = undefined;
        retriedCount++;
      }
    });

    if (retriedCount > 0) {
      job.status = DistributionStatus.IN_PROGRESS;
      job.progress.failedDeliveries -= retriedCount;
      job.progress.pendingDeliveries += retriedCount;
      
      this.logger.log(`Retrying ${retriedCount} failed deliveries for job ${jobId}`);
    }

    return retriedCount > 0;
  }

  async getDistributionStats(): Promise<DistributionStats> {
    const jobs = Array.from(this.distributionJobs.values());
    
    const stats: DistributionStats = {
      totalJobs: jobs.length,
      activeJobs: jobs.filter(job => job.status === DistributionStatus.IN_PROGRESS).length,
      completedJobs: jobs.filter(job => job.status === DistributionStatus.COMPLETED).length,
      failedJobs: jobs.filter(job => job.status === DistributionStatus.FAILED).length,
      averageDeliveryTime: 0,
      successRate: 0,
      deliveryMethodStats: {
        websocket: { attempts: 0, successes: 0, failures: 0 },
        rest: { attempts: 0, successes: 0, failures: 0 },
      },
    };

    let totalDeliveryTime = 0;
    let deliveryTimeCount = 0;
    let totalDeliveries = 0;
    let successfulDeliveries = 0;

    jobs.forEach(job => {
      totalDeliveries += job.progress.totalTargets;
      successfulDeliveries += job.progress.successfulDeliveries;

      job.progress.deliveryDetails.forEach(delivery => {
        if (delivery.method === 'websocket') {
          stats.deliveryMethodStats.websocket.attempts++;
          if (delivery.status === 'delivered') {
            stats.deliveryMethodStats.websocket.successes++;
          } else if (delivery.status === 'failed') {
            stats.deliveryMethodStats.websocket.failures++;
          }
        } else if (delivery.method === 'rest') {
          stats.deliveryMethodStats.rest.attempts++;
          if (delivery.status === 'delivered') {
            stats.deliveryMethodStats.rest.successes++;
          } else if (delivery.status === 'failed') {
            stats.deliveryMethodStats.rest.failures++;
          }
        }

        if (delivery.latency) {
          totalDeliveryTime += delivery.latency;
          deliveryTimeCount++;
        }
      });
    });

    stats.averageDeliveryTime = deliveryTimeCount > 0 ? totalDeliveryTime / deliveryTimeCount : 0;
    stats.successRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0;

    return stats;
  }

  async getActiveDistributions(): Promise<DistributionJob[]> {
    return Array.from(this.distributionJobs.values())
      .filter(job => job.status === DistributionStatus.IN_PROGRESS)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async getDistributionHistory(limit?: number): Promise<DistributionJob[]> {
    let jobs = Array.from(this.distributionJobs.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (limit) {
      jobs = jobs.slice(0, limit);
    }

    return jobs;
  }

  async cleanupOldJobs(olderThanDays: number = 30): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    let removedCount = 0;

    for (const [jobId, job] of this.distributionJobs.entries()) {
      if (job.createdAt < cutoff && 
          (job.status === DistributionStatus.COMPLETED || 
           job.status === DistributionStatus.FAILED || 
           job.status === DistributionStatus.CANCELLED)) {
        
        this.distributionJobs.delete(jobId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.log(`Cleaned up ${removedCount} old distribution jobs`);
    }

    return removedCount;
  }

  private generateJobId(): string {
    return `dist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}