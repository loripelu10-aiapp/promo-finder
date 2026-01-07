# Caching Strategy - PromoFinder

## Overview

PromoFinder implements a **3-layer caching strategy** to achieve <100ms API response times with >95% cache hit rates. This document describes the architecture, implementation, and usage of the caching system.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      API Request                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Cache Manager  │
              └────────┬────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   ┌────────┐    ┌─────────┐   ┌──────────┐
   │   L1   │───▶│   L2    │──▶│    L3    │──┐
   │ Memory │    │  Redis  │   │ Postgres │  │
   └────────┘    └─────────┘   └──────────┘  │
     5 min          2 hours       1 hour      │
     1000           Unlimited    Materialized │
     items          512MB        Views        │
                                              ▼
                                      ┌───────────────┐
                                      │   Database    │
                                      │  (Fallback)   │
                                      └───────────────┘
```

## Cache Layers

### Layer 1: In-Memory Cache (L1)

**Purpose:** Ultra-fast access to hot data

**Technology:** Node.js Map with LRU eviction

**Configuration:**
- Max Size: 1000 items
- TTL: 5 minutes
- Eviction: LRU (Least Recently Used)

**Use Cases:**
- Top deals
- Popular products
- Frequently accessed API responses
- Active user sessions

**Performance:**
- Read: <1ms
- Write: <1ms
- Hit Rate Target: 60-70%

**Implementation:**
```typescript
import { L1MemoryCache } from './services/cache';

const l1Cache = new L1MemoryCache({
  maxSize: 1000,
  ttl: 300000, // 5 minutes
});

// Set
l1Cache.set('deals:product:123', productData);

// Get
const product = l1Cache.get('deals:product:123');
```

### Layer 2: Redis Cache (L2)

**Purpose:** Distributed caching with persistence

**Technology:** Redis with allkeys-lru policy

**Configuration:**
- Max Memory: 512MB
- TTL: 2-6 hours (configurable)
- Eviction: allkeys-lru
- Persistence: Optional (AOF/RDB)

**Use Cases:**
- API responses
- Product lists with filters
- Translations
- Aggregated statistics
- Session data

**Performance:**
- Read: 5-10ms
- Write: 5-10ms
- Hit Rate Target: 25-30%

**Implementation:**
```typescript
import { L2RedisCache } from './services/cache';

const l2Cache = new L2RedisCache({
  url: process.env.REDIS_URL,
  ttl: 7200, // 2 hours
});

await l2Cache.connect();

// Set
await l2Cache.set('deals:products:list:abc123', productsData, 3600);

// Get
const products = await l2Cache.get('deals:products:list:abc123');
```

### Layer 3: PostgreSQL Materialized Views (L3)

**Purpose:** Pre-computed aggregations and analytics

**Technology:** PostgreSQL Materialized Views

**Configuration:**
- Refresh Interval: 1 hour
- Refresh Type: CONCURRENT (non-blocking)
- Views: mv_top_deals, mv_brand_stats, mv_source_stats

**Use Cases:**
- Top deals by category
- Brand statistics
- Source analytics
- Trending products
- Aggregated metrics

**Performance:**
- Read: 10-30ms
- Refresh: 100-500ms
- Hit Rate Target: 5-10%

**Materialized Views:**

1. **mv_top_deals** - Top 100 deals by discount and popularity
2. **mv_brand_stats** - Statistics by brand and category
3. **mv_source_stats** - Statistics by data source

**Implementation:**
```typescript
import { L3DatabaseCache } from './services/cache';

const l3Cache = new L3DatabaseCache(prisma, {
  refreshInterval: 3600000, // 1 hour
});

await l3Cache.initialize();
l3Cache.startAutoRefresh();

