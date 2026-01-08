/**
 * Test CSS-based scrapers only (no AI required)
 * Tests: Foot Locker UK and H&M EU
 */

const { AutoScraperWithAI } = require('./services/scraping/auto-scraper-with-ai');

async function testCSSScrapers() {
  console.log('🧪 Testing CSS-based scrapers (Foot Locker + H&M)...\n');

  const scheduler = new AutoScraperWithAI();

  // Only run CSS scrapers (no AI)
  const cssScrapers = scheduler.scrapers.filter(s => s.type === 'css');

  console.log(`Found ${cssScrapers.length} CSS-based scrapers:\n`);
  cssScrapers.forEach(s => console.log(`  - ${s.name}`));
  console.log();

  for (const scraper of cssScrapers) {
    console.log(`\n🧪 Testing: ${scraper.name}...`);
    const result = await scheduler.runSingleScraper(scraper);

    console.log('\n📊 Result:');
    console.log(`   Success: ${result.success}`);
    console.log(`   Scraped: ${result.productsScraped} products`);
    console.log(`   Stored: ${result.productsStored} products`);
    console.log(`   Duration: ${result.duration.toFixed(1)}s`);

    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }

  console.log('\n\n✅ CSS scraper test complete!\n');
  process.exit(0);
}

testCSSScrapers().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
