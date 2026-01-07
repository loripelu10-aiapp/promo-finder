/**
 * AI Verifier - Layer 3 Verification
 *
 * Uses Claude API to verify:
 * - Brand name correctness and formatting
 * - Product category accuracy
 * - Discount legitimacy
 * - Description relevance
 * - Red flags detection
 *
 * Score range: 90-99% (AI validation)
 * Base score: 0-40 points for this layer
 */

import {
  VerifiableProduct,
  AIVerificationResult,
  VerificationIssue,
  VerificationLayer,
  BrandVerification,
  CategoryVerification,
  DiscountVerification,
  DescriptionVerification
} from './types';

import { getClaudeClient } from './ai/claude-client';
import { generateVerificationPrompt, SYSTEM_PROMPT, formatProductForLog } from './ai/prompts';
import {
  parseVerificationResponse,
  calculateAiConfidence,
  extractRedFlags,
  getResponseSummary
} from './ai/response-parser';

import { validateBrand } from './validators/brand-validator';

/**
 * Verify product using Claude API
 *
 * @param product - Product to verify
 * @param useAi - Whether to use AI (can be disabled to save costs)
 * @returns AI verification result
 */
export async function verifyWithAI(
  product: VerifiableProduct,
  useAi: boolean = true
): Promise<AIVerificationResult> {
  // Check if AI verification is enabled
  const aiEnabled = process.env.AI_VERIFICATION_ENABLED !== 'false';

  if (!useAi || !aiEnabled) {
    return createFallbackResult(product);
  }

  try {
    console.log(`[AI Verifier] Verifying: ${formatProductForLog(product)}`);

    // Get Claude client
    const claude = getClaudeClient();

    // Generate prompt
    const prompt = generateVerificationPrompt(product);

    // Send to Claude API
    const startTime = Date.now();
    const response = await claude.sendMessage(prompt, SYSTEM_PROMPT);
    const responseTime = Date.now() - startTime;

    console.log(`[AI Verifier] Claude response time: ${responseTime}ms`);

    // Parse response
    const parsedResponse = claude.parseJsonResponse(response);
    const verificationData = parseVerificationResponse(parsedResponse);

    // Extract verification components
    const brandVerification = extractBrandVerification(
      verificationData,
      product.brand
    );

    const categoryVerification = extractCategoryVerification(
      verificationData,
      product.category
    );

    const discountVerification = extractDiscountVerification(
      verificationData
    );

    const descriptionVerification = extractDescriptionVerification(
      verificationData
    );

    // Extract red flags
    const redFlags = extractRedFlags(verificationData);

    // Calculate AI confidence
    const aiConfidence = calculateAiConfidence(verificationData);

    // Generate issues
    const issues = generateAiIssues(
      brandVerification,
      categoryVerification,
      discountVerification,
      descriptionVerification,
      redFlags
    );

    // Calculate score (0-40 points)
    const score = calculateAiScore(
      brandVerification,
      categoryVerification,
      discountVerification,
      descriptionVerification,
      redFlags.length
    );

    // Product passes if no critical red flags
    const passed = redFlags.length === 0 || !redFlags.some(isCriticalRedFlag);

    const summary = getResponseSummary(verificationData);
    console.log(`[AI Verifier] Result: ${summary}`);

    return {
      passed,
      score,
      layer: VerificationLayer.AI,
      brandVerification,
      categoryVerification,
      discountVerification,
      descriptionVerification,
      redFlags,
      aiConfidence,
      reasoning: verificationData.reasoning,
      issues,
      metadata: {
        responseTime,
        modelUsed: claude.getModelInfo().model,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      },
      timestamp: new Date()
    };

  } catch (error: any) {
    console.error(`[AI Verifier] Error: ${error.message}`);

    // Fallback to rule-based verification on error
    return createFallbackResult(product, error.message);
  }
}

/**
 * Extract brand verification from response
 */
