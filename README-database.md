# PromoFinder Database Setup Guide

Complete guide for setting up the PostgreSQL database using Prisma ORM.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Local Development Setup](#local-development-setup)
4. [Railway Production Setup](#railway-production-setup)
5. [Database Schema](#database-schema)
6. [Running Migrations](#running-migrations)
7. [Seeding the Database](#seeding-the-database)
8. [Testing](#testing)
9. [Performance Optimization](#performance-optimization)
10. [Troubleshooting](#troubleshooting)

---

## Overview

PromoFinder uses PostgreSQL with Prisma ORM for type-safe database access. The database supports:

- **1000+ products** from multiple sources (Amazon, Nike, Zara, Adidas, H&M, etc.)
- **Multi-language support** (6 languages: en, it, es, fr, de, pt)
- **Confidence-based verification** system (70-100% confidence scores)
- **High-read workload** optimization (<50ms query times)
- **Materialized views** for complex queries
- **Table partitioning** by product source

### Key Features

- Type-safe queries with Prisma Client
- Automated migrations
- Comprehensive seed data (50 verified products)
- Performance indexes on common query patterns
- Audit trail with verification history
- Analytics tracking with user interactions

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js 20+** installed
- **PostgreSQL 17** (local) or **Railway account** (production)
- **npm** or **yarn** package manager
- **Git** for version control

---

## Local Development Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

This installs:
- `@prisma/client` - Type-safe database client
- `prisma` - CLI for migrations and schema management
- `typescript` - TypeScript compiler
- `ts-node` - Execute TypeScript files
- `jest` - Testing framework

### 2. Set Up Local PostgreSQL

#### Option A: Using Docker (Recommended)

```bash
docker run --name promofinder-postgres \
  -e POSTGRES_USER=promofinder \
  -e POSTGRES_PASSWORD=promofinder_dev \
  -e POSTGRES_DB=promofinder \
  -p 5432:5432 \
  -d postgres:17
```

#### Option B: Using Homebrew (macOS)

```bash
brew install postgresql@17
brew services start postgresql@17

createuser -s promofinder
createdb promofinder
```

#### Option C: Using apt (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install postgresql-17
sudo systemctl start postgresql

sudo -u postgres createuser -s promofinder
sudo -u postgres createdb promofinder
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Update the `DATABASE_URL`:

```env
# Local Development
DATABASE_URL="postgresql://promofinder:promofinder_dev@localhost:5432/promofinder?schema=public"

# Or use your custom credentials
DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/promofinder?schema=public"
```

### 4. Generate Prisma Client

```bash
cd /Users/lorenzopeluso10/Desktop/promo-finder
npx prisma generate
```

This generates the type-safe Prisma Client based on your schema.

### 5. Run Migrations

```bash
npx prisma migrate dev --name init
```

This creates the database tables, indexes, and constraints.

### 6. Seed the Database

```bash
npm run db:seed
# Or manually:
npx ts-node prisma/seed.ts
```

This inserts 50 verified products with images, translations, and verification history.

### 7. Verify Setup

```bash
# Open Prisma Studio to browse data
npx prisma studio
```

Visit `http://localhost:5555` to view your database.

---

## Railway Production Setup

### 1. Create Railway Account

Visit [railway.app](https://railway.app) and sign up.

### 2. Create New Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create new project
railway init
```

### 3. Add PostgreSQL Service

In Railway Dashboard:
1. Click "New" → "Database" → "PostgreSQL"
2. Wait for provisioning (1-2 minutes)
3. Copy the connection string

### 4. Configure Environment Variables

In Railway Dashboard, add environment variables:

```env
DATABASE_URL=postgresql://postgres:PASSWORD@HOST:PORT/railway?schema=public
NODE_ENV=production
```

Railway automatically provides `DATABASE_URL` for PostgreSQL services.

### 5. Deploy Migrations

```bash
# Set Railway environment
railway link

# Run migrations
npx prisma migrate deploy

# Or use Railway CLI
railway run npx prisma migrate deploy
```

### 6. Seed Production Database

```bash
railway run npx ts-node prisma/seed.ts
```

### 7. Verify Deployment

```bash
# Check database
railway run npx prisma studio
```

---

## Database Schema

### Core Tables

#### Products Table

Main product catalog with partitioning by source.

```typescript
model Product {
  id                  String           // Unique identifier (CUID)
  name                String           // Product name
  brand               String           // Brand name
  category            ProductCategory  // shoes, clothing, accessories
  source              ProductSource    // nike, adidas, zara, etc.
  originalPrice       Float            // Original price
  salePrice           Float            // Sale price
  discountPercentage  Int              // Discount %
  productUrl          String           // Product URL
  imageUrl            String?          // Primary image URL
  confidenceScore     Int              // 0-100 confidence
  isActive            Boolean          // Active/quarantined
  isNew               Boolean          // New arrival flag
  lastVerifiedAt      DateTime?        // Last verification timestamp
  expiresAt           DateTime?        // Deal expiration
  viewCount           Int              // Analytics
  clickCount          Int              // Analytics
  popularityScore     Float            // Computed popularity
  attributes          Json?            // Flexible metadata
  createdAt           DateTime         // Creation timestamp
  updatedAt           DateTime         // Update timestamp
}
```

**Indexes:**
- `(isActive, category, discountPercentage, confidenceScore)` - Filtered deals
- `(source, isActive)` - Source filtering
- `(brand, category)` - Brand browsing
- `(popularityScore)` - Trending products
- `(expiresAt)` - Expired deals cleanup

#### Product Images Table

Supports multiple images per product.

```typescript
model ProductImage {
  id                  String        // Unique identifier
  productId           String        // Foreign key to Product
  imageUrl            String        // Image URL
  imageStatus         ImageStatus   // pending, validated, broken
  isPrimary           Boolean       // Primary image flag
  altText             String?       // Accessibility text
  width               Int?          // Image dimensions
  height              Int?          // Image dimensions
  lastCheckedAt       DateTime?     // Last validation check
  validatedWithClaude Boolean       // AI validation flag
}
```

#### Translations Table

Multi-language support for 6 languages.

```typescript
model Translation {
  id                  String        // Unique identifier
  productId           String        // Foreign key to Product
  language            String        // ISO 639-1 code (en, it, es, fr, de, pt)
  name                String        // Translated name
  description         String?       // Translated description
  isAutoTranslated    Boolean       // Auto vs manual flag
  translatedBy        String?       // deepl, manual, claude
}
```

**Unique Constraint:** `(productId, language)`

#### Verification History Table

Audit trail for all verification checks.

```typescript
model VerificationHistory {
  id                  String              // Unique identifier
  productId           String              // Foreign key to Product
  verificationType    String              // url, image, price, claude_vision
  status              VerificationStatus  // pending, success, failed
  httpStatus          Int?                // HTTP response code
  responseTime        Int?                // Check duration (ms)
  errorMessage        String?             // Error details
  metadata            Json?               // Additional data
  previousConfidence  Int                 // Before check
  newConfidence       Int                 // After check
  createdAt           DateTime            // Check timestamp
}
```

#### API Logs Table

Cost tracking and monitoring.

```typescript
model ApiLog {
  id                  String        // Unique identifier
  provider            String        // rapidapi, rainforest, deepl, claude
  endpoint            String        // API endpoint
  requestParams       Json?         // Request parameters
  responseStatus      Int           // HTTP status
  responseTime        Int           // Duration (ms)
  creditsUsed         Int           // API credits consumed
  estimatedCost       Float?        // Cost in USD
  success             Boolean       // Success flag
  errorMessage        String?       // Error details
  createdAt           DateTime      // Log timestamp
}
```

#### User Interactions Table

Analytics and popularity tracking.

```typescript
model UserInteraction {
  id                  String        // Unique identifier
  productId           String        // Foreign key to Product
  interactionType     String        // view, click, share, favorite
  sessionId           String?       // Session identifier
  userAgent           String?       // Browser info
  referrer            String?       // Referrer URL
  country             String?       // User country
  language            String?       // User language
  createdAt           DateTime      // Interaction timestamp
}
```

---

## Running Migrations

### Development Migrations

Create a new migration after schema changes:

```bash
npx prisma migrate dev --name <migration_name>
```

Examples:
```bash
npx prisma migrate dev --name add_expiration_field
npx prisma migrate dev --name create_indexes
npx prisma migrate dev --name add_materialized_views
```

### Production Migrations

Deploy migrations to production:

```bash
npx prisma migrate deploy
```

This runs all pending migrations without prompting.

### Reset Database (Development Only)

**WARNING:** This deletes all data!

```bash
npx prisma migrate reset
```

This:
1. Drops the database
2. Recreates the database
3. Runs all migrations
4. Runs seed script

---

## Seeding the Database

### Seed Data

The seed script inserts:
- **50 verified products** from major brands
- **50 product images** (1 per product)
- **25 translations** (5 products × 5 languages)
- **50 verification history entries**

### Run Seed Script

```bash
# From backend directory
npm run db:seed

# Or manually
npx ts-node ../prisma/seed.ts
```

### Verify Seeding

```bash
# Open Prisma Studio
npx prisma studio

# Or query directly
npx prisma db execute --stdin <<SQL
SELECT
  source,
  COUNT(*) as product_count,
  AVG(confidence_score) as avg_confidence,
  AVG(discount_percentage) as avg_discount
FROM products
GROUP BY source
ORDER BY product_count DESC;
SQL
```

---

## Testing

### Run All Tests

```bash
cd backend
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Specific Test File

```bash
npm test -- db/__tests__/queries.test.ts
```

### Test Coverage

```bash
npm test -- --coverage
```

### Test Database Setup

The tests use the same database but clean up after themselves:

1. **Before Tests:** Clear test data
2. **Run Tests:** Create test products
3. **After Tests:** Delete test data

**Important:** Use a separate test database in production!

```env
# .env.test
DATABASE_URL="postgresql://promofinder:test_password@localhost:5432/promofinder_test?schema=public"
```

---

## Performance Optimization

### Query Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Indexed queries | <50ms | pg_stat_statements |
| Materialized view queries | <100ms | pg_stat_statements |
| Bulk inserts (100 products) | <500ms | Application logs |
| Full-text search | <200ms | pg_stat_statements |

### Materialized Views

Create materialized views for complex queries:

```sql
-- Top deals by category (refreshed every 5 minutes)
CREATE MATERIALIZED VIEW mv_top_deals AS
SELECT
  id, name, brand, category, sale_price,
  discount_percentage, confidence_score, view_count,
  ROW_NUMBER() OVER (
    PARTITION BY category
    ORDER BY discount_percentage DESC, popularity_score DESC
  ) as rank
FROM products
WHERE is_active = true
  AND confidence_score >= 85
  AND (expires_at > NOW() OR expires_at IS NULL);

-- Create index on materialized view
CREATE INDEX idx_mv_top_deals_category ON mv_top_deals(category, rank);

-- Refresh concurrently (no locking)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_deals;
```

### Table Partitioning

Partition products table by source for better query performance:

```sql
-- Create partitioned table (PostgreSQL 17)
CREATE TABLE products_partitioned (
  LIKE products INCLUDING ALL
) PARTITION BY LIST (source);

-- Create partitions for each source
CREATE TABLE products_nike PARTITION OF products_partitioned
  FOR VALUES IN ('nike');

CREATE TABLE products_adidas PARTITION OF products_partitioned
  FOR VALUES IN ('adidas');

CREATE TABLE products_zara PARTITION OF products_partitioned
  FOR VALUES IN ('zara');

-- Continue for other sources...
```

### PostgreSQL Configuration

Optimize PostgreSQL for read-heavy workloads:

```conf
# postgresql.conf (16GB RAM server)
shared_buffers = 4GB                  # 25% of RAM
effective_cache_size = 12GB           # 75% of RAM
work_mem = 64MB                       # Per query memory
maintenance_work_mem = 1GB            # For VACUUM, CREATE INDEX
random_page_cost = 1.1                # SSD optimization
effective_io_concurrency = 200        # SSD
max_connections = 200                 # Connection pool
shared_preload_libraries = 'pg_stat_statements'
```

### Connection Pooling

Use PgBouncer for connection pooling:

```bash
# Install PgBouncer
sudo apt install pgbouncer

# Configure /etc/pgbouncer/pgbouncer.ini
[databases]
promofinder = host=localhost port=5432 dbname=promofinder

[pgbouncer]
listen_port = 6432
listen_addr = *
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
```

Update `DATABASE_URL`:
```env
DATABASE_URL="postgresql://promofinder:password@localhost:6432/promofinder?schema=public&pgbouncer=true"
```

---

## Troubleshooting

### Common Issues

#### 1. "Prisma Client not generated"

**Error:**
```
Error: Cannot find module '@prisma/client'
```

**Solution:**
```bash
npx prisma generate
```

#### 2. "Migration failed"

**Error:**
```
P3009: migrate found failed migrations
```

**Solution:**
```bash
# Reset database (development only)
npx prisma migrate reset

# Or manually fix and retry
npx prisma migrate resolve --applied <migration_name>
```

#### 3. "Connection refused"

**Error:**
```
Error: Can't reach database server at localhost:5432
```

**Solution:**
```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Start PostgreSQL
brew services start postgresql@17  # macOS
sudo systemctl start postgresql    # Linux
```

#### 4. "Permission denied"

**Error:**
```
FATAL: role "promofinder" does not exist
```

**Solution:**
```bash
# Create user
sudo -u postgres createuser -s promofinder

# Or with password
sudo -u postgres psql -c "CREATE USER promofinder WITH PASSWORD 'your_password';"
```

#### 5. "Seed script fails"

**Error:**
```
Error: ts-node: command not found
```

**Solution:**
```bash
# Install ts-node globally
npm install -g ts-node

# Or use npx
npx ts-node prisma/seed.ts
```

### Performance Issues

#### Slow Queries

```bash
# Enable query logging
# In postgresql.conf:
log_min_duration_statement = 100  # Log queries > 100ms

# View slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

#### High Memory Usage

```bash
# Check PostgreSQL memory
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Useful Commands

### Prisma CLI

```bash
# Generate Prisma Client
npx prisma generate

# Create migration
npx prisma migrate dev --name <name>

# Deploy migrations
npx prisma migrate deploy

# Reset database
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio

# Format schema
npx prisma format

# Validate schema
npx prisma validate

# Pull schema from database
npx prisma db pull

# Push schema to database (no migrations)
npx prisma db push
```

### PostgreSQL Commands

```bash
# Connect to database
psql -U promofinder -d promofinder

# List databases
\l

# List tables
\dt

# Describe table
\d products

# Run SQL file
psql -U promofinder -d promofinder -f script.sql

# Dump database
pg_dump promofinder > backup.sql

# Restore database
psql promofinder < backup.sql
```

---

## Next Steps

1. **Set up Railway database** for production
2. **Run migrations** on Railway
3. **Seed production data** (50 products)
4. **Configure connection pooling** (PgBouncer or Railway)
5. **Set up monitoring** (Sentry, DataDog)
6. **Create materialized views** for performance
7. **Implement table partitioning** as data grows
8. **Set up automated backups** (Railway automatic backups)

---

## Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL 17 Documentation](https://www.postgresql.org/docs/17/)
- [Railway Documentation](https://docs.railway.app/)
- [Design Document](./docs/plans/2026-01-06-production-scale-design.md)
- [Orchestration Plan](./docs/plans/2026-01-06-agent-orchestration-plan.md)

---

## Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section
2. Review [Prisma GitHub Issues](https://github.com/prisma/prisma/issues)
3. Consult [PostgreSQL Wiki](https://wiki.postgresql.org/)
4. Open an issue in the project repository

---

**Database Setup Complete!** 🗄️

You now have a production-ready PostgreSQL database with:
- Complete Prisma schema
- 50 verified products
- Performance optimizations
- Comprehensive testing
- Full documentation
