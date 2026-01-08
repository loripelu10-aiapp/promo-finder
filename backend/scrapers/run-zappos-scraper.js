/**
 * Zappos Sale Products Scraper Runner
 *
 * Scrapes Zappos sale pages and saves products to /tmp/zappos-products.json
 * Target: 100+ products with real discounts
 * Images from Zappos CDN (m.media-amazon.com)
 */

const ZapposScraper = require('./brands/zappos-scraper');
const fs = require('fs');

const OUTPUT_FILE = '/tmp/zappos-products.json';

async function runZapposScraper() {
  console.log('='.repeat(60));
  console.log('Zappos Sale Products Scraper');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Output file: ${OUTPUT_FILE}`);
  console.log('Target: 100+ products with real discounts');
  console.log('');

  const scraper = new ZapposScraper({
    maxProducts: 150,
    headless: true,
    scrollDelay: 2500,
    timeout: 90000
  });

  try {
    const products = await scraper.scrape();

    console.log('\n' + '='.repeat(60));
    console.log('SCRAPING RESULTS');
    console.log('='.repeat(60));
    console.log(`Total products scraped: ${products.length}`);

    if (products.length > 0) {
      // Calculate statistics
      const avgDiscount = Math.round(products.reduce((sum, p) => sum + p.discount, 0) / products.length);
      const avgOriginalPrice = Math.round(products.reduce((sum, p) => sum + p.originalPrice, 0) / products.length);
      const avgSalePrice = Math.round(products.reduce((sum, p) => sum + p.salePrice, 0) / products.length);
      const totalSavings = Math.round(products.reduce((sum, p) => sum + (p.originalPrice - p.salePrice), 0));

      console.log(`Average discount: ${avgDiscount}%`);
      console.log(`Average original price: $${avgOriginalPrice}`);
      console.log(`Average sale price: $${avgSalePrice}`);
      console.log(`Total potential savings: $${totalSavings}`);
      console.log('');

      // Count by category
      const categories = {};
      products.forEach(p => {
        categories[p.category] = (categories[p.category] || 0) + 1;
      });
      console.log('Products by category:');
      Object.entries(categories).forEach(([cat, count]) => {
        console.log(`  ${cat}: ${count}`);
      });
      console.log('');

      // Validate images are from Zappos CDN
      const validImages = products.filter(p =>
        p.image && (p.image.includes('media-amazon.com') || p.image.includes('zappos.com'))
      );
      console.log(`Products with valid Zappos CDN images: ${validImages.length}/${products.length}`);
      console.log('');

      // Show sample products
      console.log('Sample products:');
      products.slice(0, 5).forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.name.substring(0, 50)}${p.name.length > 50 ? '...' : ''}`);
        console.log(`     Price: $${p.originalPrice} -> $${p.salePrice} (${p.discount}% off)`);
        console.log(`     Image: ${p.image.substring(0, 70)}...`);
        console.log(`     URL: ${p.url}`);
      });
    }

    // Save to JSON file
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

    // Save error details to output file
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
runZapposScraper()
  .then(products => {
    console.log(`\nSuccess! Scraped ${products.length} products.`);
    process.exit(0);
  })
  .catch(error => {
    console.error('Scraper failed:', error.message);
    process.exit(1);
  });
