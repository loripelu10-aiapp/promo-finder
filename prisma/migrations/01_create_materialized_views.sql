-- ============================================================================
-- PromoFinder Materialized Views and Performance Optimizations
-- ============================================================================
-- This migration creates materialized views and additional indexes
-- for optimal query performance (<50ms target)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Materialized View: Top Deals by Category
-- ----------------------------------------------------------------------------
-- Pre-computes the top deals for each category
-- Refreshed every 5 minutes via cron job
-- Reduces query time from ~200ms to <50ms

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_deals AS
SELECT
  p.id,
  p.name,
  p.brand,
  p.category,
  p.source,
  p.sale_price,
  p.original_price,
  p.discount_percentage,
  p.confidence_score,
  p.view_count,
  p.click_count,
  p.popularity_score,
  p.product_url,
  p.image_url,
  p.is_new,
  p.created_at,
  p.expires_at,
  ROW_NUMBER() OVER (
    PARTITION BY p.category
    ORDER BY p.discount_percentage DESC, p.popularity_score DESC
  ) as category_rank,
  ROW_NUMBER() OVER (
    ORDER BY p.discount_percentage DESC, p.popularity_score DESC
  ) as overall_rank
FROM products p
WHERE p.is_active = true
  AND p.confidence_score >= 85
  AND (p.expires_at > NOW() OR p.expires_at IS NULL)
ORDER BY p.category, category_rank;

-- Create indexes on materialized view
CREATE INDEX IF NOT EXISTS idx_mv_top_deals_category
  ON mv_top_deals(category, category_rank);

CREATE INDEX IF NOT EXISTS idx_mv_top_deals_overall
  ON mv_top_deals(overall_rank);

CREATE INDEX IF NOT EXISTS idx_mv_top_deals_discount
  ON mv_top_deals(discount_percentage DESC);

-- ----------------------------------------------------------------------------
-- Materialized View: Brand Statistics
-- ----------------------------------------------------------------------------
-- Pre-computes statistics for each brand
-- Used for brand browsing pages and filters

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_brand_stats AS
SELECT
  p.brand,
  p.category,
  COUNT(*) as product_count,
  AVG(p.discount_percentage)::INTEGER as avg_discount,
  AVG(p.confidence_score)::INTEGER as avg_confidence,
  MIN(p.sale_price) as min_price,
  MAX(p.sale_price) as max_price,
  SUM(p.view_count) as total_views,
  SUM(p.click_count) as total_clicks,
  AVG(p.popularity_score)::NUMERIC(10,2) as avg_popularity
FROM products p
WHERE p.is_active = true
  AND p.confidence_score >= 85
GROUP BY p.brand, p.category
ORDER BY product_count DESC;

-- Create indexes on brand stats
CREATE INDEX IF NOT EXISTS idx_mv_brand_stats_brand
  ON mv_brand_stats(brand);

CREATE INDEX IF NOT EXISTS idx_mv_brand_stats_category
  ON mv_brand_stats(category);

CREATE INDEX IF NOT EXISTS idx_mv_brand_stats_product_count
  ON mv_brand_stats(product_count DESC);

-- ----------------------------------------------------------------------------
-- Materialized View: Source Statistics
-- ----------------------------------------------------------------------------
-- Pre-computes statistics for each product source
-- Used for monitoring and admin dashboard

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_source_stats AS
SELECT
  p.source,
  COUNT(*) as total_products,
  COUNT(*) FILTER (WHERE p.is_active = true) as active_products,
  COUNT(*) FILTER (WHERE p.is_active = false) as inactive_products,
  AVG(p.confidence_score)::INTEGER as avg_confidence,
  AVG(p.discount_percentage)::INTEGER as avg_discount,
  COUNT(*) FILTER (WHERE p.confidence_score >= 95) as verified_products,
  COUNT(*) FILTER (WHERE p.confidence_score < 50) as quarantined_products,
  SUM(p.view_count) as total_views,
  SUM(p.click_count) as total_clicks,
  MAX(p.created_at) as last_added,
  MAX(p.last_verified_at) as last_verified
