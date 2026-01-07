/**
 * Tests for Confidence Calculator
 */

import {
  calculateConfidenceScore,
  requiresManualReview,
  getScoreSummary,
  estimateConfidenceScore,
  calculateScoreStatistics,
  recommendActions
} from '../confidence-calculator';

import {
  VerifiableProduct,
  CompletenessResult,
  QualityResult,
  AIVerificationResult,
  VerificationLayer,
  ScoreCategory,
  ProductCategory,
  ProductSource
} from '../types';

// Mock product data
const mockProduct: VerifiableProduct = {
  id: 'test-1',
  name: 'Test Nike Shoes',
  brand: 'Nike',
  category: ProductCategory.shoes,
  source: ProductSource.nike,
  originalPrice: 100,
  salePrice: 70,
  discountPercentage: 30,
  currency: 'EUR',
  productUrl: 'https://example.com/product',
  imageUrl: 'https://example.com/image.jpg',
  description: 'Great running shoes',
  attributes: { size: '42', color: 'black' },
  confidenceScore: 70,
  isActive: true,
  lastVerifiedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date()
};

// Mock completeness result
const mockCompleteness: CompletenessResult = {
  passed: true,
  score: 25,
  layer: VerificationLayer.COMPLETENESS,
  requiredFields: [],
  optionalFields: [],
  completionPercentage: 90,
  issues: [],
  timestamp: new Date()
};

// Mock quality result
const mockQuality: QualityResult = {
  passed: true,
  score: 25,
  layer: VerificationLayer.QUALITY,
  urlCheck: { accessible: true, httpStatus: 200, responseTime: 500 },
  imageCheck: { valid: true, accessible: true },
  priceCheck: {
    valid: true,
    reasonable: true,
    issues: [],
    checks: {
      positiveValues: true,
      saleLessThanOriginal: true,
      withinReasonableRange: true,
      discountMatchesCalculated: true
    }
  },
  discountCheck: {
    valid: true,
    calculated: 30,
    claimed: 30,
    difference: 0,
    realistic: true
  },
  issues: [],
  timestamp: new Date()
};

// Mock AI result
const mockAI: AIVerificationResult = {
  passed: true,
  score: 35,
  layer: VerificationLayer.AI,
  brandVerification: {
    correct: true,
    originalBrand: 'Nike',
    confidence: 1.0,
    reasoning: 'Brand is correct'
  },
  categoryVerification: {
    accurate: true,
    originalCategory: ProductCategory.shoes,
    confidence: 1.0,
    reasoning: 'Category is accurate'
  },
  discountVerification: {
    realistic: true,
    tooGoodToBeTrue: false,
    confidence: 1.0,
    reasoning: 'Discount is realistic'
  },
  descriptionVerification: {
    relevant: true,
    matchesProduct: true,
    confidence: 1.0,
    reasoning: 'Description matches'
  },
  redFlags: [],
  aiConfidence: 95,
  reasoning: 'All checks passed',
  issues: [],
  timestamp: new Date()
};

