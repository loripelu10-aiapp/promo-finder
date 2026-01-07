# Product Verification System - Quick Start Guide

## Overview

The Product Verification System ensures data accuracy for all products in PromoFinder using a three-layer approach:

1. **Layer 1**: Data Completeness (70-79%) - Checks required fields
2. **Layer 2**: Data Quality (80-89%) - Validates URLs, images, prices
3. **Layer 3**: AI Verification (90-99%) - Uses Claude API for intelligent checks

## Quick Start

### 1. Setup Environment

Add to your `.env` file:
```bash
CLAUDE_API_KEY=sk-ant-your-key-here
AI_VERIFICATION_ENABLED=true
MIN_CONFIDENCE_SCORE=70
MANUAL_REVIEW_THRESHOLD=85
```

### 2. Import Verification Manager

```typescript
import { verifyProduct, verifyBatch } from './services/verification/verification-manager';
```

### 3. Verify a Single Product

```typescript
// Verify by product ID
const result = await verifyProduct('product-id-123');

console.log(`Score: ${result.finalScore}/99`);
console.log(`Category: ${result.confidence.category}`);
console.log(`Passed: ${result.passed}`);
console.log(`Needs Review: ${result.requiresReview}`);

// Check for issues
if (result.allIssues.length > 0) {
  console.log('Issues found:');
  result.allIssues.forEach(issue => {
    console.log(`  [${issue.severity}] ${issue.field}: ${issue.message}`);
  });
}
```

### 4. Verify Multiple Products

```typescript
const productIds = ['id1', 'id2', 'id3', 'id4', 'id5'];

const batchResult = await verifyBatch(productIds, {
  useAi: true,
  updateDatabase: true,
  batchSize: 10
});

console.log(`Total: ${batchResult.total}`);
console.log(`Passed: ${batchResult.passed}`);
console.log(`Failed: ${batchResult.failed}`);
console.log(`Average Score: ${batchResult.stats.averageScore.toFixed(1)}`);
```

## Verification Options

### Full Verification (Default)
```typescript
await verifyProduct(productId, {
  useAi: true,           // Enable AI verification
  updateDatabase: true,  // Update product score in DB
  logHistory: true       // Log to verification_history
});
```

### Quick Verification (No AI)
```typescript
await verifyProduct(productId, {
  useAi: false,          // Skip AI layer (faster, cheaper)
  updateDatabase: true,
  logHistory: true
});
```

### Dry Run (No Database Changes)
```typescript
await verifyProduct(productId, {
  useAi: true,
  updateDatabase: false, // Don't update DB
  logHistory: false      // Don't log history
});
```

## Understanding Results

### Verification Result Structure

```typescript
{
  productId: "abc123",
  completeness: {
    score: 25,           // 0-30 points
    passed: true,
    completionPercentage: 90,
    issues: [...]
  },
  quality: {
    score: 25,           // 0-30 points
    passed: true,
    urlCheck: { accessible: true, httpStatus: 200 },
    imageCheck: { valid: true },
    priceCheck: { valid: true, reasonable: true },
    issues: [...]
  },
  ai: {
    score: 35,           // 0-40 points
    passed: true,
    brandVerification: { correct: true },
    categoryVerification: { accurate: true },
    redFlags: [],
    issues: [...]
  },
  confidence: {
    completeness: 25,
    quality: 25,
    aiVerification: 35,
    bonuses: {
      hasMultipleImages: 5,
      recentlyUpdated: 5,
      fromTrustedSource: 5
    },
    final: 95,           // 70-99
    category: "high_confidence"
  },
  finalScore: 95,
  passed: true,
  requiresReview: false,
  allIssues: [],
  summary: "Score: 95/99 (high_confidence), All checks passed"
}
```

### Score Categories

| Score | Category | Action |
|-------|----------|--------|
| < 70 | Rejected | Product deactivated |
| 70-84 | Requires Review | Manual review needed |
| 85-94 | Acceptable | Auto-approved |
| 95-99 | High Confidence | Premium quality |

