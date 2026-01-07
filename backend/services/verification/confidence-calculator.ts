/**
 * Confidence Score Calculator
 *
 * Calculates final confidence scores for products based on all verification layers
 * Score range: 70-99 (never 100%, always room for improvement)
 *
 * Scoring breakdown:
 * - Completeness (Layer 1): 0-30 points
 * - Quality (Layer 2): 0-30 points
 * - AI Verification (Layer 3): 0-40 points
 * - Bonus points: up to 20 points
 * Total: 70-99 points (capped at 99)
 */

import {
  ConfidenceScore,
  ScoreCategory,
  CompletenessResult,
  QualityResult,
  AIVerificationResult,
  VerifiableProduct
} from './types';

/**
 * Calculate final confidence score from all verification layers
 *
 * @param completeness - Layer 1 result
 * @param quality - Layer 2 result
 * @param ai - Layer 3 result (optional)
 * @param product - Product being verified
 * @returns Final confidence score breakdown
 */
export function calculateConfidenceScore(
  completeness: CompletenessResult,
  quality: QualityResult,
  ai: AIVerificationResult | undefined,
  product: VerifiableProduct
): ConfidenceScore {
  // Base scores from each layer
  const completenessScore = completeness.score; // 0-30
  const qualityScore = quality.score;           // 0-30
  const aiScore = ai ? ai.score : 0;            // 0-40

  // Calculate bonuses
  const bonuses = calculateBonusPoints(product, quality, ai);

  // Sum up scores
  let totalScore = completenessScore + qualityScore + aiScore +
    bonuses.hasReviews + bonuses.hasMultipleImages +
    bonuses.recentlyUpdated + bonuses.fromTrustedSource;

  // Ensure minimum score of 70 if all layers passed
  if (completeness.passed && quality.passed) {
    totalScore = Math.max(70, totalScore);
  }

  // Cap at 99 (never 100%)
  const finalScore = Math.min(99, totalScore);

  // Determine score category
  const category = getScoreCategory(finalScore);

  return {
    completeness: completenessScore,
    quality: qualityScore,
    aiVerification: aiScore,
    bonuses,
    final: finalScore,
    category
  };
}

/**
 * Calculate bonus points
 *
 * @param product - Product being verified
 * @param quality - Quality verification result
 * @param ai - AI verification result
 * @returns Bonus points breakdown
 */
function calculateBonusPoints(
  product: VerifiableProduct,
  quality: QualityResult,
  ai: AIVerificationResult | undefined
): {
  hasReviews: number;
  hasMultipleImages: number;
  recentlyUpdated: number;
  fromTrustedSource: number;
} {
  let hasReviews = 0;
  let hasMultipleImages = 0;
  let recentlyUpdated = 0;
  let fromTrustedSource = 0;

  // Bonus 1: Has reviews (would need to be tracked in product data)
  // For now, we'll skip this as it's not in the schema
  hasReviews = 0;

  // Bonus 2: Has multiple images (+5 points)
  if (quality.imageCheck?.valid && product.imageUrl) {
    hasMultipleImages = 5;
  }

  // Bonus 3: Recently updated (+5 points)
  const daysSinceUpdate = getDaysSince(product.updatedAt);
  if (daysSinceUpdate <= 7) {
    recentlyUpdated = 5;
  } else if (daysSinceUpdate <= 30) {
    recentlyUpdated = 3;
  }

  // Bonus 4: From trusted source (+5 points)
  const trustedSources = ['nike', 'adidas', 'zara', 'hm', 'uniqlo', 'mango'];
  if (trustedSources.includes(product.source)) {
    fromTrustedSource = 5;
  }

  // Additional bonus: AI verification passed with high confidence
  if (ai && ai.aiConfidence >= 90 && ai.redFlags.length === 0) {
    fromTrustedSource += 3; // Extra trust bonus
  }

  return {
    hasReviews,
    hasMultipleImages,
    recentlyUpdated,
    fromTrustedSource: Math.min(8, fromTrustedSource) // Cap at 8
  };
}

/**
 * Get score category
 */
function getScoreCategory(score: number): ScoreCategory {
  if (score < 70) return ScoreCategory.REJECTED;
  if (score < 85) return ScoreCategory.REQUIRES_REVIEW;
  if (score < 95) return ScoreCategory.ACCEPTABLE;
  return ScoreCategory.HIGH_CONFIDENCE;
}

/**
 * Get days since a date
 */
