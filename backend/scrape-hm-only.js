const HMEUScraper = require('./scrapers/eu-retailers/hm-eu');
const prisma = require('./db/client');
const { AutoScraperWithAI } = require('./services/scraping/auto-scraper-with-ai');

async function scrapeHMOnly() {
  console.log('🔍 Scraping H&M EU for maximum products...\n');

  const scheduler = new AutoScraperWithAI();
  const hmScraper = { name: 'H&M EU', Class: HMEUScraper, maxProducts: 100, type: 'css' };

  try {
    const result = await scheduler.runSingleScraper(hmScraper);

    console.log('\n📊 Final Result:');
    console.log(`   Success: ${result.success}`);
    console.log(`   Scraped: ${result.productsScraped} products`);
    console.log(`   Stored: ${result.productsStored} products`);
    console.log(`   Duration: ${result.duration.toFixed(1)}s\n`);

    // Show database count
    const total = await prisma.product.count();
    console.log(`📦 Total products in database: ${total}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

scrapeHMOnly();
