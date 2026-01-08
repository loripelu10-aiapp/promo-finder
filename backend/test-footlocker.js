/**
 * Test Foot Locker Scraper
 */

const FootLockerScraper = require('./scrapers/brands/footlocker-scraper');

async function testFootLocker() {
  console.log('🧪 Testing Foot Locker Scraper...\n');

  const scraper = new FootLockerScraper({
    headless: true,
    maxProducts: 10,
    timeout: 60000
  });

  try {
    console.log('🚀 Starting scrape...');
    const products = await scraper.scrape();

    console.log(`\n✅ Scrape complete!`);
    console.log(`📦 Products found: ${products.length}`);

    if (products.length > 0) {
      console.log('\n📋 Sample products:\n');

      // Group by brand
      const byBrand = {};
      products.forEach(p => {
        if (!byBrand[p.brand]) byBrand[p.brand] = [];
        byBrand[p.brand].push(p);
      });

      console.log(`Brands found: ${Object.keys(byBrand).join(', ')}\n`);

      products.slice(0, 5).forEach((p, i) => {
        console.log(`${i + 1}. [${p.brand}] ${p.name}`);
        console.log(`   Price: $${p.originalPrice} → $${p.salePrice} (${p.discount}% off)`);
        console.log(`   URL: ${p.url.substring(0, 70)}...`);
        console.log('');
      });

      console.log('✅ PASS: Foot Locker scraper works! Can get Nike/Adidas from retail partner.');
      process.exit(0);
    } else {
      console.log('⚠️  No products found');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testFootLocker();
