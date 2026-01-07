/**
 * Verification Manager
 *
 * Main orchestrator for product verification system
 * Coordinates all verification layers and manages the workflow
 */

import prisma from '../../db/client';
import {
  VerifiableProduct,
  CompleteVerificationResult,
  BatchVerificationResult,
  VerificationStats,
  VerificationIssue
} from './types';

import { checkDataCompleteness, getCompletenessSummary } from './data-completeness';
import { checkDataQuality, getQualitySummary } from './data-quality';
import { verifyWithAI, getAiSummary } from './ai-verifier';
import {
  calculateConfidenceScore,
  requiresManualReview,
  getScoreSummary,
  recommendActions
} from './confidence-calculator';
import { logVerification } from './history';
import { updateProductScore, updateProductWithVerification } from './scoring';

/**
 * Verify a single product through all layers
 *
 * @param productId - Product ID or full product object
 * @param options - Verification options
 * @returns Complete verification result
 */
export async function verifyProduct(
  productId: string | VerifiableProduct,
  options: {
    useAi?: boolean;
    updateDatabase?: boolean;
    logHistory?: boolean;
  } = {}
): Promise<CompleteVerificationResult> {
  const {
    useAi = true,
    updateDatabase = true,
    logHistory = true
  } = options;

  const startTime = Date.now();

  try {
    // Fetch product if ID provided
    let product: VerifiableProduct;

    if (typeof productId === 'string') {
      const fetchedProduct = await prisma.product.findUnique({
        where: { id: productId }
      });

      if (!fetchedProduct) {
        throw new Error(`Product not found: ${productId}`);
      }

      product = fetchedProduct as unknown as VerifiableProduct;
    } else {
      product = productId;
    }

    console.log(`\n[Verification Manager] Starting verification for product: ${product.id}`);
    console.log(`  ${product.brand} - ${product.name}`);

    const previousScore = product.confidenceScore;

    // Layer 1: Data Completeness (fast)
    console.log('  Layer 1: Checking data completeness...');
    const completeness = await checkDataCompleteness(product);
    console.log(`  ${getCompletenessSummary(completeness)}`);

    // Layer 2: Data Quality (2-5 seconds)
    console.log('  Layer 2: Checking data quality...');
    const quality = await checkDataQuality(product);
    console.log(`  ${getQualitySummary(quality)}`);

    // Layer 3: AI Verification (1-3 seconds) - only if previous layers passed minimum threshold
    let ai;
    const preliminaryScore = completeness.score + quality.score;

    if (preliminaryScore >= 40 && useAi) {
      console.log('  Layer 3: Running AI verification...');
      ai = await verifyWithAI(product, true);
      console.log(`  ${getAiSummary(ai)}`);
    } else if (!useAi) {
      console.log('  Layer 3: Skipped (AI disabled)');
    } else {
      console.log('  Layer 3: Skipped (preliminary score too low)');
    }

    // Calculate final confidence score
    const confidence = calculateConfidenceScore(completeness, quality, ai, product);
    console.log(`  ${getScoreSummary(confidence)}`);

    // Determine if product passed
    const passed = completeness.passed && quality.passed && confidence.final >= 70;

    // Determine if manual review required
    const needsReview = requiresManualReview(confidence, completeness, quality, ai);

    // Collect all issues
    const allIssues: VerificationIssue[] = [
      ...completeness.issues,
      ...quality.issues,
      ...(ai?.issues || [])
    ];

    // Generate summary
    const summary = generateSummary(completeness, quality, ai, confidence, allIssues);

    // Build complete result
    const result: CompleteVerificationResult = {
      productId: product.id,
      completeness,
      quality,
      ai,
      confidence,
      finalScore: confidence.final,
      passed,
      requiresReview: needsReview,
      allIssues,
      summary,
      verifiedAt: new Date()
    };

    // Update database if requested
    if (updateDatabase) {
      await updateProductScore(product.id, confidence.final);

      // Apply corrections if AI suggested them
      if (ai && confidence.final >= 85) {
        const corrections: any = {};

        if (!ai.brandVerification.correct && ai.brandVerification.correctedBrand) {
          corrections.brand = ai.brandVerification.correctedBrand;
        }

        if (!ai.categoryVerification.accurate && ai.categoryVerification.suggestedCategory) {
          corrections.category = ai.categoryVerification.suggestedCategory;
        }

        if (Object.keys(corrections).length > 0) {
          await updateProductWithVerification(product.id, confidence, corrections);
          console.log('  Applied corrections:', corrections);
        }
      }
    }

    // Log to history if requested
    if (logHistory) {
      await logVerification(product.id, result, previousScore);
    }

    const duration = Date.now() - startTime;
    console.log(`  Verification completed in ${duration}ms`);
    console.log(`  Final score: ${confidence.final}/99 (${confidence.category})`);
    console.log(`  Status: ${passed ? 'PASSED' : 'FAILED'}${needsReview ? ' - REVIEW REQUIRED' : ''}\n`);

    return result;

  } catch (error: any) {
    console.error(`[Verification Manager] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Verify multiple products in batch
 *
 * @param productIds - Array of product IDs
 * @param options - Verification options
 * @returns Batch verification result
 */
export async function verifyBatch(
  productIds: string[],
  options: {
    useAi?: boolean;
    updateDatabase?: boolean;
    logHistory?: boolean;
    batchSize?: number;
  } = {}
): Promise<BatchVerificationResult> {
  const {
    batchSize = parseInt(process.env.VERIFICATION_BATCH_SIZE || '10', 10)
  } = options;

  const startTime = Date.now();

  console.log(`\n[Batch Verification] Starting batch verification for ${productIds.length} products`);
  console.log(`  Batch size: ${batchSize}`);

  const results: CompleteVerificationResult[] = [];
  let processed = 0;
  let passed = 0;
  let failed = 0;
  let requiresReview = 0;

  // Process in batches to avoid overwhelming the system
  for (let i = 0; i < productIds.length; i += batchSize) {
    const batch = productIds.slice(i, i + batchSize);
    console.log(`\n  Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(productIds.length / batchSize)}`);

    // Verify products in parallel within batch
    const batchResults = await Promise.allSettled(
      batch.map(id => verifyProduct(id, options))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
        processed++;

        if (result.value.passed) {
          passed++;
        } else {
          failed++;
        }

        if (result.value.requiresReview) {
          requiresReview++;
        }
      } else {
        console.error(`  Failed to verify product: ${result.reason}`);
        failed++;
      }
    }

    // Rate limiting delay between batches
    if (i + batchSize < productIds.length) {
      await sleep(1000);
    }
  }

  // Calculate statistics
  const stats = calculateStats(results);
  const duration = Date.now() - startTime;

  console.log(`\n[Batch Verification] Completed in ${duration}ms`);
  console.log(`  Total: ${productIds.length}`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Requires Review: ${requiresReview}`);
  console.log(`  Average Score: ${stats.averageScore.toFixed(1)}/99`);

  return {
    total: productIds.length,
    processed,
    passed,
    failed,
    requiresReview,
    results,
    stats,
    duration
  };
}

