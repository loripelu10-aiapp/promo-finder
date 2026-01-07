const BaseScraper = require('../brands/base-scraper');

/**
 * ASOS UK Sale Scraper - REAL SALE SECTION
 *
 * Targets: https://www.asos.com/women/sale/shoes/cat/?cid=27112
 * Available in: UK, EU (ships Europe-wide)
 * Currency: GBP (£)
 *
 * ASOS has a dedicated sale section with REAL discounts
 */
class ASOSSaleScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: 30,
      scrollDelay: 2000,
      rateLimit: 2000,
      timeout: 60000,
      ...config
    });

    this.source = 'asos.com';
    this.currency = 'GBP';
    this.availableRegions = ['EU', 'UK'];
    this.baseUrl = 'https://www.asos.com';
  }

  /**
   * Scrape ASOS women's shoes sale section
   */
  async scrape() {
    console.log(`\n🔍 [ASOS] Scraping women's shoes sale section...`);

    const products = [];

    // Direct sale URL - Women's shoes on sale with discount filter
    // Adding refine parameter to ensure we get discounted items
    const saleUrl = 'https://www.asos.com/women/sale/shoes/cat/?cid=27112&nlid=ww|sale|shop+by+product|shoes';

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
      await this.page.screenshot({ path: '/tmp/asos-sale-debug.png' });
      console.log('📸 Debug screenshot: /tmp/asos-sale-debug.png');

      // Extract products
      const scrapedProducts = await this.page.evaluate((baseUrl) => {
        const results = [];

        // ASOS uses article elements for products
        const productCards = document.querySelectorAll('article[data-auto-id="productTile"]');

        console.log(`Found ${productCards.length} product cards`);

        productCards.forEach(card => {
          try {
            // Get product link
            const link = card.querySelector('a[data-auto-id="productTileLink"]') || card.querySelector('a');
            if (!link) return;

            let url = link.href;
            if (url && !url.startsWith('http')) {
              url = baseUrl + url;
            }
            if (!url || !url.includes('asos.com')) return;

            // Get product name
            const nameEl = card.querySelector('[data-auto-id="productTileDescription"]') || card.querySelector('h2') || card.querySelector('[class*="name"]');
            const name = nameEl ? nameEl.textContent.trim() : null;

            // Get image
            const img = card.querySelector('img');
            let image = null;
            if (img) {
              image = img.src || img.dataset.src || img.getAttribute('data-src');
              // ASOS uses lazy loading - get high quality image
              if (image && image.includes('placeholder')) {
                image = img.dataset.src || img.src;
              }
            }

            // Get prices - ASOS has clear price structure
            const priceContainer = card.querySelector('[data-auto-id="productTilePrice"]') || card.querySelector('[class*="price"]');
            if (!priceContainer) return;

            const priceText = priceContainer.textContent || '';

            // ASOS shows "Now £X.XX Was £Y.YY" for sales OR just shows both prices
            const nowMatch = priceText.match(/(?:Now|Sale)[:\s]*£([\d.]+)/i);
            const wasMatch = priceText.match(/Was[:\s]*£([\d.]+)/i);

            let salePrice = null;
            let originalPrice = null;

            if (nowMatch && wasMatch) {
              salePrice = parseFloat(nowMatch[1]);
              originalPrice = parseFloat(wasMatch[1]);
            } else {
              // Fallback: find any two prices (ASOS sometimes shows strikethrough + current)
              const allPrices = priceText.match(/£([\d.]+)/g);
              if (allPrices && allPrices.length >= 2) {
                const prices = allPrices.map(p => parseFloat(p.replace('£', '').trim()));
                salePrice = Math.min(...prices);
                originalPrice = Math.max(...prices);
              } else {
                // Single price only - not showing discount, skip
                // We ONLY want products with BOTH prices explicitly shown
                return;
              }
            }

            // VALIDATION: Must have BOTH prices and original must be higher
            if (name && url && image && salePrice && originalPrice && originalPrice > salePrice) {
              const discount = Math.round(((originalPrice - salePrice) / originalPrice) * 100);

              // Reject unrealistic discounts
              if (discount >= 10 && discount <= 70) {
                results.push({
                  name,
                  url,
                  image,
                  originalPrice,
                  salePrice,
                  discount
                });
              }
            }
          } catch (e) {
            console.error('Error parsing product:', e.message);
          }
        });

        return results;
      }, this.baseUrl);

      console.log(`📦 Extracted ${scrapedProducts.length} products from ASOS`);

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

      console.log(`\n🎉 ASOS scraping complete: ${products.length} valid products`);

    } catch (error) {
      console.error(`❌ ASOS scraping failed: ${error.message}`);
      console.error(error.stack);
    } finally {
      await this.close();
    }

    return products;
  }

  extractBrand(name) {
    const brands = [
      'Nike', 'Adidas', 'Puma', 'New Balance', 'Converse',
      'Vans', 'Reebok', 'ASOS DESIGN', 'Dr Martens', 'UGG',
      'Steve Madden', 'Birkenstock', 'Crocs', 'Timberland'
    ];

    for (const brand of brands) {
      if (name.toLowerCase().includes(brand.toLowerCase())) {
        return brand;
      }
    }

    // ASOS own brand
    if (name.toLowerCase().includes('asos')) {
      return 'ASOS DESIGN';
    }

    return 'Unknown';
  }
}

module.exports = ASOSSaleScraper;
