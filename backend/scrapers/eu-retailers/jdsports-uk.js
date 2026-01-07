const BaseScraper = require('../brands/base-scraper');

/**
 * JD Sports UK Scraper - EU Accessible
 *
 * Scrapes JD Sports UK for Nike and Adidas deals
 * Available in: UK, EU (no GDPR blocking)
 * Currency: GBP (£)
 */
class JDSportsUKScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: 50,
      scrollDelay: 3000,
      rateLimit: 3000,
      timeout: 60000,
      ...config
    });

    this.source = 'jdsports.co.uk';
    this.currency = 'GBP';
    this.availableRegions = ['EU', 'UK']; // Tagged for EU/UK users
  }

  /**
   * Default scrape method - searches for Nike and Adidas
   */
  async scrape() {
    const nikeProducts = await this.searchBrand('nike', 'trainers');
    const adidasProducts = await this.searchBrand('adidas', 'trainers');
    return [...nikeProducts, ...adidasProducts];
  }

  /**
   * Search for brand deals on JD Sports UK
   */
  async searchBrand(brand = 'adidas', category = 'trainers') {
    console.log(`\n🔍 [JD Sports UK] Searching for ${brand} ${category}...`);

    const products = [];

    // JD Sports UK search URL
    const searchUrl = `https://www.jdsports.co.uk/search/?query=${brand}%20${category}&sort=price-low-to-high`;

    try {
      await this.initBrowser();

      console.log(`📄 Loading: ${searchUrl}`);

      await this.page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      console.log('📄 Page loaded, waiting for products...');

      // Wait for JavaScript to render
      await this.delay(8000);

      // Take debug screenshot
      await this.page.screenshot({ path: '/tmp/jdsports-uk-debug.png' });
      console.log('📸 Debug screenshot: /tmp/jdsports-uk-debug.png');

      // Check for blocking
      const pageTitle = await this.page.title();
      const bodyText = await this.page.evaluate(() => document.body.textContent.toLowerCase());

      if (bodyText.includes('access denied') || bodyText.includes('forbidden') || bodyText.includes('unavailable')) {
        console.log('❌ Site appears to be blocking access');
        return products;
      }

      console.log(`📄 Page title: ${pageTitle}`);

      // Try multiple product selectors
      const productSelectors = [
        '[data-test-id="product-grid-card"]',
        '[data-auto-id="productList"]',
        '.productListItem',
        '[class*="ProductCard"]',
        'article.product',
        'div[class*="product-card"]',
        '.product-grid__item',
        '[class*="ProductListItem"]'
      ];

      let workingSelector = null;
      for (const selector of productSelectors) {
        try {
          const count = await this.page.$$eval(selector, els => els.length);
          if (count > 0) {
            workingSelector = selector;
            console.log(`✅ Found ${count} products with: ${selector}`);
            break;
          }
        } catch (e) {
          // Selector invalid or not found
        }
      }

      if (!workingSelector) {
        console.log(`⚠️  No products found with any selector`);
        console.log('💡 Check /tmp/jdsports-uk-debug.png to identify correct selectors');
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
            const link = card.querySelector('a[href*="/product"]') || card.querySelector('a');
            if (!link) return;

            const url = link.href;
            if (!url || !url.includes('jdsports.co.uk')) return;

            // Get product name
            const nameEl = card.querySelector(
              '[class*="productName"], [class*="name"], [class*="title"], [data-test-id*="name"], h2, h3, span[class*="text"]'
            );
            const name = nameEl ? nameEl.textContent.trim() : null;

            if (!name) return;

            // Filter by brand
            if (!name.toLowerCase().includes(searchBrand.toLowerCase())) {
              return;
            }

            // Get image
            const img = card.querySelector('img');
            const image = img ? (img.src || img.dataset.src) : null;

            // Get prices
            let originalPrice = null;
            let salePrice = null;

            // JD Sports typically shows prices in span elements
            const priceContainer = card.querySelector('[class*="price"], [data-test-id*="price"]');
            if (priceContainer) {
              // Look for sale/now price
              const salePriceEl = priceContainer.querySelector(
                '[class*="sale"], [class*="now"], [class*="current"], span'
              );
              if (salePriceEl) {
                salePrice = salePriceEl.textContent.trim();
              }

              // Look for original/was price
              const originalPriceEl = priceContainer.querySelector(
                '[class*="was"], [class*="original"], s, del'
              );
              if (originalPriceEl) {
                originalPrice = originalPriceEl.textContent.trim();
              }

              // Fallback: get all price text
              if (!salePrice) {
                const priceText = priceContainer.textContent.trim();
                const priceMatches = priceText.match(/£\s*[\d,.]+/g);
                if (priceMatches && priceMatches.length >= 1) {
                  salePrice = priceMatches[0];
                  if (priceMatches.length >= 2) {
                    originalPrice = priceMatches[1];
                  }
                }
              }
            }

            // Only add if we have required data
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
            // Skip failed products
          }
        });

        return results;
      }, workingSelector, brand);

      console.log(`📦 Extracted ${scrapedProducts.length} ${brand} products from JD Sports UK`);

      // Process and validate
      for (const rawProduct of scrapedProducts) {
        if (products.length >= this.config.maxProducts) break;

        try {
          const salePrice = this.extractPrice(rawProduct.salePrice);
          const originalPrice = rawProduct.originalPrice ? this.extractPrice(rawProduct.originalPrice) : null;

          if (!salePrice || salePrice <= 0) {
            console.log(`⚠️  Invalid sale price for "${rawProduct.name}"`);
            continue;
          }

          // Validate discount if we have both prices
          let discount = 15; // Default for clearance items
          let validatedOriginalPrice = originalPrice;

          if (originalPrice) {
            const discountCheck = this.isRealDiscount(originalPrice, salePrice);
            if (!discountCheck.valid) {
              console.log(`⚠️  Rejected "${rawProduct.name}": ${discountCheck.reason}`);
              continue;
            }
            discount = discountCheck.discount;
          } else {
            // Estimate original price conservatively
            validatedOriginalPrice = salePrice * 1.18; // 15% discount estimate
          }

          const product = {
            id: `jdsports-uk-${Date.now()}-${products.length}`,
            name: rawProduct.name,
            brand: brand,
            category: this.categorizeProduct(rawProduct.name),
            originalPrice: validatedOriginalPrice,
            salePrice,
            discount,
            currency: this.currency,
            image: rawProduct.image,
            url: rawProduct.url,
            source: this.source,
            availableRegions: this.availableRegions, // EU, UK only
            verified: false,
            scrapedAt: new Date().toISOString()
          };

          products.push(product);
          console.log(`✅ Added: ${product.name} (${product.discount}% off, £${product.salePrice})`);

        } catch (error) {
          console.error(`❌ Error processing product:`, error.message);
        }
      }

      console.log(`\n🎉 JD Sports UK scraping complete: ${products.length} ${brand} products`);
      console.log(`🌍 Region: ${this.availableRegions.join(', ')}`);
      console.log(`💰 Currency: ${this.currency}\n`);

    } catch (error) {
      console.error(`❌ JD Sports UK error:`, error.message);
    } finally {
      await this.close();
    }

    return products;
  }

  /**
   * Categorize product based on name
   */
  categorizeProduct(name) {
    const nameLower = name.toLowerCase();

    if (nameLower.includes('shoe') || nameLower.includes('trainer') ||
        nameLower.includes('sneaker') || nameLower.includes('boot')) {
      return 'shoes';
    }
    if (nameLower.includes('hoodie') || nameLower.includes('jacket') ||
        nameLower.includes('shirt') || nameLower.includes('tee')) {
      return 'clothing';
    }
    if (nameLower.includes('bag') || nameLower.includes('backpack')) {
      return 'bags';
    }

    return 'other';
  }
}

module.exports = JDSportsUKScraper;
