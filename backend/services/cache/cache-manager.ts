/**
 * Unified Cache Manager
 * Implements waterfall caching strategy: L1 → L2 → L3 → Database
 */

import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { L1MemoryCache } from './l1-memory';
import { L2RedisCache } from './l2-redis';
import { L3DatabaseCache } from './l3-database';
import {
  CacheConfig,
  CacheKeyOptions,
  CacheLayer,
  CacheGetResult,
  CacheMetrics,
  PerformanceMetrics,
} from './types';

export class CacheManager {
  private l1: L1MemoryCache;
  private l2: L2RedisCache;
  private l3: L3DatabaseCache;
  private prisma: PrismaClient;
  private performanceMetrics: {
    totalRequests: number;
    responseTimes: number[];
    lastReset: Date;
  };

  constructor(config: CacheConfig, prisma: PrismaClient) {
    this.prisma = prisma;

    // Initialize cache layers
    this.l1 = new L1MemoryCache(
      config.l1 || {
        maxSize: parseInt(process.env.L1_CACHE_SIZE || '1000'),
        ttl: parseInt(process.env.L1_CACHE_TTL || '300') * 1000,
      }
    );

    this.l2 = new L2RedisCache(
      config.l2 || {
        url: process.env.REDIS_URL,
        ttl: parseInt(process.env.L2_REDIS_TTL || '7200'),
        maxMemory: process.env.L2_REDIS_MAX_MEMORY || '512mb',
      }
    );

    this.l3 = new L3DatabaseCache(
      prisma,
      config.l3 || {
        refreshInterval: parseInt(process.env.L3_REFRESH_INTERVAL || '3600') * 1000,
      }
    );

    this.performanceMetrics = {
      totalRequests: 0,
      responseTimes: [],
      lastReset: new Date(),
    };
  }

  /**
   * Initialize all cache layers
   */
  async initialize(): Promise<void> {
    console.log('[Cache Manager] Initializing...');

    // Connect L2 Redis
    await this.l2.connect();

    // Initialize L3 materialized views
    await this.l3.initialize();

    // Start auto-refresh for L3
    this.l3.startAutoRefresh();

    // Start L1 cleanup interval
    this.l1.startCleanupInterval(60000); // Every minute

    console.log('[Cache Manager] Initialized successfully');
  }

  /**
   * Shutdown cache manager
   */
  async shutdown(): Promise<void> {
    console.log('[Cache Manager] Shutting down...');

    this.l3.stopAutoRefresh();
    await this.l2.disconnect();

    console.log('[Cache Manager] Shutdown complete');
  }

  /**
   * Generate cache key
   */
  generateKey(options: CacheKeyOptions): string {
    const { service, entity, identifier, params } = options;

    let key = `${service}:${entity}:${identifier}`;

    if (params && Object.keys(params).length > 0) {
      // Sort params for consistent key generation
      const sortedParams = Object.keys(params)
        .sort()
        .reduce((acc, key) => {
          acc[key] = params[key];
          return acc;
        }, {} as Record<string, any>);

      // Create hash of params
      const paramsStr = JSON.stringify(sortedParams);
      const hash = crypto.createHash('md5').update(paramsStr).digest('hex').substring(0, 8);
      key += `:${hash}`;
    }

    return key;
  }

  /**
   * Get value from cache (waterfall strategy)
   */
  async get<T = any>(key: string): Promise<CacheGetResult<T>> {
    const startTime = Date.now();
    this.performanceMetrics.totalRequests++;

    // L1: Check in-memory cache
    const l1Result = this.l1.get<T>(key);
    if (l1Result !== null) {
      const responseTime = Date.now() - startTime;
      this.recordResponseTime(responseTime);
      return {
        data: l1Result,
        hit: true,
        layer: 'l1',
        responseTime,
      };
    }

    // L2: Check Redis
    const l2Result = await this.l2.get<T>(key);
    if (l2Result !== null) {
      // Promote to L1
      this.l1.set(key, l2Result);

      const responseTime = Date.now() - startTime;
      this.recordResponseTime(responseTime);
      return {
        data: l2Result,
        hit: true,
        layer: 'l2',
        responseTime,
      };
    }

    // No cache hit
    const responseTime = Date.now() - startTime;
    this.recordResponseTime(responseTime);
    return {
      data: null,
      hit: false,
      responseTime,
    };
  }

  /**
   * Set value in cache (populate all layers)
   */
  async set<T = any>(key: string, value: T, ttl?: number): Promise<void> {
    // Set in L1 (milliseconds)
    const l1Ttl = ttl ? ttl * 1000 : undefined;
    this.l1.set(key, value, l1Ttl);

    // Set in L2 (seconds)
    await this.l2.set(key, value, ttl);
  }

  /**
   * Delete from all cache layers
   */
  async delete(key: string): Promise<void> {
    this.l1.delete(key);
    await this.l2.delete(key);
  }

  /**
   * Get or compute value (with cache)
   */
  async getOrCompute<T = any>(
    key: string,
    computeFn: () => Promise<T>,
    ttl?: number
  ): Promise<CacheGetResult<T>> {
    const startTime = Date.now();

    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached.hit && cached.data !== null) {
      return cached;
    }

