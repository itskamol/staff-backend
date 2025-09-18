import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { ConfigService } from '../config/config.service';
import { LoggerService } from '../logger';

// Mock Redis client
const mockRedisClient = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    set: jest.fn(),
    setEx: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    keys: jest.fn(),
};

// Mock createClient
jest.mock('redis', () => ({
    createClient: jest.fn(() => mockRedisClient),
}));

describe('CacheService', () => {
    let service: CacheService;

    const mockConfigService = {
        redisUrl: 'redis://localhost:6379',
    };

    const mockLogger = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CacheService,
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
                {
                    provide: LoggerService,
                    useValue: mockLogger,
                },
            ],
        }).compile();

        service = module.get<CacheService>(CacheService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('onModuleInit', () => {
        it('should connect to Redis', async () => {
            await service.onModuleInit();
            expect(mockRedisClient.connect).toHaveBeenCalled();
        });
    });

    describe('onModuleDestroy', () => {
        it('should disconnect from Redis', async () => {
            await service.onModuleDestroy();
            expect(mockRedisClient.disconnect).toHaveBeenCalled();
        });
    });

    describe('set', () => {
        it('should set key-value without TTL', async () => {
            mockRedisClient.set.mockResolvedValue('OK');

            await service.set('test-key', 'test-value');

            expect(mockRedisClient.set).toHaveBeenCalledWith('test-key', 'test-value');
        });

        it('should set key-value with TTL', async () => {
            mockRedisClient.setEx.mockResolvedValue('OK');

            await service.set('test-key', 'test-value', 3600);

            expect(mockRedisClient.setEx).toHaveBeenCalledWith('test-key', 3600, 'test-value');
        });

        it('should handle Redis errors', async () => {
            const error = new Error('Redis connection failed');
            mockRedisClient.set.mockRejectedValue(error);

            await expect(service.set('test-key', 'test-value')).rejects.toThrow(error);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Redis SET operation failed',
                'Redis connection failed',
                expect.objectContaining({
                    key: 'test-key',
                    module: 'cache-service',
                })
            );
        });
    });

    describe('get', () => {
        it('should get value by key', async () => {
            mockRedisClient.get.mockResolvedValue('test-value');

            const result = await service.get('test-key');

            expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
            expect(result).toBe('test-value');
        });

        it('should return null when key does not exist', async () => {
            mockRedisClient.get.mockResolvedValue(null);

            const result = await service.get('nonexistent-key');

            expect(result).toBeNull();
        });

        it('should handle Redis errors', async () => {
            const error = new Error('Redis connection failed');
            mockRedisClient.get.mockRejectedValue(error);

            await expect(service.get('test-key')).rejects.toThrow(error);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Redis GET operation failed',
                'Redis connection failed',
                expect.objectContaining({
                    key: 'test-key',
                    module: 'cache-service',
                })
            );
        });
    });

    describe('del', () => {
        it('should delete key', async () => {
            mockRedisClient.del.mockResolvedValue(1);

            await service.del('test-key');

            expect(mockRedisClient.del).toHaveBeenCalledWith('test-key');
        });
    });

    describe('exists', () => {
        it('should return true when key exists', async () => {
            mockRedisClient.exists.mockResolvedValue(1);

            const result = await service.exists('test-key');

            expect(mockRedisClient.exists).toHaveBeenCalledWith('test-key');
            expect(result).toBe(true);
        });

        it('should return false when key does not exist', async () => {
            mockRedisClient.exists.mockResolvedValue(0);

            const result = await service.exists('test-key');

            expect(result).toBe(false);
        });
    });

    describe('setNX', () => {
        it('should set key with NX and EX when key does not exist', async () => {
            mockRedisClient.set.mockResolvedValue('OK');

            const result = await service.setNX('test-key', 'test-value', 3600);

            expect(mockRedisClient.set).toHaveBeenCalledWith('test-key', 'test-value', {
                NX: true,
                EX: 3600,
            });
            expect(result).toBe(true);
        });

        it('should return false when key already exists', async () => {
            mockRedisClient.set.mockResolvedValue(null);

            const result = await service.setNX('test-key', 'test-value', 3600);

            expect(result).toBe(false);
        });
    });

    describe('denyRefreshToken', () => {
        it('should add refresh token to denylist with TTL', async () => {
            const tokenId = 'user-123:1';
            const expirationTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

            mockRedisClient.setEx.mockResolvedValue('OK');

            await service.denyRefreshToken(tokenId, expirationTime);

            expect(mockRedisClient.setEx).toHaveBeenCalledWith(
                `refresh_token_denylist:${tokenId}`,
                expect.any(Number),
                'denied'
            );
        });

        it('should not set TTL for expired tokens', async () => {
            const tokenId = 'user-123:1';
            const expirationTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

            await service.denyRefreshToken(tokenId, expirationTime);

            expect(mockRedisClient.setEx).not.toHaveBeenCalled();
            expect(mockRedisClient.set).not.toHaveBeenCalled();
        });
    });

    describe('isRefreshTokenDenied', () => {
        it('should return true when token is denied', async () => {
            mockRedisClient.exists.mockResolvedValue(1);

            const result = await service.isRefreshTokenDenied('user-123:1');

            expect(mockRedisClient.exists).toHaveBeenCalledWith(
                'refresh_token_denylist:user-123:1'
            );
            expect(result).toBe(true);
        });

        it('should return false when token is not denied', async () => {
            mockRedisClient.exists.mockResolvedValue(0);

            const result = await service.isRefreshTokenDenied('user-123:1');

            expect(result).toBe(false);
        });
    });

    describe('idempotency operations', () => {
        it('should set and get idempotency response', async () => {
            const response = { status: 202, message: 'Accepted' };
            mockRedisClient.setEx.mockResolvedValue('OK');
            mockRedisClient.get.mockResolvedValue(JSON.stringify(response));

            await service.setIdempotencyResponse('test-key', response);
            const result = await service.getIdempotencyResponse('test-key');

            expect(mockRedisClient.setEx).toHaveBeenCalledWith(
                'idempotency:response:test-key',
                86400,
                JSON.stringify(response)
            );
            expect(result).toEqual(response);
        });

        it('should set idempotency lock', async () => {
            mockRedisClient.set.mockResolvedValue('OK');

            const result = await service.setIdempotencyLock('test-key');

            expect(mockRedisClient.set).toHaveBeenCalledWith(
                'idempotency:lock:test-key',
                'locked',
                {
                    NX: true,
                    EX: 60,
                }
            );
            expect(result).toBe(true);
        });

        it('should remove idempotency lock', async () => {
            mockRedisClient.del.mockResolvedValue(1);

            await service.removeIdempotencyLock('test-key');

            expect(mockRedisClient.del).toHaveBeenCalledWith('idempotency:lock:test-key');
        });
    });

    describe('cache data operations', () => {
        it('should cache and retrieve data', async () => {
            const data = { id: 1, name: 'Test' };
            mockRedisClient.setEx.mockResolvedValue('OK');
            mockRedisClient.get.mockResolvedValue(JSON.stringify(data));

            await service.cacheData('test-key', data);
            const result = await service.getCachedData('test-key');

            expect(mockRedisClient.setEx).toHaveBeenCalledWith(
                'test-key',
                3600,
                JSON.stringify(data)
            );
            expect(result).toEqual(data);
        });

        it('should return null for non-existent cached data', async () => {
            mockRedisClient.get.mockResolvedValue(null);

            const result = await service.getCachedData('nonexistent-key');

            expect(result).toBeNull();
        });
    });

    describe('invalidateCache', () => {
        it('should invalidate cache by pattern', async () => {
            const keys = ['cache:user:1', 'cache:user:2'];
            mockRedisClient.keys.mockResolvedValue(keys);
            mockRedisClient.del.mockResolvedValue(2);

            await service.invalidateCache('cache:user:*');

            expect(mockRedisClient.keys).toHaveBeenCalledWith('cache:user:*');
            expect(mockRedisClient.del).toHaveBeenCalledWith(keys);
        });

        it('should handle empty key list', async () => {
            mockRedisClient.keys.mockResolvedValue([]);

            await service.invalidateCache('cache:user:*');

            expect(mockRedisClient.keys).toHaveBeenCalledWith('cache:user:*');
            expect(mockRedisClient.del).not.toHaveBeenCalled();
        });
    });
});
