#!/usr/bin/env node

/**
 * Urban Outfitters Visible Browser Scraper
 *
 * Uses a visible browser window to avoid bot detection.
 * This approach works better with PerimeterX protection.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

class UrbanOutfittersVisibleScraper {
  constructor(config = {}) {
    this.brand = 'Urban Outfitters';
    this.source = 'urbanoutfitters.com';
    this.currency = 'USD';
    this.commission = 5;
    this.maxProducts = config.maxProducts || 60;
    this.browser = null;
    this.page = null;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async humanScroll(page) {
    // Human-like scrolling with variable speeds
    const scrolls = [300, 500, 400, 600, 350, 450];
    for (const scroll of scrolls) {
      await page.evaluate((s) => window.scrollBy(0, s), scroll);
      await this.delay(Math.random() * 1000 + 500);
    }
  }

  async init() {
    console.log('Launching browser in visible mode...');

    this.browser = await puppeteer.launch({
      headless: false, // Visible browser
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
        '--start-maximized'
      ],
      defaultViewport: null
    });

    this.page = await this.browser.newPage();

    await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await this.page.setViewport({ width: 1920, height: 1080 });

    // Override detection
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      window.chrome = { runtime: {} };
    });
  }

  extractPrice(priceText) {
    if (!priceText) return null;
    const cleaned = priceText.replace(/[$€£¥,\s]/g, '').trim();
    const match = cleaned.match(/(\d+\.?\d*)/);
    if (!match) return null;
    const price = parseFloat(match[1]);
    return isNaN(price) ? null : price;
  }

  async scrape() {
    const products = [];

    try {
      await this.init();

      console.log('Navigating to Urban Outfitters...');

      // First visit the homepage
      await this.page.goto('https://www.urbanoutfitters.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      console.log('On homepage, waiting...');
      await this.delay(5000);

      // Check if we hit bot protection
      let title = await this.page.title();
      console.log('Homepage title:', title);

      if (title.toLowerCase().includes('denied')) {
        console.log('Bot protection detected on homepage. Waiting...');
        await this.delay(10000);
        title = await this.page.title();
        console.log('Title after wait:', title);
      }

      // Navigate to sale page
      console.log('Navigating to sale page...');
      await this.page.goto('https://www.urbanoutfitters.com/sale', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      title = await this.page.title();
      console.log('Sale page title:', title);

      if (title.toLowerCase().includes('denied')) {
        console.log('Bot protection still active. Please manually solve the captcha in the browser window.');
        console.log('Waiting 30 seconds for manual intervention...');
        await this.delay(30000);

        title = await this.page.title();
        console.log('Title after manual wait:', title);

        if (title.toLowerCase().includes('denied')) {
          console.log('Bot protection could not be bypassed.');
          return products;
        }
      }

      // Wait for products to load
      console.log('Waiting for products to load...');
      await this.delay(5000);

      // Scroll to load more products
      console.log('Scrolling to load products...');
      for (let i = 0; i < 5; i++) {
        await this.humanScroll(this.page);
        await this.delay(2000);
      }

      // Extract products
      console.log('Extracting products...');
      const rawProducts = await this.page.evaluate(() => {
        const results = [];

        // Find all product cards
        const cards = document.querySelectorAll('[class*="tile"], [class*="product"], article');

        cards.forEach((card, index) => {
          try {
            // Find link
            const link = card.querySelector('a[href*="/shop/"]') || card.querySelector('a[href*="/product/"]');
            if (!link) return;

            const url = link.href;
            if (!url || !url.includes('urbanoutfitters.com')) return;

            // Find name
            let name = '';
            const nameEl = card.querySelector('h2, h3, [class*="title"], [class*="name"], [class*="heading"]');
            if (nameEl) {
              name = nameEl.textContent.trim();
            }
            if (!name) return;

            // Find image
            let image = '';
            const img = card.querySelector('img');
            if (img) {
              image = img.src || img.dataset.src || '';
            }

            // Find prices
            const priceContainer = card.querySelector('[class*="price"]');
            let priceText = '';
            if (priceContainer) {
              priceText = priceContainer.textContent;
            }

            // Extract price values
            const priceMatches = priceText.match(/\$[\d,]+\.?\d*/g) || [];

            results.push({
              name,
              url,
              image,
              priceText,
              priceMatches,
              index
            });
          } catch (e) { }
        });

        return results;
      });

      console.log(`Found ${rawProducts.length} raw products`);

      // Process products
      for (const raw of rawProducts) {
        if (products.length >= this.maxProducts) break;

        try {
          // Parse prices
          let originalPrice = null;
          let salePrice = null;

          if (raw.priceMatches && raw.priceMatches.length >= 2) {
            const prices = raw.priceMatches.map(p => this.extractPrice(p));
            originalPrice = Math.max(...prices.filter(p => p !== null));
            salePrice = Math.min(...prices.filter(p => p !== null));
          } else if (raw.priceMatches && raw.priceMatches.length === 1) {
            salePrice = this.extractPrice(raw.priceMatches[0]);
          }

          // Skip products without discount
          if (!originalPrice || !salePrice || originalPrice <= salePrice) {
            continue;
          }

          const discount = Math.round(((originalPrice - salePrice) / originalPrice) * 100);

          // Validate discount (10-70%)
          if (discount < 10 || discount > 70) continue;

          products.push({
            name: raw.name,
            brand: this.brand,
            originalPrice,
            salePrice,
            discount,
            currency: this.currency,
            image: raw.image,
            url: raw.url,
            category: this.categorizeProduct(raw.name)
          });

          console.log(`Added: ${raw.name} (${discount}% off)`);

        } catch (e) {
          console.log(`Error processing product: ${e.message}`);
        }
      }

      console.log(`Extracted ${products.length} valid products`);

      return products;

    } catch (error) {
      console.error('Scrape error:', error.message);
      return products;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  categorizeProduct(name) {
    const lower = (name || '').toLowerCase();

    if (lower.match(/\b(dress|skirt|romper|jumpsuit)\b/)) return 'dresses';
    if (lower.match(/\b(top|shirt|blouse|tee|tank|crop|bodysuit|sweater|cardigan|hoodie|sweatshirt|jacket|coat|blazer)\b/)) return 'tops';
    if (lower.match(/\b(jeans|pants|trousers|leggings|shorts|joggers)\b/)) return 'bottoms';
    if (lower.match(/\b(shoe|sneaker|boot|sandal|heel|flat|loafer|mule|slipper)\b/)) return 'shoes';
    if (lower.match(/\b(bag|purse|backpack|tote|clutch|wallet|belt|hat|cap|beanie|scarf|sunglasses|jewelry|necklace|earring|bracelet|ring)\b/)) return 'accessories';

    return 'clothing';
  }
}

// Run
async function main() {
  console.log('='.repeat(60));
  console.log('Urban Outfitters Visible Browser Scraper');
  console.log('='.repeat(60));

  const scraper = new UrbanOutfittersVisibleScraper({ maxProducts: 60 });

  try {
    const products = await scraper.scrape();

    const outputPath = '/tmp/urbanoutfitters-scrape-output.txt';
    fs.writeFileSync(outputPath, JSON.stringify(products, null, 2), 'utf8');

    console.log(`\nOutput saved to: ${outputPath}`);
    console.log(`Total products: ${products.length}`);

    if (products.length > 0) {
      console.log('\nSample product:');
      console.log(JSON.stringify(products[0], null, 2));
    }

  } catch (error) {
    console.error('Fatal error:', error);
  }
}

main();
