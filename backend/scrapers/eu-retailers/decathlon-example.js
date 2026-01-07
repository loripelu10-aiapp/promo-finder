/**
 * Decathlon EU Scraper - Usage Examples
 *
 * This file demonstrates various ways to use the Decathlon scraper
 */

const DecathlonEUScraper = require('./decathlon-eu');

// Example 1: Basic usage with default settings
async function basicExample() {
  console.log('Example 1: Basic Usage\n');

  const scraper = new DecathlonEUScraper();
  const products = await scraper.scrape();

  console.log(`Found ${products.length} sports shoes on sale`);
  console.log('\nSample product:');
  console.log(JSON.stringify(products[0], null, 2));
}

// Example 2: Custom configuration
async function customConfigExample() {
  console.log('\n\nExample 2: Custom Configuration\n');

  const scraper = new DecathlonEUScraper({
    maxProducts: 50,      // Get more products
    scrollDelay: 4000,    // Slower scrolling
    rateLimit: 5000,      // More conservative rate limiting
    timeout: 90000,       // Longer timeout
    headless: false       // Show browser (for debugging)
  });

  const products = await scraper.scrape();
  console.log(`Extracted ${products.length} products with custom config`);
}

// Example 3: Filter by discount percentage
async function filterByDiscountExample() {
  console.log('\n\nExample 3: Filter High Discounts (>30%)\n');

  const scraper = new DecathlonEUScraper({ maxProducts: 30 });
  const allProducts = await scraper.scrape();

  const highDiscounts = allProducts.filter(p => p.discount >= 30);

  console.log(`Total products: ${allProducts.length}`);
  console.log(`High discount products (>30%): ${highDiscounts.length}`);

  highDiscounts.slice(0, 5).forEach((product, i) => {
    console.log(`\n${i + 1}. ${product.name}`);
    console.log(`   ${product.discount}% off: £${product.salePrice} (was £${product.originalPrice})`);
  });
}

// Example 4: Filter by brand
async function filterByBrandExample() {
  console.log('\n\nExample 4: Filter by Brand\n');

  const scraper = new DecathlonEUScraper({ maxProducts: 30 });
  const allProducts = await scraper.scrape();

  // Group by brand
  const byBrand = {};
  allProducts.forEach(p => {
    if (!byBrand[p.brand]) {
      byBrand[p.brand] = [];
    }
    byBrand[p.brand].push(p);
  });

  console.log('Products by brand:');
  Object.entries(byBrand).forEach(([brand, products]) => {
    console.log(`  ${brand}: ${products.length} products`);
  });

  // Show Kalenji (Decathlon running brand) deals
  if (byBrand['Kalenji']) {
    console.log('\nKalenji Running Shoes:');
    byBrand['Kalenji'].forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.name} - ${p.discount}% off (£${p.salePrice})`);
    });
  }
}

// Example 5: Filter by category
async function filterByCategoryExample() {
  console.log('\n\nExample 5: Filter by Category\n');

  const scraper = new DecathlonEUScraper({ maxProducts: 30 });
  const allProducts = await scraper.scrape();

  // Group by category
  const byCategory = {};
  allProducts.forEach(p => {
    const cat = p.category || 'other';
    if (!byCategory[cat]) {
      byCategory[cat] = [];
    }
    byCategory[cat].push(p);
  });

  console.log('Products by category:');
  Object.entries(byCategory).forEach(([category, products]) => {
    console.log(`  ${category}: ${products.length} products`);
    if (products.length > 0) {
      console.log(`     Best deal: ${products[0].name} (${products[0].discount}% off)`);
    }
  });
}

// Example 6: Price range filtering
async function filterByPriceExample() {
  console.log('\n\nExample 6: Filter by Price Range\n');

  const scraper = new DecathlonEUScraper({ maxProducts: 30 });
  const allProducts = await scraper.scrape();

  const budgetFriendly = allProducts.filter(p => p.salePrice <= 40);
  const midRange = allProducts.filter(p => p.salePrice > 40 && p.salePrice <= 80);
  const premium = allProducts.filter(p => p.salePrice > 80);

  console.log(`Budget (≤£40): ${budgetFriendly.length} products`);
  console.log(`Mid-range (£40-£80): ${midRange.length} products`);
  console.log(`Premium (>£80): ${premium.length} products`);

  if (budgetFriendly.length > 0) {
    console.log('\nBest budget deals:');
    budgetFriendly.slice(0, 3).forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.name} - £${p.salePrice} (${p.discount}% off)`);
    });
  }
}

// Example 7: Calculate total savings
async function calculateSavingsExample() {
  console.log('\n\nExample 7: Calculate Total Savings\n');

  const scraper = new DecathlonEUScraper({ maxProducts: 30 });
  const products = await scraper.scrape();

  const totalOriginal = products.reduce((sum, p) => sum + p.originalPrice, 0);
  const totalSale = products.reduce((sum, p) => sum + p.salePrice, 0);
  const totalSavings = totalOriginal - totalSale;
  const avgDiscount = products.reduce((sum, p) => sum + p.discount, 0) / products.length;

  console.log(`Products found: ${products.length}`);
  console.log(`Total original value: £${totalOriginal.toFixed(2)}`);
  console.log(`Total sale value: £${totalSale.toFixed(2)}`);
  console.log(`Total savings: £${totalSavings.toFixed(2)}`);
  console.log(`Average discount: ${avgDiscount.toFixed(1)}%`);
}

