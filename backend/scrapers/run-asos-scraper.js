/**
 * ASOS Scraper Runner
 *
 * Runs the ASOS scraper and saves output to /tmp/asos-scrape-output.txt
 */

const ASOSScraper = require('./brands/asos-scraper');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = '/tmp/asos-scrape-output.txt';

async function runASOSScraper() {
  console.log('='.repeat(60));
  console.log('ASOS Sale Products Scraper');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Output file: ${OUTPUT_FILE}`);
  console.log('');

  const scraper = new ASOSScraper({
    maxProducts: 120,
    headless: true,
    scrollDelay: 2500,
    timeout: 60000
  });

  try {
    const products = await scraper.scrape();

    console.log('\n' + '='.repeat(60));
    console.log('SCRAPING RESULTS');
    console.log('='.repeat(60));
    console.log(`Total products scraped: ${products.length}`);

    if (products.length > 0) {
      // Calculate some statistics
      const avgDiscount = Math.round(products.reduce((sum, p) => sum + p.discount, 0) / products.length);
      const avgOriginalPrice = Math.round(products.reduce((sum, p) => sum + p.originalPrice, 0) / products.length);
      const avgSalePrice = Math.round(products.reduce((sum, p) => sum + p.salePrice, 0) / products.length);

      console.log(`Average discount: ${avgDiscount}%`);
      console.log(`Average original price: $${avgOriginalPrice}`);
      console.log(`Average sale price: $${avgSalePrice}`);
      console.log('');

      // Show sample products
      console.log('Sample products:');
      products.slice(0, 5).forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.name.substring(0, 50)}...`);
        console.log(`     Price: $${p.originalPrice} -> $${p.salePrice} (${p.discount}% off)`);
        console.log(`     URL: ${p.url}`);
      });
    }

    // Save to output file
    const outputData = JSON.stringify(products, null, 2);
    fs.writeFileSync(OUTPUT_FILE, outputData, 'utf8');
    console.log(`\nOutput saved to: ${OUTPUT_FILE}`);
    console.log(`File size: ${(Buffer.byteLength(outputData, 'utf8') / 1024).toFixed(2)} KB`);

    console.log('\n' + '='.repeat(60));
    console.log(`Completed at: ${new Date().toISOString()}`);
    console.log('='.repeat(60));

    return products;

  } catch (error) {
    console.error('Fatal error:', error);

    // Save error to output file
    const errorOutput = JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString(),
      products: []
    }, null, 2);
    fs.writeFileSync(OUTPUT_FILE, errorOutput, 'utf8');

    throw error;
  }
}

// Run the scraper
runASOSScraper()
  .then(products => {
    console.log(`\nSuccess! Scraped ${products.length} products.`);
    process.exit(0);
  })
  .catch(error => {
    console.error('Scraper failed:', error.message);
    process.exit(1);
  });
