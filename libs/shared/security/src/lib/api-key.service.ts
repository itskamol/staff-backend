import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/database';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

export interface ApiKeyData {
  id: string;
  keyId: string;
  hashedKey: string;
  organizationId: number;
  permissions: string[];
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
}

export interface ApiKeyRotationResult {
  oldKeyId: string;
  newKeyId: string;
  newKey: string;
  expiresAt: Date;
  rotationId: string;
}

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);
  private readonly keyLength = 64;
  private readonly saltRounds = 12;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async generateApiKey(
    organizationId: number,
    permissions: string[] = [],
    expiresInDays: number = 365,
  ): Promise<{ keyId: string; key: string; expiresAt: Date }> {
    this.logger.log(`Generating API key for organization ${organizationId}`);

    // Generate cryptographically secure random key
    const key = this.generateSecureKey();
    const keyId = this.generateKeyId();
    const hashedKey = await bcrypt.hash(key, this.saltRounds);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Store in database with encryption
    await this.prisma.apiKey.create({
      data: {
        keyId,
        hashedKey,
        organizationId,
        permissions: JSON.stringify(permissions),
        expiresAt,
        isActive: true,
      },
    });

    // Log provisioning activity
    await this.logActivity('PROVISION', keyId, organizationId, {
      permissions,
      expiresAt,
    });

    this.logger.log(`API key generated successfully: ${keyId}`);

    return { keyId, key, expiresAt };
  }

  private generateSecureKey(): string {
    return crypto.randomBytes(this.keyLength).toString('base64url');
  }

  private generateKeyId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(8).toString('hex');
    return `ak_${timestamp}_${random}`;
  }

  async validateApiKey(keyId: string, key: string): Promise<ApiKeyData | null> {
    try {
      const apiKey = await this.prisma.apiKey.findUnique({
        where: { keyId, isActive: true },
      });

      if (!apiKey) {
        return null;
      }

      // Check expiration
      if (apiKey.expiresAt < new Date()) {
        this.logger.warn(`Expired API key used: ${keyId}`);
        return null;
      }

      // Verify key hash
      const isValid = await bcrypt.compare(key, apiKey.hashedKey);
      if (!isValid) {
        this.logger.warn(`Invalid API key attempted: ${keyId}`);
        return null;
      }

      // Update last used timestamp
      await this.prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      });

      return {
        id: apiKey.id,
        keyId: apiKey.keyId,
        hashedKey: apiKey.hashedKey,
        organizationId: apiKey.organizationId,
        permissions: JSON.parse(apiKey.permissions || '[]'),
        expiresAt: apiKey.expiresAt,
        isActive: apiKey.isActive,
        createdAt: apiKey.createdAt,
        lastUsedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`API key validation failed: ${error.message}`);
      return null;
    }
  }

  async rotateApiKey(keyId: string): Promise<ApiKeyRotationResult> {
    this.logger.log(`Starting API key rotation for: ${keyId}`);

    const existingKey = await this.prisma.apiKey.findUnique({
      where: { keyId },
    });

    if (!existingKey) {
      throw new Error(`API key not found: ${keyId}`);
    }

    // Generate new key
    const newKey = this.generateSecureKey();
    const newKeyId = this.generateKeyId();
    const hashedNewKey = await bcrypt.hash(newKey, this.saltRounds);
    const rotationId = crypto.randomUUID();

    // Start transaction for zero-downtime rotation
    const result = await this.prisma.$transaction(async (tx) => {
      // Create new key
      await tx.apiKey.create({
        data: {
          keyId: newKeyId,
          hashedKey: hashedNewKey,
          organizationId: existingKey.organizationId,
          permissions: existingKey.permissions,
          expiresAt: existingKey.expiresAt,
          isActive: true,
        },
      });

      // Mark old key for rotation (keep active for grace period)
      await tx.apiKey.update({
        where: { id: existingKey.id },
        data: {
          rotationId,
          rotationStartedAt: new Date(),
        },
      });

      // Log rotation activity
      await this.logActivity('ROTATE_START', keyId, existingKey.organizationId, {
        newKeyId,
        rotationId,
      });

      return {
        oldKeyId: keyId,
        newKeyId,
        newKey,
        expiresAt: existingKey.expiresAt,
        rotationId,
      };
    });

    // Schedule old key deactivation (grace period)
    this.scheduleKeyDeactivation(keyId, rotationId);

    this.logger.log(`API key rotation completed: ${keyId} -> ${newKeyId}`);

    return result;
  }

  private scheduleKeyDeactivation(keyId: string, rotationId: string): void {
    const gracePeriodMs = this.config.get('API_KEY_ROTATION_GRACE_PERIOD_MINUTES', 30) * 60 * 1000;

    setTimeout(async () => {
      try {
        await this.prisma.apiKey.update({
          where: { keyId, rotationId },
          data: { isActive: false, rotationCompletedAt: new Date() },
        });

        await this.logActivity('ROTATE_COMPLETE', keyId, null, { rotationId });

        this.logger.log(`API key deactivated after grace period: ${keyId}`);
      } catch (error) {
        this.logger.error(`Failed to deactivate rotated key ${keyId}: ${error.message}`);
      }
    }, gracePeriodMs);
  }

  async revokeApiKey(keyId: string, reason?: string): Promise<void> {
    this.logger.log(`Revoking API key: ${keyId}`);

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyId },
    });

    if (!apiKey) {
      throw new Error(`API key not found: ${keyId}`);
    }

    await this.prisma.apiKey.update({
      where: { keyId },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revocationReason: reason,
      },
    });

    await this.logActivity('REVOKE', keyId, apiKey.organizationId, { reason });

    this.logger.log(`API key revoked: ${keyId}`);
  }

  async listApiKeys(organizationId: number): Promise<Omit<ApiKeyData, 'hashedKey'>[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map(key => ({
      id: key.id,
      keyId: key.keyId,
      hashedKey: '[REDACTED]',
      organizationId: key.organizationId,
      permissions: JSON.parse(key.permissions || '[]'),
      expiresAt: key.expiresAt,
      isActive: key.isActive,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
    }));
  }

  async getExpiringKeys(daysUntilExpiry: number = 30): Promise<ApiKeyData[]> {
    const expiryThreshold = new Date();
    expiryThreshold.setDate(expiryThreshold.getDate() + daysUntilExpiry);

    const keys = await this.prisma.apiKey.findMany({
      where: {
        isActive: true,
        expiresAt: {
          lte: expiryThreshold,
        },
      },
    });

    return keys.map(key => ({
      id: key.id,
      keyId: key.keyId,
      hashedKey: key.hashedKey,
      organizationId: key.organizationId,
      permissions: JSON.parse(key.permissions || '[]'),
      expiresAt: key.expiresAt,
      isActive: key.isActive,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
    }));
  }

  async scheduleAutomaticRotation(): Promise<void> {
    this.logger.log('Starting automatic API key rotation check');

    const expiringKeys = await this.getExpiringKeys(7); // 7 days before expiry

    for (const key of expiringKeys) {
      try {
        await this.rotateApiKey(key.keyId);
        this.logger.log(`Automatically rotated expiring key: ${key.keyId}`);
      } catch (error) {
        this.logger.error(`Failed to auto-rotate key ${key.keyId}: ${error.message}`);
      }
    }
  }

  private async logActivity(
    action: string,
    keyId: string,
    organizationId: number | null,
    metadata: any = {},
  ): Promise<void> {
    try {
      await this.prisma.apiKeyAuditLog.create({
        data: {
          action,
          keyId,
          organizationId,
          metadata: JSON.stringify(metadata),
          timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log API key activity: ${error.message}`);
    }
  }
}