const BaseScraper = require('../brands/base-scraper');

/**
 * ShopStyleScraper - Scrapes ShopStyle deal aggregator
 *
 * ShopStyle aggregates deals from Nike, Adidas, Puma, etc.
 * Much lighter bot protection than brand sites
 */
class ShopStyleScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: 100,
      scrollDelay: 3000,
      rateLimit: 3000,
      ...config
    });

    this.source = 'shopstyle.com';
  }

  /**
   * Search for brand deals on ShopStyle
   */
  async searchBrand(brand = 'adidas', category = 'shoes') {
    console.log(`🔍 [ShopStyleScraper] Searching for ${brand} ${category} deals...`);

    const products = [];
    const searchUrl = `https://www.shopstyle.com/${category}/br/${brand.toLowerCase()}?fl=on-sale`;

    try {
      await this.initBrowser();

      console.log(`📄 Loading: ${searchUrl}`);

      await this.page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      // Wait for products
      await this.delay(3000);

      // Try multiple product selectors
      const productSelectors = [
        '[data-test="product-card"]',
        '.product-card',
        '[class*="ProductCard"]',
        'article[data-product]',
        '[class*="product"]'
      ];

      let workingSelector = null;
      for (const selector of productSelectors) {
        const found = await this.page.$(selector);
        if (found) {
          workingSelector = selector;
          console.log(`✅ Found products with: ${selector}`);
          break;
        }
      }

      if (!workingSelector) {
        console.log(`❌ No products found on ShopStyle`);
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
            const url = link ? link.href : null;

            // Get name
            const nameEl = card.querySelector('[class*="name"], [class*="title"], h2, h3');
            const name = nameEl ? nameEl.textContent.trim() : null;

            // Verify it's the brand we want
            if (name && !name.toLowerCase().includes(searchBrand.toLowerCase())) {
              return; // Skip products from other brands
            }

            // Get image
            const img = card.querySelector('img');
            const image = img ? (img.src || img.dataset.src) : null;

            // Get prices
            const priceContainer = card.querySelector('[class*="price"]');
            let originalPrice = null;
            let salePrice = null;

            if (priceContainer) {
              const saleEl = priceContainer.querySelector('[class*="sale"], [class*="current"]');
              const origEl = priceContainer.querySelector('[class*="original"], [class*="was"], s, del');

              if (saleEl) salePrice = saleEl.textContent.trim();
              if (origEl) originalPrice = origEl.textContent.trim();

              // Fallback: get all prices
              if (!originalPrice || !salePrice) {
                const allPrices = Array.from(priceContainer.querySelectorAll('[class*="price"]'))
                  .map(el => el.textContent.trim());

                if (allPrices.length >= 2) {
                  salePrice = allPrices[0];
                  originalPrice = allPrices[1];
                }
              }
            }

            if (name && url && image && originalPrice && salePrice) {
              results.push({
                name,
                url,
                image,
                originalPrice,
                salePrice,
                brand: searchBrand
              });
            }
          } catch (e) {
            // Skip
          }
        });

        return results;
      }, workingSelector, brand);

      console.log(`📦 Extracted ${scrapedProducts.length} ${brand} products`);

      // Validate and process
      for (const rawProduct of scrapedProducts) {
        if (products.length >= this.config.maxProducts) break;

        try {
          const originalPrice = this.extractPrice(rawProduct.originalPrice);
          const salePrice = this.extractPrice(rawProduct.salePrice);

          const discountCheck = this.isRealDiscount(originalPrice, salePrice);
          if (!discountCheck.valid) {
            continue;
          }

          const product = {
            id: `shopstyle-${Date.now()}-${products.length}`,
            name: rawProduct.name,
            brand: rawProduct.brand,
            category: category,
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
          console.log(`✅ Added: ${product.name} (${product.discount}% off)`);
        } catch (error) {
          console.error(`❌ Error processing:`, error.message);
        }
      }

      console.log(`🎉 ShopStyle scraping complete: ${products.length} ${brand} deals`);

    } catch (error) {
      console.error(`❌ ShopStyle error:`, error.message);
    } finally {
      await this.close();
    }

    return products;
  }
}

module.exports = ShopStyleScraper;
