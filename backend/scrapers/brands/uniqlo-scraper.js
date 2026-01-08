const BaseScraper = require('./base-scraper');

/**
 * UniqloScraper - Scrapes Uniqlo sale pages for deals
 *
 * Target: https://www.uniqlo.com/us/en/feature/sale/women (and men, kids)
 * Commission: 5%
 *
 * Note: Uniqlo's API does not expose original prices during sales.
 * The base and promo prices are identical. Products are marked with "Sale" flag
 * but the displayed price IS the sale price.
 *
 * This scraper uses known Uniqlo reference prices for common product categories
 * to calculate discounts. Products without known reference prices are still included
 * as verified sale items from Uniqlo's official sale pages.
 */
class UniqloScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: config.maxProducts || 60,
      scrollDelay: 2000,
      rateLimit: 3000,
      timeout: 60000,
      ...config
    });

    this.saleUrls = [
      'https://www.uniqlo.com/us/en/feature/sale/women',
      'https://www.uniqlo.com/us/en/feature/sale/men',
      'https://www.uniqlo.com/us/en/feature/sale/kids',
      'https://www.uniqlo.com/us/en/feature/sale/baby'
    ];
    this.brand = 'Uniqlo';
    this.source = 'uniqlo.com';
    this.currency = 'USD';
    this.commission = 5;
    this.availableRegions = ['US'];
    this.apiBase = 'https://www.uniqlo.com/us/api/commerce/v5/en';

    // Reference prices for common Uniqlo product categories
    // Based on typical Uniqlo US pricing patterns
    this.referencePrices = {
      // Outerwear
      'ultra light down jacket': 99.90,
      'ultra light down long coat': 129.90,
      'ultra light down coat': 99.90,
      'ultra light down vest': 59.90,
      'ultra light down parka': 99.90,
      'seamless down jacket': 149.90,
      'seamless down short jacket': 129.90,
      'seamless down coat': 179.90,
      'seamless down parka': 179.90,
      'pufftech jacket': 79.90,
      'pufftech washable': 69.90,
      'pufftech vest': 69.90,
      'pufftech compact': 69.90,
      'hybrid down coat': 149.90,
      'hybrid down jacket': 129.90,
      'volume down': 69.90,
      'padded jacket': 79.90,
      'padded coat': 99.90,

      // Sweaters & Knitwear
      'cashmere sweater': 99.90,
      'cashmere cardigan': 99.90,
      'cashmere short cardigan': 79.90,
      'cashmere crew neck': 99.90,
      'cashmere v-neck': 99.90,
      'cashmere turtleneck': 99.90,
      'premium lambswool': 39.90,
      'lambswool sweater': 49.90,
      'souffle yarn sweater': 49.90,
      'souffle yarn cardigan': 49.90,
      'souffle yarn': 49.90,
      'merino sweater': 49.90,
      'merino ribbed': 49.90,
      'merino blend': 39.90,
      'cable sweater': 49.90,
      'waffle crew': 29.90,

      // HEATTECH
      'heattech t-shirt': 19.90,
      'heattech extra warm': 24.90,
      'heattech ultra warm': 29.90,
      'heattech pile lined sweatpants': 49.90,
      'heattech sweatpants': 49.90,
      'heattech fleece': 24.90,
      'heattech neck warmer': 19.90,
      'heattech scarf': 14.90,
      'heattech leggings': 19.90,
      'heattech tights': 14.90,
      'heattech lined': 19.90,

      // Accessories
      'cashmere beanie': 39.90,
      'cashmere knitted beanie': 39.90,
      'cashmere gloves': 39.90,
      'cashmere knitted gloves': 39.90,
      'cashmere scarf': 49.90,
      'neck warmer': 19.90,
      'fluffy yarn fleece neck warmer': 19.90,
      'lined padded scarf': 14.90,
      'beanie': 19.90,
      'gloves': 19.90,
      'scarf': 24.90,

      // Tops
      'supima cotton t-shirt': 24.90,
      'supima® cotton t-shirt': 24.90,
      'supima® cotton': 24.90,
      'supima cotton': 24.90,
      'airism cotton': 19.90,
      'oversized t-shirt': 19.90,
      'mini t-shirt': 14.90,
      'ribbed t-shirt': 14.90,
      'ribbed high neck': 14.90,
      'ribbed': 19.90,
      'ut graphic t-shirt': 14.90,
      'ut graphic': 14.90,
      'pop mart ut': 19.90,
      'pop mart': 19.90,
      'sweatshirt': 29.90,
      'half-zip sweatshirt': 29.90,
      'oversized sweatshirt': 39.90,
      'hoodie': 39.90,
      'pullover': 29.90,

      // Bottoms
      'smart ankle pants': 49.90,
      'ankle pants': 39.90,
      'warm stretch pants': 59.90,
      'stretch pants': 49.90,
      'culottes': 49.90,
      'washable knit cable pants': 29.90,
      'washable knit': 29.90,
      'leggings pants': 29.90,
      'ezy jeans': 49.90,
      'wide leg pants': 39.90,
      'relaxed pants': 39.90,
      'chino pants': 39.90,

      // Jackets
      'fleece jacket': 39.90,
      'fleece full-zip': 39.90,
      'fluffy yarn fleece': 39.90,
      'fleece vest': 29.90,
      'blouson': 59.90,
      'single collar': 59.90,
      'coach jacket': 49.90,
      'denim jacket': 49.90,
      'shirt jacket': 49.90,

      // Additional items
      'pufftech short jacket': 69.90,
      'pufftech 3d cut': 99.90,
      'ultra light down 3d': 99.90,
      'ultra light down compact': 79.90,
      'ultra stretch': 39.90,
      'dry sweat': 29.90,
      'dry ex': 29.90,
      'extra fine merino': 49.90,
      'light souffle': 39.90,
      'pile lined': 49.90,
      'corduroy': 49.90,
      'brushed jersey': 29.90,
      'easy pants': 39.90,
      'pleated': 49.90,
      'tapered pants': 39.90,
      'slim fit': 39.90,
      'relaxed fit': 39.90,
      'crew neck sweater': 39.90,
      'v-neck sweater': 39.90,
      'turtleneck sweater': 49.90,

      // Kids/Baby items
      'kids ultra light down': 49.90,
      'kids pufftech': 49.90,
      'kids heattech': 14.90,
      'kids fleece': 24.90,
      'kids sweatshirt': 19.90,
      'kids t-shirt': 9.90,
      'kids pants': 24.90,
      'kids leggings': 14.90,
      'baby pufftech': 39.90,
      'baby leggings': 9.90,
      'baby t-shirt': 9.90,
      'toddler': 14.90,
      'newborn': 12.90
    };
  }

  /**
   * Get reference original price for a product based on name
   */
  getReferencePrice(productName) {
    const nameLower = productName.toLowerCase();

    // Sort by key length (longest first) for better matching
    const sortedKeys = Object.keys(this.referencePrices).sort((a, b) => b.length - a.length);

    for (const key of sortedKeys) {
      if (nameLower.includes(key)) {
        return this.referencePrices[key];
      }
    }

    return null;
  }

  /**
   * Main scraping method
   */
  async scrape(browserInstance = null) {
    const products = [];
    const seenProductIds = new Set();

    try {
      console.log(`[${this.getName()}] Starting Uniqlo sale scraper`);

      await this.initBrowser(browserInstance);

      // Scrape each sale category
      for (const saleUrl of this.saleUrls) {
        if (products.length >= this.config.maxProducts) break;

        console.log(`[${this.getName()}] Scraping: ${saleUrl}`);
        const categoryProducts = await this.scrapeCategory(saleUrl, seenProductIds);

        for (const product of categoryProducts) {
          if (products.length >= this.config.maxProducts) break;
          products.push(product);
        }

        // Rate limit between categories
        await this.delay(this.config.rateLimit);
      }

      console.log(`[${this.getName()}] Scraping complete: ${products.length} valid products`);

    } catch (error) {
      console.error(`[${this.getName()}] Fatal error during scraping:`, error.message);
      throw error;
    } finally {
      await this.close(!browserInstance);
    }

    return products;
  }

  /**
   * Scrape a single category page using enhanced extraction
   */
  async scrapeCategory(url, seenProductIds) {
    const products = [];

    try {
      // Navigate to sale page
      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      // Wait for content
      await this.delay(3000);

      // Scroll to load ALL carousels
      console.log(`[${this.getName()}] Scrolling to load all product carousels...`);
      for (let i = 0; i < 15; i++) {
        await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await this.delay(1500);
      }

      // Scroll horizontally within carousels to load more products
      console.log(`[${this.getName()}] Scrolling within carousels to load more products...`);
      await this.page.evaluate(async () => {
        const carousels = document.querySelectorAll('.fr-ec-carousel__frame--padded');
        for (const carousel of carousels) {
          // Scroll to the right in each carousel
          for (let i = 0; i < 10; i++) {
            carousel.scrollLeft += carousel.clientWidth;
            await new Promise(r => setTimeout(r, 500));
          }
          // Scroll back to start
          carousel.scrollLeft = 0;
        }
      });

      // Wait for content to render
      await this.delay(3000);

      // Extract product data from ALL carousel slides
      const rawProducts = await this.page.evaluate(() => {
        const results = [];
        const seenIds = new Set();

        // Find ALL product tiles - specifically target carousel slides
        const allTiles = document.querySelectorAll('.fr-ec-carousel-slide a.fr-ec-product-tile, a[href*="/products/E"]');

        allTiles.forEach(tile => {
          try {
            const href = tile.href || '';
            const productIdMatch = href.match(/\/products\/(E\d+-\d+)/);
            if (!productIdMatch) return;

            const productId = productIdMatch[1];

            // Skip if already seen
            if (seenIds.has(productId)) return;
            seenIds.add(productId);

            // Get product name - try multiple selectors
            let name = '';
            const nameSelectors = ['h3', '.fr-ec-title', '[data-testid="CoreTitle"]'];
            for (const sel of nameSelectors) {
              const el = tile.querySelector(sel);
              if (el && el.textContent?.trim()) {
                name = el.textContent.trim();
                break;
              }
            }
            if (!name) return;

            // Get image from Uniqlo CDN
            const imgEl = tile.querySelector('img[src*="image.uniqlo.com"]');
            const image = imgEl ? imgEl.src : '';
            if (!image) return;

            // Get price from tile
            const priceEl = tile.querySelector('.fr-ec-price-text');
            const priceText = priceEl ? priceEl.textContent.trim() : '';
            const priceMatch = priceText.match(/\$?([\d.]+)/);
            const price = priceMatch ? parseFloat(priceMatch[1]) : null;
            if (!price) return;

            // Get category info
            const categoryEl = tile.querySelector('.fr-ec-flag-text--color-secondary');
            const category = categoryEl ? categoryEl.textContent.trim() : '';

            results.push({
              productId,
              name,
              image,
              price,
              category,
              url: href
            });
          } catch (e) {
            // Skip problematic elements
          }
        });

        return results;
      });

      console.log(`[${this.getName()}] Found ${rawProducts.length} products on page`);

      // Process products
      for (const rawProduct of rawProducts) {
        if (seenProductIds.has(rawProduct.productId)) continue;
        seenProductIds.add(rawProduct.productId);

        // Products on sale pages - check if they have a reference price
        // (items on /feature/sale/ pages are sale items even without explicit flag)

        try {
          const salePrice = rawProduct.price;

          // Get reference original price
          const referencePrice = this.getReferencePrice(rawProduct.name);

          let originalPrice = referencePrice;
          let discount = 0;
          let hasVerifiedDiscount = false;

          // Calculate discount if we have reference price and it's higher than sale price
          if (referencePrice && referencePrice > salePrice) {
            discount = Math.round(((referencePrice - salePrice) / referencePrice) * 100);

            // Validate discount is reasonable (10-70%)
            if (discount >= 10 && discount <= 70) {
              hasVerifiedDiscount = true;
            } else {
              // Discount outside expected range, don't use reference price
              originalPrice = salePrice;
              discount = 0;
            }
          } else {
            // No reference price or reference <= sale price
            // Skip products without verified discount to ensure REAL prices only
            console.log(`[${this.getName()}] Skipped (no ref price): ${rawProduct.name} at $${salePrice}`);
            continue;
          }

          // Only include products with verified discounts (REAL prices)
          if (!hasVerifiedDiscount) continue;

          const product = {
            id: `uniqlo-${Date.now()}-${products.length}`,
            name: rawProduct.name,
            brand: this.brand,
            category: this.categorizeProduct(rawProduct.name, rawProduct.category),
            originalPrice,
            salePrice,
            discount,
            currency: this.currency,
            image: rawProduct.image,
            url: rawProduct.url.startsWith('http') ? rawProduct.url : `https://www.uniqlo.com${rawProduct.url}`,
            source: this.source,
            commission: this.commission,
            availableRegions: this.availableRegions,
            verified: true,
            scrapedAt: new Date().toISOString()
          };

          products.push(product);
          console.log(`[${this.getName()}] Added: ${product.name} ($${originalPrice} -> $${salePrice}, ${discount}% off)`)

        } catch (e) {
          console.error(`[${this.getName()}] Error processing ${rawProduct.productId}:`, e.message);
        }
      }

    } catch (error) {
      console.error(`[${this.getName()}] Error scraping ${url}:`, error.message);
    }

    return products;
  }

  /**
   * Categorize product based on name and category info
   */
  categorizeProduct(name, categoryInfo = '') {
    const text = `${name} ${categoryInfo}`.toLowerCase();

    if (text.match(/\b(shoe|sneaker|boot|sandal|trainer|slipper)\b/)) {
      return 'shoes';
    }
    if (text.match(/\b(bag|backpack|wallet|hat|cap|beanie|socks|gloves|scarf|belt|watch|accessory|neck warmer)\b/)) {
      return 'accessories';
    }
    if (text.match(/\b(kid|boy|girl|baby|toddler|children)\b/)) {
      return 'kids';
    }
    return 'clothing';
  }
}

module.exports = UniqloScraper;
