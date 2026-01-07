const BaseScraper = require('../brands/base-scraper');

/**
 * DicksSportingGoodsScraper - Scrapes Dick's for Adidas deals
 *
 * Dick's sells Nike, Adidas, Puma, Under Armour, etc.
 * Typically has lighter protection than brand sites
 */
class DicksSportingGoodsScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: 50,
      scrollDelay: 3000,
      rateLimit: 3000,
      ...config
    });

    this.source = 'dickssportinggoods.com';
  }

  /**
   * Search for brand deals on Dick's
   */
  async searchBrand(brand = 'adidas', category = 'shoes') {
    console.log(`🔍 [DicksSportingGoodsScraper] Searching for ${brand} ${category}...`);

    const products = [];

    // Dick's search URL pattern
    const searchUrl = `https://www.dickssportinggoods.com/s/products?q=${brand}%20${category}%20clearance`;

    try {
      await this.initBrowser();

      console.log(`📄 Loading: ${searchUrl}`);

      await this.page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      console.log('📄 Page loaded, waiting for products...');

      // Wait for products to render
      await this.delay(5000);

      // Try multiple product selectors
      const productSelectors = [
        '[data-testid="product-card"]',
        '.dsg-product-card',
        '[class*="ProductCard"]',
        'article[data-product]',
        'div[class*="product-card"]',
        '.product-grid__item'
      ];

      let workingSelector = null;
      for (const selector of productSelectors) {
        const count = await this.page.$$eval(selector, els => els.length);
        if (count > 0) {
          workingSelector = selector;
          console.log(`✅ Found ${count} products with: ${selector}`);
          break;
        }
      }

      if (!workingSelector) {
        console.log(`❌ No products found with any selector`);

        // Debug: save screenshot and HTML
        await this.page.screenshot({ path: '/tmp/dicks-debug.png' });
        console.log('📸 Debug screenshot saved to /tmp/dicks-debug.png');

        return products;
      }

      // Scroll to load more
      await this.scrollToLoadProducts(2);

      // Extract products
      const scrapedProducts = await this.page.evaluate((selector, searchBrand) => {
        const cards = document.querySelectorAll(selector);
        const results = [];

        cards.forEach(card => {
          try {
            // Get link
            const link = card.querySelector('a[href]');
            if (!link) return;

            const url = link.href;
            if (!url) return;

            // Get product name
            const nameEl = card.querySelector('[class*="name"], [class*="title"], h2, h3, [class*="ProductCard-name"]');
            const name = nameEl ? nameEl.textContent.trim() : null;

            if (!name) return;

            // Verify it contains the brand
            if (!name.toLowerCase().includes(searchBrand.toLowerCase())) {
              return;
            }

            // Get image
            const img = card.querySelector('img');
            const image = img ? (img.src || img.dataset.src || img.getAttribute('data-lazy-src')) : null;

            // Get prices
            let originalPrice = null;
            let salePrice = null;

            // Method 1: Look for sale/clearance indicators
            const priceContainer = card.querySelector('[class*="price"], [class*="Price"]');
            if (priceContainer) {
              // Sale price
              const saleEl = priceContainer.querySelector('[class*="sale"], [class*="Sale"], [class*="current"]');
              if (saleEl) {
                salePrice = saleEl.textContent.trim();
              }

              // Original price (crossed out)
              const origEl = priceContainer.querySelector('[class*="original"], [class*="was"], [class*="strike"], s, del');
              if (origEl) {
                originalPrice = origEl.textContent.trim();
              }

              // Fallback: get all price elements
              if (!originalPrice || !salePrice) {
                const allPrices = Array.from(priceContainer.querySelectorAll('[class*="price"]'))
                  .map(el => el.textContent.trim())
                  .filter(t => t.match(/\$\d+/));

                if (allPrices.length >= 2) {
                  salePrice = allPrices[0];
                  originalPrice = allPrices[1];
                } else if (allPrices.length === 1) {
                  // Single price, might be on clearance
                  salePrice = allPrices[0];
                }
              }
            }

            // Only add if we have sale price (original price optional for clearance)
            if (name && url && image && salePrice) {
              results.push({
                name,
                url,
                image,
                originalPrice,
                salePrice
              });
            }
          } catch (e) {
            console.error('Error processing product:', e.message);
          }
        });

        return results;
      }, workingSelector, brand);

      console.log(`📦 Extracted ${scrapedProducts.length} ${brand} products from Dick's`);

      // Process and validate
      for (const rawProduct of scrapedProducts) {
        if (products.length >= this.config.maxProducts) break;

        try {
          const salePrice = this.extractPrice(rawProduct.salePrice);
          const originalPrice = rawProduct.originalPrice ? this.extractPrice(rawProduct.originalPrice) : null;

          // If no original price, estimate at 20% markup (conservative)
          const estimatedOriginal = originalPrice || (salePrice * 1.2);

          // Validate discount if we have both prices
          if (originalPrice) {
            const discountCheck = this.isRealDiscount(originalPrice, salePrice);
            if (!discountCheck.valid) {
              console.log(`⚠️  Rejected "${rawProduct.name}": ${discountCheck.reason}`);
              continue;
            }
          }

          const discount = originalPrice
            ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
            : 20; // Assume 20% for clearance items

          const product = {
            id: `dicks-${Date.now()}-${products.length}`,
            name: rawProduct.name,
            brand: brand,
            category: category,
            originalPrice: originalPrice || estimatedOriginal,
            salePrice,
            discount,
            image: rawProduct.image,
            url: rawProduct.url,
            source: this.source,
            verified: false,
            scrapedAt: new Date().toISOString()
          };

          products.push(product);
          console.log(`✅ Added: ${product.name} (${product.discount}% off)`);

        } catch (error) {
          console.error(`❌ Error processing product:`, error.message);
        }
      }

      console.log(`🎉 Dick's scraping complete: ${products.length} ${brand} products`);

    } catch (error) {
      console.error(`❌ Dick's Sporting Goods error:`, error.message);
    } finally {
      await this.close();
    }

    return products;
  }
}

module.exports = DicksSportingGoodsScraper;
