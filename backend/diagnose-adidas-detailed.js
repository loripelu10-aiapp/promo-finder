/**
 * Detailed Adidas page diagnostic
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

async function diagnoseAdidas() {
  console.log('🔍 Detailed Adidas outlet diagnosis...\n');

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
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    console.log('📄 Loading page...');
    await page.goto('https://www.adidas.com/us/outlet', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('✅ Page loaded\n');

    // Save full HTML
    const html = await page.content();
    fs.writeFileSync('/tmp/adidas-page.html', html);
    console.log('💾 Full HTML saved to /tmp/adidas-page.html\n');

    // Get page title
    const title = await page.title();
    console.log(`📄 Page title: ${title}\n`);

    // Check for common product selectors
    const analysis = await page.evaluate(() => {
      const results = {
        totalElements: document.querySelectorAll('*').length,
        bodyClasses: document.body.className,
        bodyId: document.body.id,
        productSelectors: {}
      };

      const selectorsToCheck = [
        '[data-auto-id="plp-product"]',
        '[data-auto-id*="product"]',
        '.plp-product',
        '.product-card',
        '.grid-item',
        '[class*="product"]',
        '[class*="card"]',
        '[class*="plp"]',
        'article'
      ];

      selectorsToCheck.forEach(selector => {
        const count = document.querySelectorAll(selector).length;
        if (count > 0) {
          results.productSelectors[selector] = count;

          // Get first element details
          const first = document.querySelector(selector);
          if (first) {
            results.productSelectors[selector + '_sample'] = {
              tagName: first.tagName,
              className: first.className,
              id: first.id,
              innerHTML: first.innerHTML.substring(0, 200)
            };
          }
        }
      });

      return results;
    });

    console.log('📊 Page Analysis:');
    console.log(`   Total elements: ${analysis.totalElements}`);
    console.log(`   Body classes: ${analysis.bodyClasses}`);
    console.log(`   Body ID: ${analysis.bodyId}\n`);

    console.log('🔍 Product Elements Found:');
    if (Object.keys(analysis.productSelectors).length === 0) {
      console.log('   ❌ No product elements found');
    } else {
      Object.entries(analysis.productSelectors).forEach(([selector, count]) => {
        if (!selector.includes('_sample')) {
          console.log(`   ✅ ${selector}: ${count} elements`);
        }
      });
    }

    // Get first 500 chars of body text
    const bodyText = await page.evaluate(() => document.body.textContent.substring(0, 500));
    console.log(`\n📝 Body text preview:\n${bodyText}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

diagnoseAdidas();