### Issue Severity Levels

- **critical**: Must be fixed before product can be published
- **warning**: Should be fixed to improve quality
- **info**: Optional improvements

## Common Use Cases

### 1. Verify New Products on Import

```typescript
async function importProduct(productData: any) {
  // 1. Save product to database
  const product = await prisma.product.create({ data: productData });

  // 2. Verify product
  const verification = await verifyProduct(product.id);

  // 3. Handle result
  if (!verification.passed) {
    await prisma.product.update({
      where: { id: product.id },
      data: { isActive: false }
    });
    console.log(`Product ${product.id} failed verification`);
  }

  return product;
}
```

### 2. Re-verify Outdated Products

```typescript
import { reverifyOutdatedProducts } from './services/verification/verification-manager';

// Verify products not checked in 30 days
async function dailyReverification() {
  const result = await reverifyOutdatedProducts(30, 100);

  console.log(`Reverified ${result.processed} products`);
  console.log(`Failed: ${result.failed}`);
  console.log(`Need Review: ${result.requiresReview}`);
}

// Run daily
setInterval(dailyReverification, 24 * 60 * 60 * 1000);
```

### 3. Get Products Requiring Review

```typescript
import { getProductsRequiringReview } from './services/verification/scoring';

async function getReviewQueue() {
  const products = await getProductsRequiringReview(50);

  return products.map(p => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    score: p.confidenceScore,
    lastVerified: p.lastVerifiedAt
  }));
}
```

### 4. Get Verification Recommendations

```typescript
import { getVerificationRecommendations } from './services/verification/verification-manager';

async function showRecommendations(productId: string) {
  const actions = await getVerificationRecommendations(productId);

  console.log('Recommended actions:');
  actions.forEach((action, i) => {
    console.log(`${i + 1}. ${action}`);
  });
}
```

## Verification Layers in Detail

### Layer 1: Data Completeness

Checks:
- ✓ Required fields present (name, brand, category, prices, URL)
- ✓ Field values valid (non-empty, correct format)
- ✓ Optional fields present (image, description, attributes)

Example issue:
```json
{
  "severity": "critical",
  "field": "productUrl",
  "message": "Product URL is not a valid URL",
  "value": "invalid-url"
}
```

### Layer 2: Data Quality

Checks:
- ✓ URL accessibility (HTTP 200 response)
- ✓ Image validity (format, dimensions, size)
- ✓ Price reasonableness (not $0, not $999999)
- ✓ Discount accuracy (±2% tolerance)

Example issue:
```json
{
  "severity": "critical",
  "field": "productUrl",
  "message": "Product URL not accessible: HTTP 404",
  "value": "https://example.com/product"
}
```

### Layer 3: AI Verification

Checks:
- ✓ Brand name formatting (Nike vs NIKE vs nike)
- ✓ Category accuracy (shoes vs clothing)
- ✓ Discount legitimacy (too good to be true?)
- ✓ Description relevance

Example AI response:
```json
{
  "brandCorrect": false,
  "brandCorrectedName": "Nike",
  "categoryAccurate": true,
  "discountRealistic": true,
  "redFlags": ["Brand name should be capitalized"],
  "confidenceScore": 85,
  "reasoning": "Product data is mostly accurate but brand formatting needs correction"
}
```

## Monitoring & Debugging

### Check Verification History

```typescript
import { getVerificationHistory } from './services/verification/history';

const history = await getVerificationHistory('product-id', 10);

history.forEach(record => {
  console.log(`${record.createdAt}: ${record.verificationType}`);
  console.log(`  Status: ${record.status}`);
  console.log(`  Score: ${record.previousConfidence} -> ${record.newConfidence}`);
});
```

### Get Verification Statistics

```typescript
import { getVerificationStats } from './services/verification/history';

const stats = await getVerificationStats(
  new Date('2024-01-01'),  // Start date
  new Date()                // End date
);

console.log(`Total verifications: ${stats.total}`);
console.log(`By type:`, stats.byType);
console.log(`By status:`, stats.byStatus);
console.log(`Avg response time: ${stats.averageResponseTime}ms`);
```

