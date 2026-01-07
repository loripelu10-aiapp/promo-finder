/**
 * AI Response Parser
 *
 * Parse and validate responses from Claude API
 */

import {
  ClaudeVerificationResponse,
  BrandVerification,
  CategoryVerification,
  DiscountVerification,
  DescriptionVerification,
  ProductCategory
} from '../types';

/**
 * Parse Claude verification response
 *
 * @param response - Raw response from Claude
 * @returns Parsed verification response
 */
export function parseVerificationResponse(response: any): ClaudeVerificationResponse {
  try {
    // Validate required fields
    if (typeof response.brandCorrect !== 'boolean') {
      throw new Error('Missing or invalid brandCorrect field');
    }

    if (typeof response.categoryAccurate !== 'boolean') {
      throw new Error('Missing or invalid categoryAccurate field');
    }

    if (typeof response.discountRealistic !== 'boolean') {
      throw new Error('Missing or invalid discountRealistic field');
    }

    if (typeof response.confidenceScore !== 'number') {
      throw new Error('Missing or invalid confidenceScore field');
    }

    if (!Array.isArray(response.redFlags)) {
      throw new Error('Missing or invalid redFlags field');
    }

    // Normalize fields
    return {
      brandCorrect: response.brandCorrect,
      brandCorrectedName: response.brandCorrectedName || null,
      categoryAccurate: response.categoryAccurate,
      suggestedCategory: response.suggestedCategory || null,
      discountRealistic: response.discountRealistic,
      descriptionRelevant: response.descriptionRelevant ?? true, // Default to true if missing
      redFlags: response.redFlags,
      confidenceScore: Math.max(0, Math.min(100, response.confidenceScore)), // Clamp 0-100
      reasoning: response.reasoning || 'No reasoning provided'
    };

  } catch (error: any) {
    throw new Error(`Failed to parse verification response: ${error.message}`);
  }
}

/**
 * Parse brand verification response
 *
 * @param response - Raw brand verification response
 * @param originalBrand - Original brand name
 * @returns Parsed brand verification
 */
export function parseBrandResponse(
  response: any,
  originalBrand: string
): BrandVerification {
  try {
    return {
      correct: response.correct ?? false,
      originalBrand,
      correctedBrand: response.correctedName || undefined,
      confidence: Math.max(0, Math.min(1, response.confidence ?? 0)),
      reasoning: response.reasoning || 'No reasoning provided'
    };
  } catch (error: any) {
    // Return safe default on parse error
    return {
      correct: false,
      originalBrand,
      confidence: 0,
      reasoning: `Parse error: ${error.message}`
    };
  }
}

/**
 * Parse category verification response
 *
 * @param response - Raw category verification response
 * @param originalCategory - Original category
 * @returns Parsed category verification
 */
export function parseCategoryResponse(
  response: any,
  originalCategory: ProductCategory
): CategoryVerification {
  try {
    let suggestedCategory: ProductCategory | undefined;

    if (!response.accurate && response.suggestedCategory) {
      suggestedCategory = normalizeCategory(response.suggestedCategory);
    }

    return {
      accurate: response.accurate ?? false,
      originalCategory,
      suggestedCategory,
      confidence: Math.max(0, Math.min(1, response.confidence ?? 0)),
      reasoning: response.reasoning || 'No reasoning provided'
    };
  } catch (error: any) {
    return {
      accurate: false,
      originalCategory,
      confidence: 0,
      reasoning: `Parse error: ${error.message}`
    };
  }
}

/**
 * Parse discount verification response
 *
 * @param response - Raw discount verification response
 * @returns Parsed discount verification
 */
export function parseDiscountResponse(response: any): DiscountVerification {
  try {
    return {
      realistic: response.realistic ?? false,
      tooGoodToBeTrue: response.tooGoodToBeTrue ?? false,
      confidence: Math.max(0, Math.min(1, response.confidence ?? 0)),
      reasoning: response.reasoning || 'No reasoning provided'
    };
  } catch (error: any) {
    return {
      realistic: false,
      tooGoodToBeTrue: true,
      confidence: 0,
      reasoning: `Parse error: ${error.message}`
    };
  }
}

/**
 * Parse description verification response
 *
 * @param response - Raw description verification response
 * @returns Parsed description verification
 */
export function parseDescriptionResponse(response: any): DescriptionVerification {
  try {
    return {
      relevant: response.relevant ?? false,
      matchesProduct: response.matchesProduct ?? false,
      confidence: Math.max(0, Math.min(1, response.confidence ?? 0)),
      reasoning: response.reasoning || 'No reasoning provided'
    };
  } catch (error: any) {
    return {
      relevant: false,
      matchesProduct: false,
      confidence: 0,
      reasoning: `Parse error: ${error.message}`
    };
  }
}

