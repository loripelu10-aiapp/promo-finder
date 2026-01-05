# PromoFinder Agent Orchestration - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:dispatching-parallel-agents to launch Phase 1 agents in parallel.

**Goal:** Launch 10 specialized agents in 4 phases to build production-ready PromoFinder system with 1000+ products, 95-99% accuracy, and <100ms response times.

**Architecture:** Agent-based parallel development using git worktrees for isolation. Each agent is a specialized expert working on a specific subsystem with clear interface contracts. Integration coordinator merges all work in Phase 3.

**Tech Stack:** Git worktrees, TypeScript, Prisma, PostgreSQL, Redis, Express, React, Bull queues, Railway deployment

---

## Prerequisites

**Step 1: Verify design document exists**

```bash
cat docs/plans/2026-01-06-production-scale-design.md
```

Expected: Design document with full architecture specifications

**Step 2: Commit current working state**

```bash
git add .
git commit -m "chore: save current state before agent orchestration"
git push origin main
```

Expected: Clean working directory

**Step 3: Create worktrees directory**

```bash
mkdir -p worktrees
```

---

## Phase 1: Foundation Agents (Week 1)

Launch 3 agents in parallel using `superpowers:dispatching-parallel-agents`

### Agent 1: Database Architect

**Worktree:** `worktrees/db-setup`
**Branch:** `feature/database-setup`
**Duration:** 5-7 days

**Responsibilities:**
- Convert SQL schema to Prisma ORM schema
- Create database migrations
- Set up PostgreSQL on Railway
- Configure connection pooling
- Create seed data with 50 verified products

**Key Deliverables:**
```
/prisma/
  ├── schema.prisma
  ├── migrations/
  └── seed.ts

/backend/db/
  ├── client.ts
  └── queries.ts
```

**Success Criteria:**
- [ ] Prisma schema matches design document 100%
- [ ] All migrations run without errors
- [ ] Database deployed on Railway
- [ ] Seed script creates 50 verified products
- [ ] Query performance: <50ms for indexed queries

**Agent Prompt:**
```
You are the Database Architect Agent for PromoFinder.

Your task: Implement the PostgreSQL database using Prisma ORM according to the schema in docs/plans/2026-01-06-production-scale-design.md.

Key requirements:
1. Create complete Prisma schema with all tables, relationships, indexes
2. Implement table partitioning for products table (by source)
3. Create materialized views for performance
4. Set up Railway PostgreSQL database
5. Create seed script with 50 real verified products
6. Implement optimized query functions in /backend/db/queries.ts

Tech stack: Prisma, PostgreSQL 17, TypeScript, Node.js

Interface contract:
- Export ProductQuery interface with findActiveDeals, findById, updateConfidenceScore, bulkInsertProducts
- All queries must use proper indexes
- Return TypeScript types matching Prisma schema

Use TDD: Write tests first, then implementation.
Follow DRY and YAGNI principles.
Commit after each completed task.

Refer to design document for complete schema specifications.
```

---

### Agent 2: DevOps Infrastructure

**Worktree:** `worktrees/devops-setup`
**Branch:** `feature/devops-infrastructure`
**Duration:** 5-7 days

**Responsibilities:**
- Docker containerization for dev & prod
- Railway deployment configuration
- CI/CD pipeline (GitHub Actions)
- Environment variable management
- Monitoring setup (Sentry)

**Key Deliverables:**
```
/infrastructure/
  ├── docker/
  │   ├── Dockerfile.backend
  │   ├── Dockerfile.frontend
  │   └── docker-compose.yml
  └── railway/
      ├── railway.toml
      └── railway.json

/.github/
  └── workflows/
      ├── ci.yml
      ├── deploy-staging.yml
      └── deploy-prod.yml

/scripts/
  ├── setup-dev.sh
  ├── backup-db.sh
  └── health-check.sh
```

**Success Criteria:**
- [ ] Docker containers build successfully
- [ ] One-command dev setup works
- [ ] CI pipeline runs all tests
- [ ] Auto-deployment to staging on merge to main
- [ ] Health check endpoint responds <100ms

