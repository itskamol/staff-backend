import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DualPrismaService } from './dual-prisma.service';
import { QueryRoutingService } from './query-routing.service';

export interface FallbackState {
  isActive: boolean;
  activatedAt?: Date;
  reason: string;
  consecutiveFailures: number;
  lastFailureAt?: Date;
  recoveryAttempts: number;
  lastRecoveryAttempt?: Date;
}

export interface RecoveryConfig {
  healthCheckInterval: number; // seconds
  maxConsecutiveFailures: number;
  recoveryCheckInterval: number; // seconds
  maxRecoveryAttempts: number;
  backoffMultiplier: number;
  maxBackoffDelay: number; // seconds
}

export interface BufferedOperation {
  id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  tableName: string;
  data: any;
  timestamp: Date;
  retryCount: number;
  lastRetryAt?: Date;
  error?: string;
}

export interface SyncProgress {
  totalOperations: number;
  processedOperations: number;
  failedOperations: number;
  startTime: Date;
  estimatedCompletion?: Date;
  currentBatch: number;
  totalBatches: number;
}

@Injectable()
export class FallbackRecoveryService {
  private readonly logger = new Logger(FallbackRecoveryService.name);
  
  private fallbackState: FallbackState = {
    isActive: false,
    reason: '',
    consecutiveFailures: 0,
    recoveryAttempts: 0,
  };