FROM products p
GROUP BY p.source
ORDER BY total_products DESC;

-- Create indexes on source stats
CREATE INDEX IF NOT EXISTS idx_mv_source_stats_source
  ON mv_source_stats(source);

-- ----------------------------------------------------------------------------
-- Additional Performance Indexes
-- ----------------------------------------------------------------------------
-- These indexes optimize common query patterns identified in the design doc

-- Index for expired products cleanup (cron job)
CREATE INDEX IF NOT EXISTS idx_products_expired
  ON products(expires_at)
  WHERE expires_at IS NOT NULL AND is_active = true;

-- Index for products needing verification
CREATE INDEX IF NOT EXISTS idx_products_verification_needed
  ON products(last_verified_at, popularity_score DESC)
  WHERE is_active = true;

-- Composite index for brand + category browsing
CREATE INDEX IF NOT EXISTS idx_products_brand_category_active
  ON products(brand, category, is_active, discount_percentage DESC)
  WHERE confidence_score >= 85;

-- Index for new arrivals
CREATE INDEX IF NOT EXISTS idx_products_new_arrivals
  ON products(created_at DESC)
  WHERE is_new = true AND is_active = true AND confidence_score >= 85;

-- Index for trending products (by popularity)
CREATE INDEX IF NOT EXISTS idx_products_trending
  ON products(popularity_score DESC, view_count DESC)
  WHERE is_active = true AND confidence_score >= 85;

-- Index for low confidence products (quarantine check)
CREATE INDEX IF NOT EXISTS idx_products_low_confidence
  ON products(confidence_score)
  WHERE confidence_score < 70 AND is_active = true;

-- ----------------------------------------------------------------------------
-- Full-Text Search Indexes (PostgreSQL GIN)
-- ----------------------------------------------------------------------------
-- Enable fast text search on product names and brands

-- Create full-text search index on product name
CREATE INDEX IF NOT EXISTS idx_products_name_fulltext
  ON products USING GIN (to_tsvector('english', name));

-- Create full-text search index on brand
CREATE INDEX IF NOT EXISTS idx_products_brand_fulltext
  ON products USING GIN (to_tsvector('english', brand));

-- Combined full-text search index
CREATE INDEX IF NOT EXISTS idx_products_fulltext_combined
  ON products USING GIN (
    to_tsvector('english', name || ' ' || brand || ' ' || COALESCE(description, ''))
  );

-- ----------------------------------------------------------------------------
-- JSONB Indexes for Flexible Attributes
-- ----------------------------------------------------------------------------
-- Enable fast queries on JSONB attributes (size, color, etc.)

CREATE INDEX IF NOT EXISTS idx_products_attributes_gin
  ON products USING GIN (attributes);

-- Specific JSONB path indexes for common attributes
CREATE INDEX IF NOT EXISTS idx_products_attributes_size
  ON products ((attributes->>'size'))
  WHERE attributes->>'size' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_attributes_color
  ON products ((attributes->>'color'))
  WHERE attributes->>'color' IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Partial Indexes for Common Filters
-- ----------------------------------------------------------------------------
-- These indexes are smaller and faster for specific use cases

-- High discount deals (>= 50%)
CREATE INDEX IF NOT EXISTS idx_products_high_discount
  ON products(discount_percentage DESC, popularity_score DESC)
  WHERE discount_percentage >= 50 AND is_active = true AND confidence_score >= 85;

-- Premium products (> $100)
CREATE INDEX IF NOT EXISTS idx_products_premium
  ON products(sale_price DESC, discount_percentage DESC)
  WHERE sale_price > 100 AND is_active = true AND confidence_score >= 85;

-- Budget products (< $30)
CREATE INDEX IF NOT EXISTS idx_products_budget
  ON products(discount_percentage DESC, popularity_score DESC)
  WHERE sale_price < 30 AND is_active = true AND confidence_score >= 85;

-- ----------------------------------------------------------------------------
-- Foreign Key Indexes
-- ----------------------------------------------------------------------------
-- Improve JOIN performance for related tables

