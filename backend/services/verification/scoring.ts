/**
 * Product Scoring
 *
 * Updates product confidence scores in the database
 */

import prisma from '../../db/client';
import { ConfidenceScore, ScoreCategory } from './types';

/**
 * Update product confidence score
 *
 * @param productId - Product ID
 * @param score - Confidence score
 * @returns Updated product
 */
export async function updateProductScore(
  productId: string,
  score: number
): Promise<void> {
  try {
    // Ensure score is within valid range (70-99)
    const validScore = Math.max(70, Math.min(99, Math.round(score)));

    await prisma.product.update({
      where: { id: productId },
      data: {
        confidenceScore: validScore,
        lastVerifiedAt: new Date()
      }
    });

    console.log(`[Scoring] Updated product ${productId} score to ${validScore}`);

  } catch (error: any) {
    console.error(`[Scoring] Error updating product score: ${error.message}`);
    throw error;
  }
}

/**
 * Update product with verification results
 *
 * @param productId - Product ID
 * @param score - Confidence score breakdown
 * @param corrections - Suggested corrections
 */
export async function updateProductWithVerification(
  productId: string,
  score: ConfidenceScore,
  corrections?: {
    brand?: string;
    category?: string;
  }
): Promise<void> {
  try {
    const updateData: any = {
      confidenceScore: score.final,
      lastVerifiedAt: new Date()
    };

    // Apply corrections if provided and score is high enough
    if (corrections && score.final >= 85) {
      if (corrections.brand) {
        updateData.brand = corrections.brand;
      }

      if (corrections.category) {
        updateData.category = corrections.category;
      }
    }

    // Deactivate product if score is too low
    if (score.final < 70) {
      updateData.isActive = false;
    }

    await prisma.product.update({
      where: { id: productId },
      data: updateData
    });

    console.log(`[Scoring] Updated product ${productId} with verification results`);

  } catch (error: any) {
    console.error(`[Scoring] Error updating product with verification: ${error.message}`);
    throw error;
  }
}

/**
 * Get products by score category
 *
 * @param category - Score category
 * @param limit - Maximum number of products to return
 * @returns Products in the category
 */
export async function getProductsByScoreCategory(
  category: ScoreCategory,
  limit: number = 100
): Promise<any[]> {
  try {
    const scoreRanges: Record<ScoreCategory, { min: number; max: number }> = {
      [ScoreCategory.REJECTED]: { min: 0, max: 69 },
      [ScoreCategory.REQUIRES_REVIEW]: { min: 70, max: 84 },
      [ScoreCategory.ACCEPTABLE]: { min: 85, max: 94 },
      [ScoreCategory.HIGH_CONFIDENCE]: { min: 95, max: 99 }
    };

    const range = scoreRanges[category];

    const products = await prisma.product.findMany({
      where: {
        confidenceScore: {
          gte: range.min,
          lte: range.max
        }
      },
      orderBy: {
        confidenceScore: 'asc'
      },
      take: limit
    });

    return products;

  } catch (error: any) {
    console.error(`[Scoring] Error fetching products by category: ${error.message}`);
    return [];
  }
}

/**
 * Get products requiring review
 *
 * @param limit - Maximum number of products to return
 * @returns Products requiring manual review
 */
export async function getProductsRequiringReview(limit: number = 50): Promise<any[]> {
  try {
    const reviewThreshold = parseInt(process.env.MANUAL_REVIEW_THRESHOLD || '85', 10);

    const products = await prisma.product.findMany({
      where: {
        confidenceScore: {
          lt: reviewThreshold
        },
        isActive: true
      },
      orderBy: {
        confidenceScore: 'asc'
      },
      take: limit,
      include: {
        verificationHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    return products;

  } catch (error: any) {
    console.error(`[Scoring] Error fetching products requiring review: ${error.message}`);
    return [];
  }
}

/**
 * Get products needing re-verification
 *
 * @param daysSinceLastVerification - Days since last verification
 * @param limit - Maximum number of products to return
 * @returns Products needing re-verification
 */
export async function getProductsNeedingReverification(
  daysSinceLastVerification: number = 30,
  limit: number = 100
): Promise<any[]> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastVerification);

    const products = await prisma.product.findMany({
      where: {
        OR: [
          { lastVerifiedAt: null },
          { lastVerifiedAt: { lt: cutoffDate } }
        ],
        isActive: true
      },
      orderBy: {
        lastVerifiedAt: 'asc'
      },
      take: limit
    });

    return products;

  } catch (error: any) {
    console.error(`[Scoring] Error fetching products needing reverification: ${error.message}`);
    return [];
  }
}

