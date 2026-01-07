import { ApiProvider, RateLimitInfo, RateLimitConfig, RateLimitError } from './types';
import { getCache } from './cache';
import { prisma } from '../../db/client';

// ============================================
// RATE LIMITER
// ============================================

export class RateLimiter {
  private configs: Map<ApiProvider, RateLimitConfig> = new Map();
  private cache = getCache();

  constructor(configs?: RateLimitConfig[]) {
    // Default configurations
    this.setDefaultConfigs();

    // Override with provided configs
    if (configs) {
      configs.forEach((config) => {
        this.configs.set(config.provider, config);
      });
    }
  }

  // ============================================
  // CONFIGURATION
  // ============================================

  /**
   * Set default rate limit configurations
   */
  private setDefaultConfigs(): void {
    const defaultLimit = parseInt(process.env.API_RATE_LIMIT || '100');
    const windowMs = 24 * 60 * 60 * 1000; // 24 hours

    // RapidAPI configuration
    this.configs.set('rapidapi', {
      provider: 'rapidapi',
      maxRequests: defaultLimit,
      windowMs,
      retryAfterMs: 60 * 60 * 1000, // 1 hour
    });

    // Rainforest API configuration
    this.configs.set('rainforest', {
      provider: 'rainforest',
      maxRequests: defaultLimit,
      windowMs,
      retryAfterMs: 60 * 60 * 1000, // 1 hour
    });
  }

  /**
   * Update rate limit configuration for a provider
   */
  setConfig(config: RateLimitConfig): void {
    this.configs.set(config.provider, config);
  }

  /**
   * Get configuration for a provider
   */
  getConfig(provider: ApiProvider): RateLimitConfig | undefined {
    return this.configs.get(provider);
  }

  // ============================================
  // RATE LIMITING
  // ============================================

  /**
   * Check if request is allowed
   */
  async checkLimit(provider: ApiProvider): Promise<RateLimitInfo> {
    const config = this.configs.get(provider);
    if (!config) {
      throw new Error(`No rate limit config found for provider: ${provider}`);
    }

    const info = await this.getRateLimitInfo(provider);

    if (info.isLimited) {
      throw new RateLimitError(
        provider,
        config.retryAfterMs || 60 * 60 * 1000
      );
    }

    return info;
  }

  /**
   * Record an API request
   */
  async recordRequest(provider: ApiProvider): Promise<void> {
    const key = this.getRequestKey(provider);
    const config = this.configs.get(provider);

    if (!config) {
      throw new Error(`No rate limit config found for provider: ${provider}`);
    }

    try {
      // Get current count
      const currentCount = await this.getRequestCount(provider);

      // Increment count
      const newCount = currentCount + 1;

      // Store in cache with TTL matching the window
      const ttl = Math.floor(config.windowMs / 1000);
      await this.cache.set(key, newCount, ttl);

      // Also log to database
      await this.logToDatabase(provider, newCount, config.maxRequests);
    } catch (error) {
      console.error(`[RateLimiter] Error recording request:`, error);
    }
  }

  /**
   * Get current request count for provider
   */
  async getRequestCount(provider: ApiProvider): Promise<number> {
    const key = this.getRequestKey(provider);

    try {
      const count = await this.cache.get<number>(key);
      return count || 0;
    } catch (error) {
      console.error(`[RateLimiter] Error getting request count:`, error);
      return 0;
    }
  }

  /**
   * Get rate limit information
   */
  async getRateLimitInfo(provider: ApiProvider): Promise<RateLimitInfo> {
    const config = this.configs.get(provider);
    if (!config) {
      throw new Error(`No rate limit config found for provider: ${provider}`);
    }

    const requestsToday = await this.getRequestCount(provider);
    const requestsRemaining = Math.max(0, config.maxRequests - requestsToday);
    const isLimited = requestsRemaining === 0;

    // Calculate reset time (start of next day)
    const now = new Date();
    const resetsAt = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      0,
      0
    );

