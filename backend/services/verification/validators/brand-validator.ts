/**
 * Brand Validator
 *
 * Validates and normalizes brand names:
 * - Case-insensitive matching
 * - Handles common variations
 * - Fuzzy matching for typos
 * - Brand name corrections
 */

import { KNOWN_BRANDS, BrandValidatorConfig } from '../types';

/**
 * Default configuration for brand validation
 */
const DEFAULT_CONFIG: BrandValidatorConfig = {
  knownBrands: [...KNOWN_BRANDS],
  caseSensitive: false,
  fuzzyMatchThreshold: 0.8
};

/**
 * Validates and corrects a brand name
 *
 * @param brand - Brand name to validate
 * @param config - Optional validator configuration
 * @returns Validation result with corrected name if needed
 */
export function validateBrand(
  brand: string,
  config: Partial<BrandValidatorConfig> = {}
): { valid: boolean; corrected?: string; confidence: number; suggestion?: string } {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (!brand || brand.trim().length === 0) {
    return { valid: false, confidence: 0 };
  }

  const normalizedBrand = normalizeBrandName(brand);

  // Try exact match first (case-insensitive)
  const exactMatch = findExactMatch(normalizedBrand, finalConfig.knownBrands);
  if (exactMatch) {
    return {
      valid: true,
      corrected: exactMatch !== brand ? exactMatch : undefined,
      confidence: 1.0
    };
  }

  // Try fuzzy match
  const fuzzyMatch = findFuzzyMatch(
    normalizedBrand,
    finalConfig.knownBrands,
    finalConfig.fuzzyMatchThreshold
  );

  if (fuzzyMatch) {
    return {
      valid: true,
      corrected: fuzzyMatch.match,
      confidence: fuzzyMatch.score,
      suggestion: `Did you mean "${fuzzyMatch.match}"?`
    };
  }

  // Check for common brand variations
  const variation = findBrandVariation(normalizedBrand);
  if (variation) {
    return {
      valid: true,
      corrected: variation,
      confidence: 0.9,
      suggestion: `Corrected to "${variation}"`
    };
  }

  // Brand not found in known list
  return {
    valid: false,
    confidence: 0,
    suggestion: 'Brand not found in known brands list'
  };
}

/**
 * Normalize brand name for comparison
 *
 * @param brand - Brand name to normalize
 * @returns Normalized brand name
 */
export function normalizeBrandName(brand: string): string {
  return brand
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[^\w\s&'-]/g, '') // Remove special characters except &, ', -
    .toLowerCase();
}

/**
 * Find exact match in known brands (case-insensitive)
 *
 * @param brand - Normalized brand name
 * @param knownBrands - List of known brands
 * @returns Matched brand name or null
 */
function findExactMatch(brand: string, knownBrands: string[]): string | null {
  const brandLower = brand.toLowerCase();

  for (const knownBrand of knownBrands) {
    if (knownBrand.toLowerCase() === brandLower) {
      return knownBrand;
    }
  }

  return null;
}

/**
 * Find fuzzy match using Levenshtein distance
 *
 * @param brand - Normalized brand name
 * @param knownBrands - List of known brands
 * @param threshold - Similarity threshold (0-1)
 * @returns Best match with score or null
 */
function findFuzzyMatch(
  brand: string,
  knownBrands: string[],
  threshold: number
): { match: string; score: number } | null {
  let bestMatch: { match: string; score: number } | null = null;

  for (const knownBrand of knownBrands) {
    const score = calculateSimilarity(brand.toLowerCase(), knownBrand.toLowerCase());

    if (score >= threshold) {
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { match: knownBrand, score };
      }
    }
  }

  return bestMatch;
}

/**
 * Calculate similarity between two strings (0-1)
 * Uses Levenshtein distance
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity score (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);

  if (maxLength === 0) return 1.0;

  return 1 - distance / maxLength;
}

/**
 * Calculate Levenshtein distance between two strings
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Edit distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Find common brand variations
 *
 * @param brand - Normalized brand name
 * @returns Corrected brand name or null
 */
