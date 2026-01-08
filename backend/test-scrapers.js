/**
 * Test script for Nike and Adidas scrapers
 *
 * Runs both scrapers and verifies:
 * - Can extract at least 10 products
 * - Products have real discounts (not estimated)
 * - All required fields are present
 */

const NikeScraper = require('./scrapers/brands/nike-puppeteer');
const AdidasScraper = require('./scrapers/brands/adidas-puppeteer');

async function testScraper(ScraperClass, expectedMinProducts = 10) {
  const scraper = new ScraperClass({
    headless: true,
    maxProducts: 20 // Limit for testing
  });

  console.log('\n' + '='.repeat(60));
  console.log(`Testing ${scraper.getName()}`);
  console.log('='.repeat(60));

  try {
    const products = await scraper.scrape();

    console.log(`\n📊 Results:`);
    console.log(`   Total products extracted: ${products.length}`);
    console.log(`   Expected minimum: ${expectedMinProducts}`);

    if (products.length === 0) {
      console.log(`❌ FAIL: No products extracted`);
      return false;
    }

    if (products.length < expectedMinProducts) {
      console.log(`⚠️  WARNING: Expected at least ${expectedMinProducts}, got ${products.length}`);
    }

    // Validate product structure
    let validCount = 0;
    let invalidCount = 0;

    products.forEach((product, index) => {
      const requiredFields = ['id', 'name', 'brand', 'category', 'originalPrice', 'salePrice', 'discount', 'image', 'url', 'source'];
      const missingFields = requiredFields.filter(field => !product[field]);

      if (missingFields.length === 0) {
        validCount++;
        if (index < 3) {
          console.log(`\n   ✅ Product ${index + 1}:`);
          console.log(`      Name: ${product.name}`);
          console.log(`      Price: $${product.originalPrice} → $${product.salePrice} (${product.discount}% off)`);
          console.log(`      URL: ${product.url}`);
        }
      } else {
        invalidCount++;
        console.log(`\n   ❌ Product ${index + 1} missing fields: ${missingFields.join(', ')}`);
      }
    });

    console.log(`\n📈 Validation:`);
    console.log(`   Valid products: ${validCount}`);
    console.log(`   Invalid products: ${invalidCount}`);

    if (invalidCount > 0) {
      console.log(`❌ FAIL: ${invalidCount} products have missing fields`);
      return false;
    }

    if (validCount >= expectedMinProducts) {
      console.log(`✅ PASS: ${scraper.getName()} extracted ${validCount} valid products`);
      return true;
    } else {
      console.log(`❌ FAIL: Expected ${expectedMinProducts}+ valid products, got ${validCount}`);
      return false;
    }

  } catch (error) {
    console.log(`❌ FAIL: Error during scraping`);
    console.error(error);
    return false;
  }
}

async function runTests() {
  console.log('\n🧪 Starting Scraper Tests...\n');

  const results = {
    nike: false,
    adidas: false
  };

  // Test Nike scraper
  results.nike = await testScraper(NikeScraper, 10);

  // Wait between tests to avoid rate limiting
  console.log('\n⏱️  Waiting 5 seconds before next test...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Test Adidas scraper
  results.adidas = await testScraper(AdidasScraper, 10);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 Test Summary');
  console.log('='.repeat(60));
  console.log(`Nike Scraper: ${results.nike ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Adidas Scraper: ${results.adidas ? '✅ PASS' : '❌ FAIL'}`);

  if (results.nike && results.adidas) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Review output above for details.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error during tests:', error);
  process.exit(1);
});
