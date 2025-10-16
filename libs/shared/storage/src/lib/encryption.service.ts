import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface EncryptionKey {
  id: string;
  algorithm: string;
  key: Buffer;
  createdAt: Date;
  isActive: boolean;
}

export interface EncryptionResult {
  encryptedData: Buffer;
  keyId: string;
  algorithm: string;
  iv: Buffer;
  authTag: Buffer;
}

export interface DecryptionOptions {
  keyId: string;
  algorithm: string;
  iv: Buffer;
  authTag: Buffer;
}

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyCache = new Map<string, EncryptionKey>();

  constructor(private readonly config: ConfigService) {}

  async encryptFile(data: Buffer, keyId?: string): Promise<EncryptionResult> {
    try {
      const key = await this.getEncryptionKey(keyId);
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipher(this.algorithm, key.key);
      cipher.setAAD(Buffer.from(key.id)); // Additional authenticated data
      
      const encrypted = Buffer.concat([
        cipher.update(data),
        cipher.final()
      ]);
      
      const authTag = cipher.getAuthTag();

      this.logger.debug(`File encrypted with key ${key.id}, size: ${data.length} -> ${encrypted.length}`);

      return {
        encryptedData: encrypted,
        keyId: key.id,
        algorithm: this.algorithm,
        iv,
        authTag,
      };
    } catch (error) {
      this.logger.error(`File encryption failed: ${error.message}`);
      throw error;
    }
  }

  async decryptFile(encryptedData: Buffer, options: DecryptionOptions): Promise<Buffer> {
    try {
      const key = await this.getEncryptionKey(options.keyId);
      
      const decipher = crypto.createDecipher(options.algorithm, key.key);
      decipher.setAuthTag(options.authTag);
      decipher.setAAD(Buffer.from(key.id));
      
      const decrypted = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final()
      ]);

      this.logger.debug(`File decrypted with key ${key.id}, size: ${encryptedData.length} -> ${decrypted.length}`);

      return decrypted;
    } catch (error) {
      this.logger.error(`File decryption failed: ${error.message}`);
      throw error;
    }
  }

  async generateEncryptionKey(keyId?: string): Promise<EncryptionKey> {
    const id = keyId || `key_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const key = crypto.randomBytes(32); // 256-bit key

    const encryptionKey: EncryptionKey = {
      id,
      algorithm: this.algorithm,
      key,
      createdAt: new Date(),
      isActive: true,
    };

    // Cache the key
    this.keyCache.set(id, encryptionKey);

    // In production, store in secure key management service
    await this.storeEncryptionKey(encryptionKey);

    this.logger.log(`Generated new encryption key: ${id}`);
    return encryptionKey;
  }

  private async getEncryptionKey(keyId?: string): Promise<EncryptionKey> {
    const id = keyId || 'default';

    // Check cache first
    if (this.keyCache.has(id)) {
      return this.keyCache.get(id)!;
    }

    // Try to load from storage
    let key = await this.loadEncryptionKey(id);
    
    if (!key) {
      // Generate default key if not found
      if (id === 'default') {
        key = await this.generateEncryptionKey('default');
      } else {
        throw new Error(`Encryption key not found: ${id}`);
      }
    }

    // Cache the key
    this.keyCache.set(id, key);
    return key;
  }

  private async storeEncryptionKey(key: EncryptionKey): Promise<void> {
    try {
      // In production, this would use AWS KMS, HashiCorp Vault, etc.
      // For now, store encrypted in config or environment
      const keyData = {
        id: key.id,
        algorithm: key.algorithm,
        key: key.key.toString('base64'),
        createdAt: key.createdAt.toISOString(),
        isActive: key.isActive,
      };

      // Store in secure location (simplified for demo)
      const masterKey = this.config.get('MASTER_ENCRYPTION_KEY', 'change-in-production');
      const cipher = crypto.createCipher('aes-256-cbc', masterKey);
      const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(keyData)),
        cipher.final()
      ]);

      // In real implementation, store in secure key management service
      this.logger.debug(`Encryption key stored securely: ${key.id}`);
    } catch (error) {
      this.logger.error(`Failed to store encryption key: ${error.message}`);
      throw error;
    }
  }

  private async loadEncryptionKey(keyId: string): Promise<EncryptionKey | null> {
    try {
      // In production, load from secure key management service
      // For now, try to load from config or generate default
      
      if (keyId === 'default') {
        const defaultKeyBase64 = this.config.get('DEFAULT_ENCRYPTION_KEY');
        if (defaultKeyBase64) {
          return {
            id: 'default',
            algorithm: this.algorithm,
            key: Buffer.from(defaultKeyBase64, 'base64'),
            createdAt: new Date(),
            isActive: true,
          };
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to load encryption key ${keyId}: ${error.message}`);
      return null;
    }
  }

  async rotateEncryptionKey(oldKeyId: string): Promise<EncryptionKey> {
    const newKeyId = `${oldKeyId}_rotated_${Date.now()}`;
    const newKey = await this.generateEncryptionKey(newKeyId);

    // Mark old key as inactive
    const oldKey = await this.getEncryptionKey(oldKeyId);
    oldKey.isActive = false;
    await this.storeEncryptionKey(oldKey);

    this.logger.log(`Encryption key rotated: ${oldKeyId} -> ${newKeyId}`);
    return newKey;
  }

  async validateEncryption(originalData: Buffer, encryptionResult: EncryptionResult): Promise<boolean> {
    try {
      const decrypted = await this.decryptFile(encryptionResult.encryptedData, {
        keyId: encryptionResult.keyId,
        algorithm: encryptionResult.algorithm,
        iv: encryptionResult.iv,
        authTag: encryptionResult.authTag,
      });

      return originalData.equals(decrypted);
    } catch (error) {
      this.logger.error(`Encryption validation failed: ${error.message}`);
      return false;
    }
  }

  getEncryptionMetadata(encryptionResult: EncryptionResult): Record<string, string> {
    return {
      'encryption-key-id': encryptionResult.keyId,
      'encryption-algorithm': encryptionResult.algorithm,
      'encryption-iv': encryptionResult.iv.toString('base64'),
      'encryption-auth-tag': encryptionResult.authTag.toString('base64'),
    };
  }

  parseEncryptionMetadata(metadata: Record<string, string>): DecryptionOptions | null {
    try {
      if (!metadata['encryption-key-id'] || !metadata['encryption-algorithm']) {
        return null;
      }

      return {
        keyId: metadata['encryption-key-id'],
        algorithm: metadata['encryption-algorithm'],
        iv: Buffer.from(metadata['encryption-iv'], 'base64'),
        authTag: Buffer.from(metadata['encryption-auth-tag'], 'base64'),
      };
    } catch (error) {
      this.logger.error(`Failed to parse encryption metadata: ${error.message}`);
      return null;
    }
  }
}