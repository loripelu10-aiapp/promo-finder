/**
 * PromoFinder - Backend API Server
 * Fashion deals aggregator with affiliate monetization
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

const feedImporter = require('./services/feedImporter');

const app = express();
const PORT = process.env.PORT || 3001;

// Data files
const PRODUCTS_FILE = path.join(__dirname, 'data/products.json');
const CLICKS_FILE = path.join(__dirname, 'data/clicks.json');
const MERCHANTS_CONFIG = require('./config/merchants.json');

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Legge i prodotti dal file JSON
 */
function getProducts() {
  try {
    if (fs.existsSync(PRODUCTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
      return data.products || [];
    }
  } catch (error) {
    console.error('Error reading products:', error);
  }
  return [];
}

/**
 * Logga un click per analytics
 */
function logClick(productId, merchant, subId = 'direct') {
  try {
    let clicks = [];
    if (fs.existsSync(CLICKS_FILE)) {
      clicks = JSON.parse(fs.readFileSync(CLICKS_FILE, 'utf8'));
    }
    
    clicks.push({
      timestamp: new Date().toISOString(),
      productId,
      merchant,
      subId
    });
    
    // Mantieni solo ultimi 10000 click
    if (clicks.length > 10000) {
      clicks = clicks.slice(-10000);
    }
    
    fs.writeFileSync(CLICKS_FILE, JSON.stringify(clicks, null, 2));
  } catch (error) {
    console.error('Error logging click:', error);
  }
}

/**
 * Filtra e ordina prodotti
 */
function filterProducts(products, filters) {
  let filtered = [...products];
  
  // Categoria
  if (filters.category && filters.category !== 'all') {
    filtered = filtered.filter(p => p.category === filters.category);
  }
  
  // Merchant
  if (filters.merchant) {
    filtered = filtered.filter(p => p.merchant === filters.merchant);
  }
  
  // Brand
  if (filters.brand) {
    filtered = filtered.filter(p => 
      p.brand.toLowerCase().includes(filters.brand.toLowerCase())
    );
  }
  
  // Sconto minimo
  if (filters.minDiscount) {
    filtered = filtered.filter(p => p.discount >= parseInt(filters.minDiscount));
  }
  
  // Prezzo massimo
  if (filters.maxPrice) {
    filtered = filtered.filter(p => p.salePrice <= parseFloat(filters.maxPrice));
  }
  
  // Prezzo minimo
  if (filters.minPrice) {
    filtered = filtered.filter(p => p.salePrice >= parseFloat(filters.minPrice));
  }
  
  // Ricerca testuale
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(searchLower) ||
      p.brand.toLowerCase().includes(searchLower) ||
      p.merchantName.toLowerCase().includes(searchLower)
    );
  }
  
  // Ordinamento
  const sortBy = filters.sortBy || 'discount';
  const sortOrder = filters.sortOrder || 'desc';
  
  filtered.sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'price':
        comparison = a.salePrice - b.salePrice;
        break;
      case 'discount':
        comparison = a.discount - b.discount;
        break;
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'newest':
        comparison = new Date(a.lastUpdated) - new Date(b.lastUpdated);
        break;
      default:
        comparison = a.discount - b.discount;
    }
    
    return sortOrder === 'desc' ? -comparison : comparison;
  });
  
  return filtered;
}

// ============================================
// API ROUTES
// ============================================

/**
 * GET /api/products
 * Lista prodotti con filtri e paginazione
 */
