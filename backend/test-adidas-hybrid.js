/**
 * Test Adidas Hybrid Scraper
 */

const AdidasHybridScraper = require('./scrapers/brands/adidas-hybrid');

async function testAdidasHybrid() {
  console.log('🧪 Testing Adidas Hybrid Scraper...\n');

  const scraper = new AdidasHybridScraper({
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
      products.slice(0, 3).forEach((p, i) => {
        console.log(`${i + 1}. ${p.name}`);
        console.log(`   Price: $${p.originalPrice} → $${p.salePrice} (${p.discount}% off)`);
        console.log(`   Source: ${p.source}`);
        console.log(`   URL: ${p.url.substring(0, 60)}...`);
        console.log('');
      });

      console.log('✅ SUCCESS: Adidas hybrid scraper found products!');
      process.exit(0);
    } else {
      console.log('\n⚠️  No products found with any strategy');
      console.log('Adidas protection is very strong. Recommendations:');
      console.log('  1. Use residential proxy service');
      console.log('  2. Try other retailers (Foot Locker, Finish Line)');
      console.log('  3. Use alternative shoe brands (Puma, Reebok, New Balance)');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testAdidasHybrid();
