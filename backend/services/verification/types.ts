/**
 * TypeScript interfaces and types for the Product Verification System
 *
 * This file defines all types used across the verification layers:
 * - Layer 1: Data Completeness (70-79%)
 * - Layer 2: Data Quality (80-89%)
 * - Layer 3: AI Verification (90-99%)
 */

import { Product, ProductCategory, ProductSource, VerificationStatus } from '@prisma/client';

// ============================================
// CORE VERIFICATION TYPES
// ============================================

/**
 * Verification layers enum
 */
export enum VerificationLayer {
  COMPLETENESS = 'completeness',
  QUALITY = 'quality',
  AI = 'ai'
}

/**
 * Product data for verification (subset of Prisma Product model)
 */
export interface VerifiableProduct {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  source: ProductSource;
  originalPrice: number;
  salePrice: number;
  discountPercentage: number;
  currency: string;
  productUrl: string;
  imageUrl: string | null;
  description: string | null;
  attributes: any;
  confidenceScore: number;
  isActive: boolean;
  lastVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Base verification result interface
 */
export interface VerificationResult {
  passed: boolean;
  score: number;
  layer: VerificationLayer;
  issues: VerificationIssue[];
  metadata?: Record<string, any>;
  timestamp: Date;
}

/**
 * Verification issue details
 */
export interface VerificationIssue {
  severity: 'critical' | 'warning' | 'info';
  field: string;
  message: string;
  value?: any;
  suggestion?: string;
}

// ============================================
// LAYER 1: DATA COMPLETENESS
// ============================================

/**
 * Data completeness check result
 */
export interface CompletenessResult extends VerificationResult {
  layer: VerificationLayer.COMPLETENESS;
  requiredFields: FieldCheckResult[];
  optionalFields: FieldCheckResult[];
  completionPercentage: number;
}

/**
 * Individual field check result
 */
export interface FieldCheckResult {
  field: string;
  present: boolean;
  valid: boolean;
  required: boolean;
  value?: any;
  reason?: string;
}

// ============================================
// LAYER 2: DATA QUALITY
// ============================================

/**
 * Data quality check result
 */
export interface QualityResult extends VerificationResult {
  layer: VerificationLayer.QUALITY;
  urlCheck: UrlValidationResult;
  imageCheck?: ImageValidationResult;
  priceCheck: PriceValidationResult;
  discountCheck: DiscountValidationResult;
}

/**
 * URL validation result
 */
export interface UrlValidationResult {
  accessible: boolean;
  httpStatus?: number;
  responseTime?: number;
  error?: string;
  redirectUrl?: string;
}

/**
 * Image validation result
 */
export interface ImageValidationResult {
  valid: boolean;
  accessible: boolean;
  format?: string;
  dimensions?: {
    width: number;
    height: number;
  };
  fileSize?: number;
  error?: string;
}

/**
 * Price validation result
 */
export interface PriceValidationResult {
  valid: boolean;
  reasonable: boolean;
  issues: string[];
  checks: {
    positiveValues: boolean;
    saleLessThanOriginal: boolean;
    withinReasonableRange: boolean;
    discountMatchesCalculated: boolean;
  };
}

/**
 * Discount validation result
 */
export interface DiscountValidationResult {
  valid: boolean;
  calculated: number;
  claimed: number;
  difference: number;
  realistic: boolean;
}

// ============================================
// LAYER 3: AI VERIFICATION
// ============================================

/**
 * AI verification result
 */
export interface AIVerificationResult extends VerificationResult {
  layer: VerificationLayer.AI;
  brandVerification: BrandVerification;
  categoryVerification: CategoryVerification;
  discountVerification: DiscountVerification;
  descriptionVerification: DescriptionVerification;
  redFlags: string[];
  aiConfidence: number;
  reasoning: string;
}

/**
 * Brand verification from AI
 */
export interface BrandVerification {
  correct: boolean;
  originalBrand: string;
  correctedBrand?: string;
  confidence: number;
  reasoning: string;
}

/**
 * Category verification from AI
 */
export interface CategoryVerification {
  accurate: boolean;
  originalCategory: ProductCategory;
  suggestedCategory?: ProductCategory;
  confidence: number;
  reasoning: string;
}

/**
 * Discount verification from AI
 */
export interface DiscountVerification {
  realistic: boolean;
  tooGoodToBeTrue: boolean;
  confidence: number;
  reasoning: string;
}

/**
 * Description verification from AI
 */
export interface DescriptionVerification {
  relevant: boolean;
  matchesProduct: boolean;
  confidence: number;
  reasoning: string;
}

/**
 * Claude API response for product verification
 */
export interface ClaudeVerificationResponse {
  brandCorrect: boolean;
  brandCorrectedName: string | null;
  categoryAccurate: boolean;
  suggestedCategory: string | null;
  discountRealistic: boolean;
  descriptionRelevant: boolean;
  redFlags: string[];
  confidenceScore: number;
  reasoning: string;
}

// ============================================
// CONFIDENCE SCORING
// ============================================

/**
 * Confidence score breakdown
 */
export interface ConfidenceScore {
  // Base scores (0-30 points each)
  completeness: number;
  quality: number;

