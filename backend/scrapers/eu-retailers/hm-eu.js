const BaseScraper = require('../brands/base-scraper');

/**
 * H&M EU Scraper - Women's Shoes Sale Section
 *
 * Targets: https://www2.hm.com/en_gb/ladies/sale/shoes.html
 * Available in: EU, UK, FR, DE, IT, ES
 * Currency: EUR (€) for most EU countries, GBP for UK
 *
 * H&M has a dedicated sale section with REAL discounts
 * This scraper targets women's shoes with verified price reductions
 */
class HMEUScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: 30,
      scrollDelay: 2000,
      rateLimit: 2000,
      timeout: 60000,
      ...config
    });

    this.source = 'hm.com';
    this.currency = 'EUR';
    this.availableRegions = ['EU', 'UK', 'FR', 'DE', 'IT', 'ES'];
    this.baseUrl = 'https://www2.hm.com';
  }

  /**
   * Scrape H&M women's shoes sale section
   */
  async scrape() {
    console.log(`\n🔍 [H&M EU] Scraping women's shoes sale section...`);

    const products = [];

    // Use scrapeUrl if set, otherwise use default
    // Using en_gb locale for consistency (can be changed to other EU locales)
    const saleUrl = this.scrapeUrl || 'https://www2.hm.com/en_gb/ladies/sale/shoes.html';

    try {
      await this.initBrowser();

      console.log(`📄 Loading: ${saleUrl}`);

      await this.page.goto(saleUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      console.log('📄 Page loaded, waiting for products to render...');
      await this.delay(5000);

      // Scroll to load more products (H&M uses lazy loading)
      await this.scrollToLoadProducts(10); // Increased to 10 scrolls for more products

      // Take debug screenshot
      await this.page.screenshot({ path: '/tmp/hm-eu-debug.png' });
      console.log('📸 Debug screenshot: /tmp/hm-eu-debug.png');

      // Extract products
      const scrapedProducts = await this.page.evaluate((baseUrl) => {
        const results = [];

        // H&M product card selectors
        // H&M typically uses li.product-item or article elements
        const selectors = [
          'li.product-item',
          'article.product-item',
          '[class*="product-item"]',
          'li[data-articlecode]',
          'article[data-articlecode]',
          '.hm-product-item'
        ];

        let productCards = [];
        let workingSelector = null;

        for (const selector of selectors) {
          const cards = document.querySelectorAll(selector);
          if (cards.length > 0) {
            productCards = cards;
            workingSelector = selector;
            console.log(`Found ${cards.length} products with selector: ${selector}`);
            break;
          }
        }

        if (productCards.length === 0) {
          console.log('No product cards found, trying generic selectors...');
          // Fallback to generic article or li elements
          productCards = document.querySelectorAll('article, li');
        }

        productCards.forEach(card => {
          try {
            // Get product link
            const link = card.querySelector('a[href*="/productpage"]') ||
                        card.querySelector('a[href*="/product"]') ||
                        card.querySelector('a[href*="ladies"]');

            if (!link) return;

            let url = link.href;
            if (url && !url.startsWith('http')) {
              url = baseUrl + url;
            }
            if (!url || !url.includes('hm.com')) return;

            // Get product name
            // H&M uses different class names for product titles
            const nameSelectors = [
              '[class*="product-item-name"]',
              '[class*="product-description"]',
              '[class*="item-heading"]',
              'h3',
              'h2',
              '.item-title',
              '[data-testid="product-name"]'
            ];

            let name = null;
            for (const selector of nameSelectors) {
              const el = card.querySelector(selector);
              if (el && el.textContent.trim()) {
                name = el.textContent.trim();
                // Clean up name - remove "sale" text and extra whitespace
                name = name
                  .replace(/sale/gi, '')
                  .replace(/\s{2,}/g, ' ')
                  .trim();
                break;
              }
            }

            // If no name found, try getting from link's aria-label or title
            if (!name) {
              name = link.getAttribute('aria-label') || link.getAttribute('title');
              if (name) {
                name = name.replace(/sale/gi, '').replace(/\s{2,}/g, ' ').trim();
              }
            }

            // Get image
            const img = card.querySelector('img');
            let image = null;
            if (img) {
              image = img.src || img.dataset.src || img.getAttribute('data-src') || img.srcset?.split(' ')[0];

              // H&M uses lazy loading - check for data attributes
              if (!image || image.includes('data:image')) {
                image = img.dataset.srcset?.split(' ')[0] ||
                       img.dataset.lazySrc ||
                       img.getAttribute('data-altimage');
              }
            }

            // Get prices - H&M shows sale and original prices
            const priceContainer = card.querySelector('[class*="price"]') || card;
            const priceText = priceContainer.textContent || '';

            // H&M price patterns:
            // "€29.99 €49.99" (sale price first, then original)
            // "£24.99 £39.99"
            // Sometimes wrapped in spans with classes like "sale-price" and "regular-price"

            let salePrice = null;
            let originalPrice = null;

            // Try to find specific price elements first
            const salePriceEl = card.querySelector('[class*="sale"], [class*="discount"], [class*="current"]');
            const originalPriceEl = card.querySelector('[class*="regular"], [class*="original"], [class*="old"]');

            if (salePriceEl && originalPriceEl) {
              const saleMatch = salePriceEl.textContent.match(/[€£]([\d.]+)/);
              const originalMatch = originalPriceEl.textContent.match(/[€£]([\d.]+)/);

              if (saleMatch && originalMatch) {
                salePrice = parseFloat(saleMatch[1]);
                originalPrice = parseFloat(originalMatch[1]);
              }
            } else {
              // Fallback: extract all prices from text
              const priceMatches = priceText.match(/[€£]([\d.]+)/g);

              if (priceMatches && priceMatches.length >= 2) {
                // H&M typically shows sale price first, then original
                const prices = priceMatches.map(p => parseFloat(p.replace(/[€£]/, '').trim()));
                salePrice = prices[0];
                originalPrice = prices[1];

                // Verify sale price is actually lower
                if (salePrice > originalPrice) {
                  // Swap if order is reversed
                  [salePrice, originalPrice] = [originalPrice, salePrice];
                }
              } else if (priceMatches && priceMatches.length === 1) {
                // Single price only - not on sale, skip
                return;
              }
            }

            // Look for discount percentage badge
            let badgeDiscount = null;
            const discountBadge = card.querySelector('[class*="discount"], [class*="percentage"], [class*="badge"]');
            if (discountBadge) {
              const badgeMatch = discountBadge.textContent.match(/(\d+)%/);
              if (badgeMatch) {
                badgeDiscount = parseInt(badgeMatch[1]);
              }
            }

            // STRICT VALIDATION: Must have BOTH prices, original must be higher, AND real image URL
            if (name && url && salePrice && originalPrice && originalPrice > salePrice && image && image.startsWith('http')) {
              const calculatedDiscount = Math.round(((originalPrice - salePrice) / originalPrice) * 100);

              // Validate discount is realistic (10-70%)
              if (calculatedDiscount >= 10 && calculatedDiscount <= 70) {
                results.push({
                  name,
                  url,
                  image: image, // MUST have real image, no fallback
                  originalPrice,
                  salePrice,
                  discount: badgeDiscount || calculatedDiscount
                });
              }
            }
          } catch (e) {
            console.error('Error parsing H&M product:', e.message);
          }
        });

        return results;
      }, this.baseUrl);

      console.log(`📦 Extracted ${scrapedProducts.length} products from H&M`);

      // Process and validate each product
      for (const product of scrapedProducts) {
        if (products.length >= this.config.maxProducts) break;

        try {
          // Additional validation using BaseScraper's isRealDiscount method
          const discountCheck = this.isRealDiscount(product.originalPrice, product.salePrice);

          if (!discountCheck.valid) {
            console.log(`⚠️  Rejected "${product.name}": ${discountCheck.reason}`);
            continue;
          }

          const processedProduct = {
            id: `hm-eu-${Date.now()}-${products.length}`,
            name: product.name,
            brand: this.extractBrand(product.name),
            category: 'shoes',
            source: this.source,

            originalPrice: product.originalPrice,
            salePrice: product.salePrice,
            discount: discountCheck.discount || product.discount,
            currency: this.currency,

            availableRegions: this.availableRegions,

            url: product.url,
            image: product.image,

            verified: true, // Verified as real discount by validation
            scrapedAt: new Date().toISOString()
          };

          products.push(processedProduct);
          console.log(`✅ Added: ${product.name} (${processedProduct.discount}% off, ${this.currency}${product.salePrice})`);

        } catch (error) {
          console.error(`❌ Error processing product "${product.name}":`, error.message);
        }
      }

      console.log(`\n🎉 H&M EU scraping complete: ${products.length} valid products`);
      console.log(`🌍 Regions: ${this.availableRegions.join(', ')}`);
      console.log(`💰 Currency: ${this.currency}\n`);

    } catch (error) {
      console.error(`❌ H&M EU scraping failed: ${error.message}`);
      console.error(error.stack);
    } finally {
      await this.close();
    }

    return products;
  }

  /**
   * Extract brand from product name
   * H&M sells multiple brands including their own
   */
  extractBrand(name) {
    const brands = [
      'H&M',
      'Nike',
      'Adidas',
      'Puma',
      'New Balance',
      'Converse',
      'Vans',
      'Reebok',
      'Dr Martens',
      'UGG',
      'Birkenstock',
      'Timberland',
      'Crocs',
      'Steve Madden',
      'Tommy Hilfiger',
      'Calvin Klein',
      'Vagabond',
      'Monki',
      'Weekday',
      'COS',
      'Arket',
      '& Other Stories'
    ];

    const nameLower = name.toLowerCase();

    for (const brand of brands) {
      if (nameLower.includes(brand.toLowerCase())) {
        return brand;
      }
    }

    // Default to H&M if no brand detected
    return 'H&M';
  }

  /**
   * Get scraper information
   */
  getInfo() {
    return {
      name: 'H&M EU Scraper',
      source: this.source,
      currency: this.currency,
      regions: this.availableRegions,
      maxProducts: this.config.maxProducts,
      category: 'Women\'s Shoes',
      url: 'https://www2.hm.com/en_gb/ladies/sale/shoes.html'
    };
  }
}

module.exports = HMEUScraper;
