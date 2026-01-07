/**
 * Cache Services Index
 * Unified export for all caching and performance modules
 */

// Core cache layers
export { L1MemoryCache } from './l1-memory';
export { L2RedisCache } from './l2-redis';
export { L3DatabaseCache } from './l3-database';

// Cache manager
export { CacheManager } from './cache-manager';
export { CacheInvalidation } from './invalidation';

// Performance optimization
export { QueryOptimizer } from './query-optimizer';
export { ConnectionPool } from './connection-pool';
export { BatchProcessor } from './batch-processor';
export { CompressionService } from './compression';

// Monitoring
export { MetricsTracker } from './metrics';
export { HealthMonitor } from './health';

// Middleware
export { CacheMiddleware } from './middleware';

// Types
export * from './types';

// Re-export for convenience
export type {
  CacheConfig,
  CacheMetrics,
  CacheHealthStatus,
  PerformanceMetrics,
} from './types';
