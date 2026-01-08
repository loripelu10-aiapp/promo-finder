/**
 * Region-Aware Deals API Routes
 *
 * Provides endpoints for fetching products filtered by region
 */

const express = require('express');
const router = express.Router();
const ProductStorageService = require('../services/product-storage');

const storageService = new ProductStorageService();

/**
 * GET /api/deals
 *
 * Fetch deals filtered by region
 *
 * Query Parameters:
 * - region: (optional) EU, UK, US, IT, FR, DE, ES, GLOBAL
 * - category: (optional) Filter by product category
 * - minDiscount: (optional) Minimum discount percentage
 * - source: (optional) Filter by source (nike, adidas, manual, etc.)
 * - limit: (optional) Number of products to return (default: 100)
 *
 * Example: /api/deals?region=EU&minDiscount=20&limit=50
 */
router.get('/', async (req, res) => {
  try {
    const {
      region,
      category,
      minDiscount,
      source,
      limit = 100
    } = req.query;

    let products;

    // If region specified, filter by region
    if (region) {
      // Support multiple regions (e.g., EU + GLOBAL for EU users)
      const regions = region.includes(',')
        ? region.split(',').map(r => r.trim())
        : [region, 'GLOBAL']; // Always include GLOBAL products

      products = await storageService.getProductsByRegions(regions);
    } else {
      // No region specified - return all products
      products = await storageService.getAllProducts();
    }

    // Apply additional filters
    if (category) {
      products = products.filter(p => p.category === category);
    }

    if (minDiscount) {
      const minDiscountNum = parseInt(minDiscount, 10);
      products = products.filter(p => p.discountPercentage >= minDiscountNum);
    }

    if (source) {
      products = products.filter(p => p.source === source);
    }

    // Apply limit
    const limitNum = parseInt(limit, 10);
    products = products.slice(0, limitNum);

    // Transform to API response format
    const deals = products.map(p => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      originalPrice: p.originalPrice,
      salePrice: p.salePrice,
      discount: p.discountPercentage,
      currency: p.currency,
      regions: p.availableRegions,
      image: p.imageUrl,
      url: p.productUrl,
      source: p.source,
      confidenceScore: p.confidenceScore,
      isNew: p.isNew,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    }));

    res.json({
      success: true,
      count: deals.length,
      filters: {
        region: region || 'all',
        category: category || 'all',
        minDiscount: minDiscount || 0,
        source: source || 'all'
      },
      deals
    });

  } catch (error) {
    console.error('❌ Error fetching deals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deals',
      message: error.message
    });
  }
});

/**
 * GET /api/deals/stats
 *
 * Get statistics about available deals
 *
 * Query Parameters:
 * - region: (optional) Filter stats by region
 */
router.get('/stats', async (req, res) => {
  try {
    const { region } = req.query;

    let products;

    if (region) {
      const regions = region.includes(',')
        ? region.split(',').map(r => r.trim())
        : [region, 'GLOBAL'];
      products = await storageService.getProductsByRegions(regions);
    } else {
      products = await storageService.getAllProducts();
    }

    // Calculate statistics
    const stats = {
      totalDeals: products.length,
      region: region || 'all',
      bySource: {},
      byCategory: {},
      byCurrency: {},
      byRegion: {},
      avgDiscount: 0,
      highestDiscount: 0,
      lowestPrice: null,
      highestPrice: null
    };

    let totalDiscount = 0;
    let prices = [];

    products.forEach(p => {
      // Source breakdown
      stats.bySource[p.source] = (stats.bySource[p.source] || 0) + 1;

      // Category breakdown
      stats.byCategory[p.category] = (stats.byCategory[p.category] || 0) + 1;

      // Currency breakdown
      stats.byCurrency[p.currency] = (stats.byCurrency[p.currency] || 0) + 1;

      // Region breakdown (products can be in multiple regions)
      p.availableRegions.forEach(r => {
        stats.byRegion[r] = (stats.byRegion[r] || 0) + 1;
      });

      // Discount calculations
      totalDiscount += p.discountPercentage;
      if (p.discountPercentage > stats.highestDiscount) {
        stats.highestDiscount = p.discountPercentage;
      }

      // Price tracking
      prices.push(p.salePrice);
    });

    stats.avgDiscount = products.length > 0
      ? Math.round(totalDiscount / products.length)
      : 0;

    if (prices.length > 0) {
      stats.lowestPrice = Math.min(...prices);
      stats.highestPrice = Math.max(...prices);
    }

    res.json(stats);

  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
      message: error.message
    });
  }
});

/**
 * GET /api/deals/regions
 *
 * Get list of available regions with product counts
 */
router.get('/regions', async (req, res) => {
  try {
    const allProducts = await storageService.getAllProducts();

    const regionCounts = {};

    // Count products in each region
    allProducts.forEach(p => {
      p.availableRegions.forEach(region => {
        regionCounts[region] = (regionCounts[region] || 0) + 1;
      });
    });

    const regions = Object.entries(regionCounts).map(([code, count]) => ({
      code,
      name: getRegionName(code),
      productCount: count
    }));

    res.json({
      success: true,
      regions
    });

  } catch (error) {
    console.error('❌ Error fetching regions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch regions',
      message: error.message
    });
  }
});

/**
 * Helper: Get human-readable region name
 */
function getRegionName(code) {
  const names = {
    'US': 'United States',
    'EU': 'European Union',
    'UK': 'United Kingdom',
    'IT': 'Italy',
    'FR': 'France',
    'DE': 'Germany',
    'ES': 'Spain',
    'GLOBAL': 'Global (Worldwide)'
  };
  return names[code] || code;
}

module.exports = router;
