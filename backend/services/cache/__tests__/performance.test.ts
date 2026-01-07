/**
 * Performance Benchmarks
 * Tests to ensure <100ms response times and >95% cache hit rates
 */

import { PrismaClient } from '@prisma/client';
import { CacheManager } from '../cache-manager';
import { MetricsTracker } from '../metrics';
import { QueryOptimizer } from '../query-optimizer';
import { BatchProcessor } from '../batch-processor';

jest.mock('@prisma/client');

describe('Performance Benchmarks', () => {
  let cacheManager: CacheManager;
  let metricsTracker: MetricsTracker;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;

    cacheManager = new CacheManager(
      {
        l1: { maxSize: 1000, ttl: 300000 },
        l2: { enabled: false },
        l3: { enabled: false },
      },
      mockPrisma
    );

    metricsTracker = new MetricsTracker();
  });

  describe('Cache Performance', () => {
    it('should achieve <10ms L1 cache response time', async () => {
      const key = 'test:performance:1';
      const data = { id: 1, name: 'Test Product' };

      // Set in cache
      await cacheManager.set(key, data);

      // Measure get performance
      const iterations = 1000;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await cacheManager.get(key);
      }

      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / iterations;

      console.log(`L1 Cache - Avg response time: ${avgTime.toFixed(2)}ms`);

      expect(avgTime).toBeLessThan(10);
    });

    it('should handle 1000+ concurrent requests', async () => {
      const key = 'test:concurrent:1';
      const data = { id: 1 };

      await cacheManager.set(key, data);

      const concurrentRequests = 1000;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentRequests }, () =>
        cacheManager.get(key)
      );

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      console.log(`Concurrent Requests: ${concurrentRequests} in ${totalTime}ms`);
      console.log(`Throughput: ${Math.round((concurrentRequests / totalTime) * 1000)} req/sec`);

      expect(results.every((r) => r.hit)).toBe(true);
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should maintain >95% cache hit rate under load', async () => {
      // Simulate realistic workload
      const products = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `Product ${i + 1}`,
      }));

      // Warm up cache
      for (const product of products) {
        await cacheManager.set(`product:${product.id}`, product);
      }

      // Simulate requests with Zipf distribution (80/20 rule)
      const requests = 1000;
      let hits = 0;
      let misses = 0;

      for (let i = 0; i < requests; i++) {
        // 80% of requests hit 20% of products
        const productId = Math.random() < 0.8
          ? Math.floor(Math.random() * 20) + 1
          : Math.floor(Math.random() * 100) + 1;

        const result = await cacheManager.get(`product:${productId}`);

        if (result.hit) hits++;
        else misses++;
      }

      const hitRate = (hits / requests) * 100;

      console.log(`Cache Hit Rate: ${hitRate.toFixed(2)}%`);
      console.log(`Hits: ${hits}, Misses: ${misses}`);

      expect(hitRate).toBeGreaterThan(95);
    });
  });

  describe('Query Optimization', () => {
    it('should optimize query execution', () => {
      const optimizer = new QueryOptimizer();

      const query = optimizer.buildProductListQuery({
        category: 'shoes',
        minDiscount: 20,
        page: 1,
        pageSize: 50,
      });

      expect(query).toHaveProperty('where');
      expect(query).toHaveProperty('orderBy');
      expect(query).toHaveProperty('take');
      expect(query.take).toBeLessThanOrEqual(50);
    });

    it('should estimate query cost', () => {
      const optimizer = new QueryOptimizer();

      const simpleQuery = { where: { id: '1' } };
      const complexQuery = {
        where: { category: 'shoes', brand: 'Nike', isActive: true },
        include: { images: true, translations: true },
        orderBy: [{ popularityScore: 'desc' }],
      };

      const simpleCost = optimizer.estimateQueryCost(simpleQuery);
      const complexCost = optimizer.estimateQueryCost(complexQuery);

      console.log(`Simple query cost: ${simpleCost}`);
      console.log(`Complex query cost: ${complexCost}`);

      expect(complexCost).toBeGreaterThan(simpleCost);
    });
  });

  describe('Batch Processing Performance', () => {
    it('should process batches efficiently', async () => {
      const batchProcessor = new BatchProcessor(mockPrisma, { batchSize: 50 });

      const items = Array.from({ length: 500 }, (_, i) => ({ id: i + 1 }));

      const startTime = Date.now();

      const result = await batchProcessor.processBatch(
        items,
        async (batch) => {
          // Simulate processing
          await new Promise((resolve) => setTimeout(resolve, 10));
          return batch.length;
        }
      );

      const totalTime = Date.now() - startTime;

      console.log(`Batch Processing: ${items.length} items in ${totalTime}ms`);
      console.log(`Throughput: ${Math.round((items.length / totalTime) * 1000)} items/sec`);

      expect(result.processed).toBe(items.length);
      expect(result.failed).toBe(0);
    });
  });

  describe('Metrics Tracking', () => {
    it('should track performance metrics accurately', () => {
      // Simulate requests
      for (let i = 0; i < 100; i++) {
        metricsTracker.record({
          responseTime: Math.random() * 100,
          cacheHit: Math.random() > 0.1, // 90% hit rate
          layer: 'l1',
          endpoint: '/api/deals',
        });
      }

      const report = metricsTracker.getReport();

      console.log('Performance Report:', {
        totalRequests: report.requests.total,
        avgResponseTime: report.responseTimes.avg,
        p95: report.responseTimes.p95,
        cacheHitRate: report.cache.hitRate,
      });

      expect(report.requests.total).toBe(100);
      expect(report.cache.hitRate).toBeGreaterThan(85);
      expect(report.responseTimes.avg).toBeLessThan(100);
    });

    it('should calculate percentiles correctly', () => {
      // Add known response times
      const responseTimes = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

      responseTimes.forEach((time) => {
        metricsTracker.record({
          responseTime: time,
          cacheHit: true,
          layer: 'l1',
        });
      });

      const report = metricsTracker.getReport();

      expect(report.responseTimes.min).toBe(10);
      expect(report.responseTimes.max).toBe(100);
      expect(report.responseTimes.median).toBeGreaterThanOrEqual(45);
      expect(report.responseTimes.median).toBeLessThanOrEqual(55);
    });

    it('should identify slow endpoints', () => {
      metricsTracker.record({
        responseTime: 150,
        cacheHit: false,
        endpoint: '/api/slow-endpoint',
      });

      metricsTracker.record({
        responseTime: 30,
        cacheHit: true,
        endpoint: '/api/fast-endpoint',
      });

      const slowEndpoints = metricsTracker.getSlowEndpoints(100);

      console.log('Slow endpoints:', slowEndpoints);

      expect(slowEndpoints.length).toBeGreaterThan(0);
      expect(slowEndpoints[0].endpoint).toBe('/api/slow-endpoint');
    });
  });

  describe('Performance Targets', () => {
    it('should meet all performance targets', () => {
      // Simulate optimal performance
      for (let i = 0; i < 100; i++) {
        metricsTracker.record({
          responseTime: Math.random() * 80, // <100ms
          cacheHit: Math.random() > 0.03, // 97% hit rate
          layer: 'l1',
        });
      }

      const targets = metricsTracker.checkTargets();

      console.log('Performance Targets:', targets.targets);

      expect(targets.met).toBe(true);
      expect(targets.targets.p95ResponseTime.met).toBe(true);
      expect(targets.targets.cacheHitRate.met).toBe(true);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not exceed memory limit', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Generate large dataset
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `Product ${i + 1}`,
        description: 'A'.repeat(1000), // 1KB per item
      }));

      // Cache all items
      for (const item of largeData) {
        await cacheManager.set(`product:${item.id}`, item);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      console.log(`Memory increase: ${memoryIncrease.toFixed(2)} MB`);

      // Should not exceed 50MB for 1000 items with 1KB each
      expect(memoryIncrease).toBeLessThan(50);
    });
  });

  describe('Cache Warmup Performance', () => {
    it('should warm up cache efficiently', async () => {
      const products = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `Product ${i + 1}`,
      }));

      const startTime = Date.now();

      // Parallel warmup
      await Promise.all(
        products.map((product) =>
          cacheManager.set(`product:${product.id}`, product)
        )
      );

      const warmupTime = Date.now() - startTime;

      console.log(`Cache warmup: ${products.length} items in ${warmupTime}ms`);

      expect(warmupTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});
