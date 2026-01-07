const BaseScraper = require('./base-scraper');

/**
 * AdidasScraper - Scrapes Adidas outlet page for deals
 *
 * Target: https://www.adidas.com/us/outlet
 * Extracts products with real discounts only (no price estimation)
 */
class AdidasScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: 50,
      scrollDelay: 3000, // Adidas loads products dynamically
      rateLimit: 5000,
      ...config
    });

    this.targetUrl = 'https://www.adidas.com/us/outlet';
    this.brand = 'Adidas';
    this.source = 'adidas.com';
  }

  /**
   * Main scraping method
   */
  async scrape(browserInstance = null) {
    const products = [];

    try {
      console.log(`🔍 [${this.getName()}] Starting scrape of ${this.targetUrl}`);

      await this.initBrowser(browserInstance);

      // Navigate to Adidas outlet page
      await this.page.goto(this.targetUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      console.log(`📄 [${this.getName()}] Page loaded, waiting for products...`);

      // Wait for product grid to load
      try {
        await this.page.waitForSelector('.grid-item, [data-auto-id="glass-product-card"], .product-card', {
          timeout: 10000
        });
      } catch (error) {
        console.error(`❌ [${this.getName()}] Product grid not found:`, error.message);
        return products;
      }

      // Handle "Show More" button if present
      await this.clickShowMoreButton();

      // Scroll to load more products
      await this.scrollToLoadProducts(3);

      // Extract products
      const scrapedProducts = await this.page.evaluate(() => {
        const productElements = document.querySelectorAll('.grid-item, [data-auto-id="glass-product-card"], .product-card');
        const results = [];

        productElements.forEach((card, index) => {
          try {
            // Extract product link
            const linkElement = card.querySelector('a[href*="/"], a.glass-product-card__link');
            if (!linkElement) return;

            const url = linkElement.href;
            if (!url || !url.includes('adidas.com')) return;

            // Extract product name
            const nameElement = card.querySelector('.glass-product-card__title, [data-auto-id="glass-product-card-title"], .product-title, h5, h4');
            const name = nameElement ? nameElement.textContent.trim() : '';
            if (!name) return;

            // Extract image
            const imageElement = card.querySelector('img');
            const image = imageElement ? (imageElement.src || imageElement.dataset.src) : '';
            if (!image) return;

            // Extract prices
            const priceContainer = card.querySelector('.gl-price-container, [data-auto-id="glass-price"], .product-price, .glass-product-price');
            if (!priceContainer) return;

            // Adidas shows prices with classes like:
            // .gl-price-item--sale (sale price)
            // .gl-price-item--crossed (original price)
            let originalPriceText = null;
            let salePriceText = null;

            // Look for crossed/strikethrough price (original)
            const crossedElement = priceContainer.querySelector('.gl-price-item--crossed, [class*="crossed"], del, s, [style*="line-through"]');
            if (crossedElement) {
              originalPriceText = crossedElement.textContent.trim();
            }

            // Look for sale price
            const saleElement = priceContainer.querySelector('.gl-price-item--sale, [class*="sale"], .sale-price');
            if (saleElement) {
              salePriceText = saleElement.textContent.trim();
            }

            // Fallback: get all price elements and try to determine which is which
            if (!originalPriceText || !salePriceText) {
              const allPriceElements = Array.from(priceContainer.querySelectorAll('[class*="price"], [class*="gl-price-item"]'));

              allPriceElements.forEach(el => {
                const text = el.textContent.trim();
                const style = window.getComputedStyle(el);

                if (style.textDecoration === 'line-through' || el.className.includes('crossed')) {
                  originalPriceText = text;
                } else if (el.className.includes('sale') || !originalPriceText) {
                  salePriceText = text;
                }
              });
            }

            // If we have both prices, add to results
            if (originalPriceText && salePriceText) {
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
            id: `adidas-${Date.now()}-${products.length}`,
            name: rawProduct.name,
            brand: this.brand,
            category: this.categorizeProduct(rawProduct.name),
            originalPrice,
            salePrice,
            discount: discountCheck.discount,
            image: rawProduct.image,
            url: rawProduct.url,
            source: this.source,
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
   * Click "Show More" button to load additional products
   */
  async clickShowMoreButton() {
    try {
      const showMoreSelector = 'button[data-auto-id="show-more"], button.show-more, button[class*="load-more"]';

      // Wait for button to appear (with short timeout as it may not exist)
      const buttonExists = await this.page.$(showMoreSelector);

      if (buttonExists) {
        console.log(`🔘 [${this.getName()}] Clicking "Show More" button...`);
        await this.page.click(showMoreSelector);
        await this.delay(2000); // Wait for new products to load
        console.log(`✅ [${this.getName()}] Additional products loaded`);
      }
    } catch (error) {
      // Not a critical error - button may not exist
      console.log(`ℹ️  [${this.getName()}] No "Show More" button found (this is normal)`);
    }
  }

  /**
   * Categorize product based on name
   */
  categorizeProduct(name) {
    const lower = name.toLowerCase();

    if (lower.match(/\b(shoe|sneaker|boot|sandal|trainer|samba|gazelle|stan smith|ultraboost|superstar|forum|nmd)\b/)) {
      return 'shoes';
    }
    if (lower.match(/\b(shirt|top|jacket|hoodie|sweater|dress|pants|jeans|shorts|tights|leggings|tracksuit)\b/)) {
      return 'clothing';
    }
    if (lower.match(/\b(bag|backpack|wallet|hat|cap|socks|gloves|ball)\b/)) {
      return 'accessories';
    }

    return 'shoes'; // Default for Adidas
  }
}

module.exports = AdidasScraper;
