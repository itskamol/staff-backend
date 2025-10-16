import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataMigrationService, MigrationJob, MigrationStatus } from './data-migration.service';

export interface MigrationMetrics {
  timestamp: Date;
  jobId: string;
  status: MigrationStatus;
  throughput: number; // records per second
  errorRate: number; // percentage
  memoryUsage: number; // MB
  cpuUsage: number; // percentage
  networkIO: number; // bytes per second
  diskIO: number; // bytes per second
  queueDepth: number;
  latency: number; // milliseconds
}

export interface MigrationAlert {
  id: string;
  jobId: string;
  severity: 'info' | 'warning' | 'critical';
  type: 'performance' | 'error' | 'resource' | 'completion';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

export interface PerformanceThresholds {
  throughputWarning: number; // records per second
  throughputCritical: number;
  errorRateWarning: number; // percentage
  errorRateCritical: number;
  memoryWarning: number; // MB
  memoryCritical: number;
  latencyWarning: number; // milliseconds
  latencyCritical: number;
  queueDepthWarning: number;
  queueDepthCritical: number;
}

export interface MigrationReport {
  jobId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // milliseconds
  status: MigrationStatus;
  totalRecords: number;
  migratedRecords: number;
  failedRecords: number;
  averageThroughput: number;
  peakThroughput: number;
  averageLatency: number;
  peakLatency: number;
  errorRate: number;
  resourceUtilization: {
    averageMemory: number;
    peakMemory: number;
    averageCPU: number;
    peakCPU: number;
  };
  alerts: MigrationAlert[];
  recommendations: string[];
}

@Injectable()
export class MigrationMonitoringService {
  private readonly logger = new Logger(MigrationMonitoringService.name);
  
  private metricsHistory = new Map<string, MigrationMetrics[]>();
  private activeAlerts = new Map<string, MigrationAlert>();
  private alertCounter = 0;
  
  private performanceThresholds: PerformanceThresholds = {
    throughputWarning: 100, // records/sec
    throughputCritical: 50,
    errorRateWarning: 1, // 1%
    errorRateCritical: 5, // 5%
    memoryWarning: 1024, // 1GB
    memoryCritical: 2048, // 2GB
    latencyWarning: 1000, // 1 second
    latencyCritical: 5000, // 5 seconds
    queueDepthWarning: 1000,
    queueDepthCritical: 5000,
  };

  constructor(
    private readonly config: ConfigService,
    private readonly dataMigration: DataMigrationService,
  ) {
    // Override thresholds from config
    this.performanceThresholds = {
      ...this.performanceThresholds,
      throughputWarning: parseInt(this.config.get('MIGRATION_THROUGHPUT_WARNING', '100')),
      throughputCritical: parseInt(this.config.get('MIGRATION_THROUGHPUT_CRITICAL', '50')),
      errorRateWarning: parseFloat(this.config.get('MIGRATION_ERROR_RATE_WARNING', '1')),
      errorRateCritical: parseFloat(this.config.get('MIGRATION_ERROR_RATE_CRITICAL', '5')),
      memoryWarning: parseInt(this.config.get('MIGRATION_MEMORY_WARNING', '1024')),
      memoryCritical: parseInt(this.config.get('MIGRATION_MEMORY_CRITICAL', '2048')),
      latencyWarning: parseInt(this.config.get('MIGRATION_LATENCY_WARNING', '1000')),
      latencyCritical: parseInt(this.config.get('MIGRATION_LATENCY_CRITICAL', '5000')),
      queueDepthWarning: parseInt(this.config.get('MIGRATION_QUEUE_DEPTH_WARNING', '1000')),
      queueDepthCritical: parseInt(this.config.get('MIGRATION_QUEUE_DEPTH_CRITICAL', '5000')),
    };
  }