  // AI score (0-40 points)
  aiVerification: number;

  // Bonus points (up to 20 points total)
  bonuses: {
    hasReviews: number;
    hasMultipleImages: number;
    recentlyUpdated: number;
    fromTrustedSource: number;
  };

  // Final score (70-99)
  final: number;

  // Score category
  category: ScoreCategory;
}

/**
 * Score categories
 */
export enum ScoreCategory {
  REJECTED = 'rejected',           // < 70
  REQUIRES_REVIEW = 'requires_review', // 70-84
  ACCEPTABLE = 'acceptable',        // 85-94
  HIGH_CONFIDENCE = 'high_confidence' // 95-99
}

// ============================================
// VERIFICATION WORKFLOW
// ============================================

/**
 * Complete verification result (all layers)
 */
export interface CompleteVerificationResult {
  productId: string;
  completeness: CompletenessResult;
  quality: QualityResult;
  ai?: AIVerificationResult;
  confidence: ConfidenceScore;
  finalScore: number;
  passed: boolean;
  requiresReview: boolean;
  allIssues: VerificationIssue[];
  summary: string;
  verifiedAt: Date;
}

/**
 * Batch verification result
 */
export interface BatchVerificationResult {
  total: number;
  processed: number;
  passed: number;
  failed: number;
  requiresReview: number;
  results: CompleteVerificationResult[];
  stats: VerificationStats;
  duration: number; // milliseconds
}

/**
 * Verification statistics
 */
export interface VerificationStats {
  averageScore: number;
  scoreDistribution: {
    rejected: number;
    requiresReview: number;
    acceptable: number;
    highConfidence: number;
  };
  commonIssues: Map<string, number>;
  layerPerformance: {
    completeness: {
      averageScore: number;
      passRate: number;
    };
    quality: {
      averageScore: number;
      passRate: number;
    };
    ai: {
      averageScore: number;
      passRate: number;
      averageResponseTime: number;
    };
  };
}

// ============================================
// VALIDATORS CONFIGURATION
// ============================================

/**
 * URL validator configuration
 */
export interface UrlValidatorConfig {
  timeout: number;
  followRedirects: boolean;
  maxRedirects: number;
  validateSSL: boolean;
}

/**
 * Image validator configuration
 */
export interface ImageValidatorConfig {
  timeout: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  maxFileSize: number; // bytes
  allowedFormats: string[];
}

/**
 * Price validator configuration
 */
export interface PriceValidatorConfig {
  minPrice: number;
  maxPrice: number;
  discountTolerance: number; // percentage
}

/**
 * Brand validator configuration
 */
export interface BrandValidatorConfig {
  knownBrands: string[];
  caseSensitive: boolean;
  fuzzyMatchThreshold: number;
}

// ============================================
// CLAUDE API TYPES
// ============================================

/**
 * Claude API request configuration
 */
export interface ClaudeApiConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
}

/**
 * Claude API request
 */
