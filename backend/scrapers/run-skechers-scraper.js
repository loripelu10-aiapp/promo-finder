/**
 * Run Skechers Scraper
 *
 * Scrapes Skechers sale page for products with real discounts
 * Saves results to /tmp/skechers-products.json
 */

const SkechersScraper = require('./brands/skechers-scraper');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = '/tmp/skechers-products.json';

async function runSkechersScraper() {
  console.log('='.repeat(60));
  console.log('Skechers Sale Scraper');
  console.log('='.repeat(60));
  console.log(`Target: https://www.skechers.com/sale/`);
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log(`Goal: 100+ products with real discounts`);
  console.log('='.repeat(60));

  const startTime = Date.now();

  try {
    // Initialize scraper with configuration for maximum products
    const scraper = new SkechersScraper({
      maxProducts: 200,
      headless: true, // Set to false for debugging
      timeout: 60000,
      scrollDelay: 3000
    });

    // Run the scraper
    console.log('\nStarting scraper...\n');
    const products = await scraper.scrape();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Prepare output data
    const output = {
      metadata: {
        source: 'https://www.skechers.com/sale/',
        brand: 'Skechers',
        scrapedAt: new Date().toISOString(),
        durationSeconds: parseFloat(duration),
        totalProducts: products.length
      },
      products: products
    };

    // Save to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('SCRAPING COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total products found: ${products.length}`);
    console.log(`Duration: ${duration} seconds`);
    console.log(`Output saved to: ${OUTPUT_FILE}`);

    // Print category breakdown
    const categories = {};
    products.forEach(p => {
      categories[p.category] = (categories[p.category] || 0) + 1;
    });
    console.log('\nCategory breakdown:');
    Object.entries(categories).forEach(([cat, count]) => {
      console.log(`  - ${cat}: ${count}`);
    });

    // Print discount breakdown
    const discountRanges = {
      '10-20%': 0,
      '21-30%': 0,
      '31-40%': 0,
      '41-50%': 0,
      '51-70%': 0
    };
    products.forEach(p => {
      if (p.discount >= 10 && p.discount <= 20) discountRanges['10-20%']++;
      else if (p.discount >= 21 && p.discount <= 30) discountRanges['21-30%']++;
      else if (p.discount >= 31 && p.discount <= 40) discountRanges['31-40%']++;
      else if (p.discount >= 41 && p.discount <= 50) discountRanges['41-50%']++;
      else if (p.discount >= 51 && p.discount <= 70) discountRanges['51-70%']++;
    });
    console.log('\nDiscount breakdown:');
    Object.entries(discountRanges).forEach(([range, count]) => {
      console.log(`  - ${range}: ${count}`);
    });

    // Print sample products
    console.log('\nSample products:');
    products.slice(0, 5).forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.name}`);
      console.log(`   Price: $${p.originalPrice} -> $${p.salePrice} (${p.discount}% off)`);
      console.log(`   Category: ${p.category}`);
      console.log(`   URL: ${p.url}`);
    });

    console.log('\n' + '='.repeat(60));

    return products;

  } catch (error) {
    console.error('\nFATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the scraper
runSkechersScraper()
  .then(products => {
    if (products.length >= 100) {
      console.log(`\nSUCCESS: Goal of 100+ products achieved (${products.length} products)`);
    } else {
      console.log(`\nWARNING: Only found ${products.length} products (goal was 100+)`);
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