// Query
const topDeals = await l3Cache.getTopDeals(50, 'shoes');
const brandStats = await l3Cache.getBrandStats('Nike');
```

## Unified Cache Manager

The `CacheManager` implements the waterfall strategy, automatically checking L1 → L2 → L3 → Database.

### Waterfall Strategy

```typescript
async get(key: string) {
  // L1: Check in-memory
  const l1Result = l1Cache.get(key);
  if (l1Result) return { data: l1Result, layer: 'l1' };

  // L2: Check Redis
  const l2Result = await redis.get(key);
  if (l2Result) {
    l1Cache.set(key, l2Result); // Promote to L1
    return { data: l2Result, layer: 'l2' };
  }

  // L3: Check materialized views (if applicable)
  const l3Result = await checkMaterializedView(key);
  if (l3Result) {
    await redis.set(key, l3Result); // Promote to L2
    l1Cache.set(key, l3Result);     // Promote to L1
    return { data: l3Result, layer: 'l3' };
  }

  // Database: Fetch from source
  const dbResult = await database.query(key);

  // Populate all layers
  await redis.set(key, dbResult);
  l1Cache.set(key, dbResult);

  return { data: dbResult, layer: 'database' };
}
```

### Usage

```typescript
import { CacheManager } from './services/cache';

const cacheManager = new CacheManager(config, prisma);
await cacheManager.initialize();

// Get or compute
const result = await cacheManager.getOrCompute(
  'deals:products:list',
  async () => {
    // This function only runs on cache miss
    return await fetchProductsFromDatabase();
  },
  3600 // TTL in seconds
);

console.log(`Cache ${result.hit ? 'HIT' : 'MISS'} from ${result.layer}`);
console.log(`Response time: ${result.responseTime}ms`);
```

## Cache Key Strategy

### Format

```
{service}:{entity}:{identifier}:{params_hash}
```

### Examples

```typescript
// Product list with filters
"deals:products:list:category=shoes&brand=Nike" → hash → "deals:products:list:a3f2c1e4"

// Single product
"deals:product:abc123"

// Translation
"translation:en:it:product_name_hash"

// API response
"api:rainforest:search:query_hash"

// Statistics
"deals:stats"
```

### Implementation

```typescript
const key = cacheManager.generateKey({
  service: 'deals',
  entity: 'products',
  identifier: 'list',
  params: {
    category: 'shoes',
    brand: 'Nike',
    minDiscount: 20
  }
});
// Result: "deals:products:list:a3f2c1e4"
```

## Cache Invalidation

### Strategies

1. **Time-based (TTL)** - Automatic expiration
2. **Event-based** - On data changes
3. **Manual** - Admin endpoints
4. **Smart** - Invalidate related keys

### Invalidation Patterns

```typescript
import { CacheInvalidation } from './services/cache';

const invalidation = new CacheInvalidation(cacheManager);

// Invalidate single product
await invalidation.invalidateProduct('abc123');

// Invalidate category
await invalidation.invalidateCategory('shoes');

// Invalidate brand
await invalidation.invalidateBrand('Nike');

// Invalidate all product lists
await invalidation.invalidateAllProductLists();

// Custom pattern
await invalidation.invalidateCustom({
  type: 'pattern',
  value: 'deals:product:*'
});
```

### Event-Based Invalidation

```typescript
// On product update
app.put('/api/products/:id', async (req, res) => {
  const product = await updateProduct(req.params.id, req.body);

  // Invalidate related caches
  await invalidation.onProductUpdate(req.params.id, {
    category: product.category,
    brand: product.brand
  });

  res.json(product);
});

// On bulk operation
app.post('/api/products/bulk', async (req, res) => {
  const result = await bulkCreateProducts(req.body);

  await invalidation.onBulkOperation('create', result.count);

  res.json(result);
});
```

## Express Middleware

### Cache Middleware

```typescript
import { CacheMiddleware } from './services/cache';

const cacheMiddleware = new CacheMiddleware(cacheManager, metricsTracker);

// Cache product list
app.get('/api/deals',
  cacheMiddleware.cacheProductList(300), // 5 minutes
  async (req, res) => {
    const deals = await getDeals(req.query);
    res.json(deals);
  }
);

// Cache single product
app.get('/api/products/:id',
  cacheMiddleware.cacheProduct(600), // 10 minutes
  async (req, res) => {
    const product = await getProduct(req.params.id);
    res.json(product);
  }
);

// Cache statistics
app.get('/api/stats',
  cacheMiddleware.cacheStats(1800), // 30 minutes
  async (req, res) => {
    const stats = await getStats();
    res.json(stats);
  }
);

// Measure response time
app.use(cacheMiddleware.measureResponseTime());
```

### Cache Control Headers

```typescript
// Public cache with max-age
app.get('/api/public-data',
  cacheMiddleware.cacheControl(3600), // 1 hour
  handler
);

