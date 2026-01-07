import { ProductCategory } from '@prisma/client';
import { DealQuery } from '../types';
import { TOP_BRANDS } from './fashion-brands';

// ============================================
// DEAL TYPES
// ============================================

export enum DealType {
  FLASH_SALE = 'flash_sale', // High discounts (50%+)
  SEASONAL = 'seasonal', // Seasonal sales
  CLEARANCE = 'clearance', // End of season clearance
  BUDGET = 'budget', // Budget-friendly deals (<50 EUR)
  PREMIUM = 'premium', // Premium items on sale
  NEW_ARRIVALS = 'new_arrivals', // New items with discounts
}

// ============================================
// DEAL QUERIES
// ============================================

/**
 * Pre-configured queries for different deal types
 */
export const DEAL_QUERIES: Record<DealType, DealQuery> = {
  [DealType.FLASH_SALE]: {
    minDiscount: 50,
    maxPrice: 200,
    categories: [
      ProductCategory.shoes,
      ProductCategory.clothing,
      ProductCategory.accessories,
    ],
    brands: [...TOP_BRANDS],
  },
  [DealType.SEASONAL]: {
    minDiscount: 30,
    maxPrice: 250,
    categories: [
      ProductCategory.shoes,
      ProductCategory.clothing,
      ProductCategory.accessories,
      ProductCategory.bags,
    ],
    brands: [...TOP_BRANDS],
  },
  [DealType.CLEARANCE]: {
    minDiscount: 40,
    maxPrice: 150,
    categories: [
      ProductCategory.shoes,
      ProductCategory.clothing,
      ProductCategory.accessories,
    ],
    brands: [...TOP_BRANDS],
  },
  [DealType.BUDGET]: {
    minDiscount: 25,
    maxPrice: 50,
    categories: [
      ProductCategory.clothing,
      ProductCategory.accessories,
      ProductCategory.bags,
    ],
    brands: ['H&M', 'Pull&Bear', 'Bershka', 'Stradivarius', 'Uniqlo'],
  },
  [DealType.PREMIUM]: {
    minDiscount: 35,
    maxPrice: 500,
    categories: [
      ProductCategory.shoes,
      ProductCategory.clothing,
      ProductCategory.bags,
      ProductCategory.watches,
    ],
    brands: ['Tommy Hilfiger', 'Calvin Klein', 'Guess', 'Massimo Dutti'],
  },
  [DealType.NEW_ARRIVALS]: {
    minDiscount: 20,
    maxPrice: 200,
    categories: [
      ProductCategory.shoes,
      ProductCategory.clothing,
      ProductCategory.accessories,
    ],
    brands: [...TOP_BRANDS],
  },
};

// ============================================
// DISCOUNT TIERS
// ============================================

/**
 * Discount tier definitions
 */
export const DISCOUNT_TIERS = {
  minimal: { min: 10, max: 24, label: '10-24% Off' },
  moderate: { min: 25, max: 39, label: '25-39% Off' },
  significant: { min: 40, max: 59, label: '40-59% Off' },
  major: { min: 60, max: 74, label: '60-74% Off' },
  extreme: { min: 75, max: 90, label: '75%+ Off' },
} as const;

export type DiscountTier = keyof typeof DISCOUNT_TIERS;

// ============================================
// SEASONAL DEALS
// ============================================

/**
 * Seasonal sale queries
 */
