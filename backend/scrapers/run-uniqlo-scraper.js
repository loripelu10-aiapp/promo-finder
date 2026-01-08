/**
 * Uniqlo Scraper Runner
 *
 * Runs the Uniqlo scraper and saves output to /tmp/uniqlo-scrape-output.txt
 */
const fs = require('fs');
const UniqloScraper = require('./brands/uniqlo-scraper');

async function main() {
  console.log('='.repeat(60));
  console.log('UNIQLO SALE SCRAPER');
  console.log('Targets: Women, Men, Kids sale pages');
  console.log('Commission: 5%');
  console.log('='.repeat(60));

  const scraper = new UniqloScraper({
    maxProducts: 60,
    headless: true, // Run in headless mode
    timeout: 60000
  });

  try {
    console.log('\nStarting scraper...\n');
    const products = await scraper.scrape();

    console.log('\n' + '='.repeat(60));
    console.log(`RESULTS: Found ${products.length} products`);
    console.log('='.repeat(60));

    // Format products for output (matching the requested format)
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

    // Save to output file
    const outputPath = '/tmp/uniqlo-scrape-output.txt';
    const output = JSON.stringify(formattedProducts, null, 2);
    fs.writeFileSync(outputPath, output);
    console.log(`\nOutput saved to: ${outputPath}`);

    // Print sample products
    console.log('\n--- Sample Products ---');
    formattedProducts.slice(0, 5).forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.name}`);
      console.log(`   Price: $${p.originalPrice} -> $${p.salePrice} (${p.discount}% off)`);
      console.log(`   Image: ${p.image}`);
      console.log(`   URL: ${p.url}`);
    });

    // Statistics
    console.log('\n--- Statistics ---');
    const totalSavings = formattedProducts.reduce((sum, p) => sum + (p.originalPrice - p.salePrice), 0);
    const avgDiscount = formattedProducts.reduce((sum, p) => sum + p.discount, 0) / formattedProducts.length;
    console.log(`Total products: ${formattedProducts.length}`);
    console.log(`Average discount: ${avgDiscount.toFixed(1)}%`);
    console.log(`Total potential savings: $${totalSavings.toFixed(2)}`);

    // Check for Uniqlo CDN images
    const cdnImages = formattedProducts.filter(p => p.image && p.image.includes('image.uniqlo.com'));
    console.log(`Products with Uniqlo CDN images: ${cdnImages.length}`);

    return formattedProducts;

  } catch (error) {
    console.error('Scraper failed:', error.message);
    process.exit(1);
  }
}

main().then(() => {
  console.log('\nScraper completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
