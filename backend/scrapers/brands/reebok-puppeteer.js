const BaseScraper = require('./base-scraper');

/**
 * ReebokScraper - Scrapes Reebok sale page for deals
 *
 * Target: https://www.reebok.com/collections/sale
 * Extracts products with real discounts only (no price estimation)
 * Commission: 7%
 */
class ReebokScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: config.maxProducts || 60,
      scrollDelay: 3000, // Reebok loads products dynamically
      rateLimit: 5000,
      timeout: 60000,
      ...config
    });

    // Correct sale URL - the /us/outlet URL returns 404
    this.targetUrl = 'https://www.reebok.com/collections/sale';
    this.brand = 'Reebok';
    this.source = 'reebok.com';
    this.currency = 'USD';
    this.commission = 7; // 7% commission rate
    this.availableRegions = ['US'];
  }

  /**
   * Main scraping method
   */
  async scrape(browserInstance = null) {
    const products = [];

    try {
      console.log(`[${this.getName()}] Starting scrape of ${this.targetUrl}`);

      await this.initBrowser(browserInstance);

      // Navigate to Reebok outlet page
      await this.page.goto(this.targetUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      console.log(`[${this.getName()}] Page loaded, waiting for products...`);

      // Wait for product grid to load - Reebok uses Shopify-based structure
      try {
        await this.page.waitForSelector('.product-grid-item, #fs-collection-products-grid', {
          timeout: 15000
        });
      } catch (error) {
        console.error(`[${this.getName()}] Product grid not found:`, error.message);
        // Try alternative selectors
        try {
          await this.page.waitForSelector('.product__grid__price', {
            timeout: 10000
          });
          console.log(`[${this.getName()}] Found alternative product elements`);
        } catch (e) {
          console.error(`[${this.getName()}] No products found on page`);
          return products;
        }
      }

      // Handle cookie consent if present
      await this.handleCookieConsent();

      // Click "Show More" or "Load More" buttons if present
      await this.clickLoadMoreButton();

      // Scroll to load more products (Reebok uses lazy loading)
      await this.scrollToLoadProducts(8);

      // Extract products from page
      const scrapedProducts = await this.page.evaluate(() => {
        // Reebok uses Shopify-based structure with .product-grid-item containers
        const productElements = document.querySelectorAll('.product-grid-item');

        const results = [];
        const seenUrls = new Set();

        productElements.forEach((card, index) => {
          try {
            // Extract product link and info from the product info section
            const infoSection = card.querySelector('.product__grid__info');
            if (!infoSection) return;

            // Get the link with product URL
            const linkElement = infoSection.querySelector('a[href*="/products/"]');
            if (!linkElement) return;

            let url = linkElement.getAttribute('href');
            if (!url) return;

            // Make URL absolute
            if (url.startsWith('/')) {
              url = 'https://www.reebok.com' + url;
            }

            if (seenUrls.has(url)) return;
            seenUrls.add(url);

            // Extract product name from .product__grid__title
            const nameElement = card.querySelector('.product__grid__title');
            const name = nameElement ? nameElement.textContent.trim() : '';
            if (!name) return;

            // Extract prices from data attributes (most reliable)
            const titleWrapper = card.querySelector('.product__grid__title__wrapper[data-price]');
            let salePriceText = null;
            let originalPriceText = null;

            if (titleWrapper) {
              const salePrice = titleWrapper.getAttribute('data-price');
              const comparePrice = titleWrapper.getAttribute('data-compare-price');

              if (salePrice && comparePrice) {
                salePriceText = '$' + salePrice;
                originalPriceText = '$' + comparePrice;
              }
            }

            // Fallback: Extract prices from price elements
            if (!salePriceText || !originalPriceText) {
              const priceContainer = card.querySelector('.product__grid__price');
              if (priceContainer) {
                // .price.on-sale contains sale price
                const salePriceEl = priceContainer.querySelector('.price.on-sale');
                // .compare-at contains original price
                const originalPriceEl = priceContainer.querySelector('.compare-at');

                if (salePriceEl) {
                  salePriceText = salePriceEl.textContent.trim();
                }
                if (originalPriceEl) {
                  originalPriceText = originalPriceEl.textContent.trim();
                }
              }
            }

            // Skip products without sale prices
            if (!salePriceText || !originalPriceText) return;

            // Extract discount percentage from .percentage-off
            let discountText = null;
            const discountEl = card.querySelector('.percentage-off');
            if (discountEl) {
              discountText = discountEl.textContent.trim();
            }

            // Extract image from carousel or direct img
            let image = '';
            const imgElement = card.querySelector('.product-grid-item__image') ||
                              card.querySelector('img[src*="cdn.shopify.com"]') ||
                              card.querySelector('img');

            if (imgElement) {
              image = imgElement.src || imgElement.getAttribute('data-src') || '';
            }

            // Extract category from combo_category
            let category = '';
            const categoryEl = card.querySelector('.combo-category__two');
            if (categoryEl) {
              category = categoryEl.textContent.trim().toLowerCase();
            }

            results.push({
              name,
              url,
              image,
              originalPriceText,
              salePriceText,
              discountText,
              category,
              index
            });
          } catch (error) {
            console.error('Error processing product card:', error.message);
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
          // Extract prices
          const originalPrice = this.extractPrice(rawProduct.originalPriceText);
          const salePrice = this.extractPrice(rawProduct.salePriceText);

          // Validate discount
          const discountCheck = this.isRealDiscount(originalPrice, salePrice);
          if (!discountCheck.valid) {
            console.log(`[${this.getName()}] Rejected "${rawProduct.name}": ${discountCheck.reason}`);
            continue;
          }

          // Validate image URL - Reebok uses cdn.shopify.com
          let imageUrl = rawProduct.image;
          if (!imageUrl.includes('cdn.shopify.com') && !imageUrl.includes('reebok.com')) {
            console.log(`[${this.getName()}] Skipping "${rawProduct.name}": Invalid image URL`);
            continue;
          }

          // Determine category - use extracted or fallback to name-based
          let category = rawProduct.category || this.categorizeProduct(rawProduct.name);

          // Create product object
          const product = {
            name: rawProduct.name,
            brand: this.brand,
            originalPrice,
            salePrice,
            discount: discountCheck.discount,
            currency: this.currency,
            image: imageUrl,
            url: rawProduct.url,
            category: category,
            source: this.source,
            commission: this.commission,
            availableRegions: this.availableRegions,
            verified: false,
            scrapedAt: new Date().toISOString()
          };

          products.push(product);
          console.log(`[${this.getName()}] Added: ${product.name} - $${product.salePrice} (${product.discount}% off)`);

        } catch (error) {
          console.error(`[${this.getName()}] Error processing product:`, error.message);
        }
      }

      console.log(`[${this.getName()}] Scraping complete: ${products.length} valid products`);

    } catch (error) {
      console.error(`[${this.getName()}] Fatal error during scraping:`, error.message);
      throw error;
    } finally {
      // Only close browser if we created it (not provided by pool)
      await this.close(!browserInstance);
    }

    return products;
  }

  /**
   * Handle cookie consent popup
   */
  async handleCookieConsent() {
    try {
      const cookieSelectors = [
        'button[id*="accept"]',
        'button[class*="accept"]',
        '[data-auto-id="accept-cookies"]',
        'button[aria-label*="Accept"]',
        '#onetrust-accept-btn-handler'
      ];

      for (const selector of cookieSelectors) {
        const button = await this.page.$(selector);
        if (button) {
          console.log(`[${this.getName()}] Accepting cookies...`);
          await button.click();
          await this.delay(1000);
          break;
        }
      }
    } catch (error) {
      // Not critical
      console.log(`[${this.getName()}] No cookie consent found or already accepted`);
    }
  }

  /**
   * Click "Load More" button to load additional products
   */
  async clickLoadMoreButton() {
    let clickCount = 0;
    const maxClicks = 5;

    while (clickCount < maxClicks) {
      try {
        const loadMoreSelectors = [
          'button[data-auto-id="pagination-load-more"]',
          'button[data-auto-id="show-more"]',
          'button.show-more',
          'button[class*="load-more"]',
          'button[class*="LoadMore"]',
          '[data-testid="load-more-btn"]',
          'button:has-text("Load More")',
          'button:has-text("Show More")'
        ];

        let clicked = false;
        for (const selector of loadMoreSelectors) {
          const button = await this.page.$(selector);
          if (button) {
            const isVisible = await this.page.evaluate(el => {
              const rect = el.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            }, button);

            if (isVisible) {
              console.log(`[${this.getName()}] Clicking "Load More" button (attempt ${clickCount + 1})...`);
              await button.click();
              await this.delay(3000);
              clickCount++;
              clicked = true;
              break;
            }
          }
        }

        if (!clicked) break;

      } catch (error) {
        console.log(`[${this.getName()}] No more "Load More" button found`);
        break;
      }
    }
  }

  /**
   * Categorize product based on name
   */
  categorizeProduct(name) {
    const lower = name.toLowerCase();

    if (lower.match(/\b(shoe|sneaker|boot|sandal|trainer|classic|club c|nano|floatride|zig|pump|instapump|question|answer|kamikaze|shaq)\b/)) {
      return 'shoes';
    }
    if (lower.match(/\b(shirt|top|jacket|hoodie|sweater|dress|pants|jeans|shorts|tights|leggings|tracksuit|bra|tank)\b/)) {
      return 'clothing';
    }
    if (lower.match(/\b(bag|backpack|wallet|hat|cap|socks|gloves|headband|wristband)\b/)) {
      return 'accessories';
    }

    return 'shoes'; // Default for Reebok
  }
}

module.exports = ReebokScraper;

// Run if called directly
if (require.main === module) {
  const scraper = new ReebokScraper({ maxProducts: 60 });

  scraper.scrape()
    .then(products => {
      console.log(`\n=== SCRAPING RESULTS ===`);
      console.log(`Total products scraped: ${products.length}`);

      // Output formatted JSON
      console.log('\nProducts JSON:');
      console.log(JSON.stringify(products, null, 2));

      // Save to file
      const fs = require('fs');
      fs.writeFileSync('/tmp/reebok-scrape-output.txt', JSON.stringify(products, null, 2));
      console.log('\nOutput saved to /tmp/reebok-scrape-output.txt');
    })
    .catch(error => {
      console.error('Scraping failed:', error);
      process.exit(1);
    });
}
