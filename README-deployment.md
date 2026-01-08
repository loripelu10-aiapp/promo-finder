# PromoFinder Deployment Guide

Complete guide for deploying PromoFinder to production using Railway.app and modern DevOps practices.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [Local Development](#local-development)
4. [Railway Deployment](#railway-deployment)
5. [CI/CD Pipeline](#cicd-pipeline)
6. [Environment Variables](#environment-variables)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

### One-Command Setup

```bash
# Clone the repository
git clone https://github.com/your-username/promo-finder.git
cd promo-finder

# Run automated setup (installs dependencies, sets up .env, starts Docker)
./scripts/setup-dev.sh

# Verify everything is working
./scripts/health-check.sh
```

**Setup time:** ~3-5 minutes (depending on internet speed)

### Manual Setup

```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your API keys

# 3. Start with Docker
docker-compose -f infrastructure/docker/docker-compose.yml up

# OR start manually
cd backend && npm run dev    # Terminal 1
cd frontend && npm run dev   # Terminal 2
```

---

## Architecture Overview

### System Architecture

```
┌─────────────────┐
│   GitHub Repo   │
└────────┬────────┘
         │
         ├─── Push to main ──────────────┐
         │                               │
         ▼                               ▼
┌─────────────────┐            ┌─────────────────┐
│  GitHub Actions │            │  GitHub Actions │
│   CI Pipeline   │            │Deploy to Staging│
└────────┬────────┘            └────────┬────────┘
         │                               │
         │ Run tests                     │
         │ Build Docker                  │
         │ Security scan                 │
         │                               ▼
         │                      ┌─────────────────┐
         │                      │   Railway.app   │
         │                      │  Staging Env    │
         │                      └─────────────────┘
         │
         └── Manual trigger (production) ─┐
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │   Railway.app   │
                                 │ Production Env  │
                                 └────────┬────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
                    ▼                     ▼                     ▼
            ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
            │  PostgreSQL   │    │     Redis     │    │   Backend     │
            │   Database    │    │  (Upstash)    │    │   Node.js     │
            └───────────────┘    └───────────────┘    └───────┬───────┘
                                                               │
                                                               │ API
                                                               │
                                                               ▼
                                                       ┌───────────────┐
                                                       │   Frontend    │
                                                       │ React + Vite  │
                                                       │   (Vercel)    │
                                                       └───────────────┘
```

### Technology Stack

**Backend:**
- Runtime: Node.js 20
- Framework: Express.js
- Database: PostgreSQL 16
- Cache: Redis 7
- Scraping: Puppeteer + Cheerio

**Frontend:**
- Framework: React 18
- Build: Vite 5
- Deployment: Static hosting (Vercel/Netlify)

**Infrastructure:**
- Hosting: Railway.app (backend + database)
- Redis: Upstash
- CI/CD: GitHub Actions
- Monitoring: Sentry (optional)
- Containers: Docker

---

## Local Development

### Development with Docker (Recommended)

Docker provides a complete local environment with PostgreSQL and Redis:

```bash
# Start all services
docker-compose -f infrastructure/docker/docker-compose.yml up

# Start in background
docker-compose -f infrastructure/docker/docker-compose.yml up -d

# View logs
docker-compose -f infrastructure/docker/docker-compose.yml logs -f backend

# Stop all services
docker-compose -f infrastructure/docker/docker-compose.yml down

# Clean up (removes volumes)
docker-compose -f infrastructure/docker/docker-compose.yml down -v
```

**Access points:**
- Backend: http://localhost:3001
- Frontend: http://localhost:3000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### Development without Docker

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev

# Note: You'll need PostgreSQL and Redis running locally
```

### Health Check

```bash
# Check all services
./scripts/health-check.sh

# Check specific environment
./scripts/health-check.sh staging
./scripts/health-check.sh production
```

---

## Railway Deployment

### Prerequisites

1. **Railway Account**
   - Sign up at https://railway.app
   - Connect your GitHub account

2. **Required Services**
   - PostgreSQL (Railway provides)
   - Redis (Upstash recommended)
   - Sentry (optional, for error tracking)

### Step-by-Step Deployment

#### 1. Create Railway Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create new project
railway init

# Or link existing project
railway link
```

#### 2. Add PostgreSQL Database

In Railway dashboard:
1. Click "New Service" → "Database" → "PostgreSQL"
2. Railway provisions database automatically
3. Copy `DATABASE_URL` from environment variables

#### 3. Set up Redis (Upstash)

**Option A: Upstash (Recommended)**
```bash
# 1. Go to https://upstash.com
# 2. Create Redis database
# 3. Copy Redis URL (format: redis://default:PASSWORD@HOST:PORT)
# 4. Add to Railway environment variables as REDIS_URL
```

**Option B: Railway Redis Plugin**
```bash
# In Railway dashboard:
# 1. New Service → Database → Redis
# 2. Copy REDIS_URL from environment variables
```

#### 4. Configure Environment Variables

In Railway project settings, add all variables from `.env.example`:

```bash
NODE_ENV=production
PORT=3001
DATABASE_URL=<from Railway PostgreSQL>
REDIS_URL=<from Upstash or Railway>
RAPIDAPI_KEY=<your key>
RAINFOREST_API_KEY=<your key>
DEEPL_API_KEY=<your key>
CLAUDE_API_KEY=<your key>
FRONTEND_URL=https://your-frontend.vercel.app
SENTRY_DSN=<optional>
```

#### 5. Deploy Backend

**Auto-deploy (recommended):**
```bash
# Push to GitHub
git push origin main

# Railway automatically deploys
```

**Manual deploy:**
```bash
railway up
```

#### 6. Deploy Frontend (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from frontend directory
cd frontend
vercel

# Set environment variable
# VITE_API_URL=https://your-backend.up.railway.app

# Deploy to production
vercel --prod
```

### Railway Configuration Files

The project includes pre-configured Railway files:

- `infrastructure/railway/railway.toml` - Railway configuration
- `infrastructure/railway/railway.json` - Build and deploy settings
- `infrastructure/railway/nixpacks.toml` - Nixpacks configuration

### Custom Domain (Optional)

1. Railway Dashboard → Project → Settings → Domains
2. Add custom domain
3. Update DNS records:
   ```
   CNAME  api  your-project.up.railway.app
   ```
4. Update `FRONTEND_URL` environment variable

---

## CI/CD Pipeline

### GitHub Actions Workflows

The project includes three workflows:

#### 1. CI Pipeline (`.github/workflows/ci.yml`)

**Triggers:** Every push and pull request

**Jobs:**
- Backend linting and tests
- Frontend build
- Docker image build test
- Security scanning

**Status:** Required check before merge

#### 2. Staging Deployment (`.github/workflows/deploy-staging.yml`)

**Triggers:** Push to `main` branch

**Jobs:**
- Deploy to Railway staging
- Run health checks
- Run smoke tests
- Deploy frontend to Vercel staging

**Environment:** `staging`

#### 3. Production Deployment (`.github/workflows/deploy-prod.yml`)

**Triggers:** Manual (workflow_dispatch)

**Jobs:**
- Pre-deployment checks
- Deploy to Railway production
- Health checks and smoke tests
- Deploy frontend to Vercel production
- Create git tag
- Post-deployment notifications

**Environment:** `production`
**Safety:** Requires typing "deploy" to confirm

### Required GitHub Secrets

Add these secrets in GitHub repository settings:

```bash
# Railway
RAILWAY_TOKEN_STAGING=<from railway.app>
RAILWAY_TOKEN_PRODUCTION=<from railway.app>
RAILWAY_PROJECT_ID_STAGING=<project id>
RAILWAY_PROJECT_ID_PRODUCTION=<project id>
RAILWAY_STAGING_URL=https://staging-api.example.com
RAILWAY_PRODUCTION_URL=https://api.example.com

# Vercel (for frontend)
VERCEL_TOKEN=<from vercel.com>
VERCEL_ORG_ID=<from vercel settings>
VERCEL_PROJECT_ID=<from vercel project>

# Optional - Monitoring
SENTRY_DSN=<from sentry.io>
```

### Manual Production Deployment

```bash
# Via GitHub UI:
# 1. Go to Actions tab
# 2. Select "Deploy to Production"
# 3. Click "Run workflow"
# 4. Type "deploy" to confirm
# 5. Click "Run workflow"

# Via GitHub CLI:
gh workflow run deploy-prod.yml
```

---

## Environment Variables

### Complete Reference

See `.env.example` for full documentation. Key variables:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | Yes | Environment | `production` |
| `PORT` | Yes | Server port | `3001` |
| `DATABASE_URL` | Yes | PostgreSQL connection | `postgresql://...` |
| `REDIS_URL` | Yes | Redis connection | `redis://...` |
| `RAPIDAPI_KEY` | Yes | Shopping API | `abc123...` |
| `FRONTEND_URL` | Yes | Frontend URL (CORS) | `https://app.com` |
| `SENTRY_DSN` | No | Error tracking | `https://...` |

### Environment-Specific Configurations

**Development (`.env.development`):**
```bash
NODE_ENV=development
DATABASE_URL=postgresql://localhost:5432/promofinder
REDIS_URL=redis://localhost:6379
ENABLE_CRON_JOBS=false
LOG_LEVEL=debug
```

**Staging:**
```bash
NODE_ENV=staging
# Railway provides DATABASE_URL and REDIS_URL
FRONTEND_URL=https://staging.promofinder.app
SENTRY_ENVIRONMENT=staging
```

**Production:**
```bash
NODE_ENV=production
# Railway provides DATABASE_URL and REDIS_URL
FRONTEND_URL=https://promofinder.app
SENTRY_ENVIRONMENT=production
```

---

## Monitoring & Maintenance

### Health Monitoring

**Built-in Health Endpoint:**
```bash
curl https://your-api.railway.app/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-06T12:00:00.000Z",
  "uptime": 86400,
  "environment": "production",
  "version": "1.0.0",
  "services": {
    "cache": "ready",
    "memory": {
      "used": 256,
      "total": 512
    }
  },
  "metrics": {
    "dealsCount": 1250,
    "lastUpdated": "2024-01-06T11:55:00.000Z"
  },
  "responseTime": "12ms"
}
```

### Automated Monitoring

**UptimeRobot (Free):**
1. Go to https://uptimerobot.com
2. Add monitor: `https://your-api.railway.app/health`
3. Set interval: 5 minutes
4. Configure alerts (email/Slack)

**Railway Health Checks:**
Railway automatically monitors:
- HTTP health endpoint
- Container health
- Resource usage

### Error Tracking with Sentry

**Setup:**
```bash
# 1. Create account at sentry.io
# 2. Create new project (Node.js)
# 3. Copy DSN
# 4. Add to Railway environment:
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

**Backend integration** (future):
```javascript
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});
```

### Database Backups

**Automated backups (Railway):**
- Railway Pro: Automatic daily backups
- Free tier: Manual backups

**Manual backup:**
```bash
# Local database
./scripts/backup-db.sh local

# Staging database
export RAILWAY_STAGING_DATABASE_URL="postgresql://..."
./scripts/backup-db.sh staging

# Production database
export RAILWAY_PRODUCTION_DATABASE_URL="postgresql://..."
./scripts/backup-db.sh production
```

**Restore backup:**
```bash
# Decompress and restore
gunzip -c backups/promofinder_production_20240106_120000.sql.gz | psql $DATABASE_URL
```

### Logs

**Railway logs:**
```bash
# Via CLI
railway logs

# Via dashboard
# Go to project → Deployments → View logs
```

**Structured logging:**
```javascript
// Backend logs are automatically captured by Railway
console.log({ level: 'info', message: 'Server started', port: 3001 });
```

---

## Troubleshooting

### Common Issues

#### 1. Health Check Fails

**Symptom:** `/health` returns 503 or times out

**Solutions:**
```bash
# Check Railway logs
railway logs

# Verify environment variables
railway variables

# Check service status
railway status

# Restart service
railway restart
```

#### 2. Database Connection Error

**Symptom:** "ECONNREFUSED" or "connection timeout"

**Solutions:**
```bash
# Verify DATABASE_URL is set
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check PostgreSQL service in Railway
# Dashboard → PostgreSQL → Ensure it's running
```

#### 3. Redis Connection Error

**Symptom:** "Redis connection failed"

**Solutions:**
```bash
# Verify REDIS_URL format
# Should be: redis://default:PASSWORD@HOST:PORT

# Test Redis connection (if Upstash)
redis-cli -u $REDIS_URL ping

# Check Upstash dashboard for status
```

#### 4. Puppeteer/Chromium Issues

**Symptom:** "Failed to launch browser"

**Solutions:**
- Verify `nixpacks.toml` includes Chromium
- Check environment variables:
  ```bash
  PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
  PUPPETEER_EXECUTABLE_PATH=/nix/store/*-chromium-*/bin/chromium
  ```
- Review Railway build logs for Chromium installation

#### 5. Build Fails on Railway

**Symptom:** "Build failed" or "Nixpacks error"

**Solutions:**
```bash
# Check railway.json and nixpacks.toml
# Ensure buildCommand is correct:
"buildCommand": "cd backend && npm install --production"

# Verify package.json has correct scripts
# Check Railway build logs for specific error
```

#### 6. Slow Response Times

**Symptom:** Health check > 500ms

**Solutions:**
- Check Railway resource usage (Dashboard → Metrics)
- Verify caching is working (Redis connection)
- Review database query performance
- Consider upgrading Railway plan for more resources

#### 7. CORS Errors

**Symptom:** "Access-Control-Allow-Origin" errors

**Solutions:**
```bash
# Verify FRONTEND_URL environment variable
# Should match your frontend domain exactly

# Check backend CORS configuration
# In server-simple.js, ensure cors() middleware is configured
```

### Getting Help

**Railway Support:**
- Discord: https://discord.gg/railway
- Docs: https://docs.railway.app

**PromoFinder Issues:**
- GitHub Issues: https://github.com/your-username/promo-finder/issues

**Community:**
- Stack Overflow tag: `promofinder`

---

## Performance Optimization

### Backend Optimization

1. **Enable Redis caching** (already configured)
2. **Optimize scraping frequency** (adjust `DEALS_REFRESH_INTERVAL`)
3. **Use CDN for static assets**
4. **Enable gzip compression** (configured in nginx)

### Frontend Optimization

1. **Build optimization** (Vite handles automatically)
2. **Code splitting** (React lazy loading)
3. **Image optimization** (use WebP, lazy loading)
4. **CDN deployment** (Vercel provides automatically)

### Database Optimization

1. **Add indexes** (for frequently queried fields)
2. **Connection pooling** (configure in DATABASE_URL)
3. **Query optimization** (use EXPLAIN for slow queries)
4. **Regular vacuuming** (PostgreSQL maintenance)

---

## Security Best Practices

### Environment Security

- ✅ Never commit `.env` files
- ✅ Use Railway environment variables
- ✅ Rotate API keys regularly
- ✅ Use strong passwords for databases
- ✅ Enable 2FA on all services

### Application Security

- ✅ Keep dependencies updated (`npm audit`)
- ✅ Use HTTPS only (Railway provides SSL)
- ✅ Validate all user inputs
- ✅ Rate limiting on API endpoints
- ✅ Security headers (configured in nginx)

### Access Control

- ✅ Limit Railway access to team members
- ✅ Use GitHub branch protection
- ✅ Require PR reviews for production
- ✅ Use separate API keys for staging/production

---

## Cost Estimation

### Free Tier (Hobby Project)

**Railway:**
- $5/month free credit
- Sufficient for: 500-1000 requests/day
- Resources: Shared, auto-sleep

**Upstash Redis:**
- Free tier: 10,000 commands/day
- 256MB storage

**Vercel (Frontend):**
- Free: Unlimited deployments
- 100GB bandwidth/month

**Total:** $0/month (within free tiers)

### Production (Paid Tier)

**Railway Hobby ($20/month):**
- No sleep
- Private networking
- Better resources

**Upstash Pro ($10/month):**
- 1M commands/month
- 1GB storage

**Vercel Pro ($20/month):**
- Custom domains
- Analytics
- More bandwidth

**Total:** ~$50/month

---

## Rollback Procedure

### Railway Rollback

```bash
# Via CLI
railway rollback

# Via Dashboard
# 1. Go to Deployments
# 2. Find working deployment
# 3. Click "Redeploy"
```

### Database Rollback

```bash
# Restore from backup
./scripts/backup-db.sh production  # Create current backup first
gunzip -c backups/promofinder_production_PREVIOUS.sql.gz | psql $DATABASE_URL
```

### Git Rollback

```bash
# Revert last commit
git revert HEAD
git push origin main

# Or reset to specific commit
git reset --hard <commit-hash>
git push --force origin main  # Use with caution!
```

---

## Next Steps

After successful deployment:

1. ✅ Set up monitoring (UptimeRobot + Sentry)
2. ✅ Configure custom domain
3. ✅ Set up automated backups
4. ✅ Enable error tracking
5. ✅ Create runbook for common issues
6. ✅ Set up analytics (optional)
7. ✅ Configure alerts (Slack/Discord webhook)

---

## Additional Resources

- [Railway Documentation](https://docs.railway.app)
- [Docker Documentation](https://docs.docker.com)
- [GitHub Actions Documentation](https://docs.github.com/actions)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [Vite Documentation](https://vitejs.dev/)

---

**Last Updated:** 2024-01-06
**Version:** 1.0.0
**Maintainer:** PromoFinder Team
