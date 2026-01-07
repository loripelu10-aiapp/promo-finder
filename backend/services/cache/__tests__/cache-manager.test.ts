/**
 * Cache Manager Tests
 * Comprehensive tests for multi-layer caching
 */

import { PrismaClient } from '@prisma/client';
import { CacheManager } from '../cache-manager';
import { L1MemoryCache } from '../l1-memory';
import { L2RedisCache } from '../l2-redis';

// Mock Prisma
jest.mock('@prisma/client');

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;

    cacheManager = new CacheManager(
      {
        l1: {
          maxSize: 100,
          ttl: 5000, // 5 seconds
        },
        l2: {
          url: 'redis://localhost:6379',
          ttl: 300,
          enabled: false, // Disable Redis for unit tests
        },
        l3: {
          refreshInterval: 60000,
          enabled: false, // Disable L3 for unit tests
        },
      },
      mockPrisma
    );
  });

  describe('generateKey', () => {
    it('should generate cache key without params', () => {
      const key = cacheManager.generateKey({
        service: 'deals',
        entity: 'products',
        identifier: 'list',
      });

      expect(key).toBe('deals:products:list');
    });

    it('should generate cache key with params', () => {
      const key = cacheManager.generateKey({
        service: 'deals',
        entity: 'products',
        identifier: 'list',
        params: { category: 'shoes', brand: 'Nike' },
      });

      expect(key).toContain('deals:products:list:');
      expect(key.split(':').length).toBe(4);
    });

    it('should generate consistent keys for same params', () => {
      const params = { category: 'shoes', brand: 'Nike' };

      const key1 = cacheManager.generateKey({
        service: 'deals',
        entity: 'products',
        identifier: 'list',
        params,
      });

      const key2 = cacheManager.generateKey({
        service: 'deals',
        entity: 'products',
        identifier: 'list',
        params,
      });

      expect(key1).toBe(key2);
    });
  });

  describe('get and set', () => {
    it('should cache and retrieve data in L1', async () => {
      const key = 'test:key:1';
      const data = { id: 1, name: 'Test Product' };

      await cacheManager.set(key, data);
      const result = await cacheManager.get(key);

      expect(result.hit).toBe(true);
      expect(result.layer).toBe('l1');
      expect(result.data).toEqual(data);
    });

    it('should return cache miss for non-existent key', async () => {
      const result = await cacheManager.get('non:existent:key');

      expect(result.hit).toBe(false);
      expect(result.data).toBeNull();
    });

    it('should handle TTL expiration', async () => {
      const key = 'test:expiring:1';
      const data = { id: 1 };

      await cacheManager.set(key, data, 1); // 1 second TTL

      // Should be cached immediately
      let result = await cacheManager.get(key);
      expect(result.hit).toBe(true);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be expired
      result = await cacheManager.get(key);
      expect(result.hit).toBe(false);
    });
  });

  describe('getOrCompute', () => {
    it('should compute and cache on miss', async () => {
      const key = 'test:compute:1';
      let computeCalled = false;

      const result = await cacheManager.getOrCompute(key, async () => {
        computeCalled = true;
        return { computed: true };
      });

      expect(computeCalled).toBe(true);
      expect(result.hit).toBe(false);
      expect(result.data).toEqual({ computed: true });

      // Second call should hit cache
      computeCalled = false;
      const result2 = await cacheManager.getOrCompute(key, async () => {
        computeCalled = true;
        return { computed: true };
      });

      expect(computeCalled).toBe(false);
      expect(result2.hit).toBe(true);
    });
  });

  describe('getMultiple and setMultiple', () => {
    it('should get multiple values', async () => {
      const keys = ['test:multi:1', 'test:multi:2', 'test:multi:3'];
      const values = [{ id: 1 }, { id: 2 }, { id: 3 }];

      // Set multiple
      await cacheManager.setMultiple(
        keys.map((key, index) => ({ key, value: values[index] }))
      );

      // Get multiple
      const results = await cacheManager.getMultiple(keys);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ id: 1 });
      expect(results[1]).toEqual({ id: 2 });
      expect(results[2]).toEqual({ id: 3 });
    });

    it('should return null for missing keys', async () => {
      const results = await cacheManager.getMultiple([
        'missing:1',
        'missing:2',
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]).toBeNull();
      expect(results[1]).toBeNull();
    });
  });

  describe('invalidatePattern', () => {
    it('should invalidate keys matching pattern', async () => {
      // Set multiple keys
      await cacheManager.set('deals:product:1', { id: 1 });
      await cacheManager.set('deals:product:2', { id: 2 });
      await cacheManager.set('deals:category:shoes', { name: 'shoes' });

      // Invalidate product keys
      const count = await cacheManager.invalidatePattern('deals:product:*');

      expect(count).toBeGreaterThan(0);

      // Product keys should be invalidated
      const result1 = await cacheManager.get('deals:product:1');
      expect(result1.hit).toBe(false);

      // Category key should still exist
      const result2 = await cacheManager.get('deals:category:shoes');
      expect(result2.hit).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear all cache', async () => {
      await cacheManager.set('test:1', { id: 1 });
      await cacheManager.set('test:2', { id: 2 });

      await cacheManager.clear();

      const result1 = await cacheManager.get('test:1');
      const result2 = await cacheManager.get('test:2');

      expect(result1.hit).toBe(false);
      expect(result2.hit).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      // Generate some cache activity
      await cacheManager.set('test:1', { id: 1 });
      await cacheManager.get('test:1'); // Hit
      await cacheManager.get('test:2'); // Miss

      const stats = await cacheManager.getStats();

      expect(stats).toHaveProperty('l1');
      expect(stats).toHaveProperty('l2');
      expect(stats).toHaveProperty('l3');
      expect(stats).toHaveProperty('overall');

      expect(stats.l1.hits).toBeGreaterThan(0);
      expect(stats.l1.misses).toBeGreaterThan(0);
    });
  });

  describe('getHealth', () => {
    it('should return health status', async () => {
      const health = await cacheManager.getHealth();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('l1');
      expect(health).toHaveProperty('l2');
      expect(health).toHaveProperty('l3');
      expect(health).toHaveProperty('timestamp');
    });
  });
});

describe('L1MemoryCache', () => {
  let cache: L1MemoryCache;

  beforeEach(() => {
    cache = new L1MemoryCache({
      maxSize: 3,
      ttl: 5000,
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used item when full', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Cache is now full (size 3)
      // Add one more item
      cache.set('key4', 'value4');

      // key1 (least recently used) should be evicted
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });

    it('should update access order on get', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Access key1 to make it recently used
      cache.get('key1');

      // Add new item
      cache.set('key4', 'value4');

      // key2 should be evicted (now least recently used)
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });
  });

  describe('deletePattern', () => {
    it('should delete keys matching pattern', () => {
      cache.set('user:1', { id: 1 });
      cache.set('user:2', { id: 2 });
      cache.set('product:1', { id: 1 });

      const deleted = cache.deletePattern('user:*');

      expect(deleted).toBe(2);
      expect(cache.has('user:1')).toBe(false);
      expect(cache.has('user:2')).toBe(false);
      expect(cache.has('product:1')).toBe(true);
    });
  });

  describe('stats', () => {
    it('should track hits and misses', () => {
      cache.set('key1', 'value1');

      cache.get('key1'); // Hit
      cache.get('key2'); // Miss

      const stats = cache.getStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(50);
    });

    it('should track evictions', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4'); // Triggers eviction

      const stats = cache.getStats();

      expect(stats.evictions).toBe(1);
    });
  });
});
