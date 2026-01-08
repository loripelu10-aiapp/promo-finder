#!/usr/bin/env node

/**
 * Urban Outfitters API Scraper
 *
 * Uses Urban Outfitters internal API endpoints to fetch sale products
 * This bypasses the PerimeterX protection on the frontend
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

class UrbanOutfittersAPIScraper {
  constructor(config = {}) {
    this.brand = 'Urban Outfitters';
    this.source = 'urbanoutfitters.com';
    this.currency = 'USD';
    this.commission = 5;
    this.maxProducts = config.maxProducts || 60;
    this.browser = null;
    this.page = null;
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080'
      ]
    });

    this.page = await this.browser.newPage();

    await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await this.page.setExtraHTTPHeaders({
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Origin': 'https://www.urbanoutfitters.com',
      'Referer': 'https://www.urbanoutfitters.com/sale'
    });

    // Override webdriver detection
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.chrome = { runtime: {} };
    });
  }

  async scrape() {
    const products = [];
    const capturedProducts = [];

    try {
      console.log('Starting Urban Outfitters API scrape...');

      await this.init();

      // Set up request interception to capture API calls
      await this.page.setRequestInterception(true);

      this.page.on('request', request => {
        request.continue();
      });

      // Capture API responses
      this.page.on('response', async response => {
        const url = response.url();

        // Look for product API endpoints
        if (url.includes('/api/') || url.includes('products') || url.includes('search') || url.includes('plp')) {
          try {
            const contentType = response.headers()['content-type'] || '';
            if (contentType.includes('json')) {
              const data = await response.json().catch(() => null);
              if (data) {
                console.log(`Captured API response from: ${url.substring(0, 80)}...`);
                capturedProducts.push({ url, data });
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      });

      // Try to access the page and capture API calls
      console.log('Navigating to sale page to capture API calls...');

      try {
        await this.page.goto('https://www.urbanoutfitters.com/sale', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
      } catch (e) {
        console.log('Initial page load issue, continuing to check for API data...');
      }

      // Wait for potential API calls
      await new Promise(r => setTimeout(r, 5000));

      console.log(`Captured ${capturedProducts.length} API responses`);

      // Process captured API data
      for (const captured of capturedProducts) {
        const extractedProducts = this.extractProductsFromAPIResponse(captured.data);
        products.push(...extractedProducts);
      }

      // If no products captured via API, try direct API call
      if (products.length === 0) {
        console.log('Trying direct API endpoints...');
        const apiProducts = await this.tryDirectAPIEndpoints();
        products.push(...apiProducts);
      }

      console.log(`Total products extracted: ${products.length}`);

      // If still no products, use fallback with sample data structure
      if (products.length === 0) {
        console.log('Using web scraping fallback approach...');
        const fallbackProducts = await this.scrapeFallback();
        products.push(...fallbackProducts);
      }

      return products.slice(0, this.maxProducts);

    } catch (error) {
      console.error('Scrape error:', error.message);
      return products;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  extractProductsFromAPIResponse(data) {
    const products = [];

    if (!data) return products;

    // Try to find products in various data structures
    const findProducts = (obj, depth = 0) => {
      if (depth > 5 || !obj) return;

      if (Array.isArray(obj)) {
        for (const item of obj) {
          if (this.isProductObject(item)) {
            const product = this.normalizeProduct(item);
            if (product) products.push(product);
          }
          findProducts(item, depth + 1);
        }
      } else if (typeof obj === 'object') {
        if (this.isProductObject(obj)) {
          const product = this.normalizeProduct(obj);
          if (product) products.push(product);
        }

        for (const value of Object.values(obj)) {
          findProducts(value, depth + 1);
        }
      }
    };

    findProducts(data);
    return products;
  }

  isProductObject(obj) {
    if (!obj || typeof obj !== 'object') return false;

    // Check for product-like properties
    const hasName = obj.name || obj.title || obj.productName || obj.displayName;
    const hasPrice = obj.price || obj.salePrice || obj.currentPrice || obj.listPrice;
    const hasUrl = obj.url || obj.pdpUrl || obj.productUrl || obj.href;

    return hasName && (hasPrice || hasUrl);
  }

  normalizeProduct(raw) {
    try {
      const name = raw.name || raw.title || raw.productName || raw.displayName || '';
      if (!name) return null;

      // Extract prices
      let originalPrice = null;
      let salePrice = null;

      if (raw.price) {
        if (typeof raw.price === 'object') {
          originalPrice = raw.price.list || raw.price.original || raw.price.was;
          salePrice = raw.price.sale || raw.price.current || raw.price.now;
        } else {
          salePrice = parseFloat(raw.price);
        }
      }

      originalPrice = originalPrice || raw.listPrice || raw.originalPrice || raw.wasPrice;
      salePrice = salePrice || raw.salePrice || raw.currentPrice || raw.nowPrice;

      // Parse price values
      if (typeof originalPrice === 'string') {
        originalPrice = parseFloat(originalPrice.replace(/[$,]/g, ''));
      }
      if (typeof salePrice === 'string') {
        salePrice = parseFloat(salePrice.replace(/[$,]/g, ''));
      }

      // Skip if no sale price
      if (!salePrice) return null;

      // Use salePrice as original if no original found
      if (!originalPrice) originalPrice = salePrice;

      // Skip if no discount
      if (originalPrice <= salePrice) return null;

      const discount = Math.round(((originalPrice - salePrice) / originalPrice) * 100);

      // Validate discount
      if (discount < 10 || discount > 70) return null;

      // Extract image
      let image = '';
      if (raw.image) {
        image = typeof raw.image === 'string' ? raw.image : (raw.image.url || raw.image.src || '');
      }
      image = image || raw.imageUrl || raw.thumbnail || raw.primaryImage || '';

      // Ensure image is from UO CDN
      if (image && !image.startsWith('http')) {
        image = 'https://images.urbanoutfitters.com' + image;
      }

      // Extract URL
      let url = raw.url || raw.pdpUrl || raw.productUrl || raw.href || '';
      if (url && !url.startsWith('http')) {
        url = 'https://www.urbanoutfitters.com' + url;
      }

      return {
        name,
        brand: this.brand,
        originalPrice,
        salePrice,
        discount,
        currency: this.currency,
        image,
        url,
        category: this.categorizeProduct(name)
      };

    } catch (error) {
      return null;
    }
  }

  async tryDirectAPIEndpoints() {
    const products = [];

    // Known UO API endpoints to try
    const endpoints = [
      'https://www.urbanoutfitters.com/api/urbn/v1/plp/sale?limit=60&offset=0',
      'https://www.urbanoutfitters.com/api/catalog/products?category=sale&limit=60',
      'https://www.urbanoutfitters.com/gateway/api/sale-products'
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`Trying endpoint: ${endpoint}`);

        const response = await this.page.evaluate(async (url) => {
          try {
            const res = await fetch(url, {
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              },
              credentials: 'include'
            });
            if (res.ok) {
              return await res.json();
            }
          } catch (e) {
            return null;
          }
          return null;
        }, endpoint);

        if (response) {
          console.log(`Got response from ${endpoint}`);
          const extracted = this.extractProductsFromAPIResponse(response);
          products.push(...extracted);

          if (products.length >= this.maxProducts) break;
        }
      } catch (error) {
        console.log(`Endpoint ${endpoint} failed: ${error.message}`);
      }
    }

    return products;
  }

  async scrapeFallback() {
    // Since the site is protected, we'll try one more approach:
    // Use a cached/static approach based on known product structure
    console.log('Bot protection detected - attempting alternative approach...');

    // Try accessing through mobile user agent
    await this.page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');

    try {
      await this.page.goto('https://www.urbanoutfitters.com/sale', {
        waitUntil: 'networkidle0',
        timeout: 45000
      });

      // Wait longer for content
      await new Promise(r => setTimeout(r, 8000));

      const pageTitle = await this.page.title();
      console.log('Page title:', pageTitle);

      if (pageTitle.toLowerCase().includes('denied') || pageTitle.toLowerCase().includes('captcha')) {
        console.log('Still blocked by bot protection');
        return [];
      }

      // Try to extract products
      const products = await this.page.evaluate(() => {
        const results = [];

        // Try various selectors
        const cards = document.querySelectorAll('[class*="product"], [class*="tile"], article');

        cards.forEach((card, index) => {
          try {
            const link = card.querySelector('a[href*="/product/"], a[href*="/shop/"]');
            const img = card.querySelector('img');
            const priceElements = card.querySelectorAll('[class*="price"]');

            if (link && img) {
              const name = card.textContent.split('$')[0].trim().split('\n').filter(s => s.trim()).join(' ');

              results.push({
                name: name || `Product ${index + 1}`,
                url: link.href,
                image: img.src || img.dataset.src,
                priceText: Array.from(priceElements).map(el => el.textContent).join(' ')
              });
            }
          } catch (e) { }
        });

        return results;
      });

      return products.map((p, i) => ({
        name: p.name,
        brand: 'Urban Outfitters',
        originalPrice: 0,
        salePrice: 0,
        discount: 0,
        currency: 'USD',
        image: p.image,
        url: p.url,
        category: 'clothing'
      })).filter(p => p.name && p.url);

    } catch (error) {
      console.log('Fallback scrape failed:', error.message);
      return [];
    }
  }

  categorizeProduct(name) {
    const lower = (name || '').toLowerCase();

    if (lower.match(/\b(dress|skirt|romper|jumpsuit)\b/)) return 'dresses';
    if (lower.match(/\b(top|shirt|blouse|tee|tank|crop|bodysuit|sweater|cardigan|hoodie|sweatshirt|jacket|coat|blazer)\b/)) return 'tops';
    if (lower.match(/\b(jeans|pants|trousers|leggings|shorts|joggers)\b/)) return 'bottoms';
    if (lower.match(/\b(shoe|sneaker|boot|sandal|heel|flat|loafer|mule|slipper)\b/)) return 'shoes';
    if (lower.match(/\b(bag|purse|backpack|tote|clutch|wallet|belt|hat|cap|beanie|scarf|sunglasses|jewelry|necklace|earring|bracelet|ring)\b/)) return 'accessories';
    if (lower.match(/\b(bra|underwear|panty|lingerie|pajama|robe|swimsuit|bikini|swim)\b/)) return 'intimates';
    if (lower.match(/\b(home|pillow|blanket|candle|decor|frame|plant|mug|dish|furniture)\b/)) return 'home';
    if (lower.match(/\b(vinyl|record|book|game|poster|art)\b/)) return 'lifestyle';

    return 'clothing';
  }
}

// Run the scraper
async function main() {
  console.log('='.repeat(60));
  console.log('Urban Outfitters Sale Scraper (API Mode)');
  console.log('='.repeat(60));
  console.log('');

  const scraper = new UrbanOutfittersAPIScraper({ maxProducts: 60 });

  try {
    const products = await scraper.scrape();

    console.log('');
    console.log('='.repeat(60));
    console.log(`Total products scraped: ${products.length}`);
    console.log('='.repeat(60));

    // Save output
    const outputPath = '/tmp/urbanoutfitters-scrape-output.txt';
    const output = JSON.stringify(products, null, 2);
    fs.writeFileSync(outputPath, output, 'utf8');

    console.log(`\nOutput saved to: ${outputPath}`);

    if (products.length > 0) {
      console.log(`\nSample product:`);
      console.log(JSON.stringify(products[0], null, 2));

      // Print summary stats
      const validProducts = products.filter(p => p.originalPrice > 0);
      console.log('\n--- Summary ---');
      console.log(`Total products: ${products.length}`);
      console.log(`Products with prices: ${validProducts.length}`);

      if (validProducts.length > 0) {
        const avgDiscount = Math.round(validProducts.reduce((sum, p) => sum + p.discount, 0) / validProducts.length);
        console.log(`Average discount: ${avgDiscount}%`);
      }

      const categories = {};
      products.forEach(p => {
        categories[p.category] = (categories[p.category] || 0) + 1;
      });
      console.log('Categories:', categories);

      const validImages = products.filter(p => p.image && p.image.includes('urbanoutfitters.com')).length;
      console.log(`Products with valid UO CDN images: ${validImages}/${products.length}`);
    }

    return products;

  } catch (error) {
    console.error('Scraper failed:', error);
    process.exit(1);
  }
}

main().then(() => {
  console.log('\nScraping complete!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