  /**
   * Collects metrics for all active migrations
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async collectMetrics(): Promise<void> {
    const activeMigrations = this.dataMigration.getActiveMigrations();
    
    for (const job of activeMigrations) {
      if (job.status === MigrationStatus.RUNNING) {
        await this.collectJobMetrics(job);
      }
    }
  }

  private async collectJobMetrics(job: MigrationJob): Promise<void> {
    try {
      const metrics: MigrationMetrics = {
        timestamp: new Date(),
        jobId: job.id,
        status: job.status,
        throughput: job.throughput,
        errorRate: job.errorRate,
        memoryUsage: await this.getMemoryUsage(),
        cpuUsage: await this.getCPUUsage(),
        networkIO: await this.getNetworkIO(),
        diskIO: await this.getDiskIO(),
        queueDepth: this.getQueueDepth(job),
        latency: this.calculateLatency(job),
      };

      // Store metrics
      if (!this.metricsHistory.has(job.id)) {
        this.metricsHistory.set(job.id, []);
      }
      
      const jobMetrics = this.metricsHistory.get(job.id)!;
      jobMetrics.push(metrics);
      
      // Keep only last 1000 metrics per job
      if (jobMetrics.length > 1000) {
        jobMetrics.splice(0, jobMetrics.length - 1000);
      }

      // Check for alerts
      await this.checkMetricsForAlerts(metrics);

    } catch (error) {
      this.logger.error(`Failed to collect metrics for job ${job.id}: ${error.message}`);
    }
  }

  private async getMemoryUsage(): Promise<number> {
    const memUsage = process.memoryUsage();
    return Math.round(memUsage.heapUsed / 1024 / 1024); // Convert to MB
  }

  private async getCPUUsage(): Promise<number> {
    // Simple CPU usage estimation based on process.cpuUsage()
    const startUsage = process.cpuUsage();
    await new Promise(resolve => setTimeout(resolve, 100));
    const endUsage = process.cpuUsage(startUsage);
    
    const totalUsage = endUsage.user + endUsage.system;
    const percentage = (totalUsage / 100000) / 1; // Rough estimation
    
    return Math.min(100, Math.max(0, percentage));
  }

  private async getNetworkIO(): Promise<number> {
    // This would typically come from system monitoring
    // For now, return a placeholder value
    return 0;
  }

  private async getDiskIO(): Promise<number> {
    // This would typically come from system monitoring
    // For now, return a placeholder value
    return 0;
  }

  private getQueueDepth(job: MigrationJob): number {
    const batches = this.dataMigration.getMigrationBatches(job.id);
    return batches.filter(b => b.status === 'pending').length;
  }

  private calculateLatency(job: MigrationJob): number {
    const batches = this.dataMigration.getMigrationBatches(job.id);
    const completedBatches = batches.filter(b => b.status === 'completed' && b.startTime && b.endTime);
    
    if (completedBatches.length === 0) {
      return 0;
    }

    const totalLatency = completedBatches.reduce((sum, batch) => {
      const duration = batch.endTime!.getTime() - batch.startTime!.getTime();
      return sum + duration;
    }, 0);

    return totalLatency / completedBatches.length;
  }

  private async checkMetricsForAlerts(metrics: MigrationMetrics): Promise<void> {
    // Check throughput alerts
    if (metrics.throughput < this.performanceThresholds.throughputCritical) {
      await this.createAlert(
        metrics.jobId,
        'critical',
        'performance',
        `Critical: Throughput dropped to ${metrics.throughput.toFixed(1)} records/sec`,
        { threshold: this.performanceThresholds.throughputCritical, actual: metrics.throughput }
      );
    } else if (metrics.throughput < this.performanceThresholds.throughputWarning) {
      await this.createAlert(
        metrics.jobId,
        'warning',
        'performance',
        `Warning: Low throughput ${metrics.throughput.toFixed(1)} records/sec`,
        { threshold: this.performanceThresholds.throughputWarning, actual: metrics.throughput }
      );
    }

    // Check error rate alerts
    if (metrics.errorRate > this.performanceThresholds.errorRateCritical) {
      await this.createAlert(
        metrics.jobId,
        'critical',
        'error',
        `Critical: High error rate ${metrics.errorRate.toFixed(1)}%`,
        { threshold: this.performanceThresholds.errorRateCritical, actual: metrics.errorRate }
      );
    } else if (metrics.errorRate > this.performanceThresholds.errorRateWarning) {
      await this.createAlert(
        metrics.jobId,
        'warning',
        'error',
        `Warning: Elevated error rate ${metrics.errorRate.toFixed(1)}%`,
        { threshold: this.performanceThresholds.errorRateWarning, actual: metrics.errorRate }
      );
    }

    // Check memory usage alerts
    if (metrics.memoryUsage > this.performanceThresholds.memoryCritical) {
      await this.createAlert(
        metrics.jobId,
        'critical',
        'resource',
        `Critical: High memory usage ${metrics.memoryUsage}MB`,
        { threshold: this.performanceThresholds.memoryCritical, actual: metrics.memoryUsage }
      );
    } else if (metrics.memoryUsage > this.performanceThresholds.memoryWarning) {
      await this.createAlert(
        metrics.jobId,
        'warning',
        'resource',
        `Warning: High memory usage ${metrics.memoryUsage}MB`,
        { threshold: this.performanceThresholds.memoryWarning, actual: metrics.memoryUsage }
      );
    }

    // Check latency alerts
    if (metrics.latency > this.performanceThresholds.latencyCritical) {
      await this.createAlert(
        metrics.jobId,
        'critical',
        'performance',
        `Critical: High latency ${metrics.latency}ms`,
        { threshold: this.performanceThresholds.latencyCritical, actual: metrics.latency }
      );
    } else if (metrics.latency > this.performanceThresholds.latencyWarning) {
      await this.createAlert(
        metrics.jobId,
        'warning',
        'performance',
        `Warning: High latency ${metrics.latency}ms`,
        { threshold: this.performanceThresholds.latencyWarning, actual: metrics.latency }
      );
    }

    // Check queue depth alerts
    if (metrics.queueDepth > this.performanceThresholds.queueDepthCritical) {
      await this.createAlert(
        metrics.jobId,
        'critical',
        'performance',
        `Critical: High queue depth ${metrics.queueDepth}`,
        { threshold: this.performanceThresholds.queueDepthCritical, actual: metrics.queueDepth }
      );
    } else if (metrics.queueDepth > this.performanceThresholds.queueDepthWarning) {
      await this.createAlert(
        metrics.jobId,
        'warning',
        'performance',
        `Warning: High queue depth ${metrics.queueDepth}`,
        { threshold: this.performanceThresholds.queueDepthWarning, actual: metrics.queueDepth }
      );
    }
  }

  private async createAlert(
    jobId: string,
    severity: 'info' | 'warning' | 'critical',
    type: 'performance' | 'error' | 'resource' | 'completion',
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const alertKey = `${jobId}_${type}_${severity}`;
    
    // Check if similar alert already exists
    if (this.activeAlerts.has(alertKey)) {
      return;
    }

    const alert: MigrationAlert = {
      id: `alert_${++this.alertCounter}`,
      jobId,
      severity,
      type,
      message,
      timestamp: new Date(),
      acknowledged: false,
      resolved: false,
      metadata,
    };

    this.activeAlerts.set(alertKey, alert);
    
    this.logger.warn(`Migration alert [${severity.toUpperCase()}]: ${message}`);
    
    // Auto-resolve info alerts after 5 minutes
    if (severity === 'info') {
      setTimeout(() => {
        this.resolveAlert(alert.id);
      }, 5 * 60 * 1000);
    }
  }

  /**
   * Monitors migration job completion and creates completion alerts
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async monitorJobCompletion(): Promise<void> {
    const activeMigrations = this.dataMigration.getActiveMigrations();
    
    for (const job of activeMigrations) {
      if ([MigrationStatus.COMPLETED, MigrationStatus.FAILED, MigrationStatus.CANCELLED].includes(job.status)) {
        await this.createCompletionAlert(job);
      }
    }
  }

  private async createCompletionAlert(job: MigrationJob): Promise<void> {
    const alertKey = `${job.id}_completion`;
    
    if (this.activeAlerts.has(alertKey)) {
      return; // Alert already created
    }

    let severity: 'info' | 'warning' | 'critical';
    let message: string;

    switch (job.status) {
      case MigrationStatus.COMPLETED:
        severity = 'info';
        message = `Migration completed successfully: ${job.migratedRecords}/${job.totalRecords} records migrated`;
        break;
      case MigrationStatus.FAILED:
        severity = 'critical';
        message = `Migration failed: ${job.lastError || 'Unknown error'}`;
        break;
      case MigrationStatus.CANCELLED:
        severity = 'warning';
        message = `Migration cancelled: ${job.migratedRecords}/${job.totalRecords} records migrated`;
        break;
      default:
        return;
    }

    await this.createAlert(job.id, severity, 'completion', message, {
      totalRecords: job.totalRecords,
      migratedRecords: job.migratedRecords,
      failedRecords: job.failedRecords,
      duration: job.endTime ? job.endTime.getTime() - job.startTime.getTime() : null,
    });
  }

  /**
   * Generates comprehensive migration report
   */
  async generateMigrationReport(jobId: string): Promise<MigrationReport> {
    const job = this.dataMigration.getMigrationJob(jobId);
    if (!job) {
      throw new Error(`Migration job not found: ${jobId}`);
    }

    const metrics = this.metricsHistory.get(jobId) || [];
    const alerts = Array.from(this.activeAlerts.values()).filter(a => a.jobId === jobId);

    // Calculate performance statistics
    const throughputs = metrics.map(m => m.throughput).filter(t => t > 0);
    const latencies = metrics.map(m => m.latency).filter(l => l > 0);
    const memoryUsages = metrics.map(m => m.memoryUsage);
    const cpuUsages = metrics.map(m => m.cpuUsage);

    const averageThroughput = throughputs.length > 0 
      ? throughputs.reduce((sum, t) => sum + t, 0) / throughputs.length 
      : 0;
    
    const peakThroughput = throughputs.length > 0 ? Math.max(...throughputs) : 0;
    
    const averageLatency = latencies.length > 0 
      ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length 
      : 0;
    
    const peakLatency = latencies.length > 0 ? Math.max(...latencies) : 0;

    const averageMemory = memoryUsages.length > 0 
      ? memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length 
      : 0;
    
    const peakMemory = memoryUsages.length > 0 ? Math.max(...memoryUsages) : 0;

    const averageCPU = cpuUsages.length > 0 
      ? cpuUsages.reduce((sum, c) => sum + c, 0) / cpuUsages.length 
      : 0;
    
    const peakCPU = cpuUsages.length > 0 ? Math.max(...cpuUsages) : 0;

    // Generate recommendations
    const recommendations = this.generateRecommendations(job, metrics, alerts);

    const report: MigrationReport = {
      jobId,
      startTime: job.startTime,
      endTime: job.endTime,
      duration: job.endTime ? job.endTime.getTime() - job.startTime.getTime() : undefined,
      status: job.status,
      totalRecords: job.totalRecords,
      migratedRecords: job.migratedRecords,
      failedRecords: job.failedRecords,
      averageThroughput,
      peakThroughput,
      averageLatency,
      peakLatency,
      errorRate: job.errorRate,
      resourceUtilization: {
        averageMemory,
        peakMemory,
        averageCPU,
        peakCPU,
      },
      alerts,
      recommendations,
    };

    return report;
  }

