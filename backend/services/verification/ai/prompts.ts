/**
 * AI Verification Prompts
 *
 * Prompt templates for Claude API product verification
 */

import { VerifiableProduct, ProductCategory } from '../types';

/**
 * System prompt for product verification
 */
export const SYSTEM_PROMPT = `You are a product data verification expert for a fashion e-commerce platform.

Your role is to verify product information for accuracy and legitimacy. You should:
1. Check if brand names are correctly formatted
2. Verify product categories match the product type
3. Assess if discounts are realistic and not too good to be true
4. Identify potential red flags (fake products, scams, unrealistic deals)

Always respond with valid JSON only. Do not include any explanatory text outside the JSON structure.`;

/**
 * Generate verification prompt for a product
 *
 * @param product - Product to verify
 * @returns Verification prompt
 */
export function generateVerificationPrompt(product: VerifiableProduct): string {
  const description = product.description || 'N/A';
  const attributes = product.attributes
    ? JSON.stringify(product.attributes)
    : 'N/A';

  return `Verify this product and respond with a JSON object:

Product Data:
- Name: ${product.name}
- Brand: ${product.brand}
- Category: ${product.category}
- Original Price: ${product.currency}${product.originalPrice}
- Sale Price: ${product.currency}${product.salePrice}
- Discount: ${product.discountPercentage}%
- Description: ${description}
- Attributes: ${attributes}
- Source: ${product.source}

Verification Tasks:
1. Is the brand name correct and properly formatted? (Check for case, spacing, special characters)
2. Is the category accurate for this product type?
3. Is the discount percentage realistic? (Fashion discounts are typically 10-90%)
4. Does the description match the product name and category?
5. Are there any red flags? (e.g., luxury brand at suspiciously low price, fake product indicators, impossible deals)

Respond ONLY with JSON in this exact format:
{
  "brandCorrect": boolean,
  "brandCorrectedName": string | null,
  "categoryAccurate": boolean,
  "suggestedCategory": string | null,
  "discountRealistic": boolean,
  "descriptionRelevant": boolean,
  "redFlags": string[],
  "confidenceScore": number,
  "reasoning": string
}

Guidelines:
- brandCorrect: true if brand name is properly formatted
- brandCorrectedName: corrected brand name if brandCorrect is false, otherwise null
- categoryAccurate: true if category matches the product
- suggestedCategory: one of [shoes, clothing, accessories, bags, jewelry, watches, sunglasses, other] if categoryAccurate is false
- discountRealistic: false if discount is < 10% or > 90%
- descriptionRelevant: true if description matches product type
- redFlags: array of specific concerns (e.g., "Luxury brand at extremely low price", "Discount too high to be realistic")
- confidenceScore: 0-100 based on overall data quality and legitimacy
- reasoning: brief explanation of your assessment (1-2 sentences)`;
}

/**
 * Generate brand-specific verification prompt
 *
 * @param brand - Brand name to verify
 * @param productName - Product name for context
 * @returns Brand verification prompt
 */
export function generateBrandPrompt(brand: string, productName: string): string {
  return `Verify the brand name for this fashion product.

Product: ${productName}
Brand: ${brand}

Is this brand name correctly formatted? Common brands should use their official capitalization and formatting.

Examples:
- "nike" should be "Nike"
- "ADIDAS" should be "Adidas"
- "h&m" should be "H&M"
- "pull&bear" should be "Pull&Bear"

Respond ONLY with JSON:
{
  "correct": boolean,
  "correctedName": string | null,
  "confidence": number,
  "reasoning": string
}`;
}

/**
 * Generate category verification prompt
 *
 * @param productName - Product name
 * @param currentCategory - Current category
 * @param description - Product description
 * @returns Category verification prompt
 */
