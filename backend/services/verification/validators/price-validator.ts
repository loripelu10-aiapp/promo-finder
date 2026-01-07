/**
 * Price Validator
 *
 * Validates product pricing for:
 * - Positive price values
 * - Sale price less than original price
 * - Reasonable price ranges for fashion items
 * - Discount percentage accuracy
 */

import { PriceValidationResult, DiscountValidationResult, PriceValidatorConfig } from '../types';

/**
 * Default configuration for price validation
 */
const DEFAULT_CONFIG: PriceValidatorConfig = {
  minPrice: 1,           // $1 minimum
  maxPrice: 10000,       // $10,000 maximum for fashion items
  discountTolerance: 2   // 2% tolerance for discount calculation
};

/**
 * Validates product pricing
 *
 * @param originalPrice - Original price before discount
 * @param salePrice - Sale price after discount
 * @param discountPercentage - Claimed discount percentage
 * @param config - Optional validator configuration
 * @returns Price validation result
 */
export function validatePrice(
  originalPrice: number,
  salePrice: number,
  discountPercentage: number,
  config: Partial<PriceValidatorConfig> = {}
): PriceValidationResult {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const issues: string[] = [];

  // Check 1: Both prices must be positive
  const positiveValues = originalPrice > 0 && salePrice > 0;
  if (!positiveValues) {
    if (originalPrice <= 0) issues.push('Original price must be greater than 0');
    if (salePrice <= 0) issues.push('Sale price must be greater than 0');
  }

  // Check 2: Sale price must be less than or equal to original price
  const saleLessThanOriginal = salePrice <= originalPrice;
  if (!saleLessThanOriginal) {
    issues.push(`Sale price ($${salePrice}) is greater than original price ($${originalPrice})`);
  }

  // Check 3: Prices must be within reasonable range
  const withinReasonableRange =
    originalPrice >= finalConfig.minPrice &&
    originalPrice <= finalConfig.maxPrice &&
    salePrice >= finalConfig.minPrice &&
    salePrice <= finalConfig.maxPrice;

  if (!withinReasonableRange) {
    if (originalPrice < finalConfig.minPrice || salePrice < finalConfig.minPrice) {
      issues.push(`Prices too low (minimum: $${finalConfig.minPrice})`);
    }
    if (originalPrice > finalConfig.maxPrice || salePrice > finalConfig.maxPrice) {
      issues.push(`Prices too high (maximum: $${finalConfig.maxPrice})`);
    }
  }

  // Check 4: Discount percentage matches calculated discount
  const calculatedDiscount = calculateDiscountPercentage(originalPrice, salePrice);
  const discountDifference = Math.abs(calculatedDiscount - discountPercentage);
  const discountMatchesCalculated = discountDifference <= finalConfig.discountTolerance;

  if (!discountMatchesCalculated) {
    issues.push(
      `Claimed discount (${discountPercentage}%) doesn't match calculated discount (${calculatedDiscount.toFixed(1)}%). Difference: ${discountDifference.toFixed(1)}%`
    );
  }

  // Check for suspicious patterns
  if (originalPrice === salePrice && discountPercentage > 0) {
    issues.push('Discount claimed but prices are identical');
  }

  if (discountPercentage === 0 && originalPrice !== salePrice) {
    issues.push('No discount claimed but prices differ');
  }

  // Determine overall validity
  const valid = positiveValues && saleLessThanOriginal && discountMatchesCalculated;
  const reasonable = valid && withinReasonableRange;

  return {
    valid,
    reasonable,
    issues,
    checks: {
      positiveValues,
      saleLessThanOriginal,
      withinReasonableRange,
      discountMatchesCalculated
    }
  };
}

/**
 * Validates discount percentage
 *
 * @param originalPrice - Original price before discount
 * @param salePrice - Sale price after discount
 * @param claimedDiscount - Claimed discount percentage
 * @param tolerance - Tolerance for discount calculation (default 2%)
 * @returns Discount validation result
 */
export function validateDiscount(
  originalPrice: number,
  salePrice: number,
  claimedDiscount: number,
  tolerance: number = 2
): DiscountValidationResult {
  const calculatedDiscount = calculateDiscountPercentage(originalPrice, salePrice);
  const difference = Math.abs(calculatedDiscount - claimedDiscount);

  return {
    valid: difference <= tolerance,
    calculated: calculatedDiscount,
    claimed: claimedDiscount,
    difference,
    realistic: isDiscountRealistic(calculatedDiscount)
  };
}

