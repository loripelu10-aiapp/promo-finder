const BaseScraper = require('./base-scraper');

/**
 * ZapposScraper - Scrapes Zappos sale pages for deals
 *
 * Target URLs: Zappos sale/clearance sorted by discount
 *
 * Extracts products with real discounts only (verified both prices present)
 * Images are from Zappos CDN (m.media-amazon.com)
 *
 * Product card structure:
 * - Container: article.qY-z
 * - Link: a[href*="/p/"]
 * - Sale price: span.PY-z
 * - MSRP price: span.SY-z or span.RY-z
 * - Aria-label contains: "On sale for $XX.XX. MSRP $YY.YY. ZZ% off"
 */
class ZapposScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: config.maxProducts || 150,
      scrollDelay: 2500,
      rateLimit: 3000,
      timeout: 90000,
      ...config
    });

    // Multiple sale/clearance URLs sorted by discount percentage
    this.targetUrls = [
      // Women's sale sorted by % off (high to low)
      'https://www.zappos.com/women~/CKvXARCz1wHiAgMBAhg.zso?s=percentOff/desc/',
      // Men's sale sorted by % off
      'https://www.zappos.com/men~/CKzXARCz1wHiAgMYAQI.zso?s=percentOff/desc/',
      // All shoes on sale sorted by % off
      'https://www.zappos.com/shoes~/CK_XARCz1wHiAgIBAg.zso?s=percentOff/desc/',
      // Clothing on sale
      'https://www.zappos.com/clothing~/CK_XARC11QHiAgMYAQI.zso?s=percentOff/desc/',
      // Accessories on sale
      'https://www.zappos.com/accessories~/CK_XARCx1gHiAgMYAQI.zso?s=percentOff/desc/'
    ];
    this.brand = 'Zappos';
    this.source = 'zappos.com';
    this.currency = 'USD';
  }

  /**
   * Handle cookie consent / promo modals
   */
  async handleModals() {
    try {
      console.log(`[${this.getName()}] Checking for modals...`);
      await this.delay(1500);

      // Try to close any popup/modal
      const dismissed = await this.page.evaluate(() => {
        // Close button patterns
        const closeSelectors = [
          'button[aria-label="Close"]',
          'button[aria-label="close"]',
          '[data-testid="dialog-close-button"]',
          '.close-button'
        ];

        for (const selector of closeSelectors) {
          const closeBtn = document.querySelector(selector);
          if (closeBtn) {
            closeBtn.click();
            return true;
          }
        }

        // Try pressing escape
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

        return false;
      });

      if (dismissed) {
        console.log(`[${this.getName()}] Dismissed modal`);
        await this.delay(1000);
      }

      return dismissed;
    } catch (error) {
      console.log(`[${this.getName()}] Error handling modals: ${error.message}`);
      return false;
    }
  }

  /**
   * Scroll to load more products on Zappos
   */
  async scrollForProducts(maxScrolls = 15) {
    console.log(`[${this.getName()}] Scrolling to load products (max ${maxScrolls} scrolls)...`);

    let previousHeight = 0;
    let scrollCount = 0;
    let noChangeCount = 0;
    let lastProductCount = 0;

    while (scrollCount < maxScrolls && noChangeCount < 3) {
      const currentHeight = await this.page.evaluate(() => document.body.scrollHeight);

      // Smooth scroll down
      await this.page.evaluate(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth'
        });
      });

      await this.delay(this.config.scrollDelay);

      // Count current products using Zappos-specific selector
      const productCount = await this.page.evaluate(() => {
        return document.querySelectorAll('article').length;
      });

      console.log(`[${this.getName()}] Scroll ${scrollCount + 1}: ${productCount} products loaded`);

      if (currentHeight === previousHeight && productCount === lastProductCount) {
        noChangeCount++;
        console.log(`[${this.getName()}] No new content (attempt ${noChangeCount}/3)`);
      } else {
        noChangeCount = 0;
      }

      previousHeight = currentHeight;
      lastProductCount = productCount;
      scrollCount++;

      // Stop if we have enough products
      if (productCount >= this.config.maxProducts * 1.5) {
        console.log(`[${this.getName()}] Sufficient products loaded`);
        break;
      }
    }

    console.log(`[${this.getName()}] Finished scrolling after ${scrollCount} scrolls`);
  }

  /**
   * Extract products from current page using Zappos-specific selectors
   */
  async extractProductsFromPage() {
    return await this.page.evaluate(() => {
      const products = [];

      // Zappos uses article elements for product cards
      const productCards = document.querySelectorAll('article');

      productCards.forEach((card, index) => {
        try {
          // Get the main product link
          const linkElement = card.querySelector('a[href*="/p/"]');
          if (!linkElement) return;

          const url = linkElement.href;
          if (!url || !url.includes('zappos.com')) return;

          // Extract product name and prices from aria-label
          // Format: "Brand - Product. Color XYZ. On sale for $XX.XX. MSRP $YY.YY. ZZ% off."
          const ariaLabel = linkElement.getAttribute('aria-label') || '';

          let name = '';
          let salePriceText = null;
          let originalPriceText = null;
          let discountPercent = null;

          // Parse aria-label for prices
          const saleMatch = ariaLabel.match(/On sale for \$?([\d,.]+)/i);
          const msrpMatch = ariaLabel.match(/MSRP:?\s*\$?([\d,.]+)/i);
          const discountMatch = ariaLabel.match(/(\d+)%\s*off/i);

          if (saleMatch) {
            salePriceText = '$' + saleMatch[1];
          }
          if (msrpMatch) {
            originalPriceText = '$' + msrpMatch[1];
          }
          if (discountMatch) {
            discountPercent = parseInt(discountMatch[1]);
          }

          // Extract name from aria-label (everything before "On sale" or price info)
          const namePart = ariaLabel.split(/\.\s*(On sale|Low Stock|\$)/i)[0];
          if (namePart) {
            name = namePart.replace(/\.\s*Color\s+[\w\s-]+$/i, '').trim();
          }

          // Fallback: Get name from visible elements
          if (!name) {
            // Brand name is in dd element
            const brandEl = card.querySelector('dd');
            const productNameEl = card.querySelectorAll('dd')[1];

            if (brandEl && productNameEl) {
              name = `${brandEl.textContent.trim()} ${productNameEl.textContent.trim()}`;
            }
          }

          // Fallback: Get prices from visible DOM elements
          if (!salePriceText) {
            const salePriceEl = card.querySelector('span.PY-z');
            if (salePriceEl) {
              salePriceText = salePriceEl.textContent.trim();
            }
          }

          if (!originalPriceText) {
            const msrpEl = card.querySelector('span.SY-z');
            if (msrpEl) {
              originalPriceText = msrpEl.textContent.trim();
            }
          }

          // Additional fallback: look for any price-like text
          if (!salePriceText || !originalPriceText) {
            const priceContainer = card.querySelector('dd.QY-z');
            if (priceContainer) {
              const priceText = priceContainer.textContent;
              const prices = priceText.match(/\$[\d,.]+/g);
              if (prices && prices.length >= 2) {
                // First price is usually sale price, second is MSRP
                salePriceText = salePriceText || prices[0];
                originalPriceText = originalPriceText || prices[1];
              }
            }
          }

          if (!name || name.length < 3) return;
          if (!salePriceText || !originalPriceText) return;

          // Extract image - Zappos uses Amazon CDN
          let image = '';
          const imgElement = card.querySelector('img[src*="media-amazon.com"]');
          if (imgElement) {
            image = imgElement.src || '';
          }

          // Fallback: any img in the card
          if (!image) {
            const anyImg = card.querySelector('img');
            if (anyImg && anyImg.src) {
              image = anyImg.src;
            }
          }

          // Skip placeholder/icon images
          if (!image || image.includes('logo') || image.includes('icon')) return;

          // Make sure image is from Zappos/Amazon CDN
          if (!image.includes('media-amazon.com') && !image.includes('zappos.com')) return;

          products.push({
            name,
            url,
            image,
            originalPriceText,
            salePriceText,
            discountPercent,
            index
          });
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
    const seenUrls = new Set();

    try {
      console.log(`[${this.getName()}] Starting Zappos scrape...`);
      console.log(`[${this.getName()}] Target: ${this.config.maxProducts}+ products`);

      await this.initBrowser(browserInstance);

      for (const targetUrl of this.targetUrls) {
        // Check if we have enough products
        if (allProducts.length >= this.config.maxProducts) {
          console.log(`[${this.getName()}] Already have ${allProducts.length} products, skipping remaining URLs`);
          break;
        }

        console.log(`\n[${this.getName()}] Scraping: ${targetUrl}`);

        try {
          // Navigate to sale page
          await this.page.goto(targetUrl, {
            waitUntil: 'networkidle2',
            timeout: this.config.timeout
          });

          const pageTitle = await this.page.title();
          const currentUrl = this.page.url();
          console.log(`[${this.getName()}] Page loaded: ${pageTitle}`);
          console.log(`[${this.getName()}] Final URL: ${currentUrl}`);

          // Handle any modals
          await this.handleModals();

          // Wait for products to load
          try {
            await this.page.waitForSelector('article', { timeout: 15000 });
          } catch (error) {
            console.log(`[${this.getName()}] Products not found on ${targetUrl}, skipping`);
            continue;
          }

          // Scroll to load more products
          const remainingNeeded = this.config.maxProducts - allProducts.length;
          const scrollsNeeded = Math.min(15, Math.ceil(remainingNeeded / 30));
          await this.scrollForProducts(scrollsNeeded);

          // Extract products
          const pageProducts = await this.extractProductsFromPage();
          console.log(`[${this.getName()}] Extracted ${pageProducts.length} products from ${currentUrl}`);

          // Process and validate products
          for (const rawProduct of pageProducts) {
            if (allProducts.length >= this.config.maxProducts) {
              break;
            }

            try {
              // Skip duplicates by URL
              if (seenUrls.has(rawProduct.url)) {
                continue;
              }

              // Extract prices
              const originalPrice = this.extractPrice(rawProduct.originalPriceText);
              const salePrice = this.extractPrice(rawProduct.salePriceText);

              if (!originalPrice || !salePrice) {
                continue;
              }

              // Validate discount
              const discountCheck = this.isRealDiscount(originalPrice, salePrice);
              if (!discountCheck.valid) {
                continue;
              }

              // Validate image
              const image = rawProduct.image;
              if (!image) {
                continue;
              }

              // Check for duplicate by name
              const isDuplicate = allProducts.some(p => p.name === rawProduct.name);
              if (isDuplicate) {
                continue;
              }

              seenUrls.add(rawProduct.url);

              // Create product object
              const product = {
                name: rawProduct.name,
                originalPrice,
                salePrice,
                image,
                url: rawProduct.url,
                discount: discountCheck.discount,
                brand: this.brand,
                currency: this.currency,
                source: this.source,
                category: this.categorizeProduct(rawProduct.name)
              };

              allProducts.push(product);

              if (allProducts.length % 25 === 0) {
                console.log(`[${this.getName()}] Progress: ${allProducts.length} products collected`);
              }

            } catch (error) {
              // Silent fail for individual products
            }
          }

          console.log(`[${this.getName()}] Total products so far: ${allProducts.length}`);

        } catch (error) {
          console.error(`[${this.getName()}] Error scraping ${targetUrl}:`, error.message);
          continue;
        }

        // Rate limit between pages
        if (this.targetUrls.indexOf(targetUrl) < this.targetUrls.length - 1 && allProducts.length < this.config.maxProducts) {
          console.log(`[${this.getName()}] Rate limiting before next page...`);
          await this.rateLimit();
        }
      }

      console.log(`\n[${this.getName()}] Scraping complete: ${allProducts.length} valid products`);

    } catch (error) {
      console.error(`[${this.getName()}] Fatal error:`, error.message);
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

    if (lower.match(/\b(shoe|sneaker|boot|sandal|trainer|heel|loafer|slipper|pump|flat|wedge|oxford|mule|clog|athletic|running|walking)\b/)) {
      return 'shoes';
    }
    if (lower.match(/\b(dress|skirt|shirt|top|jacket|coat|hoodie|sweater|pants|jeans|shorts|romper|blazer|suit|blouse|cardigan|leggings|jumpsuit|polo|tee|tank)\b/)) {
      return 'clothing';
    }
    if (lower.match(/\b(bag|backpack|wallet|hat|cap|scarf|gloves|belt|sunglasses|watch|jewelry|necklace|earring|bracelet|handbag|purse|tote)\b/)) {
      return 'accessories';
    }

    // Default for Zappos (mostly shoes)
    return 'shoes';
  }
}

module.exports = ZapposScraper;
