/**
 * Check for Uniqlo API endpoints
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function checkApi() {
  console.log('Checking Uniqlo API endpoints...');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = await browser.newPage();

  // Intercept network requests to find API calls
  const apiCalls = [];
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('api') || url.includes('graphql') || url.includes('products') || url.includes('price')) {
      const contentType = response.headers()['content-type'] || '';
      if (contentType.includes('json')) {
        try {
          const data = await response.json();
          apiCalls.push({ url, data: JSON.stringify(data).substring(0, 1000) });
        } catch (e) {}
      }
    }
  });

  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  console.log('Navigating to product page...');
  await page.goto('https://www.uniqlo.com/us/en/products/E481195-000/00', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await new Promise(r => setTimeout(r, 3000));

  console.log('\n=== API Calls Found ===');
  apiCalls.forEach((call, i) => {
    console.log(`\n${i + 1}. ${call.url}`);
    console.log(`   Data preview: ${call.data.substring(0, 500)}...`);
  });

  // Also check for embedded data in window object
  const windowData = await page.evaluate(() => {
    const results = {};

    // Common places where data might be stored
    if (window.__NEXT_DATA__) results.__NEXT_DATA__ = JSON.stringify(window.__NEXT_DATA__).substring(0, 2000);
    if (window.__INITIAL_STATE__) results.__INITIAL_STATE__ = JSON.stringify(window.__INITIAL_STATE__).substring(0, 2000);
    if (window.__PRELOADED_STATE__) results.__PRELOADED_STATE__ = JSON.stringify(window.__PRELOADED_STATE__).substring(0, 2000);
    if (window.REDUX_STATE) results.REDUX_STATE = JSON.stringify(window.REDUX_STATE).substring(0, 2000);

    // Check for product data in any global variable
    for (const key of Object.keys(window)) {
      if (key.includes('product') || key.includes('Product') || key.includes('PRODUCT')) {
        try {
          results[key] = JSON.stringify(window[key]).substring(0, 1000);
        } catch (e) {}
      }
    }

    return results;
  });

  console.log('\n=== Window Data ===');
  Object.entries(windowData).forEach(([key, value]) => {
    console.log(`\n${key}:`);
    console.log(value);
  });

  // Try to extract specific product data from the page
  const productData = await page.evaluate(() => {
    // Look for structured data (JSON-LD)
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    const structuredData = [];
    jsonLdScripts.forEach(script => {
      try {
        structuredData.push(JSON.parse(script.textContent));
      } catch (e) {}
    });

    return structuredData;
  });

  console.log('\n=== Structured Data (JSON-LD) ===');
  console.log(JSON.stringify(productData, null, 2));

  await browser.close();
}

checkApi().catch(console.error);