    // Compute value
    const computeStartTime = Date.now();
    const value = await computeFn();
    const computeTime = Date.now() - computeStartTime;

    // Store in cache
    await this.set(key, value, ttl);

    const responseTime = Date.now() - startTime;
    this.recordResponseTime(responseTime);

    return {
      data: value,
      hit: false,
      layer: 'database',
      responseTime,
    };
  }

  /**
   * Get multiple values
   */
  async getMultiple<T = any>(keys: string[]): Promise<(T | null)[]> {
    // Try L1 first
    const l1Results = this.l1.getMultiple<T>(keys);
    const missingIndices = l1Results
      .map((result, index) => (result === null ? index : -1))
      .filter((index) => index !== -1);

    if (missingIndices.length === 0) {
      return l1Results;
    }

    // Get missing keys from L2
    const missingKeys = missingIndices.map((index) => keys[index]);
    const l2Results = await this.l2.getMultiple<T>(missingKeys);

    // Merge results and promote L2 hits to L1
    const results = [...l1Results];
    missingIndices.forEach((index, i) => {
      const l2Value = l2Results[i];
      if (l2Value !== null) {
        results[index] = l2Value;
        this.l1.set(keys[index], l2Value);
      }
    });

    return results;
  }

  /**
   * Set multiple values
   */
  async setMultiple<T = any>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    // Set in L1
    this.l1.setMultiple(
      entries.map(({ key, value, ttl }) => ({
        key,
        value,
        ttl: ttl ? ttl * 1000 : undefined,
      }))
    );

    // Set in L2
    await this.l2.setMultiple(entries);
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    const l1Count = this.l1.deletePattern(pattern);
    const l2Count = await this.l2.deletePattern(pattern);

    console.log(`[Cache Manager] Invalidated ${l1Count} L1 + ${l2Count} L2 keys matching ${pattern}`);

    return l1Count + l2Count;
  }

  /**
   * Clear all cache layers
   */
  async clear(pattern?: string): Promise<void> {
    if (pattern) {
      await this.invalidatePattern(pattern);
    } else {
      this.l1.clear();
      await this.l2.clear();
    }

    console.log('[Cache Manager] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheMetrics> {
    const l1Stats = this.l1.getStats();
    const l2Stats = await this.l2.getStats();
    const l3Stats = this.l3.getStats();

    const totalRequests = this.performanceMetrics.totalRequests;
    const totalHits = l1Stats.hits + l2Stats.hits;
    const totalMisses = l1Stats.misses + l2Stats.misses;
    const overallHitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;

    const avgResponseTime =
      this.performanceMetrics.responseTimes.length > 0
        ? this.performanceMetrics.responseTimes.reduce((sum, time) => sum + time, 0) /
          this.performanceMetrics.responseTimes.length
        : 0;

    return {
      l1: l1Stats,
      l2: l2Stats,
      l3: l3Stats,
      overall: {
        totalRequests,
        cacheHitRate: Math.round(overallHitRate * 100) / 100,
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
        lastReset: this.performanceMetrics.lastReset,
      },
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.l1.resetStats();
    this.l2.resetStats();
    this.performanceMetrics = {
      totalRequests: 0,
      responseTimes: [],
      lastReset: new Date(),
    };
  }

  /**
   * Get health status
   */
  async getHealth(): Promise<any> {
    const l2Connected = this.l2.isConnected();
    const l2Ping = await this.l2.ping();
    const l3Enabled = this.l3.isEnabled();

    return {
      status: l2Connected && l2Ping ? 'healthy' : 'degraded',
      l1: {
        status: this.l1.isEnabled() ? 'healthy' : 'down',
        size: this.l1.size(),
        enabled: this.l1.isEnabled(),
      },
      l2: {
        status: l2Connected && l2Ping ? 'healthy' : 'down',
        connected: l2Connected,
        ping: l2Ping,
      },
      l3: {
        status: l3Enabled ? 'healthy' : 'down',
        enabled: l3Enabled,
        views: this.l3.getViewNames(),
      },
      timestamp: new Date(),
    };
  }

  /**
   * Refresh L3 materialized views
   */
  async refreshMaterializedViews(): Promise<void> {
    await this.l3.refreshAllViews();
  }

  /**
   * Get L3 cache instance
   */
  getL3(): L3DatabaseCache {
    return this.l3;
  }

  /**
   * Record response time
   */
  private recordResponseTime(time: number): void {
    this.performanceMetrics.responseTimes.push(time);

    // Keep only last 1000 response times
    if (this.performanceMetrics.responseTimes.length > 1000) {
      this.performanceMetrics.responseTimes.shift();
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const times = this.performanceMetrics.responseTimes;

    if (times.length === 0) {
      return {
        queryTime: 0,
        cacheTime: 0,
        serializationTime: 0,
        totalTime: 0,
      };
    }

    const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
    const sorted = [...times].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return {
      queryTime: 0, // Placeholder
      cacheTime: avg,
      serializationTime: 0, // Placeholder
      totalTime: avg,
    };
  }
}

export default CacheManager;
