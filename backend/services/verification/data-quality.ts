/**
 * Data Quality Checker - Layer 2 Verification
 *
 * Validates product data quality:
 * - URL accessibility (HTTP status)
 * - Image validity
 * - Price reasonableness
 * - Discount accuracy
 *
 * Score range: 80-89% (quality validation)
 * Base score: 0-30 points for this layer
 */

import {
  VerifiableProduct,
  QualityResult,
  VerificationIssue,
  VerificationLayer
} from './types';

import { validateUrl } from './validators/url-validator';
import { validateImage } from './validators/image-validator';
import { validatePrice, validateDiscount } from './validators/price-validator';

/**
 * Check data quality for a product
 *
 * @param product - Product to validate
 * @returns Quality validation result
 */
export async function checkDataQuality(
  product: VerifiableProduct
): Promise<QualityResult> {
  const issues: VerificationIssue[] = [];

  // Run all quality checks in parallel
  const [urlCheck, imageCheck, priceCheck, discountCheck] = await Promise.all([
    // URL validation
    validateUrl(product.productUrl, { timeout: 5000 }),

    // Image validation (if present)
    product.imageUrl
      ? validateImage(product.imageUrl, { timeout: 8000 })
      : Promise.resolve(undefined),

    // Price validation
    Promise.resolve(
      validatePrice(
        product.originalPrice,
        product.salePrice,
        product.discountPercentage
      )
    ),

    // Discount validation
    Promise.resolve(
      validateDiscount(
        product.originalPrice,
        product.salePrice,
        product.discountPercentage
      )
    )
  ]);

  // Generate issues from checks
  if (!urlCheck.accessible) {
    issues.push({
      severity: 'critical',
      field: 'productUrl',
      message: `Product URL not accessible: ${urlCheck.error}`,
      value: product.productUrl
    });
  } else if (urlCheck.httpStatus && urlCheck.httpStatus >= 400) {
    issues.push({
      severity: 'warning',
      field: 'productUrl',
      message: `Product URL returned HTTP ${urlCheck.httpStatus}`,
      value: product.productUrl
    });
  }

  if (urlCheck.redirectUrl) {
    issues.push({
      severity: 'info',
      field: 'productUrl',
      message: 'URL redirects to another location',
      value: urlCheck.redirectUrl,
      suggestion: 'Consider updating URL to final destination'
    });
  }

  if (imageCheck) {
    if (!imageCheck.accessible) {
      issues.push({
        severity: 'warning',
        field: 'imageUrl',
        message: `Image not accessible: ${imageCheck.error}`,
        value: product.imageUrl
      });
    } else if (!imageCheck.valid) {
      issues.push({
        severity: 'warning',
        field: 'imageUrl',
        message: `Image validation failed: ${imageCheck.error}`,
        value: product.imageUrl
      });
    }
  }

  if (!priceCheck.valid) {
    for (const issue of priceCheck.issues) {
      issues.push({
        severity: 'critical',
        field: 'price',
        message: issue,
        value: { originalPrice: product.originalPrice, salePrice: product.salePrice }
      });
    }
  } else if (!priceCheck.reasonable) {
    issues.push({
      severity: 'warning',
      field: 'price',
      message: 'Prices are valid but may be unreasonable for the category',
      value: { originalPrice: product.originalPrice, salePrice: product.salePrice }
    });
  }

  if (!discountCheck.valid) {
    issues.push({
      severity: 'warning',
      field: 'discountPercentage',
      message: `Discount mismatch: claimed ${discountCheck.claimed}%, calculated ${discountCheck.calculated.toFixed(1)}% (diff: ${discountCheck.difference.toFixed(1)}%)`,
      value: product.discountPercentage,
      suggestion: `Update discount to ${Math.round(discountCheck.calculated)}%`
    });
  }

  if (!discountCheck.realistic) {
    issues.push({
      severity: 'warning',
      field: 'discountPercentage',
      message: 'Discount percentage may be unrealistic (should be between 10% and 90%)',
      value: product.discountPercentage
    });
  }

  // Calculate quality score (0-30 points)
  const score = calculateQualityScore(
    urlCheck,
    imageCheck,
    priceCheck,
    discountCheck
  );

  // Product passes if URL is accessible and prices are valid
  const passed = urlCheck.accessible && priceCheck.valid;

  return {
    passed,
    score,
    layer: VerificationLayer.QUALITY,
    urlCheck,
    imageCheck,
    priceCheck,
    discountCheck,
    issues,
    metadata: {
      urlResponseTime: urlCheck.responseTime,
      hasValidImage: imageCheck?.valid || false,
      priceReasonable: priceCheck.reasonable,
      discountAccurate: discountCheck.valid
    },
    timestamp: new Date()
  };
}

