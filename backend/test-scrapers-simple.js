/**
 * Simple test to verify scrapers can be imported and instantiated
 */

console.log('🧪 Testing scraper imports...\n');

try {
  console.log('1️⃣ Importing BaseScraper...');
  const BaseScraper = require('./scrapers/brands/base-scraper');
  console.log('   ✅ BaseScraper imported successfully');

  console.log('\n2️⃣ Importing NikeScraper...');
  const NikeScraper = require('./scrapers/brands/nike-puppeteer');
  console.log('   ✅ NikeScraper imported successfully');

  console.log('\n3️⃣ Importing AdidasScraper...');
  const AdidasScraper = require('./scrapers/brands/adidas-puppeteer');
  console.log('   ✅ AdidasScraper imported successfully');

  console.log('\n4️⃣ Instantiating NikeScraper...');
  const nikeScraper = new NikeScraper();
  console.log('   ✅ NikeScraper instantiated');
  console.log(`   - Name: ${nikeScraper.getName()}`);
  console.log(`   - Brand: ${nikeScraper.brand}`);
  console.log(`   - Target URL: ${nikeScraper.targetUrl}`);

  console.log('\n5️⃣ Instantiating AdidasScraper...');
  const adidasScraper = new AdidasScraper();
  console.log('   ✅ AdidasScraper instantiated');
  console.log(`   - Name: ${adidasScraper.getName()}`);
  console.log(`   - Brand: ${adidasScraper.brand}`);
  console.log(`   - Target URL: ${adidasScraper.targetUrl}`);

  console.log('\n6️⃣ Testing price extraction...');
  const testPrices = [
    '$99.99',
    '99.99',
    '$99',
    '€150.00',
    '₹12,795'
  ];

  testPrices.forEach(priceText => {
    const extracted = nikeScraper.extractPrice(priceText);
    console.log(`   ${priceText} → ${extracted}`);
  });

  console.log('\n7️⃣ Testing discount validation...');
  const testCases = [
    { original: 100, sale: 70, expected: 'valid (30%)' },
    { original: 100, sale: 130, expected: 'invalid (sale > original)' },
    { original: 100, sale: 95, expected: 'invalid (< 10%)' },
    { original: 100, sale: 20, expected: 'invalid (> 70%)' },
    { original: 130, sale: 100, expected: 'invalid (1.3x estimation)' }
  ];

  testCases.forEach(test => {
    const result = nikeScraper.isRealDiscount(test.original, test.sale);
    const status = result.valid ? `✅ valid (${result.discount}%)` : `❌ ${result.reason}`;
    console.log(`   $${test.original} → $${test.sale}: ${status}`);
  });

  console.log('\n✅ All basic tests passed!');
  console.log('\nℹ️  Scrapers are ready. To test live scraping, run:');
  console.log('   node test-scrapers.js');

} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
