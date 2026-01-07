import { ProductCategory, ProductSource } from '@prisma/client';

// ============================================
// API PROVIDER TYPES
// ============================================

export type ApiProvider = 'rapidapi' | 'rainforest';

export interface ApiConfig {
  provider: ApiProvider;
  apiKey: string;
  baseUrl: string;
  rateLimit: number; // requests per day
  timeout: number; // milliseconds
}

// ============================================
// PRODUCT DATA FROM APIS
// ============================================

export interface ProductFromAPI {
  // Required fields
  name: string;
  brand: string;
  category: ProductCategory;
  originalPrice: number;
  salePrice: number;
  discountPercentage: number;
  productUrl: string;
  images: string[];
  source: ApiProvider;

  // Optional fields
  description?: string;
  imageUrl?: string;
  attributes?: {
    size?: string;
    color?: string;
    material?: string;
    gender?: string;
    [key: string]: any;
  };

  // Metadata
  confidenceScore: number; // 70-99 based on data completeness
  externalId?: string;
  currency?: string;
  availability?: boolean;
  rating?: number;
  reviewCount?: number;
}

// ============================================
// RAPIDAPI TYPES
// ============================================

export interface RapidApiSearchParams {
  query: string;
  country?: string;
  language?: string;
  limit?: number;
  page?: number;
  sort_by?: 'RELEVANCE' | 'LOWEST_PRICE' | 'HIGHEST_PRICE' | 'REVIEWS';
  min_price?: number;
  max_price?: number;
  product_condition?: 'NEW' | 'USED' | 'REFURBISHED';
}

export interface RapidApiProduct {
  product_id: string;
  product_title: string;
  product_description?: string;
  product_photo: string;
  product_photos?: string[];
  product_url: string;
  product_price: string;
  product_original_price?: string;
  product_discount?: string;
  currency: string;
  product_rating?: number;
  product_num_reviews?: number;
  product_availability?: string;
  brand?: string;
  category?: string;
  product_attributes?: {
    [key: string]: any;
  };
}

export interface RapidApiResponse {
  status: string;
  request_id: string;
  data: {
    products: RapidApiProduct[];
    total_results: number;
    page: number;
  };
}

// ============================================
// RAINFOREST API TYPES
// ============================================

export interface RainforestSearchParams {
  query: string;
  type?: 'search' | 'product' | 'bestsellers' | 'category';
  amazon_domain?: string;
  page?: number;
  output?: 'json';
  sort_by?: 'relevanceblender' | 'price-asc-rank' | 'price-desc-rank' | 'review-rank' | 'date-desc-rank';
  min_price?: number;
  max_price?: number;
}

export interface RainforestProduct {
  asin: string;
  title: string;
  link: string;
  image: string;
  images?: string[];
  price?: {
    value: number;
    currency: string;
    raw: string;
  };
  price_upper?: {
    value: number;
    currency: string;
    raw: string;
  };
  rating?: number;
  ratings_total?: number;
  prices?: Array<{
    symbol: string;
    value: number;
    currency: string;
    raw: string;
    name: string;
    is_primary: boolean;
  }>;
  brand?: string;
  categories?: Array<{
    name: string;
    id: string;
  }>;
  feature_bullets?: string[];
  attributes?: Array<{
    name: string;
    value: string;
  }>;
  bestsellers_rank?: Array<{
    category: string;
    rank: number;
  }>;
}

export interface RainforestSearchResult {
  search_results?: RainforestProduct[];
  product?: RainforestProduct;
  bestsellers?: RainforestProduct[];
  category_results?: RainforestProduct[];
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  cached?: boolean;
  responseTime?: number;
  provider: ApiProvider;
  requestId?: string;
}

export interface AggregatedResponse {
  products: ProductFromAPI[];
  totalResults: number;
  sources: {
    provider: ApiProvider;
    count: number;
    responseTime: number;
    cached: boolean;
  }[];
  errors?: Array<{
    provider: ApiProvider;
    error: string;
  }>;
}

// ============================================
// CACHING TYPES
// ============================================

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number; // time to live in seconds
  key: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  keys: number;
  memoryUsage?: string;
}

// ============================================
// RATE LIMITING TYPES
// ============================================

export interface RateLimitInfo {
  provider: ApiProvider;
  requestsToday: number;
  requestsRemaining: number;
  dailyLimit: number;
  resetsAt: Date;
  isLimited: boolean;
}

export interface RateLimitConfig {
  provider: ApiProvider;
  maxRequests: number; // per day
  windowMs: number; // time window in milliseconds
  retryAfterMs?: number; // wait time after hitting limit
}

// ============================================
// ERROR HANDLING TYPES
// ============================================

export class ApiError extends Error {
  constructor(
    message: string,
    public provider: ApiProvider,
    public statusCode?: number,
    public originalError?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class RateLimitError extends ApiError {
  constructor(
    provider: ApiProvider,
    public retryAfter: number
  ) {
    super(`Rate limit exceeded for ${provider}`, provider, 429);
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ============================================
// QUERY BUILDER TYPES
// ============================================

export interface BrandQuery {
  brand: string;
  categories?: ProductCategory[];
  minDiscount?: number;
  maxPrice?: number;
  keywords?: string[];
}

export interface CategoryQuery {
  category: ProductCategory;
  minDiscount?: number;
  maxPrice?: number;
  brands?: string[];
  sortBy?: 'price' | 'discount' | 'rating' | 'relevance';
}

export interface DealQuery {
  minDiscount: number; // minimum discount percentage
  maxPrice?: number;
  categories?: ProductCategory[];
  brands?: string[];
  priceDropOnly?: boolean; // only products with recent price drops
}

// ============================================
// LOGGING TYPES
// ============================================

export interface ApiLogEntry {
  provider: ApiProvider;
  endpoint: string;
  requestParams: any;
  responseStatus: number;
  responseTime: number; // milliseconds
  creditsUsed: number;
  estimatedCost?: number;
  success: boolean;
  errorMessage?: string;
  timestamp: Date;
}

// ============================================
// VALIDATION TYPES
// ============================================

export interface ValidationResult {
  isValid: boolean;
  confidenceScore: number;
  errors: string[];
  warnings: string[];
  metadata?: {
    hasValidUrl?: boolean;
    hasValidImages?: boolean;
    hasValidPrice?: boolean;
    hasValidDiscount?: boolean;
    hasValidBrand?: boolean;
  };
}

// ============================================
// UTILITY TYPES
// ============================================

export type RetryStrategy = 'exponential' | 'linear' | 'constant';

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  strategy: RetryStrategy;
  retryableErrors?: number[]; // HTTP status codes to retry
}