app.get('/api/products', (req, res) => {
  try {
    const products = getProducts();
    
    const filters = {
      category: req.query.category,
      merchant: req.query.merchant,
      brand: req.query.brand,
      minDiscount: req.query.minDiscount,
      maxPrice: req.query.maxPrice,
      minPrice: req.query.minPrice,
      search: req.query.search,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder
    };
    
    const filtered = filterProducts(products, filters);
    
    // Paginazione
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    const paginatedProducts = filtered.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: {
        products: paginatedProducts,
        pagination: {
          total: filtered.length,
          page,
          limit,
          pages: Math.ceil(filtered.length / limit)
        },
        filters: filters
      }
    });
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/products/:id
 * Singolo prodotto
 */
app.get('/api/products/:id', (req, res) => {
  try {
    const products = getProducts();
    const product = products.find(p => p.id === req.params.id);
    
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/products/:id/redirect
 * Redirect tracciato al sito del merchant
 */
app.get('/api/products/:id/redirect', (req, res) => {
  try {
    const products = getProducts();
    const product = products.find(p => p.id === req.params.id);
    
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    // Log click
    const subId = req.query.subId || 'direct';
    logClick(product.id, product.merchant, subId);
    
    // Redirect al link affiliato
    const redirectUrl = product.affiliateUrl || product.originalUrl;
    res.redirect(302, redirectUrl);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/merchants
 * Lista merchant attivi
 */
app.get('/api/merchants', (req, res) => {
  try {
    const merchants = MERCHANTS_CONFIG.merchants
      .filter(m => m.active)
      .map(m => ({
        id: m.id,
        name: m.name,
        logo: m.logo,
        color: m.color,
        commission: m.commission,
        categories: m.categories
      }));
    
    res.json({ success: true, data: merchants });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/categories
 * Lista categorie
 */
app.get('/api/categories', (req, res) => {
  try {
    const categories = Object.entries(MERCHANTS_CONFIG.categories).map(([id, config]) => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      icon: config.icon
    }));
    
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/stats
 * Statistiche (per admin)
 */
app.get('/api/stats', (req, res) => {
  try {
    const products = getProducts();
    let clicks = [];
    
    if (fs.existsSync(CLICKS_FILE)) {
      clicks = JSON.parse(fs.readFileSync(CLICKS_FILE, 'utf8'));
    }
    
    // Statistiche ultimi 7 giorni
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentClicks = clicks.filter(c => new Date(c.timestamp) > sevenDaysAgo);
    
    // Click per merchant
    const clicksByMerchant = {};
    recentClicks.forEach(c => {
      clicksByMerchant[c.merchant] = (clicksByMerchant[c.merchant] || 0) + 1;
    });
    
    res.json({
      success: true,
      data: {
        totalProducts: products.length,
        totalClicks: clicks.length,
        clicksLast7Days: recentClicks.length,
        clicksByMerchant,
        productsByCategory: {
          clothing: products.filter(p => p.category === 'clothing').length,
          shoes: products.filter(p => p.category === 'shoes').length,
          accessories: products.filter(p => p.category === 'accessories').length
        },
        averageDiscount: Math.round(
          products.reduce((sum, p) => sum + p.discount, 0) / products.length
        )
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/featured
 * Prodotti in evidenza (top sconti)
 */
app.get('/api/featured', (req, res) => {
  try {
    const products = getProducts();
    
    // Top 10 sconti
    const featured = products
      .filter(p => p.discount >= 40)
      .sort((a, b) => b.discount - a.discount)
      .slice(0, 10);
    
    res.json({ success: true, data: featured });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============================================
// ADMIN ROUTES (protetti)
// ============================================

const adminAuth = (req, res, next) => {
  const password = req.headers['x-admin-password'] || req.query.password;
  if (password !== process.env.ADMIN_PASSWORD && password !== 'promofinder2025') {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
};

/**
 * POST /api/admin/products
 * Aggiungi prodotto manualmente
 */
app.post('/api/admin/products', adminAuth, (req, res) => {
  try {
    const productData = req.body;
    
    // Validazione base
    if (!productData.name || !productData.salePrice || !productData.merchant) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: name, salePrice, merchant' 
      });
    }
    
    const newProduct = feedImporter.addManualProduct(productData);
    
    res.json({ success: true, data: newProduct });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/import-feed
 * Forza import dei feed
 */
app.post('/api/admin/import-feed', adminAuth, async (req, res) => {
  try {
    const result = await feedImporter.importAllFeeds();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/generate-affiliate-link
 * Genera link affiliato da URL originale
 */
app.post('/api/admin/generate-affiliate-link', adminAuth, (req, res) => {
  try {
    const { originalUrl, merchantId, affiliateId } = req.body;
    
    if (!originalUrl || !merchantId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: originalUrl, merchantId' 
      });
    }
    
    const affId = affiliateId || process.env.AWIN_PUBLISHER_ID || 'YOUR_ID';
    const affiliateUrl = feedImporter.generateAffiliateLink(originalUrl, merchantId, affId);
    
    res.json({ success: true, data: { affiliateUrl } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ============================================
// SERVE FRONTEND
// ============================================

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// CRON JOBS
// ============================================

// Aggiorna feed ogni 6 ore
cron.schedule('0 */6 * * *', async () => {
  console.log('⏰ Running scheduled feed import...');
  try {
    await feedImporter.importAllFeeds();
    console.log('✅ Scheduled import completed');
  } catch (error) {
    console.error('❌ Scheduled import failed:', error);
  }
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🛍️  PROMOFINDER API SERVER                              ║
║                                                           ║
║   Running on: http://localhost:${PORT}                     ║
║                                                           ║
║   Endpoints:                                              ║
║   • GET  /api/products         - List products            ║
║   • GET  /api/products/:id     - Single product           ║
║   • GET  /api/products/:id/redirect - Tracked redirect    ║
║   • GET  /api/merchants        - List merchants           ║
║   • GET  /api/categories       - List categories          ║
║   • GET  /api/featured         - Featured deals           ║
║   • GET  /api/stats            - Analytics                ║
║   • POST /api/admin/products   - Add product (admin)      ║
║   • POST /api/admin/import-feed - Import feeds (admin)    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
