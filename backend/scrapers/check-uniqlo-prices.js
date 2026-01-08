/**
 * Check Uniqlo price API for original prices
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function checkPrices() {
  console.log('Checking Uniqlo price API...');

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

  // Intercept network requests for price data
  let priceData = null;
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/l2s?') && url.includes('withPrices=true')) {
      try {
        priceData = await response.json();
        console.log('\n=== Price API Response ===');
        console.log(JSON.stringify(priceData, null, 2));
      } catch (e) {}
    }
  });

  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Try different API endpoints directly
  const testUrls = [
    'https://www.uniqlo.com/us/api/commerce/v5/en/products/E481195-000/price-groups/00/l2s?withPrices=true&withStocks=true&includePreviousPrice=true&httpFailure=true',
    'https://www.uniqlo.com/us/api/commerce/v5/en/products?productIds=E481195-000&imageRatio=3x4&httpFailure=true'
  ];

  for (const url of testUrls) {
    console.log(`\nTrying: ${url}`);
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      const content = await page.content();
      // Extract JSON from page
      const bodyText = await page.evaluate(() => document.body.innerText);
      console.log('Response:', bodyText.substring(0, 2000));
    } catch (e) {
      console.log('Error:', e.message);
    }
  }

  // Now let's check the sale page API
  console.log('\n\n=== Checking Sale Page API ===');

  // Navigate to sale page and intercept API calls
  const saleApiCalls = [];
  page.removeAllListeners('response');
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/') && url.includes('products')) {
      try {
        const data = await response.json();
        saleApiCalls.push({ url, data });
      } catch (e) {}
    }
  });

  await page.goto('https://www.uniqlo.com/us/en/feature/sale/women', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await new Promise(r => setTimeout(r, 5000));

  console.log('\nSale page API calls:');
  saleApiCalls.forEach((call, i) => {
    console.log(`\n${i + 1}. ${call.url}`);
    // Look for price information in the data
    const dataStr = JSON.stringify(call.data);
    if (dataStr.includes('price') || dataStr.includes('Price')) {
      console.log('Contains price data!');
      // Extract first item with prices
      if (call.data.result && call.data.result.items) {
        const firstItem = call.data.result.items[0];
        if (firstItem) {
          console.log('First item:', JSON.stringify(firstItem, null, 2).substring(0, 2000));
        }
      }
    }
  });

  await browser.close();
}

checkPrices().catch(console.error);
