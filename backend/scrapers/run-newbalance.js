/**
 * Runner script for New Balance scraper
 * Executes the scraper and saves results to /tmp/newbalance-scrape-output.txt
 */

const NewBalanceScraper = require('./brands/newbalance-scraper');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('='.repeat(60));
  console.log('New Balance Scraper Runner');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('');

  const scraper = new NewBalanceScraper({
    headless: true, // Run in headless mode
    maxProducts: 60, // Target 50+ products
    timeout: 60000, // 60 second timeout
    scrollDelay: 2500
  });

  try {
    // Run the scraper
    const products = await scraper.scrape();

    console.log('');
    console.log('='.repeat(60));
    console.log(`Scraping complete. Found ${products.length} valid products.`);
    console.log('='.repeat(60));

    // Format output for the required format
    const formattedProducts = products.map(p => ({
      name: p.name,
      brand: p.brand,
      originalPrice: p.originalPrice,
      salePrice: p.salePrice,
      discount: p.discount,
      currency: p.currency,
      image: p.image,
      url: p.url,
      category: p.category
    }));

    // Save to file
    const outputPath = '/tmp/newbalance-scrape-output.txt';
    const output = JSON.stringify(formattedProducts, null, 2);
    fs.writeFileSync(outputPath, output, 'utf8');

    console.log('');
    console.log(`Output saved to: ${outputPath}`);
    console.log(`Total products: ${formattedProducts.length}`);
    console.log('');

    // Print summary
    if (formattedProducts.length > 0) {
      console.log('Sample products:');
      formattedProducts.slice(0, 3).forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.name}`);
        console.log(`     Original: $${p.originalPrice} -> Sale: $${p.salePrice} (${p.discount}% off)`);
        console.log(`     Image: ${p.image.substring(0, 60)}...`);
      });
    }

    console.log('');
    console.log(`Finished at: ${new Date().toISOString()}`);

  } catch (error) {
    console.error('Error running scraper:', error);
    process.exit(1);
  }
}

main();
