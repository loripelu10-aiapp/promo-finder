const BaseScraper = require('../brands/base-scraper');

/**
 * Zalando EU Sale Scraper
 *
 * Targets: https://www.zalando.co.uk/women-shoes-sale/
 * Available in: EU, UK, DE, FR, IT, ES (Pan-European)
 * Currency: GBP (UK site), EUR for other countries
 *
 * Zalando is a major European fashion platform with real sales
 */
class ZalandoEUScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: 30,
      scrollDelay: 2000,
      rateLimit: 2000,
      timeout: 60000,
      ...config
    });

    this.source = 'zalando.co.uk';
    this.currency = 'GBP';
    this.availableRegions = ['EU', 'UK', 'DE', 'FR', 'IT', 'ES'];
    this.baseUrl = 'https://www.zalando.co.uk';
  }

  /**
   * Scrape Zalando women's shoes sale section
   */
  async scrape() {
    console.log(`\n🔍 [Zalando EU] Scraping women's shoes sale section...`);

    const products = [];

    // Direct sale URL - corrected to actual working URL
    const saleUrl = 'https://www.zalando.co.uk/womens-shoes-outlet/';

    try {
      await this.initBrowser();

      console.log(`📄 Loading: ${saleUrl}`);

      await this.page.goto(saleUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      console.log('📄 Page loaded, waiting for products...');
      await this.delay(5000);

      // Scroll to load more products
      await this.scrollToLoadProducts(3);

      // Take debug screenshot
      await this.page.screenshot({ path: '/tmp/zalando-sale-debug.png' });
      console.log('📸 Debug screenshot: /tmp/zalando-sale-debug.png');

      // Extract products
      const scrapedProducts = await this.page.evaluate((baseUrl) => {
        const results = [];

        // Zalando uses article or div with specific classes
        const selectors = [
          'article[data-zalon-article-id]',
          '[class*="catalogArticlesList"] > div',
          '[data-testid="product-card"]',
          'article'
        ];

        let productCards = [];
        for (const selector of selectors) {
          const cards = document.querySelectorAll(selector);
          if (cards.length > 0) {
            productCards = cards;
            console.log(`Found ${cards.length} products with selector: ${selector}`);
            break;
          }
        }

        productCards.forEach(card => {
          try {
            // Get product link
            const link = card.querySelector('a[href*="/"]');
            if (!link) return;

            let url = link.href;
            if (url && !url.startsWith('http')) {
              url = baseUrl + url;
            }
            if (!url || !url.includes('zalando')) return;

            // Get product name
            const nameSelectors = [
              '[class*="name"]',
              '[class*="brand"]',
              'h3',
              'h2',
              '[data-testid="product-name"]'
            ];

            let name = null;
            for (const selector of nameSelectors) {
              const el = card.querySelector(selector);
              if (el && el.textContent.trim()) {
                name = el.textContent.trim();
                break;
              }
            }

            // Get image
            const img = card.querySelector('img');
            let image = null;
            if (img) {
              image = img.src || img.dataset.src || img.getAttribute('data-src') || img.srcset?.split(' ')[0];
            }

            // Get prices
            const priceContainer = card.querySelector('[class*="price"]') || card;
            const priceText = priceContainer.textContent || '';

            // Zalando shows discounted prices clearly
            const priceMatches = priceText.match(/£([\d.]+)/g) || priceText.match(/€([\d.]+)/g);

            let salePrice = null;
            let originalPrice = null;

            if (priceMatches && priceMatches.length >= 2) {
              const prices = priceMatches.map(p => parseFloat(p.replace(/[£€]/, '').trim()));
              salePrice = Math.min(...prices);
              originalPrice = Math.max(...prices);
            } else if (priceMatches && priceMatches.length === 1) {
              // Single price - not on sale, skip
              return;
            }

            // Look for discount percentage badge
            const badgeEl = card.querySelector('[class*="discount"], [class*="promo"], [class*="badge"]');
            let badgeDiscount = null;
            if (badgeEl) {
              const badgeMatch = badgeEl.textContent.match(/(\d+)%/);
              if (badgeMatch) {
                badgeDiscount = parseInt(badgeMatch[1]);
              }
            }

            // VALIDATION: Must have real discount
            if (name && url && image && salePrice && originalPrice && originalPrice > salePrice) {
              const discount = Math.round(((originalPrice - salePrice) / originalPrice) * 100);

              // Validate discount is reasonable
              if (discount >= 10 && discount <= 70) {
                results.push({
                  name,
                  url,
                  image,
                  originalPrice,
                  salePrice,
                  discount: badgeDiscount || discount
                });
              }
            }
          } catch (e) {
            console.error('Error parsing Zalando product:', e.message);
          }
        });

        return results;
      }, this.baseUrl);

      console.log(`📦 Extracted ${scrapedProducts.length} products from Zalando`);

      // Process each product
      for (const product of scrapedProducts) {
        if (products.length >= this.config.maxProducts) break;

        const processedProduct = {
          name: product.name,
          brand: this.extractBrand(product.name),
          category: 'shoes',
          source: this.source,

          originalPrice: product.originalPrice,
          salePrice: product.salePrice,
          discount: product.discount,
          currency: this.currency,

          availableRegions: this.availableRegions,

          url: product.url,
          image: product.image,

          scrapedAt: new Date().toISOString()
        };

        products.push(processedProduct);
        console.log(`✅ Added: ${product.name} (${product.discount}% off, £${product.salePrice})`);
      }

      console.log(`\n🎉 Zalando scraping complete: ${products.length} valid products`);

    } catch (error) {
      console.error(`❌ Zalando scraping failed: ${error.message}`);
      console.error(error.stack);
    } finally {
      await this.close();
    }

    return products;
  }

  extractBrand(name) {
    const brands = [
      'Nike', 'Adidas', 'Puma', 'New Balance', 'Converse',
      'Vans', 'Reebok', 'Dr Martens', 'UGG', 'Birkenstock',
      'Timberland', 'Clarks', 'Tommy Hilfiger', 'Calvin Klein',
      'Michael Kors', 'Steve Madden', 'Skechers'
    ];

    for (const brand of brands) {
      if (name.toLowerCase().includes(brand.toLowerCase())) {
        return brand;
      }
    }

    return 'Unknown';
  }
}

module.exports = ZalandoEUScraper;
