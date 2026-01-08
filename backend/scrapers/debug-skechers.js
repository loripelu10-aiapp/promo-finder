/**
 * Debug Skechers page structure
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function debugSkechers() {
  console.log('Launching browser...');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    console.log('Navigating to Skechers sale page...');
    await page.goto('https://www.skechers.com/sale/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('Page loaded, waiting a bit for JS to execute...');
    await new Promise(r => setTimeout(r, 5000));

    // Take screenshot
    await page.screenshot({ path: '/tmp/skechers-debug.png', fullPage: false });
    console.log('Screenshot saved to /tmp/skechers-debug.png');

    // Get page title and URL
    const title = await page.title();
    const url = page.url();
    console.log(`\nPage title: ${title}`);
    console.log(`Page URL: ${url}`);

    // Analyze page structure
    const analysis = await page.evaluate(() => {
      const result = {
        bodyClasses: document.body.className,
        potentialProducts: [],
        priceElements: [],
        allClasses: new Set(),
        links: [],
        images: []
      };

      // Find all elements that might be product tiles
      const allDivs = document.querySelectorAll('div, article, li');
      allDivs.forEach(div => {
        if (div.className) {
          div.className.split(' ').forEach(c => {
            if (c.match(/product|tile|card|item|grid/i)) {
              result.allClasses.add(c);
            }
          });
        }
      });

      // Find elements with "product" in class
      const productElements = document.querySelectorAll('[class*="product"]');
      result.potentialProducts.push(`Found ${productElements.length} elements with "product" in class`);

      productElements.forEach((el, i) => {
        if (i < 5) {
          result.potentialProducts.push(`  ${i + 1}. ${el.tagName}.${el.className.substring(0, 100)}`);
        }
      });

      // Find elements with "tile" in class
      const tileElements = document.querySelectorAll('[class*="tile"]');
      result.potentialProducts.push(`Found ${tileElements.length} elements with "tile" in class`);

      tileElements.forEach((el, i) => {
        if (i < 5) {
          result.potentialProducts.push(`  ${i + 1}. ${el.tagName}.${el.className.substring(0, 100)}`);
        }
      });

      // Find price elements
      const priceElements = document.querySelectorAll('[class*="price"]');
      result.priceElements.push(`Found ${priceElements.length} elements with "price" in class`);
      priceElements.forEach((el, i) => {
        if (i < 10) {
          result.priceElements.push(`  ${i + 1}. ${el.tagName}.${el.className.substring(0, 100)}: "${el.textContent.trim().substring(0, 50)}"`);
        }
      });

      // Find links with product in href
      const productLinks = document.querySelectorAll('a[href*="product"], a[href*="/p/"], a[href*="/pd/"]');
      result.links.push(`Found ${productLinks.length} product links`);
      productLinks.forEach((el, i) => {
        if (i < 5) {
          result.links.push(`  ${i + 1}. ${el.href}`);
        }
      });

      // Find images
      const images = document.querySelectorAll('img');
      result.images.push(`Found ${images.length} images total`);

      // Check for specific Skechers elements
      const specificSelectors = [
        '.l-plp_grid',
        '.b-product_tile',
        '[data-product-tile]',
        '.product-grid',
        '.product-listing',
        '.products-container',
        '[data-component="productGrid"]'
      ];

      specificSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          result.potentialProducts.push(`Selector "${selector}" found ${elements.length} elements`);
        }
      });

      result.allClasses = Array.from(result.allClasses);

      return result;
    });

    console.log('\n=== PAGE ANALYSIS ===\n');
    console.log('Body classes:', analysis.bodyClasses);
    console.log('\nRelevant CSS classes found:', analysis.allClasses.slice(0, 30));
    console.log('\n--- Potential Products ---');
    analysis.potentialProducts.forEach(p => console.log(p));
    console.log('\n--- Price Elements ---');
    analysis.priceElements.forEach(p => console.log(p));
    console.log('\n--- Product Links ---');
    analysis.links.forEach(l => console.log(l));
    console.log('\n--- Images ---');
    analysis.images.forEach(i => console.log(i));

    // Get HTML snippet of first product-like element
    const htmlSnippet = await page.evaluate(() => {
      const productEl = document.querySelector('[class*="product-tile"], [class*="product_tile"], .b-product_tile, [data-product-tile], .l-plp_grid > *, [class*="product-card"]');
      if (productEl) {
        return productEl.outerHTML.substring(0, 2000);
      }

      // Try alternative - look at grid children
      const gridEl = document.querySelector('.l-plp_grid, .product-grid, [class*="product-list"], [class*="productGrid"]');
      if (gridEl && gridEl.children.length > 0) {
        return `Grid found with ${gridEl.children.length} children. First child:\n${gridEl.children[0].outerHTML.substring(0, 2000)}`;
      }

      return 'No product element found';
    });
    console.log('\n--- HTML Snippet of Product Element ---');
    console.log(htmlSnippet);

    // Get full HTML for deeper analysis
    const fullHTML = await page.content();
    require('fs').writeFileSync('/tmp/skechers-page.html', fullHTML);
    console.log('\nFull HTML saved to /tmp/skechers-page.html');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

debugSkechers();
