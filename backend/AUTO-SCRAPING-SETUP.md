# Automatic Real-Time Scraping - Setup Guide

**Status**: ✅ Ready to Deploy
**Created**: January 7, 2026

---

## Overview

Your PromoFinder backend now has **fully automatic real-time scraping**. You never need to run scrapers manually again.

### How It Works

1. **Automatic Schedule**: Scrapers run every 6 hours (00:00, 06:00, 12:00, 18:00)
2. **Database Auto-Update**: Products are automatically stored/updated in database
3. **Auto-Cleanup**: Old products (>7 days) are automatically removed
4. **Zero Manual Work**: Just start the server and forget about it

---

## Quick Start

### Option 1: Start Server with Auto-Scraping (Recommended)

```bash
cd /Users/lorenzopeluso10/Desktop/promo-finder/backend
node server-with-auto-scraping.js
```

**What happens**:
- Server starts on port 5001
- Auto-scraper scheduler starts automatically
- Initial scrape runs after 30 seconds
- Subsequent scrapes run every 6 hours
- Products stored in database in real-time

### Option 2: Add to Existing Server

Add this to your existing `server.js`:

```javascript
const { startAutoScraping } = require('./services/scraping/auto-scraper-scheduler');

// After app.listen()
startAutoScraping();
```

### Option 3: Run Scraper Only (No API Server)

```bash
node services/scraping/auto-scraper-scheduler.js
```

This runs ONLY the scraper scheduler without the API server.

---

## Scraping Schedule

### Automatic Schedule
- **00:00** (Midnight) - Full scrape cycle
- **06:00** (6 AM) - Full scrape cycle
- **12:00** (Noon) - Full scrape cycle
- **18:00** (6 PM) - Full scrape cycle

### What Happens Each Cycle

1. **All 7 Scrapers Run Sequentially**:
   - JD Sports UK → Sports Direct UK → Foot Locker UK → H&M EU → Zara EU → Mango EU → Decathlon EU
   - 10-second delay between each scraper
   - Each scraper extracts up to 30-50 products

2. **Products Stored in Database**:
   - New products: Created in database
   - Existing products (same URL): Updated with latest prices
   - Uses `upsert` to avoid duplicates

3. **Old Products Removed**:
   - Products older than 7 days are auto-deleted
   - Keeps database fresh with current deals only

### Expected Duration
- Each scraper: 30-60 seconds
- Full cycle (7 scrapers): ~10-15 minutes
- Total database size: ~200-300 active products

---

## API Endpoints

### Public Endpoints (For Frontend)

#### GET /api/deals
Fetch deals with filters

```bash
GET /api/deals?region=EU&minDiscount=20&page=1&limit=50
```

**Query Parameters**:
- `region` - EU, UK, FR, DE, IT, ES, GLOBAL
- `minDiscount` - Minimum discount percentage (10-70)
- `maxPrice` - Maximum sale price
- `brand` - Filter by brand (Nike, Adidas, etc.)
- `category` - Filter by category (shoes, etc.)
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 50)
- `sortBy` - discount, price-low, price-high, newest

**Response**:
```json
{
  "deals": [...],
  "total": 245,
  "page": 1,
  "limit": 50,
  "lastUpdated": "2026-01-07T18:00:00.000Z"
}
```

#### GET /api/deals/stats
Get statistics

```bash
GET /api/deals/stats
```

**Response**:
```json
{
  "total": 245,
  "avgDiscount": 32.5,
  "bySource": [
    { "source": "footlocker.co.uk", "count": 80 },
    { "source": "zara.com", "count": 60 }
  ],
  "byCategory": [
    { "category": "shoes", "count": 200 },
    { "category": "clothing", "count": 45 }
  ]
}
```

### Admin Endpoints (For Monitoring)

#### GET /api/admin/scraper/status
Check scraper status

```bash
GET /api/admin/scraper/status
```

