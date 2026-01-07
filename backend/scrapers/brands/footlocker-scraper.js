const BaseScraper = require('./base-scraper');

/**
 * FootLockerScraper - Scrapes Foot Locker sale pages
 *
 * Foot Locker sells Nike, Adidas, Puma, and other brands
 * Typically has lighter bot protection than brand sites
 */
class FootLockerScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: 50,
      scrollDelay: 3000,
      rateLimit: 5000,
      ...config
    });

    this.targetUrl = 'https://www.footlocker.com/category/sale/sale-shoes.html';
    this.brand = 'Multiple'; // Sells multiple brands
    this.source = 'footlocker.com';
  }

  /**
   * Main scraping method
   */
  async scrape(browserInstance = null) {
    const products = [];

    try {
      console.log(`🔍 [${this.getName()}] Starting scrape of ${this.targetUrl}`);

      await this.initBrowser(browserInstance);

      // Navigate to Foot Locker sale page
      await this.page.goto(this.targetUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      console.log(`📄 [${this.getName()}] Page loaded, waiting for products...`);

      // Wait for product grid - try multiple selectors
      const productSelectors = [
        '[data-testid="product-card"]',
        '.ProductCard',
        '[class*="ProductCard"]',
        '[class*="product-card"]',
        'article[class*="product"]'
      ];

      let foundSelector = null;
      for (const selector of productSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          foundSelector = selector;
          console.log(`✅ [${this.getName()}] Found products with selector: ${selector}`);
          break;
        } catch (e) {
          continue;
        }
      }

      if (!foundSelector) {
        console.error(`❌ [${this.getName()}] No product selectors worked`);
        return products;
      }

      // Scroll to load more products
      await this.scrollToLoadProducts(2);

      // Extract products
      const scrapedProducts = await this.page.evaluate((selector) => {
        const productElements = document.querySelectorAll(selector);
        const results = [];

        productElements.forEach((card, index) => {
          try {
            // Extract product link
            const linkElement = card.querySelector('a[href]');
            if (!linkElement) return;

            const url = linkElement.href;
            if (!url || !url.includes('footlocker.com')) return;

            // Extract product name
            const nameElement = card.querySelector('[class*="ProductName"], [class*="name"], h2, h3');
            const name = nameElement ? nameElement.textContent.trim() : '';
            if (!name) return;

            // Extract brand from name
            const brandMatch = name.match(/^(\w+)\s+/);
            const brand = brandMatch ? brandMatch[1] : 'Unknown';

            // Extract image
            const imageElement = card.querySelector('img');
            const image = imageElement ? (imageElement.src || imageElement.dataset.src) : '';
            if (!image) return;

            // Extract prices
            let originalPriceText = null;
            let salePriceText = null;

            // Method 1: Look for price container
            const priceContainer = card.querySelector('[class*="Price"], [class*="price"]');
            if (priceContainer) {
              // Look for sale price
              const saleEl = priceContainer.querySelector('[class*="sale"], [class*="Sale"]');
              if (saleEl) {
                salePriceText = saleEl.textContent.trim();
              }

              // Look for original price (crossed out)
              const originalEl = priceContainer.querySelector('[class*="original"], [class*="Original"], del, s');
              if (originalEl) {
                originalPriceText = originalEl.textContent.trim();
              }

              // Fallback: get all price elements
              if (!originalPriceText || !salePriceText) {
                const priceElements = priceContainer.querySelectorAll('[class*="price"]');
                const prices = Array.from(priceElements).map(el => el.textContent.trim());

                if (prices.length >= 2) {
                  salePriceText = prices[0];
                  originalPriceText = prices[1];
                }
              }
            }

            // Only add if we have both prices
            if (originalPriceText && salePriceText) {
              results.push({
                name,
                brand,
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
      }, foundSelector);

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
            id: `footlocker-${Date.now()}-${products.length}`,
            name: rawProduct.name,
            brand: rawProduct.brand,
            category: this.categorizeProduct(rawProduct.name),
            originalPrice,
            salePrice,
            discount: discountCheck.discount,
            image: rawProduct.image,
            url: rawProduct.url,
            source: this.source,
            verified: false,
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
      await this.close(!browserInstance);
    }

    return products;
  }

  /**
   * Categorize product
   */
  categorizeProduct(name) {
    const lower = name.toLowerCase();

    if (lower.match(/\b(shoe|sneaker|boot|sandal|trainer|jordan|air|dunk|max)\b/)) {
      return 'shoes';
    }
    if (lower.match(/\b(shirt|top|jacket|hoodie|pants|shorts|socks)\b/)) {
      return 'clothing';
    }
    if (lower.match(/\b(bag|backpack|hat|cap)\b/)) {
      return 'accessories';
    }

    return 'shoes'; // Default
  }
}

module.exports = FootLockerScraper;
