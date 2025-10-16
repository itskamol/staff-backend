import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DualPrismaService } from './dual-prisma.service';
import { FallbackRecoveryService } from './fallback-recovery.service';

export interface SyncQueueItem {
  id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'BATCH_INSERT';
  tableName: string;
  data: any;
  priority: number; // 1 = highest, 5 = lowest
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  processingStarted?: Date;
  processingCompleted?: Date;
}

export interface BatchSyncConfig {
  batchSize: number;
  maxBatchWaitTime: number; // milliseconds
  maxQueueSize: number;
  retryDelayBase: number; // milliseconds
  retryDelayMultiplier: number;
  maxRetryDelay: number; // milliseconds
}

export interface SyncMetrics {
  totalQueued: number;
  totalProcessed: number;
  totalFailed: number;
  averageProcessingTime: number;
  queueSize: number;
  batchesProcessed: number;
  lastSyncTime?: Date;
  syncRate: number; // items per second
}

@Injectable()
export class BufferedSyncService {
  private readonly logger = new Logger(BufferedSyncService.name);
  
  private syncQueue: Map<string, SyncQueueItem> = new Map();
  private processingQueue = false;
  private batchConfig: BatchSyncConfig;
  private syncMetrics: SyncMetrics = {
    totalQueued: 0,
    totalProcessed: 0,
    totalFailed: 0,
    averageProcessingTime: 0,
    queueSize: 0,
    batchesProcessed: 0,
    syncRate: 0,
  };

  // Priority queues for different operation types
  private priorityQueues: Map<number, SyncQueueItem[]> = new Map([
    [1, []], // Critical operations
    [2, []], // High priority
    [3, []], // Normal priority
    [4, []], // Low priority
    [5, []], // Background operations
  ]);

  constructor(
    private readonly config: ConfigService,
    private readonly dualPrisma: DualPrismaService,
    private readonly fallbackRecovery: FallbackRecoveryService,
  ) {
    this.batchConfig = {
      batchSize: parseInt(this.config.get('SYNC_BATCH_SIZE', '100')),
      maxBatchWaitTime: parseInt(this.config.get('SYNC_MAX_BATCH_WAIT_TIME', '5000')),
      maxQueueSize: parseInt(this.config.get('SYNC_MAX_QUEUE_SIZE', '10000')),
      retryDelayBase: parseInt(this.config.get('SYNC_RETRY_DELAY_BASE', '1000')),
      retryDelayMultiplier: parseFloat(this.config.get('SYNC_RETRY_DELAY_MULTIPLIER', '2.0')),
      maxRetryDelay: parseInt(this.config.get('SYNC_MAX_RETRY_DELAY', '30000')),
    };
  }

  /**
   * Queues a data operation for synchronization
   */
  queueOperation(
    operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'BATCH_INSERT',
    tableName: string,
    data: any,
    priority: number = 3,
    maxRetries: number = 3
  ): string {
    // Check if fallback is active
    const fallbackState = this.fallbackRecovery.getFallbackState();
    if (fallbackState.isActive) {
      // Buffer the operation for later sync
      this.fallbackRecovery.bufferOperation({
        operation,
        tableName,
        data,
      });
      return 'buffered';
    }

    // Check queue size limit
    if (this.syncQueue.size >= this.batchConfig.maxQueueSize) {
      this.logger.warn('Sync queue is full, dropping oldest low-priority items');
      this.dropOldestLowPriorityItems();
    }

    const queueItem: SyncQueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      operation,
      tableName,
      data,
      priority: Math.max(1, Math.min(5, priority)), // Clamp between 1-5
      timestamp: new Date(),
      retryCount: 0,
      maxRetries,
    };

    this.syncQueue.set(queueItem.id, queueItem);
    this.priorityQueues.get(queueItem.priority)?.push(queueItem);
    
    this.syncMetrics.totalQueued++;
    this.syncMetrics.queueSize = this.syncQueue.size;

    this.logger.debug(`Queued ${operation} operation for ${tableName} (priority: ${priority})`);

    // Trigger immediate processing for high-priority items
    if (priority <= 2 && !this.processingQueue) {
      setImmediate(() => this.processQueue());
    }

