import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import {
  IFileStorageService,
  FileMetadata,
  FileInfo,
  ListOptions,
  ListResult,
  UploadOptions,
  DownloadOptions,
} from './file-storage.interface';
import * as crypto from 'crypto';
import { Readable } from 'stream';

@Injectable()
export class MinIOFileStorageService implements IFileStorageService {
  private readonly logger = new Logger(MinIOFileStorageService.name);
  private readonly minioClient: Minio.Client;
  private readonly bucketName: string;

  constructor(private readonly config: ConfigService) {
    this.bucketName = this.config.get('MINIO_BUCKET_NAME');
    if (!this.bucketName) {
      throw new Error('MINIO_BUCKET_NAME is required for MinIO file storage');
    }

    this.minioClient = new Minio.Client({
      endPoint: this.config.get('MINIO_ENDPOINT', 'localhost'),
      port: parseInt(this.config.get('MINIO_PORT', '9000')),
      useSSL: this.config.get('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.config.get('MINIO_ACCESS_KEY'),
      secretKey: this.config.get('MINIO_SECRET_KEY'),
    });

    this.ensureBucketExists();
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName);
        this.logger.log(`Created MinIO bucket: ${this.bucketName}`);
      }
    } catch (error) {
      this.logger.error(`Failed to ensure bucket exists: ${error.message}`);
    }
  }

  async upload(file: Buffer, filePath: string, options?: UploadOptions): Promise<string> {
    try {
      let fileBuffer = file;

      // Encrypt if requested
      if (options?.encrypt) {
        fileBuffer = await this.encryptFile(file, options.metadata?.encryption?.keyId);
      }

      // Prepare metadata
      const metadata: Record<string, string> = {};
      if (options?.metadata) {
        metadata['Organization-Id'] = options.metadata.organizationId?.toString() || '';
        metadata['Uploaded-By'] = options.metadata.uploadedBy?.toString() || '';
        metadata['Encrypted'] = options.encrypt ? 'true' : 'false';
        
        if (options.metadata.tags) {
          metadata['Tags'] = JSON.stringify(options.metadata.tags);
        }

        if (options.metadata.encryption) {
          metadata['Encryption-Key-Id'] = options.metadata.encryption.keyId;
        }
      }

      const stream = Readable.from(fileBuffer);

      const result = await this.minioClient.putObject(
        this.bucketName,
        filePath,
        stream,
        fileBuffer.length,
        {
          'Content-Type': options?.contentType || 'application/octet-stream',
          ...metadata,
        }
      );

      this.logger.log(`File uploaded to MinIO: ${filePath}`);
      return result.etag || crypto.createHash('md5').update(file).digest('hex');
    } catch (error) {
      this.logger.error(`Failed to upload file to MinIO ${filePath}: ${error.message}`);
      throw error;
    }
  }

  async download(filePath: string, options?: DownloadOptions): Promise<Buffer> {
    try {
      const stream = await this.minioClient.getObject(this.bucketName, filePath);

      // Handle range requests
      if (options?.range) {
        const partialStream = await this.minioClient.getPartialObject(
          this.bucketName,
          filePath,
          options.range.start,
          options.range.end ? options.range.end - options.range.start + 1 : undefined
        );
        stream = partialStream;
      }

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      let fileBuffer = Buffer.concat(chunks);

      // Decrypt if requested and file was encrypted
      if (options?.decrypt) {
        const metadata = await this.getMetadata(filePath);
        if (metadata?.encryption) {
          fileBuffer = await this.decryptFile(fileBuffer, metadata.encryption.keyId);
        }
      }

      this.logger.debug(`File downloaded from MinIO: ${filePath}`);
      return fileBuffer;
    } catch (error) {
      this.logger.error(`Failed to download file from MinIO ${filePath}: ${error.message}`);
      throw error;
    }
  }

  async delete(filePath: string): Promise<void> {
    try {
      await this.minioClient.removeObject(this.bucketName, filePath);

      this.logger.log(`File deleted from MinIO: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to delete file from MinIO ${filePath}: ${error.message}`);
      throw error;
    }
  }

  async list(options?: ListOptions): Promise<ListResult> {
    try {
      const files: FileInfo[] = [];
      const stream = this.minioClient.listObjectsV2(
        this.bucketName,
        options?.prefix,
        options?.recursive !== false,
        options?.continuationToken
      );

      let count = 0;
      const maxKeys = options?.maxKeys || 1000;

      for await (const obj of stream) {
        if (count >= maxKeys) {
          break;
        }

        if (obj.name) {
          const metadata = await this.getMetadata(obj.name);
          
          files.push({
            path: obj.name,
            size: obj.size || 0,
            contentType: metadata?.contentType,
            lastModified: obj.lastModified || new Date(),
            etag: obj.etag,
            metadata,
          });

          count++;
        }
      }

      return {
        files,
        continuationToken: count >= maxKeys ? 'has-more' : undefined,
        isTruncated: count >= maxKeys,
      };
    } catch (error) {
      this.logger.error(`Failed to list files in MinIO: ${error.message}`);
      throw error;
    }
  }

  async getUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    try {
      const signedUrl = await this.minioClient.presignedGetObject(
        this.bucketName,
        filePath,
        expiresIn
      );

      return signedUrl;
    } catch (error) {
      this.logger.error(`Failed to generate signed URL for ${filePath}: ${error.message}`);
      throw error;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await this.minioClient.statObject(this.bucketName, filePath);
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async getMetadata(filePath: string): Promise<FileMetadata | null> {
    try {
      const stat = await this.minioClient.statObject(this.bucketName, filePath);

      const metadata: FileMetadata = {
        contentType: stat.metaData?.['content-type'],
        size: stat.size,
      };

      if (stat.metaData?.['organization-id']) {
        metadata.organizationId = parseInt(stat.metaData['organization-id']);
      }

      if (stat.metaData?.['uploaded-by']) {
        metadata.uploadedBy = parseInt(stat.metaData['uploaded-by']);
      }

      if (stat.metaData?.['tags']) {
        try {
          metadata.tags = JSON.parse(stat.metaData['tags']);
        } catch (error) {
          this.logger.warn(`Failed to parse tags for ${filePath}: ${error.message}`);
        }
      }

      if (stat.metaData?.['encrypted'] === 'true') {
        metadata.encryption = {
          algorithm: 'AES-256-GCM',
          keyId: stat.metaData?.['encryption-key-id'] || 'default',
        };
      }

      return metadata;
    } catch (error) {
      this.logger.error(`Failed to get metadata for ${filePath}: ${error.message}`);
      return null;
    }
  }

  async copy(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      const copyConditions = new Minio.CopyConditions();
      
      await this.minioClient.copyObject(
        this.bucketName,
        destinationPath,
        `/${this.bucketName}/${sourcePath}`,
        copyConditions
      );

      this.logger.log(`File copied in MinIO: ${sourcePath} -> ${destinationPath}`);
    } catch (error) {
      this.logger.error(`Failed to copy file in MinIO: ${error.message}`);
      throw error;
    }
  }

  async move(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      await this.copy(sourcePath, destinationPath);
      await this.delete(sourcePath);

      this.logger.log(`File moved in MinIO: ${sourcePath} -> ${destinationPath}`);
    } catch (error) {
      this.logger.error(`Failed to move file in MinIO: ${error.message}`);
      throw error;
    }
  }

  async getStats(): Promise<{ totalFiles: number; totalSize: number }> {
    try {
      let totalFiles = 0;
      let totalSize = 0;

      const stream = this.minioClient.listObjectsV2(this.bucketName, '', true);

      for await (const obj of stream) {
        totalFiles++;
        totalSize += obj.size || 0;
      }

      return {
        totalFiles,
        totalSize,
      };
    } catch (error) {
      this.logger.error(`Failed to get MinIO storage stats: ${error.message}`);
      throw error;
    }
  }

  private async encryptFile(file: Buffer, keyId?: string): Promise<Buffer> {
    try {
      // Simple AES-256-GCM encryption
      const key = await this.getEncryptionKey(keyId);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-gcm', key);
      
      const encrypted = Buffer.concat([cipher.update(file), cipher.final()]);
      const authTag = cipher.getAuthTag();
      
      // Prepend IV and auth tag to encrypted data
      return Buffer.concat([iv, authTag, encrypted]);
    } catch (error) {
      this.logger.error(`Failed to encrypt file: ${error.message}`);
      throw error;
    }
  }

  private async decryptFile(encryptedFile: Buffer, keyId?: string): Promise<Buffer> {
    try {
      const key = await this.getEncryptionKey(keyId);
      
      // Extract IV, auth tag, and encrypted data
      const iv = encryptedFile.slice(0, 16);
      const authTag = encryptedFile.slice(16, 32);
      const encrypted = encryptedFile.slice(32);
      
      const decipher = crypto.createDecipher('aes-256-gcm', key);
      decipher.setAuthTag(authTag);
      
      return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    } catch (error) {
      this.logger.error(`Failed to decrypt file: ${error.message}`);
      throw error;
    }
  }

  private async getEncryptionKey(keyId?: string): Promise<string> {
    // In a real implementation, this would fetch the key from a key management service
    // For now, use a default key from config
    return this.config.get('FILE_ENCRYPTION_KEY', 'default-encryption-key-change-in-production');
  }
}