function extractBrandVerification(
  response: any,
  originalBrand: string
): BrandVerification {
  // Also use local brand validator as a backup
  const localValidation = validateBrand(originalBrand);

  return {
    correct: response.brandCorrect,
    originalBrand,
    correctedBrand: response.brandCorrectedName || localValidation.corrected,
    confidence: response.brandCorrect ? 1.0 : 0.7,
    reasoning: response.brandCorrect
      ? 'Brand name is correctly formatted'
      : `Brand name should be: ${response.brandCorrectedName || localValidation.corrected}`
  };
}

/**
 * Extract category verification from response
 */
function extractCategoryVerification(
  response: any,
  originalCategory: any
): CategoryVerification {
  return {
    accurate: response.categoryAccurate,
    originalCategory,
    suggestedCategory: response.suggestedCategory || undefined,
    confidence: response.categoryAccurate ? 1.0 : 0.7,
    reasoning: response.categoryAccurate
      ? 'Category is accurate for this product'
      : `Suggested category: ${response.suggestedCategory}`
  };
}

/**
 * Extract discount verification from response
 */
function extractDiscountVerification(response: any): DiscountVerification {
  return {
    realistic: response.discountRealistic,
    tooGoodToBeTrue: !response.discountRealistic,
    confidence: response.discountRealistic ? 1.0 : 0.5,
    reasoning: response.discountRealistic
      ? 'Discount percentage is within realistic range'
      : 'Discount may be unrealistic or too good to be true'
  };
}

/**
 * Extract description verification from response
 */
function extractDescriptionVerification(response: any): DescriptionVerification {
  return {
    relevant: response.descriptionRelevant ?? true,
    matchesProduct: response.descriptionRelevant ?? true,
    confidence: response.descriptionRelevant ? 1.0 : 0.6,
    reasoning: response.descriptionRelevant
      ? 'Description matches product type'
      : 'Description may not be relevant to product'
  };
}

/**
 * Generate issues from AI verification
 */
function generateAiIssues(
  brandVerification: BrandVerification,
  categoryVerification: CategoryVerification,
  discountVerification: DiscountVerification,
  descriptionVerification: DescriptionVerification,
  redFlags: string[]
): VerificationIssue[] {
  const issues: VerificationIssue[] = [];

  // Brand issues
  if (!brandVerification.correct) {
    issues.push({
      severity: 'warning',
      field: 'brand',
      message: brandVerification.reasoning,
      value: brandVerification.originalBrand,
      suggestion: brandVerification.correctedBrand
    });
  }

  // Category issues
  if (!categoryVerification.accurate) {
    issues.push({
      severity: 'warning',
      field: 'category',
      message: categoryVerification.reasoning,
      value: categoryVerification.originalCategory,
      suggestion: categoryVerification.suggestedCategory
    });
  }

  // Discount issues
  if (!discountVerification.realistic) {
    issues.push({
      severity: discountVerification.tooGoodToBeTrue ? 'critical' : 'warning',
      field: 'discountPercentage',
      message: discountVerification.reasoning,
      value: discountVerification.tooGoodToBeTrue
    });
  }

  // Description issues
  if (!descriptionVerification.relevant) {
    issues.push({
      severity: 'info',
      field: 'description',
      message: descriptionVerification.reasoning
    });
  }

  // Red flags
  for (const flag of redFlags) {
    const severity = isCriticalRedFlag(flag) ? 'critical' : 'warning';
    issues.push({
      severity,
      field: 'general',
      message: flag
    });
  }

  return issues;
}

/**
 * Calculate AI verification score (0-40 points)
 *
 * Scoring breakdown:
 * - Brand correct: 10 points
 * - Category accurate: 10 points
 * - Discount realistic: 15 points
 * - Description relevant: 5 points
 * - No red flags: bonus points
 * Maximum: 40 points
 */
