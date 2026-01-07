/**
 * Query Optimizer
 * Analyzes and optimizes database queries for performance
 */

import { Prisma } from '@prisma/client';
import { QueryOptimization } from './types';

export class QueryOptimizer {
  private config: QueryOptimization;
  private queryStats: Map<string, { count: number; totalTime: number; avgTime: number }>;

  constructor(config?: Partial<QueryOptimization>) {
    this.config = {
      useSelect: config?.useSelect !== undefined ? config.useSelect : true,
      useCursor: config?.useCursor !== undefined ? config.useCursor : true,
      batchSize: config?.batchSize || 50,
      indexHints: config?.indexHints || [],
    };

    this.queryStats = new Map();
  }

  /**
   * Optimize field selection - only fetch needed fields
   */
  optimizeSelect<T extends Record<string, any>>(
    fields: (keyof T)[]
  ): Record<string, boolean> {
    if (!this.config.useSelect || fields.length === 0) {
      return {};
    }

    return fields.reduce((select, field) => {
      select[field as string] = true;
      return select;
    }, {} as Record<string, boolean>);
  }

  /**
   * Optimize pagination using cursor-based approach
   */
  optimizePagination(
    page: number = 1,
    pageSize: number = 50,
    useCursor: boolean = false
  ): { take: number; skip?: number; cursor?: any } {
    if (!useCursor || !this.config.useCursor) {
      // Offset-based pagination
      return {
        take: Math.min(pageSize, this.config.batchSize),
        skip: (page - 1) * pageSize,
      };
    }

    // Cursor-based pagination (more efficient for large datasets)
    return {
      take: Math.min(pageSize, this.config.batchSize),
    };
  }

  /**
   * Build optimized where clause with proper indexing
   */
  optimizeWhere(filters: Record<string, any>): Record<string, any> {
    const where: Record<string, any> = {};

    // Sort filters to use indexed columns first
    const indexedColumns = [
      'isActive',
      'category',
      'source',
      'brand',
      'discountPercentage',
      'confidenceScore',
    ];

    // Apply indexed filters first
    for (const col of indexedColumns) {
      if (filters[col] !== undefined) {
        where[col] = filters[col];
      }
    }

    // Apply remaining filters
    for (const [key, value] of Object.entries(filters)) {
      if (!indexedColumns.includes(key)) {
        where[key] = value;
      }
    }

    return where;
  }

  /**
   * Optimize order by clause
   */
  optimizeOrderBy(
    sortBy: string = 'relevance',
    order: 'asc' | 'desc' = 'desc'
  ): any[] {
    const orderByMap: Record<string, any[]> = {
      relevance: [
        { popularityScore: 'desc' },
        { discountPercentage: 'desc' },
        { createdAt: 'desc' },
      ],
      priceLow: [{ salePrice: 'asc' }],
      priceHigh: [{ salePrice: 'desc' }],
      discountHigh: [{ discountPercentage: 'desc' }],
      newest: [{ createdAt: 'desc' }],
      popular: [{ popularityScore: 'desc' }],
      confidence: [{ confidenceScore: 'desc' }],
    };

    return orderByMap[sortBy] || orderByMap.relevance;
  }

  /**
   * Optimize include/relations loading
   */
  optimizeInclude(includeRelations: string[] = []): Record<string, any> {
    const include: Record<string, any> = {};

    for (const relation of includeRelations) {
      switch (relation) {
        case 'images':
          include.images = {
            where: { imageStatus: 'validated' },
            orderBy: { isPrimary: 'desc' },
            take: 1, // Only primary image
          };
          break;

        case 'translations':
          include.translations = {
            take: 10, // Limit translations
          };
          break;

        case 'verificationHistory':
          include.verificationHistory = {
            orderBy: { createdAt: 'desc' },
            take: 5, // Only recent verifications
          };
          break;

        default:
          include[relation] = true;
      }
    }

    return include;
  }