/**
 * Get score distribution statistics
 *
 * @returns Score distribution
 */
export async function getScoreDistribution(): Promise<{
  total: number;
  byCategory: Record<ScoreCategory, number>;
  average: number;
  median: number;
}> {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { confidenceScore: true }
    });

    const scores = products.map(p => p.confidenceScore);
    const total = scores.length;

    if (total === 0) {
      return {
        total: 0,
        byCategory: {
          [ScoreCategory.REJECTED]: 0,
          [ScoreCategory.REQUIRES_REVIEW]: 0,
          [ScoreCategory.ACCEPTABLE]: 0,
          [ScoreCategory.HIGH_CONFIDENCE]: 0
        },
        average: 0,
        median: 0
      };
    }

    const byCategory = {
      [ScoreCategory.REJECTED]: scores.filter(s => s < 70).length,
      [ScoreCategory.REQUIRES_REVIEW]: scores.filter(s => s >= 70 && s < 85).length,
      [ScoreCategory.ACCEPTABLE]: scores.filter(s => s >= 85 && s < 95).length,
      [ScoreCategory.HIGH_CONFIDENCE]: scores.filter(s => s >= 95).length
    };

    const average = scores.reduce((sum, s) => sum + s, 0) / total;

    const sorted = [...scores].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    return {
      total,
      byCategory,
      average,
      median
    };

  } catch (error: any) {
    console.error(`[Scoring] Error fetching score distribution: ${error.message}`);
    return {
      total: 0,
      byCategory: {
        [ScoreCategory.REJECTED]: 0,
        [ScoreCategory.REQUIRES_REVIEW]: 0,
        [ScoreCategory.ACCEPTABLE]: 0,
        [ScoreCategory.HIGH_CONFIDENCE]: 0
      },
      average: 0,
      median: 0
    };
  }
}

/**
 * Bulk update scores for multiple products
 *
 * @param updates - Array of product ID and score pairs
 * @returns Number of products updated
 */
export async function bulkUpdateScores(
  updates: Array<{ productId: string; score: number }>
): Promise<number> {
  try {
    let updated = 0;

    // Update in transaction
    await prisma.$transaction(
      updates.map(({ productId, score }) =>
        prisma.product.update({
          where: { id: productId },
          data: {
            confidenceScore: Math.max(70, Math.min(99, Math.round(score))),
            lastVerifiedAt: new Date()
          }
        })
      )
    );

    updated = updates.length;

    console.log(`[Scoring] Bulk updated ${updated} product scores`);

    return updated;

  } catch (error: any) {
    console.error(`[Scoring] Error bulk updating scores: ${error.message}`);
    return 0;
  }
}

/**
 * Reset scores for products from a specific source
 *
 * @param source - Product source
 * @param defaultScore - Default score to set
 * @returns Number of products reset
 */
export async function resetScoresBySource(
  source: string,
  defaultScore: number = 70
): Promise<number> {
  try {
    const result = await prisma.product.updateMany({
      where: { source: source as any },
      data: {
        confidenceScore: defaultScore,
        lastVerifiedAt: null
      }
    });

    console.log(`[Scoring] Reset ${result.count} product scores for source: ${source}`);

    return result.count;

  } catch (error: any) {
    console.error(`[Scoring] Error resetting scores by source: ${error.message}`);
    return 0;
  }
}
