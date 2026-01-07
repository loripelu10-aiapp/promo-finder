const FallbackScraper = require('../brands/fallback-scraper');

/**
 * Decathlon EU Scraper with AI Fallback
 *
 * Uses screenshot + text parsing with Claude AI to bypass access blocking
 */
class DecathlonEUFallbackScraper extends FallbackScraper {
  constructor(config = {}) {
    super({
      maxProducts: 30,
      scrollDelay: 3000,
      rateLimit: 3000,
      timeout: 60000,
      scraperName: 'Decathlon EU (AI)',
      ...config
    });

    this.source = 'decathlon.co.uk';
    this.currency = 'GBP';
    this.availableRegions = ['EU', 'UK', 'FR', 'DE', 'IT', 'ES'];
  }

  /**
   * Scrape using AI-powered fallback methods
   */
  async scrape() {
    console.log(`\n🔍 [Decathlon EU Fallback] Using AI-powered scraping...`);

    const url = 'https://www.decathlon.co.uk/deals';

    try {
      // Use hybrid approach (screenshot + text parsing)
      const products = await this.scrapeWithFallback(
        url,
        'Decathlon sports shoes on sale',
        this.source
      );

      // Update source and regions for all products
      products.forEach(p => {
        p.source = this.source;
        p.currency = this.currency;
        p.availableRegions = this.availableRegions;
        p.category = 'shoes';

        // Extract brand from name if not detected
        if (p.brand === 'Unknown') {
          p.brand = this.extractDecathlonBrand(p.name);
        }
      });

      // Limit to maxProducts
      const limitedProducts = products.slice(0, this.config.maxProducts);

      console.log(`\n🎉 Decathlon EU scraping complete: ${limitedProducts.length} products`);
      console.log(`🌍 Regions: ${this.availableRegions.join(', ')}`);
      console.log(`💰 Currency: ${this.currency}\n`);

      return limitedProducts;

    } catch (error) {
      console.error(`❌ Decathlon EU fallback error:`, error.message);
      return [];
    }
  }

  /**
   * Extract Decathlon-specific brands
   */
  extractDecathlonBrand(name) {
    const nameLower = name.toLowerCase();
    const decathlonBrands = [
      'Kalenji', 'Kipsta', 'Domyos', 'Quechua', 'Artengo',
      'Inesis', 'Rockrider', 'B\'Twin', 'Btwin',
      'Nike', 'Adidas', 'Puma', 'New Balance', 'Asics', 'Reebok'
    ];

    for (const brand of decathlonBrands) {
      if (nameLower.includes(brand.toLowerCase())) {
        return brand;
      }
    }
    return 'Decathlon';
  }
}

module.exports = DecathlonEUFallbackScraper;