  private generateRecommendations(
    job: MigrationJob,
    metrics: MigrationMetrics[],
    alerts: MigrationAlert[]
  ): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    if (job.throughput < this.performanceThresholds.throughputWarning) {
      recommendations.push('Consider increasing batch size or concurrent batches to improve throughput');
    }

    if (job.errorRate > this.performanceThresholds.errorRateWarning) {
      recommendations.push('High error rate detected. Review error logs and consider data validation');
    }

    // Resource recommendations
    const memoryUsages = metrics.map(m => m.memoryUsage);
    const avgMemory = memoryUsages.length > 0 
      ? memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length 
      : 0;

    if (avgMemory > this.performanceThresholds.memoryWarning) {
      recommendations.push('High memory usage detected. Consider reducing batch size or optimizing queries');
    }

    // Alert-based recommendations
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      recommendations.push('Critical alerts detected. Review system resources and migration configuration');
    }

    // Configuration recommendations
    if (job.config.batchSize > 5000) {
      recommendations.push('Large batch size may cause memory issues. Consider reducing to 1000-2000 records per batch');
    }

    if (job.config.maxConcurrentBatches > 5) {
      recommendations.push('High concurrency may overwhelm the database. Consider reducing concurrent batches');
    }

    // Duration-based recommendations
    if (job.endTime) {
      const duration = job.endTime.getTime() - job.startTime.getTime();
      const hours = duration / (1000 * 60 * 60);
      
      if (hours > 24) {
        recommendations.push('Migration took over 24 hours. Consider optimizing queries or increasing resources');
      }
    }