/**
 * Calculate discount percentage from prices
 *
 * @param originalPrice - Original price
 * @param salePrice - Sale price
 * @returns Discount percentage
 */
export function calculateDiscountPercentage(
  originalPrice: number,
  salePrice: number
): number {
  if (originalPrice <= 0) return 0;

  const discount = ((originalPrice - salePrice) / originalPrice) * 100;
  return Math.max(0, Math.min(100, discount)); // Clamp between 0 and 100
}

/**
 * Calculate sale price from original price and discount
 *
 * @param originalPrice - Original price
 * @param discountPercentage - Discount percentage
 * @returns Sale price
 */
export function calculateSalePrice(
  originalPrice: number,
  discountPercentage: number
): number {
  if (originalPrice <= 0 || discountPercentage < 0 || discountPercentage > 100) {
    return originalPrice;
  }

  return originalPrice * (1 - discountPercentage / 100);
}

/**
 * Check if discount percentage is realistic for fashion items
 *
 * @param discountPercentage - Discount percentage to check
 * @returns True if discount is realistic
 */
export function isDiscountRealistic(discountPercentage: number): boolean {
  // Realistic discounts for fashion are typically between 10% and 90%
  // 0-10%: Too small to be a real "deal"
  // 90-100%: Usually fake or error
  return discountPercentage >= 10 && discountPercentage <= 90;
}

/**
 * Check if prices are suspiciously low (possible scam)
 *
 * @param brand - Brand name
 * @param salePrice - Sale price
 * @returns True if price is suspiciously low
 */
export function isSuspiciouslyLow(brand: string, salePrice: number): boolean {
  const luxuryBrands = [
    'gucci', 'prada', 'louis vuitton', 'versace', 'armani',
    'burberry', 'balenciaga', 'valentino', 'fendi', 'givenchy',
    'saint laurent', 'bottega veneta', 'dolce & gabbana'
  ];

  const premiumBrands = [
    'nike', 'adidas', 'tommy hilfiger', 'calvin klein',
    'ralph lauren', 'lacoste', 'boss', 'diesel'
  ];

  const brandLower = brand.toLowerCase();

  // Luxury brand items under $50 are suspicious
  if (luxuryBrands.some(b => brandLower.includes(b)) && salePrice < 50) {
    return true;
  }

  // Premium brand items under $10 are suspicious
  if (premiumBrands.some(b => brandLower.includes(b)) && salePrice < 10) {
    return true;
  }

  return false;
}

/**
 * Check if prices are suspiciously high (possible error)
 *
 * @param salePrice - Sale price
 * @param maxExpected - Maximum expected price for category
 * @returns True if price is suspiciously high
 */
export function isSuspiciouslyHigh(
  salePrice: number,
  maxExpected: number = 5000
): boolean {
  // Prices above the expected maximum might be errors
  return salePrice > maxExpected;
}

/**
 * Format price for display
 *
 * @param price - Price to format
 * @param currency - Currency code (default: EUR)
 * @returns Formatted price string
 */
export function formatPrice(price: number, currency: string = 'EUR'): string {
  const currencySymbols: Record<string, string> = {
    EUR: '€',
    USD: '$',
    GBP: '£',
    JPY: '¥'
  };

  const symbol = currencySymbols[currency] || currency;

  if (currency === 'JPY') {
    return `${symbol}${Math.round(price)}`;
  }

  return `${symbol}${price.toFixed(2)}`;
}

/**
 * Validate price for specific product categories
 *
 * @param category - Product category
 * @param price - Price to validate
 * @returns True if price is reasonable for category
 */
export function isPriceReasonableForCategory(
  category: string,
  price: number
): { reasonable: boolean; reason?: string } {
  const categoryRanges: Record<string, { min: number; max: number }> = {
    shoes: { min: 20, max: 2000 },
    clothing: { min: 10, max: 3000 },
    accessories: { min: 5, max: 1000 },
    bags: { min: 30, max: 5000 },
    jewelry: { min: 10, max: 10000 },
    watches: { min: 50, max: 10000 },
    sunglasses: { min: 20, max: 1000 },
    other: { min: 1, max: 5000 }
  };

  const range = categoryRanges[category.toLowerCase()] || categoryRanges.other;

  if (price < range.min) {
    return {
      reasonable: false,
      reason: `Price too low for ${category} (minimum expected: $${range.min})`
    };
  }

  if (price > range.max) {
    return {
      reasonable: false,
      reason: `Price too high for ${category} (maximum expected: $${range.max})`
    };
  }

  return { reasonable: true };
}
