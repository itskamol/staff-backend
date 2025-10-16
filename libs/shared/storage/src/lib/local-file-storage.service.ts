import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IFileStorageService,
  FileMetadata,
  FileInfo,
  ListOptions,
  ListResult,
  UploadOptions,
  DownloadOptions,
} from './file-storage.interface';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { createReadStream, createWriteStream, existsSync } from 'fs';
import { pipeline } from 'stream/promises';

@Injectable()
export class LocalFileStorageService implements IFileStorageService {
  private readonly logger = new Logger(LocalFileStorageService.name);
  private readonly basePath: string;
  private readonly metadataPath: string;

  constructor(private readonly config: ConfigService) {
    this.basePath = this.config.get('STORAGE_BASE_PATH', './storage');
    this.metadataPath = path.join(this.basePath, '.metadata');
    this.ensureDirectoryExists(this.basePath);
    this.ensureDirectoryExists(this.metadataPath);
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create directory ${dirPath}: ${error.message}`);
      throw error;
    }
  }

  async upload(file: Buffer, filePath: string, options?: UploadOptions): Promise<string> {
    try {
      const fullPath = path.join(this.basePath, filePath);
      const directory = path.dirname(fullPath);

      // Ensure directory exists
      await this.ensureDirectoryExists(directory);

      // Check if file exists and overwrite is not allowed
      if (!options?.overwrite && existsSync(fullPath)) {
        throw new Error(`File already exists: ${filePath}`);
      }

      let fileBuffer = file;

      // Encrypt if requested
      if (options?.encrypt) {
        fileBuffer = await this.encryptFile(file, options.metadata?.encryption?.keyId);
      }

      // Write file
      await fs.writeFile(fullPath, fileBuffer);

      // Store metadata
      if (options?.metadata) {
        await this.storeMetadata(filePath, {
          ...options.metadata,
          size: file.length,
          contentType: options.contentType,
        });
      }

      // Generate ETag
      const etag = crypto.createHash('md5').update(file).digest('hex');

      this.logger.log(`File uploaded successfully: ${filePath}`);
      return etag;
    } catch (error) {
      this.logger.error(`Failed to upload file ${filePath}: ${error.message}`);
      throw error;
    }
  }

  async download(filePath: string, options?: DownloadOptions): Promise<Buffer> {
    try {
      const fullPath = path.join(this.basePath, filePath);

      if (!existsSync(fullPath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      let fileBuffer: Buffer;

      // Handle range requests
      if (options?.range) {
        const { start, end } = options.range;
        const stream = createReadStream(fullPath, { start, end });
        const chunks: Buffer[] = [];
        
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        
        fileBuffer = Buffer.concat(chunks);
      } else {
        fileBuffer = await fs.readFile(fullPath);
      }

      // Decrypt if requested
      if (options?.decrypt) {
        const metadata = await this.getMetadata(filePath);
        if (metadata?.encryption) {
          fileBuffer = await this.decryptFile(fileBuffer, metadata.encryption.keyId);
        }
      }

      this.logger.debug(`File downloaded successfully: ${filePath}`);
      return fileBuffer;
    } catch (error) {
      this.logger.error(`Failed to download file ${filePath}: ${error.message}`);
      throw error;
    }
  }

  async delete(filePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.basePath, filePath);

      if (!existsSync(fullPath)) {
        this.logger.warn(`File not found for deletion: ${filePath}`);
        return;
      }

      await fs.unlink(fullPath);

      // Delete metadata
      await this.deleteMetadata(filePath);

      this.logger.log(`File deleted successfully: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to delete file ${filePath}: ${error.message}`);
      throw error;
    }
  }

  async list(options?: ListOptions): Promise<ListResult> {
    try {
      const searchPath = options?.prefix 
        ? path.join(this.basePath, options.prefix)
        : this.basePath;

      const files: FileInfo[] = [];
      await this.listFilesRecursive(searchPath, files, options);

      // Apply pagination
      const maxKeys = options?.maxKeys || 1000;
      const startIndex = options?.continuationToken ? parseInt(options.continuationToken) : 0;
      const endIndex = startIndex + maxKeys;
      
      const paginatedFiles = files.slice(startIndex, endIndex);
      const isTruncated = endIndex < files.length;
      const continuationToken = isTruncated ? endIndex.toString() : undefined;

      return {
        files: paginatedFiles,
        continuationToken,
        isTruncated,
      };
    } catch (error) {
      this.logger.error(`Failed to list files: ${error.message}`);
      throw error;
    }
  }

  private async listFilesRecursive(
    dirPath: string,
    files: FileInfo[],
    options?: ListOptions,
  ): Promise<void> {
    try {
      if (!existsSync(dirPath)) {
        return;
      }

      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(this.basePath, fullPath);

        // Skip metadata directory
        if (relativePath.startsWith('.metadata')) {
          continue;
        }

        if (entry.isDirectory()) {
          if (options?.recursive !== false) {
            await this.listFilesRecursive(fullPath, files, options);
          }
        } else {
          const stats = await fs.stat(fullPath);
          const metadata = await this.getMetadata(relativePath);

          files.push({
            path: relativePath,
            size: stats.size,
            contentType: metadata?.contentType,
            lastModified: stats.mtime,
            metadata,
          });
        }
      }
    } catch (error) {
      this.logger.error(`Failed to list directory ${dirPath}: ${error.message}`);
    }
  }

  async getUrl(filePath: string, expiresIn?: number): Promise<string> {
    // For local storage, return a file:// URL or a signed URL if implementing a local server
    const fullPath = path.join(this.basePath, filePath);
    
    if (!existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // In a real implementation, you might want to create a temporary signed URL
    // For now, return a file URL
    return `file://${path.resolve(fullPath)}`;
  }