/**
 * Re-verify products that haven't been verified recently
 *
 * @param daysSinceLastVerification - Days since last verification
 * @param limit - Maximum number of products to verify
 * @param options - Verification options
 * @returns Batch verification result
 */
export async function reverifyOutdatedProducts(
  daysSinceLastVerification: number = 30,
  limit: number = 100,
  options: {
    useAi?: boolean;
    updateDatabase?: boolean;
    logHistory?: boolean;
  } = {}
): Promise<BatchVerificationResult> {
  console.log(`[Reverification] Finding products not verified in ${daysSinceLastVerification} days...`);

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
    take: limit,
    select: { id: true }
  });

  console.log(`Found ${products.length} products needing reverification`);

  return verifyBatch(products.map(p => p.id), options);
}

/**
 * Generate verification summary
 */
function generateSummary(
  completeness: any,
  quality: any,
  ai: any,
  confidence: any,
  allIssues: VerificationIssue[]
): string {
  const parts: string[] = [];

  parts.push(`Score: ${confidence.final}/99 (${confidence.category})`);

  const criticalIssues = allIssues.filter(i => i.severity === 'critical').length;
  const warnings = allIssues.filter(i => i.severity === 'warning').length;

  if (criticalIssues > 0) {
    parts.push(`${criticalIssues} critical issues`);
  }

  if (warnings > 0) {
    parts.push(`${warnings} warnings`);
  }

  if (ai && ai.redFlags.length > 0) {
    parts.push(`${ai.redFlags.length} red flags`);
  }

  if (criticalIssues === 0 && warnings === 0) {
    parts.push('All checks passed');
  }

  return parts.join(', ');
}

