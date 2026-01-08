/**
 * New Balance scraper using direct API calls
 * Many sites load product data via JSON APIs
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function scrapeNewBalance() {
  console.log('Starting New Balance API scraper...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = await browser.newPage();
  const interceptedData = [];

  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Intercept all network requests
  await page.setRequestInterception(true);

  page.on('request', (request) => {
    request.continue();
  });

  page.on('response', async (response) => {
    const url = response.url();

    // Look for API responses that might contain product data
    if (url.includes('api') || url.includes('product') || url.includes('search') || url.includes('graphql')) {
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('json')) {
          const data = await response.json();
          interceptedData.push({ url, data });
          console.log(`Intercepted JSON from: ${url.substring(0, 100)}`);
        }
      } catch (e) {
        // Not JSON or failed to parse
      }
    }
  });

  try {
    console.log('Loading New Balance sale page...');

    await page.goto('https://www.newbalance.com/sale/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for potential API calls
    console.log('Waiting for API responses...');
    await new Promise(r => setTimeout(r, 10000));

    // Scroll to trigger more API calls
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await new Promise(r => setTimeout(r, 3000));

    console.log(`\nIntercepted ${interceptedData.length} JSON responses`);

    if (interceptedData.length > 0) {
      fs.writeFileSync('/tmp/newbalance-api-data.json', JSON.stringify(interceptedData, null, 2));
      console.log('Saved intercepted data to /tmp/newbalance-api-data.json');
    }

    // Also try direct API endpoint patterns
    console.log('\nTrying direct API endpoints...');

    // Common API patterns for e-commerce sites
    const apiEndpoints = [
      'https://www.newbalance.com/api/search?cgid=sale&count=60',
      'https://www.newbalance.com/api/products?category=sale',
      'https://api.newbalance.com/products/sale',
    ];

    for (const endpoint of apiEndpoints) {
      try {
        console.log(`Trying: ${endpoint}`);
        const response = await page.goto(endpoint, { timeout: 10000 });
        const text = await page.evaluate(() => document.body.textContent);
        if (text && text.startsWith('{')) {
          console.log('Found JSON API!');
          fs.writeFileSync('/tmp/newbalance-direct-api.json', text);
          break;
        }
      } catch (e) {
        console.log(`  Failed: ${e.message}`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

scrapeNewBalance();
