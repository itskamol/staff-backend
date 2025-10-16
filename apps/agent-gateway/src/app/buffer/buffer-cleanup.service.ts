import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BufferService } from './buffer.service';
import { DiskMonitoringService } from './disk-monitoring.service';
import { BackPressureService } from './back-pressure.service';

export interface CleanupStats {
  totalCleaned: number;
  oldRecordsCleaned: number;
  failedRecordsCleaned: number;
  spaceSavedBytes: number;
  cleanupDuration: number;
  lastCleanupAt: Date;
}

export interface CleanupConfig {
  enableAutoCleanup: boolean;
  retentionDays: number;
  maxFailedRecords: number;
  emergencyCleanupThreshold: number; // disk usage percentage
  fifoCleanupBatchSize: number;
  cleanupInterval: string; // cron expression
}

@Injectable()
export class BufferCleanupService {
  private readonly logger = new Logger(BufferCleanupService.name);
  private readonly config: CleanupConfig;
  private cleanupStats: CleanupStats = {
    totalCleaned: 0,
    oldRecordsCleaned: 0,
    failedRecordsCleaned: 0,
    spaceSavedBytes: 0,
    cleanupDuration: 0,
    lastCleanupAt: new Date(),
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly bufferService: BufferService,
    private readonly diskMonitoring: DiskMonitoringService,
    private readonly backPressure: BackPressureService,
  ) {
    this.config = {
      enableAutoCleanup: this.configService.get('CLEANUP_ENABLE_AUTO', 'true') === 'true',
      retentionDays: parseInt(this.configService.get('CLEANUP_RETENTION_DAYS', '7')),
      maxFailedRecords: parseInt(this.configService.get('CLEANUP_MAX_FAILED_RECORDS', '1000')),
      emergencyCleanupThreshold: parseFloat(this.configService.get('CLEANUP_EMERGENCY_THRESHOLD', '90')),
      fifoCleanupBatchSize: parseInt(this.configService.get('CLEANUP_FIFO_BATCH_SIZE', '1000')),
      cleanupInterval: this.configService.get('CLEANUP_INTERVAL', '0 */6 * * *'), // Every 6 hours
    };
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async performScheduledCleanup(): Promise<void> {
    if (!this.config.enableAutoCleanup) {
      this.logger.debug('Auto cleanup is disabled');
      return;
    }

    try {
      await this.performCleanup();
    } catch (error) {
      this.logger.error(`Scheduled cleanup failed: ${error.message}`);
    }
  }

  async performCleanup(force: boolean = false): Promise<CleanupStats> {
    const startTime = Date.now();
    this.logger.log('Starting buffer cleanup');

    try {
      let totalCleaned = 0;
      let oldRecordsCleaned = 0;
      let failedRecordsCleaned = 0;
      const spaceBefore = this.diskMonitoring.getDiskUsage().usedBytes;

      // Check if emergency cleanup is needed
      const diskUsage = this.diskMonitoring.getDiskUsage();
      const isEmergency = diskUsage.usedPercent >= this.config.emergencyCleanupThreshold;

      if (isEmergency || force) {
        this.logger.warn(`Emergency cleanup triggered: ${diskUsage.usedPercent.toFixed(1)}% disk usage`);
        
        // Perform aggressive FIFO cleanup
        const fifoCleanedCount = await this.performFifoCleanup();
        totalCleaned += fifoCleanedCount;
        
        this.logger.log(`Emergency FIFO cleanup removed ${fifoCleanedCount} records`);
      }

      // Clean up old records based on retention policy
      const oldRecordsCount = await this.cleanupOldRecords();
      oldRecordsCleaned += oldRecordsCount;
      totalCleaned += oldRecordsCount;

      // Clean up failed records
      const failedRecordsCount = await this.cleanupFailedRecords();
      failedRecordsCleaned += failedRecordsCount;
      totalCleaned += failedRecordsCount;

      // Clean up orphaned records (if any)
      const orphanedCount = await this.cleanupOrphanedRecords();
      totalCleaned += orphanedCount;

      // Update buffer record count for back-pressure
      const bufferStats = await this.bufferService.getBufferStats();
      this.backPressure.updateRecordCount(bufferStats.totalRecords);

      const spaceAfter = this.diskMonitoring.getDiskUsage().usedBytes;
      const spaceSaved = Math.max(0, spaceBefore - spaceAfter);
      const cleanupDuration = Date.now() - startTime;

      // Update cleanup stats
      this.cleanupStats = {
        totalCleaned,
        oldRecordsCleaned,
        failedRecordsCleaned,
        spaceSavedBytes: spaceSaved,
        cleanupDuration,
        lastCleanupAt: new Date(),
      };

      this.logger.log(
        `Cleanup completed: ${totalCleaned} records removed, ` +
        `${this.diskMonitoring.formatBytes(spaceSaved)} space saved in ${cleanupDuration}ms`
      );

      return this.cleanupStats;

    } catch (error) {
      this.logger.error(`Cleanup failed: ${error.message}`);
      throw error;
    }
  }

  private async cleanupOldRecords(): Promise<number> {
    try {
      const cutoffTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
      
      // Get old records first to count them
      const oldRecords = await this.getOldRecords(cutoffTime);
      
      if (oldRecords.length === 0) {
        return 0;
      }

      // Remove old records in batches
      const batchSize = 1000;
      let totalRemoved = 0;

      for (let i = 0; i < oldRecords.length; i += batchSize) {
        const batch = oldRecords.slice(i, i + batchSize);
        const recordIds = batch.map(record => record.id);
        
        const removedCount = await this.bufferService.removeFromBuffer(recordIds);
        totalRemoved += removedCount;
      }

      this.logger.debug(`Cleaned up ${totalRemoved} old records (older than ${this.config.retentionDays} days)`);
      return totalRemoved;

    } catch (error) {
      this.logger.error(`Failed to cleanup old records: ${error.message}`);
      return 0;
    }
  }

  private async cleanupFailedRecords(): Promise<number> {
    try {
      const failedRecords = await this.bufferService.getFailedRecords();
      
      if (failedRecords.length === 0) {
        return 0;
      }

      // Remove failed records that exceed the maximum allowed
      let recordsToRemove = failedRecords;
      if (failedRecords.length > this.config.maxFailedRecords) {
        // Keep the most recent failed records, remove the oldest
        recordsToRemove = failedRecords
          .sort((a, b) => a.created_at - b.created_at)
          .slice(0, failedRecords.length - this.config.maxFailedRecords);
      } else {
        // Remove all failed records if under the limit
        recordsToRemove = failedRecords;
      }

      if (recordsToRemove.length === 0) {
        return 0;
      }

      const recordIds = recordsToRemove.map(record => record.id);
      const removedCount = await this.bufferService.removeFromBuffer(recordIds);

      this.logger.debug(`Cleaned up ${removedCount} failed records`);
      return removedCount;

    } catch (error) {
      this.logger.error(`Failed to cleanup failed records: ${error.message}`);
      return 0;
    }
  }

  private async cleanupOrphanedRecords(): Promise<number> {
    try {
      // This would identify and clean up any orphaned or corrupted records
      // For now, we'll implement a basic check for records with invalid data
      
      // In a real implementation, you might check for:
      // - Records with invalid JSON data
      // - Records with missing required fields
      // - Records that are too old but weren't caught by retention cleanup
      
      // For this implementation, we'll return 0 as a placeholder
      return 0;

    } catch (error) {
      this.logger.error(`Failed to cleanup orphaned records: ${error.message}`);
      return 0;
    }
  }

  private async performFifoCleanup(): Promise<number> {
    try {
      // Get oldest records for FIFO cleanup
      const oldestRecords = await this.getOldestRecords(this.config.fifoCleanupBatchSize);
      
      if (oldestRecords.length === 0) {
        return 0;
      }

      const recordIds = oldestRecords.map(record => record.id);
      const removedCount = await this.bufferService.removeFromBuffer(recordIds);

      this.logger.debug(`FIFO cleanup removed ${removedCount} oldest records`);
      return removedCount;

    } catch (error) {
      this.logger.error(`FIFO cleanup failed: ${error.message}`);
      return 0;
    }
  }

  private async getOldRecords(cutoffTime: number): Promise<any[]> {
    // This would query the database for old records
    // For now, we'll return an empty array as a placeholder
    // In the real implementation, this would use the BufferService to query old records
    return [];
  }

  private async getOldestRecords(limit: number): Promise<any[]> {
    // This would query the database for the oldest records
    // For now, we'll return an empty array as a placeholder
    // In the real implementation, this would use the BufferService to query oldest records
    return [];
  }

  async getCleanupStats(): Promise<CleanupStats> {
    return { ...this.cleanupStats };
  }

  async getCleanupConfig(): Promise<CleanupConfig> {
    return { ...this.config };
  }

  async updateCleanupConfig(newConfig: Partial<CleanupConfig>): Promise<void> {
    Object.assign(this.config, newConfig);
    this.logger.log('Cleanup configuration updated', this.config);
  }

  async estimateCleanupImpact(): Promise<{
    oldRecordsCount: number;
    failedRecordsCount: number;
    estimatedSpaceSaved: number;
    estimatedCleanupTime: number;
  }> {
    try {
      const cutoffTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
      const oldRecords = await this.getOldRecords(cutoffTime);
      const failedRecords = await this.bufferService.getFailedRecords();

      // Estimate space saved (rough calculation)
      const avgRecordSize = 1024; // 1KB per record assumption
      const totalRecordsToClean = oldRecords.length + failedRecords.length;
      const estimatedSpaceSaved = totalRecordsToClean * avgRecordSize;

      // Estimate cleanup time (rough calculation)
      const recordsPerSecond = 1000; // Processing rate assumption
      const estimatedCleanupTime = Math.ceil(totalRecordsToClean / recordsPerSecond) * 1000; // milliseconds

      return {
        oldRecordsCount: oldRecords.length,
        failedRecordsCount: failedRecords.length,
        estimatedSpaceSaved,
        estimatedCleanupTime,
      };

    } catch (error) {
      this.logger.error(`Failed to estimate cleanup impact: ${error.message}`);
      return {
        oldRecordsCount: 0,
        failedRecordsCount: 0,
        estimatedSpaceSaved: 0,
        estimatedCleanupTime: 0,
      };
    }
  }

  async performEmergencyCleanup(): Promise<CleanupStats> {
    this.logger.warn('Performing emergency cleanup');
    return await this.performCleanup(true);
  }

  resetCleanupStats(): void {
    this.cleanupStats = {
      totalCleaned: 0,
      oldRecordsCleaned: 0,
      failedRecordsCleaned: 0,
      spaceSavedBytes: 0,
      cleanupDuration: 0,
      lastCleanupAt: new Date(),
    };
    this.logger.log('Cleanup stats reset');
  }

  async getCleanupRecommendations(): Promise<{
    shouldCleanup: boolean;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    recommendations: string[];
    estimatedBenefit: string;
  }> {
    const diskUsage = this.diskMonitoring.getDiskUsage();
    const bufferStats = await this.bufferService.getBufferStats();
    const cleanupImpact = await this.estimateCleanupImpact();

    const recommendations: string[] = [];
    let urgency: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let shouldCleanup = false;

    // Determine urgency based on disk usage
    if (diskUsage.usedPercent >= 95) {
      urgency = 'critical';
      shouldCleanup = true;
      recommendations.push('CRITICAL: Immediate cleanup required - disk usage above 95%');
    } else if (diskUsage.usedPercent >= 85) {
      urgency = 'high';
      shouldCleanup = true;
      recommendations.push('HIGH: Cleanup recommended - disk usage above 85%');
    } else if (diskUsage.usedPercent >= 70) {
      urgency = 'medium';
      shouldCleanup = true;
      recommendations.push('MEDIUM: Consider cleanup - disk usage above 70%');
    }

    // Check record age
    if (bufferStats.oldestRecord) {
      const oldestAge = Date.now() - bufferStats.oldestRecord.getTime();
      const ageInDays = oldestAge / (1000 * 60 * 60 * 24);
      
      if (ageInDays > this.config.retentionDays * 2) {
        urgency = urgency === 'low' ? 'medium' : urgency;
        shouldCleanup = true;
        recommendations.push(`Old records detected: ${ageInDays.toFixed(1)} days old`);
      }
    }

    // Check failed records
    if (cleanupImpact.failedRecordsCount > this.config.maxFailedRecords) {
      urgency = urgency === 'low' ? 'medium' : urgency;
      shouldCleanup = true;
      recommendations.push(`High failed record count: ${cleanupImpact.failedRecordsCount}`);
    }

    // Generate benefit estimate
    const estimatedBenefit = cleanupImpact.estimatedSpaceSaved > 0
      ? `Estimated space savings: ${this.diskMonitoring.formatBytes(cleanupImpact.estimatedSpaceSaved)}`
      : 'Minimal space savings expected';

    if (!shouldCleanup) {
      recommendations.push('No immediate cleanup needed');
    }

    return {
      shouldCleanup,
      urgency,
      recommendations,
      estimatedBenefit,
    };
  }
}