    return queueItem.id;
  }

  /**
   * Processes the sync queue in batches
   */
  @Cron(CronExpression.EVERY_5_SECONDS)
  async processQueue(): Promise<void> {
    if (this.processingQueue || this.syncQueue.size === 0) {
      return;
    }

    this.processingQueue = true;
    const startTime = Date.now();

    try {
      // Process items by priority
      for (let priority = 1; priority <= 5; priority++) {
        const priorityQueue = this.priorityQueues.get(priority) || [];
        
        if (priorityQueue.length === 0) {
          continue;
        }

        // Process batch for this priority level
        const batch = priorityQueue.splice(0, this.batchConfig.batchSize);
        
        if (batch.length > 0) {
          await this.processBatch(batch);
          this.syncMetrics.batchesProcessed++;
        }

        // Don't process lower priorities if we have high-priority items
        if (priority <= 2 && this.hasHighPriorityItems()) {
          break;
        }
      }

      // Update metrics
      const processingTime = Date.now() - startTime;
      this.updateProcessingMetrics(processingTime);

    } catch (error) {
      this.logger.error(`Queue processing failed: ${error.message}`);
    } finally {
      this.processingQueue = false;
    }
  }

  private async processBatch(batch: SyncQueueItem[]): Promise<void> {
    this.logger.debug(`Processing batch of ${batch.length} items`);

    // Group items by table and operation for optimization
    const groupedItems = this.groupBatchItems(batch);

    for (const [key, items] of groupedItems.entries()) {
      const [tableName, operation] = key.split(':');
      
      try {
        await this.processBatchGroup(tableName, operation as any, items);
        
        // Mark items as completed
        items.forEach(item => {
          item.processingCompleted = new Date();
          this.syncQueue.delete(item.id);
          this.syncMetrics.totalProcessed++;
        });

      } catch (error) {
        this.logger.error(`Batch group processing failed for ${key}: ${error.message}`);
        
        // Handle failed items
        await this.handleFailedItems(items, error.message);
      }
    }

    this.syncMetrics.queueSize = this.syncQueue.size;
    this.syncMetrics.lastSyncTime = new Date();
  }

  private groupBatchItems(batch: SyncQueueItem[]): Map<string, SyncQueueItem[]> {
    const grouped = new Map<string, SyncQueueItem[]>();

    batch.forEach(item => {
      const key = `${item.tableName}:${item.operation}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      
      grouped.get(key)!.push(item);
      item.processingStarted = new Date();
    });

    return grouped;
  }

  private async processBatchGroup(
    tableName: string,
    operation: string,
    items: SyncQueueItem[]
  ): Promise<void> {
    const timescaleClient = this.dualPrisma.timescale;
    
    if (!timescaleClient) {
      throw new Error('TimescaleDB client not available');
    }

    switch (operation) {
      case 'INSERT':
        await this.processBatchInserts(timescaleClient, tableName, items);
        break;
      case 'UPDATE':
        await this.processBatchUpdates(timescaleClient, tableName, items);
        break;
      case 'DELETE':
        await this.processBatchDeletes(timescaleClient, tableName, items);
        break;
      case 'BATCH_INSERT':
        await this.processBatchBulkInserts(timescaleClient, tableName, items);
        break;
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }

  private async processBatchInserts(client: any, tableName: string, items: SyncQueueItem[]): Promise<void> {
    if (items.length === 0) return;

    // Use bulk insert for better performance
    const records = items.map(item => item.data);
    await this.bulkInsert(client, tableName, records);
  }

  private async processBatchUpdates(client: any, tableName: string, items: SyncQueueItem[]): Promise<void> {
    // Process updates individually as they typically have different WHERE clauses
    for (const item of items) {
      const { id, ...updateData } = item.data;
      const columns = Object.keys(updateData);
      const values = Object.values(updateData);
      
      const setClause = columns.map((col, i) => `${col} = $${i + 2}`).join(', ');
      
      const query = `
        UPDATE monitoring.${tableName}
        SET ${setClause}
        WHERE id = $1
      `;

      await client.query(query, [id, ...values]);
    }
  }

  private async processBatchDeletes(client: any, tableName: string, items: SyncQueueItem[]): Promise<void> {
    if (items.length === 0) return;

    // Use IN clause for bulk deletes
    const ids = items.map(item => item.data.id);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    
    const query = `
      DELETE FROM monitoring.${tableName}
      WHERE id IN (${placeholders})
    `;

    await client.query(query, ids);
  }

  private async processBatchBulkInserts(client: any, tableName: string, items: SyncQueueItem[]): Promise<void> {
    // Each item contains an array of records to insert
    const allRecords = items.flatMap(item => item.data);
    await this.bulkInsert(client, tableName, allRecords);
  }

  private async bulkInsert(client: any, tableName: string, records: any[]): Promise<void> {
    if (records.length === 0) return;

    const columns = Object.keys(records[0]);
    const values = records.flatMap(record => columns.map(col => record[col]));
    
    const placeholders = records.map((_, recordIndex) => {
      const start = recordIndex * columns.length + 1;
      const recordPlaceholders = columns.map((_, colIndex) => `$${start + colIndex}`);
      return `(${recordPlaceholders.join(', ')})`;
    }).join(', ');

    const query = `
      INSERT INTO monitoring.${tableName} (${columns.join(', ')})
      VALUES ${placeholders}
      ON CONFLICT DO NOTHING
    `;

    await client.query(query, values);
  }

  private async handleFailedItems(items: SyncQueueItem[], error: string): Promise<void> {
    for (const item of items) {
      item.retryCount++;
      item.lastError = error;

      if (item.retryCount >= item.maxRetries) {
        // Max retries reached, remove from queue and log
        this.syncQueue.delete(item.id);
        this.syncMetrics.totalFailed++;
        
        this.logger.error(`Item ${item.id} failed permanently: ${error}`);
        
        // Optionally send to dead letter queue or alert system
        await this.handlePermanentFailure(item);
      } else {
        // Schedule retry with exponential backoff
        const delay = Math.min(
          this.batchConfig.retryDelayBase * Math.pow(this.batchConfig.retryDelayMultiplier, item.retryCount - 1),
          this.batchConfig.maxRetryDelay
        );

        setTimeout(() => {
          // Re-add to priority queue for retry
          this.priorityQueues.get(item.priority)?.push(item);
        }, delay);

        this.logger.warn(`Item ${item.id} scheduled for retry ${item.retryCount}/${item.maxRetries} in ${delay}ms`);
      }
    }
  }

  private async handlePermanentFailure(item: SyncQueueItem): Promise<void> {
    // Log to database for audit purposes
    try {
      const postgresClient = this.dualPrisma.postgres;
      
      await postgresClient.$executeRawUnsafe(`
        INSERT INTO public.datasource_usage_log (
          operation, datasource, table_name, record_count, error_message
        ) VALUES ($1, $2, $3, $4, $5)
      `, `SYNC_FAILED_${item.operation}`, 'timescale', item.tableName, 1, item.lastError);
      
    } catch (error) {
      this.logger.error(`Failed to log permanent failure: ${error.message}`);
    }

    // Could also send to external monitoring/alerting system
    this.logger.error(`Permanent sync failure for ${item.operation} on ${item.tableName}:`, {
      itemId: item.id,
      data: item.data,
      error: item.lastError,
      retryCount: item.retryCount,
    });
  }

  private dropOldestLowPriorityItems(): void {
    // Remove oldest items from priority 4 and 5 queues
    let removedCount = 0;
    const targetRemoval = Math.floor(this.batchConfig.maxQueueSize * 0.1); // Remove 10%

    for (let priority = 5; priority >= 4 && removedCount < targetRemoval; priority--) {
      const queue = this.priorityQueues.get(priority) || [];
      
      // Sort by timestamp and remove oldest
      queue.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      const toRemove = Math.min(queue.length, targetRemoval - removedCount);
      const removed = queue.splice(0, toRemove);
      
      removed.forEach(item => {
        this.syncQueue.delete(item.id);
        removedCount++;
      });
    }

    if (removedCount > 0) {
      this.logger.warn(`Dropped ${removedCount} low-priority items due to queue overflow`);
    }
  }

  private hasHighPriorityItems(): boolean {
    return (this.priorityQueues.get(1)?.length || 0) > 0 || 
           (this.priorityQueues.get(2)?.length || 0) > 0;
  }

  private updateProcessingMetrics(processingTime: number): void {
    const currentAvg = this.syncMetrics.averageProcessingTime;
    const batchCount = this.syncMetrics.batchesProcessed;
    
    this.syncMetrics.averageProcessingTime = 
      ((currentAvg * (batchCount - 1)) + processingTime) / batchCount;

    // Calculate sync rate (items per second over last minute)
    const oneMinuteAgo = Date.now() - 60000;
    const recentItems = Array.from(this.syncQueue.values())
      .filter(item => item.processingCompleted && item.processingCompleted.getTime() > oneMinuteAgo);
    
    this.syncMetrics.syncRate = recentItems.length / 60;
  }

  /**
   * Gets current sync metrics
   */
  getSyncMetrics(): SyncMetrics {
    return { ...this.syncMetrics };
  }

  /**
   * Gets queue status by priority
   */
  getQueueStatus(): { priority: number; count: number }[] {
    return Array.from(this.priorityQueues.entries()).map(([priority, items]) => ({
      priority,
      count: items.length,
    }));
  }

  /**
   * Gets items in queue
   */
  getQueueItems(priority?: number): SyncQueueItem[] {
    if (priority !== undefined) {
      return [...(this.priorityQueues.get(priority) || [])];
    }
    
    return Array.from(this.syncQueue.values());
  }

  /**
   * Removes an item from the queue
   */
  removeQueueItem(itemId: string): boolean {
    const item = this.syncQueue.get(itemId);
    if (!item) {
      return false;
    }

    // Remove from sync queue
    this.syncQueue.delete(itemId);

    // Remove from priority queue
    const priorityQueue = this.priorityQueues.get(item.priority);
    if (priorityQueue) {
      const index = priorityQueue.findIndex(i => i.id === itemId);
      if (index >= 0) {
        priorityQueue.splice(index, 1);
      }
    }

    this.syncMetrics.queueSize = this.syncQueue.size;
    return true;
  }

  /**
   * Clears all queued items
   */
  clearQueue(): number {
    const count = this.syncQueue.size;
    
    this.syncQueue.clear();
    this.priorityQueues.forEach(queue => queue.length = 0);
    
    this.syncMetrics.queueSize = 0;
    
    this.logger.log(`Cleared ${count} items from sync queue`);
    return count;
  }

  /**
   * Updates batch configuration
   */
  updateBatchConfig(config: Partial<BatchSyncConfig>): void {
    this.batchConfig = { ...this.batchConfig, ...config };
    this.logger.log('Batch sync configuration updated', this.batchConfig);
  }

  /**
   * Gets current batch configuration
   */
  getBatchConfig(): BatchSyncConfig {
    return { ...this.batchConfig };
  }

  /**
   * Forces immediate queue processing
   */
  async forceProcessQueue(): Promise<void> {
    if (this.processingQueue) {
      throw new Error('Queue processing is already in progress');
    }

    await this.processQueue();
  }

  /**
   * Gets queue health status
   */
  getQueueHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    queueUtilization: number;
    averageWaitTime: number;
    failureRate: number;
    issues: string[];
  } {
    const issues: string[] = [];
    const queueUtilization = this.syncQueue.size / this.batchConfig.maxQueueSize;
    
    // Calculate average wait time
    const now = Date.now();
    const waitTimes = Array.from(this.syncQueue.values())
      .filter(item => !item.processingStarted)
      .map(item => now - item.timestamp.getTime());
    
    const averageWaitTime = waitTimes.length > 0 
      ? waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length
      : 0;

    // Calculate failure rate
    const totalOperations = this.syncMetrics.totalProcessed + this.syncMetrics.totalFailed;
    const failureRate = totalOperations > 0 ? this.syncMetrics.totalFailed / totalOperations : 0;

    // Determine status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (queueUtilization > 0.9) {
      status = 'unhealthy';
      issues.push('Queue utilization critical (>90%)');
    } else if (queueUtilization > 0.7) {
      status = 'degraded';
      issues.push('Queue utilization high (>70%)');
    }

    if (averageWaitTime > 30000) { // 30 seconds
      status = status === 'healthy' ? 'degraded' : 'unhealthy';
      issues.push('High average wait time (>30s)');
    }

    if (failureRate > 0.1) { // 10%
      status = 'unhealthy';
      issues.push('High failure rate (>10%)');
    } else if (failureRate > 0.05) { // 5%
      status = status === 'healthy' ? 'degraded' : status;
      issues.push('Elevated failure rate (>5%)');
    }

    return {
      status,
      queueUtilization,
      averageWaitTime,
      failureRate,
      issues,
    };
  }

  /**
   * Resets sync metrics
   */
  resetMetrics(): void {
    this.syncMetrics = {
      totalQueued: 0,
      totalProcessed: 0,
      totalFailed: 0,
      averageProcessingTime: 0,
      queueSize: this.syncQueue.size,
      batchesProcessed: 0,
      syncRate: 0,
    };
    
    this.logger.log('Sync metrics reset');
  }
}