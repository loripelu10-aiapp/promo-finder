/**
 * Batch Processor
 * Efficient batch processing for bulk operations
 */

import { PrismaClient } from '@prisma/client';
import { BatchCacheOperation } from './types';
import { CacheManager } from './cache-manager';

export interface BatchConfig {
  batchSize: number;
  delayBetweenBatches?: number; // milliseconds
  maxConcurrent?: number;
  retryOnError?: boolean;
  maxRetries?: number;
}

export interface BatchResult<T = any> {
  total: number;
  processed: number;
  failed: number;
  errors: Array<{ index: number; error: string }>;
  duration: number;
  results?: T[];
}

export class BatchProcessor {
  private config: Required<BatchConfig>;
  private prisma: PrismaClient;
  private cacheManager?: CacheManager;

  constructor(
    prisma: PrismaClient,
    config?: Partial<BatchConfig>,
    cacheManager?: CacheManager
  ) {
    this.prisma = prisma;
    this.cacheManager = cacheManager;
    this.config = {
      batchSize: config?.batchSize || 50,
      delayBetweenBatches: config?.delayBetweenBatches || 0,
      maxConcurrent: config?.maxConcurrent || 5,
      retryOnError: config?.retryOnError !== undefined ? config.retryOnError : true,
      maxRetries: config?.maxRetries || 3,
    };
  }

  /**
   * Process items in batches
   */
  async processBatch<T, R>(
    items: T[],
    processFn: (batch: T[]) => Promise<R>,
    options?: Partial<BatchConfig>
  ): Promise<BatchResult<R>> {
    const startTime = Date.now();
    const batchSize = options?.batchSize || this.config.batchSize;
    const results: R[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    const batches = this.createBatches(items, batchSize);
    let processed = 0;

    console.log(`[Batch Processor] Processing ${items.length} items in ${batches.length} batches`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      try {
        const result = await processFn(batch);
        results.push(result);
        processed += batch.length;

        console.log(`[Batch Processor] Batch ${i + 1}/${batches.length} complete (${processed}/${items.length})`);

        // Delay between batches if configured
        if (this.config.delayBetweenBatches > 0 && i < batches.length - 1) {
          await this.delay(this.config.delayBetweenBatches);
        }
      } catch (error: any) {
        console.error(`[Batch Processor] Batch ${i + 1} failed:`, error.message);
        errors.push({
          index: i,
          error: error.message,
        });

        // Retry logic
        if (this.config.retryOnError) {
          const retryResult = await this.retryBatch(batch, processFn, this.config.maxRetries);
          if (retryResult.success) {
            results.push(retryResult.result as R);
            processed += batch.length;
          }
        }
      }
    }

    const duration = Date.now() - startTime;

    return {
      total: items.length,
      processed,
      failed: items.length - processed,
      errors,
      duration,
      results,
    };
  }

  /**
   * Batch insert products
   */
  async batchInsertProducts(products: any[]): Promise<BatchResult> {
    const startTime = Date.now();
    let totalInserted = 0;
    const errors: Array<{ index: number; error: string }> = [];

    const batches = this.createBatches(products, this.config.batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      try {
        const result = await this.prisma.product.createMany({
          data: batch,
          skipDuplicates: true,
        });

        totalInserted += result.count;
        console.log(`[Batch Insert] Batch ${i + 1}/${batches.length}: ${result.count} products inserted`);
      } catch (error: any) {
        console.error(`[Batch Insert] Batch ${i + 1} failed:`, error.message);
        errors.push({ index: i, error: error.message });
      }
    }

    const duration = Date.now() - startTime;

    return {
      total: products.length,
      processed: totalInserted,
      failed: products.length - totalInserted,
      errors,
      duration,
    };
  }

  /**
   * Batch update products
   */
  async batchUpdateProducts(
    updates: Array<{ id: string; data: any }>
  ): Promise<BatchResult> {
    const startTime = Date.now();
    let processed = 0;
    const errors: Array<{ index: number; error: string }> = [];

    const batches = this.createBatches(updates, this.config.batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      try {
        // Use transaction for batch updates
        await this.prisma.$transaction(
          batch.map((update) =>
            this.prisma.product.update({
              where: { id: update.id },
              data: update.data,
            })
          )
        );

        processed += batch.length;
        console.log(`[Batch Update] Batch ${i + 1}/${batches.length}: ${batch.length} products updated`);

        // Invalidate cache for updated products
        if (this.cacheManager) {
          for (const update of batch) {
            await this.cacheManager.invalidatePattern(`deals:product:${update.id}*`);
          }
        }
      } catch (error: any) {
        console.error(`[Batch Update] Batch ${i + 1} failed:`, error.message);
        errors.push({ index: i, error: error.message });
      }
    }

    const duration = Date.now() - startTime;

    return {
      total: updates.length,
      processed,
      failed: updates.length - processed,
      errors,
      duration,
    };
  }

  /**
   * Batch cache operations
   */
  async batchCacheSet(operations: BatchCacheOperation[]): Promise<BatchResult> {
    if (!this.cacheManager) {
      throw new Error('CacheManager not provided');
    }

    const startTime = Date.now();
    const batches = this.createBatches(operations, this.config.batchSize);
    let processed = 0;
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      try {
        await this.cacheManager.setMultiple(
          batch.map((op) => ({
            key: op.key,
            value: op.value!,
            ttl: op.ttl,
          }))
        );

        processed += batch.length;
      } catch (error: any) {
        console.error(`[Batch Cache] Batch ${i + 1} failed:`, error.message);
        errors.push({ index: i, error: error.message });
      }
    }

    const duration = Date.now() - startTime;

    return {
      total: operations.length,
      processed,
      failed: operations.length - processed,
      errors,
      duration,
    };
  }

