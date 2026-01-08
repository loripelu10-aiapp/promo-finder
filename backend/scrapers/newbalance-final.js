/**
 * New Balance scraper - Final attempt with maximum stealth
 * Uses puppeteer-extra with all available plugins
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

// Configure stealth plugin
const stealth = StealthPlugin();
stealth.enabledEvasions.delete('iframe.contentWindow');
stealth.enabledEvasions.delete('media.codecs');
puppeteer.use(stealth);

async function delay(min, max = min) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(r => setTimeout(r, ms));
}

async function humanScroll(page) {
  const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
  let currentPosition = 0;

  while (currentPosition < scrollHeight * 0.8) {
    const scrollAmount = 200 + Math.random() * 400;
    currentPosition += scrollAmount;

    await page.evaluate((amount) => {
      window.scrollBy({ top: amount, behavior: 'smooth' });
    }, scrollAmount);

    await delay(800, 1500);
  }
}

async function scrapeNewBalance() {
  console.log('='.repeat(60));
  console.log('New Balance Final Scraper');
  console.log('='.repeat(60));
  console.log('');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
      '--disable-features=site-per-process,IsolateOrigins',
      '--flag-switches-begin',
      '--flag-switches-end'
    ],
    ignoreHTTPSErrors: true
  });

  const page = await browser.newPage();

  // Set realistic fingerprint
  await page.evaluateOnNewDocument(() => {
    // Overwrite the webdriver property
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // Pass the Chrome test
    window.chrome = {
      runtime: {},
      loadTimes: function() { return {}; },
      csi: function() { return {}; },
      app: { isInstalled: false }
    };

    // Pass the permissions test
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);

    // Overwrite plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        {
          0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: true },
          description: 'Portable Document Format',
          filename: 'internal-pdf-viewer',
          length: 1,
          name: 'Chrome PDF Plugin'
        },
        {
          0: { type: 'application/pdf', suffixes: 'pdf', description: '', enabledPlugin: true },
          description: '',
          filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
          length: 1,
          name: 'Chrome PDF Viewer'
        }
      ],
    });

    // Overwrite languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });

    // Fake canvas fingerprint
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type) {
      if (type === 'image/png' && this.width === 16 && this.height === 16) {
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      }
      return originalToDataURL.apply(this, arguments);
    };
  });

  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 2
  });

  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  });

  try {
    console.log('Step 1: Loading New Balance homepage...');

    // First load homepage to get cookies
    await page.goto('https://www.newbalance.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait and check
    await delay(5000, 8000);

    const homeTitle = await page.title();
    console.log(`Homepage title: ${homeTitle}`);

    // Check for bot detection
    const isBlocked = await page.evaluate(() => {
      return document.body.innerHTML.includes('Oops') ||
             document.body.innerHTML.includes('Something went wrong') ||
             document.body.innerHTML.includes('error code:');
    });

    if (isBlocked) {
      console.log('Bot detection triggered on homepage');
      console.log('Saving blocked page for analysis...');

      const blockedContent = await page.content();
      fs.writeFileSync('/tmp/nb-blocked-home.html', blockedContent);

      // Try waiting longer and refreshing
      console.log('Waiting 10 seconds and trying again...');
      await delay(10000);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await delay(5000);
    }

    console.log('');
    console.log('Step 2: Navigating to sale page...');

    // Navigate to sale page
    await page.goto('https://www.newbalance.com/sale/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await delay(5000, 8000);

    const saleTitle = await page.title();
    console.log(`Sale page title: ${saleTitle}`);

    // Check if sale page loaded
    const saleBlocked = await page.evaluate(() => {
      return document.body.innerHTML.includes('Oops') ||
             document.body.innerHTML.includes('Something went wrong');
    });

    if (saleBlocked) {
      console.log('Sale page is also blocked');

      // Try alternative: search for sale products
      console.log('Trying search approach...');

      await page.goto('https://www.newbalance.com/search/?q=sale', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      await delay(5000);
    }

    // Take screenshot
    await page.screenshot({ path: '/tmp/nb-final.png', fullPage: false });
    console.log('Screenshot saved to /tmp/nb-final.png');

    // Save page content
    const finalContent = await page.content();
    fs.writeFileSync('/tmp/nb-final.html', finalContent);
    console.log('Page HTML saved');

    // Try to scroll and extract
    console.log('');
    console.log('Step 3: Scrolling to load products...');
    await humanScroll(page);

    // Extract any products we can find
    const products = await page.evaluate(() => {
      const results = [];

      // Very broad selectors
      const allLinks = document.querySelectorAll('a[href*="/pd/"]');

      allLinks.forEach(link => {
        // Get the product container (parent)
        let container = link.parentElement;
        for (let i = 0; i < 5 && container; i++) {
          const img = container.querySelector('img');
          const hasPrice = container.textContent.includes('$');

          if (img && hasPrice) {
            // Extract price information
            const priceMatches = container.textContent.match(/\$[\d,.]+/g) || [];

            if (priceMatches.length >= 1) {
              // Try to find name
              const nameEl = container.querySelector('h2, h3, h4, [class*="name"], [class*="title"]');

              results.push({
                name: nameEl ? nameEl.textContent.trim() : 'Unknown Product',
                url: link.href,
                image: img.src || img.dataset?.src || img.getAttribute('data-src'),
                prices: priceMatches,
                html: container.outerHTML.substring(0, 500)
              });
              break;
            }
          }
          container = container.parentElement;
        }
      });

      // Deduplicate by URL
      const seen = new Set();
      return results.filter(p => {
        if (seen.has(p.url)) return false;
        seen.add(p.url);
        return true;
      });
    });

    console.log('');
    console.log(`Found ${products.length} products`);

    if (products.length > 0) {
      fs.writeFileSync('/tmp/nb-final-products.json', JSON.stringify(products, null, 2));
      console.log('Products saved to /tmp/nb-final-products.json');

      // Show sample
      console.log('');
      console.log('Sample products:');
      products.slice(0, 3).forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.name}`);
        console.log(`     URL: ${p.url}`);
        console.log(`     Prices: ${p.prices.join(', ')}`);
      });
    } else {
      console.log('No products found - site is likely blocking the scraper');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
    console.log('');
    console.log('Browser closed');
  }
}

scrapeNewBalance();
