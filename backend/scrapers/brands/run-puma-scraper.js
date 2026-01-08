#!/usr/bin/env node

/**
 * Puma Scraper Runner
 *
 * Executes the Puma scraper and saves results to /tmp/puma-scrape-output.txt
 */

const fs = require('fs');
const path = require('path');
const PumaScraper = require('./puma-puppeteer');

async function runScraper() {
  console.log('='.repeat(60));
  console.log('PUMA SALE SCRAPER');
  console.log('='.repeat(60));
  console.log(`Target: https://us.puma.com/us/en/sale`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  const scraper = new PumaScraper({
    maxProducts: 60, // Aim for 60 to ensure we get 50+
    headless: true,  // Run in headless mode
    scrollDelay: 2500,
    timeout: 60000
  });

  try {
    const products = await scraper.scrape();

    console.log('\n' + '='.repeat(60));
    console.log('SCRAPING RESULTS');
    console.log('='.repeat(60));
    console.log(`Total products found: ${products.length}`);

    if (products.length > 0) {
      // Calculate statistics
      const avgDiscount = Math.round(products.reduce((sum, p) => sum + p.discount, 0) / products.length);
      const avgOriginalPrice = Math.round(products.reduce((sum, p) => sum + p.originalPrice, 0) / products.length);
      const avgSalePrice = Math.round(products.reduce((sum, p) => sum + p.salePrice, 0) / products.length);

      console.log(`Average discount: ${avgDiscount}%`);
      console.log(`Average original price: $${avgOriginalPrice}`);
      console.log(`Average sale price: $${avgSalePrice}`);

      // Group by category
      const categories = {};
      products.forEach(p => {
        categories[p.category] = (categories[p.category] || 0) + 1;
      });
      console.log('\nProducts by category:');
      Object.entries(categories).forEach(([cat, count]) => {
        console.log(`  - ${cat}: ${count}`);
      });

      // Verify all images are from Puma CDN
      const validImages = products.filter(p =>
        p.image.includes('puma.com') || p.image.includes('puma.net')
      );
      console.log(`\nValid Puma CDN images: ${validImages.length}/${products.length}`);

      // Sample products
      console.log('\n' + '-'.repeat(60));
      console.log('SAMPLE PRODUCTS (first 5):');
      console.log('-'.repeat(60));
      products.slice(0, 5).forEach((p, i) => {
        console.log(`\n${i + 1}. ${p.name}`);
        console.log(`   Price: $${p.originalPrice} -> $${p.salePrice} (${p.discount}% off)`);
        console.log(`   Category: ${p.category}`);
        console.log(`   Image: ${p.image.substring(0, 80)}...`);
        console.log(`   URL: ${p.url.substring(0, 80)}...`);
      });

      // Save to file
      const outputPath = '/tmp/puma-scrape-output.txt';
      const output = JSON.stringify(products, null, 2);
      fs.writeFileSync(outputPath, output, 'utf8');

      console.log('\n' + '='.repeat(60));
      console.log(`OUTPUT SAVED TO: ${outputPath}`);
      console.log(`File size: ${(output.length / 1024).toFixed(2)} KB`);
      console.log('='.repeat(60));

      // Return success
      return {
        success: true,
        count: products.length,
        outputPath
      };
    } else {
      console.log('No products found. The page structure may have changed.');
      return {
        success: false,
        count: 0,
        error: 'No products found'
      };
    }

  } catch (error) {
    console.error('\nFATAL ERROR:', error.message);
    console.error(error.stack);

    // Save error info
    const errorOutput = {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync('/tmp/puma-scrape-error.txt', JSON.stringify(errorOutput, null, 2));

    return {
      success: false,
      count: 0,
      error: error.message
    };
  }
}

// Run the scraper
runScraper()
  .then(result => {
    console.log('\n' + '='.repeat(60));
    console.log('FINAL STATUS');
    console.log('='.repeat(60));
    console.log(`Success: ${result.success}`);
    console.log(`Products: ${result.count}`);
    if (result.outputPath) {
      console.log(`Output: ${result.outputPath}`);
    }
    if (result.error) {
      console.log(`Error: ${result.error}`);
    }
    console.log(`Completed: ${new Date().toISOString()}`);
    console.log('='.repeat(60));

    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