export interface ClaudeApiRequest {
  model: string;
  max_tokens: number;
  temperature: number;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

/**
 * Claude API response
 */
export interface ClaudeApiResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// ============================================
// DATABASE TYPES
// ============================================

/**
 * Verification history record
 */
export interface VerificationHistoryRecord {
  productId: string;
  verificationType: string;
  status: VerificationStatus;
  httpStatus?: number;
  responseTime?: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
  previousConfidence: number;
  newConfidence: number;
}

/**
 * API usage log
 */
export interface ApiUsageLog {
  provider: string;
  endpoint: string;
  requestParams?: Record<string, any>;
  responseStatus: number;
  responseTime: number;
  creditsUsed: number;
  estimatedCost?: number;
  success: boolean;
  errorMessage?: string;
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Known fashion brands list
 */
export const KNOWN_BRANDS = [
  'Nike',
  'Adidas',
  'Zara',
  'H&M',
  'Mango',
  'ASOS',
  'Uniqlo',
  'Pull&Bear',
  'Bershka',
  'Stradivarius',
  'GAP',
  'Levi\'s',
  'Tommy Hilfiger',
  'Calvin Klein',
  'Ralph Lauren',
  'Gucci',
  'Prada',
  'Louis Vuitton',
  'Versace',
  'Armani',
  'Burberry',
  'Balenciaga',
  'Valentino',
  'Dolce & Gabbana',
  'Fendi',
  'Givenchy',
  'Saint Laurent',
  'Bottega Veneta',
  'Alexander McQueen',
  'Off-White',
  'Supreme',
  'Stone Island',
  'CP Company',
  'The North Face',
  'Patagonia',
  'Arc\'teryx',
  'Canada Goose',
  'Moncler',
  'Woolrich',
  'Barbour',
  'Fred Perry',
  'Lacoste',
  'Polo Ralph Lauren',
  'Boss',
  'Diesel',
  'Replay',
  'Guess',
  'Timberland',
  'Dr. Martens',
  'Vans',
  'Converse',
  'New Balance',
  'Asics',
  'Puma',
  'Reebok',
  'Under Armour',
  'Columbia',
  'Salomon',
  'Merrell',
  'Hoka',
  'On Running',
  'Allbirds',
  'Everlane',
  'Reformation',
  'Ganni',
  'Acne Studios',
  'A.P.C.',
  'COS',
  'Other Stories',
  'Arket',
  'Massimo Dutti',
  'Sandro',
  'Maje',
  'Ba&sh',
  'Reiss',
  'Ted Baker',
  'AllSaints',
  'Superdry',
  'G-Star',
  'Scotch & Soda',
  'Napapijri',
  'Carhartt',
  'Dickies',
  'Stussy',
  'Obey',
  'HUF',
  'Palace',
  'Bape',
  'Neighborhood',
  'Wtaps',
  'Visvim',
  'Engineered Garments',
  'Our Legacy',
  'Lemaire',
  'Jil Sander',
  'Marni',
  'Maison Margiela',
  'Acne',
  'AMI',
  'Isabel Marant'
] as const;

/**
 * Product category mappings for AI
 */
export const CATEGORY_KEYWORDS: Record<ProductCategory, string[]> = {
  shoes: ['shoe', 'sneaker', 'boot', 'sandal', 'heel', 'loafer', 'slipper', 'footwear'],
  clothing: ['shirt', 'pants', 'dress', 'jacket', 'coat', 'sweater', 'hoodie', 'jeans', 'skirt', 'top', 'blouse', 'suit'],
  accessories: ['scarf', 'hat', 'gloves', 'belt', 'tie', 'pocket square', 'keychain', 'phone case'],
  bags: ['bag', 'backpack', 'purse', 'handbag', 'tote', 'clutch', 'satchel', 'messenger', 'briefcase'],
  jewelry: ['necklace', 'bracelet', 'ring', 'earring', 'pendant', 'chain', 'brooch', 'anklet'],
  watches: ['watch', 'timepiece', 'chronograph', 'smartwatch'],
  sunglasses: ['sunglasses', 'eyewear', 'shades', 'glasses'],
  other: []
};