describe('Confidence Calculator', () => {
  describe('calculateConfidenceScore', () => {
    it('should calculate score correctly with all layers', () => {
      const score = calculateConfidenceScore(
        mockCompleteness,
        mockQuality,
        mockAI,
        mockProduct
      );

      expect(score.final).toBeGreaterThanOrEqual(70);
      expect(score.final).toBeLessThanOrEqual(99);
      expect(score.completeness).toBe(25);
      expect(score.quality).toBe(25);
      expect(score.aiVerification).toBe(35);
    });

    it('should calculate score without AI layer', () => {
      const score = calculateConfidenceScore(
        mockCompleteness,
        mockQuality,
        undefined,
        mockProduct
      );

      expect(score.final).toBeGreaterThanOrEqual(70);
      expect(score.aiVerification).toBe(0);
    });

    it('should cap score at 99', () => {
      const highCompleteness = { ...mockCompleteness, score: 30 };
      const highQuality = { ...mockQuality, score: 30 };
      const highAI = { ...mockAI, score: 40 };

      const score = calculateConfidenceScore(
        highCompleteness,
        highQuality,
        highAI,
        mockProduct
      );

      expect(score.final).toBeLessThanOrEqual(99);
    });

    it('should ensure minimum score of 70 when passed', () => {
      const lowCompleteness = { ...mockCompleteness, score: 20, passed: true };
      const lowQuality = { ...mockQuality, score: 20, passed: true };

      const score = calculateConfidenceScore(
        lowCompleteness,
        lowQuality,
        undefined,
        mockProduct
      );

      expect(score.final).toBeGreaterThanOrEqual(70);
    });

    it('should assign correct score category', () => {
      const highScore = { ...mockCompleteness, score: 30 };

      const score = calculateConfidenceScore(
        highScore,
        mockQuality,
        mockAI,
        mockProduct
      );

      if (score.final < 70) {
        expect(score.category).toBe(ScoreCategory.REJECTED);
      } else if (score.final < 85) {
        expect(score.category).toBe(ScoreCategory.REQUIRES_REVIEW);
      } else if (score.final < 95) {
        expect(score.category).toBe(ScoreCategory.ACCEPTABLE);
      } else {
        expect(score.category).toBe(ScoreCategory.HIGH_CONFIDENCE);
      }
    });
  });

  describe('requiresManualReview', () => {
    it('should require review for low scores', () => {
      const lowScore = {
        completeness: 15,
        quality: 15,
        aiVerification: 20,
        bonuses: { hasReviews: 0, hasMultipleImages: 0, recentlyUpdated: 0, fromTrustedSource: 0 },
        final: 75,
        category: ScoreCategory.REQUIRES_REVIEW
      };

      const needsReview = requiresManualReview(
        lowScore,
        mockCompleteness,
        mockQuality,
        mockAI
      );

      expect(needsReview).toBe(true);
    });

    it('should require review for critical issues', () => {
      const completenessWithIssues = {
        ...mockCompleteness,
        issues: [{
          severity: 'critical' as const,
          field: 'price',
          message: 'Invalid price'
        }]
      };

      const score = {
        completeness: 25,
        quality: 25,
        aiVerification: 35,
        bonuses: { hasReviews: 0, hasMultipleImages: 5, recentlyUpdated: 0, fromTrustedSource: 5 },
        final: 90,
        category: ScoreCategory.ACCEPTABLE
      };

      const needsReview = requiresManualReview(
        score,
        completenessWithIssues,
        mockQuality,
        mockAI
      );

      expect(needsReview).toBe(true);
    });

    it('should require review for AI red flags', () => {
      const aiWithFlags = {
        ...mockAI,
        redFlags: ['Suspicious discount']
      };

      const score = {
        completeness: 25,
        quality: 25,
        aiVerification: 30,
        bonuses: { hasReviews: 0, hasMultipleImages: 5, recentlyUpdated: 0, fromTrustedSource: 5 },
        final: 85,
        category: ScoreCategory.ACCEPTABLE
      };

      const needsReview = requiresManualReview(
        score,
        mockCompleteness,
        mockQuality,
        aiWithFlags
      );

      expect(needsReview).toBe(true);
    });

    it('should not require review for high confidence products', () => {
      const highScore = {
        completeness: 30,
        quality: 30,
        aiVerification: 40,
        bonuses: { hasReviews: 0, hasMultipleImages: 5, recentlyUpdated: 5, fromTrustedSource: 5 },
        final: 97,
        category: ScoreCategory.HIGH_CONFIDENCE
      };

      const needsReview = requiresManualReview(
        highScore,
        mockCompleteness,
        mockQuality,
        mockAI
      );

      expect(needsReview).toBe(false);
    });
  });

  describe('getScoreSummary', () => {
    it('should generate readable summary', () => {
      const score = {
        completeness: 25,
        quality: 25,
        aiVerification: 35,
        bonuses: { hasReviews: 0, hasMultipleImages: 5, recentlyUpdated: 0, fromTrustedSource: 5 },
        final: 90,
        category: ScoreCategory.ACCEPTABLE
      };

      const summary = getScoreSummary(score);

      expect(summary).toContain('90/99');
      expect(summary).toContain('acceptable');
      expect(summary).toContain('Completeness: 25/30');
    });
  });

  describe('estimateConfidenceScore', () => {
    it('should estimate score for complete product', () => {
      const estimate = estimateConfidenceScore(mockProduct);

      expect(estimate).toBeGreaterThanOrEqual(70);
      expect(estimate).toBeLessThanOrEqual(95);
    });

    it('should give lower estimate for incomplete product', () => {
      const incompleteProduct = {
        ...mockProduct,
        imageUrl: null,
        description: null
      };

      const estimate = estimateConfidenceScore(incompleteProduct);

      expect(estimate).toBeLessThan(estimateConfidenceScore(mockProduct));
    });
  });

  describe('calculateScoreStatistics', () => {
    it('should calculate statistics correctly', () => {
      const scores = [75, 82, 88, 91, 95, 97];

      const stats = calculateScoreStatistics(scores);

      expect(stats.average).toBeGreaterThan(0);
      expect(stats.median).toBeGreaterThan(0);
      expect(stats.min).toBe(75);
      expect(stats.max).toBe(97);
      expect(stats.distribution.rejected).toBe(0);
      expect(stats.distribution.highConfidence).toBe(2);
    });

    it('should handle empty scores array', () => {
      const stats = calculateScoreStatistics([]);

      expect(stats.average).toBe(0);
      expect(stats.median).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
    });
  });

  describe('recommendActions', () => {
    it('should recommend actions for low score', () => {
      const lowScore = {
        completeness: 15,
        quality: 15,
        aiVerification: 20,
        bonuses: { hasReviews: 0, hasMultipleImages: 0, recentlyUpdated: 0, fromTrustedSource: 0 },
        final: 65,
        category: ScoreCategory.REJECTED
      };

      const actions = recommendActions(
        lowScore,
        mockCompleteness,
        mockQuality,
        mockAI
      );

      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some(a => a.includes('REJECT'))).toBe(true);
    });

    it('should recommend adding image for products without one', () => {
      const completenessWithoutImage = {
        ...mockCompleteness,
        optionalFields: [{
          field: 'imageUrl',
          present: false,
          valid: false,
          required: false
        }]
      };

      const score = {
        completeness: 20,
        quality: 25,
        aiVerification: 35,
        bonuses: { hasReviews: 0, hasMultipleImages: 0, recentlyUpdated: 0, fromTrustedSource: 5 },
        final: 80,
        category: ScoreCategory.REQUIRES_REVIEW
      };

      const actions = recommendActions(
        score,
        completenessWithoutImage,
        mockQuality,
        mockAI
      );

      expect(actions.some(a => a.includes('image'))).toBe(true);
    });

    it('should have no issues for perfect products', () => {
      const perfectScore = {
        completeness: 30,
        quality: 30,
        aiVerification: 40,
        bonuses: { hasReviews: 0, hasMultipleImages: 5, recentlyUpdated: 5, fromTrustedSource: 5 },
        final: 99,
        category: ScoreCategory.HIGH_CONFIDENCE
      };

      const actions = recommendActions(
        perfectScore,
        mockCompleteness,
        mockQuality,
        mockAI
      );

      expect(actions.some(a => a.includes('ready for publishing'))).toBe(true);
    });
  });
});