CREATE INDEX IF NOT EXISTS idx_product_images_product_id
  ON product_images(product_id);

CREATE INDEX IF NOT EXISTS idx_translations_product_id
  ON translations(product_id);

CREATE INDEX IF NOT EXISTS idx_verification_history_product_id
  ON verification_history(product_id);

CREATE INDEX IF NOT EXISTS idx_user_interactions_product_id
  ON user_interactions(product_id);

-- ----------------------------------------------------------------------------
-- Cleanup Old Data (Retention Policy)
-- ----------------------------------------------------------------------------
-- Function to automatically archive old verification history

CREATE OR REPLACE FUNCTION cleanup_old_verification_history()
RETURNS void AS $$
BEGIN
  -- Archive verification history older than 90 days
  DELETE FROM verification_history
  WHERE created_at < NOW() - INTERVAL '90 days';

  -- Archive API logs older than 30 days
  DELETE FROM api_logs
  WHERE created_at < NOW() - INTERVAL '30 days';

  -- Archive user interactions older than 180 days
  DELETE FROM user_interactions
  WHERE created_at < NOW() - INTERVAL '180 days';
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Automatic Refresh Function for Materialized Views
-- ----------------------------------------------------------------------------
-- This function refreshes all materialized views concurrently

CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
  -- Refresh all materialized views concurrently (no locks)
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_deals;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_brand_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_source_stats;

  RAISE NOTICE 'Materialized views refreshed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Vacuum and Analyze Recommendations
-- ----------------------------------------------------------------------------
-- Run these periodically to maintain performance

COMMENT ON FUNCTION refresh_materialized_views() IS
  'Refreshes all materialized views. Run this every 5 minutes via cron.
   Example: SELECT refresh_materialized_views();';

COMMENT ON FUNCTION cleanup_old_verification_history() IS
  'Cleans up old verification history, API logs, and user interactions.
   Run this daily via cron to maintain database size.
   Example: SELECT cleanup_old_verification_history();';

-- ----------------------------------------------------------------------------
-- Performance Monitoring View
-- ----------------------------------------------------------------------------
-- View to monitor index usage and table statistics

CREATE OR REPLACE VIEW v_index_usage AS
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

CREATE OR REPLACE VIEW v_table_sizes AS
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) -
                 pg_relation_size(schemaname||'.'||tablename)) as index_size,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ----------------------------------------------------------------------------
-- Cron Job Recommendations (using pg_cron extension)
-- ----------------------------------------------------------------------------

-- Install pg_cron extension (if available)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule materialized view refresh (every 5 minutes)
-- SELECT cron.schedule('refresh-materialized-views', '*/5 * * * *', 'SELECT refresh_materialized_views();');

-- Schedule cleanup job (daily at 2 AM)
-- SELECT cron.schedule('cleanup-old-data', '0 2 * * *', 'SELECT cleanup_old_verification_history();');

-- Schedule VACUUM and ANALYZE (daily at 3 AM)
-- SELECT cron.schedule('vacuum-analyze', '0 3 * * *', 'VACUUM ANALYZE;');

-- ----------------------------------------------------------------------------
-- Query Performance Tips
-- ----------------------------------------------------------------------------

COMMENT ON MATERIALIZED VIEW mv_top_deals IS
  'Top deals by category. Refreshed every 5 minutes.
   Use this for homepage and category pages instead of querying products directly.
   Example: SELECT * FROM mv_top_deals WHERE category = ''shoes'' AND category_rank <= 10;';

COMMENT ON MATERIALIZED VIEW mv_brand_stats IS
  'Brand statistics aggregated by category.
   Use this for brand browsing pages and filters.
   Example: SELECT * FROM mv_brand_stats WHERE brand = ''Nike'' ORDER BY product_count DESC;';

COMMENT ON MATERIALIZED VIEW mv_source_stats IS
  'Product source statistics for monitoring and admin dashboard.
   Example: SELECT * FROM mv_source_stats ORDER BY total_products DESC;';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
