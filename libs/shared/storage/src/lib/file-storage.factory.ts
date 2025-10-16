import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IFileStorageService } from './file-storage.interface';
import { LocalFileStorageService } from './local-file-storage.service';
import { S3FileStorageService } from './s3-file-storage.service';
import { MinIOFileStorageService } from './minio-file-storage.service';

export type StorageDriver = 'local' | 's3' | 'minio';

@Injectable()
export class FileStorageFactory {
  private readonly logger = new Logger(FileStorageFactory.name);
  private storageInstance: IFileStorageService | null = null;

  constructor(private readonly config: ConfigService) {}

  create(driver?: StorageDriver): IFileStorageService {
    const storageDriver = driver || this.config.get<StorageDriver>('STORAGE_DRIVER', 'local');

    // Return cached instance if available and driver hasn't changed
    if (this.storageInstance && this.getCurrentDriver() === storageDriver) {
      return this.storageInstance;
    }

    this.logger.log(`Creating file storage service with driver: ${storageDriver}`);

    switch (storageDriver) {
      case 'local':
        this.storageInstance = new LocalFileStorageService(this.config);
        break;
      case 's3':
        this.storageInstance = new S3FileStorageService(this.config);
        break;
      case 'minio':
        this.storageInstance = new MinIOFileStorageService(this.config);
        break;
      default:
        throw new Error(`Unsupported storage driver: ${storageDriver}`);
    }

    this.config.set('CURRENT_STORAGE_DRIVER', storageDriver);
    return this.storageInstance;
  }

  getCurrentDriver(): StorageDriver {
    return this.config.get<StorageDriver>('CURRENT_STORAGE_DRIVER', 'local');
  }

  async validateConfiguration(driver: StorageDriver): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      switch (driver) {
        case 'local':
          await this.validateLocalConfig(errors);
          break;
        case 's3':
          await this.validateS3Config(errors);
          break;
        case 'minio':
          await this.validateMinIOConfig(errors);
          break;
        default:
          errors.push(`Unknown storage driver: ${driver}`);
      }

      // Test storage instance creation
      if (errors.length === 0) {
        const testInstance = this.create(driver);
        
        // Test basic functionality
        try {
          await testInstance.getStats();
        } catch (error) {
          errors.push(`Storage instance test failed: ${error.message}`);
        }
      }
    } catch (error) {
      errors.push(`Configuration validation failed: ${error.message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private async validateLocalConfig(errors: string[]): Promise<void> {
    const basePath = this.config.get('STORAGE_BASE_PATH');
    if (!basePath) {
      errors.push('STORAGE_BASE_PATH is required for local storage');
    }

    // Test write permissions
    try {
      const testService = new LocalFileStorageService(this.config);
      const testBuffer = Buffer.from('test');
      const testPath = `test-${Date.now()}.txt`;
      
      await testService.upload(testBuffer, testPath);
      await testService.delete(testPath);
    } catch (error) {
      errors.push(`Local storage write test failed: ${error.message}`);
    }
  }

  private async validateS3Config(errors: string[]): Promise<void> {
    const requiredVars = [
      'S3_BUCKET_NAME',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
    ];

    for (const varName of requiredVars) {
      if (!this.config.get(varName)) {
        errors.push(`${varName} is required for S3 storage`);
      }
    }

    // Test S3 connection
    if (errors.length === 0) {
      try {
        const testService = new S3FileStorageService(this.config);
        await testService.getStats();
      } catch (error) {
        errors.push(`S3 connection test failed: ${error.message}`);
      }
    }
  }

  private async validateMinIOConfig(errors: string[]): Promise<void> {
    const requiredVars = [
      'MINIO_BUCKET_NAME',
      'MINIO_ENDPOINT',
      'MINIO_ACCESS_KEY',
      'MINIO_SECRET_KEY',
    ];

    for (const varName of requiredVars) {
      if (!this.config.get(varName)) {
        errors.push(`${varName} is required for MinIO storage`);
      }
    }

    // Test MinIO connection
    if (errors.length === 0) {
      try {
        const testService = new MinIOFileStorageService(this.config);
        await testService.getStats();
      } catch (error) {
        errors.push(`MinIO connection test failed: ${error.message}`);
      }
    }
  }

  async switchDriver(newDriver: StorageDriver): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Validate new driver configuration
      const validation = await this.validateConfiguration(newDriver);
      if (!validation.valid) {
        return {
          success: false,
          error: `Configuration validation failed: ${validation.errors.join(', ')}`,
        };
      }

      // Create new storage instance
      const oldDriver = this.getCurrentDriver();
      this.storageInstance = null; // Clear cached instance
      const newInstance = this.create(newDriver);

      this.logger.log(`Successfully switched storage driver from ${oldDriver} to ${newDriver}`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to switch storage driver: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getDriverCapabilities(driver: StorageDriver): Promise<{
    supportsEncryption: boolean;
    supportsPresignedUrls: boolean;
    supportsMetadata: boolean;
    supportsRangeRequests: boolean;
    maxFileSize?: number;
  }> {
    switch (driver) {
      case 'local':
        return {
          supportsEncryption: true,
          supportsPresignedUrls: false,
          supportsMetadata: true,
          supportsRangeRequests: true,
          maxFileSize: undefined, // Limited by disk space
        };
      case 's3':
        return {
          supportsEncryption: true,
          supportsPresignedUrls: true,
          supportsMetadata: true,
          supportsRangeRequests: true,
          maxFileSize: 5 * 1024 * 1024 * 1024 * 1024, // 5TB
        };
      case 'minio':
        return {
          supportsEncryption: true,
          supportsPresignedUrls: true,
          supportsMetadata: true,
          supportsRangeRequests: true,
          maxFileSize: 5 * 1024 * 1024 * 1024 * 1024, // 5TB
        };
      default:
        throw new Error(`Unknown driver: ${driver}`);
    }
  }
}