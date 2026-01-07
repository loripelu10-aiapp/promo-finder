/**
 * Data Completeness Checker - Layer 1 Verification
 *
 * Validates that products have all required fields and checks data presence
 * Score range: 70-79% (basic validation)
 *
 * Required fields:
 * - name, brand, category, price, productUrl
 *
 * Optional fields (boost score):
 * - imageUrl, description, attributes (size, color, etc.)
 */

import {
  VerifiableProduct,
  CompletenessResult,
  FieldCheckResult,
  VerificationIssue,
  VerificationLayer
} from './types';

/**
 * Check data completeness for a product
 *
 * @param product - Product to validate
 * @returns Completeness validation result
 */
export async function checkDataCompleteness(
  product: VerifiableProduct
): Promise<CompletenessResult> {
  const requiredFields = checkRequiredFields(product);
  const optionalFields = checkOptionalFields(product);
  const issues = generateIssues(requiredFields, optionalFields);

  // Calculate completion percentage
  const totalRequired = requiredFields.length;
  const completedRequired = requiredFields.filter(f => f.present && f.valid).length;
  const completedOptional = optionalFields.filter(f => f.present && f.valid).length;

  const completionPercentage = Math.round(
    ((completedRequired / totalRequired) * 70) + // Required fields: 70%
    ((completedOptional / optionalFields.length) * 30) // Optional fields: 30%
  );

  // Calculate base score (0-30 points for this layer)
  const score = calculateCompletenessScore(
    requiredFields,
    optionalFields,
    completionPercentage
  );

  // Product passes if all required fields are present and valid
  const passed = requiredFields.every(f => f.present && f.valid);

  return {
    passed,
    score,
    layer: VerificationLayer.COMPLETENESS,
    requiredFields,
    optionalFields,
    completionPercentage,
    issues,
    timestamp: new Date()
  };
}

/**
 * Check all required fields
 */
function checkRequiredFields(product: VerifiableProduct): FieldCheckResult[] {
  return [
    checkField('name', product.name, true, (val) => {
      if (!val || val.trim().length === 0) {
        return { valid: false, reason: 'Product name is empty' };
      }
      if (val.trim().length < 3) {
        return { valid: false, reason: 'Product name too short (minimum 3 characters)' };
      }
      if (val.trim().length > 200) {
        return { valid: false, reason: 'Product name too long (maximum 200 characters)' };
      }
      return { valid: true };
    }),

    checkField('brand', product.brand, true, (val) => {
      if (!val || val.trim().length === 0) {
        return { valid: false, reason: 'Brand name is empty' };
      }
      if (val.trim().length < 2) {
        return { valid: false, reason: 'Brand name too short (minimum 2 characters)' };
      }
      return { valid: true };
    }),

    checkField('category', product.category, true, (val) => {
      if (!val) {
        return { valid: false, reason: 'Category is missing' };
      }
      return { valid: true };
    }),

    checkField('originalPrice', product.originalPrice, true, (val) => {
      if (typeof val !== 'number') {
        return { valid: false, reason: 'Original price must be a number' };
      }
      if (val <= 0) {
        return { valid: false, reason: 'Original price must be greater than 0' };
      }
      return { valid: true };
    }),

    checkField('salePrice', product.salePrice, true, (val) => {
      if (typeof val !== 'number') {
        return { valid: false, reason: 'Sale price must be a number' };
      }
      if (val <= 0) {
        return { valid: false, reason: 'Sale price must be greater than 0' };
      }
      return { valid: true };
    }),

    checkField('discountPercentage', product.discountPercentage, true, (val) => {
      if (typeof val !== 'number') {
        return { valid: false, reason: 'Discount percentage must be a number' };
      }
      if (val < 0 || val > 100) {
        return { valid: false, reason: 'Discount percentage must be between 0 and 100' };
      }
      return { valid: true };
    }),

    checkField('productUrl', product.productUrl, true, (val) => {
      if (!val || val.trim().length === 0) {
        return { valid: false, reason: 'Product URL is empty' };
      }
      try {
        new URL(val);
        return { valid: true };
      } catch {
        return { valid: false, reason: 'Product URL is not a valid URL' };
      }
    }),

    checkField('currency', product.currency, true, (val) => {
      if (!val || val.trim().length === 0) {
        return { valid: false, reason: 'Currency is empty' };
      }
      const validCurrencies = ['EUR', 'USD', 'GBP', 'JPY'];
      if (!validCurrencies.includes(val)) {
        return { valid: false, reason: `Currency must be one of: ${validCurrencies.join(', ')}` };
      }
      return { valid: true };
    })
  ];
}

/**
 * Check all optional fields
 */
