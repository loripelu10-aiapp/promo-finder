const BaseScraper = require('./base-scraper');

/**
 * AdidasHybridScraper - Multi-strategy approach to bypass Adidas protection
 *
 * Strategies:
 * 1. Try category pages instead of main outlet
 * 2. Try regional sites (UK, CA, etc.)
 * 3. Fallback to retail partners (Foot Locker, Finish Line)
 */
class AdidasHybridScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: 50,
      scrollDelay: 3000,
      rateLimit: 5000,
      ...config
    });

    this.brand = 'Adidas';
    this.source = 'adidas.com';

    // Multiple target URLs to try
    this.targetUrls = [
      // US category pages (less protected than main outlet)
      'https://www.adidas.com/us/men-shoes-sale',
      'https://www.adidas.com/us/women-shoes-sale',
      // UK site (sometimes less protected)
      'https://www.adidas.co.uk/outlet-shoes',
      // Canada
      'https://www.adidas.ca/en/outlet-shoes'
    ];
  }

  /**
   * Main scraping method - tries multiple strategies
   */
  async scrape(browserInstance = null) {
    let products = [];

    // Try each URL until we get products
    for (const url of this.targetUrls) {
      console.log(`🔍 [${this.getName()}] Trying: ${url}`);

      try {
        const result = await this.scrapeUrl(url, browserInstance);

        if (result.length > 0) {
          console.log(`✅ [${this.getName()}] Success with ${url} - found ${result.length} products`);
          products = result;
          break; // Got products, stop trying
        } else {
          console.log(`⚠️  [${this.getName()}] No products from ${url}, trying next...`);
        }
      } catch (error) {
        console.error(`❌ [${this.getName()}] Error with ${url}: ${error.message}`);
        // Continue to next URL
      }

      // Rate limit between attempts
      await this.delay(3000);
    }

    if (products.length === 0) {
      console.log(`⚠️  [${this.getName()}] All URLs failed, returning empty array`);
    }

    return products;
  }

  /**
   * Scrape a specific URL
   */
  async scrapeUrl(targetUrl, browserInstance = null) {
    const products = [];

    try {
      await this.initBrowser(browserInstance);

      // Navigate with longer timeout
      await this.page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout
      });

      console.log(`📄 [${this.getName()}] Page loaded`);

      // Wait for content to load
      await this.delay(5000);

      // Check if we got blocked
      const isBlocked = await this.page.evaluate(() => {
        const text = document.body.textContent || '';
        return text.includes('unable to give you access') ||
               text.includes('security issue') ||
               text.includes('Reference Error');
      });

      if (isBlocked) {
        console.log(`🚫 [${this.getName()}] Detected security block page`);
        return products;
      }

      // Try to find product cards with multiple selectors
      const productSelectors = [
        '[data-auto-id="plp-product"]',
        '[data-auto-id="glass-product-card"]',
        '.glass-product-card',
        '.plp-product-card',
        '.product-card',
        '[class*="product-card"]'
      ];

      let productElements = null;
      let workingSelector = null;

      for (const selector of productSelectors) {
        const found = await this.page.$(selector);
        if (found) {
          workingSelector = selector;
          productElements = await this.page.$$(selector);
          console.log(`📦 [${this.getName()}] Found ${productElements.length} products with selector: ${selector}`);
          break;
        }
      }

      if (!productElements || productElements.length === 0) {
        console.log(`❌ [${this.getName()}] No product elements found`);
        return products;
      }

      // Extract products (simplified - just get what we can)
      const scrapedProducts = await this.page.evaluate((selector) => {
        const cards = document.querySelectorAll(selector);
        const results = [];

        cards.forEach(card => {
          try {
            // Get link
            const link = card.querySelector('a[href]');
            const url = link ? link.href : null;

            // Get name
            const nameEl = card.querySelector('[class*="name"], [class*="title"], h3, h4');
            const name = nameEl ? nameEl.textContent.trim() : null;

            // Get image
            const img = card.querySelector('img');
            const image = img ? (img.src || img.dataset.src) : null;

            // Get prices (try multiple patterns)
            const priceElements = card.querySelectorAll('[class*="price"]');
            const prices = Array.from(priceElements).map(el => el.textContent.trim());

            if (name && url && image && prices.length >= 2) {
              results.push({
                name,
                url,
                image,
                prices
              });
            }
          } catch (e) {
            // Skip invalid products
          }
        });

        return results;
      }, workingSelector);

      console.log(`📦 [${this.getName()}] Extracted ${scrapedProducts.length} products with price data`);

      // Process products
      for (const rawProduct of scrapedProducts) {
        if (products.length >= this.config.maxProducts) break;

        try {
          // Try to extract prices
          const prices = rawProduct.prices.map(p => this.extractPrice(p)).filter(p => p);

          if (prices.length >= 2) {
            // Assume higher price is original, lower is sale
            prices.sort((a, b) => b - a);
            const originalPrice = prices[0];
            const salePrice = prices[prices.length - 1];

            // Validate
            const discountCheck = this.isRealDiscount(originalPrice, salePrice);
            if (!discountCheck.valid) {
              console.log(`⚠️  [${this.getName()}] Rejected "${rawProduct.name}": ${discountCheck.reason}`);
              continue;
            }

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
              source: new URL(targetUrl).hostname.replace('www.', ''),
              verified: false,
              scrapedAt: new Date().toISOString()
            };

            products.push(product);
            console.log(`✅ [${this.getName()}] Added: ${product.name} (${product.discount}% off)`);
          }
        } catch (error) {
          console.error(`❌ [${this.getName()}] Error processing product:`, error.message);
        }
      }

    } catch (error) {
      console.error(`❌ [${this.getName()}] Fatal error during scraping:`, error.message);
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

    if (lower.match(/\b(shoe|sneaker|boot|sandal|trainer)\b/)) {
      return 'shoes';
    }
    if (lower.match(/\b(shirt|top|jacket|hoodie|pants|shorts)\b/)) {
      return 'clothing';
    }
    if (lower.match(/\b(bag|backpack|hat|socks)\b/)) {
      return 'accessories';
    }

    return 'shoes'; // Default
  }
}

module.exports = AdidasHybridScraper;
