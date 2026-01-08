// Region Types
export enum Region {
  US = 'US',
  EU = 'EU',
  UK = 'UK',
  IT = 'IT',
  FR = 'FR',
  DE = 'DE',
  ES = 'ES',
  GLOBAL = 'GLOBAL'
}

export interface RegionInfo {
  code: Region;
  name: string;
  currency: string;
  currencySymbol: string;
  flag: string;
}

export const REGION_INFO: Record<Region, RegionInfo> = {
  [Region.US]: {
    code: Region.US,
    name: 'United States',
    currency: 'USD',
    currencySymbol: '$',
    flag: '🇺🇸'
  },
  [Region.EU]: {
    code: Region.EU,
    name: 'European Union',
    currency: 'EUR',
    currencySymbol: '€',
    flag: '🇪🇺'
  },
  [Region.UK]: {
    code: Region.UK,
    name: 'United Kingdom',
    currency: 'GBP',
    currencySymbol: '£',
    flag: '🇬🇧'
  },
  [Region.IT]: {
    code: Region.IT,
    name: 'Italy',
    currency: 'EUR',
    currencySymbol: '€',
    flag: '🇮🇹'
  },
  [Region.FR]: {
    code: Region.FR,
    name: 'France',
    currency: 'EUR',
    currencySymbol: '€',
    flag: '🇫🇷'
  },
  [Region.DE]: {
    code: Region.DE,
    name: 'Germany',
    currency: 'EUR',
    currencySymbol: '€',
    flag: '🇩🇪'
  },
  [Region.ES]: {
    code: Region.ES,
    name: 'Spain',
    currency: 'EUR',
    currencySymbol: '€',
    flag: '🇪🇸'
  },
  [Region.GLOBAL]: {
    code: Region.GLOBAL,
    name: 'Global',
    currency: 'USD',
    currencySymbol: '$',
    flag: '🌍'
  }
};

// Product Types
export enum ProductCategory {
  CLOTHING = 'clothing',
  SHOES = 'shoes',
  ACCESSORIES = 'accessories',
  ALL = 'all'
}

// Gender Types
export type Gender = 'men' | 'women' | 'kids' | 'unisex';

// Smart Category Types
export type SmartCategory = 'athletic' | 'casual' | 'streetwear' | 'basics' | 'formal' | 'outerwear' | 'bottoms' | 'tops';

export enum ProductSource {
  ZARA = 'Zara',
  HM = 'H&M',
  ASOS = 'ASOS',
  NIKE = 'Nike',
  ADIDAS = 'Adidas',
  MANGO = 'Mango',
  UNIQLO = 'Uniqlo',
  PULL_AND_BEAR = 'Pull&Bear'
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  source: ProductSource;
  originalPrice: number;
  salePrice: number;
  discountPercentage: number;
  discount?: number; // Alias for discountPercentage
  confidenceScore: number;
  image: string;
  imageUrl?: string; // Alternative field name from API
  url: string;
  productUrl?: string; // Alternative field name from API
  affiliateUrl?: string; // Affiliate link
  currency: string;
  regions: string[]; // Available regions
  availableRegions?: string[]; // Alternative field name from API
  isNew?: boolean;
  lastUpdated?: Date;
  createdAt?: string;
  updatedAt?: string;
  // AI-analyzed fields
  gender?: Gender;
  smartCategories?: SmartCategory[];
  seasons?: string[];
  dealScore?: number;
  bestValue?: boolean;
  topDeal?: boolean;
  priceDrop?: boolean;
  retailer?: string;
  merchantName?: string;
}

// Filter Types
export interface DealsFilters {
  region?: Region; // User's region for filtering deals
  brands: string[];
  categories: ProductCategory[];
  priceRange: {
    min: number;
    max: number;
  };
  minDiscount: number;
  minConfidence: number;
  sources: ProductSource[];
  sortBy: SortOption;
  sortOrder: 'asc' | 'desc';
  searchQuery?: string;
  // New AI-powered filters
  genders: Gender[];
  retailers: string[];
  smartCategories: SmartCategory[];
  smartFilters: {
    bestValue: boolean;
    topDeal: boolean;
    priceDrop: boolean;
  };
}

export type SortOption = 'price' | 'discount' | 'popularity' | 'date' | 'relevance';

export const DEFAULT_FILTERS: DealsFilters = {
  region: Region.EU, // Default to EU
  brands: [],
  categories: [ProductCategory.ALL],
  priceRange: {
    min: 0,
    max: 500
  },
  minDiscount: 0,
  minConfidence: 70,
  sources: [],
  sortBy: 'relevance',
  sortOrder: 'desc',
  // New filter defaults
  genders: [],
  retailers: [],
  smartCategories: [],
  smartFilters: {
    bestValue: false,
    topDeal: false,
    priceDrop: false
  }
};

// Analytics Types
export interface AnalyticsStats {
  totalDeals: number;
  averageDiscount: number;
  topBrands: BrandStats[];
  categoryDistribution: CategoryStats[];
  priceDistribution: PriceRange[];
  recentActivity: ActivityLog[];
}

export interface BrandStats {
  brand: string;
  count: number;
  averageDiscount: number;
}

export interface CategoryStats {
  category: ProductCategory;
  count: number;
  percentage: number;
}

export interface PriceRange {
  range: string;
  count: number;
}

export interface ActivityLog {
  timestamp: Date;
  event: string;
  details: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface DealsResponse {
  deals: Product[];
  total: number;
  page: number;
  limit: number;
  lastUpdated: Date;
}

// UI Component Props
export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  totalItems: number;
}
