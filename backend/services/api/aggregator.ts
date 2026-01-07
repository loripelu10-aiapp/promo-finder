import RapidApiClient from './rapidapi';
import RainforestApiClient from './rainforest';
import { getCache } from './cache';
import { getRateLimiter } from './rate-limiter';
import {
  ApiProvider,
  ProductFromAPI,
  AggregatedResponse,
  BrandQuery,
  CategoryQuery,
  DealQuery,
  ApiLogEntry,
} from './types';
import { ProductCategory, ProductSource } from '@prisma/client';
import { prisma } from '../../db/client';
import { bulkInsertProducts } from '../../db/queries';

// ============================================
// API AGGREGATOR
// ============================================

export class ApiAggregator {
  private rapidApi: RapidApiClient;
  private rainforestApi: RainforestApiClient;
  private cache = getCache();
  private rateLimiter = getRateLimiter();

  constructor() {
    this.rapidApi = new RapidApiClient();
    this.rainforestApi = new RainforestApiClient();
  }

  // ============================================
  // SEARCH METHODS
  // ============================================

  /**
   * Search for products across all APIs
   */
  async searchProducts(
    query: string,
    options?: {
      providers?: ApiProvider[];
      maxPrice?: number;
      limit?: number;
      useCache?: boolean;
    }
  ): Promise<AggregatedResponse> {
    const providers = options?.providers || ['rapidapi', 'rainforest'];
    const useCache = options?.useCache !== false;

    // Check cache first
    if (useCache) {
      const cacheKey = this.cache.generateKey('aggregated', {
        query,
        providers,
        maxPrice: options?.maxPrice,
      });
      const cached = await this.cache.get<AggregatedResponse>(cacheKey);
      if (cached) {
        console.log('[Aggregator] Cache hit for search:', query);
        return cached;
      }
    }

    const results: AggregatedResponse = {
      products: [],
      totalResults: 0,
      sources: [],
      errors: [],
    };

    // Execute searches in parallel
    const promises = providers.map((provider) =>
      this.searchWithProvider(provider, query, options?.maxPrice, options?.limit)
    );

    const responses = await Promise.allSettled(promises);

    // Process responses
    responses.forEach((response, index) => {
      const provider = providers[index];

      if (response.status === 'fulfilled' && response.value.success) {
        const { data, responseTime, cached } = response.value;
        results.products.push(...(data || []));
        results.sources.push({
          provider,
          count: data?.length || 0,
          responseTime: responseTime || 0,
          cached: cached || false,
        });
      } else if (response.status === 'fulfilled' && !response.value.success) {
        results.errors?.push({
          provider,
          error: response.value.error || 'Unknown error',
        });
      } else if (response.status === 'rejected') {
        results.errors?.push({
          provider,
          error: response.reason?.message || 'Request failed',
        });
      }
    });

    // Deduplicate products
    results.products = this.deduplicateProducts(results.products);
    results.totalResults = results.products.length;

    // Cache the aggregated results
    if (useCache) {
      const cacheKey = this.cache.generateKey('aggregated', {
        query,
        providers,
        maxPrice: options?.maxPrice,
      });
      await this.cache.set(cacheKey, results);
    }

    return results;
  }

  /**
   * Search by brand across all APIs
   */
  async searchByBrand(query: BrandQuery): Promise<AggregatedResponse> {
    const { brand, categories, minDiscount, maxPrice, keywords } = query;

    // Build search query
    let searchQuery = brand;
    if (keywords && keywords.length > 0) {
      searchQuery += ' ' + keywords.join(' ');
    }

    // Search across providers
    const results = await this.searchProducts(searchQuery, {
      maxPrice,
      limit: 50,
    });

    // Filter by category and discount
    if (categories && categories.length > 0) {
      results.products = results.products.filter((p) =>
        categories.includes(p.category)
      );
    }

    if (minDiscount) {
      results.products = results.products.filter(
        (p) => p.discountPercentage >= minDiscount
      );
    }

    results.totalResults = results.products.length;

    return results;
  }

  /**
   * Search by category across all APIs
   */
  async searchByCategory(query: CategoryQuery): Promise<AggregatedResponse> {
    const { category, minDiscount, maxPrice, brands, sortBy } = query;

    // Build search query
    let searchQuery = this.getCategoryKeywords(category);

    if (brands && brands.length > 0) {
      searchQuery += ' ' + brands.join(' OR ');
    }

    // Search across providers
    const results = await this.searchProducts(searchQuery, {
      maxPrice,
      limit: 100,
    });

    // Filter by category and discount
    results.products = results.products.filter((p) => {
      if (p.category !== category) return false;
      if (minDiscount && p.discountPercentage < minDiscount) return false;
      return true;
    });

    // Sort results
    if (sortBy) {
      results.products = this.sortProducts(results.products, sortBy);
    }

    results.totalResults = results.products.length;

    return results;
  }

