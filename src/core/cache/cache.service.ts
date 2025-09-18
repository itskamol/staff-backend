import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RedisClientType, RedisFunctions, RedisModules, RedisScripts, createClient } from 'redis';
import { ConfigService } from '../config/config.service';
import { LoggerService } from '../logger';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
    private client: RedisClientType<RedisModules, RedisFunctions, RedisScripts>;

    constructor(
        private readonly configService: ConfigService,
        private readonly logger: LoggerService
    ) {
        this.client = createClient({
            url: this.configService.redisUrl,
        });

        this.client.on('error', error => {
            this.logger.error('Redis connection error', error.message, {
                module: 'cache-service',
                error: error.message,
            });
        });

        this.client.on('connect', () => {
            this.logger.log('Redis connected successfully', {
                module: 'cache-service',
            });
        });
    }

    async onModuleInit() {
        await this.client.connect();
    }

    async onModuleDestroy() {
        await this.client.disconnect();
    }

    /**
     * Set a key-value pair with optional expiration
     */
    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        try {
            if (ttlSeconds) {
                await this.client.setEx(key, ttlSeconds, value);
            } else {
                await this.client.set(key, value);
            }
        } catch (error) {
            this.logger.error('Redis SET operation failed', error.message, {
                key,
                module: 'cache-service',
            });
            throw error;
        }
    }

    /**
     * Get a value by key
     */
    async get(key: string): Promise<string | null> {
        try {
            const result = await this.client.get(key);
            return result as string | null;
        } catch (error) {
            this.logger.error('Redis GET operation failed', error.message, {
                key,
                module: 'cache-service',
            });
            throw error;
        }
    }

    /**
     * Delete a key
     */
    async del(key: string): Promise<void> {
        try {
            await this.client.del(key);
        } catch (error) {
            this.logger.error('Redis DEL operation failed', error.message, {
                key,
                module: 'cache-service',
            });
            throw error;
        }
    }

    /**
     * Check if a key exists
     */
    async exists(key: string): Promise<boolean> {
        try {
            const result = await this.client.exists(key);
            return result === 1;
        } catch (error) {
            this.logger.error('Redis EXISTS operation failed', error.message, {
                key,
                module: 'cache-service',
            });
            throw error;
        }
    }

    /**
     * Set a key with NX (only if not exists) and EX (expiration)
     */
    async setNX(key: string, value: string, ttlSeconds: number): Promise<boolean> {
        try {
            const result = await this.client.set(key, value, {
                NX: true,
                EX: ttlSeconds,
            });
            return result === 'OK';
        } catch (error) {
            this.logger.error('Redis SETNX operation failed', error.message, {
                key,
                module: 'cache-service',
            });
            throw error;
        }
    }

    /**
     * Add refresh token to denylist
     */
    async denyRefreshToken(tokenId: string, expirationTime: number): Promise<void> {
        const key = `refresh_token_denylist:${tokenId}`;
        const ttl = Math.max(0, expirationTime - Math.floor(Date.now() / 1000));

        if (ttl > 0) {
            await this.set(key, 'denied', ttl);
        }
    }

    /**
     * Check if refresh token is denied
     */
    async isRefreshTokenDenied(tokenId: string): Promise<boolean> {
        const key = `refresh_token_denylist:${tokenId}`;
        return await this.exists(key);
    }

    /**
     * Store idempotency response
     */
    async setIdempotencyResponse(
        key: string,
        response: any,
        ttlSeconds: number = 86400
    ): Promise<void> {
        const cacheKey = `idempotency:response:${key}`;
        await this.set(cacheKey, JSON.stringify(response), ttlSeconds);
    }

    /**
     * Get idempotency response
     */
    async getIdempotencyResponse(key: string): Promise<any | null> {
        const cacheKey = `idempotency:response:${key}`;
        const response = await this.get(cacheKey);
        return response ? JSON.parse(response) : null;
    }

    /**
     * Set idempotency lock
     */
    async setIdempotencyLock(key: string, ttlSeconds: number = 60): Promise<boolean> {
        const lockKey = `idempotency:lock:${key}`;
        return await this.setNX(lockKey, 'locked', ttlSeconds);
    }

    /**
     * Remove idempotency lock
     */
    async removeIdempotencyLock(key: string): Promise<void> {
        const lockKey = `idempotency:lock:${key}`;
        await this.del(lockKey);
    }

    /**
     * Generic cache operations for application data
     */
    async cacheData(key: string, data: any, ttlSeconds: number = 3600): Promise<void> {
        await this.set(key, JSON.stringify(data), ttlSeconds);
    }

    async getCachedData<T>(key: string): Promise<T | null> {
        const data = await this.get(key);
        return data ? JSON.parse(data) : null;
    }

    async invalidateCache(pattern: string): Promise<void> {
        // Note: In production, you might want to use SCAN instead of KEYS for better performance
        try {
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(keys);
            }
        } catch (error) {
            this.logger.error('Cache invalidation failed', error.message, {
                pattern,
                module: 'cache-service',
            });
            throw error;
        }
    }
}
