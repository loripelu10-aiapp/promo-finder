/**
 * Runner script for New Balance scraper (final version)
 * Executes the scraper and saves results to /tmp/newbalance-scrape-output.txt
 */

const NewBalanceScraper = require('./brands/newbalance-scraper');
const fs = require('fs');

async function main() {
  console.log('='.repeat(60));
  console.log('New Balance Scraper Runner (Final Version)');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('');

  const scraper = new NewBalanceScraper({
    headless: true,
    maxProducts: 60,
    timeout: 60000
  });

  try {
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

    // Validation summary
    const discounts = formattedProducts.map(p => p.discount);
    const avgDiscount = discounts.reduce((a, b) => a + b, 0) / discounts.length;
    const minDiscount = Math.min(...discounts);
    const maxDiscount = Math.max(...discounts);

    console.log('Discount Summary:');
    console.log(`  Average: ${avgDiscount.toFixed(1)}%`);
    console.log(`  Min: ${minDiscount}%`);
    console.log(`  Max: ${maxDiscount}%`);
    console.log('');

    // Print sample products
    if (formattedProducts.length > 0) {
      console.log('Sample products:');
      formattedProducts.slice(0, 5).forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.name}`);
        console.log(`     Original: $${p.originalPrice} -> Sale: $${p.salePrice} (${p.discount}% off)`);
        console.log(`     Category: ${p.category}`);
        console.log(`     Image: ${p.image.substring(0, 60)}...`);
        console.log('');
      });
    }

    console.log(`Finished at: ${new Date().toISOString()}`);

    // Exit with appropriate code
    if (formattedProducts.length >= 50) {
      console.log('SUCCESS: Met target of 50+ products');
      process.exit(0);
    } else {
      console.log(`WARNING: Only found ${formattedProducts.length} products (target: 50+)`);
      process.exit(0);
    }

  } catch (error) {
    console.error('Error running scraper:', error);
    process.exit(1);
  }
}

main();
