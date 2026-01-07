import { createClient, RedisClientType } from 'redis';
import crypto from 'crypto';
import { CacheEntry, CacheStats, ApiProvider } from './types';

// ============================================
// REDIS CACHE CLIENT
// ============================================

export class ApiCache {
  private client: RedisClientType | null = null;
  private connected: boolean = false;
  private defaultTTL: number;
  private readonly keyPrefix: string = 'api';

  // In-memory fallback cache
  private memoryCache: Map<string, CacheEntry> = new Map();
  private memoryCacheEnabled: boolean = true;

  // Stats
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor(config?: { ttl?: number; redisUrl?: string }) {
    this.defaultTTL = config?.ttl || parseInt(process.env.API_CACHE_TTL || '21600'); // 6 hours
    this.initialize(config?.redisUrl);
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Initialize Redis connection
   */
  private async initialize(redisUrl?: string): Promise<void> {
    try {
      const url = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';

      this.client = createClient({
        url,
        socket: {
          connectTimeout: 5000,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('[Cache] Max reconnection attempts reached');
              return new Error('Max reconnection attempts reached');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.client.on('error', (err) => {
        console.error('[Cache] Redis error:', err);
        this.connected = false;
      });

      this.client.on('connect', () => {
        console.log('[Cache] Redis connected');
        this.connected = true;
      });

      this.client.on('disconnect', () => {
        console.log('[Cache] Redis disconnected');
        this.connected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.error('[Cache] Failed to initialize Redis:', error);
      console.log('[Cache] Using in-memory cache fallback');
      this.connected = false;
    }
  }

  // ============================================
  // CACHE OPERATIONS
  // ============================================

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key);

    try {
      // Try Redis first
      if (this.connected && this.client) {
        const data = await this.client.get(fullKey);
        if (data) {
          this.stats.hits++;
          return JSON.parse(data) as T;
        }
      }

      // Fallback to memory cache
      if (this.memoryCacheEnabled) {
        const entry = this.memoryCache.get(fullKey);
        if (entry && !this.isExpired(entry)) {
          this.stats.hits++;
          return entry.data as T;
        } else if (entry) {
          this.memoryCache.delete(fullKey);
        }
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      console.error('[Cache] Get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    const fullKey = this.buildKey(key);
    const cacheTTL = ttl || this.defaultTTL;

    try {
      const data = JSON.stringify(value);

      // Try Redis first
      if (this.connected && this.client) {
        await this.client.setEx(fullKey, cacheTTL, data);
      }

      // Also store in memory cache
      if (this.memoryCacheEnabled) {
        const entry: CacheEntry<T> = {
          data: value,
          timestamp: Date.now(),
          ttl: cacheTTL,
          key: fullKey,
        };
        this.memoryCache.set(fullKey, entry);

        // Clean up expired entries periodically
        this.cleanupMemoryCache();
      }

      return true;
    } catch (error) {
      console.error('[Cache] Set error:', error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key);

    try {
      // Delete from Redis
      if (this.connected && this.client) {
        await this.client.del(fullKey);
      }

      // Delete from memory cache
      if (this.memoryCacheEnabled) {
        this.memoryCache.delete(fullKey);
      }

      return true;
    } catch (error) {
      console.error('[Cache] Delete error:', error);
      return false;
    }
  }

  /**
   * Clear all cache entries for a provider
   */
  async clearProvider(provider: ApiProvider): Promise<boolean> {
    try {
      const pattern = this.buildKey(`${provider}:*`);

      // Clear from Redis
      if (this.connected && this.client) {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(keys);
        }
      }

      // Clear from memory cache
      if (this.memoryCacheEnabled) {
        const keysToDelete: string[] = [];
        this.memoryCache.forEach((_, key) => {
          if (key.startsWith(this.buildKey(provider))) {
            keysToDelete.push(key);
          }
        });
        keysToDelete.forEach((key) => this.memoryCache.delete(key));
      }

      return true;
    } catch (error) {
      console.error('[Cache] Clear provider error:', error);
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  async clearAll(): Promise<boolean> {
    try {
      // Clear from Redis
      if (this.connected && this.client) {
        const keys = await this.client.keys(`${this.keyPrefix}:*`);
        if (keys.length > 0) {
          await this.client.del(keys);
        }
      }

      // Clear memory cache
      if (this.memoryCacheEnabled) {
        this.memoryCache.clear();
      }

      return true;
    } catch (error) {
      console.error('[Cache] Clear all error:', error);
      return false;
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Build cache key with namespace
   */
  private buildKey(key: string): string {
    return `${this.keyPrefix}:${key}`;
  }

  /**
   * Generate cache key from parameters
   */
  generateKey(provider: ApiProvider, params: any): string {
    const hash = this.hashParams(params);
    return `${provider}:${hash}`;
  }

  /**
   * Hash parameters to create unique key
   */
  private hashParams(params: any): string {
    const str = JSON.stringify(params, Object.keys(params).sort());
    return crypto.createHash('md5').update(str).digest('hex');
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    const age = (Date.now() - entry.timestamp) / 1000; // age in seconds
    return age > entry.ttl;
  }

  /**
   * Clean up expired entries from memory cache
   */
  private cleanupMemoryCache(): void {
    // Only cleanup if cache is getting large
    if (this.memoryCache.size > 100) {
      const keysToDelete: string[] = [];
      this.memoryCache.forEach((entry, key) => {
        if (this.isExpired(entry)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach((key) => this.memoryCache.delete(key));
    }
  }

  // ============================================
  // STATISTICS
  // ============================================

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    let keys = 0;
    let memoryUsage = '0 KB';

    try {
      // Get key count from Redis
      if (this.connected && this.client) {
        const redisKeys = await this.client.keys(`${this.keyPrefix}:*`);
        keys = redisKeys.length;
      } else {
        keys = this.memoryCache.size;
      }

      // Estimate memory usage for memory cache
      if (this.memoryCacheEnabled) {
        let bytes = 0;
        this.memoryCache.forEach((entry) => {
          bytes += JSON.stringify(entry).length;
        });
        memoryUsage = `${(bytes / 1024).toFixed(2)} KB`;
      }
    } catch (error) {
      console.error('[Cache] Error getting stats:', error);
    }

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      keys,
      memoryUsage,
    };
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

  // ============================================
  // CONNECTION MANAGEMENT
  // ============================================

  /**
   * Check if cache is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.quit();
        this.connected = false;
      }
    } catch (error) {
      console.error('[Cache] Disconnect error:', error);
    }
  }

  /**
   * Reconnect to Redis
   */
  async reconnect(): Promise<void> {
    try {
      if (this.client && !this.connected) {
        await this.client.connect();
      }
    } catch (error) {
      console.error('[Cache] Reconnect error:', error);
    }
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let cacheInstance: ApiCache | null = null;

/**
 * Get singleton cache instance
 */
export function getCache(): ApiCache {
  if (!cacheInstance) {
    cacheInstance = new ApiCache();
  }
  return cacheInstance;
}

/**
 * Create new cache instance (for testing)
 */
export function createCache(config?: {
  ttl?: number;
  redisUrl?: string;
}): ApiCache {
  return new ApiCache(config);
}

// ============================================
// EXPORTS
// ============================================

export default ApiCache;
