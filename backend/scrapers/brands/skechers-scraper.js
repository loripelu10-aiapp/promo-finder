const BaseScraper = require('./base-scraper');

/**
 * SkechersScraper - Scrapes Skechers sale pages for deals
 *
 * Target: https://www.skechers.com/sale/ and subcategories
 * Extracts products with real discounts only (no price estimation)
 * Verifies images are from Skechers CDN
 */
class SkechersScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: config.maxProducts || 200,
      scrollDelay: 3000,
      rateLimit: 3000,
      ...config
    });

    // Multiple sale page URLs for maximum coverage
    this.saleUrls = [
      'https://www.skechers.com/sale/',
      'https://www.skechers.com/women/footwear/sale/',
      'https://www.skechers.com/men/footwear/sale/',
      'https://www.skechers.com/kids/footwear/sale/'
    ];

    this.brand = 'Skechers';
    this.source = 'www.skechers.com';
    this.currency = 'USD';
    this.availableRegions = ['US'];

    // Valid Skechers CDN domains for image validation
    this.validImageDomains = [
      'skechers.com',
      'skechers-img.com',
      'cdn.skechers.com',
      'images.skechers.com',
      'media.skechers.com'
    ];
  }

  /**
   * Main scraping method
   */
  async scrape(browserInstance = null) {
    const allProducts = [];
    const seenUrls = new Set();

    try {
      console.log(`[${this.getName()}] Starting multi-page scrape`);

      await this.initBrowser(browserInstance);

      // Scrape each sale URL
      for (const saleUrl of this.saleUrls) {
        if (allProducts.length >= this.config.maxProducts) {
          console.log(`[${this.getName()}] Reached max products limit (${this.config.maxProducts})`);
          break;
        }

        console.log(`\n[${this.getName()}] Scraping: ${saleUrl}`);

        const pageProducts = await this.scrapeSinglePage(saleUrl, seenUrls);
        allProducts.push(...pageProducts);

        console.log(`[${this.getName()}] Total products so far: ${allProducts.length}`);

        // Rate limit between pages
        await this.delay(2000);
      }

      console.log(`[${this.getName()}] Scraping complete: ${allProducts.length} valid products`);

    } catch (error) {
      console.error(`[${this.getName()}] Fatal error during scraping:`, error.message);
      throw error;
    } finally {
      await this.close(!browserInstance);
    }

    return allProducts.slice(0, this.config.maxProducts);
  }

  /**
   * Scrape a single sale page
   */
  async scrapeSinglePage(url, seenUrls) {
    const products = [];

    try {
      // Navigate to sale page
      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      console.log(`[${this.getName()}] Page loaded, waiting for products...`);

      // Handle cookie consent if present
      await this.handleCookieConsent();

      // Wait for product grid to load
      try {
        await this.page.waitForSelector('.product-tile.c-product-tile, .product[data-pid], .product-grid', {
          timeout: 20000
        });
        console.log(`[${this.getName()}] Product grid found`);
      } catch (error) {
        console.error(`[${this.getName()}] Product grid not found:`, error.message);
        return products;
      }

      // Wait a bit for all products to render
      await this.delay(2000);

      // Scroll to load more products
      await this.scrollToLoadProducts(10);

      // Click "Load More" buttons to get more products
      await this.loadMoreProducts(20);

      // Additional scrolling after loading more
      await this.scrollToLoadProducts(5);

      // Extract products from the page
      const scrapedProducts = await this.page.evaluate(() => {
        const results = [];
        const localSeenUrls = new Set();

        // Skechers uses .product[data-pid] containers
        const productContainers = document.querySelectorAll('.product[data-pid]');
        console.log(`Found ${productContainers.length} product containers`);

        productContainers.forEach((container, index) => {
          try {
            const pid = container.getAttribute('data-pid');
            if (!pid || pid === '') return; // Skip template elements

            // Find the product tile
            const tile = container.querySelector('.product-tile.c-product-tile');
            if (!tile) return;

            // Extract product link and name
            const titleLink = tile.querySelector('a.c-product-tile__title, .pdp-link a');
            if (!titleLink) return;

            let url = titleLink.href;
            if (!url || url === '') return;

            // Ensure full URL
            if (url.startsWith('/')) {
              url = 'https://www.skechers.com' + url;
            }

            // Skip duplicates
            if (localSeenUrls.has(url)) return;
            localSeenUrls.add(url);

            const name = titleLink.textContent.trim();
            if (!name) return;

            // Extract image
            const imageElement = tile.querySelector('.tile-image.c-product-tile__img, img.c-product-tile__img, .image-container img');
            let image = '';
            if (imageElement) {
              image = imageElement.src || imageElement.getAttribute('data-src') || '';
              if (!image && imageElement.srcset) {
                const srcsetParts = imageElement.srcset.split(',');
                if (srcsetParts.length > 0) {
                  image = srcsetParts[0].trim().split(' ')[0];
                }
              }
            }

            if (!image || image.startsWith('data:')) return;

            // Extract prices
            let originalPriceText = null;
            let salePriceText = null;

            const priceContainer = tile.querySelector('.price');
            if (priceContainer) {
              // Original price
              const originalEl = priceContainer.querySelector('del .value, .strike-through .value');
              if (originalEl) {
                const valueContent = originalEl.getAttribute('content');
                if (valueContent) {
                  originalPriceText = '$' + valueContent;
                } else {
                  const text = originalEl.textContent.trim();
                  const priceMatch = text.match(/\$[\d,.]+/);
                  if (priceMatch) originalPriceText = priceMatch[0];
                }
              }

              // Sale price
              const saleEl = priceContainer.querySelector('.sales .value');
              if (saleEl) {
                const valueContent = saleEl.getAttribute('content');
                if (valueContent) {
                  salePriceText = '$' + valueContent;
                } else {
                  const text = saleEl.textContent.trim();
                  const priceMatch = text.match(/\$[\d,.]+/);
                  if (priceMatch) salePriceText = priceMatch[0];
                }
              }
            }

            // Only add if we have both prices
            if (originalPriceText && salePriceText && originalPriceText !== salePriceText) {
              results.push({
                name,
                url,
                image,
                originalPriceText,
                salePriceText,
                pid,
                index
              });
            }
          } catch (error) {
            console.error('Error processing product:', error.message);
          }
        });

        return results;
      });

      console.log(`[${this.getName()}] Found ${scrapedProducts.length} products on this page`);

      // Process and validate products
      for (const rawProduct of scrapedProducts) {
        // Skip if already seen globally
        if (seenUrls.has(rawProduct.url)) continue;
        seenUrls.add(rawProduct.url);

        try {
          const originalPrice = this.extractPrice(rawProduct.originalPriceText);
          const salePrice = this.extractPrice(rawProduct.salePriceText);

          const discountCheck = this.isRealDiscount(originalPrice, salePrice);
          if (!discountCheck.valid) {
            continue;
          }

          if (!this.isValidSkechersImage(rawProduct.image)) {
            continue;
          }

          const product = {
            name: rawProduct.name,
            brand: this.brand,
            originalPrice,
            salePrice,
            discount: discountCheck.discount,
            currency: this.currency,
            image: rawProduct.image,
            url: rawProduct.url,
            category: this.categorizeProduct(rawProduct.name, rawProduct.image)
          };

          products.push(product);

        } catch (error) {
          console.error(`[${this.getName()}] Error processing product:`, error.message);
        }
      }

      console.log(`[${this.getName()}] Added ${products.length} valid products from this page`);

    } catch (error) {
      console.error(`[${this.getName()}] Error scraping page:`, error.message);
    }

    return products;
  }

  /**
   * Handle cookie consent popup if present
   */
  async handleCookieConsent() {
    try {
      const consentSelectors = [
        '#onetrust-accept-btn-handler',
        '[id*="cookie-accept"]',
        '[class*="cookie-accept"]',
        'button[id*="accept"]'
      ];

      for (const selector of consentSelectors) {
        try {
          const button = await this.page.$(selector);
          if (button) {
            await button.click();
            await this.delay(1000);
            break;
          }
        } catch (e) {}
      }
    } catch (error) {}
  }

  /**
   * Click "Load More" button to load additional products
   */
  async loadMoreProducts(maxClicks = 20) {
    let clickCount = 0;
    let noButtonCount = 0;

    while (clickCount < maxClicks && noButtonCount < 3) {
      try {
        // Scroll to bottom to make button visible
        await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await this.delay(1000);

        // Try to find and click the button
        const buttonClicked = await this.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, a.btn'));
          const loadMoreBtn = buttons.find(btn => {
            const text = btn.textContent.toLowerCase();
            const isVisible = btn.offsetWidth > 0 && btn.offsetHeight > 0;
            return isVisible && (
              text.includes('load more') ||
              text.includes('show more') ||
              text.includes('view more')
            );
          });

          if (loadMoreBtn) {
            loadMoreBtn.click();
            return true;
          }
          return false;
        });

        if (buttonClicked) {
          console.log(`[SkechersScraper] Clicked "Load More" (${clickCount + 1}/${maxClicks})`);
          await this.delay(2500);
          clickCount++;
          noButtonCount = 0;
        } else {
          noButtonCount++;
          await this.delay(1000);
        }
      } catch (error) {
        break;
      }
    }
  }

  /**
   * Validate if image URL is from Skechers CDN
   */
  isValidSkechersImage(imageUrl) {
    if (!imageUrl) return false;
    try {
      const url = new URL(imageUrl);
      return this.validImageDomains.some(domain =>
        url.hostname.includes(domain) || url.hostname.endsWith('.skechers.com')
      );
    } catch (error) {
      return imageUrl.includes('skechers.com');
    }
  }

  /**
   * Categorize product based on name
   */
  categorizeProduct(name, imageUrl = '') {
    const searchText = (name + ' ' + (imageUrl || '')).toLowerCase();

    if (searchText.match(/\b(shirt|tee|top|jacket|hoodie|sweater|sweatshirt|sweatpants|dress|pants|jogger|shorts|tights|leggings|polo|vest|tank|fleece|pullover)\b/)) {
      return 'clothing';
    }
    if (searchText.match(/\b(bag|backpack|wallet|hat|cap|beanie|socks|gloves|scarf|belt|watch|insole)\b/)) {
      return 'accessories';
    }

    return 'shoes';
  }
}

module.exports = SkechersScraper;
