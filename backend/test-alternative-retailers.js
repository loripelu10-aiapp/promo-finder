/**
 * Test Alternative Retailers for Adidas Products
 *
 * Testing retailers that:
 * 1. Don't have GDPR blocks
 * 2. Accessible from EU
 * 3. Sell Adidas products
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const retailers = [
  {
    name: 'Foot Locker',
    searchUrl: 'https://www.footlocker.com/en/search?query=adidas%20shoes%20sale',
    selectors: ['[class*="ProductCard"]', '.ProductCard', '[data-testid="product-card"]']
  },
  {
    name: 'Finish Line',
    searchUrl: 'https://www.finishline.com/store/search?Ntt=adidas+shoes+sale',
    selectors: ['[class*="product"]', '.product-card', 'article[class*="product"]']
  },
  {
    name: 'Champs Sports',
    searchUrl: 'https://www.champssports.com/en/search?query=adidas%20shoes%20sale',
    selectors: ['[class*="ProductCard"]', '.ProductCard', '[data-testid="product-card"]']
  },
  {
    name: 'Eastbay',
    searchUrl: 'https://www.eastbay.com/en/search?query=adidas%20shoes%20sale',
    selectors: ['[class*="ProductCard"]', '.ProductCard', '[data-testid="product-card"]']
  },
  {
    name: 'Zalando (EU-friendly)',
    searchUrl: 'https://www.zalando.com/adidas-shoes/',
    selectors: ['[class*="product"]', '[data-testid="product-card"]', 'article']
  },
  {
    name: 'ASOS (International)',
    searchUrl: 'https://www.asos.com/search/?q=adidas%20shoes%20sale',
    selectors: ['[data-auto-id="productTile"]', 'article', '[class*="product"]']
  }
];

async function testRetailer(retailer) {
  console.log('\n' + '='.repeat(80));
  console.log(`🔍 Testing: ${retailer.name}`);
  console.log('='.repeat(80));
  console.log(`URL: ${retailer.searchUrl}\n`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080'
      ]
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('📄 Loading page...');

    const response = await page.goto(retailer.searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    const status = response.status();
    console.log(`Status: ${status}`);

    if (status === 451) {
      console.log('❌ BLOCKED - GDPR/Regional restriction');
      return { name: retailer.name, status: 'BLOCKED', reason: 'GDPR' };
    }

    if (status !== 200) {
      console.log(`❌ Failed - HTTP ${status}`);
      return { name: retailer.name, status: 'FAILED', reason: `HTTP ${status}` };
    }

    await new Promise(resolve => setTimeout(resolve, 5000));

    const title = await page.title();
    console.log(`Page title: ${title}`);

    // Check for blocking messages
    const bodyText = await page.evaluate(() => document.body.textContent.toLowerCase());

    if (bodyText.includes('forbidden') || bodyText.includes('access denied') || bodyText.includes('unavailable')) {
      console.log('❌ BLOCKED - Access denied message found');
      return { name: retailer.name, status: 'BLOCKED', reason: 'Access denied' };
    }

    // Try to find products
    let foundProducts = false;
    let workingSelector = null;

    for (const selector of retailer.selectors) {
      try {
        const count = await page.$$eval(selector, els => els.length);
        if (count > 0) {
          foundProducts = true;
          workingSelector = selector;
          console.log(`✅ Found ${count} products with selector: ${selector}`);
          break;
        }
      } catch (e) {}
    }

    if (!foundProducts) {
      console.log('⚠️  No products found with any selector');

      // Save debug info
      const screenshotPath = `/tmp/${retailer.name.toLowerCase().replace(/\s+/g, '-')}-test.png`;
      await page.screenshot({ path: screenshotPath });
      console.log(`📸 Screenshot: ${screenshotPath}`);

      return { name: retailer.name, status: 'NO_PRODUCTS', reason: 'Selectors need update' };
    }

    // Extract sample product
    const sampleProduct = await page.evaluate((selector) => {
      const firstProduct = document.querySelector(selector);
      if (!firstProduct) return null;

      const link = firstProduct.querySelector('a');
      const img = firstProduct.querySelector('img');
      const name = firstProduct.textContent.trim().substring(0, 100);

      return {
        hasLink: !!link,
        hasImage: !!img,
        hasText: name.length > 0,
        sample: name
      };
    }, workingSelector);

    if (sampleProduct && sampleProduct.hasLink && sampleProduct.hasImage) {
      console.log(`✅ SUCCESS! Products extracted successfully`);
      console.log(`Sample: ${sampleProduct.sample}`);
      return { name: retailer.name, status: 'SUCCESS', selector: workingSelector };
    } else {
      console.log(`⚠️  Products found but structure incomplete`);
      return { name: retailer.name, status: 'PARTIAL', reason: 'Structure incomplete' };
    }

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return { name: retailer.name, status: 'ERROR', reason: error.message };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TESTING ALTERNATIVE RETAILERS');
  console.log('='.repeat(80));
  console.log('\nLooking for EU-accessible retailers that sell Adidas products...\n');

  const results = [];

  for (const retailer of retailers) {
    const result = await testRetailer(retailer);
    results.push(result);

    // Wait between retailers
    console.log('\n⏳ Waiting 3 seconds before next retailer...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));

  const successful = results.filter(r => r.status === 'SUCCESS');
  const blocked = results.filter(r => r.status === 'BLOCKED');
  const noProducts = results.filter(r => r.status === 'NO_PRODUCTS');
  const failed = results.filter(r => ['ERROR', 'FAILED', 'PARTIAL'].includes(r.status));

  console.log(`\n✅ Working retailers: ${successful.length}`);
  successful.forEach(r => console.log(`   - ${r.name} (selector: ${r.selector})`));

  console.log(`\n❌ Blocked retailers: ${blocked.length}`);
  blocked.forEach(r => console.log(`   - ${r.name} (${r.reason})`));

  console.log(`\n⚠️  Needs selector update: ${noProducts.length}`);
  noProducts.forEach(r => console.log(`   - ${r.name}`));

  console.log(`\n💥 Failed/Error: ${failed.length}`);
  failed.forEach(r => console.log(`   - ${r.name} (${r.reason})`));

  console.log('\n' + '='.repeat(80));
  console.log('💡 RECOMMENDATIONS');
  console.log('='.repeat(80));

  if (successful.length > 0) {
    console.log('\n✅ Implement scrapers for working retailers:');
    successful.forEach(r => console.log(`   - ${r.name}`));
  } else if (noProducts.length > 0) {
    console.log('\n⚠️  Some retailers accessible but need selector updates:');
    noProducts.forEach(r => console.log(`   - ${r.name}`));
    console.log('\nCheck screenshots in /tmp/ to identify correct selectors.');
  } else {
    console.log('\n❌ No retailers accessible from your region.');
    console.log('\n💡 SOLUTION: Use residential proxy for Adidas direct');
    console.log('   - Already implemented in base-scraper.js');
    console.log('   - See PROXY_SETUP_GUIDE.md for setup instructions');
    console.log('   - Recommended: Bright Data (1GB free trial)');
  }

  console.log('\n');
}

main().catch(console.error);
