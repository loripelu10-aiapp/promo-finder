# Database Quick Start Guide

**5-minute setup for PromoFinder database**

---

## Prerequisites

- Node.js 20+ installed
- PostgreSQL 17 or Docker
- Terminal access

---

## Local Development (5 steps)

### 1. Start PostgreSQL

**Using Docker (Recommended):**
```bash
docker run --name promofinder-postgres \
  -e POSTGRES_USER=promofinder \
  -e POSTGRES_PASSWORD=promofinder_dev \
  -e POSTGRES_DB=promofinder \
  -p 5432:5432 \
  -d postgres:17
```

**Or use existing PostgreSQL:**
```bash
createdb promofinder
```

### 2. Configure Environment

```bash
cd /Users/lorenzopeluso10/Desktop/promo-finder

# Create .env file (if it doesn't exist)
echo 'DATABASE_URL="postgresql://promofinder:promofinder_dev@localhost:5432/promofinder?schema=public"' > .env
```

### 3. Generate Prisma Client & Run Migrations

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init
```

### 4. Seed Database (50 Products)

```bash
# Seed with 50 verified products
npx ts-node prisma/seed.ts
```

### 5. Verify Setup

```bash
# Open Prisma Studio
npx prisma studio

# Or check via CLI
npx prisma db execute --stdin <<SQL
SELECT COUNT(*) as total_products FROM products;
SQL
```

Expected output: `total_products = 50`

---

## Run Tests

```bash
cd backend
npm test
```

Expected: All tests pass ✅

---

## Production Deployment (Railway)

### 1. Install Railway CLI

```bash
npm install -g @railway/cli
railway login
```

### 2. Create Project & Add Database

```bash
railway init
railway add --database postgres
```

### 3. Get Database URL

```bash
railway variables get DATABASE_URL
```

### 4. Deploy Migrations

```bash
railway run npx prisma migrate deploy
```

### 5. Seed Production

```bash
railway run npx ts-node prisma/seed.ts
```

### 6. Verify

```bash
railway run npx prisma studio
```

---

## Common Issues

### "Prisma Client not generated"
```bash
npx prisma generate
```

### "Cannot connect to database"
```bash
# Check PostgreSQL is running
docker ps

# Or restart
docker restart promofinder-postgres
```

### "Migration failed"
```bash
# Reset database (development only!)
npx prisma migrate reset
```

---

## Useful Commands

```bash
# View database in browser
npx prisma studio

# Check migration status
npx prisma migrate status

# Reset database (deletes all data!)
npx prisma migrate reset

# Format Prisma schema
npx prisma format

# Pull schema from existing database
npx prisma db pull

# Push schema without migrations (dev only)
npx prisma db push
```

---

## File Locations

- **Schema:** `/prisma/schema.prisma`
- **Seed:** `/prisma/seed.ts`
- **Queries:** `/backend/db/queries.ts`
- **Tests:** `/backend/db/__tests__/queries.test.ts`
- **Migrations:** `/prisma/migrations/`

---

## Next Steps

After database setup:

1. ✅ Database running
2. ⏭️ Start backend API: `cd backend && npm run dev`
3. ⏭️ Start frontend: `cd frontend && npm run dev`
4. ⏭️ Set up Redis cache
5. ⏭️ Configure API integrations

---

## Full Documentation

For detailed guides, see:
- `README-database.md` - Complete setup guide
- `RAILWAY-SETUP.md` - Production deployment
- `DATABASE-IMPLEMENTATION-SUMMARY.md` - Implementation details

---

**Quick Start Complete!** 🚀

Your database is ready with 50 verified fashion products.
