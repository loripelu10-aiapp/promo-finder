const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');

// Import all scrapers
const JDSportsUKScraper = require('../../scrapers/eu-retailers/jdsports-uk');
const SportsDirectScraper = require('../../scrapers/eu-retailers/sportsdirect-uk');
const FootLockerUKScraper = require('../../scrapers/eu-retailers/footlocker-uk');
const HMEUScraper = require('../../scrapers/eu-retailers/hm-eu');
const ZaraEUScraper = require('../../scrapers/eu-retailers/zara-eu');
const MangoEUScraper = require('../../scrapers/eu-retailers/mango-eu');
const DecathlonEUScraper = require('../../scrapers/eu-retailers/decathlon-eu');

const prisma = new PrismaClient();

/**
 * Automated Real-Time Scraper Scheduler
 *
 * Runs scrapers automatically on a schedule:
 * - Every 6 hours: Full scrape cycle
 * - Rotates through scrapers to avoid overload
 * - Stores products directly in database
 * - Auto-cleanup of old/broken products
 */

class AutoScraperScheduler {
  constructor() {
    this.scrapers = [
      { name: 'JD Sports UK', Class: JDSportsUKScraper, maxProducts: 50 },
      { name: 'Sports Direct UK', Class: SportsDirectScraper, maxProducts: 50 },
      { name: 'Foot Locker UK', Class: FootLockerUKScraper, maxProducts: 50 },
      { name: 'H&M EU', Class: HMEUScraper, maxProducts: 30 },
      { name: 'Zara EU', Class: ZaraEUScraper, maxProducts: 30 },
      { name: 'Mango EU', Class: MangoEUScraper, maxProducts: 30 },
      { name: 'Decathlon EU', Class: DecathlonEUScraper, maxProducts: 30 }
    ];

    this.isRunning = false;
    this.currentScraper = null;
    this.stats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      totalProducts: 0,
      lastRun: null
    };
  }

  /**
   * Start the automatic scraping scheduler
   */
  start() {
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║        AUTOMATIC REAL-TIME SCRAPER SCHEDULER STARTED            ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');

    // Schedule: Run every 6 hours
    // Cron: "0 */6 * * *" = At minute 0 past every 6th hour (00:00, 06:00, 12:00, 18:00)
    this.mainSchedule = cron.schedule('0 */6 * * *', async () => {
      await this.runFullScrapeCircle();
    });

    // Initial run on startup (after 30 seconds)
    setTimeout(async () => {
      console.log('🚀 Running initial scrape cycle...\n');
      await this.runFullScrapeCircle();
    }, 30000);

    console.log('✅ Scheduler active');
    console.log('📅 Full scrape cycle: Every 6 hours (00:00, 06:00, 12:00, 18:00)');
    console.log('⏰ Initial run: 30 seconds from now\n');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.mainSchedule) {
      this.mainSchedule.stop();
      console.log('⏹️  Scheduler stopped');
    }
  }

  /**
   * Run a full scraping cycle through all retailers
   */
  async runFullScrapeCircle() {
    if (this.isRunning) {
      console.log('⚠️  Scrape cycle already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    const cycleStartTime = Date.now();

    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║               AUTOMATED SCRAPE CYCLE STARTED                     ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log(`⏰ Started at: ${new Date().toISOString()}\n`);

    const results = [];

    // Run each scraper with 10-second delay between them
    for (let i = 0; i < this.scrapers.length; i++) {
      const scraper = this.scrapers[i];

      console.log(`\n[${ i + 1}/${this.scrapers.length}] Running ${scraper.name}...`);

      const result = await this.runSingleScraper(scraper);
      results.push(result);

      // Delay before next scraper (except last one)
      if (i < this.scrapers.length - 1) {
        console.log('⏳ Waiting 10 seconds before next scraper...');
        await this.delay(10000);
      }
    }

    // Update stats
    this.stats.totalRuns++;
    this.stats.successfulRuns += results.filter(r => r.success).length;
    this.stats.failedRuns += results.filter(r => !r.success).length;
    this.stats.totalProducts += results.reduce((sum, r) => sum + r.productsStored, 0);
    this.stats.lastRun = new Date().toISOString();

    // Cycle summary
    const cycleDuration = ((Date.now() - cycleStartTime) / 1000 / 60).toFixed(1);
    const totalProducts = results.reduce((sum, r) => sum + r.productsStored, 0);
    const successful = results.filter(r => r.success).length;

    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║              AUTOMATED SCRAPE CYCLE COMPLETE                     ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log(`⏰ Completed at: ${new Date().toISOString()}`);
    console.log(`⏱️  Duration: ${cycleDuration} minutes`);
    console.log(`✅ Successful scrapers: ${successful}/${this.scrapers.length}`);
    console.log(`📦 Total products stored: ${totalProducts}`);
    console.log(`📊 Next cycle: ${this.getNextRunTime()}\n`);

    this.isRunning = false;

    // Cleanup old products after each cycle
    await this.cleanupOldProducts();
  }

  /**
   * Run a single scraper and store products in database
   */
  async runSingleScraper(scraperConfig) {
    const { name, Class, maxProducts } = scraperConfig;
    this.currentScraper = name;
    const startTime = Date.now();

    try {
      // Initialize scraper
      const scraper = new Class({ maxProducts });

      // Scrape products
      console.log(`   ⏳ Scraping...`);
      const products = await scraper.scrape();

      if (products.length === 0) {
        console.log(`   ⚠️  No products found`);
        return {
          scraper: name,
          success: false,
          productsScraped: 0,
          productsStored: 0,
          duration: (Date.now() - startTime) / 1000,
          error: 'No products found'
        };
      }

      console.log(`   📦 Scraped ${products.length} products`);

      // Store products in database
      console.log(`   💾 Storing in database...`);
      const stored = await this.storeProducts(products);

      const duration = (Date.now() - startTime) / 1000;

      console.log(`   ✅ Success: ${stored} products stored in ${duration.toFixed(1)}s`);

      return {
        scraper: name,
        success: true,
        productsScraped: products.length,
        productsStored: stored,
        duration,
        avgDiscount: products.reduce((sum, p) => sum + p.discount, 0) / products.length
      };

    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      console.log(`   ❌ Failed: ${error.message}`);

      return {
        scraper: name,
        success: false,
        productsScraped: 0,
        productsStored: 0,
        duration,
        error: error.message
      };
    } finally {
      this.currentScraper = null;
    }
  }

  /**
   * Store products in database (upsert to avoid duplicates)
   */
  async storeProducts(products) {
    let stored = 0;

    for (const product of products) {
      try {
        // Upsert product (update if URL exists, create if not)
        await prisma.product.upsert({
          where: {
            url: product.url
          },
          update: {
            name: product.name,
            brand: product.brand,
            category: product.category,
            originalPrice: product.originalPrice,
            salePrice: product.salePrice,
            discount: product.discount,
            currency: product.currency,
            image: product.image,
            source: product.source,
            availableRegions: product.availableRegions || [],
            verified: false,
            scrapedAt: new Date()
          },
          create: {
            name: product.name,
            brand: product.brand,
            category: product.category,
            originalPrice: product.originalPrice,
            salePrice: product.salePrice,
            discount: product.discount,
            currency: product.currency,
            image: product.image,
            url: product.url,
            source: product.source,
            availableRegions: product.availableRegions || [],
            verified: false,
            scrapedAt: new Date()
          }
        });

        stored++;
      } catch (error) {
        console.error(`      ⚠️  Failed to store "${product.name}": ${error.message}`);
      }
    }

    return stored;
  }

  /**
   * Cleanup old products (older than 7 days)
   */
  async cleanupOldProducts() {
    console.log('\n🧹 Cleaning up old products...');

    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const deleted = await prisma.product.deleteMany({
        where: {
          scrapedAt: {
            lt: sevenDaysAgo
          }
        }
      });

      console.log(`   ✅ Removed ${deleted.count} old products (>7 days)\n`);
    } catch (error) {
      console.error(`   ❌ Cleanup failed: ${error.message}\n`);
    }
  }

  /**
   * Get next scheduled run time
   */
  getNextRunTime() {
    const now = new Date();
    const nextHours = [0, 6, 12, 18];
    const currentHour = now.getHours();

    // Find next scheduled hour
    const nextHour = nextHours.find(h => h > currentHour) || nextHours[0];

    const next = new Date(now);
    if (nextHour <= currentHour) {
      next.setDate(next.getDate() + 1);
    }
    next.setHours(nextHour, 0, 0, 0);

    return next.toISOString();
  }

  /**
   * Get current stats
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      currentScraper: this.currentScraper,
      nextRun: this.getNextRunTime()
    };
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let schedulerInstance = null;

/**
 * Get or create scheduler instance
 */
function getScheduler() {
  if (!schedulerInstance) {
    schedulerInstance = new AutoScraperScheduler();
  }
  return schedulerInstance;
}

/**
 * Start the automatic scheduler
 */
function startAutoScraping() {
  const scheduler = getScheduler();
  scheduler.start();
  return scheduler;
}

/**
 * Stop the automatic scheduler
 */
function stopAutoScraping() {
  if (schedulerInstance) {
    schedulerInstance.stop();
  }
}

/**
 * Get scheduler stats
 */
function getSchedulerStats() {
  if (!schedulerInstance) {
    return null;
  }
  return schedulerInstance.getStats();
}

/**
 * Manual trigger (for testing)
 */
async function triggerManualScrape() {
  const scheduler = getScheduler();
  await scheduler.runFullScrapeCircle();
}

module.exports = {
  AutoScraperScheduler,
  getScheduler,
  startAutoScraping,
  stopAutoScraping,
  getSchedulerStats,
  triggerManualScrape
};

// Run if executed directly
if (require.main === module) {
  console.log('Starting Auto-Scraper Scheduler...\n');
  startAutoScraping();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\nShutting down gracefully...');
    stopAutoScraping();
    prisma.$disconnect();
    process.exit(0);
  });
}
