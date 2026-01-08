const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { fetchRealtimeDeals } = require('./scrapers/realtime-api');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Cache deals
let dealsCache = {
  data: [],
  lastUpdated: null,
  isRefreshing: false
};

// Carica deals all'avvio
async function loadDeals() {
  console.log('🔄 Loading verified real-time deals...');

  try {
    const deals = await fetchRealtimeDeals();
    dealsCache.data = deals;
    dealsCache.lastUpdated = new Date().toISOString();
    console.log(`✅ Loaded ${deals.length} verified products with working images`);
  } catch (error) {
    console.error('Error loading deals:', error.message);
    dealsCache.data = [];
  }
}

// Load on startup
loadDeals();

// Filter deals
function filterDeals(deals, filters) {
  let filtered = [...deals];

  if (filters.category && filters.category !== 'all') {
    filtered = filtered.filter(deal => deal.category === filters.category);
  }

  if (filters.minDiscount) {
    const minDisc = parseInt(filters.minDiscount);
    filtered = filtered.filter(deal => deal.discount >= minDisc);
  }

  if (filters.maxPrice) {
    const maxP = parseFloat(filters.maxPrice);
    filtered = filtered.filter(deal => deal.salePrice <= maxP);
  }

  if (filters.brand) {
    const brandLower = filters.brand.toLowerCase();
    filtered = filtered.filter(deal => deal.brand.toLowerCase().includes(brandLower));
  }

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(deal =>
      deal.name.toLowerCase().includes(searchLower) ||
      deal.brand.toLowerCase().includes(searchLower)
    );
  }

  // Sort
  const sortBy = filters.sortBy || 'relevance';
  if (sortBy === 'priceLow') {
    filtered.sort((a, b) => a.salePrice - b.salePrice);
  } else if (sortBy === 'priceHigh') {
    filtered.sort((a, b) => b.salePrice - a.salePrice);
  } else if (sortBy === 'discountHigh') {
    filtered.sort((a, b) => b.discount - a.discount);
  } else if (sortBy === 'newest') {
    filtered.sort((a, b) => new Date(b.scrapedAt) - new Date(a.scrapedAt));
  }

  return filtered;
}

// Health Check Endpoint (for monitoring and load balancers)
app.get('/health', (req, res) => {
  const startTime = Date.now();

  try {
    // Check system health
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      services: {
        cache: dealsCache.data.length > 0 ? 'ready' : 'empty',
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        }
      },
      metrics: {
        dealsCount: dealsCache.data.length,
        lastUpdated: dealsCache.lastUpdated,
        isRefreshing: dealsCache.isRefreshing
      }
    };

    // Determine overall status
    if (dealsCache.data.length === 0 && !dealsCache.isRefreshing) {
      health.status = 'degraded';
      health.message = 'No deals loaded';
    }

    const responseTime = Date.now() - startTime;
    health.responseTime = `${responseTime}ms`;

    res.status(health.status === 'ok' ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'down',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Routes
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'PromoFinder API is running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      deals: '/api/deals',
      stats: '/api/stats',
      refresh: '/api/deals/refresh'
    }
  });
});

app.get('/api/deals', (req, res) => {
  try {
    const filters = {
      category: req.query.category,
      minDiscount: req.query.minDiscount,
      maxPrice: req.query.maxPrice,
      brand: req.query.brand,
      search: req.query.search,
      sortBy: req.query.sortBy
    };

    const filteredDeals = filterDeals(dealsCache.data, filters);

    res.json({
      success: true,
      count: filteredDeals.length,
      lastUpdated: dealsCache.lastUpdated,
      deals: filteredDeals
    });
  } catch (error) {
    console.error('Error in /api/deals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deals',
      message: error.message
    });
  }
});

app.get('/api/stats', (req, res) => {
  try {
    const stats = {
      totalDeals: dealsCache.data.length,
      lastUpdated: dealsCache.lastUpdated,
      bySource: {},
      byCategory: {},
      avgDiscount: 0
    };

    let totalDiscount = 0;
    dealsCache.data.forEach(deal => {
      stats.bySource[deal.source] = (stats.bySource[deal.source] || 0) + 1;
      stats.byCategory[deal.category] = (stats.byCategory[deal.category] || 0) + 1;
      totalDiscount += deal.discount;
    });

    stats.avgDiscount = dealsCache.data.length > 0
      ? Math.round(totalDiscount / dealsCache.data.length)
      : 0;

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Refresh endpoint
app.get('/api/deals/refresh', async (req, res) => {
  if (dealsCache.isRefreshing) {
    return res.json({
      success: false,
      message: 'Refresh already in progress'
    });
  }

  dealsCache.isRefreshing = true;

  try {
    await loadDeals();
    dealsCache.isRefreshing = false;

    res.json({
      success: true,
      message: 'Deals refreshed',
      count: dealsCache.data.length
    });
  } catch (error) {
    dealsCache.isRefreshing = false;
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 PromoFinder API running on http://localhost:${PORT}`);
  console.log(`⏳ Loading real-time deals...`);

  // Wait for initial load
  await new Promise(resolve => {
    const checkInterval = setInterval(() => {
      if (dealsCache.data.length > 0 || !dealsCache.isRefreshing) {
        clearInterval(checkInterval);
        console.log(`📊 Serving ${dealsCache.data.length} verified products`);
        console.log(`✨ All images and links verified!`);
        console.log(`🔄 Auto-refresh every 2 hours`);
        resolve();
      }
    }, 100);
  });
});

// Auto-refresh every 2 hours
setInterval(() => {
  console.log('⏰ Auto-refreshing deals...');
  loadDeals();
}, 2 * 60 * 60 * 1000);
