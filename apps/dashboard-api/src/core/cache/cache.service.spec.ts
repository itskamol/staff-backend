import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { AppConfigService } from '../config/config.service';
import { AppLoggerService } from '../logger/logger.service';

describe('CacheService', () => {
  let service: CacheService;

  const mockConfigService = {
    isDevelopment: true,
  };

  const mockLoggerService = {
    setContext: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: AppConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AppLoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get and set', () => {
    it('should set and get a value', async () => {
      const key = 'test-key';
      const value = { data: 'test-data' };

      await service.set(key, value);
      const result = await service.get(key);

      expect(result).toEqual(value);
    });

    it('should return null for non-existent key', async () => {
      const result = await service.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should respect TTL', async () => {
      const key = 'ttl-test';
      const value = 'test-value';

      await service.set(key, value, { ttl: 1 }); // 1 second TTL
      
      // Should exist immediately
      let result = await service.get(key);
      expect(result).toBe(value);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      result = await service.get(key);
      expect(result).toBeNull();
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const key = 'cached-key';
      const cachedValue = 'cached-data';
      const factoryValue = 'factory-data';

      await service.set(key, cachedValue);

      const factory = jest.fn().mockResolvedValue(factoryValue);
      const result = await service.getOrSet(key, factory);

      expect(result).toBe(cachedValue);
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result if not exists', async () => {
      const key = 'new-key';
      const factoryValue = 'factory-data';

      const factory = jest.fn().mockResolvedValue(factoryValue);
      const result = await service.getOrSet(key, factory);

      expect(result).toBe(factoryValue);
      expect(factory).toHaveBeenCalled();

      // Verify it was cached
      const cachedResult = await service.get(key);
      expect(cachedResult).toBe(factoryValue);
    });
  });

  describe('user cache methods', () => {
    it('should handle user-specific cache', async () => {
      const userId = 123;
      const key = 'user-data';
      const value = { name: 'John Doe' };

      await service.setUserCache(userId, key, value);
      const result = await service.getUserCache(userId, key);

      expect(result).toEqual(value);
    });

    it('should clear user cache', async () => {
      const userId = 123;
      
      await service.setUserCache(userId, 'key1', 'value1');
      await service.setUserCache(userId, 'key2', 'value2');
      
      await service.clearUserCache(userId);
      
      const result1 = await service.getUserCache(userId, 'key1');
      const result2 = await service.getUserCache(userId, 'key2');
      
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe('stats', () => {
    it('should track cache statistics', async () => {
      // Reset stats
      await service.clear();
      
      const key = 'stats-test';
      const value = 'test-value';

      // Miss
      await service.get('non-existent');
      
      // Set and hit
      await service.set(key, value);
      await service.get(key);

      const stats = service.getStats();
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);
      expect(stats.keys).toBeGreaterThan(0);
    });

    it('should calculate hit rate', async () => {
      await service.clear();
      
      // 1 miss, 2 hits
      await service.get('non-existent');
      await service.set('key', 'value');
      await service.get('key');
      await service.get('key');

      const hitRate = service.getHitRate();
      expect(hitRate).toBeCloseTo(66.67, 1); // 2/3 * 100
    });
  });
});