**Agent Prompt:**
```
You are the DevOps Infrastructure Agent for PromoFinder.

Your task: Set up complete DevOps infrastructure for development, staging, and production deployment.

Key requirements:
1. Create Dockerfile for backend (Node.js + Prisma)
2. Create Dockerfile for frontend (Vite build)
3. Set up docker-compose for local development
4. Configure Railway deployment (backend + PostgreSQL + Redis)
5. Create GitHub Actions CI/CD pipeline
6. Set up environment variable management (.env.example, Railway secrets)
7. Configure Sentry for error monitoring
8. Create automated backup scripts

Tech stack: Docker, Railway.app, GitHub Actions, Sentry, PostgreSQL, Redis

Interface contract:
- One-command dev setup: ./scripts/setup-dev.sh
- Health check endpoint: GET /health returns {status: 'ok', timestamp, services}
- Environment variables documented in .env.example

Use infrastructure-as-code principles.
Test all scripts and configurations.
Commit after each working component.

Refer to design document for deployment architecture.
```

---

### Agent 3: Translation System

**Worktree:** `worktrees/i18n-setup`
**Branch:** `feature/translation-system`
**Duration:** 5-7 days

**Responsibilities:**
- i18n infrastructure for 6 languages (en, it, es, fr, de, pt)
- Auto-translation using DeepL API
- Translation management system
- Product name/description translation
- UI string translation

**Key Deliverables:**
```
/backend/services/translation/
  ├── translator.ts
  ├── providers/
  │   ├── deepl.ts
  │   └── fallback.ts
  └── cache.ts

/shared/locales/
  ├── en/
  ├── it/
  ├── es/
  ├── fr/
  ├── de/
  └── pt/

/frontend/src/i18n/
  ├── config.ts
  └── useTranslation.ts
```

**Success Criteria:**
- [ ] All 6 languages supported
- [ ] Product translation: <2s per product
- [ ] UI translations cached in Redis (24h TTL)
- [ ] Fallback to English if translation fails
- [ ] Translation API endpoint working

**Agent Prompt:**
```
You are the Translation System Agent for PromoFinder.

Your task: Implement complete i18n infrastructure for 6 languages with auto-translation.

Key requirements:
1. Set up react-i18next for frontend
2. Create translation service with DeepL API integration
3. Implement translation caching in Redis
4. Create locale files for all 6 languages (en, it, es, fr, de, pt)
5. Translate UI strings for PromoFinder.jsx
6. Build product translation pipeline
7. Implement fallback chains (DeepL → cache → English)

Tech stack: react-i18next, DeepL API, Redis, TypeScript

Interface contract:
- TranslationService.translateProduct(product, targetLang): Promise<TranslatedProduct>
- TranslationService.translateUI(key, lang, params): Promise<string>
- All translations cached with 24h TTL
- Frontend useTranslation() hook

Use TDD: Test translation caching, fallback logic, API integration.
Follow DRY: Share translation keys between frontend/backend.
Commit after each language is complete.

Refer to design document for translation architecture.
```

---

## Phase 2: Core Features Agents (Week 2)

**Dependencies:** Wait for Phase 1 agents to complete and merge to main.

Launch 4 agents in parallel after Phase 1 completion:

### Agent 4: API Integration Specialist

**Worktree:** `worktrees/api-integration`
**Branch:** `feature/api-integration`
**Duration:** 5-7 days

**Agent Prompt:**
```
You are the API Integration Specialist Agent for PromoFinder.

Your task: Integrate RapidAPI and Rainforest shopping APIs with rate limiting and cost tracking.

Key requirements:
1. Implement RapidAPI shopping endpoint integration
2. Implement Rainforest Amazon API integration
3. Build rate limiter using Redis token bucket algorithm
4. Create circuit breaker for failed APIs
5. Implement cost tracking in api_logs table
6. Build parallel fetching with fallback chain
7. Create prioritized refresh scheduler (hot/popular/cold products)

Tech stack: Axios, Redis, Bull queue, TypeScript

Interface contract:
- ShoppingAPIService.fetchFromAllSources(params): Promise<Product[]>
- Rate limiting: 25k requests/month for RapidAPI, 10k for Rainforest
- Circuit breaker: Stop calling API after 3 consecutive failures
- Cost tracking: Update api_logs table after each request

Budget: ~$150/month for 1000 products
API calls: 142k/day using prioritized refresh

Use TDD: Test rate limiting, circuit breaker, parallel fetching.
Mock API calls in tests.
Commit after each API integration.

Refer to design document for API integration strategy.
```