function checkOptionalFields(product: VerifiableProduct): FieldCheckResult[] {
  return [
    checkField('imageUrl', product.imageUrl, false, (val) => {
      if (!val || val.trim().length === 0) {
        return { valid: false, reason: 'No image URL provided' };
      }
      try {
        new URL(val);
        return { valid: true };
      } catch {
        return { valid: false, reason: 'Image URL is not a valid URL' };
      }
    }),

    checkField('description', product.description, false, (val) => {
      if (!val || val.trim().length === 0) {
        return { valid: false, reason: 'No description provided' };
      }
      if (val.trim().length < 10) {
        return { valid: false, reason: 'Description too short (minimum 10 characters)' };
      }
      if (val.trim().length > 2000) {
        return { valid: false, reason: 'Description too long (maximum 2000 characters)' };
      }
      return { valid: true };
    }),

    checkField('attributes', product.attributes, false, (val) => {
      if (!val) {
        return { valid: false, reason: 'No attributes provided' };
      }
      if (typeof val !== 'object') {
        return { valid: false, reason: 'Attributes must be an object' };
      }

      const attrs = val as Record<string, any>;
      const hasUsefulAttrs = attrs.size || attrs.color || attrs.material || attrs.style;

      if (!hasUsefulAttrs) {
        return { valid: false, reason: 'Attributes present but no useful data (size, color, material, style)' };
      }

      return { valid: true };
    }),

    checkField('source', product.source, false, (val) => {
      if (!val) {
        return { valid: false, reason: 'No source specified' };
      }
      return { valid: true };
    })
  ];
}

/**
 * Generic field checker
 */
function checkField(
  fieldName: string,
  value: any,
  required: boolean,
  validator: (val: any) => { valid: boolean; reason?: string }
): FieldCheckResult {
  const present = value !== null && value !== undefined;

  if (!present) {
    return {
      field: fieldName,
      present: false,
      valid: false,
      required,
      value,
      reason: required ? `Required field "${fieldName}" is missing` : `Optional field "${fieldName}" is missing`
    };
  }

  const validationResult = validator(value);

  return {
    field: fieldName,
    present: true,
    valid: validationResult.valid,
    required,
    value,
    reason: validationResult.reason
  };
}

/**
 * Calculate completeness score (0-30 points)
 *
 * Scoring breakdown:
 * - Required fields complete: 20 points (base)
 * - Optional fields present: +10 points (bonus)
 * - Maximum: 30 points
 */
function calculateCompletenessScore(
  requiredFields: FieldCheckResult[],
  optionalFields: FieldCheckResult[],
  completionPercentage: number
): number {
  // All required fields must be valid to get any points
  const allRequiredValid = requiredFields.every(f => f.present && f.valid);

  if (!allRequiredValid) {
    // Partial credit based on how many required fields are present
    const validRequired = requiredFields.filter(f => f.present && f.valid).length;
    return Math.round((validRequired / requiredFields.length) * 15);
  }

  // Base score for complete required fields
  let score = 20;

  // Bonus points for optional fields
  const validOptional = optionalFields.filter(f => f.present && f.valid).length;
  const optionalBonus = Math.round((validOptional / optionalFields.length) * 10);

  score += optionalBonus;

  return Math.min(30, score); // Cap at 30
}

/**
 * Generate issues from field checks
 */
function generateIssues(
  requiredFields: FieldCheckResult[],
  optionalFields: FieldCheckResult[]
): VerificationIssue[] {
  const issues: VerificationIssue[] = [];

  // Check required fields
  for (const field of requiredFields) {
    if (!field.present || !field.valid) {
      issues.push({
        severity: 'critical',
        field: field.field,
        message: field.reason || `Required field "${field.field}" is invalid`,
        value: field.value
      });
    }
  }

  // Check optional fields (warnings only)
  for (const field of optionalFields) {
    if (!field.present) {
      issues.push({
        severity: 'info',
        field: field.field,
        message: `Optional field "${field.field}" is missing`,
        value: field.value,
        suggestion: `Adding ${field.field} would improve data quality`
      });
    } else if (!field.valid) {
      issues.push({
        severity: 'warning',
        field: field.field,
        message: field.reason || `Optional field "${field.field}" has issues`,
        value: field.value
      });
    }
  }

  return issues;
}

/**
 * Get completeness summary
 */
export function getCompletenessSummary(result: CompletenessResult): string {
  const totalFields = result.requiredFields.length + result.optionalFields.length;
  const validFields = [
    ...result.requiredFields.filter(f => f.present && f.valid),
    ...result.optionalFields.filter(f => f.present && f.valid)
  ].length;

  const criticalIssues = result.issues.filter(i => i.severity === 'critical').length;
  const warnings = result.issues.filter(i => i.severity === 'warning').length;

  return `Completeness: ${validFields}/${totalFields} fields valid (${result.completionPercentage}%). ` +
    `${criticalIssues} critical issues, ${warnings} warnings. Score: ${result.score}/30`;
}
