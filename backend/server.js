const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Products file path - our scraped products
const PRODUCTS_FILE = path.join(__dirname, 'data', 'products.json');

// Middleware
app.use(cors());
app.use(express.json());

// Initialize cache
let dealsCache = {
  data: [],
  lastUpdated: null,
  isRefreshing: false
};

// Load products from data/products.json on startup
function loadCache() {
  try {
    if (fs.existsSync(PRODUCTS_FILE)) {
      const data = fs.readFileSync(PRODUCTS_FILE, 'utf8');
      const products = JSON.parse(data);
      dealsCache.data = products;
      dealsCache.lastUpdated = new Date().toISOString();
      console.log(`📦 Loaded ${products.length} products from data/products.json`);
    } else {
      console.log('⚠️ No products.json found, starting with empty data');
    }
  } catch (error) {
    console.error('❌ Error loading products:', error.message);
  }
}

// Reload products from file
function reloadProducts() {
  console.log('🔄 Reloading products from data/products.json...');
  loadCache();
  console.log(`✅ Loaded ${dealsCache.data.length} products`);
  return dealsCache.data;
}

// Filter deals based on query parameters
function filterDeals(deals, filters) {
  let filtered = [...deals];

  // Filter by gender (AI-detected)
  if (filters.genders && filters.genders.length > 0) {
    const genderList = filters.genders.split(',');
    filtered = filtered.filter(deal => genderList.includes(deal.gender));
  }

  // Filter by retailers
  if (filters.retailers && filters.retailers.length > 0) {
    const retailerList = filters.retailers.split(',');
    filtered = filtered.filter(deal =>
      retailerList.includes(deal.retailer) ||
      retailerList.includes(deal.merchantName)
    );
  }

  // Filter by category
  if (filters.category && filters.category !== 'all') {
    filtered = filtered.filter(deal => deal.category === filters.category);
  }

  // Filter by smart categories
  if (filters.smartCategories && filters.smartCategories.length > 0) {
    const catList = filters.smartCategories.split(',');
    filtered = filtered.filter(deal =>
      deal.smartCategories && deal.smartCategories.some(c => catList.includes(c))
    );
  }

  // Filter by minimum discount
  if (filters.minDiscount) {
    const minDisc = parseInt(filters.minDiscount);
    filtered = filtered.filter(deal => deal.discount >= minDisc);
  }

  // Filter by price range
  if (filters.minPrice) {
    const minP = parseFloat(filters.minPrice);
    filtered = filtered.filter(deal => deal.salePrice >= minP);
  }
  if (filters.maxPrice) {
    const maxP = parseFloat(filters.maxPrice);
    filtered = filtered.filter(deal => deal.salePrice <= maxP);
  }

  // Filter by brand
  if (filters.brand) {
    const brandLower = filters.brand.toLowerCase();
    filtered = filtered.filter(deal => deal.brand.toLowerCase().includes(brandLower));
  }

  // Smart filters (AI-powered)
  if (filters.bestValue === 'true') {
    filtered = filtered.filter(deal => deal.bestValue === true);
  }
  if (filters.topDeal === 'true') {
    filtered = filtered.filter(deal => deal.topDeal === true);
  }
  if (filters.priceDrop === 'true') {
    filtered = filtered.filter(deal => deal.priceDrop === true);
  }

  // Search by name
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(deal =>
      deal.name.toLowerCase().includes(searchLower) ||
      deal.brand.toLowerCase().includes(searchLower) ||
      (deal.retailer && deal.retailer.toLowerCase().includes(searchLower))
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
  } else if (sortBy === 'dealScore') {
    filtered.sort((a, b) => (b.dealScore || 0) - (a.dealScore || 0));
  } else if (sortBy === 'newest') {
    filtered.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
  }

  return filtered;
}