// Example 8: Export to JSON
async function exportToJsonExample() {
  console.log('\n\nExample 8: Export to JSON\n');

  const scraper = new DecathlonEUScraper({ maxProducts: 30 });
  const products = await scraper.scrape();

  const fs = require('fs');
  const outputPath = '/tmp/decathlon-shoes.json';

  fs.writeFileSync(outputPath, JSON.stringify(products, null, 2));
  console.log(`Exported ${products.length} products to ${outputPath}`);
}

// Example 9: Error handling
async function errorHandlingExample() {
  console.log('\n\nExample 9: Proper Error Handling\n');

  const scraper = new DecathlonEUScraper({ maxProducts: 30 });

  try {
    const products = await scraper.scrape();

    if (products.length === 0) {
      console.log('⚠️  No products found. Possible reasons:');
      console.log('  - Site structure changed (check debug screenshot)');
      console.log('  - Network issues');
      console.log('  - Site is blocking scraper');
      console.log('  - No shoes on sale today');
    } else {
      console.log(`✅ Successfully scraped ${products.length} products`);
    }

  } catch (error) {
    console.error('❌ Scraping failed:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Type: ${error.constructor.name}`);

    // Handle specific error types
    if (error.message.includes('timeout')) {
      console.log('   → Try increasing the timeout in config');
    } else if (error.message.includes('net::ERR')) {
      console.log('   → Check internet connection');
    } else if (error.message.includes('403') || error.message.includes('blocked')) {
      console.log('   → Site may be blocking the scraper');
      console.log('   → Consider using a proxy');
    }
  } finally {
    // Scraper automatically closes browser
    console.log('Cleanup complete');
  }
}

// Example 10: Compare with other scrapers
async function compareWithOthersExample() {
  console.log('\n\nExample 10: Compare Multiple Retailers\n');

  const DecathlonScraper = require('./decathlon-eu');
  const FootLockerScraper = require('./footlocker-uk');

  console.log('Scraping Decathlon...');
  const decathlonScraper = new DecathlonScraper({ maxProducts: 20 });
  const decathlonProducts = await decathlonScraper.scrape();

  console.log('Scraping Foot Locker...');
  const footlockerScraper = new FootLockerScraper({ maxProducts: 20 });
  const footlockerProducts = await footlockerScraper.scrape();

  console.log('\n📊 Comparison:');
  console.log(`Decathlon: ${decathlonProducts.length} products, avg ${(decathlonProducts.reduce((s, p) => s + p.discount, 0) / decathlonProducts.length).toFixed(1)}% off`);
  console.log(`Foot Locker: ${footlockerProducts.length} products, avg ${(footlockerProducts.reduce((s, p) => s + p.discount, 0) / footlockerProducts.length).toFixed(1)}% off`);
}

// Run examples
async function runExamples() {
  const examples = [
    { name: 'Basic Usage', fn: basicExample },
    { name: 'Custom Config', fn: customConfigExample },
    { name: 'Filter High Discounts', fn: filterByDiscountExample },
    { name: 'Filter by Brand', fn: filterByBrandExample },
    { name: 'Filter by Category', fn: filterByCategoryExample },
    { name: 'Filter by Price', fn: filterByPriceExample },
    { name: 'Calculate Savings', fn: calculateSavingsExample },
    { name: 'Export to JSON', fn: exportToJsonExample },
    { name: 'Error Handling', fn: errorHandlingExample },
    // { name: 'Compare Retailers', fn: compareWithOthersExample } // Commented out - requires multiple scrapers
  ];

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   Decathlon EU Scraper - Usage Examples                  ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  // Get example number from command line argument
  const exampleNum = parseInt(process.argv[2]);

  if (exampleNum && exampleNum >= 1 && exampleNum <= examples.length) {
    console.log(`\nRunning Example ${exampleNum}: ${examples[exampleNum - 1].name}\n`);
    await examples[exampleNum - 1].fn();
  } else {
    console.log('\nUsage: node decathlon-example.js [example_number]\n');
    console.log('Available examples:');
    examples.forEach((ex, i) => {
      console.log(`  ${i + 1}. ${ex.name}`);
    });
    console.log('\nExample: node decathlon-example.js 1');
  }
}

// Run if called directly
if (require.main === module) {
  runExamples().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  basicExample,
  customConfigExample,
  filterByDiscountExample,
  filterByBrandExample,
  filterByCategoryExample,
  filterByPriceExample,
  calculateSavingsExample,
  exportToJsonExample,
  errorHandlingExample,
  compareWithOthersExample
};
