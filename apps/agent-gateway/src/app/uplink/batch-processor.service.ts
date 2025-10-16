import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BufferService } from '../buffer/buffer.service';
import { UplinkService, UplinkRequest } from './uplink.service';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);

export interface BatchConfig {
  batchSize: number;
  processingInterval: number; // seconds
  maxConcurrentBatches: number;
  compressionEnabled: boolean;
  compressionThreshold: number; // bytes
  priorityLevels: number[];
}

export interface BatchStats {
  totalBatches: number;
  successfulBatches: number;
  failedBatches: number;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  averageBatchSize: number;
  averageProcessingTime: number;
  lastProcessedAt: Date;
  compressionRatio: number;
}

export interface BatchJob {
  id: string;
  tableName: string;
  records: any[];
  priority: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  retryCount: number;
  compressed: boolean;
  originalSize: number;
  compressedSize?: number;
}

@Injectable()
export class BatchProcessorService implements OnModuleInit {
  private readonly logger = new Logger(BatchProcessorService.name);
  private readonly config: BatchConfig;
  private readonly activeBatches = new Map<string, BatchJob>();
  private readonly pendingBatches: BatchJob[] = [];
  private processing = false;
  
  private stats: BatchStats = {
    totalBatches: 0,
    successfulBatches: 0,
    failedBatches: 0,
    totalRecords: 0,
    successfulRecords: 0,
    failedRecords: 0,
    averageBatchSize: 0,
    averageProcessingTime: 0,
    lastProcessedAt: new Date(),
    compressionRatio: 0,
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly bufferService: BufferService,
    private readonly uplinkService: UplinkService,
  ) {
    this.config = {
      batchSize: parseInt(this.configService.get('BATCH_SIZE', '100')),
      processingInterval: parseInt(this.configService.get('BATCH_PROCESSING_INTERVAL', '30')),
      maxConcurrentBatches: parseInt(this.configService.get('BATCH_MAX_CONCURRENT', '3')),
      compressionEnabled: this.configService.get('BATCH_COMPRESSION_ENABLED', 'true') === 'true',
      compressionThreshold: parseInt(this.configService.get('BATCH_COMPRESSION_THRESHOLD', '1024')),
      priorityLevels: [1, 2, 3, 4, 5], // 1 = highest priority
    };
  }

