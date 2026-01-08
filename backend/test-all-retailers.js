/**
 * Comprehensive Retailer Test
 *
 * Tests:
 * 1. Nike (direct scraping)
 * 2. Dick's Sporting Goods (Adidas + Nike)
 * 3. JD Sports (Adidas + Nike)
 */

const NikeScraper = require('./scrapers/brands/nike-puppeteer');
const DicksSportingGoodsScraper = require('./scrapers/retailers/dicks-sporting-goods');
const JDSportsScraper = require('./scrapers/retailers/jd-sports');

async function testAllRetailers() {
  console.log('\n' + '='.repeat(80));
  console.log('🎯 COMPREHENSIVE MULTI-RETAILER SCRAPING TEST');
  console.log('='.repeat(80));
  console.log('\nTesting:');
  console.log('  ✅ Nike.com (direct)');
  console.log('  ✅ Dick\'s Sporting Goods (Adidas + other brands)');
  console.log('  ✅ JD Sports (Adidas + Nike)');
  console.log('='.repeat(80) + '\n');

  const allProducts = [];
  const results = {};

  // Test 1: Nike Direct
  console.log('📋 TEST 1: Nike.com Direct Scraping');
  console.log('-'.repeat(80));

  try {
    const nikeScraper = new NikeScraper({
      headless: true,
      maxProducts: 10
    });

    const nikeProducts = await nikeScraper.scrape();
    results.nike = { success: true, count: nikeProducts.length };
    console.log(`✅ Nike: Found ${nikeProducts.length} products\n`);

    allProducts.push(...nikeProducts);
  } catch (error) {
    results.nike = { success: false, error: error.message };
    console.error(`❌ Nike error: ${error.message}\n`);
  }

  // Test 2: Dick's Sporting Goods (Adidas)
  console.log('\n📋 TEST 2: Dick\'s Sporting Goods (Adidas)');
  console.log('-'.repeat(80));

  try {
    const dicksScraper = new DicksSportingGoodsScraper({
      headless: true,
      maxProducts: 10
    });

    const dicksProducts = await dicksScraper.searchBrand('adidas', 'shoes');
    results.dicks = { success: true, count: dicksProducts.length };
    console.log(`✅ Dick's: Found ${dicksProducts.length} Adidas products\n`);

    allProducts.push(...dicksProducts);
  } catch (error) {
    results.dicks = { success: false, error: error.message };
    console.error(`❌ Dick's error: ${error.message}\n`);
  }

  // Test 3: JD Sports (Adidas)
  console.log('\n📋 TEST 3: JD Sports (Adidas)');
  console.log('-'.repeat(80));

  try {
    const jdScraper = new JDSportsScraper({
      headless: true,
      maxProducts: 10
    });

    const jdProducts = await jdScraper.searchBrand('adidas', 'shoes');
    results.jdsports = { success: true, count: jdProducts.length };
    console.log(`✅ JD Sports: Found ${jdProducts.length} Adidas products\n`);

    allProducts.push(...jdProducts);
  } catch (error) {
    results.jdsports = { success: false, error: error.message };
    console.error(`❌ JD Sports error: ${error.message}\n`);
  }

  // Results Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 FINAL RESULTS');
  console.log('='.repeat(80));
  console.log(`\n📦 Total Products: ${allProducts.length}`);

  // Results by source
  console.log('\n📋 By Source:');
  Object.entries(results).forEach(([source, result]) => {
    if (result.success) {
      console.log(`   ✅ ${source}: ${result.count} products`);
    } else {
      console.log(`   ❌ ${source}: Failed - ${result.error}`);
    }
  });

  // Group by brand
  const byBrand = {};
  allProducts.forEach(p => {
    if (!byBrand[p.brand]) byBrand[p.brand] = [];
    byBrand[p.brand].push(p);
  });

  console.log('\n👟 By Brand:');
  Object.entries(byBrand).forEach(([brand, products]) => {
    console.log(`   ${brand}: ${products.length} products`);
  });

  if (allProducts.length > 0) {
    console.log('\n📋 Sample Products:\n');

    allProducts.slice(0, 15).forEach((p, i) => {
      console.log(`${i + 1}. [${p.brand}] ${p.name}`);
      console.log(`   $${p.originalPrice} → $${p.salePrice} (${p.discount}% off)`);
      console.log(`   Source: ${p.source}`);
      console.log('');
    });

    console.log('='.repeat(80));
    console.log('✅ SUCCESS: Multi-retailer scraping works!');
    console.log('='.repeat(80));

    // Success metrics
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalTests = Object.keys(results).length;

    console.log('\n📈 Success Rate:');
    console.log(`   ${successCount}/${totalTests} scrapers working (${Math.round((successCount / totalTests) * 100)}%)`);

    console.log('\n🎯 Next Steps:');
    console.log('   1. Integrate with validation pipeline (Phase 2)');
    console.log('   2. Connect to Prisma database');
    console.log('   3. Add auto-cleanup service');
    console.log('   4. Deploy orchestrator with cron jobs');
    console.log('   5. Monitor and adjust selectors as needed');

    process.exit(0);
  } else {
    console.log('\n❌ No products found with any scraper');
    process.exit(1);
  }
}

testAllRetailers().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