function findBrandVariation(brand: string): string | null {
  const variations: Record<string, string> = {
    'h&m': 'H&M',
    'hm': 'H&M',
    'h & m': 'H&M',
    'nike': 'Nike',
    'adidas': 'Adidas',
    'zara': 'Zara',
    'mango': 'Mango',
    'asos': 'ASOS',
    'uniqlo': 'Uniqlo',
    'pull&bear': 'Pull&Bear',
    'pull & bear': 'Pull&Bear',
    'pullbear': 'Pull&Bear',
    'bershka': 'Bershka',
    'stradivarius': 'Stradivarius',
    'gap': 'GAP',
    'levis': 'Levi\'s',
    "levi's": 'Levi\'s',
    'tommy': 'Tommy Hilfiger',
    'tommy hilfiger': 'Tommy Hilfiger',
    'calvin': 'Calvin Klein',
    'calvin klein': 'Calvin Klein',
    'ck': 'Calvin Klein',
    'ralph': 'Ralph Lauren',
    'ralph lauren': 'Ralph Lauren',
    'polo': 'Polo Ralph Lauren',
    'polo ralph lauren': 'Polo Ralph Lauren',
    'the north face': 'The North Face',
    'north face': 'The North Face',
    'tnf': 'The North Face',
    'dr martens': 'Dr. Martens',
    'dr. martens': 'Dr. Martens',
    'doc martens': 'Dr. Martens',
    'new balance': 'New Balance',
    'nb': 'New Balance',
    'under armour': 'Under Armour',
    'ua': 'Under Armour',
    'louis vuitton': 'Louis Vuitton',
    'lv': 'Louis Vuitton',
    'ysl': 'Saint Laurent',
    'saint laurent': 'Saint Laurent',
    'yves saint laurent': 'Saint Laurent',
    'balenciaga': 'Balenciaga',
    'dg': 'Dolce & Gabbana',
    'd&g': 'Dolce & Gabbana',
    'dolce gabbana': 'Dolce & Gabbana',
    'dolce & gabbana': 'Dolce & Gabbana',
    'cos': 'COS',
    '& other stories': 'Other Stories',
    'other stories': 'Other Stories',
    'massimo dutti': 'Massimo Dutti'
  };

  const brandLower = brand.toLowerCase();

  if (variations[brandLower]) {
    return variations[brandLower];
  }

  return null;
}

/**
 * Check if brand is a luxury brand
 *
 * @param brand - Brand name
 * @returns True if luxury brand
 */
export function isLuxuryBrand(brand: string): boolean {
  const luxuryBrands = [
    'gucci', 'prada', 'louis vuitton', 'versace', 'armani',
    'burberry', 'balenciaga', 'valentino', 'fendi', 'givenchy',
    'saint laurent', 'bottega veneta', 'dolce & gabbana',
    'alexander mcqueen', 'off-white', 'moncler', 'canada goose'
  ];

  const brandLower = normalizeBrandName(brand);

  return luxuryBrands.some(luxuryBrand =>
    brandLower.includes(luxuryBrand) || luxuryBrand.includes(brandLower)
  );
}

/**
 * Check if brand is a fast fashion brand
 *
 * @param brand - Brand name
 * @returns True if fast fashion brand
 */
export function isFastFashionBrand(brand: string): boolean {
  const fastFashionBrands = [
    'zara', 'h&m', 'mango', 'uniqlo', 'pull&bear', 'bershka',
    'stradivarius', 'gap', 'forever 21', 'primark', 'shein',
    'asos', 'boohoo', 'prettylittlething', 'missguided'
  ];

  const brandLower = normalizeBrandName(brand);

  return fastFashionBrands.some(ffBrand =>
    brandLower.includes(ffBrand) || ffBrand.includes(brandLower)
  );
}

/**
 * Get brand category
 *
 * @param brand - Brand name
 * @returns Brand category
 */
export function getBrandCategory(brand: string): 'luxury' | 'premium' | 'fast-fashion' | 'sportswear' | 'unknown' {
  const brandLower = normalizeBrandName(brand);

  if (isLuxuryBrand(brand)) {
    return 'luxury';
  }

  if (isFastFashionBrand(brand)) {
    return 'fast-fashion';
  }

  const sportswearBrands = ['nike', 'adidas', 'puma', 'reebok', 'under armour', 'new balance', 'asics'];
  if (sportswearBrands.some(sb => brandLower.includes(sb))) {
    return 'sportswear';
  }

  const premiumBrands = [
    'tommy hilfiger', 'calvin klein', 'ralph lauren', 'boss',
    'diesel', 'lacoste', 'fred perry', 'stone island'
  ];
  if (premiumBrands.some(pb => brandLower.includes(pb))) {
    return 'premium';
  }

  return 'unknown';
}

/**
 * Validate multiple brand names
 *
 * @param brands - Array of brand names
 * @param config - Optional validator configuration
 * @returns Map of brand to validation result
 */
export function validateBrands(
  brands: string[],
  config: Partial<BrandValidatorConfig> = {}
): Map<string, ReturnType<typeof validateBrand>> {
  const results = brands.map(brand => ({
    brand,
    result: validateBrand(brand, config)
  }));

  return new Map(results.map(({ brand, result }) => [brand, result]));
}
