import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DualPrismaService } from './dual-prisma.service';
import { TimescaleIntegrationService } from './timescale-integration.service';
import * as crypto from 'crypto';

export interface MigrationConfig {
  batchSize: number;
  maxConcurrentBatches: number;
  checksumValidation: boolean;
  progressReportingInterval: number; // milliseconds
  errorThreshold: number; // percentage
  retryAttempts: number;
  retryDelay: number; // milliseconds
}

export interface MigrationJob {
  id: string;
  sourceTable: string;
  targetTable: string;
  status: MigrationStatus;
  startTime: Date;
  endTime?: Date;
  totalRecords: number;
  processedRecords: number;
  migratedRecords: number;
  failedRecords: number;
  currentBatch: number;
  totalBatches: number;
  errorRate: number;
  throughput: number; // records per second
  estimatedCompletion?: Date;
  lastError?: string;
  config: MigrationConfig;
}

export enum MigrationStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  ROLLING_BACK = 'rolling_back',
  ROLLED_BACK = 'rolled_back',
}

export interface MigrationBatch {
  batchId: string;
  jobId: string;
  batchNumber: number;
  records: any[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  checksum?: string;
  error?: string;
  retryCount: number;
}

export interface IntegrityCheckResult {
  tableName: string;
  sourceCount: number;
  targetCount: number;
  countMatch: boolean;
  sourceChecksum: string;
  targetChecksum: string;
  checksumMatch: boolean;
  sampleSize: number;
  sampleMatches: number;
  sampleAccuracy: number;
  issues: string[];
  timestamp: Date;
}

export interface MigrationRollback {
  jobId: string;
  rollbackId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  recordsToDelete: number;
  recordsDeleted: number;
  sourcePreserved: boolean;
  targetCleaned: boolean;
  consistencyVerified: boolean;
  error?: string;
}

@Injectable()
export class DataMigrationService {
  private readonly logger = new Logger(DataMigrationService.name);
  
  private activeMigrations = new Map<string, MigrationJob>();
  private migrationBatches = new Map<string, MigrationBatch[]>();
  private rollbackJobs = new Map<string, MigrationRollback>();
  
  private defaultConfig: MigrationConfig = {
    batchSize: 1000,
    maxConcurrentBatches: 3,
    checksumValidation: true,
    progressReportingInterval: 5000,
    errorThreshold: 5, // 5%
    retryAttempts: 3,
    retryDelay: 1000,
  };

  constructor(
    private readonly config: ConfigService,
    private readonly dualPrisma: DualPrismaService,
    private readonly timescaleIntegration: TimescaleIntegrationService,
  ) {
    // Override defaults with config values
    this.defaultConfig = {
      ...this.defaultConfig,
      batchSize: parseInt(this.config.get('MIGRATION_BATCH_SIZE', '1000')),
      maxConcurrentBatches: parseInt(this.config.get('MIGRATION_MAX_CONCURRENT_BATCHES', '3')),
      checksumValidation: this.config.get('MIGRATION_CHECKSUM_VALIDATION', 'true') === 'true',
      progressReportingInterval: parseInt(this.config.get('MIGRATION_PROGRESS_INTERVAL', '5000')),
      errorThreshold: parseFloat(this.config.get('MIGRATION_ERROR_THRESHOLD', '5')),
      retryAttempts: parseInt(this.config.get('MIGRATION_RETRY_ATTEMPTS', '3')),
      retryDelay: parseInt(this.config.get('MIGRATION_RETRY_DELAY', '1000')),
    };
  }