### Check Score Distribution

```typescript
import { getScoreDistribution } from './services/verification/scoring';

const distribution = await getScoreDistribution();

console.log(`Total products: ${distribution.total}`);
console.log(`Average score: ${distribution.average.toFixed(1)}`);
console.log(`Median score: ${distribution.median}`);
console.log(`Distribution:`, distribution.byCategory);
```

## Cost Management

### Estimate Verification Costs

```typescript
// Claude 3 Haiku pricing (as of 2024):
// - Input: $0.25 per million tokens
// - Output: $1.25 per million tokens

// Average per product:
// - Input tokens: ~400
// - Output tokens: ~100
// - Cost: ~$0.0008 per product

// For 1000 products:
// - Total cost: ~$0.80
// - Time: ~30-45 minutes
```

### Reduce Costs

1. **Disable AI for trusted sources**:
```typescript
const isTrustedSource = ['nike', 'adidas', 'zara'].includes(product.source);

await verifyProduct(productId, {
  useAi: !isTrustedSource  // Skip AI for trusted sources
});
```

2. **Use batch verification**:
```typescript
// More efficient than individual calls
await verifyBatch(productIds, { batchSize: 10 });
```

3. **Cache results**:
```typescript
// Re-verify only if product changed
const daysSinceUpdate = getDaysSince(product.updatedAt);
if (daysSinceUpdate > 7) {
  await verifyProduct(product.id);
}
```

## Troubleshooting

### Issue: AI verification failing

**Solution**: Check Claude API key and quota
```bash
# Test connection
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $CLAUDE_API_KEY" \
  -H "anthropic-version: 2023-06-01"
```

### Issue: Scores too low

**Solution**: Adjust thresholds in .env
```bash
MIN_CONFIDENCE_SCORE=65  # Lower from 70
MANUAL_REVIEW_THRESHOLD=80  # Lower from 85
```

### Issue: Too many products requiring review

**Solution**: Check common issues
```typescript
const { commonIssues } = batchResult.stats;

// Sort by frequency
const sorted = Array.from(commonIssues.entries())
  .sort((a, b) => b[1] - a[1]);

console.log('Most common issues:');
sorted.slice(0, 5).forEach(([issue, count]) => {
  console.log(`${count}x: ${issue}`);
});
```

### Issue: Slow verification

**Solution**: Reduce batch size or disable AI
```typescript
await verifyBatch(productIds, {
  batchSize: 5,  // Reduce from 10
  useAi: false   // Skip AI for speed
});
```

## Best Practices

1. **Verify on import**: Always verify new products immediately
2. **Re-verify periodically**: Check old products every 30 days
3. **Monitor costs**: Track Claude API usage daily
4. **Review failures**: Investigate products that fail verification
5. **Update thresholds**: Adjust based on your quality requirements
6. **Log everything**: Keep verification history for analysis
7. **Handle errors**: Gracefully degrade if AI fails

## API Reference

See `types.ts` for complete type definitions.

### Main Functions

- `verifyProduct(productId, options)` - Verify single product
- `verifyBatch(productIds, options)` - Verify multiple products
- `reverifyOutdatedProducts(days, limit)` - Re-verify old products
- `getVerificationRecommendations(productId)` - Get improvement suggestions

### Helper Functions

- `getProductsRequiringReview(limit)` - Get low-score products
- `getVerificationHistory(productId, limit)` - Get audit trail
- `getScoreDistribution()` - Get score statistics
- `updateProductScore(productId, score)` - Update score manually

## Support

For issues or questions:
1. Check `VERIFICATION-SUMMARY.md` for overview
2. Check `AI-PROMPTS.md` for prompt details
3. Review `types.ts` for data structures
4. Check logs for error messages

---

**Last Updated**: 2026-01-06
**Version**: 1.0.0
