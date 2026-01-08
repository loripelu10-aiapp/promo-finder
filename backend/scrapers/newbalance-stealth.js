/**
 * New Balance scraper with enhanced stealth and persistent browser context
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function scrapeNewBalance() {
  console.log('Starting New Balance enhanced stealth scraper...');
  console.log('');

  // Use a persistent user data directory
  const userDataDir = '/tmp/nb-browser-profile';

  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: userDataDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1920,1080',
      '--start-maximized'
    ],
    ignoreHTTPSErrors: true
  });

  const page = await browser.newPage();

  // Comprehensive anti-detection
  await page.evaluateOnNewDocument(() => {
    // Override webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    delete navigator.__proto__.webdriver;

    // Realistic plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const plugins = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' }
        ];
        plugins.item = (i) => plugins[i];
        plugins.namedItem = (name) => plugins.find(p => p.name === name);
        plugins.refresh = () => {};
        return plugins;
      }
    });

    // Languages
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'language', { get: () => 'en-US' });

    // Platform
    Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });

    // Hardware concurrency
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });

    // Device memory
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

    // Chrome object
    window.chrome = {
      runtime: {},
      loadTimes: function() {},
      csi: function() {},
      app: {}
    };

    // WebGL vendor and renderer
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) return 'Intel Inc.';
      if (parameter === 37446) return 'Intel Iris OpenGL Engine';
      return getParameter.call(this, parameter);
    };
  });

  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 2,
    hasTouch: false,
    isLandscape: true,
    isMobile: false
  });

  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"'
  });

  try {
    // Try to load an embedded page or API
    console.log('Attempting to access New Balance product data...');

    // Method 1: Try Salesforce Commerce Cloud API (SFCC/Demandware)
    // New Balance uses Demandware which typically has endpoints like:
    // /on/demandware.store/Sites-{site}-Site/en_US/Search-Show

    const sfccUrl = 'https://www.newbalance.com/on/demandware.store/Sites-newbalance_us2-Site/en_US/Search-UpdateGrid?cgid=sale&start=0&sz=60&format=ajax';

    console.log(`Trying SFCC endpoint: ${sfccUrl}`);

    // First visit the main page to get cookies
    await page.goto('https://www.newbalance.com/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('Loaded homepage...');
    await delay(5000);

    // Check if we got blocked
    const pageTitle = await page.title();
    console.log(`Page title: ${pageTitle}`);

    const isBlocked = await page.evaluate(() => {
      return document.body.textContent.includes('Oops') ||
             document.body.textContent.includes('Something went wrong');
    });

    if (isBlocked) {
      console.log('Homepage blocked, trying alternative approach...');

      // Try fetching products via a different method
      // Some sites allow access to their CDN-hosted product feeds
      const cdnUrls = [
        'https://www.newbalance.com/dwvar_M990GL6_color/GRY/on/demandware.store/Sites-newbalance_us2-Site/en_US/Product-Variation',
        'https://www.newbalance.com/INTERSHOP/web/WFS/newbalance_us-Site/en_US/-/USD/Search-Show?cgid=sale'
      ];

      for (const url of cdnUrls) {
        console.log(`Trying: ${url}`);
        try {
          await page.goto(url, { timeout: 15000, waitUntil: 'domcontentloaded' });
          const content = await page.content();
          if (!content.includes('Oops')) {
            console.log('Found working endpoint!');
            fs.writeFileSync('/tmp/nb-cdn-content.html', content);
          }
        } catch (e) {
          console.log(`  Error: ${e.message}`);
        }
      }
    } else {
      console.log('Homepage loaded successfully!');

      // Try to navigate to sale
      await page.goto('https://www.newbalance.com/sale/', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await delay(5000);

      // Take screenshot
      await page.screenshot({ path: '/tmp/nb-sale-page.png', fullPage: false });

      // Analyze the page
      const products = await page.evaluate(() => {
        const items = [];

        // Try various selectors
        const cards = document.querySelectorAll('[class*="product"], [class*="tile"], article');

        cards.forEach((card) => {
          const link = card.querySelector('a');
          const img = card.querySelector('img');
          const nameEl = card.querySelector('[class*="name"], [class*="title"], h2, h3');
          const prices = card.querySelectorAll('[class*="price"]');

          if (link && img && nameEl) {
            items.push({
              name: nameEl.textContent?.trim(),
              url: link.href,
              image: img.src || img.dataset?.src,
              priceTexts: Array.from(prices).map(p => p.textContent?.trim())
            });
          }
        });

        return items;
      });

      console.log(`Found ${products.length} potential products`);
      fs.writeFileSync('/tmp/nb-products.json', JSON.stringify(products, null, 2));
    }

    // Final content dump
    const finalContent = await page.content();
    fs.writeFileSync('/tmp/nb-final-page.html', finalContent);
    console.log('Saved final page HTML');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

scrapeNewBalance();
