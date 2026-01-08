/**
 * Diagnostic script to inspect Adidas outlet page structure
 */

const puppeteer = require('puppeteer');

async function diagnoseAdidasPage() {
  console.log('🔍 Diagnosing Adidas outlet page...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('📄 Loading page...');
    await page.goto('https://www.adidas.com/us/outlet', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('✅ Page loaded\n');

    // Take screenshot
    await page.screenshot({ path: '/tmp/adidas-outlet-page.png', fullPage: false });
    console.log('📸 Screenshot saved to /tmp/adidas-outlet-page.png\n');

    // Check for various possible selectors
    const selectorsToCheck = [
      '.grid-item',
      '[data-auto-id="glass-product-card"]',
      '.product-card',
      '[class*="product"]',
      '[class*="grid"]',
      '[class*="card"]',
      '[data-auto-id*="product"]',
      'article',
      '[class*="plp"]',
      '[class*="item"]'
    ];

    console.log('🔎 Checking for possible product containers:\n');

    for (const selector of selectorsToCheck) {
      const count = await page.$$eval(selector, elements => elements.length);
      if (count > 0) {
        console.log(`   ✅ ${selector}: ${count} elements`);
      }
    }

    // Get first product-like element structure
    console.log('\n📋 Sample HTML structure:\n');

    const sampleHTML = await page.evaluate(() => {
      // Try to find any element that looks like a product
      const possibleContainers = document.querySelectorAll(
        '[class*="product"], [class*="card"], [class*="grid"], [class*="plp"], article, [class*="item"]'
      );

      if (possibleContainers.length > 0) {
        const first = possibleContainers[0];
        return {
          className: first.className,
          tagName: first.tagName,
          innerHTML: first.innerHTML.substring(0, 300)
        };
      }

      return { className: 'NONE_FOUND', innerHTML: 'No product elements found' };
    });

    console.log(`   Tag: ${sampleHTML.tagName}`);
    console.log(`   Class: ${sampleHTML.className}`);
    console.log(`   HTML (first 300 chars):\n${sampleHTML.innerHTML}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

diagnoseAdidasPage();