  /**
   * Parallel batch processing
   */
  async processParallel<T, R>(
    items: T[],
    processFn: (item: T) => Promise<R>,
    options?: Partial<BatchConfig>
  ): Promise<BatchResult<R>> {
    const startTime = Date.now();
    const maxConcurrent = options?.maxConcurrent || this.config.maxConcurrent;
    const results: R[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    const batches = this.createBatches(items, maxConcurrent);

    for (const batch of batches) {
      const promises = batch.map(async (item, index) => {
        try {
          const result = await processFn(item);
          return { success: true, result };
        } catch (error: any) {
          return { success: false, error: error.message, index };
        }
      });

      const batchResults = await Promise.all(promises);

      for (const result of batchResults) {
        if (result.success) {
          results.push(result.result);
        } else {
          errors.push({ index: result.index!, error: result.error! });
        }
      }
    }

    const duration = Date.now() - startTime;

    return {
      total: items.length,
      processed: results.length,
      failed: errors.length,
      errors,
      duration,
      results,
    };
  }

  /**
   * Batch delete products
   */
  async batchDeleteProducts(productIds: string[]): Promise<BatchResult> {
    const startTime = Date.now();
    const batches = this.createBatches(productIds, this.config.batchSize);
    let processed = 0;
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      try {
        const result = await this.prisma.product.deleteMany({
          where: {
            id: { in: batch },
          },
        });

        processed += result.count;
        console.log(`[Batch Delete] Batch ${i + 1}/${batches.length}: ${result.count} products deleted`);

        // Invalidate cache
        if (this.cacheManager) {
          for (const id of batch) {
            await this.cacheManager.invalidatePattern(`deals:product:${id}*`);
          }
        }
      } catch (error: any) {
        console.error(`[Batch Delete] Batch ${i + 1} failed:`, error.message);
        errors.push({ index: i, error: error.message });
      }
    }

    const duration = Date.now() - startTime;

    return {
      total: productIds.length,
      processed,
      failed: productIds.length - processed,
      errors,
      duration,
    };
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Retry batch processing
   */
  private async retryBatch<T, R>(
    batch: T[],
    processFn: (batch: T[]) => Promise<R>,
    maxRetries: number
  ): Promise<{ success: boolean; result?: R; error?: string }> {
    for (let retry = 1; retry <= maxRetries; retry++) {
      try {
        console.log(`[Batch Processor] Retry ${retry}/${maxRetries}`);
        const result = await processFn(batch);
        console.log(`[Batch Processor] Retry ${retry} successful`);
        return { success: true, result };
      } catch (error: any) {
        console.error(`[Batch Processor] Retry ${retry} failed:`, error.message);

        if (retry === maxRetries) {
          return { success: false, error: error.message };
        }

        // Exponential backoff
        await this.delay(Math.pow(2, retry) * 1000);
      }
    }

    return { success: false, error: 'Max retries exceeded' };
  }

  /**
   * Get batch processor stats
   */
  getStats(): any {
    return {
      config: this.config,
    };
  }
}

export default BatchProcessor;
