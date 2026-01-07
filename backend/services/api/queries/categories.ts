import { ProductCategory } from '@prisma/client';
import { CategoryQuery } from '../types';
import { getBrandsByCategory } from './fashion-brands';

// ============================================
// CATEGORY SEARCH QUERIES
// ============================================

/**
 * Pre-configured queries for each category
 */
export const CATEGORY_QUERIES: Record<ProductCategory, CategoryQuery> = {
  [ProductCategory.shoes]: {
    category: ProductCategory.shoes,
    minDiscount: 25,
    maxPrice: 200,
    brands: getBrandsByCategory(ProductCategory.shoes),
    sortBy: 'discount',
  },
  [ProductCategory.clothing]: {
    category: ProductCategory.clothing,
    minDiscount: 25,
    maxPrice: 150,
    brands: getBrandsByCategory(ProductCategory.clothing),
    sortBy: 'discount',
  },
  [ProductCategory.accessories]: {
    category: ProductCategory.accessories,
    minDiscount: 25,
    maxPrice: 100,
    brands: getBrandsByCategory(ProductCategory.accessories),
    sortBy: 'discount',
  },
  [ProductCategory.bags]: {
    category: ProductCategory.bags,
    minDiscount: 30,
    maxPrice: 200,
    brands: getBrandsByCategory(ProductCategory.bags),
    sortBy: 'discount',
  },
  [ProductCategory.jewelry]: {
    category: ProductCategory.jewelry,
    minDiscount: 30,
    maxPrice: 150,
    sortBy: 'discount',
  },
  [ProductCategory.watches]: {
    category: ProductCategory.watches,
    minDiscount: 30,
    maxPrice: 300,
    sortBy: 'discount',
  },
  [ProductCategory.sunglasses]: {
    category: ProductCategory.sunglasses,
    minDiscount: 25,
    maxPrice: 200,
    sortBy: 'discount',
  },
  [ProductCategory.other]: {
    category: ProductCategory.other,
    minDiscount: 25,
    maxPrice: 200,
    sortBy: 'discount',
  },
};

// ============================================
// CATEGORY KEYWORDS
// ============================================

/**
 * Search keywords for each category
 */
export const CATEGORY_KEYWORDS: Record<ProductCategory, string[]> = {
  [ProductCategory.shoes]: [
    'shoes',
    'sneakers',
    'boots',
    'sandals',
    'heels',
    'flats',
    'loafers',
    'trainers',
    'running shoes',
    'casual shoes',
  ],
  [ProductCategory.clothing]: [
    'clothing',
    'apparel',
    'dress',
    'shirt',
    'pants',
    'jeans',
    'jacket',
    'coat',
    't-shirt',
    'sweater',
    'hoodie',
    'shorts',
    'skirt',
  ],
  [ProductCategory.accessories]: [
    'accessories',
    'belt',
    'scarf',
    'hat',
    'cap',
    'gloves',
    'tie',
    'wallet',
  ],
  [ProductCategory.bags]: [
    'bag',
    'backpack',
    'handbag',
    'purse',
    'tote',
    'clutch',
    'messenger bag',
    'crossbody',
    'shoulder bag',
  ],
  [ProductCategory.jewelry]: [
    'jewelry',
    'necklace',
    'bracelet',
    'ring',
    'earrings',
    'pendant',
    'chain',
  ],
  [ProductCategory.watches]: [
    'watch',
    'watches',
    'timepiece',
    'smartwatch',
    'chronograph',
  ],
  [ProductCategory.sunglasses]: [
    'sunglasses',
    'eyewear',
    'shades',
    'glasses',
  ],
  [ProductCategory.other]: [
    'fashion',
    'style',
  ],
};

// ============================================
// CATEGORY SUBCATEGORIES
// ============================================

/**
 * Subcategories for more specific searches
 */
export const CATEGORY_SUBCATEGORIES = {
  [ProductCategory.shoes]: [
    'running shoes',
    'sneakers',
    'boots',
    'sandals',
    'dress shoes',
    'casual shoes',
    'athletic shoes',
  ],
  [ProductCategory.clothing]: {
    men: [
      "men's shirts",
      "men's pants",
      "men's jeans",
      "men's jackets",
      "men's t-shirts",
      "men's sweaters",
    ],
    women: [
      "women's dresses",
      "women's tops",
      "women's pants",
      "women's jeans",
      "women's jackets",
      "women's skirts",
    ],
    unisex: [
      'hoodies',
      'sweatshirts',
      'activewear',
      'loungewear',
    ],
  },
  [ProductCategory.bags]: [
    'backpacks',
    'handbags',
    'tote bags',
    'crossbody bags',
    'messenger bags',
    'clutches',
  ],
} as const;

// ============================================
// PRICE RANGES
// ============================================

/**
 * Recommended price ranges for each category
 */
export const CATEGORY_PRICE_RANGES: Record<
  ProductCategory,
  { min: number; max: number; budget: number; midRange: number; premium: number }
