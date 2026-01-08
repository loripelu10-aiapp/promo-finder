const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

/**
 * Macy's Sale Scraper
 *
 * Scrapes sale products from https://www.macys.com/shop/sale
 * Focuses on shoes and clothing with real discounts
 * Extracts: name, original price, sale price, image URL, product URL
 */

class MacysSaleScraper {
  constructor(config = {}) {
    this.config = {
      headless: config.headless !== false,
      timeout: config.timeout || 90000,
      maxProducts: config.maxProducts || 150,
      scrollDelay: config.scrollDelay || 2000,
      userAgent: config.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...config
    };

    this.baseUrl = 'https://www.macys.com';
    this.source = 'macys.com';
    this.currency = 'USD';
    this.browser = null;
    this.page = null;
  }

  /**
   * Initialize Puppeteer browser with anti-detection measures
   */
  async initBrowser() {
    console.log('Launching browser with stealth mode...');

    this.browser = await puppeteer.launch({
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ],
      ignoreHTTPSErrors: true,
      defaultViewport: null
    });

    this.page = await this.browser.newPage();

    // Set extra HTTP headers
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0'
    });

    await this.setupAntiDetection();
  }

  /**
   * Setup anti-detection measures
   */
  async setupAntiDetection() {
    await this.page.setUserAgent(this.config.userAgent);

    await this.page.setViewport({
      width: 1920,
      height: 1080
    });

    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false
      });

      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });

      window.chrome = {
        runtime: {}
      };

      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });
  }

  /**
   * Delay helper
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Random delay to appear more human
   */
  async randomDelay(min = 1000, max = 3000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Scroll to load all products (lazy loading)
   */
  async scrollToLoadProducts(maxScrolls = 20) {
    console.log(`Scrolling to load products (max ${maxScrolls} scrolls)...`);

    let previousHeight = 0;
    let scrollCount = 0;
    let noNewContentCount = 0;

    while (scrollCount < maxScrolls && noNewContentCount < 3) {
      const currentHeight = await this.page.evaluate(() => document.body.scrollHeight);

      if (currentHeight === previousHeight) {
        noNewContentCount++;
        console.log(`No new content (${noNewContentCount}/3)...`);
      } else {
        noNewContentCount = 0;
      }

      // Scroll down
      await this.page.evaluate(() => {
        window.scrollBy(0, window.innerHeight * 0.8);
      });

      await this.delay(this.config.scrollDelay);

      previousHeight = currentHeight;
      scrollCount++;

      // Check product count periodically
      if (scrollCount % 5 === 0) {
        const productCount = await this.page.$$eval('[class*="productThumbnail"], [data-auto="productContainer"], .product-thumbnail', els => els.length).catch(() => 0);
        console.log(`Scroll ${scrollCount}/${maxScrolls} - Products loaded: ${productCount}`);
      }
    }

    console.log(`Scrolling complete after ${scrollCount} scrolls`);
  }

  /**
   * Extract price from text
   */
  extractPrice(priceText) {
    if (!priceText) return null;

    // Remove currency symbols and clean
    const cleaned = priceText.replace(/[$,\s]/g, '').trim();
    const match = cleaned.match(/(\d+\.?\d*)/);
    if (!match) return null;

    const price = parseFloat(match[1]);
    return isNaN(price) ? null : price;
  }

  /**
   * Validate discount is real
   */
  isRealDiscount(originalPrice, salePrice) {
    if (!originalPrice || !salePrice) {
      return { valid: false, reason: 'Missing price data' };
    }

    if (originalPrice <= salePrice) {
      return { valid: false, reason: 'Original price not greater than sale price' };
    }

    const discount = ((originalPrice - salePrice) / originalPrice) * 100;

    if (discount < 5) {
      return { valid: false, reason: 'Discount too small (< 5%)' };
    }

    if (discount > 90) {
      return { valid: false, reason: 'Discount too large (> 90%), likely error' };
    }

    return { valid: true, discount: Math.round(discount) };
  }

  /**
   * Extract brand from product name
   */
  extractBrand(name) {
    const brandPatterns = [
      { pattern: /\bnike\b/i, brand: 'Nike' },
      { pattern: /\badidas\b/i, brand: 'Adidas' },
      { pattern: /\bpuma\b/i, brand: 'Puma' },
      { pattern: /\bnew balance\b/i, brand: 'New Balance' },
      { pattern: /\breebok\b/i, brand: 'Reebok' },
      { pattern: /\bconverse\b/i, brand: 'Converse' },
      { pattern: /\blevis\b|levi's/i, brand: "Levi's" },
      { pattern: /\bcalvin klein\b/i, brand: 'Calvin Klein' },
      { pattern: /\btommy hilfiger\b/i, brand: 'Tommy Hilfiger' },
      { pattern: /\bralph lauren\b/i, brand: 'Ralph Lauren' },
      { pattern: /\bpolo\b/i, brand: 'Polo' },
      { pattern: /\bmichael kors\b/i, brand: 'Michael Kors' },
      { pattern: /\bcoach\b/i, brand: 'Coach' },
      { pattern: /\bdkny\b/i, brand: 'DKNY' },
      { pattern: /\bguess\b/i, brand: 'Guess' },
      { pattern: /\bhugoboss\b|hugo boss/i, brand: 'Hugo Boss' },
      { pattern: /\blacoste\b/i, brand: 'Lacoste' },
      { pattern: /\bsteve madden\b/i, brand: 'Steve Madden' },
      { pattern: /\bclarks\b/i, brand: 'Clarks' },
      { pattern: /\btahari\b/i, brand: 'Tahari' },
      { pattern: /\bbar iii\b/i, brand: 'Bar III' },
      { pattern: /\balfani\b/i, brand: 'Alfani' },
      { pattern: /\bcharter club\b/i, brand: 'Charter Club' },
      { pattern: /\binc\b/i, brand: 'INC' },
      { pattern: /\bjm collection\b/i, brand: 'JM Collection' },
      { pattern: /\bkaren scott\b/i, brand: 'Karen Scott' },
      { pattern: /\bstyle & co\b/i, brand: 'Style & Co' },
      { pattern: /\btasso elba\b/i, brand: 'Tasso Elba' },
      { pattern: /\bclub room\b/i, brand: 'Club Room' },
      { pattern: /\bholiday lane\b/i, brand: 'Holiday Lane' }
    ];

    for (const { pattern, brand } of brandPatterns) {
      if (pattern.test(name)) {
        return brand;
      }
    }

    // Try to extract first word as brand
    const parts = name.split(' ');
    if (parts.length > 0 && parts[0].length > 1) {
      return parts[0];
    }

    return 'Unknown';
  }

  /**
   * Categorize product
   */
  categorizeProduct(name) {
    const lower = name.toLowerCase();

    if (lower.match(/\b(shoe|boot|sandal|heel|pump|loafer|sneaker|flat|slipper|mule|oxford|wedge|espadrille)\b/)) {
      return 'shoes';
    }
    if (lower.match(/\b(dress|gown|romper|jumpsuit)\b/)) {
      return 'dresses';
    }
    if (lower.match(/\b(shirt|blouse|top|tee|tank|cami|sweater|cardigan|hoodie|sweatshirt|jacket|coat|blazer|vest)\b/)) {
      return 'tops';
    }
    if (lower.match(/\b(pant|jean|short|skirt|legging|trouser)\b/)) {
      return 'bottoms';
    }
    if (lower.match(/\b(bag|purse|handbag|tote|backpack|clutch|wallet|belt|scarf|hat|watch|jewelry|bracelet|necklace|earring)\b/)) {
      return 'accessories';
    }
    if (lower.match(/\b(bra|underwear|panty|boxer|brief|pajama|robe|sleepwear|lingerie)\b/)) {
      return 'intimates';
    }

    return 'clothing';
  }

  /**
   * Close modal popups
   */
  async closeModals() {
    try {
      // Close international shipping modal
      const modalCloseSelectors = [
        'button[class*="close"]',
        '[aria-label="Close"]',
        '[class*="modal"] button',
        '.modal-close',
        '[data-dismiss="modal"]',
        'button:has-text("Continue shopping")',
        'button:has-text("Continue")',
        '[class*="CloseButton"]'
      ];

      for (const selector of modalCloseSelectors) {
        try {
          const buttons = await this.page.$$(selector);
          for (const btn of buttons) {
            const isVisible = await btn.isVisible().catch(() => false);
            if (isVisible) {
              await btn.click();
              console.log(`Closed modal with selector: ${selector}`);
              await this.delay(500);
            }
          }
        } catch (e) {}
      }

      // Try clicking "Continue shopping" button specifically
      await this.page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent.includes('Continue shopping') || btn.textContent.includes('Continue')) {
            btn.click();
            return true;
          }
        }
        return false;
      });

      await this.delay(500);
    } catch (e) {
      // Ignore modal closing errors
    }
  }

  /**
   * Scrape a single category page
   */
  async scrapeCategory(url, categoryName) {
    const products = [];
    console.log(`\n--- Scraping ${categoryName} ---`);
    console.log(`URL: ${url}`);

    try {
      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      await this.delay(3000);

      // Close any modal popups (like international shipping notice)
      await this.closeModals();

      // Wait for products to load
      await this.page.waitForSelector('ul[class*="product"], [class*="productThumbnail"], [data-auto="productThumbnailContainer"]', { timeout: 15000 }).catch(() => {});

      // Scroll to load products - more scrolls to load more products
      await this.scrollToLoadProducts(25);

      // Wait for images to load
      await this.delay(2000);

      // Debug screenshot
      const screenshotPath = `/tmp/macys-${categoryName.replace(/\s+/g, '-').toLowerCase()}-debug.png`;
      await this.page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`Screenshot saved to ${screenshotPath}`);

      // Get page HTML for debugging
      const pageHTML = await this.page.content();
      console.log(`Page HTML length: ${pageHTML.length}`);

      // Extract products using multiple strategies
      const scrapedProducts = await this.page.evaluate(() => {
        const results = [];
        const seen = new Set();

        // Find all product links - Macy's uses /shop/product/ URLs
        const allProductLinks = document.querySelectorAll('a[href*="/shop/product/"]');
        console.log(`Found ${allProductLinks.length} product links`);

        // Get unique product containers by finding parent elements
        const productMap = new Map();

        allProductLinks.forEach(link => {
          const url = link.href;
          if (!url || productMap.has(url)) return;

          // Find the closest container that contains the full product info
          // Usually a li element or a div with product class
          let container = link.closest('li') ||
                         link.closest('[class*="productThumbnail"]') ||
                         link.closest('[class*="cell"]') ||
                         link.parentElement?.parentElement?.parentElement;

          if (container) {
            productMap.set(url, { container, link, url });
          }
        });

        console.log(`Processing ${productMap.size} unique products`);

        productMap.forEach(({ container, link, url }, key) => {
          try {
            if (seen.has(url)) return;
            seen.add(url);

            const containerText = container.textContent || '';

            // CRITICAL: Only process products that show a discount percentage
            // Look for "(XX% off)" pattern which indicates a real sale
            const discountMatch = containerText.match(/\((\d+)%\s*off\)/i);
            if (!discountMatch) {
              // No discount shown - skip this product
              return;
            }

            // Parse product name from URL
            let name = '';
            let brand = '';

            const urlMatch = url.match(/\/shop\/product\/([^?]+)/);
            if (urlMatch) {
              const slug = urlMatch[1];
              name = slug.split('-').map(word => {
                if (word.toLowerCase() === 'pc') return 'Pc.';
                if (word.toLowerCase() === 'qt') return 'Qt.';
                if (word.toLowerCase() === 'oz') return 'Oz.';
                return word.charAt(0).toUpperCase() + word.slice(1);
              }).join(' ');
            }

            // Common Macy's brands
            const knownBrands = [
              'Calvin Klein', 'Tommy Hilfiger', 'Ralph Lauren', 'Polo Ralph Lauren',
              'Michael Kors', 'Coach', 'DKNY', 'Steve Madden', 'Cole Haan',
              'Nike', 'Adidas', 'Puma', 'New Balance', 'UGG', 'Clarks',
              'Charter Club', 'Alfani', 'INC', 'Karen Scott', 'Style Co',
              'Club Room', 'Bar III', 'Tasso Elba', 'JM Collection',
              'Lauren Ralph Lauren', 'Guess', 'Lacoste', 'Nautica', 'London Fog',
              'Weatherproof', 'Rockport', 'Lucky Brand', 'Aerosoles', 'Cuisinart',
              'Pyrex', 'Eddie Bauer', 'Wacoal', 'Vanity Fair', 'Jockey', 'Hanes',
              'Lands End', 'Cupshe', 'Ted Baker', 'Staheekum', 'Madden Men',
              'Shiseido', 'Lancome', 'Dior', 'Chanel', 'Jo Malone', 'Chloe',
              'Valentino', 'Bobbi Brown', 'Kate Somerville', 'Lab Series',
              'Borghese', 'Pattern', 'Puleo', 'Sedona', 'Nestl', 'Ienjoy',
              'Florsheim', 'Dockers', 'ALDO', 'Naturalizer', 'Bali', 'Sunham',
              'Tag', 'Serene', 'Brookline', 'Aerosoles', 'Michael Michael Kors',
              'Macy\'s', 'Macys'
            ];

            // Try to match brand from name
            for (const b of knownBrands) {
              const bLower = b.toLowerCase().replace(/['\s]/g, '');
              const nameLower = name.toLowerCase().replace(/['\s]/g, '');
              if (nameLower.includes(bLower)) {
                brand = b;
                break;
              }
            }

            // If no known brand, try to extract from beginning
            if (!brand && name) {
              const words = name.split(' ');
              const genericWords = ['Men', 'Women', 'Womens', 'Mens', 'Kids', 'Boys', 'Girls', 'The', 'A', 'An', 'Unisex'];
              if (words.length > 0 && !genericWords.includes(words[0])) {
                brand = words[0];
                // Check for two-word brands
                if (words.length > 1 && !genericWords.includes(words[1])) {
                  brand = `${words[0]} ${words[1]}`;
                }
              }
            }

            if (!name || name.length < 5) return;

            // Extract image - look for actual product images
            let image = '';
            const imgs = container.querySelectorAll('img');
            for (const img of imgs) {
              const src = img.src || img.dataset?.src || '';
              if (src && (src.includes('slimages.macysassets') || src.includes('images.macys')) &&
                  !src.includes('badge') && !src.includes('icon')) {
                image = src;
                break;
              }
            }

            // Extract prices
            let salePrice = null;
            let originalPrice = null;

            // Pattern 1: "$XX.XX (XX% off)" - this IS the sale price
            const salePriceMatch = containerText.match(/\$\s*([\d,.]+)\s*\(\d+%\s*off\)/i);
            if (salePriceMatch) {
              salePrice = parseFloat(salePriceMatch[1].replace(/,/g, ''));
            }

            // Pattern 2: Find crossed out/original price - appears after the sale price
            // Usually formatted as just "$YY.YY" or "Was $YY.YY"
            const allPrices = containerText.match(/\$\s*([\d,.]+)/g);
            if (allPrices && allPrices.length >= 1) {
              const prices = allPrices.map(p => parseFloat(p.replace(/[$,\s]/g, '')))
                                      .filter(p => !isNaN(p) && p > 0 && p < 10000);

              if (prices.length >= 2) {
                const uniquePrices = [...new Set(prices)].sort((a, b) => a - b);
                if (!salePrice) salePrice = uniquePrices[0];
                // Original price is typically the highest
                originalPrice = uniquePrices[uniquePrices.length - 1];
              }
            }

            // Only add if we have valid prices and a real discount
            if (name && url && salePrice && originalPrice && salePrice < originalPrice) {
              results.push({
                name: name.substring(0, 200).trim(),
                brand: brand || '',
                url,
                image,
                salePrice,
                originalPrice,
                index: results.length
              });
            }
          } catch (error) {
            // Continue to next product
          }
        });

        return results;
      });

      console.log(`Extracted ${scrapedProducts.length} products from ${categoryName}`);

      // Process products
      for (const rawProduct of scrapedProducts) {
        const discountCheck = this.isRealDiscount(rawProduct.originalPrice, rawProduct.salePrice);
        if (!discountCheck.valid) {
          console.log(`Rejected: ${rawProduct.name.substring(0, 40)}... - ${discountCheck.reason}`);
          continue;
        }

        const brand = rawProduct.brand || this.extractBrand(rawProduct.name);

        products.push({
          name: rawProduct.name,
          brand: brand,
          originalPrice: rawProduct.originalPrice,
          salePrice: rawProduct.salePrice,
          discount: discountCheck.discount,
          currency: this.currency,
          image: rawProduct.image,
          url: rawProduct.url,
          category: this.categorizeProduct(rawProduct.name),
          source: this.source
        });

        console.log(`Added: ${rawProduct.name.substring(0, 50)}... (${discountCheck.discount}% off)`);
      }

    } catch (error) {
      console.error(`Error scraping ${categoryName}:`, error.message);
    }

    return products;
  }

  /**
   * Main scraping method
   */
  async scrape() {
    const allProducts = [];
    const seenUrls = new Set();

    try {
      console.log('='.repeat(60));
      console.log("Macy's Sale Scraper");
      console.log('Target: https://www.macys.com/shop/sale');
      console.log('Focus: Shoes and Clothing');
      console.log('='.repeat(60));

      await this.initBrowser();

      // Define category URLs for shoes and clothing - using specific sale category pages
      const categories = [
        { name: 'Women Shoes Sale', url: 'https://www.macys.com/shop/sale/shoes/womens-shoes?id=26425&perpage=120' },
        { name: 'Men Shoes Sale', url: 'https://www.macys.com/shop/sale/shoes/mens-shoes?id=55822&perpage=120' },
        { name: 'Women Coats Sale', url: 'https://www.macys.com/shop/sale/womens-clothing/coats-jackets-vests?id=269&perpage=120' },
        { name: 'Women Dresses Sale', url: 'https://www.macys.com/shop/sale/womens-clothing/dresses?id=5449&perpage=120' },
        { name: 'Men Coats Sale', url: 'https://www.macys.com/shop/sale/mens-clothing/coats-jackets?id=3763&perpage=120' },
        { name: 'Men Suits Sale', url: 'https://www.macys.com/shop/sale/mens-clothing/suits-sport-coats?id=17788&perpage=120' },
        { name: 'Women Tops Sale', url: 'https://www.macys.com/shop/sale/womens-clothing/tops?id=255&perpage=120' },
        { name: 'Men Shirts Sale', url: 'https://www.macys.com/shop/sale/mens-clothing/shirts?id=20627&perpage=120' }
      ];

      for (const category of categories) {
        if (allProducts.length >= this.config.maxProducts) {
          console.log(`Reached target of ${this.config.maxProducts} products`);
          break;
        }

        const products = await this.scrapeCategory(category.url, category.name);

        // Add unique products
        for (const product of products) {
          if (!seenUrls.has(product.url) && allProducts.length < this.config.maxProducts) {
            seenUrls.add(product.url);
            allProducts.push(product);
          }
        }

        console.log(`Total unique products so far: ${allProducts.length}`);

        // Random delay between categories
        await this.randomDelay(2000, 4000);
      }

      console.log(`\nScraping complete: ${allProducts.length} unique products`);

    } catch (error) {
      console.error('Fatal error during scraping:', error.message);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }

    return allProducts;
  }
}

// Run the scraper
async function main() {
  const scraper = new MacysSaleScraper({
    headless: true,
    maxProducts: 150
  });

  try {
    const products = await scraper.scrape();

    console.log('\n' + '='.repeat(60));
    console.log(`RESULTS: ${products.length} products scraped`);
    console.log('='.repeat(60));

    if (products.length > 0) {
      // Save to JSON file
      const outputPath = '/tmp/macys-products.json';
      fs.writeFileSync(outputPath, JSON.stringify(products, null, 2));
      console.log(`\nOutput saved to: ${outputPath}`);

      // Print summary
      console.log('\n--- PRODUCT SUMMARY ---');
      const brands = {};
      const categories = {};
      let totalDiscount = 0;

      products.forEach(p => {
        brands[p.brand] = (brands[p.brand] || 0) + 1;
        categories[p.category] = (categories[p.category] || 0) + 1;
        totalDiscount += p.discount;
      });

      console.log('\nTop Brands:');
      Object.entries(brands)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([brand, count]) => {
          console.log(`  ${brand}: ${count} products`);
        });

      console.log('\nCategories:');
      Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .forEach(([category, count]) => {
          console.log(`  ${category}: ${count} products`);
        });

      console.log(`\nAverage discount: ${Math.round(totalDiscount / products.length)}%`);
      console.log(`Price range: $${Math.min(...products.map(p => p.salePrice)).toFixed(2)} - $${Math.max(...products.map(p => p.salePrice)).toFixed(2)}`);

      // Show sample products
      console.log('\n--- SAMPLE PRODUCTS ---');
      products.slice(0, 5).forEach((p, i) => {
        console.log(`\n${i + 1}. ${p.name}`);
        console.log(`   Brand: ${p.brand}`);
        console.log(`   Price: $${p.salePrice} (was $${p.originalPrice}) - ${p.discount}% OFF`);
        console.log(`   Category: ${p.category}`);
        console.log(`   Image: ${p.image ? p.image.substring(0, 80) + '...' : 'N/A'}`);
        console.log(`   URL: ${p.url.substring(0, 80)}...`);
      });

    } else {
      console.log("No products were scraped. The website structure may have changed.");
      fs.writeFileSync('/tmp/macys-products.json', JSON.stringify([], null, 2));
    }

  } catch (error) {
    console.error('Scraper failed:', error.message);
    fs.writeFileSync('/tmp/macys-products.json', JSON.stringify({ error: error.message }, null, 2));
    process.exit(1);
  }
}

main();