---

### Agent 5: Caching & Performance Engineer

**Worktree:** `worktrees/caching-layer`
**Branch:** `feature/caching-performance`
**Duration:** 5-7 days

**Agent Prompt:**
```
You are the Caching & Performance Engineer for PromoFinder.

Your task: Implement multi-layer caching with stale-while-revalidate pattern.

Key requirements:
1. Set up Redis connection with ioredis client
2. Implement L1 in-memory LRU cache (10k products, 50MB)
3. Implement L2 Redis cache with smart TTLs
4. Build stale-while-revalidate pattern
5. Create cache warming on deployment
6. Implement smart invalidation on product updates
7. Add cache performance monitoring
8. Optimize PostgreSQL queries with indexes

Tech stack: Redis (Upstash), ioredis, lru-cache, Prisma, TypeScript

Interface contract:
- CacheService.get<T>(key): Promise<T | null>
- CacheService.getWithRevalidation<T>(key, fetcher, ttl): Promise<T>
- CacheService.invalidatePattern(pattern): Promise<void>
- CacheService.getStats(): Promise<CacheStats>

Performance targets:
- L1 cache: <1ms
- L2 cache: <10ms
- Cache hit rate: >95%

Use TDD: Test cache layers, invalidation, warming.
Load test with k6.
Commit after each layer is working.

Refer to design document for caching architecture.
```

---

### Agent 6: Product Verification Expert

**Worktree:** `worktrees/verification-system`
**Branch:** `feature/verification`
**Duration:** 5-7 days

**Agent Prompt:**
```
You are the Product Verification Expert for PromoFinder.

Your task: Build confidence-based verification system with automated quarantine.

Key requirements:
1. Implement URL availability checker (HTTP HEAD requests)
2. Build image validator with Claude Vision API
3. Create price accuracy validator
4. Implement confidence scoring algorithm (0-100)
5. Build automated quarantine system
6. Create Bull queue for async verification
7. Set up continuous verification cron job
8. Track verification history in database

Tech stack: Axios, Claude API, Bull queue, TypeScript

Interface contract:
- VerificationService.verifyProduct(productId): Promise<VerificationResult>
- VerificationService.checkURL(url): Promise<URLCheckResult>
- VerificationService.checkImage(imageUrl): Promise<ImageCheckResult>
- VerificationService.calculateConfidence(checks): number
- VerificationService.quarantineProduct(productId, reason): Promise<void>

Confidence scoring:
- Base: 70% (API data)
- +15% verified image
- +10% verified URL
- +5% recent check (<1hr)
- -20% per failed check

Use TDD: Test each verification type, confidence calculation, quarantine logic.
Mock external API calls.
Commit after each verification type works.

Refer to design document for verification system architecture.
```

---

### Agent 7: Frontend Enhancement Developer

**Worktree:** `worktrees/frontend-upgrade`
**Branch:** `feature/frontend-enhancement`
**Duration:** 5-7 days

**Agent Prompt:**
```
You are the Frontend Enhancement Developer for PromoFinder.

Your task: Upgrade React UI with performance optimizations and real-time features.

Key requirements:
1. Enhance ProductCard component with confidence badges
2. Build advanced filtering UI
3. Implement infinite scroll with intersection observer
4. Add real-time deal updates (consider SSE or polling)
5. Create type-safe API client with TypeScript
6. Implement image lazy loading
7. Optimize for Lighthouse score >90
8. Add WCAG 2.1 AA accessibility

Tech stack: React 18, TypeScript, TailwindCSS, Zustand, react-i18next, Vite

Interface contract:
- APIClient.getDeals(filters): Promise<DealsResponse>
- APIClient.subscribeToUpdates(callback): () => void
- All components fully typed with TypeScript
- Responsive design: mobile-first

Performance targets:
- Lighthouse: >90 all metrics
- First Contentful Paint: <1.5s
- Smooth 60fps scrolling

Use TDD: Test components with React Testing Library.
Test accessibility with axe-core.
Commit after each component is complete.

Refer to design document for frontend architecture.
```

