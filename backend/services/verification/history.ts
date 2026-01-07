/**
 * Verification History Logging
 *
 * Logs all verification attempts to the database for audit trail
 */

import { PrismaClient, VerificationStatus } from '@prisma/client';
import prisma from '../../db/client';
import {
  CompleteVerificationResult,
  VerificationHistoryRecord,
  VerificationLayer
} from './types';

/**
 * Log verification to history table
 *
 * @param productId - Product ID
 * @param result - Complete verification result
 * @param previousScore - Previous confidence score
 * @returns Created history record ID
 */
export async function logVerification(
  productId: string,
  result: CompleteVerificationResult,
  previousScore: number
): Promise<string> {
  try {
    // Create history record
    const record = await prisma.verificationHistory.create({
      data: {
        productId,
        verificationType: 'full_verification',
        status: determineStatus(result),
        previousConfidence: previousScore,
        newConfidence: result.finalScore,
        metadata: {
          completeness: {
            score: result.completeness.score,
            passed: result.completeness.passed,
            completionPercentage: result.completeness.completionPercentage
          },
          quality: {
            score: result.quality.score,
            passed: result.quality.passed,
            urlAccessible: result.quality.urlCheck.accessible,
            imageValid: result.quality.imageCheck?.valid || false
          },
          ai: result.ai ? {
            score: result.ai.score,
            passed: result.ai.passed,
            aiConfidence: result.ai.aiConfidence,
            redFlagsCount: result.ai.redFlags.length
          } : null,
          confidence: {
            final: result.confidence.final,
            category: result.confidence.category
          },
          requiresReview: result.requiresReview,
          issuesCount: result.allIssues.length
        }
      }
    });

    console.log(`[History] Logged verification for product ${productId}: ${previousScore} -> ${result.finalScore}`);

    return record.id;

  } catch (error: any) {
    console.error(`[History] Error logging verification: ${error.message}`);
    throw error;
  }
}

/**
 * Log layer-specific verification
 *
 * @param productId - Product ID
 * @param layer - Verification layer
 * @param passed - Whether layer passed
 * @param score - Layer score
 * @param metadata - Additional metadata
 * @returns Created history record ID
 */
export async function logLayerVerification(
  productId: string,
  layer: VerificationLayer,
  passed: boolean,
  score: number,
  metadata?: Record<string, any>
): Promise<string> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { confidenceScore: true }
    });

    const record = await prisma.verificationHistory.create({
      data: {
        productId,
        verificationType: `${layer}_check`,
        status: passed ? VerificationStatus.success : VerificationStatus.failed,
        previousConfidence: product?.confidenceScore || 70,
        newConfidence: product?.confidenceScore || 70,
        metadata: {
          layer,
          score,
          ...metadata
        }
      }
    });

    return record.id;

  } catch (error: any) {
    console.error(`[History] Error logging layer verification: ${error.message}`);
    throw error;
  }
}

/**
 * Log URL verification
 *
 * @param productId - Product ID
 * @param url - URL checked
 * @param accessible - Whether URL was accessible
 * @param httpStatus - HTTP status code
 * @param responseTime - Response time in ms
 */
export async function logUrlCheck(
  productId: string,
  url: string,
  accessible: boolean,
  httpStatus?: number,
  responseTime?: number
): Promise<void> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { confidenceScore: true }
    });

    await prisma.verificationHistory.create({
      data: {
        productId,
        verificationType: 'url',
        status: accessible ? VerificationStatus.success : VerificationStatus.failed,
        httpStatus,
        responseTime,
        previousConfidence: product?.confidenceScore || 70,
        newConfidence: product?.confidenceScore || 70,
        metadata: {
          url,
          accessible
        }
      }
    });

  } catch (error: any) {
    console.error(`[History] Error logging URL check: ${error.message}`);
    // Don't throw - URL check logging is non-critical
  }
}

/**
 * Log image verification
 *
 * @param productId - Product ID
 * @param imageUrl - Image URL checked
 * @param valid - Whether image was valid
 * @param metadata - Additional metadata
 */
