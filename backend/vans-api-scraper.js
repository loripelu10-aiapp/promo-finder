const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

// Add stealth plugin
puppeteer.use(StealthPlugin());

const OUTPUT_FILE = '/tmp/vans-products.json';

// Random delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min, max) => delay(Math.floor(Math.random() * (max - min + 1)) + min);

async function scrapeVansAPI() {
  console.log('Starting Vans sale scraper (API approach)...');
  console.log('Target: https://www.vans.com/en-us/sale');

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080'
    ],
    defaultViewport: null
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Intercept network requests to find API calls
  const apiResponses = [];

  await page.setRequestInterception(true);

  page.on('request', request => {
    request.continue();
  });

  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/') || url.includes('products') || url.includes('search') || url.includes('catalog')) {
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('json')) {
          const text = await response.text();
          if (text.length > 100) {
            console.log(`Found API response: ${url.substring(0, 100)}...`);
            apiResponses.push({ url, data: text });
          }
        }
      } catch (e) {}
    }
  });

  try {
    console.log('\nNavigating to sale page...');
    await page.goto('https://www.vans.com/en-us/sale', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await randomDelay(5000, 8000);

    // Accept cookies
    try {
      const cookieBtn = await page.$('#onetrust-accept-btn-handler');
      if (cookieBtn) {
        await cookieBtn.click();
        console.log('Accepted cookies');
        await delay(2000);
      }
    } catch (e) {}

    // Scroll to trigger more API calls
    console.log('Scrolling to load more products...');
    for (let i = 0; i < 20; i++) {
      await page.evaluate(() => {
        window.scrollBy({ top: 500, behavior: 'smooth' });
      });
      await delay(500);
    }

    await randomDelay(3000, 5000);

    // Take screenshot for debugging
    await page.screenshot({ path: '/tmp/vans-page.png', fullPage: false });
    console.log('Screenshot saved to /tmp/vans-page.png');

    // Get page HTML
    const html = await page.content();
    fs.writeFileSync('/tmp/vans-page.html', html);
    console.log('HTML saved to /tmp/vans-page.html');

    // Try to extract products from the page
    const products = await page.evaluate(() => {
      const items = [];

      // Log all available element info for debugging
      const allElements = document.querySelectorAll('*');
      const classNames = new Set();
      allElements.forEach(el => {
        if (el.className && typeof el.className === 'string') {
          el.className.split(' ').forEach(c => {
            if (c.toLowerCase().includes('product') || c.toLowerCase().includes('tile') || c.toLowerCase().includes('card')) {
              classNames.add(c);
            }
          });
        }
      });
      console.log('Product-related classes found:', [...classNames]);

      // Try multiple approaches to find products
      const productSelectors = [
        // Common e-commerce patterns
        '[class*="product-tile"]',
        '[class*="ProductTile"]',
        '[class*="product-card"]',
        '[class*="ProductCard"]',
        '[data-component*="Product"]',
        '[data-testid*="product"]',
        'article[class*="product"]',
        'div[class*="product-item"]',
        'li[class*="product"]',
        // Grid items
        '[class*="grid"] > div',
        '[class*="Grid"] > div',
        // Specific Vans patterns
        '[class*="plp"]',
        '[class*="PLP"]'
      ];

      for (const selector of productSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 5) {
          console.log(`Found ${elements.length} elements with: ${selector}`);

          elements.forEach(el => {
            try {
              const nameEl = el.querySelector('h2, h3, h4, [class*="name"], [class*="title"], a');
              const name = nameEl ? nameEl.textContent.trim().substring(0, 100) : '';

              const priceText = el.textContent;
              const prices = priceText.match(/\$[\d,.]+/g) || [];

              let originalPrice = '';
              let salePrice = '';

              if (prices.length >= 2) {
                const numPrices = prices.map(p => parseFloat(p.replace(/[$,]/g, ''))).filter(p => p > 0);
                if (numPrices.length >= 2) {
                  numPrices.sort((a, b) => b - a);
                  originalPrice = '$' + numPrices[0].toFixed(2);
                  salePrice = '$' + numPrices[numPrices.length - 1].toFixed(2);
                }
              } else if (prices.length === 1) {
                salePrice = prices[0];
              }

              const imgEl = el.querySelector('img');
              const imageUrl = imgEl ? (imgEl.src || imgEl.dataset.src || '') : '';

              const linkEl = el.querySelector('a[href*="/"]');
              let productUrl = linkEl ? linkEl.href : '';

              if (name && name.length > 3 && (salePrice || productUrl)) {
                items.push({
                  name: name.replace(/\s+/g, ' '),
                  originalPrice,
                  salePrice,
                  imageUrl,
                  productUrl
                });
              }
            } catch (e) {}
          });

          if (items.length > 0) break;
        }
      }

      return items;
    });

    console.log(`\nExtracted ${products.length} products from page`);

    // Also try to find product data in script tags (many React sites embed initial data)
    const scriptData = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      const results = [];

      scripts.forEach(script => {
        const text = script.textContent || '';
        if (text.includes('product') && text.includes('price') && text.length > 500) {
          // Try to find JSON data
          const jsonMatches = text.match(/\{[^{}]*"products?"[^{}]*\}/g) || [];
          results.push(...jsonMatches.slice(0, 5));
        }
      });

      return results.slice(0, 10);
    });

    console.log(`Found ${scriptData.length} potential data chunks in scripts`);

    // Check window.__INITIAL_STATE__ or similar
    const windowData = await page.evaluate(() => {
      const keys = ['__INITIAL_STATE__', '__NEXT_DATA__', '__NUXT__', '__PRELOADED_STATE__', 'window.__data'];
      for (const key of keys) {
        try {
          const data = eval(key);
          if (data) {
            return JSON.stringify(data).substring(0, 10000);
          }
        } catch (e) {}
      }
      return null;
    });

    if (windowData) {
      console.log('Found window data, saving...');
      fs.writeFileSync('/tmp/vans-window-data.json', windowData);
    }

    // Process API responses
    console.log(`\nProcessing ${apiResponses.length} API responses...`);
    let apiProducts = [];

    for (const resp of apiResponses) {
      try {
        const data = JSON.parse(resp.data);
        // Look for products array
        const findProducts = (obj, path = '') => {
          if (!obj || typeof obj !== 'object') return [];
          if (Array.isArray(obj) && obj.length > 0 && obj[0] && (obj[0].name || obj[0].title || obj[0].productName)) {
            return obj;
          }
          for (const key of Object.keys(obj)) {
            if (key.toLowerCase().includes('product') || key === 'items' || key === 'results' || key === 'data') {
              const result = findProducts(obj[key], path + '.' + key);
              if (result.length > 0) return result;
            }
          }
          return [];
        };

        const found = findProducts(data);
        if (found.length > 0) {
          console.log(`Found ${found.length} products in API response`);
          apiProducts = [...apiProducts, ...found];
        }
      } catch (e) {}
    }

    // Combine results
    let allProducts = [...products];

    // Process API products if found
    if (apiProducts.length > 0) {
      for (const p of apiProducts) {
        try {
          const name = p.name || p.title || p.productName || '';
          const originalPrice = p.originalPrice || p.compareAtPrice || p.listPrice || '';
          const salePrice = p.price || p.salePrice || p.currentPrice || '';
          const imageUrl = p.image || p.imageUrl || p.thumbnail || '';
          const productUrl = p.url || p.link || p.pdpUrl || '';

          if (name) {
            allProducts.push({
              name: String(name),
              originalPrice: typeof originalPrice === 'number' ? '$' + originalPrice.toFixed(2) : String(originalPrice || ''),
              salePrice: typeof salePrice === 'number' ? '$' + salePrice.toFixed(2) : String(salePrice || ''),
              imageUrl: String(imageUrl || ''),
              productUrl: String(productUrl || '')
            });
          }
        } catch (e) {}
      }
    }

    // Deduplicate
    const seen = new Set();
    const uniqueProducts = allProducts.filter(p => {
      const key = p.name + p.productUrl;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Filter for discounted products
    const discountedProducts = uniqueProducts.filter(p => {
      if (!p.originalPrice || !p.salePrice) return false;
      const original = parseFloat(String(p.originalPrice).replace(/[$,]/g, ''));
      const sale = parseFloat(String(p.salePrice).replace(/[$,]/g, ''));
      return original > sale && sale > 0;
    });

    // Calculate discount
    discountedProducts.forEach(p => {
      const original = parseFloat(String(p.originalPrice).replace(/[$,]/g, ''));
      const sale = parseFloat(String(p.salePrice).replace(/[$,]/g, ''));
      p.discountPercent = Math.round(((original - sale) / original) * 100);
      p.hasDiscount = true;
    });

    discountedProducts.sort((a, b) => b.discountPercent - a.discountPercent);

    console.log(`\n========================================`);
    console.log(`SCRAPING COMPLETE`);
    console.log(`========================================`);
    console.log(`Total unique products: ${uniqueProducts.length}`);
    console.log(`Products with discounts: ${discountedProducts.length}`);

    const finalProducts = discountedProducts.length > 0 ? discountedProducts : uniqueProducts;

    const output = {
      scrapedAt: new Date().toISOString(),
      source: 'Vans US Sale',
      url: 'https://www.vans.com/en-us/sale',
      totalProducts: uniqueProducts.length,
      productsWithDiscounts: discountedProducts.length,
      products: finalProducts
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`\nResults saved to ${OUTPUT_FILE}`);

    if (finalProducts.length > 0) {
      console.log('\n--- Sample Products ---');
      finalProducts.slice(0, 10).forEach((p, i) => {
        console.log(`\n${i + 1}. ${p.name}`);
        if (p.originalPrice && p.salePrice) {
          console.log(`   Price: ${p.originalPrice} -> ${p.salePrice}`);
        }
        if (p.discountPercent) console.log(`   Discount: ${p.discountPercent}%`);
      });
    }

    return output;

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

scrapeVansAPI()
  .then(result => {
    console.log(`\nDone! Found ${result.products.length} products.`);
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed:', error);
    process.exit(1);
  });
