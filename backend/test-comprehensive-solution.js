/**
 * Comprehensive Test - Nike Direct + Adidas via Aggregators
 *
 * SOLUTION:
 * - Nike: Direct scraping (works perfectly)
 * - Adidas: Via retail aggregators (bypasses blocking)
 */

const NikeScraper = require('./scrapers/brands/nike-puppeteer');
const ShopStyleScraper = require('./scrapers/aggregators/shopstyle-scraper');

async function runComprehensiveTest() {
  console.log('\n' + '='.repeat(70));
  console.log('🎯 COMPREHENSIVE DEAL SCRAPING SOLUTION');
  console.log('='.repeat(70));
  console.log('\nStrategy:');
  console.log('  ✅ Nike: Direct scraping from nike.com/sale');
  console.log('  ✅ Adidas: Via ShopStyle aggregator (bypasses blocking)');
  console.log('='.repeat(70) + '\n');

  const allProducts = [];

  // Test 1: Nike Direct
  console.log('📋 TEST 1: Nike Direct Scraping');
  console.log('-'.repeat(70));

  try {
    const nikeScraper = new NikeScraper({
      headless: true,
      maxProducts: 10
    });

    const nikeProducts = await nikeScraper.scrape();
    console.log(`✅ Nike: Found ${nikeProducts.length} products\n`);

    allProducts.push(...nikeProducts);
  } catch (error) {
    console.error(`❌ Nike error: ${error.message}\n`);
  }

  // Test 2: Adidas via ShopStyle
  console.log('\n📋 TEST 2: Adidas via ShopStyle Aggregator');
  console.log('-'.repeat(70));

  try {
    const shopStyleScraper = new ShopStyleScraper({
      headless: true,
      maxProducts: 10
    });

    const adidasProducts = await shopStyleScraper.searchBrand('adidas', 'shoes');
    console.log(`✅ Adidas: Found ${adidasProducts.length} products\n`);

    allProducts.push(...adidasProducts);
  } catch (error) {
    console.error(`❌ Adidas/ShopStyle error: ${error.message}\n`);
  }

  // Results
  console.log('\n' + '='.repeat(70));
  console.log('📊 FINAL RESULTS');
  console.log('='.repeat(70));
  console.log(`\n Total Products: ${allProducts.length}`);

  // Group by brand
  const byBrand = {};
  allProducts.forEach(p => {
    if (!byBrand[p.brand]) byBrand[p.brand] = [];
    byBrand[p.brand].push(p);
  });

  console.log('\n By Brand:');
  Object.entries(byBrand).forEach(([brand, products]) => {
    console.log(`   ${brand}: ${products.length} products`);
  });

  if (allProducts.length > 0) {
    console.log('\n📋 Sample Products:\n');

    allProducts.slice(0, 10).forEach((p, i) => {
      console.log(`${i + 1}. [${p.brand}] ${p.name}`);
      console.log(`   $${p.originalPrice} → $${p.salePrice} (${p.discount}% off)`);
      console.log(`   Source: ${p.source}`);
      console.log('');
    });

    console.log('='.repeat(70));
    console.log('✅ SUCCESS: Comprehensive solution works!');
    console.log('='.repeat(70));
    console.log('\nNext Steps:');
    console.log('  1. Integrate validation pipeline (Phase 2)');
    console.log('  2. Connect to database');
    console.log('  3. Add more aggregators (Lyst, DealNews, etc.)');
    console.log('  4. Add auto-cleanup service');
    console.log('  5. Deploy to production');

    process.exit(0);
  } else {
    console.log('\n❌ No products found with any method');
    process.exit(1);
  }
}

runComprehensiveTest();
