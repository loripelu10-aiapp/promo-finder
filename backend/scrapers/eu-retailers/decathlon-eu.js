const BaseScraper = require('../brands/base-scraper');

/**
 * Decathlon EU Scraper
 *
 * Scrapes Decathlon UK/EU for sports shoes on sale
 * Available in: EU, UK, FR, DE, IT, ES
 * Currency: GBP (£) for UK site
 *
 * Decathlon is known for:
 * - Clear sale sections with real discounts
 * - Prominent discount percentage badges
 * - Wide range of sports footwear
 * - Good EU availability
 */
class DecathlonEUScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: 30,
      scrollDelay: 3000,
      rateLimit: 3000,
      timeout: 60000,
      ...config
    });

    this.source = 'decathlon.co.uk';
    this.currency = 'GBP';
    this.availableRegions = ['EU', 'UK', 'FR', 'DE', 'IT', 'ES'];
  }

  /**
   * Default scrape method - scrapes sports shoes from sale section
   */
  async scrape() {
    return await this.scrapeSaleShoes();
  }

  /**
   * Scrape sports shoes from Decathlon sale section
   */
  async scrapeSaleShoes() {
    console.log(`\n🔍 [Decathlon EU] Searching for sports shoes on sale...`);

    const products = [];

    // Decathlon UK sale URL for sports shoes/trainers
    // Primary target: /deals page filtered for footwear
    const saleUrl = 'https://www.decathlon.co.uk/deals';

    try {
      await this.initBrowser();

      console.log(`📄 Loading: ${saleUrl}`);

      await this.page.goto(saleUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      console.log('📄 Page loaded, waiting for products...');

      // Wait for JavaScript to render
      await this.delay(8000);

      // Take debug screenshot
      await this.page.screenshot({ path: '/tmp/decathlon-eu-debug.png' });
      console.log('📸 Debug screenshot: /tmp/decathlon-eu-debug.png');

      // Check for blocking
      const pageTitle = await this.page.title();
      const bodyText = await this.page.evaluate(() => document.body.textContent.toLowerCase());

      if (bodyText.includes('access denied') || bodyText.includes('forbidden')) {
        console.log('❌ Site appears to be blocking access');
        return products;
      }

      console.log(`📄 Page title: ${pageTitle}`);

      // Try multiple product selectors (Decathlon uses various patterns)
      const productSelectors = [
        '[data-testid="product-card"]',
        'article[data-product-id]',
        'div[class*="ProductCard"]',
        'div[class*="product-card"]',
        'li[class*="product"]',
        'article[class*="product"]',
        '[class*="ProductTile"]',
        'a[href*="/p/"]', // Decathlon product URLs typically have /p/ in them
        'div[class*="product-item"]',
        '[data-product-sku]'
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
        console.log('💡 Check /tmp/decathlon-eu-debug.png to identify correct selectors');
        return products;
      }

      // Scroll to load more products
      await this.scrollToLoadProducts(3);

      // Extract products
      const scrapedProducts = await this.page.evaluate((selector) => {
        const cards = document.querySelectorAll(selector);
        const results = [];

        cards.forEach(card => {
          try {
            // Get product link
            const link = card.tagName === 'A' ? card : card.querySelector('a[href*="/p/"]') || card.querySelector('a');
            if (!link) return;

            const url = link.href;
            if (!url || !url.includes('decathlon.co.uk')) return;

            // Get product name
            let name = null;

            // Try various name selectors
            const nameSelectors = [
              '[data-testid="product-title"]',
              '[class*="product-title"]',
              '[class*="ProductTitle"]',
              '[class*="product-name"]',
              'h2',
              'h3',
              '[class*="name"]'
            ];

            for (const nameSelector of nameSelectors) {
              const nameEl = card.querySelector(nameSelector);
              if (nameEl && nameEl.textContent.trim()) {
                name = nameEl.textContent.trim();
                break;
              }
            }

            // Fallback: get from aria-label or img alt
            if (!name) {
              const ariaLabel = link.getAttribute('aria-label');
              if (ariaLabel) {
                name = ariaLabel.trim();
              } else {
                const img = card.querySelector('img');
                if (img && img.alt) {
                  name = img.alt.trim();
                }
              }
            }

            if (!name) return;

            // Filter for shoes/trainers/footwear only
            const nameLower = name.toLowerCase();
            const isShoe = nameLower.includes('shoe') ||
                          nameLower.includes('trainer') ||
                          nameLower.includes('sneaker') ||
                          nameLower.includes('boot') ||
                          nameLower.includes('running') ||
                          nameLower.includes('walking') ||
                          nameLower.includes('trail') ||
                          nameLower.includes('football') ||
                          nameLower.includes('basketball') ||
                          nameLower.includes('tennis');

            if (!isShoe) return;

            // Get image
            const img = card.querySelector('img');
            const image = img ? (img.src || img.dataset.src || img.getAttribute('data-src') || img.getAttribute('srcset')?.split(' ')[0]) : null;

            // Get prices
            let originalPrice = null;
            let salePrice = null;
            let discountPercent = null;

            // Look for discount badge first (Decathlon shows these prominently)
            const discountBadge = card.querySelector('[class*="discount"], [class*="Discount"], [class*="badge"]');
            if (discountBadge) {
              const badgeText = discountBadge.textContent;
              const percentMatch = badgeText.match(/(\d+)%/);
              if (percentMatch) {
                discountPercent = parseInt(percentMatch[1]);
              }
            }

            // Get price container
            const priceContainer = card.querySelector('[class*="price"], [class*="Price"]');
            if (priceContainer) {
              // Sale/Current price
              const salePriceSelectors = [
                '[class*="sale"]',
                '[class*="Sale"]',
                '[class*="current"]',
                '[class*="now"]',
                '[data-testid="sale-price"]',
                'span[class*="price"]:not([class*="original"]):not([class*="rrp"]):not([class*="was"])'
              ];

              for (const salePriceSelector of salePriceSelectors) {
                const salePriceEl = priceContainer.querySelector(salePriceSelector);
                if (salePriceEl && salePriceEl.textContent.includes('£')) {
                  salePrice = salePriceEl.textContent.trim();
                  break;
                }
              }

              // Original price (RRP, was)
              const originalPriceSelectors = [
                '[class*="rrp"]',
                '[class*="RRP"]',
                '[class*="was"]',
                '[class*="original"]',
                '[class*="before"]',
                '[data-testid="original-price"]',
                's',
                'del',
                'strike'
              ];

              for (const originalPriceSelector of originalPriceSelectors) {
                const originalPriceEl = priceContainer.querySelector(originalPriceSelector);
                if (originalPriceEl && originalPriceEl.textContent.includes('£')) {
                  originalPrice = originalPriceEl.textContent.trim();
                  break;
                }
              }

              // Fallback: extract all prices from text
              if (!salePrice || !originalPrice) {
                const priceText = priceContainer.textContent;
                const priceMatches = priceText.match(/£\s*[\d,.]+/g);
                if (priceMatches) {
                  if (priceMatches.length === 1) {
                    salePrice = priceMatches[0];
                  } else if (priceMatches.length >= 2) {
                    // First is usually sale price, second is original
                    salePrice = priceMatches[0];
                    originalPrice = priceMatches[1];
                  }
                }
              }
            }

            // Only add if we have BOTH prices (requirement: real discounts only)
            if (name && url && image && salePrice && originalPrice) {
              results.push({
                name,
                url,
                image,
                originalPrice,
                salePrice,
                discountPercent
              });
            }
          } catch (e) {
            // Skip failed products
          }
        });

        return results;
      }, workingSelector);

      console.log(`📦 Extracted ${scrapedProducts.length} sports shoe products from Decathlon`);

      // Process and validate
      for (const rawProduct of scrapedProducts) {
        if (products.length >= this.config.maxProducts) break;

        try {
          const salePrice = this.extractPrice(rawProduct.salePrice);
          const originalPrice = this.extractPrice(rawProduct.originalPrice);

          if (!salePrice || salePrice <= 0) {
            console.log(`⚠️  Invalid sale price for "${rawProduct.name}"`);
            continue;
          }

          if (!originalPrice || originalPrice <= 0) {
            console.log(`⚠️  Invalid original price for "${rawProduct.name}"`);
            continue;
          }

          // CRITICAL: Validate discount is REAL (not estimated)
          const discountCheck = this.isRealDiscount(originalPrice, salePrice);
          if (!discountCheck.valid) {
            console.log(`⚠️  Rejected "${rawProduct.name}": ${discountCheck.reason}`);
            continue;
          }

          // Use calculated discount (or badge discount if available and matches)
          let discount = discountCheck.discount;
          if (rawProduct.discountPercent &&
              Math.abs(rawProduct.discountPercent - discountCheck.discount) <= 2) {
            discount = rawProduct.discountPercent; // Use badge if it matches calculation
          }

          // Extract brand from product name (if present)
          const brand = this.extractBrand(rawProduct.name);

          const product = {
            id: `decathlon-eu-${Date.now()}-${products.length}`,
            name: rawProduct.name,
            brand: brand,
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
          console.log(`✅ Added: ${product.name} (${product.discount}% off, £${product.salePrice})`);

        } catch (error) {
          console.error(`❌ Error processing product:`, error.message);
        }
      }

      console.log(`\n🎉 Decathlon EU scraping complete: ${products.length} sports shoes`);
      console.log(`🌍 Regions: ${this.availableRegions.join(', ')}`);
      console.log(`💰 Currency: ${this.currency}\n`);

    } catch (error) {
      console.error(`❌ Decathlon EU error:`, error.message);
    } finally {
      await this.close();
    }

    return products;
  }

  /**
   * Extract brand from product name
   * Decathlon sells multiple brands
   */
  extractBrand(name) {
    const nameLower = name.toLowerCase();

    // Common sports brands sold at Decathlon
    const brands = [
      'Nike',
      'Adidas',
      'Puma',
      'New Balance',
      'Asics',
      'Reebok',
      'Kipsta', // Decathlon brand
      'Kalenji', // Decathlon brand
      'Domyos', // Decathlon brand
      'Quechua', // Decathlon brand
      'Artengo', // Decathlon brand
      'Inesis', // Decathlon brand
      'Rockrider', // Decathlon brand
      'B\'Twin',
      'Btwin'
    ];

    for (const brand of brands) {
      if (nameLower.includes(brand.toLowerCase())) {
        return brand;
      }
    }

    return 'Decathlon'; // Default to Decathlon brand
  }

  /**
   * Categorize product based on name
   */
  categorizeProduct(name) {
    const nameLower = name.toLowerCase();

    // All products should be shoes based on our filter
    if (nameLower.includes('running')) return 'running-shoes';
    if (nameLower.includes('trail')) return 'trail-shoes';
    if (nameLower.includes('walking')) return 'walking-shoes';
    if (nameLower.includes('football') || nameLower.includes('soccer')) return 'football-shoes';
    if (nameLower.includes('basketball')) return 'basketball-shoes';
    if (nameLower.includes('tennis')) return 'tennis-shoes';
    if (nameLower.includes('training') || nameLower.includes('gym')) return 'training-shoes';

    return 'shoes';
  }
}

module.exports = DecathlonEUScraper;
