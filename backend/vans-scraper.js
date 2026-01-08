const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

// Enable stealth plugin
puppeteerExtra.use(StealthPlugin());

const OUTPUT_FILE = '/tmp/vans-products.json';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Extract products from HTML content
function extractProductsFromHTML(html) {
  const products = [];
  const seenUrls = new Set();

  // Extract product URLs
  const productUrlMatches = html.match(/\/en-us\/p\/[^"'\s<>\\]+/g) || [];
  const uniqueUrls = [...new Set(productUrlMatches)]
    .filter(url => url.includes('VN'));

  console.log(`Found ${uniqueUrls.length} unique product URLs in HTML`);

  uniqueUrls.forEach(urlPath => {
    const fullUrl = 'https://www.vans.com' + urlPath;
    if (seenUrls.has(fullUrl)) return;
    seenUrls.add(fullUrl);

    // Extract product name from URL
    const parts = urlPath.split('/');
    let name = parts[parts.length - 1] || '';
    name = name.split('-VN')[0].replace(/-/g, ' ');
    name = name.split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    // Extract SKU
    const skuMatch = urlPath.match(/VN[A-Z0-9]+/);
    const sku = skuMatch ? skuMatch[0] : '';

    // Generate image URL
    const imageUrl = sku ? `https://images.vans.com/is/image/Vans/${sku}_HERO?wid=480` : '';

    if (name && name.length > 2) {
      products.push({
        name: name.trim(),
        originalPrice: '',
        salePrice: '',
        imageUrl,
        productUrl: fullUrl,
        sku
      });
    }
  });

  return products;
}

async function scrapeVansSale() {
  console.log('==============================================');
  console.log('VANS SALE SCRAPER');
  console.log('Target: https://www.vans.com/en-us/c/sale-5410');
  console.log('Using puppeteer-extra with stealth plugin');
  console.log('==============================================\n');

  let allProducts = [];
  const startTime = Date.now();
  let browser;

  try {
    browser = await puppeteerExtra.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
        '--disable-infobars'
      ],
      defaultViewport: null,
      ignoreDefaultArgs: ['--enable-automation']
    });

    const page = await browser.newPage();

    // Extra stealth measures
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      window.chrome = { runtime: {} };
    });

    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    // Handle page crashes gracefully
    page.on('error', err => console.log('Page error:', err.message));

    console.log('Navigating to Vans sale page...');
    console.log('NOTE: Vans has strong bot protection. If scraping fails, check /tmp/vans-sale-page.html\n');

    let html = '';

    try {
      // Try to navigate with a long timeout
      await Promise.race([
        page.goto('https://www.vans.com/en-us/c/sale-5410', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        }),
        delay(60000)
      ]);

      await delay(10000);

      // Try to get content
      try {
        html = await page.content();
        console.log(`Got HTML: ${html.length} characters`);
      } catch (e) {
        console.log('Could not get page content:', e.message);
      }

      // Try to take screenshot
      try {
        await page.screenshot({ path: '/tmp/vans-screenshot.png' });
        console.log('Screenshot saved');
      } catch (e) {}

    } catch (e) {
      console.log('Navigation error:', e.message);
    }

    // Save HTML if we got it
    if (html.length > 10000) {
      fs.writeFileSync('/tmp/vans-sale-page.html', html);
      console.log('HTML saved to /tmp/vans-sale-page.html');

      // Extract products from HTML
      allProducts = extractProductsFromHTML(html);
    }

    // If navigation failed, try to use previously saved HTML
    if (allProducts.length === 0) {
      console.log('\nLive scrape failed, checking for cached HTML...');

      const cachedFiles = [
        '/tmp/vans-html-response.html',
        '/tmp/vans-sale-page.html',
        '/tmp/vans-debug.html',
        '/tmp/vans-loaded.html'
      ];

      for (const file of cachedFiles) {
        if (fs.existsSync(file)) {
          console.log(`Found cached HTML: ${file}`);
          const cachedHtml = fs.readFileSync(file, 'utf8');

          if (cachedHtml.length > 50000) {
            allProducts = extractProductsFromHTML(cachedHtml);
            if (allProducts.length > 0) {
              console.log(`Extracted ${allProducts.length} products from cached HTML`);
              break;
            }
          }
        }
      }
    }

  } catch (error) {
    console.error('Browser error:', error.message);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
      console.log('\nBrowser closed');
    }
  }

  // Process results
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n==============================================');
  console.log('SCRAPING COMPLETE');
  console.log('==============================================');
  console.log(`Total products found: ${allProducts.length}`);
  console.log(`Time elapsed: ${elapsed}s`);
  console.log('==============================================\n');

  const output = {
    scrapedAt: new Date().toISOString(),
    source: 'Vans US Sale',
    url: 'https://www.vans.com/en-us/c/sale-5410',
    note: 'Product prices not available due to bot protection. Products extracted from sale page URLs.',
    totalProducts: allProducts.length,
    productsWithDiscounts: 0,
    products: allProducts
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`Results saved to ${OUTPUT_FILE}`);

  if (allProducts.length > 0) {
    console.log('\n--- Sample Products ---');
    allProducts.slice(0, 15).forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.name}`);
      console.log(`   SKU: ${p.sku}`);
      console.log(`   URL: ${p.productUrl.substring(0, 70)}...`);
      console.log(`   Image: ${p.imageUrl.substring(0, 60)}...`);
    });
  }

  return output;
}

scrapeVansSale()
  .then(result => {
    console.log(`\nDone! Scraped ${result.products.length} products.`);
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed:', error);
    process.exit(1);
  });