/**
 * Calculate quality score (0-30 points)
 *
 * Scoring breakdown:
 * - URL accessible: 10 points
 * - Valid image: 5 points
 * - Valid prices: 10 points
 * - Accurate discount: 5 points
 * Maximum: 30 points
 */
function calculateQualityScore(
  urlCheck: any,
  imageCheck: any,
  priceCheck: any,
  discountCheck: any
): number {
  let score = 0;

  // URL accessibility (10 points)
  if (urlCheck.accessible) {
    score += 10;

    // Bonus for fast response
    if (urlCheck.responseTime && urlCheck.responseTime < 1000) {
      score += 1;
    }

    // Penalty for redirects
    if (urlCheck.redirectUrl) {
      score -= 1;
    }
  } else {
    // Partial credit if URL exists but has issues
    if (urlCheck.httpStatus && urlCheck.httpStatus < 500) {
      score += 3;
    }
  }

  // Image validation (5 points)
  if (imageCheck) {
    if (imageCheck.valid && imageCheck.accessible) {
      score += 5;
    } else if (imageCheck.accessible && !imageCheck.valid) {
      score += 2; // Partial credit for accessible but invalid
    }
  } else {
    // No penalty for missing image (it's optional)
    score += 2;
  }

  // Price validation (10 points)
  if (priceCheck.valid) {
    score += 8;

    if (priceCheck.reasonable) {
      score += 2; // Bonus for reasonable prices
    }
  } else {
    // Partial credit based on which checks passed
    const passedChecks = Object.values(priceCheck.checks).filter(Boolean).length;
    score += Math.round((passedChecks / 4) * 8);
  }

  // Discount validation (5 points)
  if (discountCheck.valid) {
    score += 3;

    if (discountCheck.realistic) {
      score += 2; // Bonus for realistic discount
    }
  } else {
    // Partial credit if close
    if (discountCheck.difference < 5) {
      score += 2;
    }
  }

  return Math.min(30, Math.max(0, score)); // Clamp between 0 and 30
}

/**
 * Get quality summary
 */
export function getQualitySummary(result: QualityResult): string {
  const parts: string[] = [];

  if (result.urlCheck.accessible) {
    parts.push(`URL OK (${result.urlCheck.responseTime}ms)`);
  } else {
    parts.push(`URL FAILED`);
  }

  if (result.imageCheck) {
    parts.push(result.imageCheck.valid ? 'Image OK' : 'Image FAILED');
  }

  parts.push(result.priceCheck.valid ? 'Price OK' : 'Price INVALID');
  parts.push(result.discountCheck.valid ? 'Discount OK' : 'Discount MISMATCH');

  const criticalIssues = result.issues.filter(i => i.severity === 'critical').length;

  return `Quality: ${parts.join(', ')}. ${criticalIssues} critical issues. Score: ${result.score}/30`;
}

/**
 * Quick quality check (URL only, for batch operations)
 *
 * @param productUrl - Product URL to check
 * @returns True if URL is accessible
 */
export async function quickQualityCheck(productUrl: string): Promise<boolean> {
  try {
    const result = await validateUrl(productUrl, { timeout: 3000 });
    return result.accessible;
  } catch {
    return false;
  }
}
