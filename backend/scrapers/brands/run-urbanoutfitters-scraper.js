#!/usr/bin/env node

/**
 * Urban Outfitters Scraper Runner
 *
 * Runs the Urban Outfitters scraper and saves output to /tmp/urbanoutfitters-scrape-output.txt
 *
 * Note: Urban Outfitters uses DataDome bot protection.
 * The scraper will attempt live scraping first, then fall back to cached product data.
 */

const fs = require('fs');
const UrbanOutfittersScraper = require('./urbanoutfitters-scraper');

async function main() {
  console.log('='.repeat(60));
  console.log('Urban Outfitters Sale Scraper');
  console.log('Target: https://www.urbanoutfitters.com/sale');
  console.log('Commission: 5%');
  console.log('='.repeat(60));
  console.log('');

  const scraper = new UrbanOutfittersScraper({
    maxProducts: 60,
    headless: 'new',
    timeout: 45000
  });

  try {
    const products = await scraper.scrape();

    console.log('');
    console.log('='.repeat(60));
    console.log(`Total products scraped: ${products.length}`);
    console.log('='.repeat(60));

    // Format output according to specification
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
    const outputPath = '/tmp/urbanoutfitters-scrape-output.txt';
    const output = JSON.stringify(formattedProducts, null, 2);
    fs.writeFileSync(outputPath, output, 'utf8');

    console.log(`\nOutput saved to: ${outputPath}`);
    console.log(`\nSample product:`);
    if (formattedProducts.length > 0) {
      console.log(JSON.stringify(formattedProducts[0], null, 2));
    }

    // Print summary stats
    console.log('\n--- Summary ---');
    console.log(`Total products: ${formattedProducts.length}`);

    const avgDiscount = formattedProducts.length > 0
      ? Math.round(formattedProducts.reduce((sum, p) => sum + p.discount, 0) / formattedProducts.length)
      : 0;
    console.log(`Average discount: ${avgDiscount}%`);

    const categories = {};
    formattedProducts.forEach(p => {
      categories[p.category] = (categories[p.category] || 0) + 1;
    });
    console.log('Categories:', categories);

    // Verify images are from UO CDN
    const validImages = formattedProducts.filter(p =>
      p.image && p.image.includes('urbanoutfitters.com')
    ).length;
    console.log(`Products with valid UO CDN images: ${validImages}/${formattedProducts.length}`);

    // Verify all products have real prices
    const productsWithPrices = formattedProducts.filter(p =>
      p.originalPrice > 0 && p.salePrice > 0 && p.discount > 0
    ).length;
    console.log(`Products with real prices: ${productsWithPrices}/${formattedProducts.length}`);

    return formattedProducts;

  } catch (error) {
    console.error('Scraper failed:', error);
    process.exit(1);
  }
}

main().then(() => {
  console.log('\nScraping complete!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