  /**
   * Starts a data migration job
   */
  async startMigration(
    sourceTable: string,
    targetTable: string,
    customConfig?: Partial<MigrationConfig>
  ): Promise<string> {
    const jobId = `migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const migrationConfig = { ...this.defaultConfig, ...customConfig };

    try {
      // Get total record count
      const totalRecords = await this.getSourceRecordCount(sourceTable);
      
      if (totalRecords === 0) {
        throw new Error(`Source table ${sourceTable} is empty`);
      }

      // Create migration job
      const job: MigrationJob = {
        id: jobId,
        sourceTable,
        targetTable,
        status: MigrationStatus.PENDING,
        startTime: new Date(),
        totalRecords,
        processedRecords: 0,
        migratedRecords: 0,
        failedRecords: 0,
        currentBatch: 0,
        totalBatches: Math.ceil(totalRecords / migrationConfig.batchSize),
        errorRate: 0,
        throughput: 0,
        config: migrationConfig,
      };

      this.activeMigrations.set(jobId, job);
      this.migrationBatches.set(jobId, []);

      this.logger.log(`Migration job created: ${jobId} (${totalRecords} records)`);

      // Start migration asynchronously
      setImmediate(() => this.executeMigration(jobId));

      return jobId;

    } catch (error) {
      this.logger.error(`Failed to start migration: ${error.message}`);
      throw error;
    }
  }

  private async executeMigration(jobId: string): Promise<void> {
    const job = this.activeMigrations.get(jobId);
    if (!job) {
      throw new Error(`Migration job not found: ${jobId}`);
    }

    try {
      job.status = MigrationStatus.RUNNING;
      this.logger.log(`Starting migration execution: ${jobId}`);

      // Create batches
      await this.createMigrationBatches(job);

      // Process batches with concurrency control
      await this.processBatchesConcurrently(job);

      // Verify migration integrity
      if (job.config.checksumValidation) {
        await this.verifyMigrationIntegrity(job);
      }

      // Complete migration
      job.status = MigrationStatus.COMPLETED;
      job.endTime = new Date();

      this.logger.log(`Migration completed: ${jobId} (${job.migratedRecords}/${job.totalRecords} records)`);

    } catch (error) {
      job.status = MigrationStatus.FAILED;
      job.lastError = error.message;
      job.endTime = new Date();

      this.logger.error(`Migration failed: ${jobId} - ${error.message}`);
    }
  }

  private async createMigrationBatches(job: MigrationJob): Promise<void> {
    const batches: MigrationBatch[] = [];
    const batchSize = job.config.batchSize;

    for (let i = 0; i < job.totalBatches; i++) {
      const offset = i * batchSize;
      const batchId = `${job.id}_batch_${i + 1}`;

      const batch: MigrationBatch = {
        batchId,
        jobId: job.id,
        batchNumber: i + 1,
        records: [],
        status: 'pending',
        retryCount: 0,
      };

      batches.push(batch);
    }

    this.migrationBatches.set(job.id, batches);
    this.logger.log(`Created ${batches.length} migration batches for job ${job.id}`);
  }

  private async processBatchesConcurrently(job: MigrationJob): Promise<void> {
    const batches = this.migrationBatches.get(job.id) || [];
    const maxConcurrent = job.config.maxConcurrentBatches;
    
    let activeBatches = 0;
    let batchIndex = 0;
    const progressReportInterval = setInterval(() => {
      this.updateJobProgress(job);
    }, job.config.progressReportingInterval);

    try {
      while (batchIndex < batches.length || activeBatches > 0) {
        // Start new batches up to the concurrency limit
        while (activeBatches < maxConcurrent && batchIndex < batches.length) {
          const batch = batches[batchIndex];
          activeBatches++;
          batchIndex++;

          this.processBatch(job, batch)
            .then(() => {
              activeBatches--;
            })
            .catch((error) => {
              activeBatches--;
              this.logger.error(`Batch processing failed: ${batch.batchId} - ${error.message}`);
            });
        }

        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check error threshold
        if (job.errorRate > job.config.errorThreshold) {
          throw new Error(`Error threshold exceeded: ${job.errorRate}% > ${job.config.errorThreshold}%`);
        }
      }
    } finally {
      clearInterval(progressReportInterval);
    }
  }

  private async processBatch(job: MigrationJob, batch: MigrationBatch): Promise<void> {
    batch.status = 'processing';
    batch.startTime = new Date();

    try {
      // Fetch batch data from source
      batch.records = await this.fetchBatchData(job.sourceTable, batch.batchNumber, job.config.batchSize);

      if (batch.records.length === 0) {
        batch.status = 'completed';
        batch.endTime = new Date();
        return;
      }

      // Calculate checksum if enabled
      if (job.config.checksumValidation) {
        batch.checksum = this.calculateBatchChecksum(batch.records);
      }

      // Migrate batch to target
      await this.migrateBatchToTarget(job.targetTable, batch.records);

      // Verify batch migration if checksum validation is enabled
      if (job.config.checksumValidation) {
        await this.verifyBatchMigration(job, batch);
      }

      batch.status = 'completed';
      batch.endTime = new Date();
      job.migratedRecords += batch.records.length;

    } catch (error) {
      batch.error = error.message;
      batch.status = 'failed';
      batch.endTime = new Date();
      job.failedRecords += batch.records.length;

      // Retry logic
      if (batch.retryCount < job.config.retryAttempts) {
        batch.retryCount++;
        this.logger.warn(`Retrying batch ${batch.batchId} (attempt ${batch.retryCount})`);
        
        await new Promise(resolve => setTimeout(resolve, job.config.retryDelay * batch.retryCount));
        return this.processBatch(job, batch);
      } else {
        this.logger.error(`Batch failed permanently: ${batch.batchId} - ${error.message}`);
      }
    }

    job.processedRecords += batch.records.length;
  }

  private async fetchBatchData(sourceTable: string, batchNumber: number, batchSize: number): Promise<any[]> {
    const offset = (batchNumber - 1) * batchSize;
    const postgresClient = this.dualPrisma.postgres;

    // Determine if source is in fallback schema or main schema
    const isMonitoringTable = ['active_windows', 'visited_sites', 'screenshots', 'user_sessions'].includes(sourceTable);
    const schemaPrefix = isMonitoringTable ? 'fallback.' : '';
    const tableName = isMonitoringTable ? `${sourceTable}_fallback` : sourceTable;

    const query = `
      SELECT * FROM ${schemaPrefix}${tableName}
      ORDER BY created_at, id
      LIMIT ${batchSize} OFFSET ${offset}
    `;

    const result = await postgresClient.$queryRawUnsafe(query);
    return result as any[];
  }

  private async migrateBatchToTarget(targetTable: string, records: any[]): Promise<void> {
    if (records.length === 0) return;

    const timescaleClient = this.dualPrisma.timescale;
    if (!timescaleClient) {
      throw new Error('TimescaleDB client not available');
    }

    const columns = Object.keys(records[0]);
    const values = records.flatMap(record => columns.map(col => record[col]));
    
    const placeholders = records.map((_, recordIndex) => {
      const start = recordIndex * columns.length + 1;
      const recordPlaceholders = columns.map((_, colIndex) => `$${start + colIndex}`);
      return `(${recordPlaceholders.join(', ')})`;
    }).join(', ');

    const query = `
      INSERT INTO monitoring.${targetTable} (${columns.join(', ')})
      VALUES ${placeholders}
      ON CONFLICT (id, datetime) DO NOTHING
    `;

    await timescaleClient.query(query, values);
  }

  private calculateBatchChecksum(records: any[]): string {
    const dataString = JSON.stringify(records.sort((a, b) => a.id?.localeCompare(b.id) || 0));
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  private async verifyBatchMigration(job: MigrationJob, batch: MigrationBatch): Promise<void> {
    if (!batch.checksum) return;

    const timescaleClient = this.dualPrisma.timescale;
    if (!timescaleClient) {
      throw new Error('TimescaleDB client not available');
    }

    // Fetch the migrated records
    const recordIds = batch.records.map(r => r.id);
    const placeholders = recordIds.map((_, i) => `$${i + 1}`).join(', ');
    
    const query = `
      SELECT * FROM monitoring.${job.targetTable}
      WHERE id IN (${placeholders})
      ORDER BY id
    `;

    const result = await timescaleClient.query(query, recordIds);
    const migratedRecords = result.rows;

    // Calculate checksum of migrated data
    const migratedChecksum = this.calculateBatchChecksum(migratedRecords);

    if (batch.checksum !== migratedChecksum) {
      throw new Error(`Batch checksum mismatch: expected ${batch.checksum}, got ${migratedChecksum}`);
    }
  }

  private async verifyMigrationIntegrity(job: MigrationJob): Promise<void> {
    this.logger.log(`Verifying migration integrity for job ${job.id}`);

    const integrityResult = await this.performIntegrityCheck(job.sourceTable, job.targetTable);
    
    if (!integrityResult.countMatch) {
      throw new Error(`Record count mismatch: source=${integrityResult.sourceCount}, target=${integrityResult.targetCount}`);
    }

    if (job.config.checksumValidation && !integrityResult.checksumMatch) {
      throw new Error(`Checksum mismatch: source=${integrityResult.sourceChecksum}, target=${integrityResult.targetChecksum}`);
    }

    if (integrityResult.sampleAccuracy < 0.99) { // 99% accuracy threshold
      throw new Error(`Sample accuracy too low: ${integrityResult.sampleAccuracy * 100}%`);
    }

    this.logger.log(`Migration integrity verified for job ${job.id}`);
  }

  private updateJobProgress(job: MigrationJob): void {
    const elapsed = Date.now() - job.startTime.getTime();
    job.throughput = job.processedRecords / (elapsed / 1000);
    job.errorRate = job.totalRecords > 0 ? (job.failedRecords / job.totalRecords) * 100 : 0;

    if (job.throughput > 0) {
      const remaining = job.totalRecords - job.processedRecords;
      job.estimatedCompletion = new Date(Date.now() + (remaining / job.throughput) * 1000);
    }

    this.logger.debug(`Migration progress ${job.id}: ${job.processedRecords}/${job.totalRecords} (${job.throughput.toFixed(1)} rec/s)`);
  }

  private async getSourceRecordCount(sourceTable: string): Promise<number> {
    const postgresClient = this.dualPrisma.postgres;
    
    const isMonitoringTable = ['active_windows', 'visited_sites', 'screenshots', 'user_sessions'].includes(sourceTable);
    const schemaPrefix = isMonitoringTable ? 'fallback.' : '';
    const tableName = isMonitoringTable ? `${sourceTable}_fallback` : sourceTable;

    const result = await postgresClient.$queryRawUnsafe(`SELECT COUNT(*) as count FROM ${schemaPrefix}${tableName}`);
    return parseInt((result as any)[0].count);
  }

  /**
   * Performs comprehensive integrity check between source and target tables
   */
  async performIntegrityCheck(sourceTable: string, targetTable: string): Promise<IntegrityCheckResult> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Starting integrity check: ${sourceTable} -> ${targetTable}`);

