const FallbackScraper = require('../brands/fallback-scraper');

/**
 * Mango EU Scraper with AI Fallback
 *
 * Uses screenshot + text parsing with Claude AI when CSS selectors fail
 */
class MangoEUFallbackScraper extends FallbackScraper {
  constructor(config = {}) {
    super({
      maxProducts: 30,
      scrollDelay: 3000,
      rateLimit: 3000,
      timeout: 60000,
      scraperName: 'Mango EU (AI)',
      ...config
    });

    this.source = 'mango.com';
    this.currency = 'EUR';
    this.availableRegions = ['EU', 'ES', 'FR', 'DE', 'IT', 'UK'];
    this.brand = 'Mango';
  }

  /**
   * Scrape using AI-powered fallback methods
   */
  async scrape() {
    console.log(`\n🔍 [Mango EU Fallback] Using AI-powered scraping...`);

    const url = 'https://shop.mango.com/es/en/c/women/shoes_826dba0a';

    try {
      // Use hybrid approach (screenshot + text parsing)
      const products = await this.scrapeWithFallback(
        url,
        'Mango women\'s shoes on sale',
        this.source
      );

      // Update source and regions for all products
      products.forEach(p => {
        p.source = this.source;
        p.currency = this.currency;
        p.availableRegions = this.availableRegions;
        p.brand = p.brand === 'Unknown' ? this.brand : p.brand;
      });

      // Limit to maxProducts
      const limitedProducts = products.slice(0, this.config.maxProducts);

      console.log(`\n🎉 Mango EU scraping complete: ${limitedProducts.length} products`);
      console.log(`🌍 Regions: ${this.availableRegions.join(', ')}`);
      console.log(`💰 Currency: ${this.currency}\n`);

      return limitedProducts;

    } catch (error) {
      console.error(`❌ Mango EU fallback error:`, error.message);
      return [];
    }
  }
}

module.exports = MangoEUFallbackScraper;