export const SEASONAL_DEALS = {
  winter: {
    keywords: ['winter sale', 'winter clearance', 'coats', 'jackets', 'boots'],
    categories: [ProductCategory.clothing, ProductCategory.shoes],
    minDiscount: 30,
    maxPrice: 200,
  },
  summer: {
    keywords: ['summer sale', 'summer clearance', 'shorts', 'sandals', 'sunglasses'],
    categories: [ProductCategory.clothing, ProductCategory.shoes, ProductCategory.sunglasses],
    minDiscount: 30,
    maxPrice: 150,
  },
  spring: {
    keywords: ['spring sale', 'spring collection', 'dresses', 'light jackets'],
    categories: [ProductCategory.clothing, ProductCategory.accessories],
    minDiscount: 25,
    maxPrice: 180,
  },
  fall: {
    keywords: ['fall sale', 'autumn sale', 'sweaters', 'boots', 'jeans'],
    categories: [ProductCategory.clothing, ProductCategory.shoes],
    minDiscount: 30,
    maxPrice: 200,
  },
  blackFriday: {
    keywords: ['black friday', 'cyber monday', 'holiday sale'],
    categories: Object.values(ProductCategory),
    minDiscount: 40,
    maxPrice: 500,
  },
  backToSchool: {
    keywords: ['back to school', 'student discount', 'backpacks', 'sneakers'],
    categories: [ProductCategory.bags, ProductCategory.shoes, ProductCategory.clothing],
    minDiscount: 25,
    maxPrice: 150,
  },
} as const;

export type SeasonalDeal = keyof typeof SEASONAL_DEALS;

// ============================================
// PRICE RANGE DEALS
// ============================================

/**
 * Deals grouped by price ranges
 */
