const BaseScraper = require('./base-scraper');
const fs = require('fs');

/**
 * AdidasOutletFocused - Laser-focused scraper for Adidas outlet page
 *
 * Strategies:
 * 1. Maximum stealth mode with delays
 * 2. Mobile user agent (often less protected)
 * 3. Multiple retry attempts
 * 4. Screenshot + HTML extraction
 * 5. Wait for dynamic content loading
 */
class AdidasOutletFocused extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: 50,
      scrollDelay: 5000, // Longer delays
      rateLimit: 10000,
      timeout: 90000, // 90 second timeout
      ...config
    });

    this.targetUrl = 'https://www.adidas.com/us/outlet';
    this.brand = 'Adidas';
    this.source = 'adidas.com';
  }

  /**
   * Main scraping method with multiple retry strategies
   */
  async scrape(browserInstance = null) {
    console.log(`🔍 [${this.getName()}] Attempting to scrape Adidas outlet page...`);
    console.log(`🎯 Target: ${this.targetUrl}`);

    // Try multiple strategies
    const strategies = [
      { name: 'Desktop with delays', userAgent: 'desktop', delay: 10000 },
      { name: 'Mobile mode', userAgent: 'mobile', delay: 8000 },
      { name: 'Slow load with scroll', userAgent: 'desktop', delay: 15000, scroll: true }
    ];

    for (const strategy of strategies) {
      console.log(`\n📋 Trying strategy: ${strategy.name}`);

      const result = await this.tryStrategy(strategy, browserInstance);

      if (result.length > 0) {
        console.log(`✅ SUCCESS with ${strategy.name}! Found ${result.length} products`);
        return result;
      }

      console.log(`⚠️  ${strategy.name} didn't work, trying next...`);
      await this.delay(5000); // Wait between strategies
    }

    console.log(`\n❌ All strategies failed for Adidas`);
    return [];
  }

  /**
   * Try a specific strategy
   */
  async tryStrategy(strategy, browserInstance) {
    const products = [];

    try {
      await this.initBrowser(browserInstance);

      // Set user agent based on strategy
      if (strategy.userAgent === 'mobile') {
        await this.page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
        await this.page.setViewport({ width: 390, height: 844, isMobile: true });
        console.log('   📱 Using mobile mode');
      }

      console.log('   📄 Loading page...');

      // Try to load page
      const response = await this.page.goto(this.targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout
      });

      console.log(`   ✅ Status: ${response.status()}`);

      // Wait for content - use the strategy's delay
      console.log(`   ⏱️  Waiting ${strategy.delay / 1000}s for content...`);
      await this.delay(strategy.delay);

      // Scroll if requested
      if (strategy.scroll) {
        console.log('   📜 Scrolling page...');
        await this.page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight / 2);
        });
        await this.delay(3000);
      }

      // Take screenshot for debugging
      const screenshotPath = `/tmp/adidas-attempt-${Date.now()}.png`;
      await this.page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`   📸 Screenshot: ${screenshotPath}`);

      // Check if blocked
      const pageText = await this.page.evaluate(() => document.body.textContent);

      if (pageText.includes('unable to give you access') ||
          pageText.includes('security issue') ||
          pageText.includes('Reference Error')) {
        console.log('   🚫 Detected blocking page');
        return products;
      }

      // Save HTML
      const html = await this.page.content();
      const htmlPath = `/tmp/adidas-attempt-${Date.now()}.html`;
      fs.writeFileSync(htmlPath, html);
      console.log(`   💾 HTML saved: ${htmlPath}`);

      // Try to find products with comprehensive selector list
      const productSelectors = [
        // Adidas specific
        '[data-auto-id="plp-product"]',
        '[data-auto-id="glass-product-card"]',
        '.glass-product-card',
        '.plp-product-card',
        // Generic
        'div[class*="product-card"]',
        'div[class*="ProductCard"]',
        'article[data-product]',
        'div[data-testid*="product"]',
        '[class*="plp-"] div[class*="card"]'
      ];

      let foundProducts = null;
      let workingSelector = null;

      for (const selector of productSelectors) {
        const count = await this.page.$$eval(selector, els => els.length);
        if (count > 0) {
          foundProducts = count;
          workingSelector = selector;
          console.log(`   ✅ Found ${count} products with: ${selector}`);
          break;
        }
      }

      if (!foundProducts || foundProducts === 0) {
        console.log('   ❌ No product elements found');

        // Log what we DID find
        const elementCounts = await this.page.evaluate(() => {
          return {
            divs: document.querySelectorAll('div').length,
            links: document.querySelectorAll('a').length,
            images: document.querySelectorAll('img').length,
            articles: document.querySelectorAll('article').length
          };
        });
        console.log(`   ℹ️  Page has: ${elementCounts.divs} divs, ${elementCounts.links} links, ${elementCounts.images} images`);

        return products;
      }

      // Extract product data
      const scrapedProducts = await this.extractProducts(workingSelector);

      // Validate and process
      for (const rawProduct of scrapedProducts) {
        if (products.length >= this.config.maxProducts) break;

        try {
          const originalPrice = this.extractPrice(rawProduct.originalPrice);
          const salePrice = this.extractPrice(rawProduct.salePrice);

          if (!originalPrice || !salePrice) continue;

          const discountCheck = this.isRealDiscount(originalPrice, salePrice);
          if (!discountCheck.valid) {
            console.log(`   ⚠️  Rejected "${rawProduct.name}": ${discountCheck.reason}`);
            continue;
          }

          const product = {
            id: `adidas-outlet-${Date.now()}-${products.length}`,
            name: rawProduct.name,
            brand: this.brand,
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
          console.log(`   ✅ Added: ${product.name} (${product.discount}% off)`);
        } catch (error) {
          console.error(`   ❌ Error processing product:`, error.message);
        }
      }

    } catch (error) {
      console.error(`   ❌ Strategy error:`, error.message);
    } finally {
      await this.close(!browserInstance);
    }

    return products;
  }

  /**
   * Extract products using working selector
   */
  async extractProducts(selector) {
    return await this.page.evaluate((sel) => {
      const cards = document.querySelectorAll(sel);
      const results = [];

      cards.forEach(card => {
        try {
          // Get link
          const link = card.querySelector('a[href]');
          const url = link ? link.href : null;

          // Get name
          const nameSelectors = [
            '[data-auto-id="product-name"]',
            '.glass-product-card__title',
            '[class*="name"]',
            'h2', 'h3', 'h4'
          ];

          let name = null;
          for (const ns of nameSelectors) {
            const el = card.querySelector(ns);
            if (el && el.textContent.trim()) {
              name = el.textContent.trim();
              break;
            }
          }

          // Get image
          const img = card.querySelector('img');
          const image = img ? (img.src || img.dataset.src || img.getAttribute('data-src')) : null;

          // Get prices - look for multiple patterns
          let originalPrice = null;
          let salePrice = null;

          // Method 1: Specific Adidas classes
          const saleEl = card.querySelector('.gl-price-item--sale, [class*="sale-price"]');
          const origEl = card.querySelector('.gl-price-item--crossed, [class*="original-price"]');

          if (saleEl) salePrice = saleEl.textContent.trim();
          if (origEl) originalPrice = origEl.textContent.trim();

          // Method 2: Generic price elements
          if (!originalPrice || !salePrice) {
            const priceEls = card.querySelectorAll('[class*="price"]');
            const prices = Array.from(priceEls)
              .map(el => el.textContent.trim())
              .filter(t => t.match(/\$?\d+/));

            if (prices.length >= 2) {
              salePrice = prices[0];
              originalPrice = prices[1];
            }
          }

          if (name && url && image && originalPrice && salePrice) {
            results.push({ name, url, image, originalPrice, salePrice });
          }
        } catch (e) {
          // Skip
        }
      });

      return results;
    }, selector);
  }

  /**
   * Categorize product
   */
  categorizeProduct(name) {
    const lower = name.toLowerCase();
    if (lower.match(/\b(shoe|sneaker|boot|sandal|trainer)\b/)) return 'shoes';
    if (lower.match(/\b(shirt|top|jacket|hoodie|pants)\b/)) return 'clothing';
    if (lower.match(/\b(bag|backpack|hat)\b/)) return 'accessories';
    return 'shoes';
  }
}

module.exports = AdidasOutletFocused;
