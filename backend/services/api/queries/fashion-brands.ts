import { ProductCategory } from '@prisma/client';
import { BrandQuery } from '../types';

// ============================================
// TOP FASHION BRANDS
// ============================================

export const TOP_BRANDS = [
  'Nike',
  'Adidas',
  'Zara',
  'H&M',
  'Mango',
  'ASOS',
  'Uniqlo',
  'Pull&Bear',
  'Bershka',
  'Stradivarius',
  'GAP',
  "Levi's",
  'Tommy Hilfiger',
  'Calvin Klein',
  'Guess',
  'Reserved',
  'Massimo Dutti',
  'Vans',
  'Converse',
  'New Balance',
] as const;

export type TopBrand = typeof TOP_BRANDS[number];

// ============================================
// BRAND-SPECIFIC QUERIES
// ============================================

/**
 * Pre-configured queries for each top brand
 */
export const BRAND_QUERIES: Record<TopBrand, BrandQuery> = {
  'Nike': {
    brand: 'Nike',
    categories: [ProductCategory.shoes, ProductCategory.clothing],
    minDiscount: 30,
    maxPrice: 200,
    keywords: ['running', 'training', 'sportswear'],
  },
  'Adidas': {
    brand: 'Adidas',
    categories: [ProductCategory.shoes, ProductCategory.clothing],
    minDiscount: 30,
    maxPrice: 200,
    keywords: ['running', 'training', 'sportswear'],
  },
  'Zara': {
    brand: 'Zara',
    categories: [ProductCategory.clothing, ProductCategory.accessories],
    minDiscount: 25,
    maxPrice: 150,
    keywords: ['fashion', 'trendy', 'contemporary'],
  },
  'H&M': {
    brand: 'H&M',
    categories: [ProductCategory.clothing, ProductCategory.accessories],
    minDiscount: 25,
    maxPrice: 100,
    keywords: ['fashion', 'trendy', 'affordable'],
  },
  'Mango': {
    brand: 'Mango',
    categories: [ProductCategory.clothing, ProductCategory.accessories],
    minDiscount: 30,
    maxPrice: 150,
    keywords: ['fashion', 'elegant', 'contemporary'],
  },
  'ASOS': {
    brand: 'ASOS',
    categories: [ProductCategory.clothing, ProductCategory.shoes, ProductCategory.accessories],
    minDiscount: 30,
    maxPrice: 200,
    keywords: ['fashion', 'trendy', 'online'],
  },
  'Uniqlo': {
    brand: 'Uniqlo',
    categories: [ProductCategory.clothing],
    minDiscount: 25,
    maxPrice: 100,
    keywords: ['basics', 'quality', 'minimalist'],
  },
  'Pull&Bear': {
    brand: 'Pull&Bear',
    categories: [ProductCategory.clothing, ProductCategory.accessories],
    minDiscount: 30,
    maxPrice: 100,
    keywords: ['casual', 'streetwear', 'youth'],
  },
  'Bershka': {
    brand: 'Bershka',
    categories: [ProductCategory.clothing, ProductCategory.accessories],
    minDiscount: 30,
    maxPrice: 100,
    keywords: ['trendy', 'youth', 'fashion'],
  },
  'Stradivarius': {
    brand: 'Stradivarius',
    categories: [ProductCategory.clothing, ProductCategory.accessories],
    minDiscount: 30,
    maxPrice: 100,
    keywords: ['fashion', 'feminine', 'trendy'],
  },
  'GAP': {
    brand: 'GAP',
    categories: [ProductCategory.clothing],
    minDiscount: 30,
    maxPrice: 120,
    keywords: ['casual', 'classic', 'denim'],
  },
  "Levi's": {
    brand: "Levi's",
    categories: [ProductCategory.clothing],
    minDiscount: 30,
    maxPrice: 150,
    keywords: ['denim', 'jeans', 'classic'],
  },
  'Tommy Hilfiger': {
    brand: 'Tommy Hilfiger',
    categories: [ProductCategory.clothing, ProductCategory.accessories],
    minDiscount: 35,
    maxPrice: 200,
    keywords: ['preppy', 'classic', 'american'],
  },
  'Calvin Klein': {
    brand: 'Calvin Klein',
    categories: [ProductCategory.clothing, ProductCategory.accessories],
    minDiscount: 35,
    maxPrice: 200,
    keywords: ['minimalist', 'modern', 'designer'],
  },
  'Guess': {
    brand: 'Guess',
    categories: [ProductCategory.clothing, ProductCategory.accessories],
    minDiscount: 35,
    maxPrice: 200,
    keywords: ['fashion', 'trendy', 'american'],
  },
  'Reserved': {
    brand: 'Reserved',
    categories: [ProductCategory.clothing, ProductCategory.accessories],
    minDiscount: 30,
    maxPrice: 150,
    keywords: ['fashion', 'contemporary', 'european'],
  },
  'Massimo Dutti': {
    brand: 'Massimo Dutti',
    categories: [ProductCategory.clothing, ProductCategory.accessories],
    minDiscount: 35,
    maxPrice: 250,
    keywords: ['elegant', 'premium', 'sophisticated'],
  },
  'Vans': {
    brand: 'Vans',
    categories: [ProductCategory.shoes, ProductCategory.clothing],
    minDiscount: 25,
    maxPrice: 150,
    keywords: ['skatewear', 'streetwear', 'casual'],
  },
  'Converse': {
    brand: 'Converse',
    categories: [ProductCategory.shoes, ProductCategory.clothing],
    minDiscount: 25,
    maxPrice: 120,
    keywords: ['sneakers', 'casual', 'classic'],
  },
  'New Balance': {
    brand: 'New Balance',
    categories: [ProductCategory.shoes, ProductCategory.clothing],
    minDiscount: 30,
    maxPrice: 180,
    keywords: ['running', 'athletic', 'sportswear'],
  },
};

