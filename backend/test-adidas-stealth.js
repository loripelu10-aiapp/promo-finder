/**
 * Test Adidas with enhanced stealth measures
 */

const puppeteer = require('puppeteer');

async function testAdidasStealth() {
  console.log('🔍 Testing Adidas with stealth mode...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--window-size=1920,1080',
      '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ],
    ignoreHTTPSErrors: true
  });

  const page = await browser.newPage();

  try {
    // Extra stealth measures
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      window.chrome = { runtime: {} };
    });

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    });

    console.log('📄 Loading Adidas outlet page...');

    const response = await page.goto('https://www.adidas.com/us/outlet', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    console.log(`Status: ${response.status()}`);
    console.log(`URL: ${page.url()}`);

    // Wait a bit for JavaScript to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Take screenshot to see what we got
    await page.screenshot({ path: '/tmp/adidas-stealth.png', fullPage: false });
    console.log('📸 Screenshot saved to /tmp/adidas-stealth.png\n');

    // Try to find product elements
    const selectors = [
      '[data-auto-id="plp-product"]',
      '[class*="product-card"]',
      '[class*="plp"]',
      'article'
    ];

    for (const selector of selectors) {
      const count = await page.$$eval(selector, els => els.length);
      if (count > 0) {
        console.log(`✅ Found ${count} elements with selector: ${selector}`);
      }
    }

    console.log('\n⏱️  Waiting 10 seconds to observe page...');
    await new Promise(resolve => setTimeout(resolve, 10000));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

testAdidasStealth();
