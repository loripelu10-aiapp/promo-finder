# Railway Database Setup Guide

Step-by-step guide to deploy PostgreSQL database on Railway.app for PromoFinder production.

---

## Prerequisites

1. **Railway Account** - Sign up at [railway.app](https://railway.app)
2. **Railway CLI** - Install globally: `npm install -g @railway/cli`
3. **GitHub Account** - For automatic deployments (optional)

---

## Step 1: Create Railway Project

### Option A: Using Railway Dashboard (Recommended)

1. Visit [railway.app](https://railway.app)
2. Click "Start a New Project"
3. Select "Deploy from GitHub repo" or "Empty Project"
4. Name your project: `promofinder-production`

### Option B: Using Railway CLI

```bash
# Login to Railway
railway login

# Create new project
railway init

# Follow prompts to name your project
```

---

## Step 2: Add PostgreSQL Database

### Using Dashboard

1. In your Railway project, click "+ New"
2. Select "Database" → "PostgreSQL"
3. Wait 1-2 minutes for provisioning
4. PostgreSQL will be automatically provisioned with:
   - **Version:** PostgreSQL 17
   - **Storage:** 1GB (expandable)
   - **Memory:** Shared (upgradable)
   - **Backups:** Automatic daily backups

### Using CLI

```bash
# Link to your project
railway link

# Add PostgreSQL service
railway add --database postgres
```

---

## Step 3: Get Database Credentials

### Using Dashboard

1. Click on the PostgreSQL service
2. Go to "Variables" tab
3. Copy the `DATABASE_URL` variable

The URL format will be:
```
postgresql://postgres:PASSWORD@HOST:PORT/railway
```

### Using CLI

```bash
# View database credentials
railway variables

# Get DATABASE_URL specifically
railway variables get DATABASE_URL
```

---

## Step 4: Configure Local Environment

Create or update `.env` file in your project root:

```bash
# Copy DATABASE_URL from Railway
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:YOUR_PORT/railway?schema=public"

# Add other production variables
NODE_ENV=production
PORT=3001
```

**Important:** Add `.env` to `.gitignore` to prevent committing credentials!

---

## Step 5: Run Database Migrations

### Generate Prisma Client

```bash
npx prisma generate
```

### Create Initial Migration

```bash
# This creates the migration files
npx prisma migrate dev --name init
```

### Deploy to Railway

```bash
# Deploy migrations to Railway database
npx prisma migrate deploy
```

Alternatively, using Railway CLI:

```bash
railway run npx prisma migrate deploy
```

---

## Step 6: Apply Performance Optimizations

Run the materialized views migration:

```bash
# Connect to Railway database
railway run psql -f prisma/migrations/01_create_materialized_views.sql
```

Or manually in Prisma Studio:

```bash
railway run npx prisma studio
```

Then execute the SQL from `01_create_materialized_views.sql` in the SQL console.

---

## Step 7: Seed the Database

### Run Seed Script

```bash
# Seed with 50 verified products
railway run npx ts-node prisma/seed.ts
```

### Verify Seeding

```bash
# Open Prisma Studio connected to Railway
railway run npx prisma studio

# Or query directly
railway run -- npx prisma db execute --stdin <<SQL
SELECT COUNT(*) as total_products FROM products;
SQL
```

Expected output:
```
total_products
--------------
50
```

---

## Step 8: Configure Connection Pooling (Optional)

For production workloads, enable connection pooling:

### Using Railway's Built-in Pooling

Railway provides connection pooling by default. To use it:

1. In Railway dashboard, go to PostgreSQL service
2. Look for "Connection Pooling" section
3. Use the pooled connection string (usually on port 6543)

Update `.env`:
```env
DATABASE_URL="postgresql://postgres:PASSWORD@HOST:6543/railway?schema=public&pgbouncer=true"
```

### Using External PgBouncer

For advanced pooling, set up PgBouncer:

```bash
# Add PgBouncer service on Railway
railway add

# Configure pgbouncer.ini
# See README-database.md for configuration details
```

---

## Step 9: Set Up Automated Backups

Railway provides automatic daily backups by default.

### Manual Backup

```bash
# Export database to local file
railway run pg_dump > backup_$(date +%Y%m%d).sql

# Or use Prisma
railway run npx prisma db pull
```

### Restore from Backup

```bash
# Restore from SQL dump
railway run psql < backup_20260106.sql
```

---

## Step 10: Set Up Monitoring

### View Database Metrics

In Railway Dashboard:
1. Click PostgreSQL service
2. Go to "Metrics" tab
3. View:
   - CPU usage
   - Memory usage
   - Disk usage
   - Connection count

### Set Up Alerts

1. Go to "Settings" tab
2. Configure alerts for:
   - High CPU usage (> 80%)
   - High memory usage (> 90%)
   - Low disk space (< 10%)
   - Connection limit (> 80% of max)

---

## Step 11: Configure Environment Variables

In Railway Dashboard, add these variables:

```env
# Database (auto-provided)
DATABASE_URL=postgresql://...

# Application
NODE_ENV=production
PORT=3001

# API Keys
RAPIDAPI_KEY=your_rapidapi_key
RAINFOREST_API_KEY=your_rainforest_key
DEEPL_API_KEY=your_deepl_key
CLAUDE_API_KEY=your_claude_key

# Security
JWT_SECRET=your_jwt_secret

# Monitoring
SENTRY_DSN=your_sentry_dsn
```

---

## Step 12: Deploy Backend Application

### Using GitHub (Automatic Deployments)

1. Push your code to GitHub
2. In Railway, click "+ New"
3. Select "GitHub Repo"
4. Select your repository
5. Configure build settings:
   ```
   Build Command: cd backend && npm install
   Start Command: cd backend && npm start
   ```

### Using Railway CLI (Manual Deploy)

```bash
# Deploy current directory
railway up

# Or specify service
railway up --service backend
```

---

## Verification Checklist

After deployment, verify everything works:

- [ ] Database is accessible: `railway run psql -c "SELECT 1"`
- [ ] Migrations applied: `railway run npx prisma migrate status`
- [ ] Seed data inserted: `railway run psql -c "SELECT COUNT(*) FROM products"`
- [ ] Materialized views created: `railway run psql -c "\dv"`
- [ ] Indexes created: `railway run psql -c "\di"`
- [ ] Backend connects: Check Railway logs
- [ ] API responds: `curl https://your-app.railway.app/api/health`

---

## Performance Tuning

### Check Query Performance

```bash
# Enable pg_stat_statements
railway run psql <<SQL
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SQL

# View slow queries
railway run psql <<SQL
SELECT
  query,
  calls,
  total_exec_time::numeric(10,2) as total_time_ms,
  mean_exec_time::numeric(10,2) as avg_time_ms
FROM pg_stat_statements
WHERE mean_exec_time > 50
ORDER BY mean_exec_time DESC
LIMIT 10;
SQL
```

### Optimize Memory Settings

In Railway Dashboard:
1. Go to PostgreSQL service settings
2. Increase memory allocation if needed:
   - Hobby: 512MB (free)
   - Pro: 1GB-4GB ($5-20/month)

### Configure PostgreSQL Parameters

```bash
# Connect to database
railway run psql

# Set parameters
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
ALTER SYSTEM SET work_mem = '16MB';

-- Restart database to apply
SELECT pg_reload_conf();
```

---

## Maintenance Tasks

### Weekly Tasks

```bash
# Refresh materialized views
railway run psql <<SQL
SELECT refresh_materialized_views();
SQL

# Vacuum and analyze
railway run psql <<SQL
VACUUM ANALYZE;
SQL
```

### Monthly Tasks

```bash
# Check database size
railway run psql <<SQL
SELECT
  pg_size_pretty(pg_database_size('railway')) as database_size,
  pg_size_pretty(sum(pg_total_relation_size(schemaname||'.'||tablename)))
    as table_size
FROM pg_tables
WHERE schemaname = 'public';
SQL

# Check index usage
railway run psql <<SQL
SELECT * FROM v_index_usage LIMIT 20;
SQL

# Cleanup old data
railway run psql <<SQL
SELECT cleanup_old_verification_history();
SQL
```

---

## Scaling Guide

### When to Scale

Scale your database when:
- CPU usage consistently > 70%
- Memory usage > 85%
- Query latency > 100ms (p95)
- Connection count > 80% of limit

### Scaling Options

1. **Vertical Scaling (Increase Resources)**
   - In Railway Dashboard → PostgreSQL → Settings
   - Upgrade to larger plan
   - Costs: $5-50/month

2. **Connection Pooling**
   - Enable PgBouncer
   - Increase max_connections
   - See Step 8

3. **Read Replicas** (Future)
   - Railway doesn't support read replicas yet
   - Use external service like AWS RDS
   - Configure read/write split in Prisma

4. **Database Partitioning** (1000+ products)
   - Partition products by source
   - See `01_create_materialized_views.sql`
   - Requires custom migration

---

## Troubleshooting

### "Connection limit reached"

```bash
# Check current connections
railway run psql <<SQL
SELECT count(*) FROM pg_stat_activity;
SQL

# Kill idle connections
railway run psql <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < NOW() - INTERVAL '5 minutes';
SQL
```

### "Disk space full"

```bash
# Check disk usage
railway run psql <<SQL
SELECT pg_size_pretty(pg_database_size('railway'));
SQL

# Cleanup old data
railway run psql <<SQL
SELECT cleanup_old_verification_history();
VACUUM FULL;
SQL
```

### "Slow queries"

```bash
# Find slow queries
railway run psql <<SQL
SELECT * FROM v_index_usage WHERE idx_scan < 100;
SQL

# Create missing indexes
# See Prisma schema and migration files
```

---

## Cost Optimization

### Current Costs (Estimated)

- **Hobby Plan:** $5/month
  - PostgreSQL: Included
  - 512MB RAM
  - 1GB storage
  - Automatic backups

- **Pro Plan:** $20/month
  - PostgreSQL: Included
  - 2GB RAM
  - 10GB storage
  - Priority support

### Reduce Costs

1. **Cleanup old data regularly**
   ```sql
   SELECT cleanup_old_verification_history();
   ```

2. **Optimize queries**
   - Use materialized views
   - Add indexes for common patterns
   - Avoid N+1 queries

3. **Use connection pooling**
   - Reduces connection overhead
   - Enables more concurrent users
   - Lower memory usage

4. **Archive old products**
   ```sql
   -- Archive products older than 1 year
   DELETE FROM products
   WHERE created_at < NOW() - INTERVAL '1 year'
     AND is_active = false;
   ```

---

## Security Best Practices

1. **Never commit `.env` file**
   ```bash
   echo ".env" >> .gitignore
   ```

2. **Use environment variables**
   - Store all secrets in Railway variables
   - Never hardcode credentials

3. **Enable SSL connections**
   ```env
   DATABASE_URL="postgresql://...?sslmode=require"
   ```

4. **Restrict database access**
   - Use Railway's built-in security
   - Don't expose port 5432 publicly
   - Use SSH tunnels for debugging

5. **Regular backups**
   - Railway provides automatic backups
   - Create manual backups before major changes
   - Test restore procedure

---

## Next Steps

1. ✅ Database deployed on Railway
2. ✅ Migrations applied
3. ✅ Seed data inserted
4. ✅ Performance optimizations applied
5. ⏭️ Deploy backend application
6. ⏭️ Set up Redis cache
7. ⏭️ Configure monitoring
8. ⏭️ Run integration tests

---

## Resources

- [Railway Documentation](https://docs.railway.app/)
- [PostgreSQL on Railway](https://docs.railway.app/databases/postgresql)
- [Prisma + Railway](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-railway)
- [Database Backups](https://docs.railway.app/reference/backups)

---

**Railway Setup Complete!** 🚂

Your PostgreSQL database is now running on Railway with:
- 50 verified products
- Materialized views for performance
- Automatic backups
- Production-ready configuration
