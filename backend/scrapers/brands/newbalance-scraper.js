const BaseScraper = require('./base-scraper');

/**
 * NewBalanceScraper - Scrapes New Balance sale products
 *
 * NOTE: Direct scraping of newbalance.com is blocked by Akamai bot protection.
 * This scraper uses Zappos (https://www.zappos.com/new-balance-sale) as the source,
 * which carries official New Balance products and has lighter bot protection.
 *
 * Target: https://www.zappos.com/new-balance-sale
 * Extracts products with real discounts only (no price estimation)
 * Commission: 6%
 */
class NewBalanceScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: 60, // Target 50+ products
      scrollDelay: 2000,
      rateLimit: 3000,
      ...config
    });

    // Using Zappos as source since newbalance.com has strong bot protection
    this.targetUrl = 'https://www.zappos.com/new-balance-sale';
    this.brand = 'New Balance';
    this.source = 'zappos.com'; // Authorized New Balance retailer
    this.currency = 'USD';
    this.commission = 6; // 6% commission
    this.availableRegions = ['US'];
  }

  /**
   * Main scraping method
   */
  async scrape(browserInstance = null) {
    const products = [];

    try {
      console.log(`[${this.getName()}] Starting scrape of New Balance sale products`);
      console.log(`[${this.getName()}] Source: ${this.targetUrl}`);

      await this.initBrowser(browserInstance);

      // Navigate to Zappos New Balance sale page
      await this.page.goto(this.targetUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      console.log(`[${this.getName()}] Page loaded, waiting for products...`);

      // Wait for initial content
      await this.delay(5000);

      // Scroll to load more products
      console.log(`[${this.getName()}] Scrolling to load more products...`);
      for (let i = 0; i < 10; i++) {
        await this.page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await this.delay(1500);
      }

      // Scroll back to top
      await this.page.evaluate(() => window.scrollTo(0, 0));
      await this.delay(2000);

      // Extract products
      const scrapedProducts = await this.page.evaluate(() => {
        const results = [];
        const processedUrls = new Set();

        // Find all product links to New Balance products
        const productLinks = document.querySelectorAll('a[href*="/p/new-balance"]');

        productLinks.forEach((link) => {
          try {
            const url = link.href;
            if (processedUrls.has(url)) return;
            if (!url.includes('/p/new-balance')) return;

            // Find the product card container
            let card = link.closest('article') || link.closest('[data-product-id]');

            if (!card) {
              let parent = link.parentElement;
              for (let i = 0; i < 8 && parent; i++) {
                if (parent.querySelector('img') &&
                    parent.textContent.includes('$') &&
                    parent.textContent.length < 1000) {
                  card = parent;
                  break;
                }
                parent = parent.parentElement;
              }
            }

            if (!card) return;

            // Extract product name from URL (most reliable)
            const urlParts = url.split('/');
            const productSlug = urlParts.find(p => p.startsWith('new-balance-'));
            let name = '';

            if (productSlug) {
              name = productSlug
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            }

            // Try aria-label as fallback
            const ariaLabel = link.getAttribute('aria-label') || link.getAttribute('title');
            if (ariaLabel && ariaLabel.toLowerCase().includes('new balance')) {
              name = ariaLabel;
            }

            // Get image
            let image = '';
            const img = card.querySelector('img');
            if (img) {
              image = img.src || img.dataset.src || '';
              if (img.srcset) {
                const srcsets = img.srcset.split(',');
                const lastSrc = srcsets[srcsets.length - 1].trim().split(' ')[0];
                if (lastSrc) image = lastSrc;
              }
            }

            // Extract prices
            const cardText = card.textContent;
            const priceRegex = /\$\d+(?:\.\d{2})?/g;
            const priceMatches = cardText.match(priceRegex) || [];

            const discountMatch = cardText.match(/(\d+)%\s*(?:off|OFF)/i);
            const discountPercent = discountMatch ? parseInt(discountMatch[1]) : null;

            let originalPrice = null;
            let salePrice = null;

            // Try to find MSRP
            const msrpMatch = cardText.match(/MSRP[:\s]*\$(\d+(?:\.\d{2})?)/i);
            if (msrpMatch) {
              originalPrice = parseFloat(msrpMatch[1]);
            }

            // Get unique prices
            const uniquePrices = [...new Set(priceMatches)]
              .map(p => parseFloat(p.replace('$', '')))
              .filter(p => !isNaN(p) && p > 0)
              .sort((a, b) => a - b);

            if (uniquePrices.length >= 2) {
              salePrice = uniquePrices[0];
              if (!originalPrice) {
                originalPrice = uniquePrices[uniquePrices.length - 1];
              }
            } else if (uniquePrices.length === 1 && discountPercent) {
              salePrice = uniquePrices[0];
              originalPrice = Math.round(salePrice / (1 - discountPercent / 100) * 100) / 100;
            }

            if (!name || !originalPrice || !salePrice) return;
            if (originalPrice <= salePrice) return;

            processedUrls.add(url);
            results.push({
              name: name.trim(),
              url,
              image,
              originalPrice,
              salePrice,
              discountPercent
            });

          } catch (e) {
            // Skip problematic products
          }
        });

        return results;
      });

      console.log(`[${this.getName()}] Found ${scrapedProducts.length} products with price data`);

      // Process and validate products
      for (const rawProduct of scrapedProducts) {
        if (products.length >= this.config.maxProducts) {
          console.log(`[${this.getName()}] Reached max products limit (${this.config.maxProducts})`);
          break;
        }

        try {
          const originalPrice = rawProduct.originalPrice;
          const salePrice = rawProduct.salePrice;

          // Validate discount
          const discountCheck = this.isRealDiscount(originalPrice, salePrice);
          if (!discountCheck.valid) {
            continue;
          }

          // Create product object
          const product = {
            id: `newbalance-${Date.now()}-${products.length}`,
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
            commission: this.commission,
            availableRegions: this.availableRegions,
            verified: false,
            scrapedAt: new Date().toISOString()
          };

          products.push(product);
          console.log(`[${this.getName()}] Added: ${product.name} (${product.discount}% off)`);

        } catch (error) {
          console.error(`[${this.getName()}] Error processing product:`, error.message);
        }
      }

      console.log(`[${this.getName()}] Scraping complete: ${products.length} valid products`);

    } catch (error) {
      console.error(`[${this.getName()}] Fatal error during scraping:`, error.message);
      throw error;
    } finally {
      await this.close(!browserInstance);
    }

    return products;
  }

  /**
   * Categorize product based on name
   */
  categorizeProduct(name) {
    const lower = name.toLowerCase();

    if (lower.match(/\b(shoe|sneaker|boot|sandal|trainer|running|walking|990|574|550|327|530|608|2002r|9060|foam|fresh|fuelcell|minimus|arishi|dynasoft|880|860|1080|vongo|numeric)\b/)) {
      return 'shoes';
    }
    if (lower.match(/\b(shirt|top|jacket|hoodie|sweater|pants|jeans|shorts|tights|leggings|jogger|sweatshirt|tee|tank|jersey)\b/)) {
      return 'clothing';
    }
    if (lower.match(/\b(bag|backpack|wallet|hat|cap|socks|gloves|headband|belt)\b/)) {
      return 'accessories';
    }

    return 'shoes'; // Default for New Balance
  }
}

module.exports = NewBalanceScraper;
