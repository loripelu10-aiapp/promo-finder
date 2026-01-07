/**
 * L2 Redis Cache Implementation
 * Enhanced Redis cache wrapper with advanced features
 */

import { createClient, RedisClientType } from 'redis';
import { L2CacheConfig, L2Stats } from './types';

export class L2RedisCache {
  private client: RedisClientType | null = null;
  private connected: boolean = false;
  private config: Required<L2CacheConfig>;
  private stats: {
    hits: number;
    misses: number;
  };

  constructor(config: L2CacheConfig) {
    this.config = {
      url: config.url,
      host: config.host || 'localhost',
      port: config.port || 6379,
      password: config.password,
      db: config.db || 0,
      ttl: config.ttl || 7200, // 2 hours default
      maxMemory: config.maxMemory || '512mb',
      enabled: config.enabled !== undefined ? config.enabled : true,
    };

    this.stats = {
      hits: 0,
      misses: 0,
    };
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (this.connected || !this.config.enabled) return;

    try {
      const redisUrl =
        this.config.url ||
        `redis://${this.config.host}:${this.config.port}`;

      this.client = createClient({
        url: redisUrl,
        password: this.config.password,
        database: this.config.db,
      });

      this.client.on('error', (err) => {
        console.error('[L2 Redis] Error:', err.message);
      });

      this.client.on('connect', () => {
        console.log('[L2 Redis] Connected');
      });

      this.client.on('ready', () => {
        console.log('[L2 Redis] Ready');
      });

      this.client.on('reconnecting', () => {
        console.log('[L2 Redis] Reconnecting...');
      });

      await this.client.connect();
      this.connected = true;

      // Configure max memory policy
      try {
        await this.client.configSet('maxmemory', this.config.maxMemory);
        await this.client.configSet('maxmemory-policy', 'allkeys-lru');
      } catch (error: any) {
        console.warn('[L2 Redis] Could not set memory config:', error.message);
      }

      console.log('[L2 Redis] Cache initialized successfully');
    } catch (error: any) {
      console.error('[L2 Redis] Connection failed:', error.message);
      console.warn('[L2 Redis] Operating in fallback mode');
      this.connected = false;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client && this.connected) {
      await this.client.quit();
      this.connected = false;
      console.log('[L2 Redis] Disconnected');
    }
  }

  /**
   * Get value from Redis
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.connected || !this.client) {
      this.stats.misses++;
      return null;
    }

    try {
      const value = await this.client.get(key);

      if (!value) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;

      // Try to parse JSON, fallback to raw value
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error: any) {
      console.error('[L2 Redis] Get error:', error.message);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set value in Redis
   */
  async set<T = any>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.connected || !this.client) return;

    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      const expiry = ttl || this.config.ttl;

      await this.client.setEx(key, expiry, serialized);
    } catch (error: any) {
      console.error('[L2 Redis] Set error:', error.message);
    }
  }

  /**
   * Delete key from Redis
   */
  async delete(key: string): Promise<boolean> {
    if (!this.connected || !this.client) return false;

    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error: any) {
      console.error('[L2 Redis] Delete error:', error.message);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    if (!this.connected || !this.client) return false;

    try {
      const exists = await this.client.exists(key);
      return exists > 0;
    } catch (error: any) {
      console.error('[L2 Redis] Has error:', error.message);
      return false;
    }
  }

  /**
   * Get multiple values
   */
  async getMultiple<T = any>(keys: string[]): Promise<(T | null)[]> {
    if (!this.connected || !this.client || keys.length === 0) {
      return keys.map(() => null);
    }

    try {
      const values = await this.client.mGet(keys);

      return values.map((value) => {
        if (!value) {
          this.stats.misses++;
          return null;
        }

        this.stats.hits++;

        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      });
    } catch (error: any) {
      console.error('[L2 Redis] GetMultiple error:', error.message);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple values
   */
  async setMultiple<T = any>(
    entries: Array<{ key: string; value: T; ttl?: number }>
  ): Promise<void> {
    if (!this.connected || !this.client || entries.length === 0) return;

    try {
      const pipeline = this.client.multi();

      for (const { key, value, ttl } of entries) {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        const expiry = ttl || this.config.ttl;
        pipeline.setEx(key, expiry, serialized);
      }

      await pipeline.exec();
    } catch (error: any) {
      console.error('[L2 Redis] SetMultiple error:', error.message);
    }
  }

  /**
   * Delete keys matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.connected || !this.client) return 0;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;

      await this.client.del(keys);
      return keys.length;
    } catch (error: any) {
      console.error('[L2 Redis] DeletePattern error:', error.message);
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async clear(pattern: string = 'deals:*'): Promise<void> {
    if (!this.connected || !this.client) return;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        console.log(`[L2 Redis] Cleared ${keys.length} keys matching ${pattern}`);
      }
    } catch (error: any) {
      console.error('[L2 Redis] Clear error:', error.message);
    }
  }

  /**
   * Get all keys matching pattern
   */
  async keys(pattern: string = '*'): Promise<string[]> {
    if (!this.connected || !this.client) return [];

    try {
      return await this.client.keys(pattern);
    } catch (error: any) {
      console.error('[L2 Redis] Keys error:', error.message);
      return [];
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<L2Stats> {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    if (!this.connected || !this.client) {
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: Math.round(hitRate * 10000) / 100,
        size: 0,
        memory: '0 KB',
        keys: 0,
        connected: false,
      };
    }

    try {
      const keys = await this.client.keys('deals:*');
      const info = await this.client.info('memory');

      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memory = memoryMatch ? memoryMatch[1].trim() : 'Unknown';

      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: Math.round(hitRate * 10000) / 100,
        size: keys.length,
        memory,
        keys: keys.length,
        connected: this.connected,
      };
    } catch (error: any) {
      console.error('[L2 Redis] GetStats error:', error.message);
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: Math.round(hitRate * 10000) / 100,
        size: 0,
        memory: '0 KB',
        keys: 0,
        connected: false,
      };
    }
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
    };
  }

  /**
   * Ping Redis
   */
  async ping(): Promise<boolean> {
    if (!this.connected || !this.client) return false;

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Get TTL for key
   */
  async getTTL(key: string): Promise<number> {
    if (!this.connected || !this.client) return -1;

    try {
      return await this.client.ttl(key);
    } catch (error: any) {
      console.error('[L2 Redis] GetTTL error:', error.message);
      return -1;
    }
  }

  /**
   * Set TTL for key
   */
  async setTTL(key: string, ttl: number): Promise<boolean> {
    if (!this.connected || !this.client) return false;

    try {
      const result = await this.client.expire(key, ttl);
      return result;
    } catch (error: any) {
      console.error('[L2 Redis] SetTTL error:', error.message);
      return false;
    }
  }

  /**
   * Increment counter
   */
  async increment(key: string, by: number = 1): Promise<number> {
    if (!this.connected || !this.client) return 0;

    try {
      return await this.client.incrBy(key, by);
    } catch (error: any) {
      console.error('[L2 Redis] Increment error:', error.message);
      return 0;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get Redis client (for advanced operations)
   */
  getClient(): RedisClientType | null {
    return this.client;
  }
}

export default L2RedisCache;
