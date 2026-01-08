# Railway Deployment Setup Guide

This guide walks you through deploying PromoFinder backend to Railway.app.

## Prerequisites

- Railway account (sign up at https://railway.app)
- GitHub repository connected to Railway
- Railway CLI (optional): `npm i -g @railway/cli`

## Step 1: Create Railway Project

1. Go to https://railway.app/new
2. Select "Deploy from GitHub repo"
3. Choose your PromoFinder repository
4. Railway will auto-detect the Node.js project

## Step 2: Add PostgreSQL Database

1. In your Railway project, click "New Service"
2. Select "Database" → "PostgreSQL"
3. Railway will provision a PostgreSQL instance
4. Copy the `DATABASE_URL` connection string

## Step 3: Add Redis (Optional - Use Upstash)

### Option A: Railway Redis (if available)
1. Click "New Service" → "Database" → "Redis"
2. Copy the `REDIS_URL` connection string

### Option B: Upstash Redis (Recommended)
1. Go to https://upstash.com
2. Create a Redis database
3. Copy the Redis URL with password
4. Format: `redis://default:PASSWORD@HOST:PORT`

## Step 4: Configure Environment Variables

In Railway project settings, add these variables:

```bash
# Required
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...  # From Railway PostgreSQL
REDIS_URL=redis://...          # From Railway Redis or Upstash

# API Keys (add your actual keys)
RAPIDAPI_KEY=your_rapidapi_key
RAINFOREST_API_KEY=your_rainforest_key
DEEPL_API_KEY=your_deepl_key
CLAUDE_API_KEY=your_claude_key

# Optional - Monitoring
SENTRY_DSN=your_sentry_dsn

# Frontend URL (will be updated after frontend deployment)
FRONTEND_URL=https://your-frontend.vercel.app
```

## Step 5: Configure Deployment

1. In Railway project settings:
   - Set **Root Directory**: Leave empty (monorepo)
   - Set **Build Command**: `cd backend && npm install --production`
   - Set **Start Command**: `cd backend && node server-simple.js`
   - Set **Health Check Path**: `/health`
   - Set **Health Check Timeout**: 100ms

2. Or use the `railway.json` file (already configured in `/infrastructure/railway/railway.json`)

## Step 6: Deploy

### Auto-deploy (Recommended)
1. Push to your GitHub repository
2. Railway automatically deploys on push to `main` branch
3. Watch deployment logs in Railway dashboard

### Manual deploy with CLI
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy
railway up
```

## Step 7: Verify Deployment

1. Check Railway logs for startup messages
2. Visit your Railway URL: `https://your-app.up.railway.app`
3. Test health endpoint: `https://your-app.up.railway.app/health`
4. Test API: `https://your-app.up.railway.app/api/deals`

## Step 8: Set Up Custom Domain (Optional)

1. In Railway project → Settings → Domains
2. Click "Generate Domain" or add custom domain
3. Update DNS records if using custom domain
4. Update `FRONTEND_URL` in environment variables

## Monitoring & Logs

### View Logs
```bash
# Using CLI
railway logs

# Or view in Railway dashboard
```

### Set Up Alerts
1. Railway Dashboard → Project Settings → Notifications
2. Configure alerts for deployment failures, downtime, etc.

## Database Migrations (Future)

When Prisma is integrated:

```bash
# Using Railway CLI
railway run npx prisma migrate deploy

# Or add to build command in railway.json
```

## Troubleshooting

### Deployment fails
- Check Railway logs for errors
- Verify all environment variables are set
- Ensure `package.json` has correct `start` script

### Health check fails
- Verify `/health` endpoint is accessible
- Check `healthcheckTimeout` is sufficient (100ms+)
- Review backend logs for startup errors

### Database connection issues
- Verify `DATABASE_URL` is correct
- Check PostgreSQL service is running
- Test connection with Railway shell: `railway run node`

### Puppeteer/Chromium issues
- Ensure Nixpacks includes Chromium
- Set `PUPPETEER_EXECUTABLE_PATH` correctly
- Check `nixpacks.toml` configuration

## Scaling

Railway automatically handles:
- Vertical scaling (increase resources)
- Automatic restarts on failure
- Zero-downtime deployments

For horizontal scaling (multiple instances):
1. Railway Dashboard → Settings → Scaling
2. Increase replica count (paid plans)

## Cost Optimization

Free tier limits:
- $5 credit/month
- 500 hours execution time
- Shared resources

Paid plans:
- $20/month for Hobby plan
- Usage-based pricing
- Private networking

## Security Best Practices

1. Never commit `.env` files
2. Use Railway environment variables
3. Enable private networking between services
4. Set up IP allowlisting if needed
5. Use HTTPS only (Railway provides SSL automatically)

## Backup & Recovery

### Database Backups
```bash
# Automated backups with Railway PostgreSQL
# Backups are automatic on paid plans

# Manual backup
railway run pg_dump $DATABASE_URL > backup.sql
```

### Redis Backups
```bash
# Redis persistence is enabled by default
# For Upstash, backups are automatic
```

## Next Steps

1. Deploy frontend to Vercel/Netlify
2. Set up CI/CD with GitHub Actions
3. Configure monitoring with Sentry
4. Set up uptime monitoring (UptimeRobot, etc.)
5. Configure custom domain

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- PromoFinder Issues: https://github.com/your-repo/issues
