/**
 * EU Scraper Test - Multi-Region System
 *
 * Tests all Europe-accessible retailers:
 * 1. Nike (GLOBAL - works everywhere)
 * 2. Foot Locker UK (EU, UK)
 * 3. JD Sports UK (EU, UK)
 * 4. Sports Direct UK (EU, UK)
 *
 * All products tagged with availableRegions for location-aware filtering
 */

const NikeScraper = require('./scrapers/brands/nike-puppeteer');
const FootLockerUKScraper = require('./scrapers/eu-retailers/footlocker-uk');
const JDSportsUKScraper = require('./scrapers/eu-retailers/jdsports-uk');
const SportsDirectUKScraper = require('./scrapers/eu-retailers/sportsdirect-uk');

async function testEUScrapers() {
  console.log('\n' + '='.repeat(80));
  console.log('🌍 EU MULTI-REGION SCRAPING TEST');
  console.log('='.repeat(80));
  console.log('\nTesting Europe-accessible retailers:');
  console.log('  ✅ Nike (GLOBAL - USD)');
  console.log('  ✅ Foot Locker UK (EU/UK - GBP)');
  console.log('  ✅ JD Sports UK (EU/UK - GBP)');
  console.log('  ✅ Sports Direct UK (EU/UK - GBP)');
  console.log('\n💡 No proxy needed - all accessible from EU IPs');
  console.log('='.repeat(80) + '\n');

  const allProducts = [];
  const results = {};

  // Test 1: Nike (GLOBAL)
  console.log('📋 TEST 1: Nike (GLOBAL)');
  console.log('-'.repeat(80));

  try {
    const nikeScraper = new NikeScraper({
      headless: true,
      maxProducts: 10
    });

    const nikeProducts = await nikeScraper.scrape();
    results.nike = {
      success: true,
      count: nikeProducts.length,
      regions: nikeProducts[0]?.availableRegions || [],
      currency: nikeProducts[0]?.currency || 'USD'
    };

    console.log(`✅ Nike: Found ${nikeProducts.length} products`);
    console.log(`   Regions: ${results.nike.regions.join(', ')}`);
    console.log(`   Currency: ${results.nike.currency}\n`);

    allProducts.push(...nikeProducts);
  } catch (error) {
    results.nike = { success: false, error: error.message };
    console.error(`❌ Nike error: ${error.message}\n`);
  }

  // Test 2: Foot Locker UK
  console.log('\n📋 TEST 2: Foot Locker UK (EU/UK)');
  console.log('-'.repeat(80));

  try {
    const footlockerScraper = new FootLockerUKScraper({
      headless: true,
      maxProducts: 10
    });

    const footlockerProducts = await footlockerScraper.searchBrand('adidas', 'trainers');
    results.footlockerUK = {
      success: true,
      count: footlockerProducts.length,
      regions: footlockerProducts[0]?.availableRegions || [],
      currency: footlockerProducts[0]?.currency || 'GBP'
    };

    console.log(`✅ Foot Locker UK: Found ${footlockerProducts.length} Adidas products`);
    console.log(`   Regions: ${results.footlockerUK.regions.join(', ')}`);
    console.log(`   Currency: ${results.footlockerUK.currency}\n`);

    allProducts.push(...footlockerProducts);
  } catch (error) {
    results.footlockerUK = { success: false, error: error.message };
    console.error(`❌ Foot Locker UK error: ${error.message}\n`);
  }

  // Test 3: JD Sports UK
  console.log('\n📋 TEST 3: JD Sports UK (EU/UK)');
  console.log('-'.repeat(80));

  try {
    const jdScraper = new JDSportsUKScraper({
      headless: true,
      maxProducts: 10
    });

    const jdProducts = await jdScraper.searchBrand('adidas', 'trainers');
    results.jdsportsUK = {
      success: true,
      count: jdProducts.length,
      regions: jdProducts[0]?.availableRegions || [],
      currency: jdProducts[0]?.currency || 'GBP'
    };

    console.log(`✅ JD Sports UK: Found ${jdProducts.length} Adidas products`);
    console.log(`   Regions: ${results.jdsportsUK.regions.join(', ')}`);
    console.log(`   Currency: ${results.jdsportsUK.currency}\n`);

    allProducts.push(...jdProducts);
  } catch (error) {
    results.jdsportsUK = { success: false, error: error.message };
    console.error(`❌ JD Sports UK error: ${error.message}\n`);
  }

  // Test 4: Sports Direct UK
  console.log('\n📋 TEST 4: Sports Direct UK (EU/UK)');
  console.log('-'.repeat(80));

  try {
    const sportsdirectScraper = new SportsDirectUKScraper({
      headless: true,
      maxProducts: 10
    });

    const sportsdirectProducts = await sportsdirectScraper.searchBrand('adidas', 'trainers');
    results.sportsdirectUK = {
      success: true,
      count: sportsdirectProducts.length,
      regions: sportsdirectProducts[0]?.availableRegions || [],
      currency: sportsdirectProducts[0]?.currency || 'GBP'
    };

    console.log(`✅ Sports Direct UK: Found ${sportsdirectProducts.length} Adidas products`);
    console.log(`   Regions: ${results.sportsdirectUK.regions.join(', ')}`);
    console.log(`   Currency: ${results.sportsdirectUK.currency}\n`);

    allProducts.push(...sportsdirectProducts);
  } catch (error) {
    results.sportsdirectUK = { success: false, error: error.message };
    console.error(`❌ Sports Direct UK error: ${error.message}\n`);
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
      console.log(`   ✅ ${source}: ${result.count} products (${result.regions?.join(', ')}) ${result.currency}`);
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

  // Group by region
  const byRegion = {
    'GLOBAL': [],
    'EU': [],
    'UK': [],
    'US': []
  };

  allProducts.forEach(p => {
    if (p.availableRegions) {
      p.availableRegions.forEach(region => {
        if (byRegion[region]) {
          byRegion[region].push(p);
        }
      });
    }
  });

  console.log('\n🌍 By Region Availability:');
  Object.entries(byRegion).forEach(([region, products]) => {
    if (products.length > 0) {
      console.log(`   ${region}: ${products.length} products`);
    }
  });

  // Currency breakdown
  const byCurrency = {};
  allProducts.forEach(p => {
    const curr = p.currency || 'UNKNOWN';
    if (!byCurrency[curr]) byCurrency[curr] = [];
    byCurrency[curr].push(p);
  });

  console.log('\n💰 By Currency:');
  Object.entries(byCurrency).forEach(([currency, products]) => {
    console.log(`   ${currency}: ${products.length} products`);
  });

  if (allProducts.length > 0) {
    console.log('\n📋 Sample Products:\n');

    allProducts.slice(0, 10).forEach((p, i) => {
      const price = p.currency === 'GBP' ? `£${p.salePrice}` : `$${p.salePrice}`;
      console.log(`${i + 1}. [${p.brand}] ${p.name}`);
      console.log(`   ${price} (${p.discount}% off)`);
      console.log(`   Regions: ${p.availableRegions?.join(', ')}`);
      console.log(`   Source: ${p.source}`);
      console.log('');
    });

    console.log('='.repeat(80));
    console.log('✅ SUCCESS: EU Multi-Region Scraping Works!');
    console.log('='.repeat(80));

    // Success metrics
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalTests = Object.keys(results).length;

    console.log('\n📈 Success Rate:');
    console.log(`   ${successCount}/${totalTests} scrapers working (${Math.round((successCount / totalTests) * 100)}%)`);

    console.log('\n🎯 Next Steps:');
    console.log('   1. Generate Prisma migration for region support');
    console.log('   2. Store products in database with region tags');
    console.log('   3. Create region-aware API endpoint (GET /api/deals?region=EU)');
    console.log('   4. Add frontend location detection');
    console.log('   5. Test with real users in different regions');
    console.log('   6. Add US region with proxy (Phase 2)');

    console.log('\n💡 Region Filtering Example:');
    console.log('   EU users see: Nike + Foot Locker UK + JD Sports UK + Sports Direct UK');
    console.log('   US users see: Nike + US retailers (when US region implemented)');
    console.log('   UK users see: ALL of the above (best selection!)');

    console.log('\n');
    process.exit(0);
  } else {
    console.log('\n❌ No products found with any scraper');
    console.log('\n📸 Check debug screenshots:');
    console.log('   - /tmp/footlocker-uk-debug.png');
    console.log('   - /tmp/jdsports-uk-debug.png');
    console.log('   - /tmp/sportsdirect-uk-debug.png');
    console.log('\n');
    process.exit(1);
  }
}

testEUScrapers().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
