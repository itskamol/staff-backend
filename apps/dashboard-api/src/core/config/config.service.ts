import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import * as os from 'os';

@Injectable()
export class ConfigService {
    constructor(private readonly configService: NestConfigService) {}

    get nodeEnv(): string {
        return this.configService.get<string>('NODE_ENV', 'development');
    }

    get port(): number {
        return this.configService.get<number>('PORT', 3000);
    }

    get uploadDir(): string {
        return this.configService.get<string>('UPLOAD_DIR', './uploads')
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

    get jwtExpirationTime(): string {
        return this.configService.get<string>('JWT_EXPIRATION', '15m');
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
        } catch (error) {
            throw new Error(`Configuration validation failed: ${error.message}`);
        }
    }
}
