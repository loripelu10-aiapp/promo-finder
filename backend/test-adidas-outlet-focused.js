/**
 * Test Adidas Outlet Focused Scraper
 */

const AdidasOutletFocused = require('./scrapers/brands/adidas-outlet-focused');

async function testAdidasOutlet() {
  console.log('🧪 Testing Adidas Outlet Focused Scraper...\n');
  console.log('=' + '='.repeat(60));
  console.log('This will try multiple strategies to access Adidas outlet');
  console.log('=' + '='.repeat(60) + '\n');

  const scraper = new AdidasOutletFocused({
    headless: true,
    maxProducts: 15
  });

  try {
    const products = await scraper.scrape();

    console.log('\n' + '='.repeat(60));
    console.log('RESULTS');
    console.log('='.repeat(60));
    console.log(`📦 Products found: ${products.length}\n`);

    if (products.length > 0) {
      console.log('✅ SUCCESS! Sample products:\n');
      products.slice(0, 5).forEach((p, i) => {
        console.log(`${i + 1}. ${p.name}`);
        console.log(`   Price: $${p.originalPrice} → $${p.salePrice} (${p.discount}% off)`);
        console.log(`   URL: ${p.url.substring(0, 70)}...`);
        console.log('');
      });

      console.log(`\n🎉 Adidas outlet scraper WORKS!`);
      console.log(`📊 Total products extracted: ${products.length}`);
      process.exit(0);
    } else {
      console.log('❌ No products found with any strategy');
      console.log('\nℹ️  Check the screenshots saved to /tmp/adidas-attempt-*.png');
      console.log('ℹ️  Check the HTML files saved to /tmp/adidas-attempt-*.html');
      console.log('\nIf screenshots show products, we may need to:');
      console.log('  1. Adjust CSS selectors based on actual HTML');
      console.log('  2. Use OCR/vision to extract from screenshots');
      console.log('  3. Use a residential proxy service');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testAdidasOutlet();