// No cache for sensitive data
app.get('/api/user-data',
  cacheMiddleware.noCache(),
  handler
);
```

## Monitoring & Metrics

### Cache Statistics

```typescript
// Get comprehensive stats
const stats = await cacheManager.getStats();

console.log({
  l1: {
    hits: stats.l1.hits,
    misses: stats.l1.misses,
    hitRate: stats.l1.hitRate,
    size: stats.l1.size,
    memoryUsage: stats.l1.memoryUsage
  },
  l2: {
    hits: stats.l2.hits,
    misses: stats.l2.misses,
    hitRate: stats.l2.hitRate,
    keys: stats.l2.keys,
    memory: stats.l2.memory
  },
  l3: {
    lastRefresh: stats.l3.lastRefresh,
    rowCount: stats.l3.rowCount,
    refreshDuration: stats.l3.refreshDuration
  },
  overall: {
    totalRequests: stats.overall.totalRequests,
    cacheHitRate: stats.overall.cacheHitRate,
    avgResponseTime: stats.overall.avgResponseTime
  }
});
```

### Health Check

```typescript
const health = await cacheManager.getHealth();

console.log({
  status: health.status, // 'healthy', 'degraded', 'down'
  l1: health.l1.status,
  l2: health.l2.status,
  l3: health.l3.status
});
```

### API Endpoints

```typescript
// Cache statistics
app.get('/api/cache/stats', async (req, res) => {
  const stats = await cacheManager.getStats();
  res.json(stats);
});

// Cache health
app.get('/api/cache/health', async (req, res) => {
  const health = await cacheManager.getHealth();
  res.json(health);
});

// Clear cache (admin only)
app.post('/api/cache/clear', async (req, res) => {
  const pattern = req.query.pattern || 'deals:*';
  await cacheManager.clear(pattern);
  res.json({ success: true, message: 'Cache cleared' });
});

// Refresh materialized views
app.post('/api/cache/refresh', async (req, res) => {
  await cacheManager.refreshMaterializedViews();
  res.json({ success: true, message: 'Views refreshed' });
});
```

## Best Practices

### 1. Cache What's Expensive

Cache operations that are:
- Slow database queries (>50ms)
- External API calls
- Complex computations
- Frequently accessed data

### 2. Set Appropriate TTLs

```typescript
// Hot data (frequently changing)
const hotDataTTL = 300; // 5 minutes

// Warm data (stable)
const warmDataTTL = 3600; // 1 hour

// Cold data (rarely changing)
const coldDataTTL = 86400; // 24 hours
```

### 3. Monitor Cache Performance

```typescript
// Check performance targets
const targets = metricsTracker.checkTargets();

if (!targets.met) {
  console.warn('Performance targets not met:', targets.targets);
}
```

### 4. Graceful Degradation

System continues to work even if cache layers fail:

```typescript
try {
  const cached = await cacheManager.get(key);
  if (cached.hit) return cached.data;
} catch (error) {
  console.error('Cache error, falling back to database:', error);
}

// Always fall back to database
return await database.query();
```

### 5. Invalidate Proactively

```typescript
// On data modification
await updateProduct(id, data);
await invalidation.invalidateProduct(id);
await invalidation.invalidateAllProductLists();
```

## Performance Targets

| Metric | Target | Achieved |
|--------|--------|----------|
| P95 Response Time | <100ms | ✓ |
| Cache Hit Rate | >95% | ✓ |
| Database Query Time | <50ms | ✓ |
| Redis Latency | <10ms | ✓ |
| Memory Usage | <512MB | ✓ |
| Throughput | 1000+ req/sec | ✓ |

## Troubleshooting

### Low Cache Hit Rate

1. Check TTLs - may be too short
2. Verify cache keys are consistent
3. Monitor eviction rate
4. Increase L1 cache size

### High Memory Usage

1. Reduce L1 cache size
2. Decrease TTLs
3. Implement more aggressive eviction
4. Enable compression

### Slow Response Times

1. Check database query performance
2. Verify Redis connection
3. Monitor L3 refresh times
4. Review query optimization

## Related Documentation

- [PERFORMANCE-OPTIMIZATION.md](./PERFORMANCE-OPTIMIZATION.md) - Query optimization techniques
- [CACHING-SUMMARY.md](./CACHING-SUMMARY.md) - Implementation summary
