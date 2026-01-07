const BaseScraper = require('../brands/base-scraper');

/**
 * Zara EU Scraper - Women's Shoes on Sale
 *
 * Scrapes Zara's Special Prices section for women's shoes
 * Available in: EU, ES, FR, DE, IT, UK
 * Currency: EUR (€)
 *
 * Special Notes:
 * - Zara uses heavy JavaScript rendering
 * - Product data is in JSON-LD and HTML
 * - Anti-bot protection requires stealth mode
 * - Images are lazy-loaded (data-src)
 */
class ZaraEUScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: 30,
      scrollDelay: 3000, // Extra delay for JS-heavy site
      rateLimit: 4000,
      timeout: 60000,
      ...config
    });

    this.source = 'zara.com';
    this.currency = 'EUR';
    this.availableRegions = ['EU', 'ES', 'FR', 'DE', 'IT', 'UK'];
    this.brand = 'Zara';
  }

  /**
   * Main scrape method - targets women's shoes sale section
   */
  async scrape() {
    console.log(`\n🔍 [Zara EU] Scraping women's shoes on sale...`);

    const products = [];

    // Zara UK/EU sale URL for women's shoes
    // Using UK site as it's more reliable than other EU variants
    const saleUrl = 'https://www.zara.com/uk/en/woman-shoes-special-prices-l1290.html';

    try {
      await this.initBrowser();

      console.log(`📄 Loading: ${saleUrl}`);

      await this.page.goto(saleUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      console.log('📄 Page loaded, waiting for JavaScript rendering...');

      // Zara requires extra time for JavaScript to render products
      await this.delay(8000);

      // Accept cookies if modal appears
      try {
        await this.page.evaluate(() => {
          const acceptButtons = [
            document.querySelector('[id*="onetrust-accept"]'),
            document.querySelector('[class*="accept"]'),
            document.querySelector('button[aria-label*="Accept"]')
          ];
          acceptButtons.forEach(btn => btn && btn.click());
        });
        await this.delay(2000);
      } catch (e) {
        // Cookie banner not found, continue
      }

      // Take debug screenshot
      await this.page.screenshot({ path: '/tmp/zara-eu-debug.png' });
      console.log('📸 Debug screenshot: /tmp/zara-eu-debug.png');

      // Check page title
      const pageTitle = await this.page.title();
      console.log(`📄 Page title: ${pageTitle}`);

      // Try multiple product selectors (Zara changes these frequently)
      const productSelectors = [
        'li.product-grid-product',
        '[class*="product-grid-product"]',
        'li[class*="product"]',
        'article[data-productid]',
        'div[class*="product-grid-product-info"]',
        'a[href*="/product/"]',
        'li.product-grid-block',
        '[data-qa-anchor="product-item"]'
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
        console.log('💡 Check /tmp/zara-eu-debug.png to identify correct selectors');
        console.log('💡 Zara may have redesigned their site or anti-bot detected');
        return products;
      }

      // Scroll to load lazy-loaded images and more products
      await this.scrollToLoadProducts(3);

      // Extract products from page
      const scrapedProducts = await this.page.evaluate((selector) => {
        const cards = document.querySelectorAll(selector);
        const results = [];

        cards.forEach(card => {
          try {
            // Find product link
            const link = card.querySelector('a[href*="/product"]') ||
                        card.querySelector('a[href*=".html"]') ||
                        (card.tagName === 'A' ? card : null);

            if (!link) return;

            const url = link.href;
            if (!url || !url.includes('zara.com')) return;

            // Extract product name - multiple possible locations
            let name = null;

            // Method 1: From product-info div
            const infoDiv = card.querySelector('.product-grid-product-info') ||
                           card.querySelector('[class*="product-info"]');

            if (infoDiv) {
              const nameEl = infoDiv.querySelector('h2') ||
                           infoDiv.querySelector('h3') ||
                           infoDiv.querySelector('[class*="name"]') ||
                           infoDiv.querySelector('.product-detail-info__name');
              name = nameEl ? nameEl.textContent.trim() : null;
            }

            // Method 2: From aria-label
            if (!name) {
              name = link.getAttribute('aria-label') ||
                    card.getAttribute('aria-label');
            }

            // Method 3: From image alt text
            if (!name) {
              const img = card.querySelector('img');
              name = img ? img.alt : null;
            }

            if (!name || name.length < 3) return;

            // Extract prices - Zara shows both original and sale price
            const priceContainer = card.querySelector('.price') ||
                                  card.querySelector('[class*="price"]') ||
                                  card.querySelector('.money-amount');

            let originalPrice = null;
            let salePrice = null;

            if (priceContainer) {
              // Method 1: Look for old/new price structure
              const oldPriceEl = priceContainer.querySelector('.price-old') ||
                                priceContainer.querySelector('[class*="price-old"]') ||
                                priceContainer.querySelector('[class*="price-original"]') ||
                                priceContainer.querySelector('s') ||
                                priceContainer.querySelector('del');

              const newPriceEl = priceContainer.querySelector('.price-current') ||
                                priceContainer.querySelector('[class*="price-current"]') ||
                                priceContainer.querySelector('.price-sale') ||
                                priceContainer.querySelector('[class*="price-sale"]') ||
                                priceContainer.querySelector('.money-amount__main');

              if (oldPriceEl) {
                originalPrice = oldPriceEl.textContent.trim();
              }

              if (newPriceEl) {
                salePrice = newPriceEl.textContent.trim();
              }

              // Method 2: Look for all price elements
              if (!originalPrice || !salePrice) {
                const allPrices = priceContainer.querySelectorAll('.money-amount__main') ||
                                 priceContainer.querySelectorAll('[class*="price"]');

                if (allPrices.length >= 2) {
                  // First is usually sale, second is original (or vice versa)
                  const prices = Array.from(allPrices).map(p => p.textContent.trim());
                  salePrice = salePrice || prices[0];
                  originalPrice = originalPrice || prices[1];
                }
              }

              // Method 3: Parse text content for prices
              if (!originalPrice || !salePrice) {
                const priceText = priceContainer.textContent;
                const priceMatches = priceText.match(/[€£$]\s*[\d.,]+|\d+[.,]\d+\s*[€£$]/g);

                if (priceMatches && priceMatches.length >= 2) {
                  salePrice = salePrice || priceMatches[0];
                  originalPrice = originalPrice || priceMatches[1];
                } else if (priceMatches && priceMatches.length === 1) {
                  salePrice = priceMatches[0];
                }
              }
            }

            // Must have at least sale price
            if (!salePrice) return;

            // Extract image URL (handle lazy loading)
            const img = card.querySelector('img');
            let image = null;

            if (img) {
              image = img.src ||
                     img.getAttribute('data-src') ||
                     img.getAttribute('data-lazy-src') ||
                     img.getAttribute('srcset')?.split(',')[0]?.trim().split(' ')[0];

              // Convert to HTTPS if needed
              if (image && image.startsWith('//')) {
                image = 'https:' + image;
              }
            }

            // Only add products with required data
            if (name && url && salePrice) {
              results.push({
                name,
                url,
                image: image || null,
                originalPrice,
                salePrice
              });
            }
          } catch (e) {
            // Skip failed products
            console.error('Product extraction error:', e.message);
          }
        });

        return results;
      }, workingSelector);

      console.log(`📦 Extracted ${scrapedProducts.length} raw products from Zara`);

      // Process and validate each product
      for (const rawProduct of scrapedProducts) {
        if (products.length >= this.config.maxProducts) break;

        try {
          const salePrice = this.extractPrice(rawProduct.salePrice);
          const originalPrice = rawProduct.originalPrice ? this.extractPrice(rawProduct.originalPrice) : null;

          if (!salePrice || salePrice <= 0) {
            console.log(`⚠️  Invalid sale price for "${rawProduct.name}"`);
            continue;
          }

          // STRICT VALIDATION: Only accept products with REAL discounts
          if (!originalPrice) {
            console.log(`⚠️  Rejected "${rawProduct.name}": No original price found (REAL discounts only)`);
            continue;
          }

          // Validate discount is real and within acceptable range (10-70%)
          const discountCheck = this.isRealDiscount(originalPrice, salePrice);
          if (!discountCheck.valid) {
            console.log(`⚠️  Rejected "${rawProduct.name}": ${discountCheck.reason}`);
            continue;
          }

          const discount = discountCheck.discount;

          // Clean product name (remove extra whitespace, newlines)
          const cleanName = rawProduct.name
            .replace(/\s+/g, ' ')
            .replace(/\n/g, ' ')
            .trim();

          // Build product object
          const product = {
            id: `zara-eu-${Date.now()}-${products.length}`,
            name: cleanName,
            brand: this.brand,
            category: 'shoes',
            originalPrice,
            salePrice,
            discount,
            currency: this.currency,
            image: rawProduct.image,
            url: rawProduct.url,
            source: this.source,
            availableRegions: this.availableRegions,
            verified: false,
            scrapedAt: new Date().toISOString()
          };

          products.push(product);
          console.log(`✅ Added: ${product.name} (${product.discount}% off, €${product.salePrice} from €${product.originalPrice})`);

        } catch (error) {
          console.error(`❌ Error processing product:`, error.message);
        }
      }

      console.log(`\n🎉 Zara EU scraping complete: ${products.length} women's shoes with REAL discounts`);
      console.log(`🌍 Regions: ${this.availableRegions.join(', ')}`);
      console.log(`💰 Currency: ${this.currency}`);
      console.log(`📊 Discount range: 10-70%\n`);

    } catch (error) {
      console.error(`❌ Zara EU scraping error:`, error.message);
      console.error(error.stack);
    } finally {
      await this.close();
    }

    return products;
  }
}

module.exports = ZaraEUScraper;