export const PRICE_RANGE_DEALS = {
  under25: {
    label: 'Under $25',
    maxPrice: 25,
    minDiscount: 20,
  },
  under50: {
    label: 'Under $50',
    maxPrice: 50,
    minDiscount: 25,
  },
  under100: {
    label: 'Under $100',
    maxPrice: 100,
    minDiscount: 30,
  },
  under200: {
    label: 'Under $200',
    maxPrice: 200,
    minDiscount: 30,
  },
  premium: {
    label: '$200+',
    minPrice: 200,
    minDiscount: 35,
  },
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get deal query by type
 */
export function getDealQuery(dealType: DealType): DealQuery {
  return DEAL_QUERIES[dealType];
}

/**
 * Get all deal queries
 */
export function getAllDealQueries(): DealQuery[] {
  return Object.values(DEAL_QUERIES);
}

/**
 * Get deals by discount tier
 */
export function getDealsByDiscountTier(tier: DiscountTier): DealQuery {
  const tierInfo = DISCOUNT_TIERS[tier];

  return {
    minDiscount: tierInfo.min,
    maxPrice: 300,
    categories: [
      ProductCategory.shoes,
      ProductCategory.clothing,
      ProductCategory.accessories,
      ProductCategory.bags,
    ],
    brands: [...TOP_BRANDS],
  };
}

/**
 * Get seasonal deal query
 */
export function getSeasonalDealQuery(season: SeasonalDeal): DealQuery {
  const seasonal = SEASONAL_DEALS[season];

  return {
    minDiscount: seasonal.minDiscount,
    maxPrice: seasonal.maxPrice,
    categories: seasonal.categories,
    brands: [...TOP_BRANDS],
  };
}

/**
 * Get price range deal query
 */
export function getPriceRangeDealQuery(
  range: keyof typeof PRICE_RANGE_DEALS
): DealQuery {
  const priceRange = PRICE_RANGE_DEALS[range];

  return {
    minDiscount: priceRange.minDiscount,
    maxPrice: priceRange.maxPrice,
    categories: [
      ProductCategory.shoes,
      ProductCategory.clothing,
      ProductCategory.accessories,
    ],
    brands: [...TOP_BRANDS],
  };
}

/**
 * Get current seasonal deals based on date
 */
export function getCurrentSeasonalDeals(): DealQuery {
  const month = new Date().getMonth();

  // 0=Jan, 11=Dec
  if (month >= 11 || month <= 1) {
    return getSeasonalDealQuery('winter');
  } else if (month >= 2 && month <= 4) {
    return getSeasonalDealQuery('spring');
  } else if (month >= 5 && month <= 7) {
    return getSeasonalDealQuery('summer');
  } else {
    return getSeasonalDealQuery('fall');
  }
}

/**
 * Check if Black Friday season
 */
export function isBlackFridaySeason(): boolean {
  const month = new Date().getMonth();
  const day = new Date().getDate();

  // November 15 - December 5
  return month === 10 && day >= 15 || month === 11 && day <= 5;
}

/**
 * Get best current deals
 */
export function getBestCurrentDeals(): DealQuery[] {
  const deals: DealQuery[] = [];

  // Always include flash sales
  deals.push(getDealQuery(DealType.FLASH_SALE));

  // Add seasonal deals
  deals.push(getCurrentSeasonalDeals());

  // Add Black Friday if in season
  if (isBlackFridaySeason()) {
    deals.push(getSeasonalDealQuery('blackFriday'));
  }

  // Add clearance
  deals.push(getDealQuery(DealType.CLEARANCE));

  return deals;
}

/**
 * Build search query for deals
 */
export function buildDealSearchQuery(dealType: DealType): string {
  const queries: Record<DealType, string> = {
    [DealType.FLASH_SALE]: 'flash sale clearance mega discount',
    [DealType.SEASONAL]: 'sale discount seasonal',
    [DealType.CLEARANCE]: 'clearance outlet final sale',
    [DealType.BUDGET]: 'sale discount affordable budget',
    [DealType.PREMIUM]: 'designer sale luxury discount premium',
    [DealType.NEW_ARRIVALS]: 'new arrivals discount sale',
  };

  return queries[dealType];
}

/**
 * Build seasonal search query
 */
export function buildSeasonalSearchQuery(season: SeasonalDeal): string {
  return SEASONAL_DEALS[season].keywords.join(' ');
}

/**
 * Get discount tier label
 */
export function getDiscountTierLabel(discount: number): string {
  for (const tier of Object.values(DISCOUNT_TIERS)) {
    if (discount >= tier.min && discount <= tier.max) {
      return tier.label;
    }
  }
  return 'Discount';
}

/**
 * Get recommended deal types for category
 */
export function getRecommendedDealsForCategory(
  category: ProductCategory
): DealType[] {
  const recommendations: Record<ProductCategory, DealType[]> = {
    [ProductCategory.shoes]: [
      DealType.FLASH_SALE,
      DealType.SEASONAL,
      DealType.CLEARANCE,
    ],
    [ProductCategory.clothing]: [
      DealType.FLASH_SALE,
      DealType.SEASONAL,
      DealType.CLEARANCE,
      DealType.BUDGET,
    ],
    [ProductCategory.accessories]: [
      DealType.BUDGET,
      DealType.FLASH_SALE,
      DealType.SEASONAL,
    ],
    [ProductCategory.bags]: [
      DealType.FLASH_SALE,
      DealType.PREMIUM,
      DealType.SEASONAL,
    ],
    [ProductCategory.jewelry]: [
      DealType.PREMIUM,
      DealType.FLASH_SALE,
    ],
    [ProductCategory.watches]: [
      DealType.PREMIUM,
      DealType.FLASH_SALE,
    ],
    [ProductCategory.sunglasses]: [
      DealType.SEASONAL,
      DealType.FLASH_SALE,
    ],
    [ProductCategory.other]: [
      DealType.FLASH_SALE,
      DealType.BUDGET,
    ],
  };

  return recommendations[category] || [DealType.FLASH_SALE];
}

// ============================================
// BATCH QUERIES
// ============================================

/**
 * Get all flash sale queries
 */
export function getFlashSaleQueries(): DealQuery[] {
  return Object.values(ProductCategory).map((category) => ({
    minDiscount: 50,
    maxPrice: 300,
    categories: [category],
    brands: [...TOP_BRANDS],
  }));
}

/**
 * Get budget-friendly deal queries
 */
export function getBudgetDealQueries(): DealQuery[] {
  return [
    getPriceRangeDealQuery('under25'),
    getPriceRangeDealQuery('under50'),
  ];
}

/**
 * Get premium deal queries
 */
export function getPremiumDealQueries(): DealQuery[] {
  return [
    getDealQuery(DealType.PREMIUM),
    getPriceRangeDealQuery('premium'),
  ];
}

/**
 * Get category-specific deal queries
 */
export function getCategoryDealQueries(category: ProductCategory): DealQuery[] {
  const dealTypes = getRecommendedDealsForCategory(category);

  return dealTypes.map((dealType) => ({
    ...getDealQuery(dealType),
    categories: [category],
  }));
}
