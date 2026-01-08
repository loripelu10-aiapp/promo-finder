/**
 * Test Adidas with puppeteer-extra stealth
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function testAdidasStealth() {
  console.log('🔍 Testing Adidas with puppeteer-extra stealth...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = await browser.newPage();

  try {
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    console.log('📄 Loading Adidas outlet page...');

    const response = await page.goto('https://www.adidas.com/us/outlet', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log(`✅ Status: ${response.status()}`);
    console.log(`✅ URL: ${page.url()}\n`);

    // Wait for products to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check for product elements
    const productCount = await page.evaluate(() => {
      const selectors = [
        '[data-auto-id="plp-product"]',
        '[data-auto-id*="product"]',
        '.product-card',
        '[class*="plp-product"]'
      ];

      for (const selector of selectors) {
        const count = document.querySelectorAll(selector).length;
        if (count > 0) {
          return { selector, count };
        }
      }

      return { selector: 'none', count: 0 };
    });

    console.log(`🔍 Products found: ${productCount.count} using selector: ${productCount.selector}`);

    if (productCount.count > 0) {
      console.log('✅ SUCCESS: Can access Adidas page with stealth mode!');
    } else {
      console.log('⚠️  Page loaded but no products found yet');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

testAdidasStealth();
