const BaseScraper = require('./base-scraper');

/**
 * ASOSScraper - Scrapes ASOS sale pages for deals
 *
 * Target URLs:
 * - Men's Sale: https://www.asos.com/us/men/sale/cat/?cid=8410
 * - Women's Sale: https://www.asos.com/us/women/sale/cat/?cid=7046
 *
 * Commission: 8%
 * Extracts products with real discounts only (no price estimation)
 */
class ASOSScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: config.maxProducts || 120,
      scrollDelay: 2500,
      rateLimit: 3000,
      timeout: 60000,
      ...config
    });

    // Multiple sale URLs to ensure we get 100+ products
    this.targetUrls = [
      'https://www.asos.com/us/women/sale/cat/?cid=7046',
      'https://www.asos.com/us/men/sale/cat/?cid=8409', // Correct men's sale cid
      'https://www.asos.com/us/men/ctas/core-promos/us-only-core-promo-1/pill-10/cat/?cid=51566' // Men's promo page
    ];
    this.brand = 'ASOS';
    this.source = 'asos.com';
    this.currency = 'USD';
    this.commission = 0.08; // 8% commission
    this.availableRegions = ['US', 'EU', 'UK', 'GLOBAL'];
  }

  /**
   * Handle cookie consent modal - ASOS uses "THAT'S OK" button
   */
  async handleCookieConsent() {
    try {
      console.log(`[${this.getName()}] Checking for cookie consent modal...`);

      // Wait a moment for modal to appear
      await this.delay(1000);

      // Try using page.evaluate for text-based button detection (most reliable for ASOS)
      const dismissed = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        for (const btn of buttons) {
          const text = btn.textContent.trim().toUpperCase();
          // ASOS uses "THAT'S OK" button
          if (text === "THAT'S OK" || text === 'ACCEPT' || text === 'ACCEPT ALL' || text === 'OK' || text === 'GOT IT') {
            btn.click();
            return true;
          }
        }
        return false;
      });

      if (dismissed) {
        console.log(`[${this.getName()}] Dismissed cookie modal`);
        await this.delay(1000);
        return true;
      }

      // Fallback: try specific selectors
      const consentSelectors = [
        '#onetrust-accept-btn-handler',
        'button[id*="accept"]',
        '[data-testid="accept-cookies"]'
      ];

      for (const selector of consentSelectors) {
        try {
          const button = await this.page.$(selector);
          if (button) {
            await button.click();
            console.log(`[${this.getName()}] Clicked cookie consent button: ${selector}`);
            await this.delay(1000);
            return true;
          }
        } catch (e) {
          // Selector not found, try next
        }
      }

      console.log(`[${this.getName()}] No cookie consent modal found`);
      return false;
    } catch (error) {
      console.log(`[${this.getName()}] Error handling cookie consent: ${error.message}`);
      return false;
    }
  }

  /**
   * Scroll specifically for ASOS infinite scroll
   */
  async scrollForASOSProducts(maxScrolls = 8) {
    console.log(`[${this.getName()}] Scrolling to load products (max ${maxScrolls} scrolls)...`);

    let previousHeight = 0;
    let scrollCount = 0;
    let noChangeCount = 0;

    while (scrollCount < maxScrolls && noChangeCount < 3) {
      // Get current scroll height
      const currentHeight = await this.page.evaluate(() => document.body.scrollHeight);

      // Scroll to bottom smoothly
      await this.page.evaluate(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth'
        });
      });

      // Wait for new content to load
      await this.delay(this.config.scrollDelay);

      // Check if height changed
      if (currentHeight === previousHeight) {
        noChangeCount++;
        console.log(`[${this.getName()}] No new content loaded (attempt ${noChangeCount}/3)`);
      } else {
        noChangeCount = 0;
      }

      previousHeight = currentHeight;
      scrollCount++;

      // Count products loaded so far - use the correct ASOS selectors
      const productCount = await this.page.evaluate(() => {
        return document.querySelectorAll('li[id^="product-"], li[class*="productTile"]').length;
      });
      console.log(`[${this.getName()}] Scroll ${scrollCount}: ${productCount} products loaded`);

      // Stop if we have enough products
      if (productCount >= this.config.maxProducts) {
        console.log(`[${this.getName()}] Sufficient products loaded`);
        break;
      }
    }

    console.log(`[${this.getName()}] Finished scrolling after ${scrollCount} scrolls`);
  }

  /**
   * Extract products from current page using ASOS-specific selectors
   */
  async extractProductsFromPage() {
    return await this.page.evaluate(() => {
      const products = [];

      // ASOS product tiles use li[id^="product-"] or li[class*="productTile"]
      const productCards = document.querySelectorAll('li[id^="product-"], li[class*="productTile"]');

      productCards.forEach((card, index) => {
        try {
          // Extract link - ASOS uses a[class*="productLink"]
          const linkElement = card.querySelector('a[class*="productLink"], a[href*="/prd/"]');
          if (!linkElement) return;

          let url = linkElement.href;
          if (!url || !url.includes('asos.com')) return;

          // Extract product name from p[class*="productDescription"]
          const nameElement = card.querySelector('p[class*="productDescription"]');
          let name = nameElement ? nameElement.textContent.trim() : '';

          // Fallback: get from aria-label on the link
          if (!name && linkElement.getAttribute('aria-label')) {
            const ariaLabel = linkElement.getAttribute('aria-label');
            // Extract just the product name part before the price info
            const namePart = ariaLabel.split(',')[0];
            name = namePart ? namePart.trim() : '';
          }

          // Fallback: get alt text from image
          if (!name) {
            const img = card.querySelector('img');
            if (img && img.alt) {
              // Clean up alt text (remove " - view 1" etc.)
              name = img.alt.replace(/ - view \d+$/, '').trim();
            }
          }

          if (!name || name.length < 3) return;

          // Extract image from ASOS CDN
          const imgElement = card.querySelector('img[src*="images.asos-media.com"]');
          let image = '';
          if (imgElement) {
            image = imgElement.src || '';
            // Clean up the image URL - get the base URL without query params and add a standard size
            if (image.startsWith('//')) {
              image = 'https:' + image;
            }
          }

          if (!image) return;

          // Extract prices using ASOS-specific selectors
          // Original price: span[class*="originalPrice"] > span[class*="price"]
          // Sale price: span[class*="reducedPrice"] > span[class*="saleAmount"]
          let originalPriceText = null;
          let salePriceText = null;

          const originalPriceEl = card.querySelector('span[class*="originalPrice"] span[class*="price"]');
          const salePriceEl = card.querySelector('span[class*="reducedPrice"] span[class*="saleAmount"]');

          if (originalPriceEl) {
            originalPriceText = originalPriceEl.textContent.trim();
          }
          if (salePriceEl) {
            salePriceText = salePriceEl.textContent.trim();
          }

          // Fallback: try to extract from aria-label
          if ((!originalPriceText || !salePriceText) && linkElement.getAttribute('aria-label')) {
            const ariaLabel = linkElement.getAttribute('aria-label');
            // Format: "Product name, Original price $XX.XX current price $YY.YY, Discount: -ZZ%"
            const originalMatch = ariaLabel.match(/Original price \$?([\d,.]+)/);
            const currentMatch = ariaLabel.match(/current price\s+\$?([\d,.]+)/);

            if (originalMatch) {
              originalPriceText = '$' + originalMatch[1];
            }
            if (currentMatch) {
              salePriceText = '$' + currentMatch[1];
            }
          }

          // Only add products with both prices
          if (originalPriceText && salePriceText && originalPriceText !== salePriceText) {
            products.push({
              name,
              url,
              image,
              originalPriceText,
              salePriceText,
              index
            });
          }
        } catch (error) {
          // Silent fail for individual products
        }
      });

      return products;
    });
  }

  /**
   * Main scraping method
   */
  async scrape(browserInstance = null) {
    const allProducts = [];

    try {
      console.log(`[${this.getName()}] Starting ASOS scrape...`);
      console.log(`[${this.getName()}] Target URLs: ${this.targetUrls.join(', ')}`);

      await this.initBrowser(browserInstance);

      for (const targetUrl of this.targetUrls) {
        // Check if we have enough products already
        if (allProducts.length >= this.config.maxProducts) {
          console.log(`[${this.getName()}] Already have ${allProducts.length} products, skipping remaining URLs`);
          break;
        }

        console.log(`\n[${this.getName()}] Scraping: ${targetUrl}`);

        try {
          // Navigate to ASOS sale page
          await this.page.goto(targetUrl, {
            waitUntil: 'networkidle2',
            timeout: this.config.timeout
          });

          // Check if we got a valid page (not 404)
          const pageTitle = await this.page.title();
          if (pageTitle.includes('No results') || pageTitle.includes('404')) {
            console.log(`[${this.getName()}] Page returned 404 or no results, skipping: ${targetUrl}`);
            continue;
          }

          console.log(`[${this.getName()}] Page loaded: ${pageTitle}`);

          // Handle cookie consent
          await this.handleCookieConsent();

          // Wait for products to load
          try {
            await this.page.waitForSelector(
              'li[id^="product-"], li[class*="productTile"]',
              { timeout: 15000 }
            );
          } catch (error) {
            console.error(`[${this.getName()}] Product grid not found on ${targetUrl}:`, error.message);
            continue;
          }

          // Scroll to load more products
          await this.scrollForASOSProducts(8);

          // Extract products from this page
          const pageProducts = await this.extractProductsFromPage();
          console.log(`[${this.getName()}] Found ${pageProducts.length} products on ${targetUrl}`);

          // Process and validate products
          for (const rawProduct of pageProducts) {
            if (allProducts.length >= this.config.maxProducts) {
              console.log(`[${this.getName()}] Reached max products limit (${this.config.maxProducts})`);
              break;
            }

            try {
              // Extract prices
              const originalPrice = this.extractPrice(rawProduct.originalPriceText);
              const salePrice = this.extractPrice(rawProduct.salePriceText);

              // Skip if prices are invalid
              if (!originalPrice || !salePrice) {
                continue;
              }

              // Validate discount
              const discountCheck = this.isRealDiscount(originalPrice, salePrice);
              if (!discountCheck.valid) {
                // Only log rejections for significant items
                if (rawProduct.name.length > 10) {
                  console.log(`[${this.getName()}] Rejected "${rawProduct.name.substring(0, 40)}...": ${discountCheck.reason}`);
                }
                continue;
              }

              // Check for duplicate
              const isDuplicate = allProducts.some(p => p.url === rawProduct.url || p.name === rawProduct.name);
              if (isDuplicate) {
                continue;
              }

              // Create product object in requested format
              const product = {
                name: rawProduct.name,
                brand: this.brand,
                originalPrice,
                salePrice,
                discount: discountCheck.discount,
                currency: this.currency,
                image: rawProduct.image,
                url: rawProduct.url,
                category: this.categorizeProduct(rawProduct.name)
              };

              allProducts.push(product);
              console.log(`[${this.getName()}] Added: ${product.name.substring(0, 50)}... (${product.discount}% off)`);

            } catch (error) {
              console.error(`[${this.getName()}] Error processing product:`, error.message);
            }
          }

        } catch (error) {
          console.error(`[${this.getName()}] Error scraping ${targetUrl}:`, error.message);
          // Continue to next URL instead of failing completely
          continue;
        }

        // Rate limit between pages
        if (this.targetUrls.indexOf(targetUrl) < this.targetUrls.length - 1) {
          console.log(`[${this.getName()}] Rate limiting before next page...`);
          await this.rateLimit();
        }
      }

      console.log(`\n[${this.getName()}] Scraping complete: ${allProducts.length} valid products`);

    } catch (error) {
      console.error(`[${this.getName()}] Fatal error during scraping:`, error.message);
      throw error;
    } finally {
      await this.close(!browserInstance);
    }

    return allProducts;
  }

  /**
   * Categorize product based on name
   */
  categorizeProduct(name) {
    const lower = name.toLowerCase();

    if (lower.match(/\b(shoe|sneaker|boot|sandal|trainer|heel|loafer|slipper|pump|flat|wedge)\b/)) {
      return 'shoes';
    }
    if (lower.match(/\b(dress|skirt|blouse|shirt|top|jacket|coat|hoodie|sweater|cardigan|pants|jeans|shorts|leggings|jumpsuit|romper|blazer|suit)\b/)) {
      return 'clothing';
    }
    if (lower.match(/\b(bag|backpack|wallet|hat|cap|scarf|gloves|belt|sunglasses|watch|jewelry|necklace|earring|bracelet)\b/)) {
      return 'accessories';
    }
    if (lower.match(/\b(bikini|swimsuit|swim|beachwear)\b/)) {
      return 'swimwear';
    }

    return 'clothing'; // Default for ASOS
  }
}

module.exports = ASOSScraper;
