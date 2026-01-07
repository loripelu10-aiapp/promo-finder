const BaseScraper = require('./base-scraper');

/**
 * NikeScraper - Scrapes Nike sale page for deals
 *
 * Target: https://www.nike.com/w/sale-3yaep
 * Extracts products with real discounts only (no price estimation)
 */
class NikeScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: 50,
      scrollDelay: 3000, // Nike loads products dynamically
      rateLimit: 5000,
      ...config
    });

    this.targetUrl = 'https://www.nike.com/w/sale-3yaep';
    this.brand = 'Nike';
    this.source = 'nike.com';
    this.currency = 'USD';
    this.availableRegions = ['US', 'EU', 'UK', 'GLOBAL']; // Nike accessible worldwide
  }

  /**
   * Main scraping method
   */
  async scrape(browserInstance = null) {
    const products = [];

    try {
      console.log(`🔍 [${this.getName()}] Starting scrape of ${this.targetUrl}`);

      await this.initBrowser(browserInstance);

      // Navigate to Nike sale page
      await this.page.goto(this.targetUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      console.log(`📄 [${this.getName()}] Page loaded, waiting for products...`);

      // Wait for product grid to load
      try {
        await this.page.waitForSelector('.product-card, .product-grid__items', {
          timeout: 10000
        });
      } catch (error) {
        console.error(`❌ [${this.getName()}] Product grid not found:`, error.message);
        return products;
      }

      // Scroll to load more products
      await this.scrollToLoadProducts(3);

      // Extract products
      const scrapedProducts = await this.page.evaluate(() => {
        const productElements = document.querySelectorAll('.product-card');
        const results = [];

        productElements.forEach((card, index) => {
          try {
            // Extract product link
            const linkElement = card.querySelector('a.product-card__link-overlay, a[href*="/t/"]');
            if (!linkElement) return;

            const url = linkElement.href;
            if (!url || !url.includes('nike.com')) return;

            // Extract product name
            const nameElement = card.querySelector('.product-card__title, .product-card__subtitle');
            const name = nameElement ? nameElement.textContent.trim() : '';
            if (!name) return;

            // Extract image
            const imageElement = card.querySelector('img');
            const image = imageElement ? (imageElement.src || imageElement.dataset.src) : '';
            if (!image) return;

            // Extract prices
            // Nike has separate child elements for each price:
            // - [data-testid="product-price-reduced"] = sale price
            // - .is--striked-out = original price
            let originalPriceText = null;
            let salePriceText = null;

            // Method 1: Target specific Nike price elements (most reliable)
            const salePriceElement = card.querySelector('[data-testid="product-price-reduced"]');
            const originalPriceElement = card.querySelector('.is--striked-out, [data-testid="product-price"]:not([data-testid="product-price-reduced"])');

            if (salePriceElement && originalPriceElement) {
              salePriceText = salePriceElement.textContent.trim();
              originalPriceText = originalPriceElement.textContent.trim();
            }

            // Method 2: Fallback - check for any price elements with strikethrough styling
            if (!originalPriceText || !salePriceText) {
              const allPriceElems = Array.from(card.querySelectorAll('[class*="price"]'));

              allPriceElems.forEach(el => {
                const text = el.textContent.trim();
                if (!text || text.length > 20) return; // Skip containers

                const style = window.getComputedStyle(el);

                if (style.textDecoration === 'line-through' || el.className.includes('striked-out')) {
                  originalPriceText = text;
                } else if (el.className.includes('current-price') || el.getAttribute('data-testid') === 'product-price-reduced') {
                  salePriceText = text;
                }
              });
            }

            // Only add if we have both prices
            if (originalPriceText && salePriceText && originalPriceText !== salePriceText) {
              results.push({
                name,
                url,
                image,
                originalPriceText,
                salePriceText,
                index
              });
            }
          } catch (error) {
            console.error('Error processing product card:', error.message);
          }
        });

        return results;
      });

      console.log(`📦 [${this.getName()}] Found ${scrapedProducts.length} products with price data`);

      // Process and validate products
      for (const rawProduct of scrapedProducts) {
        if (products.length >= this.config.maxProducts) {
          console.log(`✋ [${this.getName()}] Reached max products limit (${this.config.maxProducts})`);
          break;
        }

        try {
          // Extract prices
          const originalPrice = this.extractPrice(rawProduct.originalPriceText);
          const salePrice = this.extractPrice(rawProduct.salePriceText);

          // Validate discount
          const discountCheck = this.isRealDiscount(originalPrice, salePrice);
          if (!discountCheck.valid) {
            console.log(`⚠️  [${this.getName()}] Rejected "${rawProduct.name}": ${discountCheck.reason}`);
            continue;
          }

          // Create product object
          const product = {
            id: `nike-${Date.now()}-${products.length}`,
            name: rawProduct.name,
            brand: this.brand,
            category: this.categorizeProduct(rawProduct.name),
            originalPrice,
            salePrice,
            discount: discountCheck.discount,
            currency: this.currency,
            image: rawProduct.image,
            url: rawProduct.url,
            source: this.source,
            availableRegions: this.availableRegions, // GLOBAL - works everywhere
            verified: false, // Will be verified by validation pipeline
            scrapedAt: new Date().toISOString()
          };

          products.push(product);
          console.log(`✅ [${this.getName()}] Added: ${product.name} (${product.discount}% off)`);

        } catch (error) {
          console.error(`❌ [${this.getName()}] Error processing product:`, error.message);
        }
      }

      console.log(`🎉 [${this.getName()}] Scraping complete: ${products.length} valid products`);

    } catch (error) {
      console.error(`❌ [${this.getName()}] Fatal error during scraping:`, error.message);
      throw error;
    } finally {
      // Only close browser if we created it (not provided by pool)
      await this.close(!browserInstance);
    }

    return products;
  }

  /**
   * Categorize product based on name
   */
  categorizeProduct(name) {
    const lower = name.toLowerCase();

    if (lower.match(/\b(shoe|sneaker|boot|sandal|trainer|air|jordan|dunk|cortez|pegasus|blazer|force|max)\b/)) {
      return 'shoes';
    }
    if (lower.match(/\b(shirt|top|jacket|hoodie|sweater|dress|pants|jeans|shorts|tights|leggings)\b/)) {
      return 'clothing';
    }
    if (lower.match(/\b(bag|backpack|wallet|hat|cap|socks|gloves)\b/)) {
      return 'accessories';
    }

    return 'shoes'; // Default for Nike
  }
}

module.exports = NikeScraper;
