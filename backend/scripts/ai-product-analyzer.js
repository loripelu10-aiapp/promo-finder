/**
 * AI Product Analyzer
 * Analyzes products to add smart filtering fields:
 * - Gender detection (men, women, kids, unisex)
 * - Smart categories (athletic, casual, streetwear, basics, formal)
 * - Deal quality score (0-100)
 * - Best value flag
 * - Trending/seasonal tags
 */

const fs = require('fs');
const path = require('path');

// Gender detection keywords
const GENDER_KEYWORDS = {
  women: ['women', 'woman', 'wmns', "women's", 'womens', 'ladies', 'lady', 'her', 'female', 'girls', 'girl'],
  men: ['men', 'man', 'mens', "men's", 'guys', 'guy', 'his', 'male', 'boys', 'boy'],
  kids: ['kids', 'kid', "kid's", 'children', 'child', 'youth', 'toddler', 'baby', 'infant', 'jr', 'junior', 'little', 'big kids', 'gs']
};

// Smart category keywords
const CATEGORY_KEYWORDS = {
  athletic: ['running', 'training', 'gym', 'sport', 'workout', 'fitness', 'performance', 'marathon', 'trail', 'track', 'cross training'],
  casual: ['lifestyle', 'classic', 'everyday', 'comfort', 'leisure', 'relaxed', 'lounge'],
  streetwear: ['jordan', 'dunk', 'air force', 'retro', 'og', 'sb', 'skate', 'urban', 'hype', 'boost', 'yeezy'],
  basics: ['essential', 'basic', 'tee', 'sock', 'underwear', 'plain', 'solid', 'pack'],
  formal: ['dress', 'oxford', 'loafer', 'heel', 'pump', 'formal', 'office', 'business'],
  outerwear: ['jacket', 'coat', 'hoodie', 'sweater', 'fleece', 'puffer', 'windbreaker', 'vest'],
  bottoms: ['pants', 'jeans', 'shorts', 'leggings', 'joggers', 'sweatpants', 'skirt'],
  tops: ['shirt', 'tee', 't-shirt', 'blouse', 'tank', 'polo', 'top', 'jersey']
};

// Brand trust scores (0-100)
const BRAND_TRUST = {
  'nike': 95,
  'adidas': 93,
  'puma': 88,
  'new balance': 90,
  'converse': 87,
  'reebok': 85,
  'under armour': 88,
  'lululemon': 92,
  'champion': 82,
  'skechers': 80,
  'vans': 86,
  'h&m': 75,
  'forever 21': 70,
  'old navy': 75,
  'gap': 78,
  'nordstrom rack': 85,
  'zappos': 88,
  '6pm': 82,
  'finish line': 84,
  'jd sports': 83,
  "dick's sporting goods": 86,
  "macy's": 82,
  'jcpenney': 75,
  'default': 70
};

// Seasonal keywords
const SEASONAL_KEYWORDS = {
  winter: ['winter', 'cold', 'fleece', 'thermal', 'puffer', 'down', 'wool', 'warm'],
  summer: ['summer', 'light', 'breathable', 'mesh', 'sandal', 'shorts', 'tank'],
  spring: ['spring', 'rain', 'windbreaker', 'light jacket'],
  fall: ['fall', 'autumn', 'layering']
};

/**
 * Detect gender from product name and category
 */
function detectGender(product) {
  const searchText = `${product.name} ${product.category || ''}`.toLowerCase();

  // Check explicit category first
  if (product.category) {
    const cat = product.category.toLowerCase();
    if (cat === 'men' || cat === 'mens') return 'men';
    if (cat === 'women' || cat === 'womens') return 'women';
    if (cat === 'kids' || cat === 'children') return 'kids';
  }

  // Check keywords in product name
  for (const [gender, keywords] of Object.entries(GENDER_KEYWORDS)) {
    for (const keyword of keywords) {
      // Use word boundary matching to avoid false positives
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(searchText)) {
        return gender;
      }
    }
  }

  return 'unisex';
}

/**
 * Detect smart category from product name
 */
function detectSmartCategory(product) {
  const searchText = `${product.name} ${product.category || ''}`.toLowerCase();
  const detected = [];

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword)) {
        detected.push(category);
        break;
      }
    }
  }

  // Default based on general category
  if (detected.length === 0) {
    if (searchText.includes('shoe') || searchText.includes('sneaker') || searchText.includes('boot')) {
      detected.push('casual');
    } else if (searchText.includes('cloth')) {
      detected.push('casual');
    } else {
      detected.push('casual');
    }
  }

  return detected;
}

/**
 * Detect seasonal tags
 */
function detectSeason(product) {
  const searchText = product.name.toLowerCase();
  const seasons = [];

  for (const [season, keywords] of Object.entries(SEASONAL_KEYWORDS)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword)) {
        seasons.push(season);
        break;
      }
    }
  }

  return seasons.length > 0 ? seasons : ['all-season'];
}