    return recommendations;
  }

  /**
   * Gets real-time metrics for a migration job
   */
  getJobMetrics(jobId: string, lastMinutes: number = 10): MigrationMetrics[] {
    const metrics = this.metricsHistory.get(jobId) || [];
    const cutoff = Date.now() - (lastMinutes * 60 * 1000);
    
    return metrics.filter(m => m.timestamp.getTime() > cutoff);
  }

  /**
   * Gets all active alerts
   */
  getActiveAlerts(jobId?: string): MigrationAlert[] {
    const alerts = Array.from(this.activeAlerts.values());
    
    if (jobId) {
      return alerts.filter(a => a.jobId === jobId && !a.resolved);
    }
    
    return alerts.filter(a => !a.resolved);
  }

  /**
   * Acknowledges an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    for (const alert of this.activeAlerts.values()) {
      if (alert.id === alertId) {
        alert.acknowledged = true;
        alert.acknowledgedAt = new Date();
        alert.acknowledgedBy = acknowledgedBy;
        
        this.logger.log(`Alert acknowledged: ${alertId} by ${acknowledgedBy}`);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Resolves an alert
   */
  resolveAlert(alertId: string): boolean {
    for (const [key, alert] of this.activeAlerts.entries()) {
      if (alert.id === alertId) {
        alert.resolved = true;
        alert.resolvedAt = new Date();
        
        this.logger.log(`Alert resolved: ${alertId}`);
        
        // Remove resolved alerts after 1 hour
        setTimeout(() => {
          this.activeAlerts.delete(key);
        }, 60 * 60 * 1000);
        
        return true;
      }
    }
    
    return false;
  }

  /**
   * Gets migration performance summary
   */
  getPerformanceSummary(): {
    totalJobs: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    averageThroughput: number;
    totalRecordsMigrated: number;
    activeAlerts: number;
    criticalAlerts: number;
  } {
    const jobs = this.dataMigration.getActiveMigrations();
    const alerts = Array.from(this.activeAlerts.values()).filter(a => !a.resolved);
    
    const allMetrics = Array.from(this.metricsHistory.values()).flat();
    const recentMetrics = allMetrics.filter(m => 
      Date.now() - m.timestamp.getTime() < 60 * 60 * 1000 // Last hour
    );
    
    const averageThroughput = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.throughput, 0) / recentMetrics.length
      : 0;

    return {
      totalJobs: jobs.length,
      activeJobs: jobs.filter(j => j.status === MigrationStatus.RUNNING).length,
      completedJobs: jobs.filter(j => j.status === MigrationStatus.COMPLETED).length,
      failedJobs: jobs.filter(j => j.status === MigrationStatus.FAILED).length,
      averageThroughput,
      totalRecordsMigrated: jobs.reduce((sum, j) => sum + j.migratedRecords, 0),
      activeAlerts: alerts.length,
      criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
    };
  }

  /**
   * Updates performance thresholds
   */
  updatePerformanceThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.performanceThresholds = { ...this.performanceThresholds, ...thresholds };
    this.logger.log('Performance thresholds updated', this.performanceThresholds);
  }

  /**
   * Gets current performance thresholds
   */
  getPerformanceThresholds(): PerformanceThresholds {
    return { ...this.performanceThresholds };
  }

  /**
   * Clears metrics history for completed jobs
   */
  clearMetricsHistory(olderThanHours: number = 24): number {
    const cutoff = Date.now() - (olderThanHours * 60 * 60 * 1000);
    let clearedCount = 0;

    for (const [jobId, metrics] of this.metricsHistory.entries()) {
      const job = this.dataMigration.getMigrationJob(jobId);
      
      if (!job || (job.endTime && job.endTime.getTime() < cutoff)) {
        this.metricsHistory.delete(jobId);
        clearedCount++;
      }
    }

    if (clearedCount > 0) {
      this.logger.log(`Cleared metrics history for ${clearedCount} jobs`);
    }

    return clearedCount;
  }
}