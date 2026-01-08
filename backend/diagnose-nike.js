/**
 * Diagnostic script to inspect Nike sale page structure
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

async function diagnoseNikePage() {
  console.log('🔍 Diagnosing Nike sale page...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('📄 Loading page...');
    await page.goto('https://www.nike.com/w/sale-3yaep', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('✅ Page loaded\n');

    // Take screenshot
    await page.screenshot({ path: '/tmp/nike-sale-page.png', fullPage: false });
    console.log('📸 Screenshot saved to /tmp/nike-sale-page.png\n');

    // Check for various possible selectors
    const selectorsToCheck = [
      '.product-card',
      '.product-grid__items',
      '[data-testid="product-card"]',
      '.product-card__link-overlay',
      '[class*="product"]',
      '[class*="grid"]',
      '[class*="card"]',
      'article',
      '[role="gridcell"]'
    ];

    console.log('🔎 Checking for possible product containers:\n');

    for (const selector of selectorsToCheck) {
      const count = await page.$$eval(selector, elements => elements.length);
      if (count > 0) {
        console.log(`   ✅ ${selector}: ${count} elements`);
      } else {
        console.log(`   ❌ ${selector}: 0 elements`);
      }
    }

    // Get first few product-like elements and their HTML
    console.log('\n📋 Sample HTML structure:\n');

    const sampleHTML = await page.evaluate(() => {
      // Try to find any element that looks like a product
      const possibleContainers = document.querySelectorAll(
        '[class*="product"], [class*="card"], [class*="grid-item"], article'
      );

      if (possibleContainers.length > 0) {
        const first = possibleContainers[0];
        return {
          className: first.className,
          innerHTML: first.innerHTML.substring(0, 500)
        };
      }

      return { className: 'NONE_FOUND', innerHTML: 'No product elements found' };
    });

    console.log(`   Class: ${sampleHTML.className}`);
    console.log(`   HTML (first 500 chars):\n${sampleHTML.innerHTML}\n`);

    // Check for price elements
    const priceSelectors = [
      '.product-price',
      '[class*="price"]',
      '[data-testid*="price"]',
      '[class*="Price"]'
    ];

    console.log('💰 Checking for price elements:\n');

    for (const selector of priceSelectors) {
      const count = await page.$$eval(selector, elements => elements.length);
      if (count > 0) {
        console.log(`   ✅ ${selector}: ${count} elements`);

        // Get sample text
        const sample = await page.$$eval(selector, elements =>
          elements.slice(0, 2).map(el => el.textContent.trim())
        );
        console.log(`      Samples: ${JSON.stringify(sample)}`);
      } else {
        console.log(`   ❌ ${selector}: 0 elements`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

diagnoseNikePage();
