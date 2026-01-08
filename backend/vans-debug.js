const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteerExtra.use(StealthPlugin());

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function debugVans() {
  console.log('Starting Vans debug scraper...');

  const browser = await puppeteerExtra.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080'
    ],
    defaultViewport: null
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    console.log('\nNavigating to Vans sale page...');
    await page.goto('https://www.vans.com/en-us/sale', {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    await delay(10000);

    // Accept cookies
    try {
      const cookieBtn = await page.$('#onetrust-accept-btn-handler');
      if (cookieBtn) {
        await cookieBtn.click();
        console.log('Accepted cookies');
        await delay(2000);
      }
    } catch (e) {}

    // Scroll down
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await delay(300);
    }

    await delay(3000);

    // Save HTML
    const html = await page.content();
    fs.writeFileSync('/tmp/vans-debug.html', html);
    console.log(`Saved HTML to /tmp/vans-debug.html (${html.length} chars)`);

    // Take screenshot
    await page.screenshot({ path: '/tmp/vans-debug.png', fullPage: true });
    console.log('Saved screenshot to /tmp/vans-debug.png');

    // Analyze page structure
    const analysis = await page.evaluate(() => {
      const results = {
        allClasses: [],
        productPatterns: [],
        links: [],
        images: []
      };

      // Find all class names containing product-related keywords
      const allElements = document.querySelectorAll('*');
      const classSet = new Set();

      allElements.forEach(el => {
        if (el.className && typeof el.className === 'string') {
          el.className.split(' ').forEach(c => {
            if (c.length > 3) {
              const lower = c.toLowerCase();
              if (lower.includes('product') || lower.includes('tile') || lower.includes('card') ||
                  lower.includes('item') || lower.includes('grid') || lower.includes('plp') ||
                  lower.includes('price') || lower.includes('sale')) {
                classSet.add(c);
              }
            }
          });
        }
      });

      results.allClasses = [...classSet].slice(0, 50);

      // Find links with product patterns
      const allLinks = document.querySelectorAll('a[href]');
      allLinks.forEach(link => {
        const href = link.href;
        if (href.includes('vans.com') && (href.includes('/product') || href.includes('/shoes/') || href.includes('/VN'))) {
          if (results.links.length < 20) {
            results.links.push({
              href: href.substring(0, 100),
              text: link.textContent.trim().substring(0, 50),
              className: link.className.substring(0, 100)
            });
          }
        }
      });

      // Find images
      const allImages = document.querySelectorAll('img');
      allImages.forEach(img => {
        const src = img.src || img.dataset.src || '';
        if (src.includes('vans') && !src.includes('svg') && !src.includes('icon')) {
          if (results.images.length < 10) {
            results.images.push({
              src: src.substring(0, 100),
              alt: (img.alt || '').substring(0, 50),
              parentClasses: (img.parentElement?.className || '').substring(0, 100)
            });
          }
        }
      });

      // Look for price patterns
      const bodyText = document.body.textContent || '';
      const priceMatches = bodyText.match(/\$\d+(\.\d{2})?/g) || [];
      results.priceCount = priceMatches.length;
      results.samplePrices = priceMatches.slice(0, 10);

      // Find elements with aria-label containing product
      const ariaElements = document.querySelectorAll('[aria-label*="product" i], [aria-label*="shoe" i]');
      results.ariaElements = [];
      ariaElements.forEach(el => {
        if (results.ariaElements.length < 10) {
          results.ariaElements.push({
            tagName: el.tagName,
            ariaLabel: el.getAttribute('aria-label')?.substring(0, 100),
            className: el.className.substring(0, 100)
          });
        }
      });

      // Check for data attributes
      const dataElements = document.querySelectorAll('[data-testid], [data-component], [data-product-id]');
      results.dataElements = [];
      dataElements.forEach(el => {
        if (results.dataElements.length < 20) {
          const testid = el.getAttribute('data-testid') || '';
          const component = el.getAttribute('data-component') || '';
          const productId = el.getAttribute('data-product-id') || '';
          if (testid || component || productId) {
            results.dataElements.push({
              tagName: el.tagName,
              testid,
              component,
              productId,
              className: el.className.substring(0, 50)
            });
          }
        }
      });

      return results;
    });

    console.log('\n=== PAGE ANALYSIS ===\n');
    console.log('Product-related classes found:', analysis.allClasses.slice(0, 20));
    console.log('\nProduct links found:', analysis.links.length);
    if (analysis.links.length > 0) {
      console.log('Sample links:');
      analysis.links.slice(0, 5).forEach(l => console.log(`  - ${l.href}`));
    }
    console.log('\nImages found:', analysis.images.length);
    console.log('Price patterns found:', analysis.priceCount);
    console.log('Sample prices:', analysis.samplePrices);
    console.log('\nData elements:', analysis.dataElements.slice(0, 10));
    console.log('\nAria elements:', analysis.ariaElements);

    // Save analysis
    fs.writeFileSync('/tmp/vans-analysis.json', JSON.stringify(analysis, null, 2));
    console.log('\nSaved analysis to /tmp/vans-analysis.json');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

debugVans().catch(console.error);
