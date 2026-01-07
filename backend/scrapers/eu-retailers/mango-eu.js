const BaseScraper = require('../brands/base-scraper');

/**
 * Mango EU Scraper
 *
 * Scrapes Mango EU for women's shoes on sale with REAL discounts
 * Available in: EU, ES, FR, DE, IT, UK
 * Currency: EUR (€)
 *
 * VALIDATION RULES:
 * - Only products with BOTH original and sale price
 * - Discount must be between 10-70%
 * - No price estimation accepted
 * - Clean product names (brand + product line)
 */
class MangoEUScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: 30,
      scrollDelay: 3000,
      rateLimit: 3000,
      timeout: 60000,
      ...config
    });

    this.source = 'mango.com';
    this.currency = 'EUR';
    this.availableRegions = ['EU', 'ES', 'FR', 'DE', 'IT', 'UK'];
    this.brand = 'Mango';
  }

  /**
   * Main scrape method - searches for women's shoes on sale
   */
  async scrape() {
    console.log(`\n🔍 [Mango EU] Searching for women's shoes on sale...`);

    const products = [];

    // Mango EU - Women's shoes sale URL
    // Pattern: shop.mango.com/[country]/[lang]/c/women/shoes_[id]
    // We'll try ES (Spain) as the main EU site, with EUR currency
    const saleUrl = 'https://shop.mango.com/es/en/c/women/shoes_826dba0a';

    try {
      await this.initBrowser();

      console.log(`📄 Loading: ${saleUrl}`);

      await this.page.goto(saleUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      console.log('📄 Page loaded, waiting for products to render...');

      // Wait for JavaScript to render products
      await this.delay(8000);

      // Take debug screenshot
      await this.page.screenshot({ path: '/tmp/mango-eu-debug.png' });
      console.log('📸 Debug screenshot: /tmp/mango-eu-debug.png');

      // Check page title
      const pageTitle = await this.page.title();
      console.log(`📄 Page title: ${pageTitle}`);

      // Try multiple product card selectors
      const productSelectors = [
        '[data-testid="product-card"]',
        '.product-card',
        '[class*="ProductCard"]',
        'article[data-product]',
        'a[href*="/product/"]',
        '.productList-item',
        '[class*="product-item"]',
        '[class*="ProductItem"]',
        'article.product',
        '.productList article',
        '[data-test="product-card"]',
        'div[class*="product"]'
      ];

      let workingSelector = null;
      for (const selector of productSelectors) {
        try {
          const count = await this.page.$$eval(selector, els => els.length);
          if (count > 0) {
            workingSelector = selector;
            console.log(`✅ Found ${count} products with selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Selector invalid or not found
        }
      }

      if (!workingSelector) {
        console.log(`⚠️  No products found with any selector`);
        console.log('💡 Check /tmp/mango-eu-debug.png to identify correct selectors');
        return products;
      }

      // Scroll to load more products
      await this.scrollToLoadProducts(3);

      // Extract products from page
      const scrapedProducts = await this.page.evaluate((selector, brandName) => {
        const cards = document.querySelectorAll(selector);
        const results = [];

        cards.forEach(card => {
          try {
            // Find product link
            const link = card.tagName === 'A' ? card : card.querySelector('a[href*="/product"]') || card.querySelector('a');
            if (!link) return;

            const url = link.href;
            if (!url || !url.includes('shop.mango.com')) return;

            // Get product name
            // Try multiple selectors for name
            const nameSelectors = [
              '[class*="product-name"]',
              '[class*="ProductName"]',
              '.product-title',
              '[data-testid="product-name"]',
              'h2',
              'h3',
              '.title',
              '[class*="title"]'
            ];

            let name = null;
            for (const nameSelector of nameSelectors) {
              const nameEl = card.querySelector(nameSelector) || link.querySelector(nameSelector);
              if (nameEl && nameEl.textContent.trim()) {
                name = nameEl.textContent.trim();
                break;
              }
            }

            // Fallback: try aria-label or image alt
            if (!name) {
              const img = card.querySelector('img') || link.querySelector('img');
              const ariaLabel = link.getAttribute('aria-label');
              name = ariaLabel || (img ? img.getAttribute('alt') : null);
            }

            // If still no name, try getting text content (cleanup later)
            if (!name) {
              const textContent = card.textContent || link.textContent;
              // Extract first meaningful line (avoid price text)
              const lines = textContent.split('\n').map(l => l.trim()).filter(l => l && !l.match(/^[€$£]\s*[\d,.]+/));
              name = lines[0];
            }

            if (!name) return;

            // Get prices - look for original and sale price
            // Mango typically shows: sale price + strikethrough original price
            const priceSelectors = [
              '[class*="price"]',
              '[data-testid*="price"]',
              '.product-price',
              '[class*="Price"]'
            ];

            let pricesContainer = null;
            for (const priceSelector of priceSelectors) {
              const priceEl = card.querySelector(priceSelector) || link.querySelector(priceSelector);
              if (priceEl) {
                pricesContainer = priceEl;
                break;
              }
            }

            let originalPrice = null;
            let salePrice = null;

            if (pricesContainer) {
              // Look for strikethrough/original price
              const originalPriceEl = pricesContainer.querySelector('[class*="original"]') ||
                                      pricesContainer.querySelector('[class*="strike"]') ||
                                      pricesContainer.querySelector('del') ||
                                      pricesContainer.querySelector('s') ||
                                      pricesContainer.querySelector('[style*="line-through"]');

              // Look for sale/current price
              const salePriceEl = pricesContainer.querySelector('[class*="sale"]') ||
                                 pricesContainer.querySelector('[class*="current"]') ||
                                 pricesContainer.querySelector('[class*="discount"]') ||
                                 pricesContainer.querySelector('[class*="special"]');

              if (originalPriceEl) {
                originalPrice = originalPriceEl.textContent.trim();
              }

              if (salePriceEl) {
                salePrice = salePriceEl.textContent.trim();
              }

              // If we didn't find specific sale/original, extract all prices from container
              if (!originalPrice || !salePrice) {
                const allPrices = pricesContainer.textContent.match(/€\s*[\d,.]+/g);
                if (allPrices && allPrices.length >= 2) {
                  // First price is usually sale, second is original
                  salePrice = allPrices[0];
                  originalPrice = allPrices[1];
                } else if (allPrices && allPrices.length === 1) {
                  // Only one price - might not be on sale
                  salePrice = allPrices[0];
                }
              }
            } else {
              // Fallback: search entire card for prices
              const cardText = card.textContent || link.textContent;
              const allPrices = cardText.match(/€\s*[\d,.]+/g);
              if (allPrices && allPrices.length >= 2) {
                salePrice = allPrices[0];
                originalPrice = allPrices[1];
              } else if (allPrices && allPrices.length === 1) {
                salePrice = allPrices[0];
              }
            }

            // Get discount percentage if displayed
            const discountBadge = card.querySelector('[class*="discount"]') ||
                                 card.querySelector('[class*="badge"]') ||
                                 link.querySelector('[class*="discount"]') ||
                                 link.querySelector('[class*="badge"]');

            let discountPercent = null;
            if (discountBadge) {
              const discountText = discountBadge.textContent;
              const match = discountText.match(/(\d+)\s*%/);
              if (match) {
                discountPercent = match[1];
              }
            }

            // Get image URL
            const img = card.querySelector('img') || link.querySelector('img');
            const image = img ? (img.src || img.dataset.src || img.getAttribute('data-lazy-src') || img.srcset) : null;

            // Only add if we have name, URL, and at least sale price
            // We REQUIRE both prices for real discount validation
            if (name && url && salePrice && originalPrice) {
              results.push({
                name,
                url,
                image: image || url,
                originalPrice,
                salePrice,
                discountPercent
              });
            }
          } catch (e) {
            // Skip failed products
            console.error('Error extracting product:', e);
          }
        });

        return results;
      }, workingSelector, this.brand);

      console.log(`📦 Extracted ${scrapedProducts.length} products from Mango EU`);

      // Process and validate products
      for (const rawProduct of scrapedProducts) {
        if (products.length >= this.config.maxProducts) break;

        try {
          // Extract numeric prices
          const salePrice = this.extractPrice(rawProduct.salePrice);
          const originalPrice = this.extractPrice(rawProduct.originalPrice);

          // STRICT VALIDATION: Must have both prices
          if (!salePrice || !originalPrice) {
            console.log(`⚠️  Rejected "${rawProduct.name}": Missing price data`);
            continue;
          }

          if (salePrice <= 0 || originalPrice <= 0) {
            console.log(`⚠️  Rejected "${rawProduct.name}": Invalid price values`);
            continue;
          }

          // Validate real discount (10-70% range, no estimation)
          const discountCheck = this.isRealDiscount(originalPrice, salePrice);
          if (!discountCheck.valid) {
            console.log(`⚠️  Rejected "${rawProduct.name}": ${discountCheck.reason}`);
            continue;
          }

          // Clean product name (remove extra whitespace, line breaks)
          const cleanName = this.cleanProductName(rawProduct.name);

          // Validate image URL
          const imageUrl = this.validateImageUrl(rawProduct.image);
          if (!imageUrl) {
            console.log(`⚠️  Warning: Invalid image URL for "${cleanName}"`);
          }

          const product = {
            id: `mango-eu-${Date.now()}-${products.length}`,
            name: cleanName,
            brand: this.brand,
            category: 'shoes',
            originalPrice: originalPrice,
            salePrice: salePrice,
            discount: discountCheck.discount,
            currency: this.currency,
            image: imageUrl,
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

      console.log(`\n🎉 Mango EU scraping complete: ${products.length} women's shoes on sale`);
      console.log(`🌍 Regions: ${this.availableRegions.join(', ')}`);
      console.log(`💰 Currency: ${this.currency}\n`);

    } catch (error) {
      console.error(`❌ Mango EU scraper error:`, error.message);
      throw error;
    } finally {
      await this.close();
    }

    return products;
  }

  /**
   * Clean product name
   * Removes extra whitespace, line breaks, and noise
   */
  cleanProductName(name) {
    if (!name) return '';

    return name
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .replace(/\n+/g, ' ') // Replace newlines with space
      .trim()
      .substring(0, 200); // Limit length
  }

  /**
   * Validate image URL
   * Returns valid URL or null
   */
  validateImageUrl(url) {
    if (!url) return null;

    // Check if it's a valid URL
    try {
      // Handle srcset format (multiple URLs)
      if (url.includes(',')) {
        url = url.split(',')[0].trim().split(' ')[0];
      }

      // Must be http/https
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return null;
      }

      // Basic URL validation
      new URL(url);
      return url;
    } catch (e) {
      return null;
    }
  }
}

module.exports = MangoEUScraper;
