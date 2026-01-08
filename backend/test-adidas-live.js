/**
 * Minimal live test for Adidas scraper
 */

const AdidasScraper = require('./scrapers/brands/adidas-puppeteer');

async function testAdidasLive() {
  console.log('🧪 Testing Adidas scraper with live page...\n');

  const scraper = new AdidasScraper({
    headless: true,
    maxProducts: 15, // Get 15 products to verify we can get 10+
    timeout: 60000 // 60 second timeout
  });

  try {
    console.log('🚀 Starting scrape...');
    const products = await scraper.scrape();

    console.log(`\n✅ Scrape complete!`);
    console.log(`📦 Products found: ${products.length}`);

    if (products.length > 0) {
      console.log('\n📋 Sample products:\n');
      products.slice(0, 3).forEach((p, i) => {
        console.log(`${i + 1}. ${p.name}`);
        console.log(`   Price: $${p.originalPrice} → $${p.salePrice} (${p.discount}% off)`);
        console.log(`   URL: ${p.url.substring(0, 60)}...`);
        console.log(`   Image: ${p.image.substring(0, 60)}...`);
        console.log('');
      });

      if (products.length >= 10) {
        console.log('✅ PASS: Adidas scraper is working and found 10+ products!');
        process.exit(0);
      } else {
        console.log(`⚠️  WARNING: Found ${products.length} products, expected 10+`);
        process.exit(1);
      }
    } else {
      console.log('⚠️  WARNING: No products found. This could mean:');
      console.log('   - CSS selectors need updating');
      console.log('   - Page structure has changed');
      console.log('   - Network issues');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error during scraping:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testAdidasLive();