  /**
   * Search for deals across all APIs
   */
  async searchDeals(query: DealQuery): Promise<AggregatedResponse> {
    const { minDiscount, maxPrice, categories, brands } = query;

    // Build search query
    let searchQuery = 'sale discount clearance deal';

    if (brands && brands.length > 0) {
      searchQuery = brands.join(' OR ') + ' ' + searchQuery;
    }

    if (categories && categories.length > 0) {
      searchQuery += ' ' + categories.map((c) => this.getCategoryKeywords(c)).join(' OR ');
    }

    // Search across providers
    const results = await this.searchProducts(searchQuery, {
      maxPrice,
      limit: 200,
    });

    // Filter by minimum discount
    results.products = results.products.filter((p) => {
      if (p.discountPercentage < minDiscount) return false;
      if (categories && !categories.includes(p.category)) return false;
      return true;
    });

    // Sort by discount percentage
    results.products = this.sortProducts(results.products, 'discount');

    results.totalResults = results.products.length;

    return results;
  }

  // ============================================
  // BATCH OPERATIONS
  // ============================================

  /**
   * Fetch products from multiple brands
   */
  async fetchMultipleBrands(
    brands: string[],
    options?: {
      minDiscount?: number;
      maxPrice?: number;
      limit?: number;
    }
  ): Promise<AggregatedResponse> {
    const allResults: AggregatedResponse = {
      products: [],
      totalResults: 0,
      sources: [],
      errors: [],
    };

    // Fetch brands in parallel (with rate limiting)
    for (const brand of brands) {
      try {
        const result = await this.searchByBrand({
          brand,
          minDiscount: options?.minDiscount,
          maxPrice: options?.maxPrice,
        });

        allResults.products.push(...result.products);
        allResults.sources.push(...result.sources);
        if (result.errors) {
          allResults.errors?.push(...result.errors);
        }

        // Add small delay to respect rate limits
        await this.sleep(500);
      } catch (error: any) {
        console.error(`[Aggregator] Error fetching brand ${brand}:`, error);
        allResults.errors?.push({
          provider: 'rapidapi',
          error: `Failed to fetch ${brand}: ${error.message}`,
        });
      }
    }

    // Deduplicate and limit
    allResults.products = this.deduplicateProducts(allResults.products);
    if (options?.limit) {
      allResults.products = allResults.products.slice(0, options.limit);
    }

    allResults.totalResults = allResults.products.length;

    return allResults;
  }

  /**
   * Save products to database
   */
  async saveToDatabase(
    products: ProductFromAPI[]
  ): Promise<{ count: number; ids: string[] }> {
    // Map to database format
    const productInputs = products.map((p) => ({
      name: p.name,
      brand: p.brand,
      category: p.category,
      source: this.mapApiSourceToDbSource(p.source),
      originalPrice: p.originalPrice,
      salePrice: p.salePrice,
      discountPercentage: p.discountPercentage,
      productUrl: p.productUrl,
      imageUrl: p.imageUrl,
      description: p.description,
      attributes: p.attributes,
    }));

    // Bulk insert
    const result = await bulkInsertProducts(productInputs);

    console.log(`[Aggregator] Saved ${result.count} products to database`);

    return result;
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Search with a specific provider
   */
  private async searchWithProvider(
    provider: ApiProvider,
    query: string,
    maxPrice?: number,
    limit?: number
  ) {
    // Check cache first
    const cacheKey = this.cache.generateKey(provider, { query, maxPrice, limit });
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      console.log(`[Aggregator] Cache hit for ${provider}:`, query);
      return {
        success: true,
        data: cached,
        provider,
        cached: true,
        responseTime: 0,
      };
    }

    // Check rate limit
    try {
      await this.rateLimiter.checkLimit(provider);
    } catch (error: any) {
      console.warn(`[Aggregator] Rate limit exceeded for ${provider}`);
      return {
        success: false,
        error: `Rate limit exceeded: ${error.message}`,
        provider,
      };
    }

    // Make API call
    const startTime = Date.now();
    let result;

    try {
      if (provider === 'rapidapi') {
        result = await this.rapidApi.searchProducts({
          query,
          max_price: maxPrice,
          limit: limit || 20,
        });
      } else {
        result = await this.rainforestApi.searchProducts({
          query,
          max_price: maxPrice,
        });

        // Limit Rainforest results
        if (result.success && result.data && limit) {
          result.data = result.data.slice(0, limit);
        }
      }

      // Record request
      await this.rateLimiter.recordRequest(provider);

      // Log to database
      await this.logApiCall({
        provider,
        endpoint: 'search',
        requestParams: { query, maxPrice, limit },
        responseStatus: result.success ? 200 : 500,
        responseTime: Date.now() - startTime,
        creditsUsed: 1,
        success: result.success,
        errorMessage: result.error,
        timestamp: new Date(),
      });

      // Cache successful results
      if (result.success && result.data) {
        await this.cache.set(cacheKey, result.data);
      }

      return result;
    } catch (error: any) {
      console.error(`[Aggregator] Error with ${provider}:`, error);

      // Log error to database
      await this.logApiCall({
        provider,
        endpoint: 'search',
        requestParams: { query, maxPrice, limit },
        responseStatus: 500,
        responseTime: Date.now() - startTime,
        creditsUsed: 1,
        success: false,
        errorMessage: error.message,
        timestamp: new Date(),
      });

      return {
        success: false,
        error: error.message,
        provider,
      };
    }
  }