// Get retailer counts
function getRetailerCounts(deals) {
  const counts = {};
  deals.forEach(deal => {
    const retailer = deal.retailer || deal.merchantName || 'Unknown';
    counts[retailer] = (counts[retailer] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

// Get gender counts
function getGenderCounts(deals) {
  const counts = { men: 0, women: 0, kids: 0, unisex: 0 };
  deals.forEach(deal => {
    const gender = deal.gender || 'unisex';
    counts[gender] = (counts[gender] || 0) + 1;
  });
  return counts;
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
      minPrice: req.query.minPrice,
      maxPrice: req.query.maxPrice,
      brand: req.query.brand,
      search: req.query.search,
      sortBy: req.query.sortBy,
      // New AI-powered filters
      genders: req.query.genders,
      retailers: req.query.retailers,
      smartCategories: req.query.smartCategories,
      bestValue: req.query.bestValue,
      topDeal: req.query.topDeal,
      priceDrop: req.query.priceDrop
    };

    const filteredDeals = filterDeals(dealsCache.data, filters);

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedDeals = filteredDeals.slice(startIndex, endIndex);

    res.json({
      success: true,
      count: filteredDeals.length,
      page,
      limit,
      totalPages: Math.ceil(filteredDeals.length / limit),
      lastUpdated: dealsCache.lastUpdated,
      deals: paginatedDeals
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

// Get available retailers with counts
app.get('/api/retailers', (req, res) => {
  try {
    const retailers = getRetailerCounts(dealsCache.data);
    res.json({
      success: true,
      count: retailers.length,
      retailers
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get filter options (retailers, genders, categories)
app.get('/api/filters', (req, res) => {
  try {
    const retailers = getRetailerCounts(dealsCache.data);
    const genders = getGenderCounts(dealsCache.data);

    // Get smart category counts
    const smartCategories = {};
    dealsCache.data.forEach(deal => {
      if (deal.smartCategories) {
        deal.smartCategories.forEach(cat => {
          smartCategories[cat] = (smartCategories[cat] || 0) + 1;
        });
      }
    });

    // Get smart filter counts
    let bestValueCount = 0, topDealCount = 0, priceDropCount = 0;
    dealsCache.data.forEach(deal => {
      if (deal.bestValue) bestValueCount++;
      if (deal.topDeal) topDealCount++;
      if (deal.priceDrop) priceDropCount++;
    });

    res.json({
      success: true,
      retailers,
      genders,
      smartCategories: Object.entries(smartCategories)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      smartFilters: {
        bestValue: bestValueCount,
        topDeal: topDealCount,
        priceDrop: priceDropCount
      },
      priceRange: {
        min: Math.min(...dealsCache.data.map(d => d.salePrice)),
        max: Math.max(...dealsCache.data.map(d => d.salePrice))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reload products from file
app.get('/api/deals/refresh', async (req, res) => {
  try {
    console.log('🔄 Reload requested');
    reloadProducts();
    res.json({
      success: true,
      message: 'Products reloaded',
      count: dealsCache.data.length
    });
  } catch (error) {
    console.error('Error in /api/deals/refresh:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reload products',
      message: error.message
    });
  }
});

// Get statistics
app.get('/api/stats', (req, res) => {
  try {
    const stats = {
      totalProducts: dealsCache.data.length,
      lastUpdated: dealsCache.lastUpdated,
      byBrand: {},
      byCategory: {},
      avgDiscount: 0
    };

    // Calculate stats
    let totalDiscount = 0;
    dealsCache.data.forEach(deal => {
      // By brand/merchant
      const brand = deal.merchantName || deal.brand || 'Unknown';
      stats.byBrand[brand] = (stats.byBrand[brand] || 0) + 1;

      // By category
      stats.byCategory[deal.category] = (stats.byCategory[deal.category] || 0) + 1;

      // Total discount
      totalDiscount += deal.discount || 0;
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
  console.log('');

  // Load products on startup
  loadCache();

  if (dealsCache.data.length > 0) {
    console.log(`✅ Ready to serve ${dealsCache.data.length} products!`);
    console.log('');
  } else {
    console.log('⚠️  No products loaded - run the scrapers first');
    console.log('');
  }
});

module.exports = app;
