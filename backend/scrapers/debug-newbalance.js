/**
 * Debug script to analyze New Balance page structure
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function debug() {
  console.log('Starting New Balance page analysis...');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log('Navigating to New Balance sale page...');
    await page.goto('https://www.newbalance.com/sale/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('Page loaded, waiting for content...');
    await new Promise(r => setTimeout(r, 5000));

    // Take screenshot
    await page.screenshot({ path: '/tmp/newbalance-debug.png', fullPage: false });
    console.log('Screenshot saved to /tmp/newbalance-debug.png');

    // Get page title
    const title = await page.title();
    console.log(`Page title: ${title}`);

    // Get the page URL (check for redirects)
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    // Analyze the page structure
    const analysis = await page.evaluate(() => {
      const results = {
        allClasses: [],
        productRelated: [],
        priceRelated: [],
        imageHosts: [],
        links: [],
        potentialProducts: []
      };

      // Find all unique class names
      const allElements = document.querySelectorAll('*');
      const classSet = new Set();
      allElements.forEach(el => {
        if (el.className && typeof el.className === 'string') {
          el.className.split(' ').forEach(c => {
            if (c) classSet.add(c);
          });
        }
      });
      results.allClasses = Array.from(classSet).slice(0, 100);

      // Find product-related classes
      results.productRelated = Array.from(classSet).filter(c =>
        c.toLowerCase().includes('product') ||
        c.toLowerCase().includes('tile') ||
        c.toLowerCase().includes('card') ||
        c.toLowerCase().includes('item') ||
        c.toLowerCase().includes('grid')
      );

      // Find price-related elements
      results.priceRelated = Array.from(classSet).filter(c =>
        c.toLowerCase().includes('price') ||
        c.toLowerCase().includes('sale') ||
        c.toLowerCase().includes('discount')
      );

      // Find images and their hosts
      document.querySelectorAll('img').forEach(img => {
        if (img.src) {
          try {
            const url = new URL(img.src);
            if (!results.imageHosts.includes(url.host)) {
              results.imageHosts.push(url.host);
            }
          } catch (e) {}
        }
      });

      // Find product links
      document.querySelectorAll('a[href*="/pd/"], a[href*="/product/"], a[href*="-p-"]').forEach(a => {
        if (results.links.length < 10) {
          results.links.push({
            href: a.href,
            text: a.textContent?.trim().substring(0, 50)
          });
        }
      });

      // Try to find potential product containers
      const selectors = [
        'article',
        '[role="listitem"]',
        'li[class*="product"]',
        'div[class*="product"]',
        'div[data-testid]',
        '[class*="Tile"]',
        '[class*="Card"]'
      ];

      selectors.forEach(sel => {
        const elements = document.querySelectorAll(sel);
        if (elements.length > 0) {
          results.potentialProducts.push({
            selector: sel,
            count: elements.length,
            sampleClasses: elements[0].className?.substring(0, 100),
            sampleContent: elements[0].textContent?.substring(0, 100)
          });
        }
      });

      // Get body HTML snippet
      results.bodySnippet = document.body.innerHTML.substring(0, 5000);

      return results;
    });

    console.log('\n=== Page Analysis ===');
    console.log('\nProduct-related classes:');
    console.log(analysis.productRelated.slice(0, 20));

    console.log('\nPrice-related classes:');
    console.log(analysis.priceRelated);

    console.log('\nImage hosts:');
    console.log(analysis.imageHosts);

    console.log('\nProduct links found:');
    console.log(analysis.links);

    console.log('\nPotential product containers:');
    console.log(analysis.potentialProducts);

    // Save full analysis
    fs.writeFileSync('/tmp/newbalance-analysis.json', JSON.stringify(analysis, null, 2));
    console.log('\nFull analysis saved to /tmp/newbalance-analysis.json');

    // Save HTML snippet
    fs.writeFileSync('/tmp/newbalance-body.html', analysis.bodySnippet);
    console.log('HTML snippet saved to /tmp/newbalance-body.html');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

debug();
