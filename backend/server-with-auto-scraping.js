const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { startAutoScraping, stopAutoScraping, getSchedulerStats, triggerManualScrape } = require('./services/scraping/auto-scraper-scheduler');

const prisma = new PrismaClient();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

/**
 * PromoFinder Backend Server with Automatic Real-Time Scraping
 *
 * Features:
 * - Automatic scraping every 6 hours (00:00, 06:00, 12:00, 18:00)
 * - Real-time product updates in database
 * - Auto-cleanup of old products (>7 days)
 * - Admin endpoints to monitor and control scraping
 */

// ============================================================================
// PRODUCT API ENDPOINTS
// ============================================================================

/**
 * GET /api/deals - Get deals with filters
 */
app.get('/api/deals', async (req, res) => {
  try {
    const {
      region,
      minDiscount,
      maxPrice,
      brand,
      category,
      page = 1,
      limit = 50,
      sortBy = 'discount'
    } = req.query;

    // Build filter
    const where = {};

    if (region && region !== 'GLOBAL') {
      where.availableRegions = {
        has: region
      };
    }

    if (minDiscount) {
      where.discount = {
        gte: parseInt(minDiscount)
      };
    }

    if (maxPrice) {
      where.salePrice = {
        lte: parseFloat(maxPrice)
      };
    }

    if (brand) {
      where.brand = {
        contains: brand,
        mode: 'insensitive'
      };
    }

    if (category) {
      where.category = category;
    }

    // Sort options
    const orderBy = {};
    if (sortBy === 'discount') {
      orderBy.discount = 'desc';
    } else if (sortBy === 'price-low') {
      orderBy.salePrice = 'asc';
    } else if (sortBy === 'price-high') {
      orderBy.salePrice = 'desc';
    } else if (sortBy === 'newest') {
      orderBy.scrapedAt = 'desc';
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get products
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: parseInt(limit)
      }),
      prisma.product.count({ where })
    ]);

    // Get last scrape time
    const lastProduct = await prisma.product.findFirst({
      orderBy: { scrapedAt: 'desc' },
      select: { scrapedAt: true }
    });

    res.json({
      deals: products,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      lastUpdated: lastProduct?.scrapedAt || new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching deals:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

/**
 * GET /api/deals/stats - Get deal statistics
 */
app.get('/api/deals/stats', async (req, res) => {
  try {
    const total = await prisma.product.count();

    const avgDiscount = await prisma.product.aggregate({
      _avg: { discount: true }
    });

    const bySources = await prisma.product.groupBy({
      by: ['source'],
      _count: true
    });

    const byCategory = await prisma.product.groupBy({
      by: ['category'],
      _count: true
    });

    res.json({
      total,
      avgDiscount: avgDiscount._avg.discount || 0,
      bySource: bySources.map(s => ({ source: s.source, count: s._count })),
      byCategory: byCategory.map(c => ({ category: c.category, count: c._count }))
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// ============================================================================
// ADMIN/MONITORING ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/scraper/status - Get scraper status
 */
app.get('/api/admin/scraper/status', (req, res) => {
  try {
    const stats = getSchedulerStats();

    if (!stats) {
      return res.json({
        active: false,
        message: 'Scraper scheduler not started'
      });
    }

    res.json({
      active: true,
      ...stats
    });

  } catch (error) {
    console.error('Error fetching scraper status:', error);
    res.status(500).json({ error: 'Failed to fetch scraper status' });
  }
});

/**
 * POST /api/admin/scraper/trigger - Manually trigger scrape cycle
 */
app.post('/api/admin/scraper/trigger', async (req, res) => {
  try {
    console.log('⚡ Manual scrape triggered via API');

    // Trigger scrape in background
    triggerManualScrape().catch(err => {
      console.error('Manual scrape failed:', err);
    });

    res.json({
      success: true,
      message: 'Scrape cycle triggered. This will run in the background.'
    });

  } catch (error) {
    console.error('Error triggering scrape:', error);
    res.status(500).json({ error: 'Failed to trigger scrape' });
  }
});

/**
 * POST /api/admin/scraper/stop - Stop the scheduler
 */
app.post('/api/admin/scraper/stop', (req, res) => {
  try {
    stopAutoScraping();
    res.json({
      success: true,
      message: 'Scraper scheduler stopped'
    });
  } catch (error) {
    console.error('Error stopping scraper:', error);
    res.status(500).json({ error: 'Failed to stop scraper' });
  }
});

/**
 * POST /api/admin/scraper/start - Start the scheduler
 */
app.post('/api/admin/scraper/start', (req, res) => {
  try {
    startAutoScraping();
    res.json({
      success: true,
      message: 'Scraper scheduler started'
    });
  } catch (error) {
    console.error('Error starting scraper:', error);
    res.status(500).json({ error: 'Failed to start scraper' });
  }
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║         PromoFinder Backend Server with Auto-Scraping           ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoints:`);
  console.log(`   GET  /api/deals - Fetch deals with filters`);
  console.log(`   GET  /api/deals/stats - Get statistics`);
  console.log(`   GET  /api/admin/scraper/status - Scraper status`);
  console.log(`   POST /api/admin/scraper/trigger - Manual trigger`);
  console.log(`   POST /api/admin/scraper/start - Start scheduler`);
  console.log(`   POST /api/admin/scraper/stop - Stop scheduler\n`);

  // Start automatic scraping
  console.log('🤖 Starting automatic scraper...\n');
  startAutoScraping();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n⏹️  Shutting down gracefully...');

  // Stop scraper
  stopAutoScraping();

  // Disconnect Prisma
  await prisma.$disconnect();

  console.log('✅ Cleanup complete. Goodbye!\n');
  process.exit(0);
});

module.exports = app;