/**
 * Calculate deal quality score (0-100)
 */
function calculateDealScore(product, categoryAvgPrice) {
  const discount = product.discount || 0;
  const brandKey = (product.merchantName || product.brand || '').toLowerCase();
  const brandTrust = BRAND_TRUST[brandKey] || BRAND_TRUST.default;

  // Price competitiveness (compared to category average)
  const priceCompetitiveness = categoryAvgPrice > 0
    ? Math.min(100, (1 - (product.salePrice / categoryAvgPrice)) * 100 + 50)
    : 50;

  // Weighted score
  const score = Math.round(
    (discount * 0.4) +           // 40% weight on discount
    (brandTrust * 0.3) +         // 30% weight on brand trust
    (priceCompetitiveness * 0.3) // 30% weight on price competitiveness
  );

  return Math.max(0, Math.min(100, score));
}

/**
 * Determine if product is "Best Value"
 */
function isBestValue(product, dealScore) {
  return product.discount >= 40 && dealScore >= 70;
}

/**
 * Determine if product qualifies as "Top Deal"
 */
function isTopDeal(dealScore) {
  return dealScore >= 80;
}

/**
 * Detect if price recently dropped (simulated - in production would compare to historical data)
 */
function isPriceDrop(product) {
  // For now, mark products with 50%+ discount as "price drop"
  return product.discount >= 50;
}

/**
 * Analyze all products and add smart fields
 */
function analyzeProducts(products) {
  console.log(`\nAnalyzing ${products.length} products...\n`);

  // Calculate category average prices
  const categoryPrices = {};
  products.forEach(p => {
    const cat = p.category || 'all';
    if (!categoryPrices[cat]) categoryPrices[cat] = [];
    categoryPrices[cat].push(p.salePrice);
  });

  const categoryAvg = {};
  for (const [cat, prices] of Object.entries(categoryPrices)) {
    categoryAvg[cat] = prices.reduce((a, b) => a + b, 0) / prices.length;
  }

  // Analyze each product
  const analyzed = products.map(product => {
    const gender = detectGender(product);
    const smartCategories = detectSmartCategory(product);
    const seasons = detectSeason(product);
    const avgPrice = categoryAvg[product.category] || categoryAvg['all'] || 100;
    const dealScore = calculateDealScore(product, avgPrice);
    const bestValue = isBestValue(product, dealScore);
    const topDeal = isTopDeal(dealScore);
    const priceDrop = isPriceDrop(product);

    return {
      ...product,
      // AI-analyzed fields
      gender,
      smartCategories,
      seasons,
      dealScore,
      bestValue,
      topDeal,
      priceDrop,
      // Ensure retailer name is set
      retailer: product.merchantName || product.brand || 'Unknown'
    };
  });

  // Print statistics
  const genderStats = { men: 0, women: 0, kids: 0, unisex: 0 };
  const categoryStats = {};
  let bestValueCount = 0;
  let topDealCount = 0;
  let priceDropCount = 0;

  analyzed.forEach(p => {
    genderStats[p.gender] = (genderStats[p.gender] || 0) + 1;
    p.smartCategories.forEach(cat => {
      categoryStats[cat] = (categoryStats[cat] || 0) + 1;
    });
    if (p.bestValue) bestValueCount++;
    if (p.topDeal) topDealCount++;
    if (p.priceDrop) priceDropCount++;
  });

  console.log('=== AI ANALYSIS COMPLETE ===\n');
  console.log('Gender Distribution:');
  Object.entries(genderStats).forEach(([g, c]) => console.log(`  ${g}: ${c}`));

  console.log('\nSmart Categories:');
  Object.entries(categoryStats).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`  ${c}: ${n}`));

  console.log('\nSmart Tags:');
  console.log(`  Best Value: ${bestValueCount}`);
  console.log(`  Top Deal: ${topDealCount}`);
  console.log(`  Price Drop: ${priceDropCount}`);

  return analyzed;
}

/**
 * Main function - load, analyze, and save products
 */
function main() {
  const inputFile = path.join(__dirname, '..', 'data', 'products.json');
  const outputFile = path.join(__dirname, '..', 'data', 'products.json');

  console.log('=== AI PRODUCT ANALYZER ===');
  console.log(`Input: ${inputFile}`);

  // Load products
  const products = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  console.log(`Loaded ${products.length} products`);

  // Analyze
  const analyzed = analyzeProducts(products);

  // Save
  fs.writeFileSync(outputFile, JSON.stringify(analyzed, null, 2));
  console.log(`\nSaved analyzed products to ${outputFile}`);

  // Show sample
  console.log('\n--- Sample Analyzed Product ---');
  const sample = analyzed.find(p => p.bestValue) || analyzed[0];
  console.log(JSON.stringify(sample, null, 2));
}

// Export for use in other scripts
module.exports = { analyzeProducts, detectGender, detectSmartCategory, calculateDealScore };

// Run if called directly
if (require.main === module) {
  main();
}