    return {
      provider,
      requestsToday,
      requestsRemaining,
      dailyLimit: config.maxRequests,
      resetsAt,
      isLimited,
    };
  }

  /**
   * Get rate limit info for all providers
   */
  async getAllRateLimitInfo(): Promise<RateLimitInfo[]> {
    const providers: ApiProvider[] = ['rapidapi', 'rainforest'];
    const infos: RateLimitInfo[] = [];

    for (const provider of providers) {
      try {
        const info = await this.getRateLimitInfo(provider);
        infos.push(info);
      } catch (error) {
        console.error(
          `[RateLimiter] Error getting info for ${provider}:`,
          error
        );
      }
    }

    return infos;
  }

  // ============================================
  // RESET & MANAGEMENT
  // ============================================

  /**
   * Reset rate limit for a provider
   */
  async resetLimit(provider: ApiProvider): Promise<void> {
    const key = this.getRequestKey(provider);
    await this.cache.delete(key);
  }

  /**
   * Reset all rate limits
   */
  async resetAllLimits(): Promise<void> {
    const providers: ApiProvider[] = ['rapidapi', 'rainforest'];
    for (const provider of providers) {
      await this.resetLimit(provider);
    }
  }

  /**
   * Check if provider is currently limited
   */
  async isLimited(provider: ApiProvider): Promise<boolean> {
    const info = await this.getRateLimitInfo(provider);
    return info.isLimited;
  }

  // ============================================
  // STATISTICS & LOGGING
  // ============================================

  /**
   * Get usage statistics from database
   */
  async getUsageStats(
    provider: ApiProvider,
    days: number = 7
  ): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    totalCost: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
      const logs = await prisma.apiLog.findMany({
        where: {
          provider,
          createdAt: { gte: startDate },
        },
      });

      const totalRequests = logs.length;
      const successfulRequests = logs.filter((log) => log.success).length;
      const failedRequests = totalRequests - successfulRequests;

      const averageResponseTime =
        logs.reduce((sum, log) => sum + log.responseTime, 0) /
        (totalRequests || 1);

      const totalCost = logs.reduce(
        (sum, log) => sum + (log.estimatedCost || 0),
        0
      );

      return {
        totalRequests,
        successfulRequests,
        failedRequests,
        averageResponseTime: Math.round(averageResponseTime),
        totalCost,
      };
    } catch (error) {
      console.error('[RateLimiter] Error getting usage stats:', error);
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        totalCost: 0,
      };
    }
  }

  /**
   * Log usage to database
   */
  private async logToDatabase(
    provider: ApiProvider,
    requestsToday: number,
    dailyLimit: number
  ): Promise<void> {
    try {
      // Only log significant milestones to avoid spam
      const milestones = [1, 10, 25, 50, 75, 90, 95, 99, 100];
      const percentUsed = Math.floor((requestsToday / dailyLimit) * 100);

      if (milestones.includes(percentUsed)) {
        await prisma.apiLog.create({
          data: {
            provider,
            endpoint: 'rate_limit_check',
            requestParams: {
              requestsToday,
              dailyLimit,
              percentUsed,
            },
            responseStatus: 200,
            responseTime: 0,
            creditsUsed: 0,
            success: true,
          },
        });
      }
    } catch (error) {
      // Don't fail on logging errors
      console.error('[RateLimiter] Error logging to database:', error);
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Generate cache key for request count
   */
  private getRequestKey(provider: ApiProvider): string {
    const today = new Date().toISOString().split('T')[0];
    return `ratelimit:${provider}:${today}`;
  }

  /**
   * Calculate time until reset
   */
  getTimeUntilReset(): number {
    const now = new Date();
    const tomorrow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      0,
      0
    );
    return tomorrow.getTime() - now.getTime();
  }

  /**
   * Get human-readable time until reset
   */
  getFormattedTimeUntilReset(): string {
    const ms = this.getTimeUntilReset();
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let rateLimiterInstance: RateLimiter | null = null;

/**
 * Get singleton rate limiter instance
 */
export function getRateLimiter(): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter();
  }
  return rateLimiterInstance;
}

/**
 * Create new rate limiter instance (for testing)
 */
export function createRateLimiter(configs?: RateLimitConfig[]): RateLimiter {
  return new RateLimiter(configs);
}

// ============================================
// EXPORTS
// ============================================

export default RateLimiter;