export function generateCategoryPrompt(
  productName: string,
  currentCategory: ProductCategory,
  description?: string
): string {
  return `Verify the product category for this fashion item.

Product: ${productName}
Current Category: ${currentCategory}
Description: ${description || 'N/A'}

Available categories:
- shoes (sneakers, boots, sandals, heels, loafers, etc.)
- clothing (shirts, pants, dresses, jackets, sweaters, etc.)
- accessories (scarves, hats, gloves, belts, ties, etc.)
- bags (backpacks, handbags, purses, totes, etc.)
- jewelry (necklaces, bracelets, rings, earrings, etc.)
- watches (wristwatches, smartwatches, chronographs, etc.)
- sunglasses (eyewear, shades, glasses, etc.)
- other (items that don't fit above categories)

Is the current category correct? If not, suggest the most appropriate category.

Respond ONLY with JSON:
{
  "accurate": boolean,
  "suggestedCategory": string | null,
  "confidence": number,
  "reasoning": string
}`;
}

/**
 * Generate discount legitimacy check prompt
 *
 * @param product - Product to check
 * @returns Discount verification prompt
 */
export function generateDiscountPrompt(product: VerifiableProduct): string {
  const brandCategory = getBrandCategory(product.brand);

  return `Assess the legitimacy of this fashion deal.

Product: ${product.name}
Brand: ${product.brand} (${brandCategory})
Original Price: ${product.currency}${product.originalPrice}
Sale Price: ${product.currency}${product.salePrice}
Discount: ${product.discountPercentage}%

Consider:
1. Is this discount realistic for a ${brandCategory} brand?
2. Are there red flags indicating a fake or scam?
3. Is the price suspiciously low for this brand?

Red flag examples:
- Luxury brands (Gucci, Prada, LV) at 90%+ discount
- Premium brands (Nike, Adidas) under $10
- Unrealistic original prices inflated to make discount look bigger

Respond ONLY with JSON:
{
  "realistic": boolean,
  "tooGoodToBeTrue": boolean,
  "redFlags": string[],
  "confidence": number,
  "reasoning": string
}`;
}

/**
 * Generate batch verification prompt (for multiple products)
 *
 * @param products - Products to verify
 * @returns Batch verification prompt
 */
export function generateBatchPrompt(products: VerifiableProduct[]): string {
  const productList = products.map((p, i) => `
${i + 1}. ${p.name}
   Brand: ${p.brand}
   Category: ${p.category}
   Price: ${p.currency}${p.salePrice} (${p.discountPercentage}% off)
  `).join('\n');

  return `Verify these ${products.length} fashion products. For each product, check brand formatting, category accuracy, and deal legitimacy.

Products:
${productList}

Respond ONLY with JSON array:
[
  {
    "productIndex": number,
    "brandCorrect": boolean,
    "categoryAccurate": boolean,
    "discountRealistic": boolean,
    "redFlags": string[],
    "confidenceScore": number
  },
  ...
]`;
}

/**
 * Get brand category for context
 */
function getBrandCategory(brand: string): string {
  const brandLower = brand.toLowerCase();

  const luxuryBrands = ['gucci', 'prada', 'louis vuitton', 'versace', 'armani', 'burberry'];
  if (luxuryBrands.some(b => brandLower.includes(b))) {
    return 'luxury';
  }

  const premiumBrands = ['nike', 'adidas', 'tommy hilfiger', 'calvin klein', 'ralph lauren'];
  if (premiumBrands.some(b => brandLower.includes(b))) {
    return 'premium';
  }

  const fastFashionBrands = ['zara', 'h&m', 'mango', 'uniqlo', 'pull&bear'];
  if (fastFashionBrands.some(b => brandLower.includes(b))) {
    return 'fast-fashion';
  }

  return 'standard';
}

/**
 * Format product for logging (truncate long fields)
 */
export function formatProductForLog(product: VerifiableProduct): string {
  return `${product.brand} - ${product.name.substring(0, 50)}... (${product.currency}${product.salePrice}, ${product.discountPercentage}% off)`;
}