function getDaysSince(date: Date): number {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Determine if product requires manual review
 *
 * @param score - Confidence score
 * @param completeness - Completeness result
 * @param quality - Quality result
 * @param ai - AI verification result
 * @returns True if manual review required
 */
export function requiresManualReview(
  score: ConfidenceScore,
  completeness: CompletenessResult,
  quality: QualityResult,
  ai: AIVerificationResult | undefined
): boolean {
  // Automatic review if score is below threshold
  const reviewThreshold = parseInt(process.env.MANUAL_REVIEW_THRESHOLD || '85', 10);

  if (score.final < reviewThreshold) {
    return true;
  }

  // Review if any critical issues found
  const hasCriticalIssues =
    completeness.issues.some(i => i.severity === 'critical') ||
    quality.issues.some(i => i.severity === 'critical') ||
    (ai && ai.issues.some(i => i.severity === 'critical'));

  if (hasCriticalIssues) {
    return true;
  }

  // Review if AI detected red flags
  if (ai && ai.redFlags.length > 0) {
    return true;
  }

  // Review if price is suspiciously low or high
  if (!quality.priceCheck.reasonable) {
    return true;
  }

  return false;
}

/**
 * Get confidence score summary
 *
 * @param score - Confidence score
 * @returns Human-readable summary
 */
export function getScoreSummary(score: ConfidenceScore): string {
  const breakdown = [
    `Completeness: ${score.completeness}/30`,
    `Quality: ${score.quality}/30`,
    `AI: ${score.aiVerification}/40`,
    `Bonuses: ${Object.values(score.bonuses).reduce((a, b) => a + b, 0)}`
  ].join(', ');

  return `Final Score: ${score.final}/99 (${score.category}) - ${breakdown}`;
}

/**
 * Calculate score trend over time
 *
 * @param currentScore - Current confidence score
 * @param previousScore - Previous confidence score
 * @returns Score trend information
 */
export function calculateScoreTrend(
  currentScore: number,
  previousScore: number
): {
  direction: 'up' | 'down' | 'stable';
  change: number;
  changePercent: number;
} {
  const change = currentScore - previousScore;
  const changePercent = previousScore > 0
    ? (change / previousScore) * 100
    : 0;

  let direction: 'up' | 'down' | 'stable' = 'stable';

  if (Math.abs(change) >= 2) {
    direction = change > 0 ? 'up' : 'down';
  }

  return {
    direction,
    change,
    changePercent
  };
}

/**
 * Predict confidence score without running full verification
 * (Quick estimation based on basic product data)
 *
 * @param product - Product to estimate
 * @returns Estimated confidence score
 */
export function estimateConfidenceScore(product: VerifiableProduct): number {
  let score = 70; // Base score

  // Check required fields
  if (product.name && product.brand && product.productUrl) {
    score += 10;
  }

  // Check optional fields
  if (product.imageUrl) score += 5;
  if (product.description) score += 5;

  // Check prices
  if (product.originalPrice > 0 && product.salePrice > 0 && product.salePrice < product.originalPrice) {
    score += 10;
  }

  // Check discount
  if (product.discountPercentage >= 10 && product.discountPercentage <= 90) {
    score += 5;
  }

  // Recent update bonus
  const daysSinceUpdate = getDaysSince(product.updatedAt);
  if (daysSinceUpdate <= 7) {
    score += 3;
  }

  return Math.min(95, score); // Cap at 95 for estimates
}

/**
 * Calculate confidence score statistics for a batch of products
 *
 * @param scores - Array of confidence scores
 * @returns Statistical summary
 */
export function calculateScoreStatistics(scores: number[]): {
  average: number;
  median: number;
  min: number;
  max: number;
  distribution: {
    rejected: number;
    requiresReview: number;
    acceptable: number;
    highConfidence: number;
  };
} {
  if (scores.length === 0) {
    return {
      average: 0,
      median: 0,
      min: 0,
      max: 0,
      distribution: {
        rejected: 0,
        requiresReview: 0,
        acceptable: 0,
        highConfidence: 0
      }
    };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  const distribution = {
    rejected: scores.filter(s => s < 70).length,
    requiresReview: scores.filter(s => s >= 70 && s < 85).length,
    acceptable: scores.filter(s => s >= 85 && s < 95).length,
    highConfidence: scores.filter(s => s >= 95).length
  };

  return {
    average,
    median,
    min,
    max,
    distribution
  };
}

/**
 * Recommend actions based on confidence score
 *
 * @param score - Confidence score
 * @param completeness - Completeness result
 * @param quality - Quality result
 * @param ai - AI verification result
 * @returns Recommended actions
 */
export function recommendActions(
  score: ConfidenceScore,
  completeness: CompletenessResult,
  quality: QualityResult,
  ai: AIVerificationResult | undefined
): string[] {
  const actions: string[] = [];

  if (score.final < 70) {
    actions.push('REJECT: Product does not meet minimum quality standards');
  }

  if (score.final < 85) {
    actions.push('REVIEW: Manual review recommended before publishing');
  }

  // Specific recommendations based on issues
  if (!completeness.passed) {
    actions.push('Add missing required fields to improve score');
  }

  if (!quality.passed) {
    if (!quality.urlCheck.accessible) {
      actions.push('Fix or update product URL - currently not accessible');
    }

    if (!quality.priceCheck.valid) {
      actions.push('Correct pricing information');
    }
  }

  if (ai) {
    if (!ai.brandVerification.correct && ai.brandVerification.correctedBrand) {
      actions.push(`Update brand name to: ${ai.brandVerification.correctedBrand}`);
    }

    if (!ai.categoryVerification.accurate && ai.categoryVerification.suggestedCategory) {
      actions.push(`Update category to: ${ai.categoryVerification.suggestedCategory}`);
    }

    if (ai.redFlags.length > 0) {
      actions.push(`Address red flags: ${ai.redFlags.join(', ')}`);
    }
  }

  // Improvement suggestions
  if (!completeness.optionalFields.find(f => f.field === 'imageUrl')?.valid) {
    actions.push('Add product image to improve quality');
  }

  if (!completeness.optionalFields.find(f => f.field === 'description')?.valid) {
    actions.push('Add product description to improve confidence');
  }

  if (actions.length === 0) {
    actions.push('Product passes all checks - ready for publishing');
  }

  return actions;
}