  async exists(filePath: string): Promise<boolean> {
    const fullPath = path.join(this.basePath, filePath);
    return existsSync(fullPath);
  }

  async getMetadata(filePath: string): Promise<FileMetadata | null> {
    try {
      const metadataFile = path.join(this.metadataPath, `${filePath}.json`);
      
      if (!existsSync(metadataFile)) {
        return null;
      }

      const metadataContent = await fs.readFile(metadataFile, 'utf-8');
      return JSON.parse(metadataContent);
    } catch (error) {
      this.logger.error(`Failed to get metadata for ${filePath}: ${error.message}`);
      return null;
    }
  }

  private async storeMetadata(filePath: string, metadata: FileMetadata): Promise<void> {
    try {
      const metadataFile = path.join(this.metadataPath, `${filePath}.json`);
      const metadataDir = path.dirname(metadataFile);

      await this.ensureDirectoryExists(metadataDir);
      await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
    } catch (error) {
      this.logger.error(`Failed to store metadata for ${filePath}: ${error.message}`);
    }
  }

  private async deleteMetadata(filePath: string): Promise<void> {
    try {
      const metadataFile = path.join(this.metadataPath, `${filePath}.json`);
      
      if (existsSync(metadataFile)) {
        await fs.unlink(metadataFile);
      }
    } catch (error) {
      this.logger.error(`Failed to delete metadata for ${filePath}: ${error.message}`);
    }
  }

  async copy(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      const sourceFullPath = path.join(this.basePath, sourcePath);
      const destFullPath = path.join(this.basePath, destinationPath);
      const destDirectory = path.dirname(destFullPath);

      if (!existsSync(sourceFullPath)) {
        throw new Error(`Source file not found: ${sourcePath}`);
      }

      await this.ensureDirectoryExists(destDirectory);
      await fs.copyFile(sourceFullPath, destFullPath);

      // Copy metadata
      const metadata = await this.getMetadata(sourcePath);
      if (metadata) {
        await this.storeMetadata(destinationPath, metadata);
      }

      this.logger.log(`File copied: ${sourcePath} -> ${destinationPath}`);
    } catch (error) {
      this.logger.error(`Failed to copy file: ${error.message}`);
      throw error;
    }
  }

  async move(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      await this.copy(sourcePath, destinationPath);
      await this.delete(sourcePath);

      this.logger.log(`File moved: ${sourcePath} -> ${destinationPath}`);
    } catch (error) {
      this.logger.error(`Failed to move file: ${error.message}`);
      throw error;
    }
  }

  async getStats(): Promise<{ totalFiles: number; totalSize: number; availableSpace?: number }> {
    try {
      const files = await this.list({ recursive: true });
      const totalFiles = files.files.length;
      const totalSize = files.files.reduce((sum, file) => sum + file.size, 0);

      // Get available space
      let availableSpace: number | undefined;
      try {
        const stats = await fs.statfs(this.basePath);
        availableSpace = stats.bavail * stats.bsize;
      } catch (error) {
        this.logger.warn(`Could not get available space: ${error.message}`);
      }

      return {
        totalFiles,
        totalSize,
        availableSpace,
      };
    } catch (error) {
      this.logger.error(`Failed to get storage stats: ${error.message}`);
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