// ============================================
// BRAND CATEGORIES
// ============================================

/**
 * Group brands by category focus
 */
export const BRANDS_BY_CATEGORY: Record<ProductCategory, TopBrand[]> = {
  [ProductCategory.shoes]: [
    'Nike',
    'Adidas',
    'Vans',
    'Converse',
    'New Balance',
    'ASOS',
  ],
  [ProductCategory.clothing]: [
    'Zara',
    'H&M',
    'Mango',
    'ASOS',
    'Uniqlo',
    'Pull&Bear',
    'Bershka',
    'Stradivarius',
    'GAP',
    "Levi's",
    'Tommy Hilfiger',
    'Calvin Klein',
    'Guess',
    'Reserved',
    'Massimo Dutti',
  ],
  [ProductCategory.accessories]: [
    'Zara',
    'H&M',
    'Mango',
    'ASOS',
    'Tommy Hilfiger',
    'Calvin Klein',
    'Guess',
  ],
  [ProductCategory.bags]: [
    'Zara',
    'H&M',
    'Mango',
    'ASOS',
    'Guess',
  ],
  [ProductCategory.jewelry]: [],
  [ProductCategory.watches]: [],
  [ProductCategory.sunglasses]: [],
  [ProductCategory.other]: [],
};

// ============================================
// BRAND TIERS
// ============================================

/**
 * Brands grouped by price tier
 */
export const BRAND_TIERS = {
  budget: ['H&M', 'Pull&Bear', 'Bershka', 'Stradivarius', 'Uniqlo'],
  midRange: ['Zara', 'Mango', 'ASOS', 'GAP', "Levi's", 'Nike', 'Adidas', 'Vans', 'Converse', 'New Balance', 'Reserved'],
  premium: ['Tommy Hilfiger', 'Calvin Klein', 'Guess', 'Massimo Dutti'],
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get brand query by name
 */
export function getBrandQuery(brand: TopBrand): BrandQuery {
  return BRAND_QUERIES[brand];
}

/**
 * Get all brand queries
 */
export function getAllBrandQueries(): BrandQuery[] {
  return Object.values(BRAND_QUERIES);
}

/**
 * Get brands for a specific category
 */
export function getBrandsByCategory(category: ProductCategory): TopBrand[] {
  return BRANDS_BY_CATEGORY[category] || [];
}

/**
 * Get brands by price tier
 */
export function getBrandsByTier(tier: keyof typeof BRAND_TIERS): readonly TopBrand[] {
  return BRAND_TIERS[tier];
}

/**
 * Get brand tier
 */
export function getBrandTier(brand: TopBrand): keyof typeof BRAND_TIERS | null {
  for (const [tier, brands] of Object.entries(BRAND_TIERS)) {
    if (brands.includes(brand as any)) {
      return tier as keyof typeof BRAND_TIERS;
    }
  }
  return null;
}

/**
 * Check if brand is in our top brands list
 */
export function isTopBrand(brand: string): brand is TopBrand {
  return TOP_BRANDS.includes(brand as TopBrand);
}

/**
 * Get normalized brand name
 */
export function normalizeBrandName(brand: string): TopBrand | null {
  const normalized = brand.toLowerCase().trim();

  const found = TOP_BRANDS.find(
    (b) => b.toLowerCase() === normalized
  );

  return found || null;
}

/**
 * Get search keywords for a brand
 */
export function getBrandKeywords(brand: TopBrand): string[] {
  return BRAND_QUERIES[brand]?.keywords || [];
}

/**
 * Get recommended price range for a brand
 */
export function getBrandPriceRange(brand: TopBrand): { min: number; max: number } {
  const tier = getBrandTier(brand);

  switch (tier) {
    case 'budget':
      return { min: 10, max: 100 };
    case 'midRange':
      return { min: 30, max: 200 };
    case 'premium':
      return { min: 50, max: 300 };
    default:
      return { min: 20, max: 200 };
  }
}

/**
 * Get recommended minimum discount for a brand
 */
export function getBrandMinDiscount(brand: TopBrand): number {
  return BRAND_QUERIES[brand]?.minDiscount || 25;
}

// ============================================
// BATCH QUERIES
// ============================================

/**
 * Get queries for all budget brands
 */
export function getBudgetBrandQueries(): BrandQuery[] {
  return BRAND_TIERS.budget.map((brand) => BRAND_QUERIES[brand]);
}

/**
 * Get queries for all mid-range brands
 */
export function getMidRangeBrandQueries(): BrandQuery[] {
  return BRAND_TIERS.midRange.map((brand) => BRAND_QUERIES[brand]);
}

/**
 * Get queries for all premium brands
 */
export function getPremiumBrandQueries(): BrandQuery[] {
  return BRAND_TIERS.premium.map((brand) => BRAND_QUERIES[brand]);
}

/**
 * Get queries for sportswear brands
 */
export function getSportswearBrandQueries(): BrandQuery[] {
  const sportswearBrands: TopBrand[] = ['Nike', 'Adidas', 'New Balance', 'Vans'];
  return sportswearBrands.map((brand) => BRAND_QUERIES[brand]);
}

/**
 * Get queries for fast fashion brands
 */
export function getFastFashionBrandQueries(): BrandQuery[] {
  const fastFashionBrands: TopBrand[] = [
    'Zara',
    'H&M',
    'Mango',
    'Pull&Bear',
    'Bershka',
    'Stradivarius',
  ];
  return fastFashionBrands.map((brand) => BRAND_QUERIES[brand]);
}
