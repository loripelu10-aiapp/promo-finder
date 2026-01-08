# PromoFinder DevOps - Quick Start Guide

**Get production-ready infrastructure running in 5 minutes**

## One-Command Setup

```bash
./scripts/setup-dev.sh
```

That's it! This script will:
- Check prerequisites (Node.js, Docker, Git)
- Install all dependencies (backend + frontend)
- Create `.env` file from template
- Set up Docker services (PostgreSQL + Redis)
- Create necessary directories
- Verify everything works

**Duration:** 3-5 minutes

---

## Quick Commands Reference

### Development

```bash
# Start full stack with Docker
docker-compose -f infrastructure/docker/docker-compose.yml up

# Start backend only
cd backend && npm run dev

# Start frontend only
cd frontend && npm run dev

# Check system health
./scripts/health-check.sh
```

### Testing

```bash
# Test Docker builds
./scripts/test-docker-build.sh

# Run backend tests
cd backend && npm test

# Run frontend tests
cd frontend && npm test
```

### Database

```bash
# Backup local database
./scripts/backup-db.sh local

# Backup production database
export RAILWAY_PRODUCTION_DATABASE_URL="postgresql://..."
./scripts/backup-db.sh production

# Restore backup
gunzip -c backups/backup.sql.gz | psql $DATABASE_URL
```

### Deployment

```bash
# Deploy to Railway (staging - automatic on push to main)
git push origin main

# Deploy to Railway (production - manual via GitHub Actions)
# Go to GitHub Actions → Deploy to Production → Run workflow

# Or via Railway CLI
railway login
railway link
railway up
```

---

## File Locations

```
Infrastructure Files:
├── infrastructure/docker/          # Docker configs
├── infrastructure/railway/         # Railway configs
├── .github/workflows/              # CI/CD pipelines
├── scripts/                        # Automation scripts
├── .env.example                    # Environment template
├── README-deployment.md            # Full deployment guide
└── INFRASTRUCTURE-SUMMARY.md       # Complete overview
```

---

## Key URLs (Local Development)

- **Backend API:** http://localhost:3001
- **Frontend:** http://localhost:3000
- **Health Check:** http://localhost:3001/health
- **API Deals:** http://localhost:3001/api/deals
- **API Stats:** http://localhost:3001/api/stats

---

## Environment Setup

```bash
# 1. Copy template
cp .env.example .env

# 2. Add your API keys (get from respective websites)
RAPIDAPI_KEY=your_key_here          # https://rapidapi.com
RAINFOREST_API_KEY=your_key_here    # https://rainforestapi.com
DEEPL_API_KEY=your_key_here         # https://deepl.com/pro-api
CLAUDE_API_KEY=your_key_here        # https://console.anthropic.com

# 3. Local services (Docker provides these automatically)
DATABASE_URL=postgresql://promofinder:promofinder_dev_password@localhost:5432/promofinder
REDIS_URL=redis://:promofinder_redis_password@localhost:6379
```

---

## Common Issues & Solutions

### Docker not running
```bash
# Start Docker Desktop manually
# Or use Homebrew: brew services start docker
```

### Port already in use
```bash
# Check what's using the port
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or change PORT in .env
PORT=3002
```

### Dependencies not installing
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf backend/node_modules frontend/node_modules
cd backend && npm install
cd ../frontend && npm install
```

### Health check fails
```bash
# Check if backend is running
curl http://localhost:3001/health

# Check Docker services
docker ps

# Check backend logs
docker-compose -f infrastructure/docker/docker-compose.yml logs backend
```

---

## Railway Deployment Checklist

- [ ] Create Railway account (https://railway.app)
- [ ] Connect GitHub repository
- [ ] Add PostgreSQL service
- [ ] Add Redis service (or use Upstash)
- [ ] Set all environment variables (from `.env.example`)
- [ ] Deploy: `git push origin main` or `railway up`
- [ ] Verify health: `curl https://your-app.up.railway.app/health`
- [ ] Test API: `curl https://your-app.up.railway.app/api/deals`

**Detailed guide:** See `infrastructure/railway/RAILWAY-SETUP.md`

---

## GitHub Actions Setup

Add these secrets in GitHub repository settings:

```bash
Settings → Secrets and variables → Actions → New repository secret

Required:
- RAILWAY_TOKEN_STAGING
- RAILWAY_TOKEN_PRODUCTION
- RAILWAY_PROJECT_ID_STAGING
- RAILWAY_PROJECT_ID_PRODUCTION
- RAILWAY_STAGING_URL
- RAILWAY_PRODUCTION_URL

Optional (for frontend):
- VERCEL_TOKEN
- VERCEL_ORG_ID
- VERCEL_PROJECT_ID
```

---

## Production Deployment

```bash
# 1. Ensure staging is working
git push origin main
# Wait for staging deployment
# Test: ./scripts/health-check.sh staging

# 2. Trigger production deployment
# Go to GitHub → Actions → Deploy to Production → Run workflow
# Type "deploy" to confirm

# 3. Verify production
./scripts/health-check.sh production
```

---

## Monitoring Setup (Optional)

### UptimeRobot (Free)
1. Sign up: https://uptimerobot.com
2. Add monitor: `https://your-app.railway.app/health`
3. Set interval: 5 minutes
4. Configure email alerts

### Sentry (Error Tracking)
1. Sign up: https://sentry.io
2. Create Node.js project
3. Copy DSN
4. Add to Railway environment: `SENTRY_DSN=...`

---

## Cost Summary

### Free Tier (Development)
- Railway: $5/month credit
- Upstash: Free tier
- Vercel: Free tier
- GitHub Actions: 2,000 minutes/month
- **Total: $0/month**

### Production (Recommended)
- Railway Hobby: $20/month
- Upstash Pro: $10/month
- **Total: $30/month**

---

## Help & Resources

**Documentation:**
- Full deployment guide: `README-deployment.md`
- Infrastructure summary: `INFRASTRUCTURE-SUMMARY.md`
- Railway setup: `infrastructure/railway/RAILWAY-SETUP.md`

**Support:**
- Railway: https://discord.gg/railway
- GitHub Issues: Create an issue in the repository

**External Docs:**
- Railway: https://docs.railway.app
- Docker: https://docs.docker.com
- GitHub Actions: https://docs.github.com/actions

---

## What's Included

✅ **Docker Containerization**
- Backend (Node.js + Puppeteer)
- Frontend (React + Vite + nginx)
- PostgreSQL database
- Redis cache
- Complete local dev stack

✅ **Railway Deployment**
- Production-ready configuration
- Health checks
- Auto-restart on failure
- Environment management

✅ **CI/CD Pipeline**
- Automated testing on PRs
- Auto-deploy to staging
- Manual production deployment
- Security scanning

✅ **Automation Scripts**
- One-command setup
- Health verification
- Database backups
- Docker build tests

✅ **Comprehensive Documentation**
- Step-by-step guides
- Troubleshooting
- Best practices
- Security guidelines

---

## Next Steps

1. ✅ Run `./scripts/setup-dev.sh`
2. ✅ Edit `.env` with your API keys
3. ✅ Start development: `docker-compose up`
4. ✅ Deploy to Railway (follow `RAILWAY-SETUP.md`)
5. ✅ Set up CI/CD (add GitHub secrets)
6. ✅ Configure monitoring (UptimeRobot + Sentry)

---

**Ready to deploy?** See `README-deployment.md` for complete instructions.

**Need help?** Check `INFRASTRUCTURE-SUMMARY.md` for detailed overview.

**Last Updated:** 2024-01-06
