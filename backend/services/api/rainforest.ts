import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  ApiProvider,
  ApiResponse,
  RainforestSearchParams,
  RainforestSearchResult,
  RainforestProduct,
  ProductFromAPI,
  ApiError,
  RetryConfig,
  ValidationResult,
} from './types';
import { ProductCategory } from '@prisma/client';

// ============================================
// RAINFOREST API CLIENT
// ============================================

export class RainforestApiClient {
  private client: AxiosInstance;
  private readonly provider: ApiProvider = 'rainforest';
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;
  private readonly retryConfig: RetryConfig;

  constructor(config?: {
    apiKey?: string;
    timeout?: number;
    retryConfig?: Partial<RetryConfig>;
  }) {
    this.apiKey = config?.apiKey || process.env.RAINFOREST_API_KEY || '';
    this.baseUrl = 'https://api.rainforestapi.com';
    this.timeout = config?.timeout || parseInt(process.env.API_TIMEOUT || '5000');

    this.retryConfig = {
      maxAttempts: config?.retryConfig?.maxAttempts || 3,
      initialDelayMs: config?.retryConfig?.initialDelayMs || 1000,
      maxDelayMs: config?.retryConfig?.maxDelayMs || 10000,
      strategy: config?.retryConfig?.strategy || 'exponential',
      retryableErrors: [408, 429, 500, 502, 503, 504],
    };

    if (!this.apiKey) {
      throw new Error('RAINFOREST_API_KEY is not set in environment variables');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // ============================================
  // PUBLIC METHODS
  // ============================================

  /**
   * Search for products on Amazon via Rainforest API
   */
  async searchProducts(
    params: RainforestSearchParams
  ): Promise<ApiResponse<ProductFromAPI[]>> {
    const startTime = Date.now();

    try {
      const response = await this.executeWithRetry<RainforestSearchResult>(
        async () => {
          return await this.client.get('/request', {
            params: {
              api_key: this.apiKey,
              type: params.type || 'search',
              amazon_domain: params.amazon_domain || 'amazon.com',
              search_term: params.query,
              page: params.page || 1,
              output: 'json',
              ...(params.sort_by && { sort_by: params.sort_by }),
              ...(params.min_price && { min_price: params.min_price }),
              ...(params.max_price && { max_price: params.max_price }),
            },
          });
        }
      );

      const products = this.mapToProducts(response.data);
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        data: products,
        provider: this.provider,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = this.extractErrorMessage(error);

      return {
        success: false,
        error: errorMessage,
        provider: this.provider,
        responseTime,
      };
    }
  }

  /**
   * Get product details by ASIN
   */
  async getProduct(asin: string): Promise<ApiResponse<ProductFromAPI | null>> {
    const startTime = Date.now();

    try {
      const response = await this.executeWithRetry<RainforestSearchResult>(
        async () => {
          return await this.client.get('/request', {
            params: {
              api_key: this.apiKey,
              type: 'product',
              amazon_domain: 'amazon.com',
              asin: asin,
              output: 'json',
            },
          });
        }
      );

      const product = response.data.product
        ? this.mapSingleProduct(response.data.product)
        : null;
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        data: product,
        provider: this.provider,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = this.extractErrorMessage(error);

      return {
        success: false,
        error: errorMessage,
        provider: this.provider,
        responseTime,
      };
    }
  }

  /**
   * Search for products by brand
   */
  async searchByBrand(
    brand: string,
    options?: {
      category?: string;
      minDiscount?: number;
      maxPrice?: number;
      limit?: number;
    }
  ): Promise<ApiResponse<ProductFromAPI[]>> {
    const query = this.buildBrandQuery(brand, options?.category);

    const result = await this.searchProducts({
      query,
      max_price: options?.maxPrice,
      sort_by: 'price-asc-rank',
    });

    // Filter by minimum discount if specified
    if (result.success && result.data && options?.minDiscount) {
      result.data = result.data.filter(
        (p) => p.discountPercentage >= options.minDiscount!
      );
    }

    // Limit results
    if (result.success && result.data && options?.limit) {
      result.data = result.data.slice(0, options.limit);
    }

    return result;
  }

  /**
   * Search for deals (products with discounts)
   */
  async searchDeals(
    category?: string,
    options?: {
      minDiscount?: number;
      maxPrice?: number;
      brands?: string[];
      limit?: number;
    }
  ): Promise<ApiResponse<ProductFromAPI[]>> {
    const query = this.buildDealQuery(category, options?.brands);

    const result = await this.searchProducts({
      query,
      max_price: options?.maxPrice,
      sort_by: 'price-asc-rank',
    });

    // Filter by minimum discount
    if (result.success && result.data) {
      result.data = result.data.filter(
        (p) => p.discountPercentage >= (options?.minDiscount || 30)
      );

      // Limit results
      if (options?.limit) {
        result.data = result.data.slice(0, options.limit);
      }
    }

    return result;
  }

  /**
   * Get bestsellers for a category
   */
  async getBestsellers(
    category: string,
    limit: number = 20
  ): Promise<ApiResponse<ProductFromAPI[]>> {
    const startTime = Date.now();

    try {
      const response = await this.executeWithRetry<RainforestSearchResult>(
        async () => {
          return await this.client.get('/request', {
            params: {
              api_key: this.apiKey,
              type: 'bestsellers',
              amazon_domain: 'amazon.com',
              url: `https://www.amazon.com/Best-Sellers-${category}/zgbs`,
              output: 'json',
            },
          });
        }
      );

      let products = response.data.bestsellers
        ? response.data.bestsellers
            .map((p) => this.mapSingleProduct(p))
            .filter((p): p is ProductFromAPI => p !== null)
        : [];

      // Limit results
      products = products.slice(0, limit);

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        data: products,
        provider: this.provider,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = this.extractErrorMessage(error);

      return {
        success: false,
        error: errorMessage,
        provider: this.provider,
        responseTime,
      };
    }
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Execute API call with retry logic
   */
  private async executeWithRetry<T>(
    apiCall: () => Promise<any>,
    attempt: number = 1
  ): Promise<any> {
    try {
      const response = await apiCall();
      return response;
    } catch (error) {
      const axiosError = error as AxiosError;
      const statusCode = axiosError.response?.status;

      // Check if we should retry
      const shouldRetry =
        attempt < this.retryConfig.maxAttempts &&
        statusCode !== undefined &&
        this.retryConfig.retryableErrors?.includes(statusCode);

      if (!shouldRetry) {
        throw error;
      }

      // Calculate delay based on strategy
      const delay = this.calculateRetryDelay(attempt);

      console.log(
        `[Rainforest] Retry attempt ${attempt}/${this.retryConfig.maxAttempts} after ${delay}ms`
      );

      await this.sleep(delay);
      return this.executeWithRetry(apiCall, attempt + 1);
    }
  }

  /**
   * Calculate retry delay based on strategy
   */
  private calculateRetryDelay(attempt: number): number {
    const { initialDelayMs, maxDelayMs, strategy } = this.retryConfig;

    let delay: number;

    switch (strategy) {
      case 'exponential':
        delay = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
        break;
      case 'linear':
        delay = Math.min(initialDelayMs * attempt, maxDelayMs);
        break;
      case 'constant':
      default:
        delay = initialDelayMs;
        break;
    }

    return delay;
  }

  /**
   * Map Rainforest API products to PromoFinder format
   */
  private mapToProducts(result: RainforestSearchResult): ProductFromAPI[] {
    const products: RainforestProduct[] =
      result.search_results ||
      result.bestsellers ||
      result.category_results ||
      [];

    return products
      .map((product) => this.mapSingleProduct(product))
      .filter((p): p is ProductFromAPI => p !== null);
  }

  /**
   * Map a single Rainforest product to PromoFinder format
   */
  private mapSingleProduct(product: RainforestProduct): ProductFromAPI | null {
    try {
      // Extract prices
      const salePrice = this.extractSalePrice(product);
      const originalPrice = this.extractOriginalPrice(product, salePrice);

      // Skip if no valid price
      if (salePrice === 0 || originalPrice === 0) {
        return null;
      }

      // Calculate discount
      const discountPercentage = Math.round(
        ((originalPrice - salePrice) / originalPrice) * 100
      );

      // Skip if no significant discount
      if (discountPercentage < 10) {
        return null;
      }

      // Extract brand
      const brand = this.extractBrand(product);
      if (!brand) {
        return null;
      }

      // Map category
      const category = this.mapCategory(product);

      // Extract images
      const images = product.images || [product.image];

      // Validate and calculate confidence score
      const validation = this.validateProduct({
        name: product.title,
        brand,
        category,
        originalPrice,
        salePrice,
        discountPercentage,
        productUrl: product.link,
        images,
        source: this.provider,
        confidenceScore: 0, // Will be calculated
      });

      if (!validation.isValid) {
        return null;
      }

      return {
        name: product.title,
        brand,
        category,
        originalPrice,
        salePrice,
        discountPercentage,
        productUrl: product.link,
        images,
        imageUrl: product.image,
        source: this.provider,
        confidenceScore: validation.confidenceScore,
        description: product.feature_bullets?.join(' '),
        currency: product.price?.currency || 'USD',
        rating: product.rating,
        reviewCount: product.ratings_total,
        availability: true,
        attributes: this.extractAttributes(product),
        externalId: product.asin,
      };
    } catch (error) {
      console.error('[Rainforest] Error mapping product:', error);
      return null;
    }
  }

  /**
   * Extract sale price from product
   */
  private extractSalePrice(product: RainforestProduct): number {
    if (product.price?.value) {
      return product.price.value;
    }

    // Try to find primary price
    if (product.prices) {
      const primaryPrice = product.prices.find((p) => p.is_primary);
      if (primaryPrice) {
        return primaryPrice.value;
      }
    }

    return 0;
  }

  /**
   * Extract original price from product
   */
  private extractOriginalPrice(
    product: RainforestProduct,
    salePrice: number
  ): number {
    // Check for upper price (was price)
    if (product.price_upper?.value) {
      return product.price_upper.value;
    }

    // Check for multiple prices
    if (product.prices && product.prices.length > 1) {
      const prices = product.prices.map((p) => p.value).sort((a, b) => b - a);
      return prices[0]; // Highest price
    }

    // Estimate original price (assume at least 10% discount)
    return salePrice * 1.15;
  }

  /**
   * Extract brand from product data
   */
  private extractBrand(product: RainforestProduct): string | null {
    // Try explicit brand field
    if (product.brand) {
      return product.brand;
    }

    // Try to extract from title
    const title = product.title.toLowerCase();
    const knownBrands = [
      'nike',
      'adidas',
      'zara',
      'h&m',
      'hm',
      'mango',
      'asos',
      'uniqlo',
      'pull&bear',
      'bershka',
      'stradivarius',
      'gap',
      "levi's",
      'tommy hilfiger',
      'calvin klein',
      'guess',
      'reserved',
      'massimo dutti',
      'vans',
      'converse',
      'new balance',
    ];

    for (const brand of knownBrands) {
      if (title.includes(brand)) {
        return brand
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
      }
    }

    return null;
  }

  /**
   * Map Rainforest category to PromoFinder category
   */
  private mapCategory(product: RainforestProduct): ProductCategory {
    const title = product.title.toLowerCase();

    // Check categories
    if (product.categories && product.categories.length > 0) {
      const category = product.categories[0].name.toLowerCase();

      if (category.includes('shoe') || category.includes('sneaker')) {
        return ProductCategory.shoes;
      }
      if (
        category.includes('bag') ||
        category.includes('backpack') ||
        category.includes('purse')
      ) {
        return ProductCategory.bags;
      }
      if (
        category.includes('jewelry') ||
        category.includes('necklace') ||
        category.includes('ring')
      ) {
        return ProductCategory.jewelry;
      }
      if (category.includes('watch')) {
        return ProductCategory.watches;
      }
      if (category.includes('sunglasses') || category.includes('glasses')) {
        return ProductCategory.sunglasses;
      }
    }

    // Check title
    if (title.includes('shoe') || title.includes('sneaker')) {
      return ProductCategory.shoes;
    }
    if (title.includes('bag') || title.includes('backpack')) {
      return ProductCategory.bags;
    }
    if (title.includes('watch')) {
      return ProductCategory.watches;
    }
    if (title.includes('sunglasses') || title.includes('glasses')) {
      return ProductCategory.sunglasses;
    }
    if (title.includes('jewelry') || title.includes('necklace')) {
      return ProductCategory.jewelry;
    }

    return ProductCategory.clothing;
  }

  /**
   * Extract attributes from product
   */
  private extractAttributes(product: RainforestProduct): any {
    const attributes: any = {};

    if (product.attributes) {
      product.attributes.forEach((attr) => {
        attributes[attr.name] = attr.value;
      });
    }

    return Object.keys(attributes).length > 0 ? attributes : undefined;
  }

  /**
   * Validate product and calculate confidence score
   */
  private validateProduct(product: ProductFromAPI): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // Validate name
    if (!product.name || product.name.length < 5) {
      errors.push('Invalid product name');
      score -= 30;
    }

    // Validate brand
    if (!product.brand) {
      errors.push('Missing brand');
      score -= 20;
    }

    // Validate prices
    if (product.originalPrice <= 0 || product.salePrice <= 0) {
      errors.push('Invalid prices');
      score -= 30;
    }

    // Validate discount
    if (product.discountPercentage < 10 || product.discountPercentage > 90) {
      warnings.push('Unusual discount percentage');
      score -= 5;
    }

    // Validate URL
    if (!product.productUrl || !this.isValidUrl(product.productUrl)) {
      errors.push('Invalid product URL');
      score -= 20;
    }

    // Validate images
    if (!product.images || product.images.length === 0) {
      warnings.push('No images available');
      score -= 5;
    }

    // Bonus for having external ID (ASIN)
    if (product.externalId) {
      score += 5;
    }

    // Ensure minimum score of 70
    score = Math.max(70, Math.min(99, score));

    return {
      isValid: errors.length === 0,
      confidenceScore: score,
      errors,
      warnings,
      metadata: {
        hasValidUrl: this.isValidUrl(product.productUrl),
        hasValidImages: product.images && product.images.length > 0,
        hasValidPrice: product.salePrice > 0 && product.originalPrice > 0,
        hasValidDiscount:
          product.discountPercentage >= 10 && product.discountPercentage <= 90,
        hasValidBrand: !!product.brand,
      },
    };
  }

  /**
   * Build search query for brand
   */
  private buildBrandQuery(brand: string, category?: string): string {
    let query = brand;

    if (category) {
      query += ` ${category}`;
    }

    query += ' sale discount';

    return query;
  }

  /**
   * Build search query for deals
   */
  private buildDealQuery(category?: string, brands?: string[]): string {
    let query = '';

    if (brands && brands.length > 0) {
      query += brands.join(' OR ') + ' ';
    }

    if (category) {
      query += category + ' ';
    }

    query += 'sale discount clearance deal';

    return query.trim();
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract error message from axios error
   */
  private extractErrorMessage(error: any): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        return `API Error: ${axiosError.response.status} - ${
          axiosError.response.statusText
        }`;
      }
      if (axiosError.request) {
        return 'No response from API server';
      }
    }
    return error.message || 'Unknown error occurred';
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================
// EXPORT
// ============================================

export default RainforestApiClient;
