/**
 * Cache Types and Interfaces
 * Multi-layer caching strategy for PromoFinder
 */

export interface CacheConfig {
  l1?: L1CacheConfig;
  l2?: L2CacheConfig;
  l3?: L3CacheConfig;
}

export interface L1CacheConfig {
  maxSize: number; // Max items in memory
  ttl: number; // Time to live in milliseconds
  enabled?: boolean;
}

export interface L2CacheConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  ttl: number; // Time to live in seconds
  maxMemory?: string;
  enabled?: boolean;
}

export interface L3CacheConfig {
  refreshInterval: number; // Refresh interval in milliseconds
  enabled?: boolean;
}

export interface CacheEntry<T = any> {
  value: T;
  timestamp: number;
  ttl: number;
  hits?: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  evictions?: number;
}

export interface L1Stats extends CacheStats {
  maxSize: number;
  memoryUsage: number; // Bytes
}

export interface L2Stats extends CacheStats {
  memory: string;
  keys: number;
  connected: boolean;
}

export interface L3Stats {
  lastRefresh: Date | null;
  rowCount: number;
  refreshDuration: number; // milliseconds
  views: string[];
}

export interface CacheMetrics {
  l1: L1Stats;
  l2: L2Stats;
  l3: L3Stats;
  overall: {
    totalRequests: number;
    cacheHitRate: number;
    avgResponseTime: number;
    lastReset: Date;
  };
}

export interface CacheHealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  l1: {
    status: 'healthy' | 'degraded' | 'down';
    message?: string;
  };
  l2: {
    status: 'healthy' | 'degraded' | 'down';
    message?: string;
  };
  l3: {
    status: 'healthy' | 'degraded' | 'down';
    message?: string;
  };
  timestamp: Date;
}

export interface CacheKeyOptions {
  service: string;
  entity: string;
  identifier: string | number;
  params?: Record<string, any>;
}

export type CacheLayer = 'l1' | 'l2' | 'l3' | 'database';

export interface CacheGetResult<T = any> {
  data: T | null;
  hit: boolean;
  layer?: CacheLayer;
  responseTime: number;
}

export interface InvalidationPattern {
  type: 'exact' | 'prefix' | 'pattern' | 'tag';
  value: string | string[];
}

export interface BatchCacheOperation<T = any> {
  key: string;
  value?: T;
  ttl?: number;
}

export interface CompressionOptions {
  enabled: boolean;
  threshold: number; // bytes - only compress if size > threshold
  level?: number; // compression level 0-9
}

export interface QueryOptimization {
  useSelect: boolean; // Only fetch needed fields
  useCursor: boolean; // Cursor-based pagination
  batchSize: number; // Batch size for operations
  indexHints?: string[]; // Database index hints
}

export interface PerformanceMetrics {
  queryTime: number;
  cacheTime: number;
  serializationTime: number;
  compressionTime?: number;
  totalTime: number;
}

export interface MaterializedView {
  name: string;
  query: string;
  refreshInterval: number; // milliseconds
  lastRefresh: Date | null;
  rowCount: number;
  concurrent: boolean; // REFRESH MATERIALIZED VIEW CONCURRENTLY
}

export interface CacheWarmupConfig {
  enabled: boolean;
  keys: string[];
  onStartup: boolean;
  schedule?: string; // cron expression
}

// Export type guards
export function isCacheEntry<T>(value: any): value is CacheEntry<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    'timestamp' in value &&
    'ttl' in value
  );
}

export function isExpired(entry: CacheEntry): boolean {
  if (entry.ttl === 0) return false; // Never expires
  return Date.now() - entry.timestamp > entry.ttl;
}