**Response**:
```json
{
  "active": true,
  "isRunning": false,
  "currentScraper": null,
  "totalRuns": 12,
  "successfulRuns": 84,
  "failedRuns": 0,
  "totalProducts": 2940,
  "lastRun": "2026-01-07T18:00:00.000Z",
  "nextRun": "2026-01-08T00:00:00.000Z"
}
```

#### POST /api/admin/scraper/trigger
Manually trigger a scrape cycle (for testing)

```bash
POST /api/admin/scraper/trigger
```

**Response**:
```json
{
  "success": true,
  "message": "Scrape cycle triggered. This will run in the background."
}
```

#### POST /api/admin/scraper/start
Start the scheduler

```bash
POST /api/admin/scraper/start
```

#### POST /api/admin/scraper/stop
Stop the scheduler

```bash
POST /api/admin/scraper/stop
```

---

## Environment Variables

No special environment variables needed! The scraper works out of the box.

**Optional** (if you want to customize):

```bash
# .env file
DATABASE_URL="postgresql://user:pass@localhost:5432/promofinder"
PORT=5001
```

---

## Database Schema

Products are stored using your existing Prisma schema:

```prisma
model Product {
  id                Int       @id @default(autoincrement())
  name              String
  brand             String
  category          String
  originalPrice     Float
  salePrice         Float
  discount          Int
  currency          String
  image             String
  url               String    @unique
  source            String
  availableRegions  String[]
  verified          Boolean   @default(false)
  scrapedAt         DateTime  @default(now())
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

**Key Fields**:
- `url`: Unique identifier (prevents duplicates)
- `scrapedAt`: Last time product was updated by scraper
- `availableRegions`: Array of region codes (EU, UK, etc.)
- `verified`: Always `false` for auto-scraped products

---

## Monitoring & Logs

### Console Output

The scraper logs everything to console:

```
╔══════════════════════════════════════════════════════════════════╗
║               AUTOMATED SCRAPE CYCLE STARTED                     ║
╚══════════════════════════════════════════════════════════════════╝
⏰ Started at: 2026-01-07T12:00:00.000Z

[1/7] Running JD Sports UK...
   ⏳ Scraping...
   📦 Scraped 45 products
   💾 Storing in database...
   ✅ Success: 45 products stored in 32.5s

⏳ Waiting 10 seconds before next scraper...

[2/7] Running Sports Direct UK...
...

╔══════════════════════════════════════════════════════════════════╗
║              AUTOMATED SCRAPE CYCLE COMPLETE                     ║
╚══════════════════════════════════════════════════════════════════╝
⏰ Completed at: 2026-01-07T12:12:34.000Z
⏱️  Duration: 12.6 minutes
✅ Successful scrapers: 7/7
📦 Total products stored: 245
📊 Next cycle: 2026-01-07T18:00:00.000Z
```

### Check Scraper Status

```bash
# Via API
curl http://localhost:5001/api/admin/scraper/status

# Expected output
{
  "active": true,
  "totalRuns": 12,
  "successfulRuns": 84,
  "totalProducts": 2940,
  "nextRun": "2026-01-07T18:00:00.000Z"
}
```

---

## Troubleshooting

### Issue: Scraper Not Starting

**Check**:
```bash
curl http://localhost:5001/api/admin/scraper/status
```

**If not active**:
```bash
curl -X POST http://localhost:5001/api/admin/scraper/start
```

### Issue: No Products in Database

**Check last scrape time**:
```bash
curl http://localhost:5001/api/deals/stats
```

**Manually trigger a scrape**:
```bash
curl -X POST http://localhost:5001/api/admin/scraper/trigger
```

**Check console logs** for errors.

### Issue: Scraper Failing

**Check debug screenshots**:
```bash
ls -la /tmp/*-debug.png
```

These screenshots show what the scraper saw on each retailer's website.

**Common causes**:
- Site changed structure (update CSS selectors)
- Site blocking automated access (use proxies)
- Network issues (check connectivity)
- Rate limiting (increase delays)

### Issue: Database Full of Old Products

The auto-cleanup should handle this, but you can manually clean:

```javascript
// In Prisma Studio or Node console
await prisma.product.deleteMany({
  where: {
    scrapedAt: {
      lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
    }
  }
});
```

---

## Customization

### Change Scraping Schedule

Edit `/services/scraping/auto-scraper-scheduler.js:66`:

```javascript
// Current: Every 6 hours
this.mainSchedule = cron.schedule('0 */6 * * *', async () => {
  await this.runFullScrapeCircle();
});