  private recoveryConfig: RecoveryConfig;
  private bufferedOperations: Map<string, BufferedOperation> = new Map();
  private syncInProgress = false;
  private syncProgress: SyncProgress | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly dualPrisma: DualPrismaService,
    private readonly queryRouting: QueryRoutingService,
  ) {
    this.recoveryConfig = {
      healthCheckInterval: parseInt(this.config.get('FALLBACK_HEALTH_CHECK_INTERVAL', '60')),
      maxConsecutiveFailures: parseInt(this.config.get('FALLBACK_MAX_CONSECUTIVE_FAILURES', '3')),
      recoveryCheckInterval: parseInt(this.config.get('FALLBACK_RECOVERY_CHECK_INTERVAL', '60')),
      maxRecoveryAttempts: parseInt(this.config.get('FALLBACK_MAX_RECOVERY_ATTEMPTS', '10')),
      backoffMultiplier: parseFloat(this.config.get('FALLBACK_BACKOFF_MULTIPLIER', '2.0')),
      maxBackoffDelay: parseInt(this.config.get('FALLBACK_MAX_BACKOFF_DELAY', '300')),
    };
  }

  /**
   * Monitors TimescaleDB health and triggers fallback if needed
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async monitorTimescaleHealth(): Promise<void> {
    try {
      const connectionHealth = this.dualPrisma.getConnectionHealth();
      
      if (connectionHealth.timescale.connected) {
        // TimescaleDB is healthy
        await this.handleHealthyState();
      } else {
        // TimescaleDB is unhealthy
        await this.handleUnhealthyState(connectionHealth.timescale.error || 'Connection failed');
      }
    } catch (error) {
      this.logger.error(`Health monitoring failed: ${error.message}`);
      await this.handleUnhealthyState(error.message);
    }
  }

  private async handleHealthyState(): Promise<void> {
    if (this.fallbackState.consecutiveFailures > 0) {
      this.logger.log('TimescaleDB health restored, resetting failure count');
      this.fallbackState.consecutiveFailures = 0;
      this.fallbackState.lastFailureAt = undefined;
    }

    // If fallback is active and TimescaleDB is healthy, attempt recovery
    if (this.fallbackState.isActive) {
      await this.attemptRecovery();
    }
  }

  private async handleUnhealthyState(error: string): Promise<void> {
    this.fallbackState.consecutiveFailures++;
    this.fallbackState.lastFailureAt = new Date();

    this.logger.warn(
      `TimescaleDB failure detected (${this.fallbackState.consecutiveFailures}/${this.recoveryConfig.maxConsecutiveFailures}): ${error}`
    );

    // Activate fallback if threshold reached
    if (this.fallbackState.consecutiveFailures >= this.recoveryConfig.maxConsecutiveFailures && 
        !this.fallbackState.isActive) {
      await this.activateFallback(error);
    }
  }

  private async activateFallback(reason: string): Promise<void> {
    try {
      this.logger.warn(`Activating PostgreSQL fallback: ${reason}`);

      this.fallbackState.isActive = true;
      this.fallbackState.activatedAt = new Date();
      this.fallbackState.reason = reason;
      this.fallbackState.recoveryAttempts = 0;

      // Update routing configuration to force PostgreSQL usage
      this.queryRouting.updateRoutingConfig({
        useTimescale: false,
        fallbackToPostgres: true,
      });

      // Ensure fallback partitions exist
      await this.ensureFallbackPartitions();

      // Log fallback activation
      await this.logFallbackEvent('ACTIVATED', reason);

      this.logger.warn('PostgreSQL fallback activated successfully');
    } catch (error) {
      this.logger.error(`Failed to activate fallback: ${error.message}`);
      throw error;
    }
  }

  private async attemptRecovery(): Promise<void> {
    if (this.syncInProgress) {
      this.logger.debug('Recovery sync already in progress, skipping attempt');
      return;
    }

    // Check if we've exceeded max recovery attempts
    if (this.fallbackState.recoveryAttempts >= this.recoveryConfig.maxRecoveryAttempts) {
      this.logger.warn('Max recovery attempts reached, manual intervention required');
      return;
    }

    // Calculate backoff delay
    const backoffDelay = Math.min(
      Math.pow(this.recoveryConfig.backoffMultiplier, this.fallbackState.recoveryAttempts) * 1000,
      this.recoveryConfig.maxBackoffDelay * 1000
    );

    const timeSinceLastAttempt = this.fallbackState.lastRecoveryAttempt 
      ? Date.now() - this.fallbackState.lastRecoveryAttempt.getTime()
      : backoffDelay;

    if (timeSinceLastAttempt < backoffDelay) {
      this.logger.debug(`Recovery backoff active, ${Math.ceil((backoffDelay - timeSinceLastAttempt) / 1000)}s remaining`);
      return;
    }

    try {
      this.fallbackState.recoveryAttempts++;
      this.fallbackState.lastRecoveryAttempt = new Date();

      this.logger.log(`Attempting TimescaleDB recovery (attempt ${this.fallbackState.recoveryAttempts})`);

      // Test TimescaleDB connection
      const timescaleClient = this.dualPrisma.timescale;
      if (!timescaleClient) {
        throw new Error('TimescaleDB client not available');
      }

      await timescaleClient.query('SELECT 1');
      
      // Connection successful, start recovery process
      await this.performRecovery();

    } catch (error) {
      this.logger.error(`Recovery attempt ${this.fallbackState.recoveryAttempts} failed: ${error.message}`);
      
      if (this.fallbackState.recoveryAttempts >= this.recoveryConfig.maxRecoveryAttempts) {
        await this.logFallbackEvent('RECOVERY_FAILED', `Max attempts reached: ${error.message}`);
      }
    }
  }

  private async performRecovery(): Promise<void> {
    try {
      this.syncInProgress = true;
      this.logger.log('Starting TimescaleDB recovery process');

      // Step 1: Sync buffered operations
      await this.syncBufferedOperations();

      // Step 2: Sync fallback data to TimescaleDB
      await this.syncFallbackData();

      // Step 3: Verify data integrity
      await this.verifyDataIntegrity();

      // Step 4: Gradually switch traffic back to TimescaleDB
      await this.gradualTrafficSwitch();

      // Step 5: Deactivate fallback
      await this.deactivateFallback();

      this.logger.log('TimescaleDB recovery completed successfully');

    } catch (error) {
      this.logger.error(`Recovery process failed: ${error.message}`);
      await this.logFallbackEvent('RECOVERY_ERROR', error.message);
      throw error;
    } finally {
      this.syncInProgress = false;
      this.syncProgress = null;
    }
  }

  private async syncBufferedOperations(): Promise<void> {
    if (this.bufferedOperations.size === 0) {
      this.logger.log('No buffered operations to sync');
      return;
    }

    this.logger.log(`Syncing ${this.bufferedOperations.size} buffered operations`);

    const operations = Array.from(this.bufferedOperations.values());
    const batchSize = 100;
    let processed = 0;
    let failed = 0;

    this.syncProgress = {
      totalOperations: operations.length,
      processedOperations: 0,
      failedOperations: 0,
      startTime: new Date(),
      currentBatch: 0,
      totalBatches: Math.ceil(operations.length / batchSize),
    };

    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      this.syncProgress.currentBatch = Math.floor(i / batchSize) + 1;

      try {
        await this.processBatch(batch);
        processed += batch.length;
      } catch (error) {
        this.logger.error(`Batch sync failed: ${error.message}`);
        failed += batch.length;
      }

      this.syncProgress.processedOperations = processed;
      this.syncProgress.failedOperations = failed;

      // Update ETA
      const elapsed = Date.now() - this.syncProgress.startTime.getTime();
      const rate = processed / (elapsed / 1000);
      const remaining = operations.length - processed;
      
      if (rate > 0) {
        this.syncProgress.estimatedCompletion = new Date(Date.now() + (remaining / rate) * 1000);
      }
    }

    // Clear successfully processed operations
    for (const op of operations) {
      if (op.error === undefined) {
        this.bufferedOperations.delete(op.id);
      }
    }

    this.logger.log(`Buffered operations sync completed: ${processed} processed, ${failed} failed`);
  }

  private async processBatch(operations: BufferedOperation[]): Promise<void> {
    const timescaleClient = this.dualPrisma.timescale;
    if (!timescaleClient) {
      throw new Error('TimescaleDB client not available');
    }

    for (const operation of operations) {
      try {
        switch (operation.operation) {
          case 'INSERT':
            await this.executeInsert(timescaleClient, operation);
            break;
          case 'UPDATE':
            await this.executeUpdate(timescaleClient, operation);
            break;
          case 'DELETE':
            await this.executeDelete(timescaleClient, operation);
            break;
        }

        operation.error = undefined; // Mark as successful
      } catch (error) {
        operation.error = error.message;
        operation.retryCount++;
        operation.lastRetryAt = new Date();
        
        this.logger.error(`Failed to sync operation ${operation.id}: ${error.message}`);
      }
    }
  }

  private async executeInsert(client: any, operation: BufferedOperation): Promise<void> {
    const columns = Object.keys(operation.data);
    const values = Object.values(operation.data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const query = `
      INSERT INTO monitoring.${operation.tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT DO NOTHING
    `;

    await client.query(query, values);
  }

  private async executeUpdate(client: any, operation: BufferedOperation): Promise<void> {
    const { id, ...updateData } = operation.data;
    const columns = Object.keys(updateData);
    const values = Object.values(updateData);
    
    const setClause = columns.map((col, i) => `${col} = $${i + 2}`).join(', ');
    
    const query = `
      UPDATE monitoring.${operation.tableName}
      SET ${setClause}
      WHERE id = $1
    `;

    await client.query(query, [id, ...values]);
  }

  private async executeDelete(client: any, operation: BufferedOperation): Promise<void> {
    const query = `
      DELETE FROM monitoring.${operation.tableName}
      WHERE id = $1
    `;

    await client.query(query, [operation.data.id]);
  }

  private async syncFallbackData(): Promise<void> {
    this.logger.log('Syncing fallback data to TimescaleDB');

    const fallbackTables = [
      'active_windows_fallback',
      'visited_sites_fallback',
      'screenshots_fallback',
      'user_sessions_fallback',
    ];

    for (const tableName of fallbackTables) {
      await this.syncFallbackTable(tableName);
    }
  }

  private async syncFallbackTable(fallbackTableName: string): Promise<void> {
    const timescaleTableName = fallbackTableName.replace('_fallback', '');
    
    this.logger.log(`Syncing ${fallbackTableName} to monitoring.${timescaleTableName}`);

    const postgresClient = this.dualPrisma.postgres;
    const timescaleClient = this.dualPrisma.timescale;

    if (!timescaleClient) {
      throw new Error('TimescaleDB client not available');
    }

    // Get count of records to sync
    const countResult = await postgresClient.$queryRawUnsafe(`
      SELECT COUNT(*) as count FROM fallback.${fallbackTableName}
      WHERE created_at > COALESCE(
        (SELECT MAX(created_at) FROM monitoring.${timescaleTableName}),
        '1970-01-01'::timestamptz
      )
    `);

    const totalRecords = parseInt((countResult as any)[0].count);
    
    if (totalRecords === 0) {
      this.logger.log(`No new records to sync for ${fallbackTableName}`);
      return;
    }

    this.logger.log(`Syncing ${totalRecords} records from ${fallbackTableName}`);

    const batchSize = 1000;
    let offset = 0;

    while (offset < totalRecords) {
      const records = await postgresClient.$queryRawUnsafe(`
        SELECT * FROM fallback.${fallbackTableName}
        WHERE created_at > COALESCE(
          (SELECT MAX(created_at) FROM monitoring.${timescaleTableName}),
          '1970-01-01'::timestamptz
        )
        ORDER BY created_at
        LIMIT ${batchSize} OFFSET ${offset}
      `);

      if ((records as any[]).length === 0) {
        break;
      }

      // Insert batch into TimescaleDB
      await this.insertBatchToTimescale(timescaleClient, timescaleTableName, records as any[]);

      offset += batchSize;
      this.logger.debug(`Synced ${Math.min(offset, totalRecords)}/${totalRecords} records for ${fallbackTableName}`);
    }

    this.logger.log(`Completed syncing ${fallbackTableName}`);
  }

  private async insertBatchToTimescale(client: any, tableName: string, records: any[]): Promise<void> {
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

  private async verifyDataIntegrity(): Promise<void> {
    this.logger.log('Verifying data integrity between TimescaleDB and fallback');

    const tables = [
      { timescale: 'active_windows', fallback: 'active_windows_fallback' },
      { timescale: 'visited_sites', fallback: 'visited_sites_fallback' },
      { timescale: 'screenshots', fallback: 'screenshots_fallback' },
      { timescale: 'user_sessions', fallback: 'user_sessions_fallback' },
    ];

    for (const table of tables) {
      await this.verifyTableIntegrity(table.timescale, table.fallback);
    }
  }

  private async verifyTableIntegrity(timescaleTable: string, fallbackTable: string): Promise<void> {
    const postgresClient = this.dualPrisma.postgres;
    const timescaleClient = this.dualPrisma.timescale;

    if (!timescaleClient) {
      throw new Error('TimescaleDB client not available');
    }

    // Compare record counts for recent data
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours

    const timescaleCount = await timescaleClient.query(`
      SELECT COUNT(*) as count FROM monitoring.${timescaleTable}
      WHERE created_at >= $1
    `, [cutoffDate]);

    const fallbackCount = await postgresClient.$queryRawUnsafe(`
      SELECT COUNT(*) as count FROM fallback.${fallbackTable}
      WHERE created_at >= $1
    `, cutoffDate);

    const tsCount = parseInt(timescaleCount.rows[0].count);
    const fbCount = parseInt((fallbackCount as any)[0].count);

    this.logger.log(`Integrity check for ${timescaleTable}: TimescaleDB=${tsCount}, Fallback=${fbCount}`);

    if (Math.abs(tsCount - fbCount) > fbCount * 0.05) { // Allow 5% variance
      this.logger.warn(`Data integrity warning: significant difference in ${timescaleTable} counts`);
    }
  }

  private async gradualTrafficSwitch(): Promise<void> {
    this.logger.log('Starting gradual traffic switch to TimescaleDB');

    // Enable TimescaleDB with fallback still available
    this.queryRouting.updateRoutingConfig({
      useTimescale: true,
      fallbackToPostgres: true,
    });

    // Wait for a few minutes to monitor
    await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000)); // 2 minutes

    // Check if TimescaleDB is handling traffic well
    const connectionHealth = this.dualPrisma.getConnectionHealth();
    if (!connectionHealth.timescale.connected) {
      throw new Error('TimescaleDB became unhealthy during traffic switch');
    }

    this.logger.log('Gradual traffic switch completed successfully');
  }

  private async deactivateFallback(): Promise<void> {
    this.logger.log('Deactivating PostgreSQL fallback');

    this.fallbackState.isActive = false;
    this.fallbackState.activatedAt = undefined;
    this.fallbackState.reason = '';
    this.fallbackState.consecutiveFailures = 0;
    this.fallbackState.recoveryAttempts = 0;
    this.fallbackState.lastRecoveryAttempt = undefined;

    // Log fallback deactivation
    await this.logFallbackEvent('DEACTIVATED', 'Recovery completed successfully');

    this.logger.log('PostgreSQL fallback deactivated successfully');
  }

  private async ensureFallbackPartitions(): Promise<void> {
    try {
      const postgresClient = this.dualPrisma.postgres;
      
      // Ensure future partitions exist
      await postgresClient.$executeRawUnsafe('SELECT fallback.ensure_future_partitions()');
      
      this.logger.log('Fallback partitions ensured');
    } catch (error) {
      this.logger.error(`Failed to ensure fallback partitions: ${error.message}`);
      throw error;
    }
  }

  private async logFallbackEvent(event: string, details: string): Promise<void> {
    try {
      const postgresClient = this.dualPrisma.postgres;
      
      await postgresClient.$executeRawUnsafe(`
        INSERT INTO public.datasource_usage_log (
          operation, datasource, table_name, record_count, error_message
        ) VALUES ($1, $2, $3, $4, $5)
      `, `FALLBACK_${event}`, 'postgres_fallback', 'system', 1, details);
      
    } catch (error) {
      this.logger.error(`Failed to log fallback event: ${error.message}`);
    }
  }

  /**
   * Buffers an operation for later sync to TimescaleDB
   */
  bufferOperation(operation: Omit<BufferedOperation, 'id' | 'timestamp' | 'retryCount'>): void {
    const bufferedOp: BufferedOperation = {
      ...operation,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      retryCount: 0,
    };

    this.bufferedOperations.set(bufferedOp.id, bufferedOp);

    // Limit buffer size
    const maxBufferSize = parseInt(this.config.get('FALLBACK_MAX_BUFFER_SIZE', '10000'));
    if (this.bufferedOperations.size > maxBufferSize) {
      // Remove oldest operations
      const operations = Array.from(this.bufferedOperations.entries())
        .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime());
      
      const toRemove = operations.slice(0, operations.length - maxBufferSize);
      toRemove.forEach(([id]) => this.bufferedOperations.delete(id));
      
      this.logger.warn(`Buffer size exceeded, removed ${toRemove.length} oldest operations`);
    }
  }

  /**
   * Gets current fallback state
   */
  getFallbackState(): FallbackState {
    return { ...this.fallbackState };
  }

  /**
   * Gets recovery configuration
   */
  getRecoveryConfig(): RecoveryConfig {
    return { ...this.recoveryConfig };
  }

  /**
   * Gets current sync progress
   */
  getSyncProgress(): SyncProgress | null {
    return this.syncProgress ? { ...this.syncProgress } : null;
  }

  /**
   * Gets buffered operations count
   */
  getBufferedOperationsCount(): number {
    return this.bufferedOperations.size;
  }

  /**
   * Gets buffered operations
   */
  getBufferedOperations(): BufferedOperation[] {
    return Array.from(this.bufferedOperations.values());
  }

  /**
   * Manually triggers fallback activation
   */
  async manuallyActivateFallback(reason: string): Promise<void> {
    if (this.fallbackState.isActive) {
      throw new Error('Fallback is already active');
    }

    await this.activateFallback(`Manual activation: ${reason}`);
  }

  /**
   * Manually triggers recovery attempt
   */
  async manuallyTriggerRecovery(): Promise<void> {
    if (!this.fallbackState.isActive) {
      throw new Error('Fallback is not active');
    }

    if (this.syncInProgress) {
      throw new Error('Recovery is already in progress');
    }

    // Reset recovery attempts for manual trigger
    this.fallbackState.recoveryAttempts = 0;
    this.fallbackState.lastRecoveryAttempt = undefined;

    await this.attemptRecovery();
  }

  /**
   * Clears buffered operations
   */
  clearBufferedOperations(): number {
    const count = this.bufferedOperations.size;
    this.bufferedOperations.clear();
    this.logger.log(`Cleared ${count} buffered operations`);
    return count;
  }

  /**
   * Updates recovery configuration
   */
  updateRecoveryConfig(config: Partial<RecoveryConfig>): void {
    this.recoveryConfig = { ...this.recoveryConfig, ...config };
    this.logger.log('Recovery configuration updated', this.recoveryConfig);
  }

  /**
   * Gets fallback statistics
   */
  getFallbackStatistics(): {
    isActive: boolean;
    activeDuration?: number; // milliseconds
    totalActivations: number;
    totalRecoveries: number;
    bufferedOperations: number;
    lastActivation?: Date;
    lastRecovery?: Date;
  } {
    // This would typically come from a persistent store
    // For now, return current state information
    return {
      isActive: this.fallbackState.isActive,
      activeDuration: this.fallbackState.activatedAt 
        ? Date.now() - this.fallbackState.activatedAt.getTime()
        : undefined,
      totalActivations: 0, // Would be tracked in persistent storage
      totalRecoveries: 0,  // Would be tracked in persistent storage
      bufferedOperations: this.bufferedOperations.size,
      lastActivation: this.fallbackState.activatedAt,
      lastRecovery: undefined, // Would be tracked in persistent storage
    };
  }
}