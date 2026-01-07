/**
 * L3 Database Cache Implementation
 * Materialized views refresh and management
 */

import { PrismaClient } from '@prisma/client';
import { L3CacheConfig, L3Stats, MaterializedView } from './types';

export class L3DatabaseCache {
  private prisma: PrismaClient;
  private config: Required<L3CacheConfig>;
  private refreshTimers: Map<string, NodeJS.Timer> = new Map();
  private lastRefresh: Map<string, Date> = new Map();
  private refreshDurations: Map<string, number> = new Map();
  private rowCounts: Map<string, number> = new Map();

  // Define materialized views
  private views: MaterializedView[] = [
    {
      name: 'mv_top_deals',
      query: `
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_deals AS
        SELECT
          p.id,
          p.name,
          p.brand,
          p.category,
          p.source,
          p.original_price,
          p.sale_price,
          p.discount_percentage,
          p.product_url,
          p.image_url,
          p.confidence_score,
          p.popularity_score,
          p.view_count,
          p.click_count,
          p.created_at
        FROM products p
        WHERE p.is_active = true
          AND p.confidence_score >= 85
          AND (p.expires_at IS NULL OR p.expires_at > NOW())
        ORDER BY p.discount_percentage DESC, p.popularity_score DESC
        LIMIT 100;

        CREATE INDEX IF NOT EXISTS idx_mv_top_deals_category
          ON mv_top_deals(category);
        CREATE INDEX IF NOT EXISTS idx_mv_top_deals_brand
          ON mv_top_deals(brand);
      `,
      refreshInterval: 3600000, // 1 hour
      lastRefresh: null,
      rowCount: 0,
      concurrent: true,
    },
    {
      name: 'mv_brand_stats',
      query: `
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_brand_stats AS
        SELECT
          brand,
          category,
          COUNT(*) as total_products,
          AVG(discount_percentage)::int as avg_discount,
          AVG(confidence_score)::int as avg_confidence,
          SUM(view_count) as total_views,
          SUM(click_count) as total_clicks,
          MAX(created_at) as last_added
        FROM products
        WHERE is_active = true
        GROUP BY brand, category;

        CREATE INDEX IF NOT EXISTS idx_mv_brand_stats_brand
          ON mv_brand_stats(brand);
      `,
      refreshInterval: 3600000, // 1 hour
      lastRefresh: null,
      rowCount: 0,
      concurrent: true,
    },
    {
      name: 'mv_source_stats',
      query: `
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_source_stats AS
        SELECT
          source,
          category,
          COUNT(*) as total_products,
          AVG(discount_percentage)::int as avg_discount,
          AVG(confidence_score)::int as avg_confidence,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_products,
          MAX(created_at) as last_scraped
        FROM products
        GROUP BY source, category;

        CREATE INDEX IF NOT EXISTS idx_mv_source_stats_source
          ON mv_source_stats(source);
      `,
      refreshInterval: 3600000, // 1 hour
      lastRefresh: null,
      rowCount: 0,
      concurrent: true,
    },
  ];

  constructor(prisma: PrismaClient, config: L3CacheConfig) {
    this.prisma = prisma;
    this.config = {
      refreshInterval: config.refreshInterval || 3600000, // 1 hour default
      enabled: config.enabled !== undefined ? config.enabled : true,
    };
  }

  /**
   * Initialize materialized views
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[L3 Database] Disabled - skipping initialization');
      return;
    }

    console.log('[L3 Database] Initializing materialized views...');

    for (const view of this.views) {
      try {
        // Create materialized view if not exists
        await this.createMaterializedView(view);

        // Initial refresh
        await this.refreshView(view.name);

        console.log(`[L3 Database] Initialized view: ${view.name}`);
      } catch (error: any) {
        console.error(`[L3 Database] Failed to initialize ${view.name}:`, error.message);
      }
    }

    console.log('[L3 Database] All views initialized');
  }

  /**
   * Create materialized view
   */
  private async createMaterializedView(view: MaterializedView): Promise<void> {
    try {
      // Execute the CREATE MATERIALIZED VIEW statement
      await this.prisma.$executeRawUnsafe(view.query);
    } catch (error: any) {
      // Ignore "already exists" errors
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }
  }

