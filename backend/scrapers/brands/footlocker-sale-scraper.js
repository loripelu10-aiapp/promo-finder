const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

/**
 * Foot Locker Sale Scraper
 *
 * NOTE: US site (footlocker.com) geo-blocks non-US traffic due to GDPR.
 * This scraper uses Foot Locker UK (footlocker.co.uk) which is accessible globally.
 *
 * Scrapes sale products from Foot Locker UK
 * Extracts real products with verified discounts
 *
 * Commission: 5%
 */

class FootLockerSaleScraper {
  constructor(config = {}) {
    this.config = {
      headless: config.headless !== false,
      timeout: config.timeout || 60000,
      maxProducts: config.maxProducts || 60,
      scrollDelay: config.scrollDelay || 3000,
      userAgent: config.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...config
    };

    this.source = 'footlocker.co.uk';
    this.currency = 'GBP';
    this.commission = '5%';
    this.browser = null;
    this.page = null;
  }

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
        '--disable-infobars'
      ],
      ignoreHTTPSErrors: true,
      defaultViewport: null
    });

    this.page = await this.browser.newPage();

    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
    });

    await this.setupAntiDetection();
  }

  async setupAntiDetection() {
    await this.page.setUserAgent(this.config.userAgent);
    await this.page.setViewport({ width: 1920, height: 1080 });

    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-GB', 'en-US', 'en'] });
      window.chrome = { runtime: {} };
    });
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async scrollToLoadProducts(maxScrolls = 10) {
    let previousHeight = 0;
    let scrollCount = 0;

    while (scrollCount < maxScrolls) {
      const currentHeight = await this.page.evaluate(() => document.body.scrollHeight);
      if (currentHeight === previousHeight) break;

      await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await this.delay(this.config.scrollDelay);

      previousHeight = currentHeight;
      scrollCount++;
    }
  }

  extractPrice(priceText) {
    if (!priceText) return null;
    const cleaned = priceText.replace(/[£$,\s]/g, '').trim();
    const match = cleaned.match(/(\d+\.?\d*)/);
    if (!match) return null;
    const price = parseFloat(match[1]);
    return isNaN(price) ? null : price;
  }

  isRealDiscount(originalPrice, salePrice) {
    if (!originalPrice || !salePrice) return { valid: false, reason: 'Missing price data' };
    if (originalPrice <= salePrice) return { valid: false, reason: 'Original price not greater than sale price' };

    const discount = ((originalPrice - salePrice) / originalPrice) * 100;
    if (discount < 5) return { valid: false, reason: 'Discount too small (< 5%)' };
    if (discount > 85) return { valid: false, reason: 'Discount too large (> 85%), likely error' };

    const ratio = originalPrice / salePrice;
    if (Math.abs(ratio - 1.3) < 0.01) return { valid: false, reason: 'Detected fake discount pattern' };

    return { valid: true, discount: Math.round(discount) };
  }

  extractBrand(name) {
    const brandPatterns = [
      { pattern: /\bnike\b/i, brand: 'Nike' },
      { pattern: /\bjordan\b/i, brand: 'Jordan' },
      { pattern: /\badidas\b/i, brand: 'Adidas' },
      { pattern: /\bpuma\b/i, brand: 'Puma' },
      { pattern: /\bnew balance\b/i, brand: 'New Balance' },
      { pattern: /\breebok\b/i, brand: 'Reebok' },
      { pattern: /\bconverse\b/i, brand: 'Converse' },
      { pattern: /\bvans\b/i, brand: 'Vans' },
      { pattern: /\bfila\b/i, brand: 'Fila' },
      { pattern: /\basics\b/i, brand: 'ASICS' },
      { pattern: /\bcrocs\b/i, brand: 'Crocs' },
      { pattern: /\btimberland\b/i, brand: 'Timberland' },
      { pattern: /\bugg\b/i, brand: 'UGG' },
      { pattern: /\bchampion\b/i, brand: 'Champion' },
      { pattern: /\bunder armour\b/i, brand: 'Under Armour' },
      { pattern: /\bskechers\b/i, brand: 'Skechers' },
      { pattern: /\bhoka\b/i, brand: 'HOKA' },
      { pattern: /\bon\b/i, brand: 'On' },
      { pattern: /\bbrooks\b/i, brand: 'Brooks' },
      { pattern: /\bair max\b/i, brand: 'Nike' },
      { pattern: /\bair force\b/i, brand: 'Nike' },
      { pattern: /\bdunk\b/i, brand: 'Nike' }
    ];

    for (const { pattern, brand } of brandPatterns) {
      if (pattern.test(name)) return brand;
    }
    const firstWord = name.split(' ')[0];
    return (firstWord && firstWord.length > 1) ? firstWord : 'Unknown';
  }

  categorizeProduct(name) {
    const lower = name.toLowerCase();
    if (lower.match(/\b(shoe|sneaker|boot|sandal|trainer|jordan|air|dunk|max|force|slide|clog|foam|runner|running)\b/)) return 'shoes';
    if (lower.match(/\b(shirt|top|jacket|hoodie|pants|shorts|socks|jersey|tee|polo|sweater|fleece|track)\b/)) return 'clothing';
    if (lower.match(/\b(bag|backpack|hat|cap|beanie|headband)\b/)) return 'accessories';
    return 'shoes';
  }

  async scrape() {
    const products = [];
    const seenUrls = new Set();

    try {
      console.log('Starting scrape of Foot Locker UK');

      await this.initBrowser();

      // Accept cookies on homepage
      console.log('Navigating to Foot Locker UK homepage...');
      await this.page.goto('https://www.footlocker.co.uk', {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });
      await this.delay(3000);

      try {
        const cookieBtn = await this.page.$('button[id*="cookie"], #onetrust-accept-btn-handler');
        if (cookieBtn) {
          await cookieBtn.click();
          console.log('Accepted cookies');
          await this.delay(1000);
        }
      } catch (e) {}

      // Scrape sale page
      console.log('\nNavigating to sale page...');
      await this.page.goto('https://www.footlocker.co.uk/en/category/sale.html', {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      const title = await this.page.title();
      console.log(`Page title: ${title}`);

      if (title.includes('404')) {
        console.error('Sale page not found');
        return products;
      }

      await this.delay(5000);

      // Scroll to load products
      console.log('Scrolling to load products...');
      await this.scrollToLoadProducts(15);
      await this.delay(2000);

      // Extract products
      console.log('Extracting products...');
      const scrapedProducts = await this.page.evaluate(() => {
        const results = [];
        const seen = new Set();
        const links = document.querySelectorAll('a[href*="/product/"]');

        links.forEach(link => {
          try {
            const url = link.href;
            if (!url || !url.includes('footlocker.co.uk/en/product') || seen.has(url)) return;
            seen.add(url);

            const card = link.closest('[class*="ProductCard"], article') || link;

            // Parse name from URL
            let name = '';
            const urlMatch = url.match(/\/product\/([^/]+)\/\d+\.html/);
            if (urlMatch) {
              let slug = urlMatch[1];
              slug = slug.replace(/-(men|women|unisex|grade-school|pre-school|baby|kids|toddler)-(shoes|trainers|sneakers|boots|sandals|socks)$/i, '');
              name = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            }
            if (!name || name.length < 3) return;

            // Construct image URL from SKU
            let image = '';
            const skuMatch = url.match(/\/(\d{12})\.html/);
            if (skuMatch) {
              image = `https://images.footlocker.com/is/image/FLEU/${skuMatch[1]}_01?wid=600&hei=600&fmt=png-alpha`;
            }

            // Extract prices
            const fullText = card.textContent || '';
            const priceMatches = fullText.match(/£\s*[\d,.]+/g);
            let salePrice = null, originalPrice = null;

            if (priceMatches && priceMatches.length >= 2) {
              const prices = priceMatches.map(p => parseFloat(p.replace(/[£,\s]/g, ''))).filter(p => !isNaN(p) && p > 0);
              if (prices.length >= 2) {
                const sorted = [...new Set(prices)].sort((a, b) => a - b);
                salePrice = sorted[0];
                originalPrice = sorted[sorted.length - 1];
              }
            }

            if (name && url && salePrice && originalPrice && salePrice < originalPrice) {
              results.push({ name, url, image, salePrice, originalPrice });
            }
          } catch (e) {}
        });

        return results;
      });

      console.log(`Found ${scrapedProducts.length} products with price data`);

      // Process products
      for (const raw of scrapedProducts) {
        if (products.length >= this.config.maxProducts) break;
        if (seenUrls.has(raw.url)) continue;
        seenUrls.add(raw.url);

        const discountCheck = this.isRealDiscount(raw.originalPrice, raw.salePrice);
        if (!discountCheck.valid) {
          console.log(`Rejected "${raw.name.substring(0, 30)}...": ${discountCheck.reason}`);
          continue;
        }

        products.push({
          name: raw.name,
          brand: this.extractBrand(raw.name),
          originalPrice: raw.originalPrice,
          salePrice: raw.salePrice,
          discount: discountCheck.discount,
          currency: this.currency,
          image: raw.image,
          url: raw.url,
          category: this.categorizeProduct(raw.name)
        });

        console.log(`Added: ${raw.name.substring(0, 40)}... (${discountCheck.discount}% off)`);
      }

      console.log(`\nScraping complete: ${products.length} valid products`);

    } catch (error) {
      console.error('Fatal error:', error.message);
      throw error;
    } finally {
      if (this.browser) await this.browser.close();
    }

    return products;
  }
}

// Run the scraper
async function main() {
  console.log('='.repeat(60));
  console.log('Foot Locker Sale Scraper');
  console.log('Target: https://www.footlocker.co.uk/en/category/sale.html');
  console.log('='.repeat(60));

  const scraper = new FootLockerSaleScraper({
    headless: true,
    maxProducts: 60
  });

  try {
    const products = await scraper.scrape();

    console.log('\n' + '='.repeat(60));
    console.log(`RESULTS: ${products.length} products scraped`);
    console.log('='.repeat(60));

    if (products.length > 0) {
      // Save to file
      fs.writeFileSync('/tmp/footlocker-scrape-output.txt', JSON.stringify(products, null, 2));
      console.log('\nOutput saved to: /tmp/footlocker-scrape-output.txt');

      // Summary
      const brands = {};
      let totalDiscount = 0;
      products.forEach(p => {
        brands[p.brand] = (brands[p.brand] || 0) + 1;
        totalDiscount += p.discount;
      });

      console.log('\n--- PRODUCT SUMMARY ---');
      console.log('\nBrands found:');
      Object.entries(brands).sort((a, b) => b[1] - a[1]).forEach(([brand, count]) => {
        console.log(`  ${brand}: ${count} products`);
      });

      console.log(`\nAverage discount: ${Math.round(totalDiscount / products.length)}%`);
      console.log(`Price range: ${scraper.currency}${Math.min(...products.map(p => p.salePrice))} - ${scraper.currency}${Math.max(...products.map(p => p.salePrice))}`);

      console.log('\n--- SAMPLE PRODUCTS ---');
      products.slice(0, 5).forEach((p, i) => {
        console.log(`\n${i + 1}. ${p.name}`);
        console.log(`   Brand: ${p.brand}`);
        console.log(`   Price: ${scraper.currency}${p.salePrice} (was ${scraper.currency}${p.originalPrice}) - ${p.discount}% OFF`);
        console.log(`   Image: ${p.image.substring(0, 70)}...`);
        console.log(`   URL: ${p.url.substring(0, 70)}...`);
      });
    } else {
      console.log('No products scraped.');
      fs.writeFileSync('/tmp/footlocker-scrape-output.txt', JSON.stringify([], null, 2));
    }

  } catch (error) {
    console.error('Scraper failed:', error.message);
    fs.writeFileSync('/tmp/footlocker-scrape-output.txt', JSON.stringify({ error: error.message }, null, 2));
    process.exit(1);
  }
}

main();
