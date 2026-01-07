import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  ApiProvider,
  ApiResponse,
  RapidApiSearchParams,
  RapidApiResponse,
  RapidApiProduct,
  ProductFromAPI,
  ApiError,
  RetryConfig,
  ValidationResult,
} from './types';
import { ProductCategory } from '@prisma/client';

// ============================================
// RAPIDAPI CLIENT
// ============================================

export class RapidApiClient {
  private client: AxiosInstance;
  private readonly provider: ApiProvider = 'rapidapi';
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;
  private readonly retryConfig: RetryConfig;

  constructor(config?: {
    apiKey?: string;
    timeout?: number;
    retryConfig?: Partial<RetryConfig>;
  }) {
    this.apiKey = config?.apiKey || process.env.RAPIDAPI_KEY || '';
    this.baseUrl = 'https://real-time-product-search.p.rapidapi.com';
    this.timeout = config?.timeout || parseInt(process.env.API_TIMEOUT || '5000');

    this.retryConfig = {
      maxAttempts: config?.retryConfig?.maxAttempts || 3,
      initialDelayMs: config?.retryConfig?.initialDelayMs || 1000,
      maxDelayMs: config?.retryConfig?.maxDelayMs || 10000,
      strategy: config?.retryConfig?.strategy || 'exponential',
      retryableErrors: [408, 429, 500, 502, 503, 504],
    };

    if (!this.apiKey) {
      throw new Error('RAPIDAPI_KEY is not set in environment variables');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'X-RapidAPI-Key': this.apiKey,
        'X-RapidAPI-Host': 'real-time-product-search.p.rapidapi.com',
        'Content-Type': 'application/json',
      },
    });
  }

  // ============================================
  // PUBLIC METHODS
  // ============================================

  /**
   * Search for products using RapidAPI
   */
  async searchProducts(
    params: RapidApiSearchParams
  ): Promise<ApiResponse<ProductFromAPI[]>> {
    const startTime = Date.now();

    try {
      const response = await this.executeWithRetry<RapidApiResponse>(async () => {
        return await this.client.get('/search', {
          params: {
            q: params.query,
            country: params.country || 'us',
            language: params.language || 'en',
            limit: params.limit || 10,
            page: params.page || 1,
            sort_by: params.sort_by || 'RELEVANCE',
            ...(params.min_price && { min_price: params.min_price }),
            ...(params.max_price && { max_price: params.max_price }),
            ...(params.product_condition && {
              product_condition: params.product_condition,
            }),
          },
        });
      });

      const products = this.mapToProducts(response.data.data.products);
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        data: products,
        provider: this.provider,
        responseTime,
        requestId: response.data.request_id,
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

    return this.searchProducts({
      query,
      max_price: options?.maxPrice,
      limit: options?.limit || 20,
      sort_by: 'LOWEST_PRICE',
    });
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
      limit: options?.limit || 30,
      sort_by: 'LOWEST_PRICE',
    });

    // Filter by minimum discount if specified
    if (result.success && result.data && options?.minDiscount) {
      result.data = result.data.filter(
        (p) => p.discountPercentage >= options.minDiscount!
      );
    }

    return result;
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
        `[RapidAPI] Retry attempt ${attempt}/${this.retryConfig.maxAttempts} after ${delay}ms`
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
   * Map RapidAPI products to PromoFinder format
   */
  private mapToProducts(apiProducts: RapidApiProduct[]): ProductFromAPI[] {
    return apiProducts
      .map((product) => this.mapSingleProduct(product))
      .filter((p): p is ProductFromAPI => p !== null);
  }

  /**
   * Map a single RapidAPI product to PromoFinder format
   */
  private mapSingleProduct(product: RapidApiProduct): ProductFromAPI | null {
    try {
      // Extract prices
      const salePrice = this.extractPrice(product.product_price);
      const originalPrice =
        this.extractPrice(product.product_original_price) || salePrice;

      // Skip if no valid price
      if (salePrice === 0 || originalPrice === 0) {
        return null;
      }

      // Calculate discount
      const discountPercentage =
        product.product_discount
          ? this.extractDiscount(product.product_discount)
          : Math.round(((originalPrice - salePrice) / originalPrice) * 100);

      // Skip if no discount
      if (discountPercentage < 10) {
        return null;
      }

      // Extract brand
      const brand = this.extractBrand(product);
      if (!brand) {
        return null;
      }

      // Map category
      const category = this.mapCategory(product.category || '');

      // Extract images
      const images = product.product_photos || [product.product_photo];

      // Validate and calculate confidence score
      const validation = this.validateProduct({
        name: product.product_title,
        brand,
        category,
        originalPrice,
        salePrice,
        discountPercentage,
        productUrl: product.product_url,
        images,
        source: this.provider,
        confidenceScore: 0, // Will be calculated
      });

      if (!validation.isValid) {
        return null;
      }

      return {
        name: product.product_title,
        brand,
        category,
        originalPrice,
        salePrice,
        discountPercentage,
        productUrl: product.product_url,
        images,
        imageUrl: product.product_photo,
        source: this.provider,
        confidenceScore: validation.confidenceScore,
        description: product.product_description,
        currency: product.currency || 'USD',
        rating: product.product_rating,
        reviewCount: product.product_num_reviews,
        availability: product.product_availability === 'InStock',
        attributes: product.product_attributes,
        externalId: product.product_id,
      };
    } catch (error) {
      console.error('[RapidAPI] Error mapping product:', error);
      return null;
    }
  }

  /**
   * Extract numeric price from string
   */
  private extractPrice(priceString?: string): number {
    if (!priceString) return 0;

    const cleaned = priceString.replace(/[^0-9.]/g, '');
    const price = parseFloat(cleaned);

    return isNaN(price) ? 0 : price;
  }

  /**
   * Extract discount percentage from string
   */
  private extractDiscount(discountString: string): number {
    const match = discountString.match(/(\d+)%?/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Extract brand from product data
   */
  private extractBrand(product: RapidApiProduct): string | null {
    // Try explicit brand field
    if (product.brand) {
      return product.brand;
    }

    // Try to extract from title
    const title = product.product_title.toLowerCase();
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
   * Map API category to PromoFinder category
   */
  private mapCategory(apiCategory: string): ProductCategory {
    const category = apiCategory.toLowerCase();

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
    if (
      category.includes('hat') ||
      category.includes('scarf') ||
      category.includes('belt')
    ) {
      return ProductCategory.accessories;
    }

    return ProductCategory.clothing;
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

    query += ' discount sale';

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

    query += 'sale discount clearance';

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

export default RapidApiClient;