export async function logImageCheck(
  productId: string,
  imageUrl: string,
  valid: boolean,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { confidenceScore: true }
    });

    await prisma.verificationHistory.create({
      data: {
        productId,
        verificationType: 'image',
        status: valid ? VerificationStatus.success : VerificationStatus.failed,
        previousConfidence: product?.confidenceScore || 70,
        newConfidence: product?.confidenceScore || 70,
        metadata: {
          imageUrl,
          valid,
          ...metadata
        }
      }
    });

  } catch (error: any) {
    console.error(`[History] Error logging image check: ${error.message}`);
    // Don't throw - image check logging is non-critical
  }
}

/**
 * Log AI verification
 *
 * @param productId - Product ID
 * @param aiConfidence - AI confidence score
 * @param redFlags - Red flags found
 * @param responseTime - Response time in ms
 * @param tokensUsed - Tokens used in API call
 */
export async function logAiVerification(
  productId: string,
  aiConfidence: number,
  redFlags: string[],
  responseTime?: number,
  tokensUsed?: number
): Promise<void> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { confidenceScore: true }
    });

    await prisma.verificationHistory.create({
      data: {
        productId,
        verificationType: 'claude_vision',
        status: redFlags.length === 0 ? VerificationStatus.success : VerificationStatus.failed,
        responseTime,
        previousConfidence: product?.confidenceScore || 70,
        newConfidence: product?.confidenceScore || 70,
        metadata: {
          aiConfidence,
          redFlags,
          redFlagsCount: redFlags.length,
          tokensUsed
        }
      }
    });

  } catch (error: any) {
    console.error(`[History] Error logging AI verification: ${error.message}`);
    // Don't throw - AI logging is non-critical
  }
}

/**
 * Get verification history for a product
 *
 * @param productId - Product ID
 * @param limit - Maximum number of records to return
 * @returns Verification history records
 */
export async function getVerificationHistory(
  productId: string,
  limit: number = 10
): Promise<any[]> {
  try {
    const history = await prisma.verificationHistory.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return history;

  } catch (error: any) {
    console.error(`[History] Error fetching verification history: ${error.message}`);
    return [];
  }
}

/**
 * Get verification statistics
 *
 * @param startDate - Start date for statistics
 * @param endDate - End date for statistics
 * @returns Verification statistics
 */
export async function getVerificationStats(
  startDate?: Date,
  endDate?: Date
): Promise<{
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  averageResponseTime: number;
}> {
  try {
    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const records = await prisma.verificationHistory.findMany({
      where,
      select: {
        verificationType: true,
        status: true,
        responseTime: true
      }
    });

    const total = records.length;

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    for (const record of records) {
      byType[record.verificationType] = (byType[record.verificationType] || 0) + 1;
      byStatus[record.status] = (byStatus[record.status] || 0) + 1;

      if (record.responseTime) {
        totalResponseTime += record.responseTime;
        responseTimeCount++;
      }
    }

    const averageResponseTime = responseTimeCount > 0
      ? totalResponseTime / responseTimeCount
      : 0;

    return {
      total,
      byType,
      byStatus,
      averageResponseTime
    };

  } catch (error: any) {
    console.error(`[History] Error fetching verification stats: ${error.message}`);
    return {
      total: 0,
      byType: {},
      byStatus: {},
      averageResponseTime: 0
    };
  }
}

/**
 * Determine verification status from result
 */
function determineStatus(result: CompleteVerificationResult): VerificationStatus {
  if (!result.passed) {
    return VerificationStatus.failed;
  }

  if (result.requiresReview) {
    return VerificationStatus.quarantined;
  }

  return VerificationStatus.success;
}

/**
 * Clean old verification history
 *
 * @param daysToKeep - Number of days to keep history
 * @returns Number of records deleted
 */
export async function cleanOldHistory(daysToKeep: number = 90): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.verificationHistory.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });

    console.log(`[History] Cleaned ${result.count} old verification records`);

    return result.count;

  } catch (error: any) {
    console.error(`[History] Error cleaning old history: ${error.message}`);
    return 0;
  }
}
