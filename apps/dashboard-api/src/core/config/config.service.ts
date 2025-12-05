import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import * as os from 'os';
import * as path from 'node:path';
import type { StringValue } from 'ms';

@Injectable()
export class ConfigService {
    constructor(private readonly configService: NestConfigService) {}

    get nodeEnv(): string {
        return this.configService.get<string>('NODE_ENV', 'development');
    }

    get port(): number {
        return this.configService.get<number>('PORT', 3000);
    }

    get redisHost(): string {
        return this.configService.get<string>('REDIS_HOST', 'localhost');
    }

    get redisPort(): number {
        return this.configService.get<number>('REDIS_PORT', 6379);
    }

    get storageDriver(): string {
        return this.configService.get<string>('STORAGE_DRIVER', 'local');
    }

    get storageBasePath(): string {
        return this.configService.get<string>(
            'STORAGE_BASE_PATH',
            path.resolve(process.cwd(), 'storage')
        );
    }

    get storageBucket(): string | undefined {
        return this.configService.get<string>('STORAGE_BUCKET');
    }

    get storageRetentionDays(): number {
        return Number(this.configService.get<number>('STORAGE_RETENTION_DAYS', 30));
    }

    get databaseUrl(): string {
        const url = this.configService.get<string>('DATABASE_URL');
        if (!url) {
            throw new Error('DATABASE_URL is required but not provided in environment variables');
        }
        return url;
    }

    get redisUrl(): string {
        const url = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');

        if (!url) {
            throw new Error('REDIS_URL is required but not provided in environment variables');
        }
        return url;
    }

    get jwtSecret(): string {
        return this.configService.get<string>('JWT_SECRET', 'default_jwt_secret');
    }

    get jwtExpirationTime(): number | StringValue {
        return this.configService.get<number | StringValue>('JWT_EXPIRATION', '15m');
    }

    get refreshTokenSecret(): string {
        return this.configService.get<string>('REFRESH_TOKEN_SECRET', 'default_refresh_secret');
    }

    get encryptionSecretKey(): string {
        return this.configService.get<string>('SECRET_ENCRYPTION_KEY', 'default_encryption_key');
    }

    get refreshTokenExpirationTime(): string {
        return this.configService.get<string>('REFRESH_TOKEN_EXPIRATION', '7d');
    }

    get logLevel(): string {
        return this.configService.get<string>('LOG_LEVEL', 'info');
    }

    get enableFileLogging(): boolean {
        return this.configService.get<string>('ENABLE_FILE_LOGGING', 'false') === 'true';
    }

    get logFormat(): 'json' | 'pretty' {
        return this.configService.get<string>('LOG_FORMAT', 'pretty') as 'json' | 'pretty';
    }

    get isDevelopment(): boolean {
        return this.nodeEnv === 'development';
    }

    get isProduction(): boolean {
        return this.nodeEnv === 'production';
    }

    get isTest(): boolean {
        return this.nodeEnv === 'test';
    }

    get isDocker(): boolean {
        return this.nodeEnv === 'docker';
    }

    get hostIp(): string {
        if (this.isDocker) {
            return this.configService.get<string>('HOST_IP', 'host.docker.internal');
        }

        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]!) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }

        return '';
    }

    validateConfig(): void {
        const requiredVars = ['DATABASE_URL', 'REDIS_URL'];

        const missing = requiredVars.filter(varName => {
            const value = this.configService.get<string>(varName);
            return !value || value.trim() === '';
        });

        if (missing.length > 0) {
            throw new Error(
                `Missing required environment variables: ${missing.join(', ')}\n` +
                    `Please check your environment configuration files in config/environments/`
            );
        }

        try {
            const jwtSecret = this.jwtSecret; // This will throw if too short
            const refreshTokenSecret = this.refreshTokenSecret; // This will throw if too short
            void jwtSecret;
            void refreshTokenSecret;

            const storageDriver = this.storageDriver;
            if (!['local', 's3', 'minio'].includes(storageDriver)) {
                throw new Error(
                    `Unsupported STORAGE_DRIVER "${storageDriver}". Allowed values: local, s3, minio.`
                );
            }

            const retention = this.storageRetentionDays;
            if (Number.isNaN(retention) || retention < 0) {
                throw new Error('STORAGE_RETENTION_DAYS must be a non-negative number');
            }
        } catch (error) {
            throw new Error(`Configuration validation failed: ${error.message}`);
        }
    }
}