---

## Phase 3: Integration & Testing (Week 3)

**Dependencies:** Wait for Phase 2 agents to complete.

Launch 2 agents sequentially:

### Agent 8: Testing & QA Engineer

**Worktree:** `worktrees/testing-suite`
**Branch:** `feature/testing`
**Duration:** 5-7 days

**Agent Prompt:**
```
You are the Testing & QA Engineer for PromoFinder.

Your task: Create comprehensive test suite with >85% coverage.

Key requirements:
1. Write unit tests for all services (Jest)
2. Create integration tests for API endpoints (Supertest)
3. Build E2E tests for critical flows (Playwright)
4. Set up load testing with k6 (target: 1000 req/s)
5. Add test coverage reporting
6. Create test data factories
7. Mock external APIs (RapidAPI, Rainforest, DeepL, Claude)
8. Set up CI test pipeline

Tech stack: Jest, Supertest, Playwright, k6, TypeScript

Coverage targets:
- Unit tests: >85%
- Integration tests: 100% of API endpoints
- E2E tests: All critical user flows
- Load test: Sustain 1000 req/s for 5 minutes

Test critical paths:
- Product search with filters
- Real-time updates
- Multi-language switching
- Cache performance
- Verification system
- API rate limiting

Use TDD principles retroactively.
Commit after each test suite is complete.

Refer to design document for testing requirements.
```

---

### Agent 9: Integration Coordinator

**Worktree:** `main` (no separate worktree)
**Branch:** `main`
**Duration:** 2-3 days

**Agent Prompt:**
```
You are the Integration Coordinator for PromoFinder.

Your task: Merge all agent worktrees and resolve integration issues.

Key requirements:
1. Review all 7 completed agent branches
2. Merge in dependency order:
   - Phase 1: db-setup → devops-setup → i18n-setup
   - Phase 2: api-integration → caching-layer → verification-system → frontend-upgrade
   - Phase 3: testing-suite
3. Resolve merge conflicts
4. Verify all tests pass after each merge
5. Update integration points in /backend/src/index.ts
6. Wire up all service dependencies
7. Deploy to staging environment
8. Smoke test all features

Integration checklist:
- [ ] Database migrations run successfully
- [ ] All services start without errors
- [ ] API endpoints return correct data
- [ ] Frontend connects to backend
- [ ] Caching works across all layers
- [ ] Verification runs in background
- [ ] Translation works for all 6 languages
- [ ] Tests pass (unit + integration + E2E)

Merge strategy:
```bash
git checkout main
git merge feature/database-setup
npm test
git merge feature/devops-infrastructure
npm test
git merge feature/translation-system
npm test
# ... continue for all features
```

Document any integration issues encountered.
Commit after each successful merge.

Refer to design document for system architecture.
```

---

## Phase 4: Production Launch (Week 4)

### Agent 10: Production Deployment

**Worktree:** `main`
**Branch:** `production`
**Duration:** 2-3 days

**Agent Prompt:**
```
You are the Production Deployment Agent for PromoFinder.

Your task: Deploy complete system to Railway production and set up monitoring.

Key requirements:
1. Deploy backend to Railway production
2. Deploy frontend to Railway or Vercel
3. Configure production database (PostgreSQL on Railway)
4. Set up production Redis (Upstash)
5. Configure environment variables for production
6. Set up Sentry error tracking
7. Configure domain and SSL
8. Create monitoring dashboards
9. Set up alerts (error rate, API costs, performance)
10. Run final load tests

Production checklist:
- [ ] Backend deployed and healthy
- [ ] Frontend deployed and accessible
- [ ] Database migrations run
- [ ] Redis cache working
- [ ] All API integrations working
- [ ] Monitoring active (Sentry, Upstash)
- [ ] SSL certificate valid
- [ ] Performance meets targets (<100ms p95)
- [ ] Load test passed (1000 req/s)
- [ ] Backup scripts running

Monitoring setup:
- Sentry: Error tracking + performance monitoring
- Upstash: Redis analytics
- Railway: Infrastructure metrics
- Custom: API cost tracking dashboard

Launch criteria:
- 100+ products in database
- 95%+ confidence scores
- All 6 languages working
- <100ms API response (p95)
- >95% cache hit rate
- All tests passing

Document production URLs and credentials.
Create runbook for common operations.

Refer to design document for deployment architecture.
```