function calculateAiScore(
  brandVerification: BrandVerification,
  categoryVerification: CategoryVerification,
  discountVerification: DiscountVerification,
  descriptionVerification: DescriptionVerification,
  redFlagCount: number
): number {
  let score = 0;

  // Brand verification (10 points)
  if (brandVerification.correct) {
    score += 10;
  } else if (brandVerification.correctedBrand) {
    score += 7; // Partial credit if correctable
  }

  // Category verification (10 points)
  if (categoryVerification.accurate) {
    score += 10;
  } else if (categoryVerification.suggestedCategory) {
    score += 5; // Partial credit if suggestion available
  }

  // Discount verification (15 points)
  if (discountVerification.realistic) {
    score += 15;
  } else if (!discountVerification.tooGoodToBeTrue) {
    score += 8; // Partial credit if not too suspicious
  }

  // Description verification (5 points)
  if (descriptionVerification.relevant) {
    score += 5;
  }

  // Penalty for red flags (up to -10 points)
  const redFlagPenalty = Math.min(10, redFlagCount * 3);
  score -= redFlagPenalty;

  return Math.min(40, Math.max(0, score)); // Clamp between 0 and 40
}

/**
 * Check if red flag is critical
 */
function isCriticalRedFlag(flag: string): boolean {
  const criticalKeywords = [
    'fake',
    'scam',
    'counterfeit',
    'fraud',
    'suspicious',
    'too good to be true',
    'unrealistic',
    'impossible'
  ];

  const flagLower = flag.toLowerCase();
  return criticalKeywords.some(keyword => flagLower.includes(keyword));
}

/**
 * Create fallback result when AI is unavailable
 */
function createFallbackResult(
  product: VerifiableProduct,
  errorMessage?: string
): AIVerificationResult {
  console.log('[AI Verifier] Using fallback rule-based verification');

  // Use local validators as fallback
  const brandValidation = validateBrand(product.brand);

  return {
    passed: true,
    score: 20, // Reduced score for fallback
    layer: VerificationLayer.AI,
    brandVerification: {
      correct: brandValidation.valid,
      originalBrand: product.brand,
      correctedBrand: brandValidation.corrected,
      confidence: brandValidation.confidence,
      reasoning: brandValidation.suggestion || 'Brand validated locally'
    },
    categoryVerification: {
      accurate: true,
      originalCategory: product.category,
      confidence: 0.5,
      reasoning: 'Category not verified (AI unavailable)'
    },
    discountVerification: {
      realistic: product.discountPercentage >= 10 && product.discountPercentage <= 90,
      tooGoodToBeTrue: product.discountPercentage > 90,
      confidence: 0.5,
      reasoning: 'Discount verified using basic rules (AI unavailable)'
    },
    descriptionVerification: {
      relevant: true,
      matchesProduct: true,
      confidence: 0.5,
      reasoning: 'Description not verified (AI unavailable)'
    },
    redFlags: errorMessage ? [`AI verification unavailable: ${errorMessage}`] : [],
    aiConfidence: 50,
    reasoning: 'Fallback verification used due to AI unavailability',
    issues: [{
      severity: 'info',
      field: 'general',
      message: errorMessage || 'AI verification disabled or unavailable',
      suggestion: 'Enable AI verification for more accurate results'
    }],
    metadata: {
      fallback: true,
      errorMessage
    },
    timestamp: new Date()
  };
}

/**
 * Get AI verification summary
 */
export function getAiSummary(result: AIVerificationResult): string {
  const checks: string[] = [];

  if (result.brandVerification.correct) checks.push('Brand OK');
  else checks.push('Brand ISSUE');

  if (result.categoryVerification.accurate) checks.push('Category OK');
  else checks.push('Category ISSUE');

  if (result.discountVerification.realistic) checks.push('Discount OK');
  else checks.push('Discount SUSPICIOUS');

  const flagCount = result.redFlags.length;

  return `AI: ${checks.join(', ')}. ${flagCount} red flags. Confidence: ${result.aiConfidence}%. Score: ${result.score}/40`;
}
