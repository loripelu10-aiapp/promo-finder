/**
 * Debug script to understand Uniqlo's page structure
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function debug() {
  console.log('Starting Uniqlo page debug...');

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

  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  await page.setViewport({ width: 1920, height: 1080 });

  console.log('Navigating to Uniqlo sale page...');

  await page.goto('https://www.uniqlo.com/us/en/sale', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  console.log('Page loaded. Waiting for content...');
  await new Promise(r => setTimeout(r, 5000));

  // Get page URL (check for redirects)
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);

  // Check if there's a category selector or if we need to go deeper
  const pageContent = await page.content();

  // Save HTML for analysis
  fs.writeFileSync('/tmp/uniqlo-page.html', pageContent);
  console.log('Saved page HTML to /tmp/uniqlo-page.html');

  // Look for product-related elements
  const analysis = await page.evaluate(() => {
    const results = {
      url: window.location.href,
      title: document.title,
      foundElements: {}
    };

    // Check various selectors
    const selectors = [
      'article',
      '[class*="product"]',
      '[class*="Product"]',
      '[class*="tile"]',
      '[class*="Tile"]',
      '[class*="item"]',
      '[class*="card"]',
      '[class*="Card"]',
      'a[href*="/products/"]',
      '[data-test]',
      '[data-testid]',
      'img[src*="uniqlo"]',
      '[class*="price"]',
      '[class*="Price"]'
    ];

    selectors.forEach(sel => {
      try {
        const elements = document.querySelectorAll(sel);
        if (elements.length > 0) {
          results.foundElements[sel] = {
            count: elements.length,
            samples: Array.from(elements).slice(0, 3).map(el => ({
              tagName: el.tagName,
              className: el.className?.substring?.(0, 200) || '',
              id: el.id,
              href: el.href,
              text: el.textContent?.substring(0, 100)
            }))
          };
        }
      } catch (e) {}
    });

    // Get all unique class names that might be relevant
    const allElements = document.querySelectorAll('*');
    const relevantClasses = new Set();
    allElements.forEach(el => {
      if (el.className && typeof el.className === 'string') {
        el.className.split(' ').forEach(cls => {
          if (cls.toLowerCase().includes('product') ||
              cls.toLowerCase().includes('tile') ||
              cls.toLowerCase().includes('item') ||
              cls.toLowerCase().includes('card') ||
              cls.toLowerCase().includes('price') ||
              cls.toLowerCase().includes('sale')) {
            relevantClasses.add(cls);
          }
        });
      }
    });
    results.relevantClasses = Array.from(relevantClasses).slice(0, 50);

    return results;
  });

  console.log('\n=== Page Analysis ===');
  console.log('Current URL:', analysis.url);
  console.log('Page Title:', analysis.title);
  console.log('\nRelevant Classes Found:', analysis.relevantClasses);
  console.log('\nElements Found:');
  Object.entries(analysis.foundElements).forEach(([sel, data]) => {
    console.log(`\n${sel}: ${data.count} elements`);
    data.samples.forEach((sample, i) => {
      console.log(`  ${i + 1}. ${sample.tagName} class="${sample.className.substring(0, 100)}"`);
      if (sample.href) console.log(`     href: ${sample.href}`);
    });
  });

  // Take a screenshot
  await page.screenshot({ path: '/tmp/uniqlo-page.png', fullPage: false });
  console.log('\nSaved screenshot to /tmp/uniqlo-page.png');

  await browser.close();
}

debug().catch(console.error);