/**
 * Calculate statistics from verification results
 */
function calculateStats(results: CompleteVerificationResult[]): VerificationStats {
  if (results.length === 0) {
    return {
      averageScore: 0,
      scoreDistribution: {
        rejected: 0,
        requiresReview: 0,
        acceptable: 0,
        highConfidence: 0
      },
      commonIssues: new Map(),
      layerPerformance: {
        completeness: { averageScore: 0, passRate: 0 },
        quality: { averageScore: 0, passRate: 0 },
        ai: { averageScore: 0, passRate: 0, averageResponseTime: 0 }
      }
    };
  }

  const scores = results.map(r => r.finalScore);
  const averageScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

  const scoreDistribution = {
    rejected: results.filter(r => r.finalScore < 70).length,
    requiresReview: results.filter(r => r.finalScore >= 70 && r.finalScore < 85).length,
    acceptable: results.filter(r => r.finalScore >= 85 && r.finalScore < 95).length,
    highConfidence: results.filter(r => r.finalScore >= 95).length
  };

  // Collect common issues
  const commonIssues = new Map<string, number>();
  for (const result of results) {
    for (const issue of result.allIssues) {
      const key = `${issue.field}: ${issue.message}`;
      commonIssues.set(key, (commonIssues.get(key) || 0) + 1);
    }
  }

  // Calculate layer performance
  const completenessScores = results.map(r => r.completeness.score);
  const qualityScores = results.map(r => r.quality.score);
  const aiScores = results.filter(r => r.ai).map(r => r.ai!.score);
  const aiResponseTimes = results
    .filter(r => r.ai?.metadata?.responseTime)
    .map(r => r.ai!.metadata!.responseTime as number);

  const layerPerformance = {
    completeness: {
      averageScore: completenessScores.reduce((sum, s) => sum + s, 0) / completenessScores.length,
      passRate: results.filter(r => r.completeness.passed).length / results.length
    },
    quality: {
      averageScore: qualityScores.reduce((sum, s) => sum + s, 0) / qualityScores.length,
      passRate: results.filter(r => r.quality.passed).length / results.length
    },
    ai: {
      averageScore: aiScores.length > 0
        ? aiScores.reduce((sum, s) => sum + s, 0) / aiScores.length
        : 0,
      passRate: results.filter(r => r.ai?.passed).length / Math.max(1, results.filter(r => r.ai).length),
      averageResponseTime: aiResponseTimes.length > 0
        ? aiResponseTimes.reduce((sum, t) => sum + t, 0) / aiResponseTimes.length
        : 0
    }
  };

  return {
    averageScore,
    scoreDistribution,
    commonIssues,
    layerPerformance
  };
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get verification recommendations for a product
 *
 * @param productId - Product ID
 * @returns Recommended actions
 */
export async function getVerificationRecommendations(
  productId: string
): Promise<string[]> {
  const result = await verifyProduct(productId, {
    useAi: true,
    updateDatabase: false,
    logHistory: false
  });

  return recommendActions(
    result.confidence,
    result.completeness,
    result.quality,
    result.ai
  );
}

/**
 * Export verification manager functions
 */
export default {
  verifyProduct,
  verifyBatch,
  reverifyOutdatedProducts,
  getVerificationRecommendations
};
