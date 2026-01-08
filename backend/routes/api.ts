import express, { Request, Response } from 'express';
import { getAggregator } from '../services/api/aggregator';
import { getRateLimiter } from '../services/api/rate-limiter';
import { getCache } from '../services/api/cache';
import { ProductCategory } from '@prisma/client';
import {
  getAllBrandQueries,
  getBrandQuery,
  isTopBrand,
  normalizeBrandName,
} from '../services/api/queries/fashion-brands';
import {
  getCategoryQuery,
  getAllCategoryQueries,
} from '../services/api/queries/categories';
import {
  getDealQuery,
  getAllDealQueries,
  getBestCurrentDeals,
  DealType,
} from '../services/api/queries/deals';

const router = express.Router();
const aggregator = getAggregator();
const rateLimiter = getRateLimiter();
const cache = getCache();

// ============================================
// PRODUCT FETCHING ROUTES
// ============================================

/**
 * POST /api/products/fetch
 * Trigger product fetch from APIs
 */
router.post('/products/fetch', async (req: Request, res: Response) => {
  try {
    const { brand, category, minDiscount, maxPrice, limit } = req.body;

    let result;

    if (brand) {
      // Fetch by brand
      const normalizedBrand = normalizeBrandName(brand);
      if (!normalizedBrand) {
        return res.status(400).json({
          success: false,
          error: `Unknown brand: ${brand}`,
        });
      }

      const brandQuery = getBrandQuery(normalizedBrand);
      result = await aggregator.searchByBrand({
        ...brandQuery,
        minDiscount: minDiscount || brandQuery.minDiscount,
        maxPrice: maxPrice || brandQuery.maxPrice,
      });
    } else if (category) {
      // Fetch by category
      if (!Object.values(ProductCategory).includes(category)) {
        return res.status(400).json({
          success: false,
          error: `Invalid category: ${category}`,
        });
      }

      const categoryQuery = getCategoryQuery(category);
      result = await aggregator.searchByCategory({
        ...categoryQuery,
        minDiscount: minDiscount || categoryQuery.minDiscount,
        maxPrice: maxPrice || categoryQuery.maxPrice,
      });
    } else {
      // Fetch deals
      result = await aggregator.searchDeals({
        minDiscount: minDiscount || 30,
        maxPrice: maxPrice || 200,
      });
    }

    // Limit results if requested
    if (limit && result.products.length > limit) {
      result.products = result.products.slice(0, limit);
      result.totalResults = result.products.length;
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[API Routes] Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch products',
    });
  }
});

/**
 * GET /api/products/fetch
 * Trigger product fetch from APIs (query params)
 */
router.get('/products/fetch', async (req: Request, res: Response) => {
  try {
    const {
      brand,
      category,
      minDiscount,
      maxPrice,
      limit,
      dealType,
    } = req.query;

    let result;

    if (brand) {
      const normalizedBrand = normalizeBrandName(brand as string);
      if (!normalizedBrand) {
        return res.status(400).json({
          success: false,
          error: `Unknown brand: ${brand}`,
        });
      }

      const brandQuery = getBrandQuery(normalizedBrand);
      result = await aggregator.searchByBrand({
        ...brandQuery,
        minDiscount: minDiscount ? parseInt(minDiscount as string) : brandQuery.minDiscount,
        maxPrice: maxPrice ? parseInt(maxPrice as string) : brandQuery.maxPrice,
      });
    } else if (category) {
      if (!Object.values(ProductCategory).includes(category as ProductCategory)) {
        return res.status(400).json({
          success: false,
          error: `Invalid category: ${category}`,
        });
      }

      const categoryQuery = getCategoryQuery(category as ProductCategory);
      result = await aggregator.searchByCategory({
        ...categoryQuery,
        minDiscount: minDiscount ? parseInt(minDiscount as string) : categoryQuery.minDiscount,
        maxPrice: maxPrice ? parseInt(maxPrice as string) : categoryQuery.maxPrice,
      });
    } else if (dealType && Object.values(DealType).includes(dealType as DealType)) {
      const dealQuery = getDealQuery(dealType as DealType);
      result = await aggregator.searchDeals(dealQuery);
    } else {
      result = await aggregator.searchDeals({
        minDiscount: minDiscount ? parseInt(minDiscount as string) : 30,
        maxPrice: maxPrice ? parseInt(maxPrice as string) : 200,
      });
    }

    // Limit results if requested
    if (limit) {
      const limitNum = parseInt(limit as string);
      if (result.products.length > limitNum) {
        result.products = result.products.slice(0, limitNum);
        result.totalResults = result.products.length;
      }
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[API Routes] Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch products',
    });
  }
});

/**
 * POST /api/products/save
 * Save fetched products to database
 */
router.post('/products/save', async (req: Request, res: Response) => {
  try {
    const { products } = req.body;

    if (!products || !Array.isArray(products)) {
      return res.status(400).json({
        success: false,
        error: 'Products array is required',
      });
    }

    const result = await aggregator.saveToDatabase(products);

    res.json({
      success: true,
      data: result,
      message: `Saved ${result.count} products to database`,
    });
  } catch (error: any) {
    console.error('[API Routes] Error saving products:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save products',
    });
  }
});

/**
 * POST /api/products/fetch-and-save
 * Fetch and save products in one request
 */
