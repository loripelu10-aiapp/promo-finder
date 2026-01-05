# PromoFinder Production System - Design Document

**Date:** 2026-01-06
**Version:** 1.0
**Status:** Approved for Implementation

---

## Executive Summary

This document outlines the architecture for scaling PromoFinder from 10 manually curated products to a production-ready system with 1000+ products, 95-99% accuracy, and <100ms response times. The system will use premium shopping APIs, PostgreSQL + Redis infrastructure, and a confidence-based verification system inspired by proven deal aggregators like Slickdeals and Honey.

**Key Objectives:**
- **Scale:** 10 → 1000+ products
- **Accuracy:** 95-99% (near-100% with confidence scoring)
- **Performance:** <100ms API response time (95th percentile)
- **Cost:** ~$150/month at full scale
- **Languages:** 6 languages (en, it, es, fr, de, pt)
- **Deployment:** MVP in 4 weeks using parallel agent development

---

## Table of Contents

1. [Research & Context](#research--context)
2. [Architecture Overview](#architecture-overview)
3. [Database Design](#database-design)
4. [API Integration Strategy](#api-integration-strategy)
5. [Verification System](#verification-system)
6. [Performance Optimization](#performance-optimization)
7. [Agent Development Workflow](#agent-development-workflow)
8. [Success Metrics](#success-metrics)
9. [Risk Mitigation](#risk-mitigation)

---

## Research & Context

### Problem Analysis

The current system has 10 manually verified products with working images and URLs. To scale 100x while maintaining accuracy, we face several challenges:

**Key Findings from Market Research:**

1. **100% accuracy is impossible in real-time e-commerce** ([source](https://slickdeals.net/corp/how-slickdeals-works/))
   - Products go out of stock every minute
   - Prices change without warning
   - Images get removed/updated
   - **Solution:** Confidence scoring system (70% → 95% → 99%)

2. **Deal aggregators use hybrid verification** ([Slickdeals](https://help.slickdeals.net/hc/en-us/articles/115004710094-How-Does-a-Deal-Become-a-Frontpage-Deal), [Honey](https://help.joinhoney.com/article/39-what-is-the-honey-extension-and-how-do-i-get-it))
   - Slickdeals: Community voting + human editors
   - Honey: Automated code testing (with known accuracy issues per BBB)
   - **Solution:** Multi-layer verification with AI assistance

3. **API costs scale linearly** ([RapidAPI](https://rapidapi.com/collection/essential-ecommerce-apis), [Rainforest](https://www.rainforestapi.com/))
   - Refreshing 1000 products every 2 min = 720k API calls/day = expensive
   - **Solution:** Prioritized refresh schedule (top deals more frequently)

4. **PostgreSQL + Redis is proven for high-read workloads** ([source](https://medium.com/@DevBoostLab/postgresql-17-performance-upgrade-2026-f4222e71f577))
   - shared_buffers: 25% RAM
   - effective_cache_size: 75% RAM
   - Materialized views for complex queries
   - **Solution:** Multi-layer caching (L1: in-memory, L2: Redis, L3: PostgreSQL)

### Trade-off Decisions

| Decision | Option Chosen | Rationale |
|----------|---------------|-----------|
| Accuracy vs Speed | 95-99% accuracy, <100ms response | Users prefer fast results with confidence scores |
| API vs Scraping | Premium APIs + manual curation | APIs more reliable, scraping has anti-bot issues |
| Database | PostgreSQL + Redis | Proven for read-heavy workloads, good tooling |
| Deployment | Railway.app | Simplest for MVP, easy scaling path |
| Real-time verification | Background async | Blocking verification too slow (2-5s) |

---

## Architecture Overview

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                          │
│              React + Vite + TypeScript                       │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼────────┐       ┌───────▼────────┐
│  CDN (Images)  │       │  Load Balancer │
│  Cloudflare    │       │   Railway.app  │
└────────────────┘       └───────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
            ┌───────▼────────┐       ┌───────▼────────┐
            │  API Server 1  │       │  API Server 2  │
            │ Node + Express │       │ Node + Express │
            │   TypeScript   │       │   TypeScript   │
            └───────┬────────┘       └───────┬────────┘
                    │                         │
                    └────────────┬────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │                                  │
        ┌───────▼────────┐              ┌────────▼────────┐
        │  Redis Cache   │              │   PostgreSQL    │
        │  (Upstash)     │              │   (Railway)     │
        │                │              │                 │
        │ • L2 Cache     │              │ • Products      │
        │ • Rate Limit   │              │ • Translations  │
        │ • Sessions     │              │ • Verifications │
        └────────────────┘              └─────────────────┘
                                                  │
                                        ┌─────────▼─────────┐
                                        │  Background Jobs  │
                                        │   (Bull Queue)    │
                                        │                   │
                                        │ • Verification    │
                                        │ • API Refresh     │
                                        │ • Translation     │
                                        └───────────────────┘
```

### Request Flow (Optimized for Speed)

```
User Request: GET /api/deals?category=shoes&minDiscount=30
     │
     ▼
[L1: In-Memory LRU Cache] ─── HIT ──→ Response (1-5ms) ✅
     │ MISS
     ▼
[L2: Redis Cache] ─────────── HIT ──→ Response (5-15ms) ✅
     │ MISS
     ▼
[PostgreSQL Materialized View] ────→ Response (50-200ms) ✅
     │
     ▼
[Background: Trigger cache warming]
[Background: Queue verification for stale products]
```

### Technology Stack

**Backend:**
- **Runtime:** Node.js 20+ with TypeScript
- **Framework:** Express.js with async/await
- **ORM:** Prisma (type-safe, migrations, introspection)
- **Validation:** Zod for runtime type checking
- **Jobs:** Bull queue with Redis backend
- **Testing:** Jest (unit), Supertest (integration), Playwright (E2E)

**Frontend:**
- **Framework:** React 18 with Vite
- **Language:** TypeScript
- **State:** Zustand (lightweight, performant)
- **i18n:** react-i18next
- **UI:** TailwindCSS + HeadlessUI
- **Testing:** Vitest + React Testing Library

**Infrastructure:**
- **Database:** PostgreSQL 17 on Railway
- **Cache:** Redis (Upstash) with ioredis client
- **Hosting:** Railway.app (backend + database)
- **Frontend:** Railway static hosting or Vercel
- **CDN:** Cloudflare (free tier)
- **Monitoring:** Sentry (errors), Upstash Analytics (Redis)

**External APIs:**
- **Shopping Data:** RapidAPI shopping endpoints ($59-99/month)
- **Amazon Data:** Rainforest API ($20-50/month)
- **Translation:** DeepL API (free tier: 500k chars/month)
- **Image Validation:** Claude API with Vision (for broken image detection)

---

## Database Design

### PostgreSQL Schema

See `/prisma/schema.prisma` for full implementation. Key tables:

**Core Tables:**
- `products` - Main product catalog (partitioned by source)
- `product_images` - Image URLs with validation status
- `translations` - Multi-language support
- `verification_history` - Audit trail of all checks
- `api_logs` - API usage and cost tracking
- `user_interactions` - Analytics for popularity scoring

**Performance Features:**
- **Partitioning:** Products table partitioned by source (amazon, nike, zara, etc.)
- **Indexing:** Composite indexes on common query patterns
- **Materialized Views:** Pre-computed top deals, brand stats
- **JSONB:** Flexible attributes without schema changes

### Confidence Scoring Algorithm

```typescript
function calculateConfidence(product: Product, checks: VerificationChecks): number {
  let score = 70; // Base score from API data

  // +15 for verified image
  if (checks.image.status === 'success' && checks.image.isValidImage) {
    score += 15;
  }

  // +10 for verified URL
  if (checks.url.status === 'success' && checks.url.httpStatus === 200) {
    score += 10;
  }

  // +5 for recent check (within 1 hour)
  if (product.lastVerifiedAt > Date.now() - 3600000) {
    score += 5;
  }

  // +10 for manual curation
  if (product.source === 'manual') {
    score += 10;
  }

  // -20 for failed checks
  if (checks.url.status === 'failed') score -= 20;
  if (checks.image.status === 'failed') score -= 20;

  return Math.max(0, Math.min(100, score));
}
```

**Confidence Tiers:**
- **95-100%:** Verified by human + all checks passed
- **85-94%:** Auto-verified with all checks passed
- **70-84%:** API data only, not yet verified
- **50-69%:** Some checks failed, quarantined
- **0-49%:** Multiple failures, hidden from users

---

## API Integration Strategy

### Multi-Source Architecture

```typescript
// Priority: Speed + Fallback Reliability
async function fetchProducts(params: SearchParams): Promise<Product[]> {
  const sources = [
    () => rapidAPIProvider.fetch(params),
    () => rainforestProvider.fetch(params),
    () => affiliateProvider.fetch(params),
    () => manualCuratedProvider.fetch(params) // Fallback
  ];

  // Parallel fetch with timeout
  const results = await Promise.allSettled(
    sources.map(fn => timeout(fn(), 3000))
  );

  // Combine results, deduplicate, sort by confidence
  return combineAndDeduplicate(results);
}
```

### Cost-Optimized Refresh Strategy

Instead of refreshing all 1000 products every 2 minutes (720k API calls/day), use prioritized scheduling:

| Product Tier | Refresh Interval | API Calls/Day | Products |
|--------------|------------------|---------------|----------|
| Top 100 (hot deals) | 2 minutes | 72,000 | 100 |
| Popular 400 | 10 minutes | 57,600 | 400 |
| Long-tail 500 | 60 minutes | 12,000 | 500 |
| **TOTAL** | | **~142k** | **1000** |

**Result:** 142k calls/day instead of 720k (5x reduction)

### Rate Limiting

Using [Redis token bucket algorithm](https://redis.io/learn/howtos/ratelimiting):

```typescript
// Lua script for atomic token bucket
const RATE_LIMIT_SCRIPT = `
  local key = KEYS[1]
  local capacity = tonumber(ARGV[1])
  local rate = tonumber(ARGV[2])
  local requested = tonumber(ARGV[3])

  local tokens = redis.call('GET', key)
  if not tokens then tokens = capacity end

  tokens = math.min(capacity, tokens + rate)

  if tokens >= requested then
    tokens = tokens - requested
    redis.call('SET', key, tokens)
    return 1
  else
    return 0
  end
`;
```

---

## Verification System

### Multi-Layer Verification Pipeline

```
New Product Added (confidence: 70%)
     │
     ▼
[Queue: URL Check] ──→ Success (+10%) ──→ 80%
     │                    Failed (-20%) ──→ 50% (quarantine)
     ▼
[Queue: Image Check] ──→ Success (+15%) ──→ 95%
     │                     Failed (-20%) ──→ 60% (quarantine)
     ▼
[Queue: Claude Vision] ──→ Valid product image (+5%) ──→ 100%
     │                       Not product (-10%) ──→ 85%
     ▼
[Update Confidence Score in DB]
[Invalidate Cache]
```

### Automated Quarantine System

Products automatically quarantined if:
- HTTP 404 on product URL
- Image returns 404 or non-image content-type
- Confidence score drops below 50%
- Price changes >50% (potential data error)

**Quarantine Actions:**
1. Remove from public listings
2. Flag for manual review
3. Attempt re-verification after 1 hour
4. If still failing after 3 attempts → mark inactive

### Claude Vision Integration

For suspicious images, use Claude API to validate:

```typescript
async function validateImageWithClaude(imageUrl: string): Promise<boolean> {
  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 100,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "url", url: imageUrl }
        },
        {
          type: "text",
          text: "Is this a valid product image (clothing, shoes, or accessories)? Answer with just 'yes' or 'no'."
        }
      ]
    }]
  });

  return response.content[0].text.toLowerCase().includes('yes');
}
```

---

## Performance Optimization

### Caching Strategy

**L1: In-Memory LRU Cache (Node.js)**
```typescript
import LRU from 'lru-cache';

const memoryCache = new LRU({
  max: 10000,              // 10k most popular products
  maxSize: 50 * 1024 * 1024, // 50MB max
  sizeCalculation: (value) => JSON.stringify(value).length,
  ttl: 1000 * 60 * 2,      // 2 minutes
});
```

**L2: Redis Cache**
```typescript
// Stale-while-revalidate pattern
async function getWithSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<T> {
  const cached = await redis.get(key);

  if (cached) {
    // Return cached data immediately
    const data = JSON.parse(cached);

    // Check if stale (TTL expired but still in cache)
    const age = await redis.ttl(key);
    if (age < ttl / 2) {
      // Trigger background refresh
      refreshInBackground(key, fetcher, ttl);
    }

    return data;
  }

  // Cache miss - fetch and cache
  const fresh = await fetcher();
  await redis.setex(key, ttl, JSON.stringify(fresh));
  return fresh;
}
```

**L3: PostgreSQL Materialized Views**
```sql
-- Refreshed every 5 minutes via cron job
CREATE MATERIALIZED VIEW mv_top_deals AS
SELECT
  id, name, brand, category, sale_price, discount_percentage,
  confidence_score, view_count,
  ROW_NUMBER() OVER (
    PARTITION BY category
    ORDER BY discount_percentage DESC, popularity_score DESC
  ) as rank
FROM products
WHERE is_active = true
  AND confidence_score >= 85
  AND expires_at > NOW();

-- Concurrent refresh (no locking)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_deals;
```

### Database Optimization

**PostgreSQL Configuration** (for 16GB RAM server):
```conf
shared_buffers = 4GB                  # 25% of RAM
effective_cache_size = 12GB           # 75% of RAM
work_mem = 64MB
maintenance_work_mem = 1GB
random_page_cost = 1.1                # SSD optimization
effective_io_concurrency = 200        # SSD
max_connections = 200
shared_preload_libraries = 'pg_stat_statements'
```

**Query Optimization:**
```sql
-- Efficient query for filtered deals
EXPLAIN ANALYZE
SELECT id, name, brand, sale_price, discount_percentage, image_url
FROM products
WHERE
  is_active = true
  AND category = 'shoes'
  AND discount_percentage >= 30
  AND confidence_score >= 85
ORDER BY popularity_score DESC
LIMIT 50;

-- Should use: idx_products_active_discount
```

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| API Response (p95) | <100ms | New Relic / Sentry |
| API Response (p99) | <200ms | New Relic / Sentry |
| Cache Hit Rate | >95% | Redis INFO stats |
| Database Query | <50ms | pg_stat_statements |
| Image Load | <500ms | Lighthouse |
| First Contentful Paint | <1.5s | Lighthouse |
| Uptime | 99.9% | UptimeRobot |

---

## Agent Development Workflow

### Phase 1: Foundation (Week 1)

**Parallel Execution - 3 Agents:**

1. **Database Architect Agent**
   - Worktree: `worktrees/db-setup`
   - Tasks: Prisma schema, migrations, seed data
   - Deliverable: Working PostgreSQL on Railway with 50 products
   - Duration: 5-7 days

2. **DevOps Infrastructure Agent**
   - Worktree: `worktrees/devops-setup`
   - Tasks: Docker, Railway config, CI/CD pipeline
   - Deliverable: Automated deployment pipeline
   - Duration: 5-7 days

3. **Translation System Agent**
   - Worktree: `worktrees/i18n-setup`
   - Tasks: 6-language support, auto-translation
   - Deliverable: i18n infrastructure ready
   - Duration: 5-7 days

### Phase 2: Core Features (Week 2)

**Parallel Execution - 4 Agents:**

4. **API Integration Specialist**
   - Worktree: `worktrees/api-integration`
   - Tasks: RapidAPI + Rainforest integration
   - Dependencies: Database schema complete
   - Duration: 5-7 days

5. **Caching & Performance Engineer**
   - Worktree: `worktrees/caching-layer`
   - Tasks: Redis setup, multi-layer caching
   - Dependencies: Database + DevOps complete
   - Duration: 5-7 days

6. **Product Verification Expert**
   - Worktree: `worktrees/verification-system`
   - Tasks: URL/image validation, confidence scoring
   - Dependencies: Database complete
   - Duration: 5-7 days

7. **Frontend Enhancement Developer**
   - Worktree: `worktrees/frontend-upgrade`
   - Tasks: UI improvements, real-time updates
   - Dependencies: API integration in progress
   - Duration: 5-7 days

### Phase 3: Integration & Testing (Week 3)

**Sequential Execution - 2 Agents:**

8. **Testing & QA Engineer**
   - Worktree: `worktrees/testing-suite`
   - Tasks: Unit, integration, E2E, load tests
   - Dependencies: All features complete
   - Duration: 5-7 days

9. **Integration Coordinator**
   - Worktree: `main` (merge coordination)
   - Tasks: Merge all worktrees, resolve conflicts
   - Deliverable: Working MVP on staging
   - Duration: 2-3 days

### Phase 4: Launch (Week 4)

10. **Production Deployment Agent**
    - Tasks: Deploy to Railway, monitoring setup
    - Deliverable: Live production system
    - Duration: 2-3 days

### Agent Communication Protocol

**Daily Standup (Async via GitHub Issues):**
- Each agent posts status update
- Blockers escalated immediately
- Integration points coordinated

**Interface Contracts:**
- All agents export TypeScript interfaces
- Clear API boundaries
- No implementation dependencies

**Git Workflow:**
```bash
# Each agent works in isolated worktree
git worktree add worktrees/db-setup -b feature/database-setup

# Daily commits to feature branch
git commit -m "feat(db): add products table with partitioning"

# PR to main when complete
gh pr create --title "Database Setup Complete" --body "..."
```

---

## Success Metrics

### MVP Launch Criteria (Week 4)

**Product Scale:**
- [ ] 100-200 verified products in database
- [ ] 95% confidence score on all products
- [ ] 6 languages fully translated

**Performance:**
- [ ] API response <100ms (p95)
- [ ] Cache hit rate >90%
- [ ] Database queries <50ms

**Accuracy:**
- [ ] All product URLs return HTTP 200
- [ ] All images load correctly
- [ ] No expired/unavailable products

**Infrastructure:**
- [ ] Deployed on Railway
- [ ] CI/CD pipeline working
- [ ] Monitoring and alerts active

### Phase 2 Scale Targets (Month 2-3)

**Product Scale:**
- [ ] 1000+ products
- [ ] 10+ sources (APIs + manual)
- [ ] 98% average confidence score

**Performance:**
- [ ] API response <100ms (p99)
- [ ] Cache hit rate >95%
- [ ] Support 1000 req/s

**Features:**
- [ ] Community voting system
- [ ] Admin panel for product management
- [ ] Analytics dashboard

---

## Risk Mitigation

### Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| API rate limits exceeded | High | Medium | Token bucket limiting, cost alerts |
| Database performance degrades | High | Low | Materialized views, partitioning, monitoring |
| Product URLs go invalid | Medium | High | Continuous verification, quarantine system |
| Agent merge conflicts | Medium | Medium | Clear interfaces, daily standups |
| Cost overruns | High | Medium | Budget alerts, prioritized refresh strategy |

### Operational Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Railway downtime | High | Low | Multi-region deployment (Phase 2) |
| API provider changes | Medium | Medium | Multiple providers, fallback to manual |
| Translation quality issues | Low | Medium | Human review queue |
| Cache invalidation bugs | Medium | Low | Comprehensive testing, monitoring |

### Contingency Plans

**If API costs exceed budget:**
- Reduce refresh frequency for long-tail products
- Increase manual curation percentage
- Negotiate volume discounts with providers

**If performance targets not met:**
- Add read replicas for PostgreSQL
- Increase Redis memory
- Implement edge caching with Cloudflare

**If accuracy drops below 95%:**
- Increase verification frequency
- Add human review queue
- Implement community reporting

---

## Appendix

### References

- [RapidAPI E-commerce APIs](https://rapidapi.com/collection/essential-ecommerce-apis)
- [Rainforest Amazon Product API](https://www.rainforestapi.com/)
- [Slickdeals Verification Model](https://slickdeals.net/corp/how-slickdeals-works/)
- [Honey Automated Testing](https://help.joinhoney.com/article/39-what-is-the-honey-extension-and-how-do-i-get-it)
- [PostgreSQL Performance Tuning](https://medium.com/@DevBoostLab/postgresql-17-performance-upgrade-2026-f4222e71f577)
- [Redis Rate Limiting](https://redis.io/learn/howtos/ratelimiting)
- [Redis Caching Performance](https://dev.to/techblogs/caching-with-redis-enhancing-application-performance-1j34)
- [PostgreSQL Wiki: Tuning](https://wiki.postgresql.org/wiki/Tuning_Your_PostgreSQL_Server)
- [eBay Real-time Inventory API](https://developer.ebay.com/api-docs/sell/static/inventory/realtime-inventory-check.html)

### Budget Breakdown

| Service | Monthly Cost | Notes |
|---------|--------------|-------|
| Railway (Hobby) | $5 | PostgreSQL + hosting |
| Upstash Redis | $10 | Pay-as-you-go |
| RapidAPI Shopping | $99 | 25k requests/month |
| Rainforest API | $50 | 10k requests/month |
| DeepL Translation | $0 | Free tier (500k chars) |
| Cloudflare CDN | $0 | Free tier |
| Sentry Monitoring | $0 | Free tier (5k events) |
| **TOTAL** | **~$164/month** | At full 1000 product scale |

---

**Document Status:** ✅ Approved - Ready for implementation
**Next Steps:** Create implementation plans and launch agents
**Owner:** PromoFinder Team
**Review Date:** 2026-01-13 (1 week after launch)
