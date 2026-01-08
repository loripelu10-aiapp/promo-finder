/**
 * Mango EU Scraper Test
 *
 * Tests the Mango EU scraper for women's shoes on sale
 * Validates:
 * - Real discounts only (10-70%)
 * - EUR currency
 * - EU regions (ES, FR, DE, IT, UK)
 * - Both original and sale prices required
 */

const MangoEUScraper = require('./scrapers/eu-retailers/mango-eu');

async function testMangoEU() {
  console.log('\n' + '='.repeat(80));
  console.log('🛍️  MANGO EU SCRAPER TEST');
  console.log('='.repeat(80));
  console.log('\nTarget: Women\'s Shoes on Sale');
  console.log('Currency: EUR (€)');
  console.log('Regions: EU, ES, FR, DE, IT, UK');
  console.log('Max Products: 30');
  console.log('Validation: Real discounts only (10-70%)');
  console.log('='.repeat(80) + '\n');

  try {
    const mangoScraper = new MangoEUScraper({
      headless: true,
      maxProducts: 30
    });

    console.log('🚀 Starting Mango EU scraper...\n');
    const products = await mangoScraper.scrape();

    console.log('\n' + '='.repeat(80));
    console.log('📊 SCRAPING RESULTS');
    console.log('='.repeat(80));

    if (products.length === 0) {
      console.log('\n⚠️  No products found!');
      console.log('\n📸 Check debug screenshot: /tmp/mango-eu-debug.png');
      console.log('\n💡 Possible issues:');
      console.log('   - Site structure changed (update selectors)');
      console.log('   - No items on sale currently');
      console.log('   - Anti-bot detection triggered');
      console.log('   - Network/connection issues');
      process.exit(1);
    }

    console.log(`\n✅ Total Products Found: ${products.length}`);

    // Validate all products have required fields
    console.log('\n🔍 Validating Product Data...\n');

    let validProducts = 0;
    let invalidProducts = 0;

    products.forEach((product, index) => {
      const issues = [];

      // Check required fields
      if (!product.name) issues.push('Missing name');
      if (!product.originalPrice) issues.push('Missing originalPrice');
      if (!product.salePrice) issues.push('Missing salePrice');
      if (!product.discount) issues.push('Missing discount');
      if (!product.url) issues.push('Missing URL');
      if (product.currency !== 'EUR') issues.push(`Wrong currency: ${product.currency}`);
      if (!product.availableRegions || !product.availableRegions.includes('EU')) {
        issues.push('Missing EU region tag');
      }

      // Validate discount range
      if (product.discount < 10 || product.discount > 70) {
        issues.push(`Discount out of range: ${product.discount}%`);
      }

      // Validate prices
      if (product.originalPrice <= product.salePrice) {
        issues.push('Original price not greater than sale price');
      }

      if (issues.length > 0) {
        console.log(`❌ Product ${index + 1}: ${product.name}`);
        console.log(`   Issues: ${issues.join(', ')}`);
        invalidProducts++;
      } else {
        validProducts++;
      }
    });

    console.log(`\n✅ Valid Products: ${validProducts}`);
    console.log(`❌ Invalid Products: ${invalidProducts}`);

    // Display sample products
    console.log('\n📋 Sample Products (First 5):\n');

    products.slice(0, 5).forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   Brand: ${product.brand}`);
      console.log(`   Original: €${product.originalPrice.toFixed(2)}`);
      console.log(`   Sale: €${product.salePrice.toFixed(2)}`);
      console.log(`   Discount: ${product.discount}%`);
      console.log(`   Regions: ${product.availableRegions.join(', ')}`);
      console.log(`   URL: ${product.url}`);
      console.log(`   Image: ${product.image ? '✅' : '❌'}`);
      console.log('');
    });

    // Statistics
    console.log('='.repeat(80));
    console.log('📈 STATISTICS');
    console.log('='.repeat(80));

    const avgDiscount = products.reduce((sum, p) => sum + p.discount, 0) / products.length;
    const avgOriginalPrice = products.reduce((sum, p) => sum + p.originalPrice, 0) / products.length;
    const avgSalePrice = products.reduce((sum, p) => sum + p.salePrice, 0) / products.length;
    const minDiscount = Math.min(...products.map(p => p.discount));
    const maxDiscount = Math.max(...products.map(p => p.discount));

    console.log(`\n💰 Price Statistics:`);
    console.log(`   Average Original Price: €${avgOriginalPrice.toFixed(2)}`);
    console.log(`   Average Sale Price: €${avgSalePrice.toFixed(2)}`);
    console.log(`   Average Discount: ${avgDiscount.toFixed(1)}%`);
    console.log(`   Min Discount: ${minDiscount}%`);
    console.log(`   Max Discount: ${maxDiscount}%`);

    // Discount distribution
    const discountRanges = {
      '10-20%': 0,
      '21-30%': 0,
      '31-40%': 0,
      '41-50%': 0,
      '51-60%': 0,
      '61-70%': 0
    };

    products.forEach(p => {
      const d = p.discount;
      if (d <= 20) discountRanges['10-20%']++;
      else if (d <= 30) discountRanges['21-30%']++;
      else if (d <= 40) discountRanges['31-40%']++;
      else if (d <= 50) discountRanges['41-50%']++;
      else if (d <= 60) discountRanges['51-60%']++;
      else discountRanges['61-70%']++;
    });

    console.log(`\n📊 Discount Distribution:`);
    Object.entries(discountRanges).forEach(([range, count]) => {
      if (count > 0) {
        const bar = '█'.repeat(Math.ceil(count / 2));
        console.log(`   ${range}: ${bar} (${count})`);
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ MANGO EU SCRAPER TEST COMPLETE');
    console.log('='.repeat(80));

    console.log('\n🎯 Summary:');
    console.log(`   ✅ ${validProducts} valid products`);
    console.log(`   ❌ ${invalidProducts} invalid products`);
    console.log(`   📦 Total: ${products.length} products`);
    console.log(`   🌍 Regions: ${products[0]?.availableRegions?.join(', ')}`);
    console.log(`   💰 Currency: ${products[0]?.currency}`);
    console.log(`   🏪 Source: ${products[0]?.source}`);

    console.log('\n💡 Next Steps:');
    console.log('   1. Add to test-eu-scrapers.js for integration testing');
    console.log('   2. Store products in database');
    console.log('   3. Create API endpoint for Mango deals');
    console.log('   4. Test from different EU regions (ES, FR, DE, IT)');

    console.log('\n');
    process.exit(0);

  } catch (error) {
    console.error('\n💥 Fatal error:', error);
    console.error('\nStack trace:', error.stack);
    console.log('\n📸 Check debug screenshot: /tmp/mango-eu-debug.png');
    process.exit(1);
  }
}

testMangoEU().catch(error => {
  console.error('\n💥 Unhandled error:', error);
  process.exit(1);
});
