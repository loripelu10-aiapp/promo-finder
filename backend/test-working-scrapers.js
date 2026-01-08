const JDSportsUKScraper = require('./scrapers/eu-retailers/jdsports-uk');
const SportsDirectScraper = require('./scrapers/eu-retailers/sportsdirect-uk');
const FootLockerUKScraper = require('./scrapers/eu-retailers/footlocker-uk');

/**
 * Test the working UK/EU scrapers
 */

async function testScraper(ScraperClass, scraperName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Testing ${scraperName}`);
  console.log('='.repeat(60));

  const scraper = new ScraperClass({ maxProducts: 10 });

  try {
    console.log('⏳ Scraping products...');
    const products = await scraper.scrape();

    console.log(`\n📊 Results: ${products.length} products extracted`);

    if (products.length === 0) {
      console.log('❌ No products found');
      return { scraper: scraperName, success: false, count: 0 };
    }

    // Show first 3 products
    console.log('\n📦 Sample products:\n');
    products.slice(0, 3).forEach((p, i) => {
      console.log(`${i + 1}. ${p.name}`);
      console.log(`   Brand: ${p.brand}`);
      console.log(`   Price: ${p.currency}${p.salePrice} (was ${p.currency}${p.originalPrice})`);
      console.log(`   Discount: ${p.discount}%`);
      console.log(`   Image: ${p.image?.substring(0, 60)}...`);
      console.log(`   URL: ${p.url?.substring(0, 60)}...`);
      console.log('');
    });

    console.log(`✅ ${scraperName} working! ${products.length} products found`);
    return { scraper: scraperName, success: true, count: products.length };

  } catch (error) {
    console.log(`\n❌ Scraper failed:`);
    console.log(`   ${error.message}`);
    return { scraper: scraperName, success: false, count: 0 };
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   Testing Working UK/EU Scrapers                          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  const results = [];

  // Test JD Sports UK
  const jdResult = await testScraper(JDSportsUKScraper, 'JD Sports UK');
  results.push(jdResult);

  console.log('\n⏳ Waiting 3 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test Sports Direct
  const sdResult = await testScraper(SportsDirectScraper, 'Sports Direct UK');
  results.push(sdResult);

  console.log('\n⏳ Waiting 3 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test Foot Locker UK
  const flResult = await testScraper(FootLockerUKScraper, 'Foot Locker UK');
  results.push(flResult);

  // Summary
  console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   SUMMARY                                                 ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  results.forEach(r => {
    const status = r.success ? '✅' : '❌';
    console.log(`${status} ${r.scraper}: ${r.count} products`);
  });

  const workingScrapers = results.filter(r => r.success);
  const totalProducts = results.reduce((sum, r) => sum + r.count, 0);

  console.log(`\n📊 ${workingScrapers.length}/${results.length} scrapers working`);
  console.log(`📦 ${totalProducts} total products available`);

  if (workingScrapers.length > 0) {
    console.log('\n✅ Ready to use working scrapers!');
  }

  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