---

## Agent Coordination Protocol

### Daily Standup (Async)

Each agent posts daily status update as GitHub issue comment:

```markdown
**Agent:** Database Architect
**Day:** 3/7
**Status:** On track

**Completed:**
- ✅ Prisma schema with all tables
- ✅ Database migrations

**In Progress:**
- 🔄 Materialized views (80%)

**Blockers:**
- None

**Next:**
- Complete materialized views
- Set up Railway database
- Create seed script
```

### Interface Testing

Before merging, each agent must:

1. Export TypeScript interfaces in `index.ts`
2. Write integration tests for their interfaces
3. Document API contracts in README
4. Provide usage examples

### Git Workflow

```bash
# Agent starts work
git worktree add worktrees/feature-name -b feature/feature-name

# Daily commits
git commit -m "feat(scope): description"

# Push to remote
git push origin feature/feature-name

# Open PR when complete
gh pr create --title "Feature Complete" --body "..."

# Integration Coordinator reviews and merges
```

---

## Execution Strategy

### Option 1: Dispatching Parallel Agents (Recommended)

Use `superpowers:dispatching-parallel-agents` to launch agents in parallel:

**Phase 1 Execution:**
```
Launch 3 agents simultaneously:
- Agent 1: Database Architect
- Agent 2: DevOps Infrastructure
- Agent 3: Translation System

Monitor progress via GitHub issues.
Merge when all 3 complete.
```

**Phase 2 Execution:**
```
After Phase 1 merged:
Launch 4 agents simultaneously:
- Agent 4: API Integration
- Agent 5: Caching & Performance
- Agent 6: Product Verification
- Agent 7: Frontend Enhancement

Monitor and merge when complete.
```

### Option 2: Sequential Execution

Execute agents one at a time:
- Slower but easier to manage
- Good for learning the codebase
- Less coordination overhead

---

## Success Metrics

### MVP Launch Criteria (Week 4)

**Product Scale:**
- [ ] 100-200 verified products
- [ ] 95%+ average confidence score
- [ ] 6 languages fully working

**Performance:**
- [ ] <100ms API response (p95)
- [ ] >95% cache hit rate
- [ ] <50ms database queries

**Quality:**
- [ ] >85% test coverage
- [ ] All URLs return HTTP 200
- [ ] All images load correctly
- [ ] No expired products

**Infrastructure:**
- [ ] Deployed on Railway
- [ ] CI/CD working
- [ ] Monitoring active

---

## Risk Mitigation

**If agents fall behind schedule:**
- Reduce scope: Focus on core features only
- Pair agents: Combine related tasks
- Extend timeline: Add 1 week buffer

**If integration conflicts:**
- Integration Coordinator resolves immediately
- Daily standups prevent divergence
- Clear interface contracts prevent issues

**If budget exceeded:**
- Use manual curation instead of APIs
- Reduce refresh frequency
- Optimize API call patterns

---

## Next Steps

After this plan is saved:

1. **Launch Phase 1 Agents** using `superpowers:dispatching-parallel-agents`
2. **Monitor Progress** via GitHub issues and PRs
3. **Daily Check-ins** to unblock agents
4. **Merge Phase 1** when all 3 agents complete
5. **Launch Phase 2** after successful Phase 1 merge
6. **Continue** through Phases 3 and 4

---

**Plan Status:** ✅ Ready for execution
**Execution Mode:** Dispatching Parallel Agents
**Timeline:** 4 weeks to MVP
**Budget:** ~$150/month at full scale
