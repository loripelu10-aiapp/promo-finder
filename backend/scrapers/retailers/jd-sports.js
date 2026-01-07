const BaseScraper = require('../brands/base-scraper');

/**
 * JDSportsScraper - Scrapes JD Sports for Adidas/Nike deals
 *
 * JD Sports is a UK-based retailer with US presence
 * Specializes in athletic footwear and apparel
 */
class JDSportsScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: 50,
      scrollDelay: 3000,
      rateLimit: 3000,
      ...config
    });

    this.source = 'jdsports.com';
  }

  /**
   * Search for brand deals on JD Sports
   */
  async searchBrand(brand = 'adidas', category = 'shoes') {
    console.log(`🔍 [JDSportsScraper] Searching for ${brand} ${category}...`);

    const products = [];

    // JD Sports US sale URL
    const searchUrl = `https://www.jdsports.com/store/search/?query=${brand}%20${category}&sort=price-low-to-high`;

    try {
      await this.initBrowser();

      console.log(`📄 Loading: ${searchUrl}`);

      await this.page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      console.log('📄 Page loaded, waiting for products...');

      await this.delay(5000);

      // Try multiple product selectors
      const productSelectors = [
        '[data-e2e="product-listing"]',
        '.productListItem',
        '[class*="ProductCard"]',
        'article.product',
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
        console.log(`❌ No products found`);
        await this.page.screenshot({ path: '/tmp/jdsports-debug.png' });
        console.log('📸 Debug screenshot saved to /tmp/jdsports-debug.png');
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
            const nameEl = card.querySelector('[class*="name"], [class*="title"], [class*="productTitle"], h2, h3');
            const name = nameEl ? nameEl.textContent.trim() : null;

            if (!name || !name.toLowerCase().includes(searchBrand.toLowerCase())) {
              return;
            }

            // Get image
            const img = card.querySelector('img');
            const image = img ? (img.src || img.dataset.src) : null;

            // Get prices
            let originalPrice = null;
            let salePrice = null;

            const priceContainer = card.querySelector('[class*="price"], [class*="Price"]');
            if (priceContainer) {
              // Sale price
              const saleEl = priceContainer.querySelector('[class*="sale"], [class*="now"], [class*="current"]');
              if (saleEl) {
                salePrice = saleEl.textContent.trim();
              }

              // Original price
              const origEl = priceContainer.querySelector('[class*="was"], [class*="original"], s, del');
              if (origEl) {
                originalPrice = origEl.textContent.trim();
              }

              // Fallback
              if (!salePrice) {
                const allPrices = Array.from(priceContainer.querySelectorAll('[class*="price"]'))
                  .map(el => el.textContent.trim())
                  .filter(t => t.match(/[\$£€]\d+/));

                if (allPrices.length >= 1) {
                  salePrice = allPrices[0];
                  if (allPrices.length >= 2) {
                    originalPrice = allPrices[1];
                  }
                }
              }
            }

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
            // Skip
          }
        });

        return results;
      }, workingSelector, brand);

      console.log(`📦 Extracted ${scrapedProducts.length} ${brand} products from JD Sports`);

      // Process and validate
      for (const rawProduct of scrapedProducts) {
        if (products.length >= this.config.maxProducts) break;

        try {
          const salePrice = this.extractPrice(rawProduct.salePrice);
          const originalPrice = rawProduct.originalPrice ? this.extractPrice(rawProduct.originalPrice) : null;

          if (originalPrice) {
            const discountCheck = this.isRealDiscount(originalPrice, salePrice);
            if (!discountCheck.valid) {
              console.log(`⚠️  Rejected "${rawProduct.name}": ${discountCheck.reason}`);
              continue;
            }
          }

          const discount = originalPrice
            ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
            : 15;

          const product = {
            id: `jdsports-${Date.now()}-${products.length}`,
            name: rawProduct.name,
            brand: brand,
            category: category,
            originalPrice: originalPrice || (salePrice * 1.15),
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
          console.error(`❌ Error processing:`, error.message);
        }
      }

      console.log(`🎉 JD Sports scraping complete: ${products.length} ${brand} products`);

    } catch (error) {
      console.error(`❌ JD Sports error:`, error.message);
    } finally {
      await this.close();
    }

    return products;
  }
}

module.exports = JDSportsScraper;
