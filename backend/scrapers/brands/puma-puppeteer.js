const BaseScraper = require('./base-scraper');

/**
 * PumaScraper - Scrapes Puma US sale page for deals
 *
 * Target: https://us.puma.com/us/en/sale
 * Extracts products with real discounts only (no price estimation)
 * Verifies images are from Puma CDN (images.puma.com or similar)
 */
class PumaScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: config.maxProducts || 60,
      scrollDelay: 3000, // Puma loads products dynamically
      rateLimit: 5000,
      ...config
    });

    this.targetUrl = 'https://us.puma.com/us/en/sale';
    this.brand = 'Puma';
    this.source = 'us.puma.com';
    this.currency = 'USD';
    this.availableRegions = ['US'];

    // Valid Puma CDN domains for image validation
    this.validImageDomains = [
      'images.puma.com',
      'images.puma.net',
      'cdn.puma.com',
      'img.puma.com',
      'us.puma.com'
    ];
  }

  /**
   * Main scraping method
   */
  async scrape(browserInstance = null) {
    const products = [];

    try {
      console.log(`[${this.getName()}] Starting scrape of ${this.targetUrl}`);

      await this.initBrowser(browserInstance);

      // Navigate to Puma sale page
      console.log(`[${this.getName()}] Navigating to sale page...`);
      await this.page.goto(this.targetUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      console.log(`[${this.getName()}] Page loaded, waiting for products...`);

      // Handle cookie consent if present
      await this.handleCookieConsent();

      // Wait for product grid to load
      try {
        await this.page.waitForSelector('[data-test-id="product-list-item"], .product-tile, [class*="ProductCard"], [class*="product-card"]', {
          timeout: 15000
        });
        console.log(`[${this.getName()}] Product grid found`);
      } catch (error) {
        console.error(`[${this.getName()}] Product grid not found:`, error.message);
        // Try to capture screenshot for debugging
        await this.page.screenshot({ path: '/tmp/puma-debug.png' });
        console.log(`[${this.getName()}] Debug screenshot saved to /tmp/puma-debug.png`);
        return products;
      }

      // Click "Load More" button multiple times to get more products
      await this.loadMoreProducts(5);

      // Scroll to load more products
      await this.scrollToLoadProducts(5);

      // Extract products from the page
      const scrapedProducts = await this.page.evaluate(() => {
        const results = [];

        // Puma uses different selectors, try multiple approaches
        const productSelectors = [
          '[data-test-id="product-list-item"]',
          '.product-tile',
          '[class*="ProductCard"]',
          '[class*="product-card"]',
          'article[class*="product"]',
          '[data-testid*="product"]'
        ];

        let productElements = [];
        for (const selector of productSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            productElements = Array.from(elements);
            console.log(`Found ${elements.length} products with selector: ${selector}`);
            break;
          }
        }

        // If still no products, try a broader search
        if (productElements.length === 0) {
          // Look for any grid item that contains price information
          const allLinks = document.querySelectorAll('a[href*="/pd/"]');
          const seen = new Set();
          allLinks.forEach(link => {
            const card = link.closest('div[class*="product"], article, li');
            if (card && !seen.has(card)) {
              seen.add(card);
              productElements.push(card);
            }
          });
        }

        console.log(`Processing ${productElements.length} product elements`);

        productElements.forEach((card, index) => {
          try {
            // Extract product link
            const linkElement = card.querySelector('a[href*="/pd/"], a[href*="/product/"]');
            if (!linkElement) return;

            let url = linkElement.href;
            if (!url) return;

            // Ensure full URL
            if (url.startsWith('/')) {
              url = 'https://us.puma.com' + url;
            }

            if (!url.includes('puma.com')) return;

            // Extract product name
            const nameSelectors = [
              '[data-test-id="product-tile-name"]',
              '[class*="ProductName"]',
              '[class*="product-name"]',
              '[class*="productName"]',
              'h2',
              'h3',
              '[class*="title"]'
            ];

            let name = '';
            for (const selector of nameSelectors) {
              const el = card.querySelector(selector);
              if (el && el.textContent.trim()) {
                name = el.textContent.trim();
                break;
              }
            }
            if (!name) return;

            // Extract image
            const imageElement = card.querySelector('img[src*="images.puma"], img[data-src*="images.puma"], img[src*="puma.com"], img');
            let image = '';
            if (imageElement) {
              image = imageElement.src || imageElement.dataset.src || imageElement.getAttribute('data-src') || '';
              // Handle srcset
              if (!image && imageElement.srcset) {
                const srcsetParts = imageElement.srcset.split(',');
                if (srcsetParts.length > 0) {
                  image = srcsetParts[0].trim().split(' ')[0];
                }
              }
            }

            // Skip if no valid image
            if (!image) return;

            // Extract prices - Puma shows strikethrough original price and sale price
            let originalPriceText = null;
            let salePriceText = null;

            // Method 1: Look for specific Puma price elements
            const priceSelectors = {
              original: [
                '[data-test-id="product-tile-price-original"]',
                '[class*="originalPrice"]',
                '[class*="original-price"]',
                '[class*="strikethrough"]',
                '[class*="was-price"]',
                'del',
                's',
                '[style*="line-through"]'
              ],
              sale: [
                '[data-test-id="product-tile-price-sale"]',
                '[class*="salePrice"]',
                '[class*="sale-price"]',
                '[class*="discountedPrice"]',
                '[class*="current-price"]',
                '[class*="now-price"]'
              ]
            };

            // Try original price selectors
            for (const selector of priceSelectors.original) {
              const el = card.querySelector(selector);
              if (el && el.textContent.trim().includes('$')) {
                originalPriceText = el.textContent.trim();
                break;
              }
            }

            // Try sale price selectors
            for (const selector of priceSelectors.sale) {
              const el = card.querySelector(selector);
              if (el && el.textContent.trim().includes('$')) {
                salePriceText = el.textContent.trim();
                break;
              }
            }

            // Method 2: Find price container and analyze all price elements
            if (!originalPriceText || !salePriceText) {
              const priceContainerSelectors = [
                '[data-test-id*="price"]',
                '[class*="price"]',
                '[class*="Price"]'
              ];

              for (const containerSelector of priceContainerSelectors) {
                const containers = card.querySelectorAll(containerSelector);
                containers.forEach(container => {
                  const text = container.textContent.trim();
                  if (!text.includes('$')) return;

                  const style = window.getComputedStyle(container);
                  const isStrikethrough = style.textDecoration.includes('line-through') ||
                    container.tagName === 'DEL' ||
                    container.tagName === 'S' ||
                    container.className.includes('original') ||
                    container.className.includes('was') ||
                    container.className.includes('strikethrough');

                  if (isStrikethrough && !originalPriceText) {
                    originalPriceText = text;
                  } else if (!isStrikethrough && text.includes('$') && !salePriceText) {
                    // Check if it looks like a sale price (not the original)
                    if (container.className.includes('sale') ||
                        container.className.includes('now') ||
                        container.className.includes('current') ||
                        container.className.includes('discount')) {
                      salePriceText = text;
                    }
                  }
                });
              }
            }

            // Method 3: Look for price pattern in any element
            if (!originalPriceText || !salePriceText) {
              const allElements = card.querySelectorAll('*');
              const pricePattern = /\$\d+(?:\.\d{2})?/;
              const prices = [];

              allElements.forEach(el => {
                // Only check text nodes (not containers)
                if (el.children.length === 0 || el.tagName === 'SPAN') {
                  const text = el.textContent.trim();
                  const match = text.match(pricePattern);
                  if (match && text.length < 20) {
                    const style = window.getComputedStyle(el);
                    const isStrikethrough = style.textDecoration.includes('line-through');
                    prices.push({
                      text: match[0],
                      isStrikethrough,
                      element: el
                    });
                  }
                }
              });

              // Sort: strikethrough first (original), then normal (sale)
              if (prices.length >= 2) {
                const original = prices.find(p => p.isStrikethrough);
                const sale = prices.find(p => !p.isStrikethrough);
                if (original && !originalPriceText) originalPriceText = original.text;
                if (sale && !salePriceText) salePriceText = sale.text;
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
                index
              });
            }
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

          // Validate image is from Puma CDN
          if (!this.isValidPumaImage(rawProduct.image)) {
            console.log(`[${this.getName()}] Rejected "${rawProduct.name}": Invalid image source`);
            continue;
          }

          // Create product object
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
          console.log(`[${this.getName()}] Added: ${product.name} ($${product.originalPrice} -> $${product.salePrice}, ${product.discount}% off)`);

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
   * Handle cookie consent popup if present
   */
  async handleCookieConsent() {
    try {
      const consentSelectors = [
        '#onetrust-accept-btn-handler',
        '[id*="cookie-accept"]',
        '[class*="cookie-accept"]',
        'button[id*="accept"]',
        '[data-testid="cookie-accept"]'
      ];

      for (const selector of consentSelectors) {
        const button = await this.page.$(selector);
        if (button) {
          console.log(`[${this.getName()}] Accepting cookies...`);
          await button.click();
          await this.delay(1000);
          break;
        }
      }
    } catch (error) {
      // Not critical if cookie consent fails
      console.log(`[${this.getName()}] Cookie consent handling skipped`);
    }
  }

  /**
   * Click "Load More" button to load additional products
   */
  async loadMoreProducts(maxClicks = 5) {
    let clickCount = 0;

    while (clickCount < maxClicks) {
      try {
        const loadMoreSelectors = [
          '[data-test-id="load-more-products"]',
          'button[class*="load-more"]',
          'button[class*="LoadMore"]',
          '[class*="loadMore"]',
          'button:contains("Load More")',
          'button:contains("Show More")',
          '[data-testid*="load-more"]'
        ];

        let clicked = false;
        for (const selector of loadMoreSelectors) {
          try {
            const button = await this.page.$(selector);
            if (button) {
              const isVisible = await this.page.evaluate(el => {
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
              }, button);

              if (isVisible) {
                console.log(`[${this.getName()}] Clicking "Load More" button (${clickCount + 1}/${maxClicks})...`);
                await button.click();
                await this.delay(2000);
                clicked = true;
                clickCount++;
                break;
              }
            }
          } catch (e) {
            // Selector didn't work, try next
          }
        }

        if (!clicked) {
          // Try using evaluate to find and click button by text content
          const buttonClicked = await this.page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const loadMoreBtn = buttons.find(btn =>
              btn.textContent.toLowerCase().includes('load more') ||
              btn.textContent.toLowerCase().includes('show more')
            );
            if (loadMoreBtn) {
              loadMoreBtn.click();
              return true;
            }
            return false;
          });

          if (buttonClicked) {
            console.log(`[${this.getName()}] Clicked "Load More" button via text search (${clickCount + 1}/${maxClicks})`);
            await this.delay(2000);
            clickCount++;
          } else {
            console.log(`[${this.getName()}] No more "Load More" buttons found`);
            break;
          }
        }
      } catch (error) {
        console.log(`[${this.getName()}] Load more finished: ${error.message}`);
        break;
      }
    }
  }

  /**
   * Validate if image URL is from Puma CDN
   */
  isValidPumaImage(imageUrl) {
    if (!imageUrl) return false;

    try {
      const url = new URL(imageUrl);
      return this.validImageDomains.some(domain =>
        url.hostname.includes(domain) || url.hostname.endsWith('.puma.com')
      );
    } catch (error) {
      // If URL parsing fails, check if it contains puma domain
      return imageUrl.includes('puma.com') || imageUrl.includes('puma.net');
    }
  }

  /**
   * Categorize product based on name and image URL
   */
  categorizeProduct(name, imageUrl = '') {
    // Combine name and image URL for better categorization
    const searchText = (name + ' ' + (imageUrl || '')).toLowerCase();

    // Clothing patterns - check first as they're more specific
    if (searchText.match(/\b(shirt|tee|t-shirt|top|jacket|hoodie|sweater|sweatshirt|sweatpants|dress|pants|jogger|jeans|shorts|tights|leggings|tracksuit|jersey|polo|vest|tank|fleece|pullover|crew|zip|long-sleeve)\b/)) {
      return 'clothing';
    }
    // Accessories patterns
    if (searchText.match(/\b(bag|backpack|wallet|hat|cap|beanie|socks|gloves|scarf|belt|watch|ball|gym)\b/)) {
      return 'accessories';
    }
    // Shoes patterns - most specific
    if (searchText.match(/\b(shoe|sneaker|boot|sandal|trainer|running|clyde|suede|cali|rs-x|future|deviate|velocity|speedcat|palermo|easy|rider|slip-on|cleat|basketball|soccer)\b/)) {
      return 'shoes';
    }

    return 'shoes'; // Default for Puma
  }
}

module.exports = PumaScraper;