  async onModuleInit(): Promise<void> {
    this.logger.log(`Batch processor initialized: ${this.config.batchSize} records per batch, ${this.config.processingInterval}s interval`);
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async processBatches(): Promise<void> {
    if (this.processing) {
      this.logger.debug('Batch processing already in progress, skipping');
      return;
    }

    try {
      this.processing = true;
      await this.createAndProcessBatches();
    } catch (error) {
      this.logger.error(`Batch processing failed: ${error.message}`);
    } finally {
      this.processing = false;
    }
  }

  private async createAndProcessBatches(): Promise<void> {
    // Check if we can process more batches
    if (this.activeBatches.size >= this.config.maxConcurrentBatches) {
      this.logger.debug(`Max concurrent batches reached: ${this.activeBatches.size}`);
      return;
    }

    // Get buffer stats to see what needs processing
    const bufferStats = await this.bufferService.getBufferStats();
    if (bufferStats.totalRecords === 0) {
      return;
    }

    // Process each table type
    const tablesToProcess = Object.keys(bufferStats.recordsByTable);
    
    for (const tableName of tablesToProcess) {
      if (this.activeBatches.size >= this.config.maxConcurrentBatches) {
        break;
      }

      await this.processBatchesForTable(tableName);
    }
  }

  private async processBatchesForTable(tableName: string): Promise<void> {
    // Process by priority levels
    for (const priority of this.config.priorityLevels) {
      if (this.activeBatches.size >= this.config.maxConcurrentBatches) {
        break;
      }

      const records = await this.bufferService.getBufferedRecords(
        tableName, 
        this.config.batchSize, 
        priority
      );

      if (records.length === 0) {
        continue;
      }

      // Create batch job
      const batchJob = await this.createBatchJob(tableName, records, priority);
      
      // Process batch asynchronously
      this.processBatchJob(batchJob).catch(error => {
        this.logger.error(`Batch job ${batchJob.id} failed: ${error.message}`);
      });
    }
  }

  private async createBatchJob(tableName: string, records: any[], priority: number): Promise<BatchJob> {
    const batchId = `batch_${tableName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Parse record data
    const parsedRecords = records.map(record => {
      try {
        return JSON.parse(record.data);
      } catch (error) {
        this.logger.warn(`Failed to parse record ${record.id}: ${error.message}`);
        return null;
      }
    }).filter(record => record !== null);

    const originalSize = JSON.stringify(parsedRecords).length;
    
    const batchJob: BatchJob = {
      id: batchId,
      tableName,
      records: parsedRecords,
      priority,
      createdAt: new Date(),
      status: 'pending',
      retryCount: 0,
      compressed: false,
      originalSize,
    };

    // Compress if enabled and above threshold
    if (this.config.compressionEnabled && originalSize > this.config.compressionThreshold) {
      try {
        const compressed = await gzip(JSON.stringify(parsedRecords));
        batchJob.compressed = true;
        batchJob.compressedSize = compressed.length;
        
        this.logger.debug(`Batch ${batchId} compressed: ${originalSize} -> ${compressed.length} bytes`);
      } catch (error) {
        this.logger.warn(`Failed to compress batch ${batchId}: ${error.message}`);
      }
    }

    this.activeBatches.set(batchId, batchJob);
    return batchJob;
  }

  private async processBatchJob(batchJob: BatchJob): Promise<void> {
    const startTime = Date.now();
    
    try {
      batchJob.status = 'processing';
      batchJob.startedAt = new Date();

      this.logger.debug(`Processing batch ${batchJob.id}: ${batchJob.records.length} records`);

      // Prepare uplink request
      const uplinkRequest: UplinkRequest = {
        endpoint: `/api/v1/monitoring/${batchJob.tableName}/batch`,
        data: {
          records: batchJob.records,
          metadata: {
            batchId: batchJob.id,
            tableName: batchJob.tableName,
            recordCount: batchJob.records.length,
            priority: batchJob.priority,
            compressed: batchJob.compressed,
            originalSize: batchJob.originalSize,
            compressedSize: batchJob.compressedSize,
          },
        },
        priority: batchJob.priority,
        metadata: {
          batchId: batchJob.id,
          tableName: batchJob.tableName,
        },
      };

      // Send to uplink
      const response = await this.uplinkService.sendRequest(uplinkRequest);

      if (response.success) {
        // Mark as completed
        batchJob.status = 'completed';
        batchJob.completedAt = new Date();

        // Remove processed records from buffer
        const recordIds = batchJob.records.map((_, index) => index + 1); // This would need proper record IDs
        // await this.bufferService.removeFromBuffer(recordIds);

        // Update stats
        this.updateStats(batchJob, true, Date.now() - startTime);

        this.logger.debug(`Batch ${batchJob.id} completed successfully`);

      } else {
        throw new Error(`Uplink request failed: ${response.error}`);
      }

    } catch (error) {
      batchJob.status = 'failed';
      batchJob.error = error.message;
      batchJob.retryCount++;

      this.updateStats(batchJob, false, Date.now() - startTime);

      this.logger.error(`Batch ${batchJob.id} failed: ${error.message}`);

      // Retry logic
      if (batchJob.retryCount < 3) {
        this.logger.debug(`Scheduling retry for batch ${batchJob.id} (attempt ${batchJob.retryCount + 1})`);
        
        // Schedule retry with exponential backoff
        const retryDelay = Math.pow(2, batchJob.retryCount) * 1000; // 1s, 2s, 4s
        setTimeout(() => {
          this.processBatchJob(batchJob).catch(retryError => {
            this.logger.error(`Batch retry ${batchJob.id} failed: ${retryError.message}`);
          });
        }, retryDelay);
      } else {
        this.logger.error(`Batch ${batchJob.id} exceeded max retries, marking as permanently failed`);
      }

    } finally {
      // Clean up completed or permanently failed batches
      if (batchJob.status === 'completed' || 
          (batchJob.status === 'failed' && batchJob.retryCount >= 3)) {
        this.activeBatches.delete(batchJob.id);
      }
    }
  }

  private updateStats(batchJob: BatchJob, success: boolean, processingTime: number): void {
    this.stats.totalBatches++;
    this.stats.totalRecords += batchJob.records.length;

    if (success) {
      this.stats.successfulBatches++;
      this.stats.successfulRecords += batchJob.records.length;
    } else {
      this.stats.failedBatches++;
      this.stats.failedRecords += batchJob.records.length;
    }

    // Update average batch size
    this.stats.averageBatchSize = this.stats.totalRecords / this.stats.totalBatches;

    // Update average processing time
    const currentAvg = this.stats.averageProcessingTime;
    const totalBatches = this.stats.totalBatches;
    this.stats.averageProcessingTime = ((currentAvg * (totalBatches - 1)) + processingTime) / totalBatches;

    // Update compression ratio
    if (batchJob.compressed && batchJob.compressedSize) {
      const ratio = (batchJob.originalSize - batchJob.compressedSize) / batchJob.originalSize;
      const currentCompressionRatio = this.stats.compressionRatio;
      this.stats.compressionRatio = ((currentCompressionRatio * (totalBatches - 1)) + ratio) / totalBatches;
    }

    this.stats.lastProcessedAt = new Date();
  }

  async forceBatchProcessing(): Promise<void> {
    this.logger.log('Forcing batch processing');
    await this.processBatches();
  }

  getBatchStats(): BatchStats {
    return { ...this.stats };
  }

  getActiveBatches(): BatchJob[] {
    return Array.from(this.activeBatches.values());
  }

  getBatchConfig(): BatchConfig {
    return { ...this.config };
  }

  async updateBatchConfig(newConfig: Partial<BatchConfig>): Promise<void> {
    Object.assign(this.config, newConfig);
    this.logger.log('Batch configuration updated', this.config);
  }

  resetStats(): void {
    this.stats = {
      totalBatches: 0,
      successfulBatches: 0,
      failedBatches: 0,
      totalRecords: 0,
      successfulRecords: 0,
      failedRecords: 0,
      averageBatchSize: 0,
      averageProcessingTime: 0,
      lastProcessedAt: new Date(),
      compressionRatio: 0,
    };
    this.logger.log('Batch stats reset');
  }

  async getBatchHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    activeBatches: number;
    pendingBatches: number;
    successRate: number;
    averageLatency: number;
    issues: string[];
  }> {
    const activeBatchCount = this.activeBatches.size;
    const pendingBatchCount = this.pendingBatches.length;
    const successRate = this.stats.totalBatches > 0 
      ? (this.stats.successfulBatches / this.stats.totalBatches) * 100 
      : 100;

    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check for issues
    if (activeBatchCount >= this.config.maxConcurrentBatches) {
      status = 'warning';
      issues.push('Maximum concurrent batches reached');
    }

    if (successRate < 90) {
      status = 'critical';
      issues.push(`Low success rate: ${successRate.toFixed(1)}%`);
    } else if (successRate < 95) {
      status = status === 'healthy' ? 'warning' : status;
      issues.push(`Moderate success rate: ${successRate.toFixed(1)}%`);
    }

    if (this.stats.averageProcessingTime > 30000) { // 30 seconds
      status = status === 'healthy' ? 'warning' : status;
      issues.push(`High processing time: ${this.stats.averageProcessingTime.toFixed(0)}ms`);
    }

    // Check for stuck batches
    const stuckBatches = Array.from(this.activeBatches.values()).filter(batch => {
      if (!batch.startedAt) return false;
      const processingTime = Date.now() - batch.startedAt.getTime();
      return processingTime > 300000; // 5 minutes
    });

    if (stuckBatches.length > 0) {
      status = 'critical';
      issues.push(`${stuckBatches.length} stuck batches detected`);
    }

    return {
      status,
      activeBatches: activeBatchCount,
      pendingBatches: pendingBatchCount,
      successRate,
      averageLatency: this.stats.averageProcessingTime,
      issues,
    };
  }

  async cancelBatch(batchId: string): Promise<boolean> {
    const batch = this.activeBatches.get(batchId);
    if (!batch) {
      return false;
    }

    if (batch.status === 'processing') {
      this.logger.warn(`Cannot cancel batch ${batchId} - already processing`);
      return false;
    }

    batch.status = 'failed';
    batch.error = 'Cancelled by user';
    this.activeBatches.delete(batchId);

    this.logger.log(`Batch ${batchId} cancelled`);
    return true;
  }

  async retryFailedBatches(): Promise<number> {
    const failedBatches = Array.from(this.activeBatches.values())
      .filter(batch => batch.status === 'failed' && batch.retryCount < 3);

    let retriedCount = 0;

    for (const batch of failedBatches) {
      batch.status = 'pending';
      batch.error = undefined;
      
      this.processBatchJob(batch).catch(error => {
        this.logger.error(`Batch retry ${batch.id} failed: ${error.message}`);
      });
      
      retriedCount++;
    }

    this.logger.log(`Retrying ${retriedCount} failed batches`);
    return retriedCount;
  }
}