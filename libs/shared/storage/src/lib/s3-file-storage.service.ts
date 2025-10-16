import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
  GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

@Injectable()
export class S3FileStorageService implements IFileStorageService {
  private readonly logger = new Logger(S3FileStorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly config: ConfigService) {
    this.bucketName = this.config.get('S3_BUCKET_NAME');
    if (!this.bucketName) {
      throw new Error('S3_BUCKET_NAME is required for S3 file storage');
    }

    this.s3Client = new S3Client({
      region: this.config.get('AWS_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.config.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.config.get('AWS_SECRET_ACCESS_KEY'),
      },
      endpoint: this.config.get('S3_ENDPOINT'), // For custom S3-compatible services
      forcePathStyle: this.config.get('S3_FORCE_PATH_STYLE', false),
    });
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
        metadata['organization-id'] = options.metadata.organizationId?.toString() || '';
        metadata['uploaded-by'] = options.metadata.uploadedBy?.toString() || '';
        metadata['encrypted'] = options.encrypt ? 'true' : 'false';
        
        if (options.metadata.tags) {
          metadata['tags'] = JSON.stringify(options.metadata.tags);
        }
      }

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
        Body: fileBuffer,
        ContentType: options?.contentType || 'application/octet-stream',
        Metadata: metadata,
        ServerSideEncryption: 'AES256', // Server-side encryption
      });

      const response = await this.s3Client.send(command);

      this.logger.log(`File uploaded to S3: ${filePath}`);
      return response.ETag || crypto.createHash('md5').update(file).digest('hex');
    } catch (error) {
      this.logger.error(`Failed to upload file to S3 ${filePath}: ${error.message}`);
      throw error;
    }
  }

  async download(filePath: string, options?: DownloadOptions): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
        Range: options?.range ? `bytes=${options.range.start}-${options.range.end || ''}` : undefined,
      });

      const response: GetObjectCommandOutput = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error(`No body in S3 response for ${filePath}`);
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const reader = response.Body.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      let fileBuffer = Buffer.concat(chunks);

      // Decrypt if requested and file was encrypted
      if (options?.decrypt && response.Metadata?.['encrypted'] === 'true') {
        const keyId = response.Metadata?.['encryption-key-id'];
        fileBuffer = await this.decryptFile(fileBuffer, keyId);
      }

      this.logger.debug(`File downloaded from S3: ${filePath}`);
      return fileBuffer;
    } catch (error) {
      this.logger.error(`Failed to download file from S3 ${filePath}: ${error.message}`);
      throw error;
    }
  }

  async delete(filePath: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
      });

      await this.s3Client.send(command);

      this.logger.log(`File deleted from S3: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to delete file from S3 ${filePath}: ${error.message}`);
      throw error;
    }
  }

  async list(options?: ListOptions): Promise<ListResult> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: options?.prefix,
        MaxKeys: options?.maxKeys || 1000,
        ContinuationToken: options?.continuationToken,
        Delimiter: options?.recursive === false ? '/' : undefined,
      });

      const response = await this.s3Client.send(command);

      const files: FileInfo[] = [];

      if (response.Contents) {
        for (const object of response.Contents) {
          if (object.Key) {
            const metadata = await this.getMetadata(object.Key);
            
            files.push({
              path: object.Key,
              size: object.Size || 0,
              contentType: metadata?.contentType,
              lastModified: object.LastModified || new Date(),
              etag: object.ETag,
              metadata,
            });
          }
        }
      }

      return {
        files,
        continuationToken: response.NextContinuationToken,
        isTruncated: response.IsTruncated || false,
      };
    } catch (error) {
      this.logger.error(`Failed to list files in S3: ${error.message}`);
      throw error;
    }
  }

  async getUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      return signedUrl;
    } catch (error) {
      this.logger.error(`Failed to generate signed URL for ${filePath}: ${error.message}`);
      throw error;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async getMetadata(filePath: string): Promise<FileMetadata | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
      });

      const response = await this.s3Client.send(command);

      if (!response.Metadata) {
        return null;
      }

      const metadata: FileMetadata = {
        contentType: response.ContentType,
        size: response.ContentLength,
      };

      if (response.Metadata['organization-id']) {
        metadata.organizationId = parseInt(response.Metadata['organization-id']);
      }

      if (response.Metadata['uploaded-by']) {
        metadata.uploadedBy = parseInt(response.Metadata['uploaded-by']);
      }

      if (response.Metadata['tags']) {
        try {
          metadata.tags = JSON.parse(response.Metadata['tags']);
        } catch (error) {
          this.logger.warn(`Failed to parse tags for ${filePath}: ${error.message}`);
        }
      }

      if (response.Metadata['encrypted'] === 'true') {
        metadata.encryption = {
          algorithm: 'AES-256-GCM',
          keyId: response.Metadata['encryption-key-id'] || 'default',
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
      const command = new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourcePath}`,
        Key: destinationPath,
      });

      await this.s3Client.send(command);

      this.logger.log(`File copied in S3: ${sourcePath} -> ${destinationPath}`);
    } catch (error) {
      this.logger.error(`Failed to copy file in S3: ${error.message}`);
      throw error;
    }
  }

  async move(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      await this.copy(sourcePath, destinationPath);
      await this.delete(sourcePath);

      this.logger.log(`File moved in S3: ${sourcePath} -> ${destinationPath}`);
    } catch (error) {
      this.logger.error(`Failed to move file in S3: ${error.message}`);
      throw error;
    }
  }

  async getStats(): Promise<{ totalFiles: number; totalSize: number }> {
    try {
      let totalFiles = 0;
      let totalSize = 0;
      let continuationToken: string | undefined;

      do {
        const result = await this.list({
          maxKeys: 1000,
          continuationToken,
          recursive: true,
        });

        totalFiles += result.files.length;
        totalSize += result.files.reduce((sum, file) => sum + file.size, 0);
        continuationToken = result.continuationToken;
      } while (continuationToken);

      return {
        totalFiles,
        totalSize,
      };
    } catch (error) {
      this.logger.error(`Failed to get S3 storage stats: ${error.message}`);
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
    // In a real implementation, this would fetch the key from AWS KMS or similar
    // For now, use a default key from config
    return this.config.get('FILE_ENCRYPTION_KEY', 'default-encryption-key-change-in-production');
  }
}