// Every 4 hours
this.mainSchedule = cron.schedule('0 */4 * * *', ...);

// Every 12 hours (midnight and noon)
this.mainSchedule = cron.schedule('0 0,12 * * *', ...);

// Once per day at midnight
this.mainSchedule = cron.schedule('0 0 * * *', ...);
```

**Cron Format**: `minute hour day month weekday`

### Change Max Products Per Scraper

Edit `/services/scraping/auto-scraper-scheduler.js:36-42`:

```javascript
this.scrapers = [
  { name: 'JD Sports UK', Class: JDSportsUKScraper, maxProducts: 100 }, // Changed from 50
  { name: 'H&M EU', Class: HMEUScraper, maxProducts: 50 }, // Changed from 30
  // ...
];
```

### Change Auto-Cleanup Age

Edit `/services/scraping/auto-scraper-scheduler.js:261`:

```javascript
// Current: 7 days
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

// Change to 3 days
const threeDaysAgo = new Date();
threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
```

### Add More Scrapers

Edit `/services/scraping/auto-scraper-scheduler.js:36-42`:

```javascript
const NewRetailerScraper = require('../../scrapers/eu-retailers/new-retailer');

this.scrapers = [
  // ... existing scrapers
  { name: 'New Retailer', Class: NewRetailerScraper, maxProducts: 30 }
];
```

---

## Production Deployment

### Recommended Setup

1. **Use PM2** (process manager):
   ```bash
   npm install -g pm2
   pm2 start server-with-auto-scraping.js --name promofinder-backend
   pm2 save
   pm2 startup
   ```

2. **Enable Logging**:
   ```bash
   pm2 logs promofinder-backend
   ```

3. **Monitor**:
   ```bash
   pm2 monit
   ```

### Environment Variables

```bash
# .env for production
DATABASE_URL="postgresql://user:pass@localhost:5432/promofinder"
PORT=5001
NODE_ENV=production
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name api.promofinder.com;

    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Performance

### Expected Metrics

| Metric | Value |
|--------|-------|
| Scrape frequency | Every 6 hours |
| Scrapers per cycle | 7 |
| Products per scraper | 30-50 |
| Total products | 200-300 |
| Cycle duration | 10-15 minutes |
| Database size | ~5-10 MB |
| Memory usage | 200-400 MB |

### Optimization Tips

1. **Reduce Frequency**: If 6 hours is too frequent, change to 12 hours
2. **Reduce Products**: Lower `maxProducts` to 20-30 per scraper
3. **Use Proxies**: Rotate IP addresses to avoid blocking
4. **Cache Results**: Add Redis cache layer for API responses
5. **Database Indexing**: Ensure `url`, `source`, `category`, `scrapedAt` are indexed

---

## Files Created

| File | Purpose |
|------|---------|
| `/services/scraping/auto-scraper-scheduler.js` | Main scheduler |
| `/server-with-auto-scraping.js` | Server with auto-scraping |
| `/AUTO-SCRAPING-SETUP.md` | This guide |

---

## Summary

✅ **Automatic scraping every 6 hours**
✅ **Real-time database updates**
✅ **Auto-cleanup of old products**
✅ **API endpoints for monitoring**
✅ **Manual trigger for testing**
✅ **Zero manual work required**

**Next Steps**:
1. Start server: `node server-with-auto-scraping.js`
2. Wait 30 seconds for initial scrape
3. Check `/api/deals` endpoint
4. Monitor `/api/admin/scraper/status`

That's it! Your scraping system now runs 100% automatically.

---

**Created**: January 7, 2026
**Status**: ✅ Production Ready