  /**
   * Build optimized query for product listing
   */
  buildProductListQuery(params: {
    category?: string;
    brand?: string;
    minDiscount?: number;
    maxPrice?: number;
    source?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
  }): any {
    const {
      category,
      brand,
      minDiscount = 0,
      maxPrice,
      source,
      page = 1,
      pageSize = 50,
      sortBy = 'relevance',
    } = params;

    // Build optimized where clause
    const where: any = {
      isActive: true,
      confidenceScore: { gte: 85 },
      discountPercentage: { gte: minDiscount },
    };

    if (category) where.category = category;
    if (brand) where.brand = { equals: brand, mode: 'insensitive' };
    if (maxPrice) where.salePrice = { lte: maxPrice };
    if (source) where.source = source;

    // Add expiration check
    where.OR = [
      { expiresAt: { gt: new Date() } },
      { expiresAt: null },
    ];

    // Build query
    return {
      where: this.optimizeWhere(where),
      include: this.optimizeInclude(['images']),
      orderBy: this.optimizeOrderBy(sortBy),
      ...this.optimizePagination(page, pageSize),
    };
  }

  /**
   * Track query performance
   */
  trackQuery(queryName: string, executionTime: number): void {
    const stats = this.queryStats.get(queryName) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
    };

    stats.count++;
    stats.totalTime += executionTime;
    stats.avgTime = stats.totalTime / stats.count;

    this.queryStats.set(queryName, stats);
  }

  /**
   * Get query statistics
   */
  getQueryStats(queryName?: string): any {
    if (queryName) {
      return this.queryStats.get(queryName) || null;
    }

    const stats: any = {};
    this.queryStats.forEach((value, key) => {
      stats[key] = value;
    });
    return stats;
  }

  /**
   * Analyze slow queries
   */
  getSlowQueries(thresholdMs: number = 100): Array<{
    query: string;
    avgTime: number;
    count: number;
  }> {
    const slowQueries: Array<{ query: string; avgTime: number; count: number }> = [];

    this.queryStats.forEach((stats, query) => {
      if (stats.avgTime > thresholdMs) {
        slowQueries.push({
          query,
          avgTime: Math.round(stats.avgTime),
          count: stats.count,
        });
      }
    });

    return slowQueries.sort((a, b) => b.avgTime - a.avgTime);
  }

  /**
   * Reset query statistics
   */
  resetStats(): void {
    this.queryStats.clear();
  }

  /**
   * Estimate query cost (rough approximation)
   */
  estimateQueryCost(query: any): number {
    let cost = 1;

    // Add cost for where conditions
    if (query.where) {
      cost += Object.keys(query.where).length * 0.5;
    }

    // Add cost for relations
    if (query.include) {
      cost += Object.keys(query.include).length * 2;
    }

    // Add cost for ordering
    if (query.orderBy) {
      cost += Array.isArray(query.orderBy) ? query.orderBy.length : 1;
    }

    // Add cost for pagination
    if (query.skip) {
      cost += query.skip / 100; // Offset is expensive
    }

    return Math.round(cost * 10) / 10;
  }

  /**
   * Suggest query improvements
   */
  suggestImprovements(query: any): string[] {
    const suggestions: string[] = [];

    // Check for large offsets
    if (query.skip && query.skip > 1000) {
      suggestions.push('Consider using cursor-based pagination instead of offset');
    }

    // Check for missing select
    if (!query.select) {
      suggestions.push('Use select to fetch only needed fields');
    }

    // Check for excessive includes
    if (query.include && Object.keys(query.include).length > 3) {
      suggestions.push('Reduce number of included relations');
    }

    // Check for full table scan
    if (!query.where || Object.keys(query.where).length === 0) {
      suggestions.push('Add where conditions to use indexes');
    }

    return suggestions;
  }

  /**
   * Build search query with full-text search optimization
   */
  buildSearchQuery(searchTerm: string, fields: string[] = ['name', 'brand']): any {
    // For PostgreSQL, we could use full-text search
    // For now, using case-insensitive contains
    const searchLower = searchTerm.toLowerCase();

    return {
      OR: fields.map((field) => ({
        [field]: {
          contains: searchLower,
          mode: 'insensitive' as const,
        },
      })),
    };
  }

  /**
   * Optimize batch operations
   */
  optimizeBatchSize(totalItems: number, maxBatchSize?: number): number {
    const defaultBatchSize = this.config.batchSize;
    const max = maxBatchSize || 100;

    if (totalItems <= defaultBatchSize) {
      return totalItems;
    }

    if (totalItems > max) {
      return max;
    }

    return defaultBatchSize;
  }
}

export default QueryOptimizer;
