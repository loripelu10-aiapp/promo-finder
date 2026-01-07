/**
 * Cache Invalidation Strategies
 * Smart invalidation for related cache entries
 */

import { CacheManager } from './cache-manager';
import { InvalidationPattern } from './types';

export class CacheInvalidation {
  constructor(private cacheManager: CacheManager) {}

  /**
   * Invalidate product-related caches
   */
  async invalidateProduct(productId: string): Promise<void> {
    const patterns = [
      `deals:product:${productId}*`,
      `deals:products:list*`, // Invalidate all product lists
      `api:*`, // Invalidate API responses
    ];

    for (const pattern of patterns) {
      await this.cacheManager.invalidatePattern(pattern);
    }

    console.log(`[Invalidation] Invalidated product ${productId} and related caches`);
  }

  /**
   * Invalidate category-related caches
   */
  async invalidateCategory(category: string): Promise<void> {
    const patterns = [
      `deals:products:list:*category=${category}*`,
      `deals:category:${category}*`,
      `api:deals*category=${category}*`,
    ];

    for (const pattern of patterns) {
      await this.cacheManager.invalidatePattern(pattern);
    }

    console.log(`[Invalidation] Invalidated category ${category} caches`);
  }

  /**
   * Invalidate brand-related caches
   */
  async invalidateBrand(brand: string): Promise<void> {
    const patterns = [
      `deals:products:list:*brand=${brand}*`,
      `deals:brand:${brand}*`,
      `api:deals*brand=${brand}*`,
    ];

    for (const pattern of patterns) {
      await this.cacheManager.invalidatePattern(pattern);
    }

    console.log(`[Invalidation] Invalidated brand ${brand} caches`);
  }

  /**
   * Invalidate source-related caches
   */
  async invalidateSource(source: string): Promise<void> {
    const patterns = [
      `deals:products:list:*source=${source}*`,
      `deals:source:${source}*`,
      `api:deals*source=${source}*`,
    ];

    for (const pattern of patterns) {
      await this.cacheManager.invalidatePattern(pattern);
    }

    console.log(`[Invalidation] Invalidated source ${source} caches`);
  }

  /**
   * Invalidate all product lists
   */
  async invalidateAllProductLists(): Promise<void> {
    const patterns = [
      `deals:products:list*`,
      `api:deals*`,
    ];

    for (const pattern of patterns) {
      await this.cacheManager.invalidatePattern(pattern);
    }

    console.log('[Invalidation] Invalidated all product lists');
  }

  /**
   * Invalidate statistics caches
   */
  async invalidateStats(): Promise<void> {
    const patterns = [
      `deals:stats*`,
      `api:stats*`,
    ];

    for (const pattern of patterns) {
      await this.cacheManager.invalidatePattern(pattern);
    }

    console.log('[Invalidation] Invalidated statistics caches');
  }

  /**
   * Invalidate translation caches
   */
  async invalidateTranslation(productId: string, language?: string): Promise<void> {
    const patterns = language
      ? [`translation:*:${language}:*`, `deals:product:${productId}:${language}`]
      : [`translation:*`, `deals:product:${productId}:*`];

    for (const pattern of patterns) {
      await this.cacheManager.invalidatePattern(pattern);
    }

    console.log(`[Invalidation] Invalidated translations for product ${productId}`);
  }

  /**
   * Time-based invalidation (invalidate old entries)
   */
  async invalidateOlderThan(hours: number): Promise<void> {
    // This is handled by TTL, but we can force a cleanup
    console.log(`[Invalidation] Time-based invalidation triggered (${hours}h)`);
  }

  /**
   * Smart invalidation based on operation type
   */
  async invalidateByOperation(
    operation: 'create' | 'update' | 'delete',
    entity: 'product' | 'category' | 'brand',
    identifier: string
  ): Promise<void> {
    switch (entity) {
      case 'product':
        await this.invalidateProduct(identifier);
        await this.invalidateAllProductLists(); // New/updated product affects lists
        await this.invalidateStats(); // Stats may change
        break;

      case 'category':
        await this.invalidateCategory(identifier);
        await this.invalidateStats();
        break;

      case 'brand':
        await this.invalidateBrand(identifier);
        await this.invalidateStats();
        break;
    }

    console.log(`[Invalidation] Smart invalidation for ${operation} ${entity} ${identifier}`);
  }

  /**
   * Invalidate by pattern with custom logic
   */
  async invalidateCustom(pattern: InvalidationPattern): Promise<number> {
    let totalInvalidated = 0;

    switch (pattern.type) {
      case 'exact':
        if (typeof pattern.value === 'string') {
          await this.cacheManager.delete(pattern.value);
          totalInvalidated = 1;
        }
        break;

      case 'prefix':
        if (typeof pattern.value === 'string') {
          totalInvalidated = await this.cacheManager.invalidatePattern(`${pattern.value}*`);
        }
        break;

      case 'pattern':
        if (typeof pattern.value === 'string') {
          totalInvalidated = await this.cacheManager.invalidatePattern(pattern.value);
        }
        break;

      case 'tag':
        // Tag-based invalidation would require storing tags separately
        // For now, we'll treat it as a prefix
        if (typeof pattern.value === 'string') {
          totalInvalidated = await this.cacheManager.invalidatePattern(`*${pattern.value}*`);
        } else if (Array.isArray(pattern.value)) {
          for (const tag of pattern.value) {
            totalInvalidated += await this.cacheManager.invalidatePattern(`*${tag}*`);
          }
        }
        break;
    }

    return totalInvalidated;
  }

  /**
   * Batch invalidation
   */
  async invalidateBatch(patterns: InvalidationPattern[]): Promise<number> {
    let totalInvalidated = 0;

    for (const pattern of patterns) {
      totalInvalidated += await this.invalidateCustom(pattern);
    }

    console.log(`[Invalidation] Batch invalidated ${totalInvalidated} entries`);
    return totalInvalidated;
  }

  /**
   * Clear all caches (nuclear option)
   */
  async clearAll(): Promise<void> {
    await this.cacheManager.clear();
    console.log('[Invalidation] All caches cleared');
  }

  /**
   * Schedule invalidation (for future use with cron)
   */
  scheduleInvalidation(
    pattern: InvalidationPattern,
    delayMs: number
  ): NodeJS.Timeout {
    return setTimeout(async () => {
      await this.invalidateCustom(pattern);
    }, delayMs);
  }

  /**
   * Invalidate on product update event
   */
  onProductUpdate(productId: string, changes: any): Promise<void> {
    // Invalidate based on what changed
    const invalidations: Promise<void>[] = [];

    if (changes.category) {
      invalidations.push(this.invalidateCategory(changes.category));
    }

    if (changes.brand) {
      invalidations.push(this.invalidateBrand(changes.brand));
    }

    if (changes.source) {
      invalidations.push(this.invalidateSource(changes.source));
    }

    invalidations.push(this.invalidateProduct(productId));
    invalidations.push(this.invalidateAllProductLists());

    return Promise.all(invalidations).then(() => {});
  }

  /**
   * Invalidate on bulk operation
   */
  async onBulkOperation(
    operation: 'create' | 'update' | 'delete',
    count: number
  ): Promise<void> {
    // For bulk operations, invalidate everything
    await this.invalidateAllProductLists();
    await this.invalidateStats();

    console.log(`[Invalidation] Bulk operation ${operation} (${count} items) - invalidated lists and stats`);
  }
}

export default CacheInvalidation;
