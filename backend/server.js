const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { scrapeZalando } = require('./scrapers/zalando');
const { scrapeAsos } = require('./scrapers/asos');
const { scrapeHM } = require('./scrapers/hm');

const app = express();
const PORT = process.env.PORT || 3001;

// Cache file path
const CACHE_FILE = path.join(__dirname, 'cache', 'deals.json');

// Middleware
app.use(cors());
app.use(express.json());

// Ensure cache directory exists
if (!fs.existsSync(path.join(__dirname, 'cache'))) {
  fs.mkdirSync(path.join(__dirname, 'cache'));
}

// Initialize cache
let dealsCache = {
  data: [],
  lastUpdated: null,
  isRefreshing: false
};

// Load cache from file on startup
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      dealsCache = JSON.parse(data);
      console.log(`📦 Loaded ${dealsCache.data.length} deals from cache`);
    } else {
      console.log('📦 No cache file found, will fetch fresh data');
    }
  } catch (error) {
    console.error('❌ Error loading cache:', error.message);
  }
}

// Save cache to file
function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(dealsCache, null, 2));
    console.log(`💾 Saved ${dealsCache.data.length} deals to cache`);
  } catch (error) {
    console.error('❌ Error saving cache:', error.message);
  }
}

// Fetch all deals from scrapers
async function fetchAllDeals() {
  if (dealsCache.isRefreshing) {
    console.log('⏳ Refresh already in progress, skipping...');
    return dealsCache.data;
  }

  dealsCache.isRefreshing = true;
  console.log('🔄 Starting to fetch deals from all sources...');

  try {
    const results = await Promise.allSettled([
      scrapeZalando(),
      scrapeAsos(),
      scrapeHM()
    ]);

    let allDeals = [];

    results.forEach((result, index) => {
      const source = ['Zalando', 'ASOS', 'H&M'][index];
      if (result.status === 'fulfilled') {
        console.log(`✅ ${source}: ${result.value.length} deals`);
        allDeals = allDeals.concat(result.value);
      } else {
        console.error(`❌ ${source} failed:`, result.reason.message);
      }
    });

    // Remove duplicates based on name and price
    const uniqueDeals = Array.from(
      new Map(allDeals.map(deal => [`${deal.brand}-${deal.name}-${deal.salePrice}`, deal])).values()
    );

    dealsCache.data = uniqueDeals;
    dealsCache.lastUpdated = new Date().toISOString();
    dealsCache.isRefreshing = false;

    saveCache();

    console.log(`✨ Total unique deals fetched: ${uniqueDeals.length}`);
    return uniqueDeals;

  } catch (error) {
    console.error('❌ Error fetching deals:', error);
    dealsCache.isRefreshing = false;
    return dealsCache.data; // Return cached data on error
  }
}

// Filter deals based on query parameters
function filterDeals(deals, filters) {
  let filtered = [...deals];

  // Filter by category
  if (filters.category && filters.category !== 'all') {
    filtered = filtered.filter(deal => deal.category === filters.category);
  }

  // Filter by minimum discount
  if (filters.minDiscount) {
    const minDisc = parseInt(filters.minDiscount);
    filtered = filtered.filter(deal => deal.discount >= minDisc);
  }

  // Filter by maximum price
  if (filters.maxPrice) {
    const maxP = parseFloat(filters.maxPrice);
    filtered = filtered.filter(deal => deal.salePrice <= maxP);
  }

  // Filter by brand
  if (filters.brand) {
    const brandLower = filters.brand.toLowerCase();
    filtered = filtered.filter(deal => deal.brand.toLowerCase().includes(brandLower));
  }

  // Search by name
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

// Routes

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'PromoFinder API is running',
    version: '1.0.0',
    endpoints: {
      deals: '/api/deals',
      refresh: '/api/deals/refresh',
      stats: '/api/stats'
    }
  });
});

// Get deals with filters
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

// Force refresh deals
app.get('/api/deals/refresh', async (req, res) => {
  try {
    console.log('🔄 Manual refresh requested');

    if (dealsCache.isRefreshing) {
      return res.status(429).json({
        success: false,
        message: 'Refresh already in progress, please wait'
      });
    }

    // Start refresh in background
    fetchAllDeals().catch(err => console.error('Background refresh error:', err));

    res.json({
      success: true,
      message: 'Refresh started',
      note: 'This may take a few moments. Check back soon.'
    });

  } catch (error) {
    console.error('Error in /api/deals/refresh:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh deals',
      message: error.message
    });
  }
});

// Get statistics
app.get('/api/stats', (req, res) => {
  try {
    const stats = {
      totalDeals: dealsCache.data.length,
      lastUpdated: dealsCache.lastUpdated,
      isRefreshing: dealsCache.isRefreshing,
      bySource: {},
      byCategory: {},
      avgDiscount: 0
    };

    // Calculate stats
    let totalDiscount = 0;
    dealsCache.data.forEach(deal => {
      // By source
      stats.bySource[deal.source] = (stats.bySource[deal.source] || 0) + 1;

      // By category
      stats.byCategory[deal.category] = (stats.byCategory[deal.category] || 0) + 1;

      // Total discount
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

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 PromoFinder API server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);

  // Load cache on startup
  loadCache();

  // If cache is empty or old (>2 hours), fetch fresh data
  const cacheAge = dealsCache.lastUpdated
    ? Date.now() - new Date(dealsCache.lastUpdated).getTime()
    : Infinity;

  if (!dealsCache.data.length || cacheAge > 2 * 60 * 60 * 1000) {
    console.log('🔄 Cache is empty or outdated, fetching fresh data...');
    fetchAllDeals().catch(err => console.error('Initial fetch error:', err));
  } else {
    console.log(`✅ Using cached data (${dealsCache.data.length} deals)`);
  }
});

module.exports = app;