      // Get record counts
      const sourceCount = await this.getSourceRecordCount(sourceTable);
      const targetCount = await this.getTargetRecordCount(targetTable);
      const countMatch = sourceCount === targetCount;

      // Calculate checksums
      const sourceChecksum = await this.calculateTableChecksum(sourceTable, true);
      const targetChecksum = await this.calculateTableChecksum(targetTable, false);
      const checksumMatch = sourceChecksum === targetChecksum;

      // Perform sample verification
      const sampleSize = Math.min(1000, Math.floor(sourceCount * 0.1)); // 10% sample, max 1000
      const { matches, total } = await this.performSampleVerification(sourceTable, targetTable, sampleSize);
      const sampleAccuracy = total > 0 ? matches / total : 1;

      // Identify issues
      const issues: string[] = [];
      if (!countMatch) {
        issues.push(`Record count mismatch: source=${sourceCount}, target=${targetCount}`);
      }
      if (!checksumMatch) {
        issues.push(`Checksum mismatch: source=${sourceChecksum}, target=${targetChecksum}`);
      }
      if (sampleAccuracy < 0.99) {
        issues.push(`Low sample accuracy: ${(sampleAccuracy * 100).toFixed(2)}%`);
      }

      const result: IntegrityCheckResult = {
        tableName: targetTable,
        sourceCount,
        targetCount,
        countMatch,
        sourceChecksum,
        targetChecksum,
        checksumMatch,
        sampleSize,
        sampleMatches: matches,
        sampleAccuracy,
        issues,
        timestamp: new Date(),
      };