  /**
   * Refresh a single materialized view
   */
  async refreshView(viewName: string): Promise<void> {
    const view = this.views.find((v) => v.name === viewName);
    if (!view) {
      throw new Error(`View ${viewName} not found`);
    }

    const startTime = Date.now();

    try {
      // Use CONCURRENTLY to avoid locking
      const refreshQuery = view.concurrent
        ? `REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}`
        : `REFRESH MATERIALIZED VIEW ${viewName}`;

      await this.prisma.$executeRawUnsafe(refreshQuery);

      const duration = Date.now() - startTime;

      // Update metadata
      this.lastRefresh.set(viewName, new Date());
      this.refreshDurations.set(viewName, duration);

      // Get row count
      const result = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) as count FROM ${viewName}`
      );
      const rowCount = Number(result[0]?.count || 0);
      this.rowCounts.set(viewName, rowCount);

      console.log(
        `[L3 Database] Refreshed ${viewName}: ${rowCount} rows in ${duration}ms`
      );
    } catch (error: any) {
      console.error(`[L3 Database] Failed to refresh ${viewName}:`, error.message);
      throw error;
    }
  }

  /**
   * Refresh all materialized views
   */
  async refreshAllViews(): Promise<void> {
    console.log('[L3 Database] Refreshing all materialized views...');

    for (const view of this.views) {
      try {
        await this.refreshView(view.name);
      } catch (error: any) {
        console.error(`[L3 Database] Failed to refresh ${view.name}:`, error.message);
      }
    }

    console.log('[L3 Database] All views refreshed');
  }

  /**
   * Start automatic refresh for all views
   */
  startAutoRefresh(): void {
    if (!this.config.enabled) return;

    for (const view of this.views) {
      const interval = view.refreshInterval || this.config.refreshInterval;

      const timer = setInterval(async () => {
        try {
          await this.refreshView(view.name);
        } catch (error: any) {
          console.error(`[L3 Database] Auto-refresh failed for ${view.name}:`, error.message);
        }
      }, interval);

      this.refreshTimers.set(view.name, timer);
      console.log(`[L3 Database] Auto-refresh enabled for ${view.name} (${interval}ms)`);
    }
  }

  /**
   * Stop automatic refresh for all views
   */
  stopAutoRefresh(): void {
    for (const [viewName, timer] of this.refreshTimers.entries()) {
      clearInterval(timer);
      console.log(`[L3 Database] Auto-refresh stopped for ${viewName}`);
    }
    this.refreshTimers.clear();
  }

  /**
   * Query a materialized view
   */
  async query<T = any>(viewName: string, where?: string, limit?: number): Promise<T[]> {
    if (!this.config.enabled) {
      return [];
    }

    try {
      let query = `SELECT * FROM ${viewName}`;

      if (where) {
        query += ` WHERE ${where}`;
      }

      if (limit) {
        query += ` LIMIT ${limit}`;
      }

      const results = await this.prisma.$queryRawUnsafe<T[]>(query);
      return results;
    } catch (error: any) {
      console.error(`[L3 Database] Query error for ${viewName}:`, error.message);
      return [];
    }
  }

  /**
   * Get top deals from materialized view
   */
  async getTopDeals(limit: number = 50, category?: string): Promise<any[]> {
    const where = category ? `category = '${category}'` : undefined;
    return this.query('mv_top_deals', where, limit);
  }

  /**
   * Get brand statistics
   */
  async getBrandStats(brand?: string): Promise<any[]> {
    const where = brand ? `brand = '${brand}'` : undefined;
    return this.query('mv_brand_stats', where);
  }

  /**
   * Get source statistics
   */
  async getSourceStats(source?: string): Promise<any[]> {
    const where = source ? `source = '${source}'` : undefined;
    return this.query('mv_source_stats', where);
  }

  /**
   * Get cache statistics
   */
  getStats(): L3Stats {
    const views = this.views.map((v) => v.name);
    const totalRows = Array.from(this.rowCounts.values()).reduce((sum, count) => sum + count, 0);
    const avgDuration =
      Array.from(this.refreshDurations.values()).reduce((sum, dur) => sum + dur, 0) /
        (this.refreshDurations.size || 1);

    // Find most recent refresh
    let lastRefresh: Date | null = null;
    for (const date of this.lastRefresh.values()) {
      if (!lastRefresh || date > lastRefresh) {
        lastRefresh = date;
      }
    }

    return {
      lastRefresh,
      rowCount: totalRows,
      refreshDuration: Math.round(avgDuration),
      views,
    };
  }

  /**
   * Drop a materialized view
   */
  async dropView(viewName: string): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS ${viewName}`);
      console.log(`[L3 Database] Dropped view: ${viewName}`);
    } catch (error: any) {
      console.error(`[L3 Database] Failed to drop ${viewName}:`, error.message);
      throw error;
    }
  }

  /**
   * Drop all materialized views
   */
  async dropAllViews(): Promise<void> {
    for (const view of this.views) {
      try {
        await this.dropView(view.name);
      } catch (error: any) {
        console.error(`[L3 Database] Failed to drop ${view.name}:`, error.message);
      }
    }
  }

  /**
   * Check if a view exists
   */
  async viewExists(viewName: string): Promise<boolean> {
    try {
      const result = await this.prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
        `SELECT EXISTS (
          SELECT FROM pg_matviews
          WHERE matviewname = '${viewName}'
        ) as exists`
      );
      return result[0]?.exists || false;
    } catch {
      return false;
    }
  }

  /**
   * Get view metadata
   */
  async getViewMetadata(viewName: string): Promise<any> {
    try {
      const result = await this.prisma.$queryRawUnsafe(
        `SELECT * FROM pg_matviews WHERE matviewname = '${viewName}'`
      );
      return result;
    } catch (error: any) {
      console.error(`[L3 Database] Failed to get metadata for ${viewName}:`, error.message);
      return null;
    }
  }

  /**
   * Get all view names
   */
  getViewNames(): string[] {
    return this.views.map((v) => v.name);
  }

  /**
   * Check if enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}

export default L3DatabaseCache;
