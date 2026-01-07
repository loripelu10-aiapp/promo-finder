const FallbackScraper = require('../brands/fallback-scraper');

/**
 * Zara EU Scraper with AI Fallback
 *
 * Uses screenshot + text parsing with Claude AI when CSS selectors fail
 * More reliable than traditional scraping for heavily JavaScript sites
 */
class ZaraEUFallbackScraper extends FallbackScraper {
  constructor(config = {}) {
    super({
      maxProducts: 30,
      scrollDelay: 3000,
      rateLimit: 4000,
      timeout: 90000, // Increased timeout
      scraperName: 'Zara EU (AI)',
      ...config
    });

    this.source = 'zara.com';
    this.currency = 'EUR';
    this.availableRegions = ['EU', 'ES', 'FR', 'DE', 'IT', 'UK'];
    this.brand = 'Zara';
  }

  /**
   * Scrape using AI-powered fallback methods
   */
  async scrape() {
    console.log(`\n🔍 [Zara EU Fallback] Using AI-powered scraping...`);

    const url = 'https://www.zara.com/uk/en/woman-shoes-special-prices-l1290.html';

    try {
      // Use hybrid approach (screenshot + text parsing)
      const products = await this.scrapeWithFallback(
        url,
        'Zara women\'s shoes on sale',
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

      console.log(`\n🎉 Zara EU scraping complete: ${limitedProducts.length} products`);
      console.log(`🌍 Regions: ${this.availableRegions.join(', ')}`);
      console.log(`💰 Currency: ${this.currency}\n`);

      return limitedProducts;

    } catch (error) {
      console.error(`❌ Zara EU fallback error:`, error.message);
      return [];
    }
  }
}

module.exports = ZaraEUFallbackScraper;
