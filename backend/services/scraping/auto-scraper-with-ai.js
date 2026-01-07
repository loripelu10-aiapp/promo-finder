const cron = require('node-cron');
const prisma = require('../../db/client');
const { getCostMonitor } = require('./cost-monitor');

// Import working scrapers
const FootLockerUKScraper = require('../../scrapers/eu-retailers/footlocker-uk');
const HMEUScraper = require('../../scrapers/eu-retailers/hm-eu');

// Import AI-powered fallback scrapers for failed sites
const ZaraEUFallbackScraper = require('../../scrapers/eu-retailers/zara-eu-fallback');
const MangoEUFallbackScraper = require('../../scrapers/eu-retailers/mango-eu-fallback');
const DecathlonEUFallbackScraper = require('../../scrapers/eu-retailers/decathlon-eu-fallback');

const costMonitor = getCostMonitor();

/**
 * Automated Scraper with AI-Powered Fallbacks
 *
 * Uses Claude Vision API to parse products from screenshots and text
 * when traditional CSS selectors fail or sites block automation
 */

class AutoScraperWithAI {
  constructor() {
    this.scrapers = [
      // Working scrapers (CSS selectors)
      // Foot Locker UK disabled - can only extract badge images, needs AI scraping
      // { name: 'Foot Locker UK', Class: FootLockerUKScraper, maxProducts: 50, type: 'css' },
      { name: 'H&M EU', Class: HMEUScraper, maxProducts: 100, type: 'css' }, // Increased to 100

      // AI-powered fallback scrapers (DISABLED - no API credits)
      // { name: 'Zara EU (AI)', Class: ZaraEUFallbackScraper, maxProducts: 30, type: 'ai' },
      // { name: 'Mango EU (AI)', Class: MangoEUFallbackScraper, maxProducts: 30, type: 'ai' },
      // { name: 'Decathlon EU (AI)', Class: DecathlonEUFallbackScraper, maxProducts: 30, type: 'ai' }
    ];

    this.isRunning = false;
    this.currentScraper = null;
    this.stats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      totalProducts: 0,
      cssScrapes: 0,
      aiScrapes: 0,
      lastRun: null
    };
  }

  /**
   * Start the automatic scraping scheduler
   */
  start() {
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║     AUTOMATIC SCRAPER WITH AI FALLBACKS - STARTED               ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');

    // Check for Anthropic API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('⚠️  WARNING: ANTHROPIC_API_KEY not set in environment');
      console.log('   AI fallback scrapers will not work without it');
      console.log('   Set it in .env file or environment variables\n');
    } else {
      console.log('✅ Anthropic API key detected\n');
    }

    // Schedule: Run every 6 hours
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
    console.log('⏰ Initial run: 30 seconds from now');
    console.log('🤖 AI-powered scrapers: 3 (Zara, Mango, Decathlon)');
    console.log('🎯 CSS-based scrapers: 2 (Foot Locker, H&M)\n');
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

    // Check if cost monitor has stopped us
    if (costMonitor.isStopped()) {
      console.log('🛑 Scraping stopped due to daily cost limit. See cost report above.');
      return;
    }

    this.isRunning = true;
    const cycleStartTime = Date.now();

    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║          AUTOMATED SCRAPE CYCLE WITH AI - STARTED               ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log(`⏰ Started at: ${new Date().toISOString()}\n`);

    // Show current cost status
    const costStats = await costMonitor.getStats();
    console.log(`💰 Today's API cost: $${costStats.totalCost.toFixed(4)} / $${costStats.limits.maxDailyCost.toFixed(2)}`);
    console.log(`📊 API calls today: ${costStats.totalCalls}\n`);

    const results = [];

    // Run each scraper with 10-second delay between them
    for (let i = 0; i < this.scrapers.length; i++) {
      const scraper = this.scrapers[i];

      console.log(`\n[${i + 1}/${this.scrapers.length}] Running ${scraper.name} (${scraper.type.toUpperCase()})...`);

      try {
        const result = await this.runSingleScraper(scraper);
        results.push(result);

        // Track AI vs CSS usage
        if (result.success) {
          if (scraper.type === 'ai') {
            this.stats.aiScrapes++;
          } else {
            this.stats.cssScrapes++;
          }
        }

        // Delay before next scraper (except last one)
        if (i < this.scrapers.length - 1) {
          console.log('⏳ Waiting 10 seconds before next scraper...');
          await this.delay(10000);
        }
      } catch (error) {
        if (error.message === 'DAILY_COST_LIMIT_EXCEEDED') {
          console.log('\n🛑 Stopping scrape cycle due to cost limit\n');
          this.isRunning = false;
          this.stop(); // Stop the cron schedule
          return;
        }
        // Other errors - log and continue
        console.log(`   ❌ Error: ${error.message}`);
        results.push({
          scraper: scraper.name,
          type: scraper.type,
          success: false,
          productsScraped: 0,
          productsStored: 0,
          duration: 0,
          error: error.message
        });
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
    const aiSuccessful = results.filter(r => r.success && r.type === 'ai').length;

    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║          AUTOMATED SCRAPE CYCLE WITH AI - COMPLETE              ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log(`⏰ Completed at: ${new Date().toISOString()}`);
    console.log(`⏱️  Duration: ${cycleDuration} minutes`);
    console.log(`✅ Successful scrapers: ${successful}/${this.scrapers.length}`);
    console.log(`🤖 AI-powered scrapers: ${aiSuccessful} succeeded`);
    console.log(`📦 Total products stored: ${totalProducts}`);

    // Show updated cost stats
    const finalCostStats = await costMonitor.getStats();
    console.log(`\n💰 API Cost This Cycle: $${(finalCostStats.totalCost - costStats.totalCost).toFixed(4)}`);
    console.log(`💰 Total Today: $${finalCostStats.totalCost.toFixed(4)} / $${finalCostStats.limits.maxDailyCost.toFixed(2)} (${finalCostStats.status.percentUsed.toFixed(1)}%)`);
    console.log(`📊 Total API Calls Today: ${finalCostStats.totalCalls}`);

    console.log(`\n📊 Next cycle: ${this.getNextRunTime()}\n`);

    this.isRunning = false;

    // Cleanup old products after each cycle
    await this.cleanupOldProducts();
  }

  /**
   * Run a single scraper and store products in database
   */
  async runSingleScraper(scraperConfig) {
    const { name, Class, maxProducts, type } = scraperConfig;
    this.currentScraper = name;
    const startTime = Date.now();

    try {
      // Initialize scraper
      const scraper = new Class({ maxProducts });

      // Scrape products
      console.log(`   ⏳ Scraping with ${type.toUpperCase()} method...`);
      const products = await scraper.scrape();

      if (products.length === 0) {
        console.log(`   ⚠️  No products found`);
        return {
          scraper: name,
          type,
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
        type,
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
        type,
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
   * Map scraper source strings to ProductSource enum values
   */
  mapSourceToEnum(sourceString) {
    const mapping = {
      'footlocker.co.uk': 'footlocker',
      'hm.com': 'hm',
      'zara.com': 'zara',
      'mango.com': 'mango',
      'decathlon.co.uk': 'decathlon',
      'nike.com': 'nike',
      'adidas.com': 'adidas',
      'amazon.com': 'amazon',
      'asos.com': 'asos'
    };

    return mapping[sourceString] || 'manual';
  }

  /**
   * Validate image URL - must be a real product image
   */
  async validateImage(imageUrl) {
    if (!imageUrl || imageUrl.trim() === '') {
      return { valid: false, reason: 'Missing image URL' };
    }

    // Check if URL looks like an HTML page (not an image)
    if (imageUrl.includes('/product/') || imageUrl.includes('/en/') || imageUrl.endsWith('.html')) {
      return { valid: false, reason: 'Image URL is a product page, not an image' };
    }

    // Reject badges, icons, and small overlay images
    const badgePatterns = [
      'badge',
      'icon',
      'logo',
      'exclusive',
      'sale_badge',
      '100x',  // Small images like 100x321
      'overlay',
      'crobox.io' // Crobox CDN is used for badges/overlays
    ];

    const urlLower = imageUrl.toLowerCase();
    for (const pattern of badgePatterns) {
      if (urlLower.includes(pattern)) {
        return { valid: false, reason: `Rejected badge/icon image (${pattern})` };
      }
    }

    try {
      const axios = require('axios');
      const response = await axios.head(imageUrl, {
        timeout: 5000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const contentType = response.headers['content-type'];

      if (response.status !== 200) {
        return { valid: false, reason: `HTTP ${response.status}` };
      }

      if (!contentType || !contentType.startsWith('image/')) {
        return { valid: false, reason: `Not an image (${contentType})` };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, reason: error.message };
    }
  }

  /**
   * Store products in database (upsert to avoid duplicates)
   * STRICT VALIDATION: Only stores products with valid images AND real discounts
   */
  async storeProducts(products) {
    let stored = 0;
    let rejected = 0;

    console.log(`   🔍 Validating ${products.length} products...`);

    for (const product of products) {
      try {
        // RULE 1: Must have a real discount (originalPrice > salePrice)
        if (!product.originalPrice || !product.salePrice || product.originalPrice <= product.salePrice) {
          console.log(`      ❌ Rejected "${product.name}": Invalid discount (${product.salePrice} >= ${product.originalPrice})`);
          rejected++;
          continue;
        }

        // RULE 2: Must have a valid image URL
        const imageValidation = await this.validateImage(product.image);
        if (!imageValidation.valid) {
          console.log(`      ❌ Rejected "${product.name}": ${imageValidation.reason}`);
          rejected++;
          continue;
        }

        // RULE 3: Discount must be positive
        if (product.discount <= 0) {
          console.log(`      ❌ Rejected "${product.name}": Zero or negative discount (${product.discount}%)`);
          rejected++;
          continue;
        }

        // Map source string to enum value
        const sourceEnum = this.mapSourceToEnum(product.source);

        // Check if product already exists by URL
        const existing = await prisma.product.findFirst({
          where: { productUrl: product.url }
        });

        if (existing) {
          // Update existing product
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              name: product.name,
              brand: product.brand,
              category: product.category,
              originalPrice: product.originalPrice,
              salePrice: product.salePrice,
              discountPercentage: product.discount,
              currency: product.currency,
              imageUrl: product.image,
              source: sourceEnum,
              availableRegions: product.availableRegions || [],
              updatedAt: new Date()
            }
          });
        } else {
          // Create new product
          await prisma.product.create({
            data: {
              name: product.name,
              brand: product.brand,
              category: product.category,
              originalPrice: product.originalPrice,
              salePrice: product.salePrice,
              discountPercentage: product.discount,
              currency: product.currency,
              imageUrl: product.image,
              productUrl: product.url,
              source: sourceEnum,
              availableRegions: product.availableRegions || []
            }
          });
        }

        stored++;
      } catch (error) {
        console.error(`      ⚠️  Failed to store "${product.name}": ${error.message}`);
        rejected++;
      }
    }

    if (rejected > 0) {
      console.log(`   ⚠️  Rejected ${rejected} products (invalid images or discounts)`);
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
          createdAt: {
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
    schedulerInstance = new AutoScraperWithAI();
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
  AutoScraperWithAI,
  getScheduler,
  startAutoScraping,
  stopAutoScraping,
  getSchedulerStats,
  triggerManualScrape
};

// Run if executed directly
if (require.main === module) {
  console.log('Starting Auto-Scraper with AI Fallbacks...\n');
  startAutoScraping();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\nShutting down gracefully...');
    stopAutoScraping();
    prisma.$disconnect();
    process.exit(0);
  });
}
