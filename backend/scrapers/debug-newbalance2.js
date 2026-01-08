/**
 * Debug script with enhanced anti-detection for New Balance
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function debug() {
  console.log('Starting New Balance page analysis with enhanced stealth...');

  const browser = await puppeteer.launch({
    headless: 'new', // Use new headless mode
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
      '--window-size=1920,1080'
    ]
  });

  const page = await browser.newPage();

  // Set more realistic headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"'
  });

  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1920, height: 1080 });

  // Override webdriver
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    window.chrome = { runtime: {} };
  });

  try {
    // Try the direct sale page with different paths
    const urls = [
      'https://www.newbalance.com/sale/',
      'https://www.newbalance.com/shop/sale',
      'https://www.newbalance.com/on/demandware.store/Sites-newbalance_us2-Site/en_US/Search-Show?cgid=sale'
    ];

    for (const url of urls) {
      console.log(`\nTrying: ${url}`);

      try {
        const response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });

        console.log(`Status: ${response.status()}`);

        // Wait for any dynamic content
        await new Promise(r => setTimeout(r, 5000));

        const title = await page.title();
        console.log(`Title: ${title}`);

        const currentUrl = page.url();
        console.log(`Final URL: ${currentUrl}`);

        // Check if we got an error page
        const hasError = await page.evaluate(() => {
          return document.body.textContent.includes('Oops') ||
                 document.body.textContent.includes('error') ||
                 document.body.textContent.includes('blocked');
        });

        if (!hasError) {
          console.log('Page loaded successfully!');

          // Take screenshot
          await page.screenshot({ path: '/tmp/newbalance-success.png', fullPage: false });

          // Get page content
          const content = await page.content();
          fs.writeFileSync('/tmp/newbalance-page.html', content);
          console.log('Saved full page HTML to /tmp/newbalance-page.html');

          break;
        } else {
          console.log('Error page detected, trying next URL...');
        }
      } catch (e) {
        console.log(`Error: ${e.message}`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

debug();
