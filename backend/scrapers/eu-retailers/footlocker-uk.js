const BaseScraper = require('../brands/base-scraper');

/**
 * Foot Locker UK Scraper - EU Accessible
 *
 * Scrapes Foot Locker UK for Nike and Adidas deals
 * Available in: UK, EU (no GDPR blocking)
 * Currency: GBP (£)
 */
class FootLockerUKScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: 50,
      scrollDelay: 3000,
      rateLimit: 3000,
      timeout: 60000,
      ...config
    });

    this.source = 'footlocker.co.uk';
    this.currency = 'GBP';
    this.availableRegions = ['EU', 'UK']; // Tagged for EU/UK users
  }

  /**
   * Default scrape method - searches for Nike and Adidas
   */
  async scrape() {
    const nikeProducts = await this.searchBrand('nike', 'trainers');
    const adidasProducts = await this.searchBrand('adidas', 'trainers');
    return [...nikeProducts, ...adidasProducts];
  }

  /**
   * Search for brand deals on Foot Locker UK
   */
  async searchBrand(brand = 'adidas', category = 'trainers') {
    console.log(`\n🔍 [FootLocker UK] Searching for ${brand} ${category}...`);

    const products = [];

    // Foot Locker UK search URL
    const searchUrl = `https://www.footlocker.co.uk/en/search?query=${brand}%20${category}%20sale`;

    try {
      await this.initBrowser();

      console.log(`📄 Loading: ${searchUrl}`);

      await this.page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      console.log('📄 Page loaded, waiting for products...');

      // Wait for JavaScript to render
      await this.delay(8000);

      // Take debug screenshot
      await this.page.screenshot({ path: '/tmp/footlocker-uk-debug.png' });
      console.log('📸 Debug screenshot: /tmp/footlocker-uk-debug.png');

      // Check page title
      const pageTitle = await this.page.title();
      console.log(`📄 Page title: ${pageTitle}`);

      // Try multiple product selectors
      const productSelectors = [
        'a[href*="/product/"]',  // Primary: product links (works!)
        '[data-testid="product-card"]',
        '.ProductCard',
        '[class*="ProductCard"]',
        'article[data-product-id]',
        'div[class*="product-tile"]',
        '.product-grid__item',
        '[class*="ProductTile"]'
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
        console.log('💡 Check /tmp/footlocker-uk-debug.png to identify correct selectors');
        return products;
      }

      // Scroll to load more
      await this.scrollToLoadProducts(2);

      // Extract products
      const scrapedProducts = await this.page.evaluate((selector, searchBrand) => {
        const cards = document.querySelectorAll(selector);
        const results = [];

        cards.forEach(card => {
          try {
            // If selector is a link, the card IS the link
            const link = card.tagName === 'A' ? card : card.querySelector('a[href*="/product"]') || card.querySelector('a');
            if (!link) return;

            const url = link.href;
            if (!url || !url.includes('footlocker.co.uk')) return;

            // Get MAIN product image (not badges/overlays)
            // Try multiple strategies to find the real product image
            let img = null;

            // Strategy 1: Look for images with specific data attributes
            img = link.querySelector('img[data-src]') ||
                  link.querySelector('img[data-lazy-src]') ||
                  card.querySelector('img[data-src]') ||
                  card.querySelector('img[data-lazy-src]');

            // Strategy 2: Get all images and filter out badges
            if (!img) {
              const allImages = Array.from(link.querySelectorAll('img'));
              img = allImages.find(i => {
                const src = i.src || i.dataset.src || '';
                // Reject badges, icons, small images
                return !src.includes('badge') &&
                       !src.includes('icon') &&
                       !src.includes('logo') &&
                       !src.includes('exclusive') &&
                       !src.includes('crobox.io') &&
                       !src.includes('100x');
              });
            }

            // Strategy 3: Fallback to first img if still nothing
            if (!img) {
              img = link.querySelector('img') || card.querySelector('img');
            }

            // Get full text content from link (Foot Locker puts all data in link)
            const fullText = link.textContent || link.innerText || '';

            // Extract clean product name - Foot Locker embeds everything in the text
            // Pattern: "Save £XXNike Product NameMen/Women ShoeColorThis item is on sale..."
            // We need to extract just "Nike Product Name"

            let name = null;

            // Try to find product name in aria-label first (cleaner)
            const ariaLabel = link.getAttribute('aria-label') || (img ? img.getAttribute('alt') : null);
            if (ariaLabel && ariaLabel.toLowerCase().includes(searchBrand.toLowerCase())) {
              name = ariaLabel.trim();
            } else {
              // Fallback: parse the messy text
              // Remove common noise patterns
              let cleanText = fullText
                .replace(/Save £[\d.]+/gi, '') // Remove "Save £XX"
                .replace(/This item is on sale.*$/gi, '') // Remove sale text
                .replace(/Price dropped from.*$/gi, '') // Remove price drop text
                .replace(/£\s*[\d.,]+/g, '') // Remove all prices
                .replace(/\s{2,}/g, ' ') // Collapse multiple spaces
                .trim();

              // Split into words and find brand name position
              const words = cleanText.split(/\s+/);
              const brandIndex = words.findIndex(w => w.toLowerCase() === searchBrand.toLowerCase());

              if (brandIndex >= 0) {
                // Take brand name + next 2-4 words as product name
                const productWords = words.slice(brandIndex, Math.min(brandIndex + 4, words.length));

                // Stop at category keywords
                const stopWords = ['men', 'women', 'unisex', 'kids', 'junior', 'shoes', 'trainers', 'boots'];
                const endIndex = productWords.findIndex((w, i) => i > 0 && stopWords.includes(w.toLowerCase()));

                if (endIndex > 0) {
                  name = productWords.slice(0, endIndex).join(' ');
                } else {
                  name = productWords.join(' ');
                }
              }
            }

            if (!name || !name.toLowerCase().includes(searchBrand.toLowerCase())) {
              return;
            }

            // Find prices in the text (look for £ symbol)
            const priceMatches = fullText.match(/£\s*[\d,.]+/g);
            let salePrice = null;
            let originalPrice = null;

            if (priceMatches && priceMatches.length >= 1) {
              salePrice = priceMatches[0];
              if (priceMatches.length >= 2) {
                originalPrice = priceMatches[1];
              }
            }

            // Get image URL (img already defined above)
            const image = img ? (img.src || img.dataset.src || img.getAttribute('data-lazy-src')) : null;

            // STRICT: Only add if we have ALL required data INCLUDING a real image
            if (name && url && salePrice && image && image.startsWith('http')) {
              results.push({
                name,
                url,
                image: image, // MUST have real image, no fallback
                originalPrice,
                salePrice
              });
            }
          } catch (e) {
            // Skip failed products
          }
        });

        return results;
      }, workingSelector, brand);

      console.log(`📦 Extracted ${scrapedProducts.length} ${brand} products from Foot Locker UK`);

      // Process and validate
      for (const rawProduct of scrapedProducts) {
        if (products.length >= this.config.maxProducts) break;

        try {
          const salePrice = this.extractPrice(rawProduct.salePrice);
          const originalPrice = rawProduct.originalPrice ? this.extractPrice(rawProduct.originalPrice) : null;

          if (!salePrice || salePrice <= 0) {
            console.log(`⚠️  Invalid sale price for "${rawProduct.name}"`);
            continue;
          }

          // Validate discount if we have both prices
          let discount = 20; // Default for clearance items
          let validatedOriginalPrice = originalPrice;

          if (originalPrice) {
            const discountCheck = this.isRealDiscount(originalPrice, salePrice);
            if (!discountCheck.valid) {
              console.log(`⚠️  Rejected "${rawProduct.name}": ${discountCheck.reason}`);
              continue;
            }
            discount = discountCheck.discount;
          } else {
            // Estimate original price conservatively
            validatedOriginalPrice = salePrice * 1.25; // 20% discount estimate
          }

          const product = {
            id: `footlocker-uk-${Date.now()}-${products.length}`,
            name: rawProduct.name,
            brand: brand,
            category: this.categorizeProduct(rawProduct.name),
            originalPrice: validatedOriginalPrice,
            salePrice,
            discount,
            currency: this.currency,
            image: rawProduct.image,
            url: rawProduct.url,
            source: this.source,
            availableRegions: this.availableRegions, // EU, UK only
            verified: false,
            scrapedAt: new Date().toISOString()
          };

          products.push(product);
          console.log(`✅ Added: ${product.name} (${product.discount}% off, £${product.salePrice})`);

        } catch (error) {
          console.error(`❌ Error processing product:`, error.message);
        }
      }

      console.log(`\n🎉 Foot Locker UK scraping complete: ${products.length} ${brand} products`);
      console.log(`🌍 Region: ${this.availableRegions.join(', ')}`);
      console.log(`💰 Currency: ${this.currency}\n`);

    } catch (error) {
      console.error(`❌ Foot Locker UK error:`, error.message);
    } finally {
      await this.close();
    }

    return products;
  }

  /**
   * Categorize product based on name
   */
  categorizeProduct(name) {
    const nameLower = name.toLowerCase();

    if (nameLower.includes('shoe') || nameLower.includes('trainer') ||
        nameLower.includes('sneaker') || nameLower.includes('boot')) {
      return 'shoes';
    }
    if (nameLower.includes('hoodie') || nameLower.includes('jacket') ||
        nameLower.includes('shirt') || nameLower.includes('tee')) {
      return 'clothing';
    }
    if (nameLower.includes('bag') || nameLower.includes('backpack')) {
      return 'bags';
    }

    return 'other';
  }
}

module.exports = FootLockerUKScraper;
