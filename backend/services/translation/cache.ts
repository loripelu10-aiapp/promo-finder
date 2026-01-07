/**
 * Translation Cache Service
 * Redis-based caching for translations with 24h TTL
 */

import { createClient, RedisClientType } from 'redis';
import { Language, RedisConfig } from './types';

export class TranslationCache {
  private client: RedisClientType | null = null;
  private connected: boolean = false;
  private defaultTTL: number = 24 * 60 * 60; // 24 hours in seconds

  constructor(private config: RedisConfig = {}) {}

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      const redisUrl =
        this.config.url ||
        `redis://${this.config.host || 'localhost'}:${this.config.port || 6379}`;

      this.client = createClient({
        url: redisUrl,
        password: this.config.password,
        database: this.config.db || 0,
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
      });

      await this.client.connect();
      this.connected = true;
      console.log('Translation cache connected to Redis');
    } catch (error: any) {
      console.error('Failed to connect to Redis:', error.message);
      console.warn('Translation cache will operate in fallback mode');
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
    }
  }

  /**
   * Generate cache key for translation
   */
  private getCacheKey(
    text: string,
    sourceLang: Language,
    targetLang: Language
  ): string {
    // Create a hash-like key to keep it short
    const textHash = this.simpleHash(text);
    return `trans:${sourceLang}:${targetLang}:${textHash}`;
  }

  /**
   * Simple hash function for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get cached translation
   */
  async get(
    text: string,
    sourceLang: Language,
    targetLang: Language
  ): Promise<string | null> {
    if (!this.connected || !this.client) {
      return null;
    }

    try {
      const key = this.getCacheKey(text, sourceLang, targetLang);
      const cached = await this.client.get(key);

      if (cached) {
        console.log(`Cache hit for ${sourceLang} -> ${targetLang}`);
      }

      return cached;
    } catch (error: any) {
      console.error('Cache get error:', error.message);
      return null;
    }
  }

  /**
   * Store translation in cache
   */
  async set(
    text: string,
    sourceLang: Language,
    targetLang: Language,
    translatedText: string,
    ttl?: number
  ): Promise<void> {
    if (!this.connected || !this.client) {
      return;
    }

    try {
      const key = this.getCacheKey(text, sourceLang, targetLang);
      await this.client.setEx(key, ttl || this.defaultTTL, translatedText);
      console.log(`Cached translation: ${sourceLang} -> ${targetLang}`);
    } catch (error: any) {
      console.error('Cache set error:', error.message);
    }
  }

  /**
   * Get multiple cached translations
   */
  async getMultiple(
    texts: string[],
    sourceLang: Language,
    targetLang: Language
  ): Promise<(string | null)[]> {
    if (!this.connected || !this.client) {
      return texts.map(() => null);
    }

    try {
      const keys = texts.map((text) => this.getCacheKey(text, sourceLang, targetLang));
      const results = await this.client.mGet(keys);
      return results;
    } catch (error: any) {
      console.error('Cache getMultiple error:', error.message);
      return texts.map(() => null);
    }
  }

  /**
   * Store multiple translations in cache
   */
  async setMultiple(
    texts: string[],
    sourceLang: Language,
    targetLang: Language,
    translatedTexts: string[],
    ttl?: number
  ): Promise<void> {
    if (!this.connected || !this.client) {
      return;
    }

    try {
      const pipeline = this.client.multi();

      texts.forEach((text, index) => {
        const key = this.getCacheKey(text, sourceLang, targetLang);
        pipeline.setEx(key, ttl || this.defaultTTL, translatedTexts[index]);
      });

      await pipeline.exec();
      console.log(`Cached ${texts.length} translations: ${sourceLang} -> ${targetLang}`);
    } catch (error: any) {
      console.error('Cache setMultiple error:', error.message);
    }
  }

  /**
   * Clear all translation cache
   */
  async clear(): Promise<void> {
    if (!this.connected || !this.client) {
      return;
    }

    try {
      // Find all translation keys
      const keys = await this.client.keys('trans:*');
      if (keys.length > 0) {
        await this.client.del(keys);
        console.log(`Cleared ${keys.length} cached translations`);
      }
    } catch (error: any) {
      console.error('Cache clear error:', error.message);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ totalKeys: number; memoryUsage: string }> {
    if (!this.connected || !this.client) {
      return { totalKeys: 0, memoryUsage: '0 KB' };
    }

    try {
      const keys = await this.client.keys('trans:*');
      const info = await this.client.info('memory');

      // Parse memory usage from info string
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1] : 'Unknown';

      return {
        totalKeys: keys.length,
        memoryUsage,
      };
    } catch (error: any) {
      console.error('Cache stats error:', error.message);
      return { totalKeys: 0, memoryUsage: '0 KB' };
    }
  }

  /**
   * Check if cache is connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}
