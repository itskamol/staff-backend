import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IFileStorageService, FileInfo } from './file-storage.interface';
import { FileStorageFactory, StorageDriver } from './file-storage.factory';
import * as crypto from 'crypto';

export interface MigrationProgress {
  totalFiles: number;
  processedFiles: number;
  successfulFiles: number;
  failedFiles: number;
  totalSize: number;
  processedSize: number;
  startTime: Date;
  estimatedCompletion?: Date;
  currentFile?: string;
  errors: MigrationError[];
}

export interface MigrationError {
  filePath: string;
  error: string;
  timestamp: Date;
  retryCount: number;
}

export interface MigrationOptions {
  batchSize?: number;
  maxRetries?: number;
  verifyIntegrity?: boolean;
  preserveMetadata?: boolean;
  deleteSource?: boolean;
  continueOnError?: boolean;
  progressCallback?: (progress: MigrationProgress) => void;
}

export interface IntegrityVerificationResult {
  filePath: string;
  sourceChecksum: string;
  targetChecksum: string;
  isValid: boolean;
  error?: string;
}

@Injectable()
export class StorageMigrationService {
  private readonly logger = new Logger(StorageMigrationService.name);
  private migrationInProgress = false;
  private currentProgress: MigrationProgress | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly storageFactory: FileStorageFactory,
  ) {}

  async migrateStorage(
    sourceDriver: StorageDriver,
    targetDriver: StorageDriver,
    options: MigrationOptions = {},
  ): Promise<MigrationProgress> {
    if (this.migrationInProgress) {
      throw new Error('Migration already in progress');
    }

    this.migrationInProgress = true;
    this.logger.log(`Starting storage migration from ${sourceDriver} to ${targetDriver}`);

    try {
      // Initialize storage services
      const sourceStorage = this.storageFactory.create(sourceDriver);
      const targetStorage = this.storageFactory.create(targetDriver);

      // Validate configurations
      await this.validateMigrationSetup(sourceStorage, targetStorage);

      // Initialize progress tracking
      const progress = await this.initializeMigrationProgress(sourceStorage, options);
      this.currentProgress = progress;

      // Perform migration
      await this.performMigration(sourceStorage, targetStorage, progress, options);

      // Final verification if requested
      if (options.verifyIntegrity) {
        await this.performFinalVerification(sourceStorage, targetStorage, progress);
      }

      // Cleanup source files if requested
      if (options.deleteSource && progress.failedFiles === 0) {
        await this.cleanupSourceFiles(sourceStorage, progress);
      }

      progress.estimatedCompletion = new Date();
      this.logger.log(`Migration completed successfully: ${progress.successfulFiles}/${progress.totalFiles} files`);

      return progress;
    } catch (error) {
      this.logger.error(`Migration failed: ${error.message}`);
      throw error;
    } finally {
      this.migrationInProgress = false;
      this.currentProgress = null;
    }
  }

  private async validateMigrationSetup(
    sourceStorage: IFileStorageService,
    targetStorage: IFileStorageService,
  ): Promise<void> {
    try {
      // Test source storage connectivity
      await sourceStorage.getStats();
      this.logger.log('Source storage validation passed');

      // Test target storage connectivity
      await targetStorage.getStats();
      this.logger.log('Target storage validation passed');

      // Test write permissions on target
      const testBuffer = Buffer.from('migration-test');
      const testPath = `migration-test-${Date.now()}.txt`;
      
      await targetStorage.upload(testBuffer, testPath);
      await targetStorage.delete(testPath);
      this.logger.log('Target storage write test passed');
    } catch (error) {
      throw new Error(`Migration setup validation failed: ${error.message}`);
    }
  }

  private async initializeMigrationProgress(
    sourceStorage: IFileStorageService,
    options: MigrationOptions,
  ): Promise<MigrationProgress> {
    const stats = await sourceStorage.getStats();

    return {
      totalFiles: stats.totalFiles,
      processedFiles: 0,
      successfulFiles: 0,
      failedFiles: 0,
      totalSize: stats.totalSize,
      processedSize: 0,
      startTime: new Date(),
      errors: [],
    };
  }

  private async performMigration(
    sourceStorage: IFileStorageService,
    targetStorage: IFileStorageService,
    progress: MigrationProgress,
    options: MigrationOptions,
  ): Promise<void> {
    const batchSize = options.batchSize || 100;
    let continuationToken: string | undefined;

    do {
      // Get batch of files
      const listResult = await sourceStorage.list({
        maxKeys: batchSize,
        continuationToken,
        recursive: true,
      });

      // Process batch
      await this.processBatch(
        sourceStorage,
        targetStorage,
        listResult.files,
        progress,
        options,
      );

      continuationToken = listResult.continuationToken;

      // Report progress
      if (options.progressCallback) {
        options.progressCallback(progress);
      }

      this.logger.debug(`Processed batch: ${progress.processedFiles}/${progress.totalFiles} files`);
    } while (continuationToken);
  }

  private async processBatch(
    sourceStorage: IFileStorageService,
    targetStorage: IFileStorageService,
    files: FileInfo[],
    progress: MigrationProgress,
    options: MigrationOptions,
  ): Promise<void> {
    const maxRetries = options.maxRetries || 3;

    for (const file of files) {
      progress.currentFile = file.path;
      let retryCount = 0;
      let success = false;

      while (retryCount <= maxRetries && !success) {
        try {
          await this.migrateFile(sourceStorage, targetStorage, file, options);
          
          progress.successfulFiles++;
          progress.processedSize += file.size;
          success = true;

          this.logger.debug(`Successfully migrated: ${file.path}`);
        } catch (error) {
          retryCount++;
          
          if (retryCount > maxRetries) {
            progress.failedFiles++;
            progress.errors.push({
              filePath: file.path,
              error: error.message,
              timestamp: new Date(),
              retryCount: retryCount - 1,
            });

            this.logger.error(`Failed to migrate ${file.path} after ${maxRetries} retries: ${error.message}`);

            if (!options.continueOnError) {
              throw new Error(`Migration failed on file ${file.path}: ${error.message}`);
            }
          } else {
            this.logger.warn(`Retry ${retryCount}/${maxRetries} for ${file.path}: ${error.message}`);
            
            // Exponential backoff
            await this.delay(Math.pow(2, retryCount) * 1000);
          }
        }
      }

      progress.processedFiles++;
      
      // Update ETA
      this.updateEstimatedCompletion(progress);
    }
  }

  private async migrateFile(
    sourceStorage: IFileStorageService,
    targetStorage: IFileStorageService,
    file: FileInfo,
    options: MigrationOptions,
  ): Promise<void> {
    // Download from source
    const fileBuffer = await sourceStorage.download(file.path);

    // Prepare upload options
    const uploadOptions: any = {
      contentType: file.contentType,
      overwrite: true,
    };

    // Preserve metadata if requested
    if (options.preserveMetadata && file.metadata) {
      uploadOptions.metadata = file.metadata;
    }

    // Upload to target
    await targetStorage.upload(fileBuffer, file.path, uploadOptions);

    // Verify integrity if requested
    if (options.verifyIntegrity) {
      await this.verifyFileIntegrity(sourceStorage, targetStorage, file.path, fileBuffer);
    }
  }

  private async verifyFileIntegrity(
    sourceStorage: IFileStorageService,
    targetStorage: IFileStorageService,
    filePath: string,
    originalBuffer?: Buffer,
  ): Promise<IntegrityVerificationResult> {
    try {
      // Get checksums
      const sourceBuffer = originalBuffer || await sourceStorage.download(filePath);
      const targetBuffer = await targetStorage.download(filePath);

      const sourceChecksum = crypto.createHash('sha256').update(sourceBuffer).digest('hex');
      const targetChecksum = crypto.createHash('sha256').update(targetBuffer).digest('hex');

      const isValid = sourceChecksum === targetChecksum;

      if (!isValid) {
        throw new Error(`Checksum mismatch: source=${sourceChecksum}, target=${targetChecksum}`);
      }

      return {
        filePath,
        sourceChecksum,
        targetChecksum,
        isValid,
      };
    } catch (error) {
      return {
        filePath,
        sourceChecksum: '',
        targetChecksum: '',
        isValid: false,
        error: error.message,
      };
    }
  }

  private async performFinalVerification(
    sourceStorage: IFileStorageService,
    targetStorage: IFileStorageService,
    progress: MigrationProgress,
  ): Promise<void> {
    this.logger.log('Starting final integrity verification');

    const sourceStats = await sourceStorage.getStats();
    const targetStats = await targetStorage.getStats();

    // Compare file counts (accounting for failed files)
    const expectedFiles = sourceStats.totalFiles - progress.failedFiles;
    if (targetStats.totalFiles < expectedFiles) {
      throw new Error(`File count mismatch: expected ${expectedFiles}, found ${targetStats.totalFiles}`);
    }

    // Perform random sampling verification
    const sampleSize = Math.min(100, Math.floor(expectedFiles * 0.1)); // 10% sample, max 100 files
    await this.performSampleVerification(sourceStorage, targetStorage, sampleSize);

    this.logger.log('Final verification completed successfully');
  }

  private async performSampleVerification(
    sourceStorage: IFileStorageService,
    targetStorage: IFileStorageService,
    sampleSize: number,
  ): Promise<void> {
    const sourceFiles = await sourceStorage.list({ maxKeys: sampleSize * 2, recursive: true });
    
    // Randomly select files for verification
    const shuffled = sourceFiles.files.sort(() => 0.5 - Math.random());
    const sampleFiles = shuffled.slice(0, sampleSize);

    let verificationErrors = 0;

    for (const file of sampleFiles) {
      const result = await this.verifyFileIntegrity(sourceStorage, targetStorage, file.path);
      
      if (!result.isValid) {
        verificationErrors++;
        this.logger.error(`Sample verification failed for ${file.path}: ${result.error}`);
      }
    }

    if (verificationErrors > 0) {
      throw new Error(`Sample verification failed: ${verificationErrors}/${sampleSize} files failed verification`);
    }

    this.logger.log(`Sample verification passed: ${sampleSize} files verified`);
  }

  private async cleanupSourceFiles(
    sourceStorage: IFileStorageService,
    progress: MigrationProgress,
  ): Promise<void> {
    this.logger.log('Starting source file cleanup');

    let continuationToken: string | undefined;
    let deletedCount = 0;

    do {
      const listResult = await sourceStorage.list({
        maxKeys: 100,
        continuationToken,
        recursive: true,
      });

      for (const file of listResult.files) {
        try {
          await sourceStorage.delete(file.path);
          deletedCount++;
        } catch (error) {
          this.logger.warn(`Failed to delete source file ${file.path}: ${error.message}`);
        }
      }

      continuationToken = listResult.continuationToken;
    } while (continuationToken);

    this.logger.log(`Source cleanup completed: ${deletedCount} files deleted`);
  }

  private updateEstimatedCompletion(progress: MigrationProgress): void {
    if (progress.processedFiles === 0) return;

    const elapsed = Date.now() - progress.startTime.getTime();
    const rate = progress.processedFiles / elapsed; // files per millisecond
    const remaining = progress.totalFiles - progress.processedFiles;
    const estimatedRemainingTime = remaining / rate;

    progress.estimatedCompletion = new Date(Date.now() + estimatedRemainingTime);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getCurrentProgress(): MigrationProgress | null {
    return this.currentProgress;
  }

  isMigrationInProgress(): boolean {
    return this.migrationInProgress;
  }

  async generateMigrationReport(progress: MigrationProgress): Promise<string> {
    const duration = progress.estimatedCompletion 
      ? progress.estimatedCompletion.getTime() - progress.startTime.getTime()
      : Date.now() - progress.startTime.getTime();

    const successRate = (progress.successfulFiles / progress.totalFiles) * 100;
    const avgSpeed = progress.processedSize / (duration / 1000); // bytes per second

    let report = `# Storage Migration Report\n\n`;
    report += `**Migration Date:** ${progress.startTime.toISOString()}\n`;
    report += `**Duration:** ${Math.round(duration / 1000)} seconds\n\n`;
    
    report += `## Summary\n\n`;
    report += `- **Total Files:** ${progress.totalFiles}\n`;
    report += `- **Successful:** ${progress.successfulFiles}\n`;
    report += `- **Failed:** ${progress.failedFiles}\n`;
    report += `- **Success Rate:** ${successRate.toFixed(2)}%\n`;
    report += `- **Total Size:** ${this.formatBytes(progress.totalSize)}\n`;
    report += `- **Average Speed:** ${this.formatBytes(avgSpeed)}/s\n\n`;

    if (progress.errors.length > 0) {
      report += `## Errors\n\n`;
      for (const error of progress.errors) {
        report += `- **${error.filePath}:** ${error.error} (${error.retryCount} retries)\n`;
      }
      report += `\n`;
    }

    return report;
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  async rollbackMigration(
    sourceDriver: StorageDriver,
    targetDriver: StorageDriver,
    progress: MigrationProgress,
  ): Promise<void> {
    this.logger.log('Starting migration rollback');

    const targetStorage = this.storageFactory.create(targetDriver);
    let rollbackCount = 0;

    // Delete successfully migrated files from target
    let continuationToken: string | undefined;

    do {
      const listResult = await targetStorage.list({
        maxKeys: 100,
        continuationToken,
        recursive: true,
      });

      for (const file of listResult.files) {
        try {
          await targetStorage.delete(file.path);
          rollbackCount++;
        } catch (error) {
          this.logger.warn(`Failed to rollback file ${file.path}: ${error.message}`);
        }
      }

      continuationToken = listResult.continuationToken;
    } while (continuationToken);

    this.logger.log(`Rollback completed: ${rollbackCount} files removed from target storage`);
  }
}