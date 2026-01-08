const JDSportsUKScraper = require('./scrapers/eu-retailers/jdsports-uk');
const SportsDirectScraper = require('./scrapers/eu-retailers/sportsdirect-uk');
const FootLockerUKScraper = require('./scrapers/eu-retailers/footlocker-uk');
const HMEUScraper = require('./scrapers/eu-retailers/hm-eu');
const ZaraEUScraper = require('./scrapers/eu-retailers/zara-eu');
const MangoEUScraper = require('./scrapers/eu-retailers/mango-eu');
const DecathlonEUScraper = require('./scrapers/eu-retailers/decathlon-eu');

/**
 * Comprehensive Test Suite for All EU Scrapers
 *
 * Tests all 7 EU/UK retailers:
 * - JD Sports UK
 * - Sports Direct UK
 * - Foot Locker UK (with fixed name extraction)
 * - H&M EU (NEW)
 * - Zara EU (NEW)
 * - Mango EU (NEW)
 * - Decathlon EU (NEW)
 */

async function testScraper(ScraperClass, scraperName) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 Testing ${scraperName}`);
  console.log('='.repeat(70));

  const scraper = new ScraperClass({ maxProducts: 10 });

  try {
    console.log('⏳ Scraping products...');
    const startTime = Date.now();
    const products = await scraper.scrape();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n📊 Results: ${products.length} products extracted in ${duration}s`);

    if (products.length === 0) {
      console.log('❌ No products found');
      return {
        scraper: scraperName,
        success: false,
        count: 0,
        duration: parseFloat(duration),
        avgDiscount: 0,
        products: []
      };
    }

    // Calculate stats
    const avgDiscount = products.reduce((sum, p) => sum + p.discount, 0) / products.length;
    const avgOriginalPrice = products.reduce((sum, p) => sum + p.originalPrice, 0) / products.length;
    const avgSalePrice = products.reduce((sum, p) => sum + p.salePrice, 0) / products.length;

    console.log(`\n📈 Statistics:`);
    console.log(`   Average discount: ${avgDiscount.toFixed(1)}%`);
    console.log(`   Average original price: ${products[0].currency}${avgOriginalPrice.toFixed(2)}`);
    console.log(`   Average sale price: ${products[0].currency}${avgSalePrice.toFixed(2)}`);
    console.log(`   Currency: ${products[0].currency}`);
    console.log(`   Regions: ${products[0].availableRegions?.join(', ')}`);

    // Validate products have clean names (no sale text)
    const dirtyNames = products.filter(p => {
      const nameLower = p.name.toLowerCase();
      return nameLower.includes('save £') ||
             nameLower.includes('sale') ||
             nameLower.includes('price dropped') ||
             nameLower.match(/£\s*\d+/);
    });

    if (dirtyNames.length > 0) {
      console.log(`\n⚠️  WARNING: ${dirtyNames.length} products have messy names:`);
      dirtyNames.slice(0, 3).forEach(p => {
        console.log(`   - "${p.name.substring(0, 80)}..."`);
      });
    } else {
      console.log(`\n✅ All product names are clean!`);
    }

    // Validate real discounts (not estimated)
    const estimatedDiscounts = products.filter(p => {
      // Check if discount is exactly 30% (common estimation pattern)
      if (Math.abs(p.discount - 30) < 0.1) {
        const expectedOriginal = p.salePrice * 1.3;
        // If original price matches 1.3x pattern exactly, it's likely estimated
        return Math.abs(p.originalPrice - expectedOriginal) < 0.01;
      }
      return false;
    });

    if (estimatedDiscounts.length > 0) {
      console.log(`\n⚠️  WARNING: ${estimatedDiscounts.length} products may have estimated discounts (30% 1.3x pattern)`);
    } else {
      console.log(`✅ All discounts appear to be real!`);
    }

    // Show first 3 products
    console.log('\n📦 Sample products:\n');
    products.slice(0, 3).forEach((p, i) => {
      console.log(`${i + 1}. ${p.name.substring(0, 60)}${p.name.length > 60 ? '...' : ''}`);
      console.log(`   Brand: ${p.brand}`);
      console.log(`   Price: ${p.currency}${p.salePrice.toFixed(2)} (was ${p.currency}${p.originalPrice.toFixed(2)})`);
      console.log(`   Discount: ${p.discount}%`);
      console.log(`   Category: ${p.category}`);
      console.log(`   Image: ${p.image ? (p.image.substring(0, 50) + '...') : 'N/A'}`);
      console.log(`   URL: ${p.url ? (p.url.substring(0, 50) + '...') : 'N/A'}`);
      console.log('');
    });

    console.log(`✅ ${scraperName} working! ${products.length} products found`);

    return {
      scraper: scraperName,
      success: true,
      count: products.length,
      duration: parseFloat(duration),
      avgDiscount: avgDiscount,
      currency: products[0].currency,
      regions: products[0].availableRegions || [],
      products: products
    };

  } catch (error) {
    console.log(`\n❌ Scraper failed:`);
    console.log(`   ${error.message}`);
    console.log(`   Stack: ${error.stack?.split('\n')[1]?.trim()}`);

    return {
      scraper: scraperName,
      success: false,
      count: 0,
      duration: 0,
      avgDiscount: 0,
      error: error.message,
      products: []
    };
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║     COMPREHENSIVE EU/UK SCRAPERS TEST SUITE                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('\nTesting all 7 EU/UK retail scrapers...\n');

  const scrapers = [
    // Existing UK scrapers
    { Class: JDSportsUKScraper, name: 'JD Sports UK' },
    { Class: SportsDirectScraper, name: 'Sports Direct UK' },
    { Class: FootLockerUKScraper, name: 'Foot Locker UK (Fixed)' },

    // NEW EU scrapers
    { Class: HMEUScraper, name: 'H&M EU' },
    { Class: ZaraEUScraper, name: 'Zara EU' },
    { Class: MangoEUScraper, name: 'Mango EU' },
    { Class: DecathlonEUScraper, name: 'Decathlon EU' }
  ];

  const results = [];
  const DELAY_BETWEEN_SCRAPERS = 5000; // 5 seconds

  for (let i = 0; i < scrapers.length; i++) {
    const { Class, name } = scrapers[i];
    const result = await testScraper(Class, name);
    results.push(result);

    // Delay before next scraper (except for last one)
    if (i < scrapers.length - 1) {
      console.log(`\n⏳ Waiting 5 seconds before next scraper...\n`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_SCRAPERS));
    }
  }

  // Final Summary
  console.log('\n\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                         FINAL SUMMARY                            ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  // Group by status
  const working = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log('✅ WORKING SCRAPERS:\n');
  working.forEach(r => {
    console.log(`   ${r.scraper}`);
    console.log(`      Products: ${r.count}`);
    console.log(`      Avg Discount: ${r.avgDiscount.toFixed(1)}%`);
    console.log(`      Currency: ${r.currency}`);
    console.log(`      Regions: ${r.regions?.join(', ') || 'N/A'}`);
    console.log(`      Duration: ${r.duration}s`);
    console.log('');
  });

  if (failed.length > 0) {
    console.log('❌ FAILED SCRAPERS:\n');
    failed.forEach(r => {
      console.log(`   ${r.scraper}`);
      console.log(`      Error: ${r.error || 'No products found'}`);
      console.log('');
    });
  }

  // Overall stats
  const totalProducts = results.reduce((sum, r) => sum + r.count, 0);
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const avgDiscountAll = working.length > 0
    ? working.reduce((sum, r) => sum + (r.avgDiscount * r.count), 0) / totalProducts
    : 0;

  console.log('═'.repeat(70));
  console.log(`📊 Overall Statistics:`);
  console.log('═'.repeat(70));
  console.log(`Total scrapers tested: ${results.length}`);
  console.log(`Working scrapers: ${working.length} (${((working.length / results.length) * 100).toFixed(0)}%)`);
  console.log(`Failed scrapers: ${failed.length}`);
  console.log(`Total products extracted: ${totalProducts}`);
  console.log(`Average products per scraper: ${(totalProducts / working.length).toFixed(1)}`);
  console.log(`Average discount across all products: ${avgDiscountAll.toFixed(1)}%`);
  console.log(`Total time: ${totalDuration.toFixed(1)}s`);
  console.log(`Average time per scraper: ${(totalDuration / results.length).toFixed(1)}s`);

  // Breakdown by currency
  console.log(`\n💰 Products by Currency:`);
  const byCurrency = {};
  working.forEach(r => {
    if (!byCurrency[r.currency]) byCurrency[r.currency] = 0;
    byCurrency[r.currency] += r.count;
  });
  Object.entries(byCurrency).forEach(([currency, count]) => {
    console.log(`   ${currency}: ${count} products`);
  });

  // Breakdown by region
  console.log(`\n🌍 Scrapers by Region Coverage:`);
  const byRegion = {};
  working.forEach(r => {
    const regions = r.regions || [];
    regions.forEach(region => {
      if (!byRegion[region]) byRegion[region] = [];
      byRegion[region].push(r.scraper);
    });
  });
  Object.entries(byRegion).forEach(([region, scrapers]) => {
    console.log(`   ${region}: ${scrapers.length} scrapers (${scrapers.join(', ')})`);
  });

  // Final verdict
  console.log('\n' + '═'.repeat(70));
  if (working.length === results.length) {
    console.log('🎉 ALL SCRAPERS WORKING! Ready for production!');
  } else if (working.length >= results.length * 0.8) {
    console.log(`✅ Most scrapers working (${working.length}/${results.length})`);
    console.log(`⚠️  Fix failed scrapers before production`);
  } else {
    console.log(`⚠️  Only ${working.length}/${results.length} scrapers working`);
    console.log(`❌ Significant issues detected - troubleshooting required`);
  }
  console.log('═'.repeat(70) + '\n');

  // Export results to JSON
  const fs = require('fs');
  const resultsPath = '/tmp/eu-scrapers-test-results.json';
  fs.writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      working: working.length,
      failed: failed.length,
      totalProducts: totalProducts,
      avgDiscount: avgDiscountAll
    },
    results: results.map(r => ({
      scraper: r.scraper,
      success: r.success,
      count: r.count,
      avgDiscount: r.avgDiscount,
      currency: r.currency,
      regions: r.regions,
      duration: r.duration,
      error: r.error
    }))
  }, null, 2));

  console.log(`📄 Full results exported to: ${resultsPath}\n`);

  process.exit(working.length === results.length ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
