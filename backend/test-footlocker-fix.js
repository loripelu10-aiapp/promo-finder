const FootLockerUKScraper = require('./scrapers/eu-retailers/footlocker-uk');

/**
 * Test the fixed Foot Locker UK scraper
 * Verify that product names are now clean (no sale text)
 */

async function testFootLocker() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   Testing Fixed Foot Locker UK Scraper                    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const scraper = new FootLockerUKScraper({ maxProducts: 5 });

  try {
    console.log('⏳ Scraping Nike products from Foot Locker UK...\n');
    const products = await scraper.searchBrand('nike', 'trainers');

    if (products.length === 0) {
      console.log('❌ No products found\n');
      return;
    }

    console.log(`\n✅ Found ${products.length} products\n`);
    console.log('📋 Product Names (should be clean now):\n');

    products.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name}`);
      console.log(`   Brand: ${p.brand}`);
      console.log(`   Price: ${p.currency}${p.salePrice} (was ${p.currency}${p.originalPrice})`);
      console.log(`   Discount: ${p.discount}%`);
      console.log(`   Image: ${p.image?.substring(0, 60)}...`);
      console.log('');
    });

    // Validate names are clean
    let allClean = true;
    const dirtyPatterns = [
      /Save £/i,
      /This item is on sale/i,
      /Price dropped/i,
      /£\d+/
    ];

    products.forEach(p => {
      const isDirty = dirtyPatterns.some(pattern => pattern.test(p.name));
      if (isDirty) {
        console.log(`⚠️  WARNING: "${p.name}" still contains sale text`);
        allClean = false;
      }
    });

    if (allClean) {
      console.log('✅ All product names are clean!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testFootLocker().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