      const duration = Date.now() - startTime;
      this.logger.log(`Integrity check completed in ${duration}ms: ${issues.length === 0 ? 'PASSED' : 'FAILED'}`);

      return result;

    } catch (error) {
      this.logger.error(`Integrity check failed: ${error.message}`);
      throw error;
    }
  }

  private async getTargetRecordCount(targetTable: string): Promise<number> {
    const timescaleClient = this.dualPrisma.timescale;
    if (!timescaleClient) {
      throw new Error('TimescaleDB client not available');
    }

    const result = await timescaleClient.query(`SELECT COUNT(*) as count FROM monitoring.${targetTable}`);
    return parseInt(result.rows[0].count);
  }

  private async calculateTableChecksum(tableName: string, isSource: boolean): Promise<string> {
    const client = isSource ? this.dualPrisma.postgres : this.dualPrisma.timescale;
    if (!client) {
      throw new Error(`${isSource ? 'PostgreSQL' : 'TimescaleDB'} client not available`);
    }

    const isMonitoringTable = ['active_windows', 'visited_sites', 'screenshots', 'user_sessions'].includes(tableName);
    let fullTableName: string;

    if (isSource) {
      const schemaPrefix = isMonitoringTable ? 'fallback.' : '';
      const tableNameWithSuffix = isMonitoringTable ? `${tableName}_fallback` : tableName;
      fullTableName = `${schemaPrefix}${tableNameWithSuffix}`;
    } else {
      fullTableName = `monitoring.${tableName}`;
    }

    const query = `
      SELECT md5(string_agg(
        concat_ws('|', 
          COALESCE(id::text, ''),
          COALESCE(agent_id::text, ''),
          COALESCE(datetime::text, ''),
          COALESCE(organization_id::text, '')
        ), 
        '' ORDER BY id, datetime
      )) as checksum
      FROM ${fullTableName}
    `;

    if (isSource) {
      const result = await (client as any).$queryRawUnsafe(query);
      return (result as any)[0]?.checksum || '';
    } else {
      const result = await (client as any).query(query);
      return result.rows[0]?.checksum || '';
    }
  }

  private async performSampleVerification(
    sourceTable: string,
    targetTable: string,
    sampleSize: number
  ): Promise<{ matches: number; total: number }> {
    if (sampleSize === 0) {
      return { matches: 0, total: 0 };
    }

    const postgresClient = this.dualPrisma.postgres;
    const timescaleClient = this.dualPrisma.timescale;

    if (!timescaleClient) {
      throw new Error('TimescaleDB client not available');
    }

    // Get random sample from source
    const isMonitoringTable = ['active_windows', 'visited_sites', 'screenshots', 'user_sessions'].includes(sourceTable);
    const schemaPrefix = isMonitoringTable ? 'fallback.' : '';
    const sourceTableName = isMonitoringTable ? `${sourceTable}_fallback` : sourceTable;

    const sampleQuery = `
      SELECT id, datetime FROM ${schemaPrefix}${sourceTableName}
      ORDER BY RANDOM()
      LIMIT ${sampleSize}
    `;

    const sampleResult = await postgresClient.$queryRawUnsafe(sampleQuery);
    const sampleRecords = sampleResult as any[];

    let matches = 0;

    // Check each sample record in target
    for (const record of sampleRecords) {
      try {
        const targetQuery = `
          SELECT COUNT(*) as count FROM monitoring.${targetTable}
          WHERE id = $1 AND datetime = $2
        `;

        const targetResult = await timescaleClient.query(targetQuery, [record.id, record.datetime]);
        const count = parseInt(targetResult.rows[0].count);

        if (count > 0) {
          matches++;
        }
      } catch (error) {
        this.logger.warn(`Sample verification failed for record ${record.id}: ${error.message}`);
      }
    }

    return { matches, total: sampleRecords.length };
  }

  /**
   * Rolls back a migration by cleaning up target data
   */
  async rollbackMigration(jobId: string): Promise<string> {
    const job = this.activeMigrations.get(jobId);
    if (!job) {
      throw new Error(`Migration job not found: ${jobId}`);
    }

    if (job.status === MigrationStatus.RUNNING) {
      throw new Error('Cannot rollback a running migration. Pause it first.');
    }

    const rollbackId = `rollback_${jobId}_${Date.now()}`;
    
    const rollback: MigrationRollback = {
      jobId,
      rollbackId,
      status: 'pending',
      startTime: new Date(),
      recordsToDelete: job.migratedRecords,
      recordsDeleted: 0,
      sourcePreserved: true, // Source is always preserved
      targetCleaned: false,
      consistencyVerified: false,
    };

    this.rollbackJobs.set(rollbackId, rollback);

    try {
      rollback.status = 'running';
      job.status = MigrationStatus.ROLLING_BACK;

      this.logger.log(`Starting rollback: ${rollbackId}`);

      // Clean up target data
      await this.cleanupTargetData(job, rollback);

      // Verify consistency
      await this.verifyRollbackConsistency(job, rollback);

      rollback.status = 'completed';
      rollback.endTime = new Date();
      rollback.targetCleaned = true;
      rollback.consistencyVerified = true;

      job.status = MigrationStatus.ROLLED_BACK;

      this.logger.log(`Rollback completed: ${rollbackId}`);

      return rollbackId;

    } catch (error) {
      rollback.status = 'failed';
      rollback.error = error.message;
      rollback.endTime = new Date();

      this.logger.error(`Rollback failed: ${rollbackId} - ${error.message}`);
      throw error;
    }
  }

  private async cleanupTargetData(job: MigrationJob, rollback: MigrationRollback): Promise<void> {
    const timescaleClient = this.dualPrisma.timescale;
    if (!timescaleClient) {
      throw new Error('TimescaleDB client not available');
    }

    // Get all migrated record IDs from batches
    const batches = this.migrationBatches.get(job.id) || [];
    const migratedIds: string[] = [];

    for (const batch of batches) {
      if (batch.status === 'completed') {
        migratedIds.push(...batch.records.map(r => r.id));
      }
    }

    if (migratedIds.length === 0) {
      rollback.recordsDeleted = 0;
      return;
    }

    // Delete in batches to avoid query size limits
    const deleteBatchSize = 1000;
    let deletedCount = 0;

    for (let i = 0; i < migratedIds.length; i += deleteBatchSize) {
      const batchIds = migratedIds.slice(i, i + deleteBatchSize);
      const placeholders = batchIds.map((_, index) => `$${index + 1}`).join(', ');

      const deleteQuery = `
        DELETE FROM monitoring.${job.targetTable}
        WHERE id IN (${placeholders})
      `;

      const result = await timescaleClient.query(deleteQuery, batchIds);
      deletedCount += result.rowCount || 0;
    }

    rollback.recordsDeleted = deletedCount;
    this.logger.log(`Deleted ${deletedCount} records from ${job.targetTable}`);
  }

  private async verifyRollbackConsistency(job: MigrationJob, rollback: MigrationRollback): Promise<void> {
    // Verify that target table no longer contains migrated records
    const timescaleClient = this.dualPrisma.timescale;
    if (!timescaleClient) {
      throw new Error('TimescaleDB client not available');
    }

    const batches = this.migrationBatches.get(job.id) || [];
    const completedBatches = batches.filter(b => b.status === 'completed');

    for (const batch of completedBatches) {
      const recordIds = batch.records.map(r => r.id);
      if (recordIds.length === 0) continue;

      const placeholders = recordIds.map((_, i) => `$${i + 1}`).join(', ');
      const checkQuery = `
        SELECT COUNT(*) as count FROM monitoring.${job.targetTable}
        WHERE id IN (${placeholders})
      `;

      const result = await timescaleClient.query(checkQuery, recordIds);
      const remainingCount = parseInt(result.rows[0].count);

      if (remainingCount > 0) {
        throw new Error(`Rollback verification failed: ${remainingCount} records still exist in target`);
      }
    }

    this.logger.log(`Rollback consistency verified for job ${job.id}`);
  }

  /**
   * Gets migration job status
   */
  getMigrationJob(jobId: string): MigrationJob | undefined {
    return this.activeMigrations.get(jobId);
  }

  /**
   * Gets all active migration jobs
   */
  getActiveMigrations(): MigrationJob[] {
    return Array.from(this.activeMigrations.values());
  }

  /**
   * Gets migration batches for a job
   */
  getMigrationBatches(jobId: string): MigrationBatch[] {
    return this.migrationBatches.get(jobId) || [];
  }

  /**
   * Gets rollback job status
   */
  getRollbackJob(rollbackId: string): MigrationRollback | undefined {
    return this.rollbackJobs.get(rollbackId);
  }

  /**
   * Pauses a running migration
   */
  pauseMigration(jobId: string): boolean {
    const job = this.activeMigrations.get(jobId);
    if (!job || job.status !== MigrationStatus.RUNNING) {
      return false;
    }

    job.status = MigrationStatus.PAUSED;
    this.logger.log(`Migration paused: ${jobId}`);
    return true;
  }

  /**
   * Resumes a paused migration
   */
  resumeMigration(jobId: string): boolean {
    const job = this.activeMigrations.get(jobId);
    if (!job || job.status !== MigrationStatus.PAUSED) {
      return false;
    }

    job.status = MigrationStatus.RUNNING;
    this.logger.log(`Migration resumed: ${jobId}`);
    
    // Continue processing
    setImmediate(() => this.executeMigration(jobId));
    return true;
  }

  /**
   * Cancels a migration
   */
  cancelMigration(jobId: string): boolean {
    const job = this.activeMigrations.get(jobId);
    if (!job || ![MigrationStatus.RUNNING, MigrationStatus.PAUSED].includes(job.status)) {
      return false;
    }

    job.status = MigrationStatus.CANCELLED;
    job.endTime = new Date();
    this.logger.log(`Migration cancelled: ${jobId}`);
    return true;
  }

  /**
   * Gets migration statistics
   */
  getMigrationStatistics(): {
    totalJobs: number;
    runningJobs: number;
    completedJobs: number;
    failedJobs: number;
    totalRecordsMigrated: number;
    averageThroughput: number;
  } {
    const jobs = Array.from(this.activeMigrations.values());
    
    return {
      totalJobs: jobs.length,
      runningJobs: jobs.filter(j => j.status === MigrationStatus.RUNNING).length,
      completedJobs: jobs.filter(j => j.status === MigrationStatus.COMPLETED).length,
      failedJobs: jobs.filter(j => j.status === MigrationStatus.FAILED).length,
      totalRecordsMigrated: jobs.reduce((sum, j) => sum + j.migratedRecords, 0),
      averageThroughput: jobs.length > 0 
        ? jobs.reduce((sum, j) => sum + j.throughput, 0) / jobs.length 
        : 0,
    };
  }

  /**
   * Cleans up completed migration jobs
   */
  cleanupCompletedJobs(olderThanHours: number = 24): number {
    const cutoff = Date.now() - (olderThanHours * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [jobId, job] of this.activeMigrations.entries()) {
      if (job.endTime && 
          job.endTime.getTime() < cutoff && 
          [MigrationStatus.COMPLETED, MigrationStatus.FAILED, MigrationStatus.CANCELLED].includes(job.status)) {
        
        this.activeMigrations.delete(jobId);
        this.migrationBatches.delete(jobId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} completed migration jobs`);
    }

    return cleanedCount;
  }
}