router.post('/products/fetch-and-save', async (req: Request, res: Response) => {
  try {
    const { brands, categories, minDiscount, maxPrice } = req.body;

    let allProducts: any[] = [];

    // Fetch by brands
    if (brands && Array.isArray(brands)) {
      const result = await aggregator.fetchMultipleBrands(brands, {
        minDiscount,
        maxPrice,
      });
      allProducts.push(...result.products);
    }

    // Fetch by categories
    if (categories && Array.isArray(categories)) {
      for (const category of categories) {
        if (Object.values(ProductCategory).includes(category)) {
          const categoryQuery = getCategoryQuery(category);
          const result = await aggregator.searchByCategory({
            ...categoryQuery,
            minDiscount: minDiscount || categoryQuery.minDiscount,
            maxPrice: maxPrice || categoryQuery.maxPrice,
          });
          allProducts.push(...result.products);
        }
      }
    }

    // Deduplicate
    const uniqueProducts = Array.from(
      new Map(allProducts.map((p) => [p.productUrl, p])).values()
    );

    // Save to database
    const saveResult = await aggregator.saveToDatabase(uniqueProducts);

    res.json({
      success: true,
      data: {
        fetched: uniqueProducts.length,
        saved: saveResult.count,
        productIds: saveResult.ids,
      },
      message: `Fetched ${uniqueProducts.length} products, saved ${saveResult.count} to database`,
    });
  } catch (error: any) {
    console.error('[API Routes] Error in fetch-and-save:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch and save products',
    });
  }
});

// ============================================
// SOURCES & CONFIGURATION ROUTES
// ============================================

/**
 * GET /api/products/sources
 * List available API sources and their status
 */
router.get('/products/sources', async (req: Request, res: Response) => {
  try {
    const rateLimitInfo = await rateLimiter.getAllRateLimitInfo();

    const sources = rateLimitInfo.map((info) => ({
      provider: info.provider,
      enabled: true,
      requestsToday: info.requestsToday,
      requestsRemaining: info.requestsRemaining,
      dailyLimit: info.dailyLimit,
      isLimited: info.isLimited,
      resetsAt: info.resetsAt,
    }));

    res.json({
      success: true,
      data: sources,
    });
  } catch (error: any) {
    console.error('[API Routes] Error getting sources:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get sources',
    });
  }
});

/**
 * GET /api/products/brands
 * List available brands for fetching
 */
router.get('/products/brands', (req: Request, res: Response) => {
  try {
    const brandQueries = getAllBrandQueries();

    const brands = brandQueries.map((query) => ({
      brand: query.brand,
      categories: query.categories,
      minDiscount: query.minDiscount,
      maxPrice: query.maxPrice,
      keywords: query.keywords,
    }));

    res.json({
      success: true,
      data: brands,
    });
  } catch (error: any) {
    console.error('[API Routes] Error getting brands:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get brands',
    });
  }
});

/**
 * GET /api/products/categories
 * List available categories
 */
router.get('/products/categories', (req: Request, res: Response) => {
  try {
    const categoryQueries = getAllCategoryQueries();

    const categories = categoryQueries.map((query) => ({
      category: query.category,
      minDiscount: query.minDiscount,
      maxPrice: query.maxPrice,
      brands: query.brands,
    }));

    res.json({
      success: true,
      data: categories,
    });
  } catch (error: any) {
    console.error('[API Routes] Error getting categories:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get categories',
    });
  }
});

/**
 * GET /api/products/deals
 * List available deal types
 */
router.get('/products/deals', (req: Request, res: Response) => {
  try {
    const dealQueries = getAllDealQueries();
    const bestDeals = getBestCurrentDeals();

    res.json({
      success: true,
      data: {
        allDeals: Object.keys(DealType),
        bestCurrentDeals: bestDeals,
      },
    });
  } catch (error: any) {
    console.error('[API Routes] Error getting deals:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get deals',
    });
  }
});

// ============================================
// USAGE & STATISTICS ROUTES
// ============================================

/**
 * GET /api/products/usage
 * Get API usage statistics
 */
router.get('/products/usage', async (req: Request, res: Response) => {
  try {
    const stats = await aggregator.getUsageStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('[API Routes] Error getting usage:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get usage statistics',
    });
  }
});

/**
 * GET /api/products/cache-stats
 * Get cache statistics
 */
router.get('/products/cache-stats', async (req: Request, res: Response) => {
  try {
    const stats = await cache.getStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('[API Routes] Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get cache statistics',
    });
  }
});

/**
 * DELETE /api/products/cache
 * Clear API cache
 */
router.delete('/products/cache', async (req: Request, res: Response) => {
  try {
    const { provider } = req.query;

    if (provider) {
      await cache.clearProvider(provider as any);
      res.json({
        success: true,
        message: `Cache cleared for provider: ${provider}`,
      });
    } else {
      await cache.clearAll();
      res.json({
        success: true,
        message: 'All cache cleared',
      });
    }
  } catch (error: any) {
    console.error('[API Routes] Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to clear cache',
    });
  }
});

// ============================================
// HEALTH CHECK
// ============================================

/**
 * GET /api/products/health
 * Check API integration health
 */
router.get('/products/health', async (req: Request, res: Response) => {
  try {
    const rateLimitInfo = await rateLimiter.getAllRateLimitInfo();
    const cacheStats = await cache.getStats();
    const cacheConnected = cache.isConnected();

    const health = {
      status: 'healthy',
      cache: {
        connected: cacheConnected,
        hitRate: cacheStats.hitRate,
      },
      providers: rateLimitInfo.map((info) => ({
        provider: info.provider,
        available: !info.isLimited,
        requestsRemaining: info.requestsRemaining,
      })),
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: health,
    });
  } catch (error: any) {
    console.error('[API Routes] Error checking health:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Health check failed',
    });
  }
});

export default router;