> = {
  [ProductCategory.shoes]: {
    min: 20,
    max: 300,
    budget: 60,
    midRange: 120,
    premium: 250,
  },
  [ProductCategory.clothing]: {
    min: 10,
    max: 200,
    budget: 40,
    midRange: 80,
    premium: 150,
  },
  [ProductCategory.accessories]: {
    min: 10,
    max: 150,
    budget: 30,
    midRange: 60,
    premium: 120,
  },
  [ProductCategory.bags]: {
    min: 20,
    max: 300,
    budget: 60,
    midRange: 120,
    premium: 250,
  },
  [ProductCategory.jewelry]: {
    min: 15,
    max: 200,
    budget: 40,
    midRange: 80,
    premium: 150,
  },
  [ProductCategory.watches]: {
    min: 30,
    max: 500,
    budget: 80,
    midRange: 200,
    premium: 400,
  },
  [ProductCategory.sunglasses]: {
    min: 15,
    max: 250,
    budget: 50,
    midRange: 100,
    premium: 200,
  },
  [ProductCategory.other]: {
    min: 10,
    max: 200,
    budget: 40,
    midRange: 80,
    premium: 150,
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get category query
 */
export function getCategoryQuery(category: ProductCategory): CategoryQuery {
  return CATEGORY_QUERIES[category];
}

/**
 * Get all category queries
 */
export function getAllCategoryQueries(): CategoryQuery[] {
  return Object.values(CATEGORY_QUERIES);
}

/**
 * Get category keywords
 */
export function getCategoryKeywords(category: ProductCategory): string[] {
  return CATEGORY_KEYWORDS[category] || [];
}

/**
 * Get category price range
 */
export function getCategoryPriceRange(
  category: ProductCategory,
  tier?: 'budget' | 'midRange' | 'premium'
): { min: number; max: number } {
  const ranges = CATEGORY_PRICE_RANGES[category];

  if (tier === 'budget') {
    return { min: ranges.min, max: ranges.budget };
  } else if (tier === 'midRange') {
    return { min: ranges.budget, max: ranges.midRange };
  } else if (tier === 'premium') {
    return { min: ranges.midRange, max: ranges.premium };
  }

  return { min: ranges.min, max: ranges.max };
}

/**
 * Build search query string for category
 */
export function buildCategorySearchQuery(
  category: ProductCategory,
  options?: {
    gender?: 'men' | 'women' | 'unisex';
    subcategory?: string;
    includeSale?: boolean;
  }
): string {
  const keywords = getCategoryKeywords(category);
  let query = keywords[0]; // Primary keyword

  if (options?.gender) {
    query = `${options.gender}'s ${query}`;
  }

  if (options?.subcategory) {
    query += ` ${options.subcategory}`;
  }

  if (options?.includeSale !== false) {
    query += ' sale discount';
  }

  return query;
}

/**
 * Get category by keyword
 */
export function getCategoryByKeyword(keyword: string): ProductCategory | null {
  const normalizedKeyword = keyword.toLowerCase().trim();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => k.includes(normalizedKeyword) || normalizedKeyword.includes(k))) {
      return category as ProductCategory;
    }
  }

  return null;
}

/**
 * Get recommended minimum discount for category
 */
export function getCategoryMinDiscount(category: ProductCategory): number {
  return CATEGORY_QUERIES[category]?.minDiscount || 25;
}

/**
 * Get recommended sort order for category
 */
export function getCategorySortBy(
  category: ProductCategory
): 'price' | 'discount' | 'rating' | 'relevance' {
  return CATEGORY_QUERIES[category]?.sortBy || 'discount';
}

// ============================================
// BATCH QUERIES
// ============================================

/**
 * Get queries for all main categories
 */
export function getMainCategoryQueries(): CategoryQuery[] {
  const mainCategories: ProductCategory[] = [
    ProductCategory.shoes,
    ProductCategory.clothing,
    ProductCategory.accessories,
    ProductCategory.bags,
  ];

  return mainCategories.map((cat) => CATEGORY_QUERIES[cat]);
}

/**
 * Get budget-friendly category queries
 */
export function getBudgetCategoryQueries(): CategoryQuery[] {
  return Object.entries(CATEGORY_QUERIES).map(([category, query]) => ({
    ...query,
    maxPrice: CATEGORY_PRICE_RANGES[category as ProductCategory].budget,
  }));
}

/**
 * Get premium category queries
 */
export function getPremiumCategoryQueries(): CategoryQuery[] {
  return Object.entries(CATEGORY_QUERIES).map(([category, query]) => ({
    ...query,
    minPrice: CATEGORY_PRICE_RANGES[category as ProductCategory].midRange,
    maxPrice: CATEGORY_PRICE_RANGES[category as ProductCategory].premium,
  }));
}

/**
 * Get high-discount category queries
 */
export function getHighDiscountCategoryQueries(minDiscount: number = 50): CategoryQuery[] {
  return Object.values(CATEGORY_QUERIES).map((query) => ({
    ...query,
    minDiscount,
  }));
}

// ============================================
// GENDER-SPECIFIC QUERIES
// ============================================

/**
 * Get men's category queries
 */
export function getMensCategoryQueries(): CategoryQuery[] {
  return [
    ProductCategory.shoes,
    ProductCategory.clothing,
    ProductCategory.accessories,
    ProductCategory.bags,
    ProductCategory.watches,
  ].map((cat) => CATEGORY_QUERIES[cat]);
}

/**
 * Get women's category queries
 */
export function getWomensCategoryQueries(): CategoryQuery[] {
  return [
    ProductCategory.shoes,
    ProductCategory.clothing,
    ProductCategory.accessories,
    ProductCategory.bags,
    ProductCategory.jewelry,
    ProductCategory.sunglasses,
  ].map((cat) => CATEGORY_QUERIES[cat]);
}