/**
 * Normalize category string to ProductCategory enum
 *
 * @param category - Category string from AI
 * @returns Normalized ProductCategory
 */
function normalizeCategory(category: string): ProductCategory {
  const categoryMap: Record<string, ProductCategory> = {
    'shoes': 'shoes',
    'shoe': 'shoes',
    'footwear': 'shoes',
    'sneakers': 'shoes',
    'boots': 'shoes',

    'clothing': 'clothing',
    'clothes': 'clothing',
    'apparel': 'clothing',
    'wear': 'clothing',

    'accessories': 'accessories',
    'accessory': 'accessories',

    'bags': 'bags',
    'bag': 'bags',
    'purse': 'bags',
    'handbag': 'bags',

    'jewelry': 'jewelry',
    'jewellery': 'jewelry',

    'watches': 'watches',
    'watch': 'watches',

    'sunglasses': 'sunglasses',
    'eyewear': 'sunglasses',
    'glasses': 'sunglasses',

    'other': 'other'
  };

  const normalized = category.toLowerCase().trim();

  return categoryMap[normalized] || 'other';
}

/**
 * Extract red flags from response
 *
 * @param response - Verification response
 * @returns Array of red flag strings
 */
export function extractRedFlags(response: ClaudeVerificationResponse): string[] {
  const flags: string[] = [...response.redFlags];

  // Add implicit red flags based on response
  if (!response.brandCorrect && response.brandCorrectedName) {
    flags.push(`Brand name formatting issue: "${response.brandCorrectedName}" recommended`);
  }

  if (!response.categoryAccurate && response.suggestedCategory) {
    flags.push(`Category mismatch: "${response.suggestedCategory}" suggested`);
  }

  if (!response.discountRealistic) {
    flags.push('Discount percentage unrealistic');
  }

  if (!response.descriptionRelevant) {
    flags.push('Product description not relevant to product type');
  }

  return flags;
}

/**
 * Calculate AI confidence score from response
 *
 * @param response - Verification response
 * @returns Confidence score (0-100)
 */
export function calculateAiConfidence(response: ClaudeVerificationResponse): number {
  let confidence = response.confidenceScore;

  // Penalize for issues found
  if (!response.brandCorrect) confidence -= 5;
  if (!response.categoryAccurate) confidence -= 10;
  if (!response.discountRealistic) confidence -= 15;
  if (!response.descriptionRelevant) confidence -= 5;

  // Penalize for red flags
  confidence -= response.redFlags.length * 5;

  return Math.max(0, Math.min(100, confidence));
}

/**
 * Validate response structure
 *
 * @param response - Response to validate
 * @returns True if valid structure
 */
export function isValidResponse(response: any): boolean {
  try {
    parseVerificationResponse(response);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get summary from verification response
 *
 * @param response - Verification response
 * @returns Human-readable summary
 */
export function getResponseSummary(response: ClaudeVerificationResponse): string {
  const issues: string[] = [];

  if (!response.brandCorrect) {
    issues.push(`brand (${response.brandCorrectedName})`);
  }

  if (!response.categoryAccurate) {
    issues.push(`category (${response.suggestedCategory})`);
  }

  if (!response.discountRealistic) {
    issues.push('discount');
  }

  if (response.redFlags.length > 0) {
    issues.push(`${response.redFlags.length} red flags`);
  }

  if (issues.length === 0) {
    return `All checks passed. Confidence: ${response.confidenceScore}%`;
  }

  return `Issues found: ${issues.join(', ')}. Confidence: ${response.confidenceScore}%`;
}

/**
 * Merge multiple verification responses (for batch processing)
 *
 * @param responses - Array of responses
 * @returns Aggregated statistics
 */
export function aggregateResponses(responses: ClaudeVerificationResponse[]): {
  totalProducts: number;
  averageConfidence: number;
  totalIssues: number;
  commonIssues: Map<string, number>;
} {
  const totalProducts = responses.length;
  const averageConfidence = responses.reduce((sum, r) => sum + r.confidenceScore, 0) / totalProducts;
  const allRedFlags = responses.flatMap(r => r.redFlags);
  const totalIssues = allRedFlags.length;

  const commonIssues = new Map<string, number>();
  for (const flag of allRedFlags) {
    commonIssues.set(flag, (commonIssues.get(flag) || 0) + 1);
  }

  return {
    totalProducts,
    averageConfidence,
    totalIssues,
    commonIssues
  };
}
