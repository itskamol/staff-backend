import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import { AppLoggerService } from '../logger/logger.service';

export interface CacheOptions {
    ttl?: number; // Time to live in seconds
    prefix?: string;
}

export interface CacheStats {
    hits: number;
    misses: number;
    keys: number;
    memory: number;
}

@Injectable()
export class CacheService implements OnModuleDestroy {
    private cache = new Map<string, { value: any; expiry: number }>();
    private stats = { hits: 0, misses: 0 };
    private cleanupInterval: NodeJS.Timeout;

    constructor(
        private readonly configService: AppConfigService,
        private readonly logger: AppLoggerService
    ) {
        this.logger.setContext('CacheService');

        // Cleanup expired entries every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
    }

    onModuleDestroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }

    async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
        const fullKey = this.buildKey(key, options?.prefix);
        const entry = this.cache.get(fullKey);

        if (!entry) {
            this.stats.misses++;
            this.logger.debug(`Cache miss for key: ${fullKey}`);
            return null;
        }

        if (Date.now() > entry.expiry) {
            this.cache.delete(fullKey);
            this.stats.misses++;
            this.logger.debug(`Cache expired for key: ${fullKey}`);
            return null;
        }

        this.stats.hits++;
        this.logger.debug(`Cache hit for key: ${fullKey}`);
        return entry.value;
    }

    async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
        const fullKey = this.buildKey(key, options?.prefix);
        const ttl = options?.ttl || 3600; // Default 1 hour
        const expiry = Date.now() + ttl * 1000;

        this.cache.set(fullKey, { value, expiry });
        this.logger.debug(`Cache set for key: ${fullKey}, TTL: ${ttl}s`);
    }

    async del(key: string, options?: CacheOptions): Promise<boolean> {
        const fullKey = this.buildKey(key, options?.prefix);
        const deleted = this.cache.delete(fullKey);

        if (deleted) {
            this.logger.debug(`Cache deleted for key: ${fullKey}`);
        }

        return deleted;
    }

    async exists(key: string, options?: CacheOptions): Promise<boolean> {
        const fullKey = this.buildKey(key, options?.prefix);
        const entry = this.cache.get(fullKey);

        if (!entry) return false;

        if (Date.now() > entry.expiry) {
            this.cache.delete(fullKey);
            return false;
        }

        return true;
    }

    async clear(prefix?: string): Promise<void> {
        if (prefix) {
            const keysToDelete: string[] = [];
            for (const key of this.cache.keys()) {
                if (key.startsWith(prefix)) {
                    keysToDelete.push(key);
                }
            }
            keysToDelete.forEach(key => this.cache.delete(key));
            this.logger.debug(`Cache cleared for prefix: ${prefix}`);
        } else {
            this.cache.clear();
            this.logger.debug('Cache cleared completely');
        }
    }

    async getOrSet<T>(key: string, factory: () => Promise<T>, options?: CacheOptions): Promise<T> {
        const cached = await this.get<T>(key, options);

        if (cached !== null) {
            return cached;
        }

        const value = await factory();
        await this.set(key, value, options);
        return value;
    }

    async mget<T>(keys: string[], options?: CacheOptions): Promise<(T | null)[]> {
        return Promise.all(keys.map(key => this.get<T>(key, options)));
    }

    async mset<T>(
        entries: Array<{ key: string; value: T }>,
        options?: CacheOptions
    ): Promise<void> {
        await Promise.all(entries.map(entry => this.set(entry.key, entry.value, options)));
    }

    async increment(key: string, delta = 1, options?: CacheOptions): Promise<number> {
        const current = (await this.get<number>(key, options)) || 0;
        const newValue = current + delta;
        await this.set(key, newValue, options);
        return newValue;
    }

    async decrement(key: string, delta = 1, options?: CacheOptions): Promise<number> {
        return this.increment(key, -delta, options);
    }

    getStats(): CacheStats {
        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            keys: this.cache.size,
            memory: this.calculateMemoryUsage(),
        };
    }

    getHitRate(): number {
        const total = this.stats.hits + this.stats.misses;
        return total > 0 ? (this.stats.hits / total) * 100 : 0;
    }

    // User-specific cache methods
    async getUserCache<T>(userId: number, key: string, options?: CacheOptions): Promise<T | null> {
        return this.get<T>(`user:${userId}:${key}`, options);
    }

    async setUserCache<T>(
        userId: number,
        key: string,
        value: T,
        options?: CacheOptions
    ): Promise<void> {
        return this.set(`user:${userId}:${key}`, value, options);
    }

    async clearUserCache(userId: number): Promise<void> {
        return this.clear(`user:${userId}:`);
    }

    // Session cache methods
    async getSessionCache<T>(
        sessionId: string,
        key: string,
        options?: CacheOptions
    ): Promise<T | null> {
        return this.get<T>(`session:${sessionId}:${key}`, options);
    }

    async setSessionCache<T>(
        sessionId: string,
        key: string,
        value: T,
        options?: CacheOptions
    ): Promise<void> {
        return this.set(`session:${sessionId}:${key}`, value, options);
    }

    async clearSessionCache(sessionId: string): Promise<void> {
        return this.clear(`session:${sessionId}:`);
    }

    private buildKey(key: string, prefix?: string): string {
        const appPrefix = 'staff-control';
        return prefix ? `${appPrefix}:${prefix}:${key}` : `${appPrefix}:${key}`;
    }

    private cleanup(): void {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiry) {
                this.cache.delete(key);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            this.logger.debug(`Cache cleanup: removed ${cleanedCount} expired entries`);
        }
    }

    private calculateMemoryUsage(): number {
        // Rough estimation of memory usage
        let size = 0;
        for (const [key, entry] of this.cache.entries()) {
            size += key.length * 2; // String characters are 2 bytes each
            size += JSON.stringify(entry.value).length * 2;
            size += 8; // expiry timestamp
        }
        return size;
    }
}
