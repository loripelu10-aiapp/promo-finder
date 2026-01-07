/**
 * L1 In-Memory Cache Implementation
 * LRU (Least Recently Used) cache with TTL support
 */

import { L1CacheConfig, CacheEntry, L1Stats, isExpired } from './types';

export class L1MemoryCache {
  private cache: Map<string, CacheEntry>;
  private accessOrder: Map<string, number>; // Track access order for LRU
  private config: Required<L1CacheConfig>;
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
  };
  private accessCounter: number;

  constructor(config: L1CacheConfig) {
    this.config = {
      maxSize: config.maxSize || 1000,
      ttl: config.ttl || 300000, // 5 minutes default
      enabled: config.enabled !== undefined ? config.enabled : true,
    };

    this.cache = new Map();
    this.accessOrder = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
    this.accessCounter = 0;
  }

  /**
   * Get value from cache
   */
  get<T = any>(key: string): T | null {
    if (!this.config.enabled) return null;

    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (isExpired(entry)) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access order
    this.accessCounter++;
    this.accessOrder.set(key, this.accessCounter);

    // Update hit count
    if (entry.hits !== undefined) {
      entry.hits++;
    }

    this.stats.hits++;
    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  set<T = any>(key: string, value: T, ttl?: number): void {
    if (!this.config.enabled) return;

    // Check size limit and evict if necessary
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.config.ttl,
      hits: 0,
    };

    this.cache.set(key, entry);
    this.accessCounter++;
    this.accessOrder.set(key, this.accessCounter);
  }

  /**
   * Delete value from cache
   */
  delete(key: string): boolean {
    this.accessOrder.delete(key);
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
    this.accessCounter = 0;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (isExpired(entry)) {
      this.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Get multiple values
   */
  getMultiple<T = any>(keys: string[]): (T | null)[] {
    return keys.map((key) => this.get<T>(key));
  }

  /**
   * Set multiple values
   */
  setMultiple<T = any>(entries: Array<{ key: string; value: T; ttl?: number }>): void {
    entries.forEach(({ key, value, ttl }) => {
      this.set(key, value, ttl);
    });
  }

  /**
   * Delete entries matching pattern
   */
  deletePattern(pattern: string): number {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    let deleted = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache statistics
   */
  getStats(): L1Stats {
    // Clean expired entries
    this.cleanExpired();

    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    // Estimate memory usage
    const memoryUsage = this.estimateMemoryUsage();

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 10000) / 100, // Percentage with 2 decimals
      size: this.cache.size,
      evictions: this.stats.evictions,
      maxSize: this.config.maxSize,
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
      evictions: 0,
    };
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (this.cache.size === 0) return;

    // Find the entry with the lowest access counter
    let lruKey: string | null = null;
    let lruAccessTime = Infinity;

    for (const [key, accessTime] of this.accessOrder.entries()) {
      if (accessTime < lruAccessTime) {
        lruAccessTime = accessTime;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.accessOrder.delete(lruKey);
      this.stats.evictions++;
    }
  }

  /**
   * Clean expired entries
   */
  private cleanExpired(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttl > 0 && now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Estimate memory usage (rough approximation)
   */
  private estimateMemoryUsage(): number {
    let bytes = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Key size (2 bytes per char in JS)
      bytes += key.length * 2;

      // Value size (rough estimate using JSON stringification)
      try {
        const serialized = JSON.stringify(entry.value);
        bytes += serialized.length * 2;
      } catch {
        // If can't stringify, estimate as 100 bytes
        bytes += 100;
      }

      // Entry metadata
      bytes += 32; // timestamp, ttl, hits
    }

    return bytes;
  }

  /**
   * Start automatic cleanup interval
   */
  startCleanupInterval(intervalMs: number = 60000): NodeJS.Timer {
    return setInterval(() => {
      const cleaned = this.cleanExpired();
      if (cleaned > 0) {
        console.log(`[L1 Cache] Cleaned ${cleaned} expired entries`);
      }
    }, intervalMs);
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if cache is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable/disable cache
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }
}

export default L1MemoryCache;