  /**
   * Deduplicate products based on URL
   */
  private deduplicateProducts(products: ProductFromAPI[]): ProductFromAPI[] {
    const seen = new Set<string>();
    const unique: ProductFromAPI[] = [];

    products.forEach((product) => {
      const key = product.productUrl.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(product);
      }
    });

    return unique;
  }

  /**
   * Sort products
   */
  private sortProducts(
    products: ProductFromAPI[],
    sortBy: 'price' | 'discount' | 'rating' | 'relevance'
  ): ProductFromAPI[] {
    const sorted = [...products];

    switch (sortBy) {
      case 'price':
        sorted.sort((a, b) => a.salePrice - b.salePrice);
        break;
      case 'discount':
        sorted.sort((a, b) => b.discountPercentage - a.discountPercentage);
        break;
      case 'rating':
        sorted.sort(
          (a, b) => (b.rating || 0) - (a.rating || 0)
        );
        break;
      case 'relevance':
        sorted.sort((a, b) => b.confidenceScore - a.confidenceScore);
        break;
    }

    return sorted;
  }

  /**
   * Get category keywords for search
   */
  private getCategoryKeywords(category: ProductCategory): string {
    const keywords: Record<ProductCategory, string> = {
      [ProductCategory.shoes]: 'shoes sneakers footwear',
      [ProductCategory.clothing]: 'clothing apparel fashion',
      [ProductCategory.accessories]: 'accessories',
      [ProductCategory.bags]: 'bags backpack purse',
      [ProductCategory.jewelry]: 'jewelry necklace ring',
      [ProductCategory.watches]: 'watches timepiece',
      [ProductCategory.sunglasses]: 'sunglasses eyewear',
      [ProductCategory.other]: 'fashion',
    };

    return keywords[category] || 'fashion';
  }

  /**
   * Map API source to database source
   */
  private mapApiSourceToDbSource(apiSource: ApiProvider): ProductSource {
    // Map API sources to database sources
    // For now, we'll use 'amazon' for both since they pull from multiple sources
    return ProductSource.amazon;
  }

  /**
   * Log API call to database
   */
  private async logApiCall(log: ApiLogEntry): Promise<void> {
    try {
      await prisma.apiLog.create({
        data: {
          provider: log.provider,
          endpoint: log.endpoint,
          requestParams: log.requestParams,
          responseStatus: log.responseStatus,
          responseTime: log.responseTime,
          creditsUsed: log.creditsUsed,
          estimatedCost: log.estimatedCost || log.creditsUsed * 0.01,
          success: log.success,
          errorMessage: log.errorMessage,
        },
      });
    } catch (error) {
      console.error('[Aggregator] Error logging to database:', error);
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================
  // STATISTICS
  // ============================================

  /**
   * Get usage statistics
   */
  async getUsageStats(): Promise<{
    providers: Array<{
      provider: ApiProvider;
      requestsToday: number;
      requestsRemaining: number;
      dailyLimit: number;
    }>;
    cache: {
      hitRate: number;
      totalKeys: number;
    };
    database: {
      totalProducts: number;
      productsBySource: Array<{ source: string; count: number }>;
    };
  }> {
    // Get rate limit info
    const rateLimitInfo = await this.rateLimiter.getAllRateLimitInfo();

    // Get cache stats
    const cacheStats = await this.cache.getStats();

    // Get database stats
    const totalProducts = await prisma.product.count({ where: { isActive: true } });

    const productsBySource = await prisma.product.groupBy({
      by: ['source'],
      _count: { id: true },
      where: { isActive: true },
    });

    return {
      providers: rateLimitInfo.map((info) => ({
        provider: info.provider,
        requestsToday: info.requestsToday,
        requestsRemaining: info.requestsRemaining,
        dailyLimit: info.dailyLimit,
      })),
      cache: {
        hitRate: cacheStats.hitRate,
        totalKeys: cacheStats.keys,
      },
      database: {
        totalProducts,
        productsBySource: productsBySource.map((p) => ({
          source: p.source,
          count: p._count.id,
        })),
      },
    };
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let aggregatorInstance: ApiAggregator | null = null;

/**
 * Get singleton aggregator instance
 */
export function getAggregator(): ApiAggregator {
  if (!aggregatorInstance) {
    aggregatorInstance = new ApiAggregator();
  }
  return aggregatorInstance;
}

// ============================================
// EXPORTS
// ============================================

export default ApiAggregator;
