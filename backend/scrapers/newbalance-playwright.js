/**
 * New Balance scraper using Playwright with Firefox
 * Firefox has better anti-fingerprinting and is less detected
 */

const { firefox } = require('playwright');
const fs = require('fs');

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function scrapeNewBalance() {
  console.log('Starting New Balance Playwright scraper...');
  console.log('Using Firefox for better anti-detection');
  console.log('');

  const browser = await firefox.launch({
    headless: true,
    firefoxUserPrefs: {
      'privacy.trackingprotection.enabled': false,
      'network.http.referer.XOriginPolicy': 0
    }
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    geolocation: { latitude: 40.7128, longitude: -74.0060 },
    permissions: ['geolocation']
  });

  const page = await context.newPage();

  // Block unnecessary resources to speed up
  await page.route('**/*.{png,jpg,jpeg,gif,webp,svg}', route => route.abort());
  await page.route('**/analytics**', route => route.abort());
  await page.route('**/tracking**', route => route.abort());

  try {
    console.log('Navigating to New Balance sale page...');

    await page.goto('https://www.newbalance.com/sale/', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    console.log('Page loaded, waiting for dynamic content...');
    await delay(8000);

    // Get page title
    const title = await page.title();
    console.log(`Page title: ${title}`);

    // Check if blocked
    const bodyText = await page.textContent('body');
    if (bodyText.includes('Oops') || bodyText.includes('Something went wrong')) {
      console.log('Page blocked. Content preview:', bodyText.substring(0, 200));

      // Save the blocked page for analysis
      const content = await page.content();
      fs.writeFileSync('/tmp/nb-blocked.html', content);

    } else {
      console.log('Page loaded successfully!');

      // Take screenshot
      await page.screenshot({ path: '/tmp/nb-playwright.png', fullPage: false });

      // Scroll to load more products
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await delay(2000);
      }

      // Extract products
      const products = await page.evaluate(() => {
        const items = [];

        // Try to find product containers
        const containers = document.querySelectorAll('[data-pid], [data-product-id], [class*="product-tile"], article[class*="product"]');

        containers.forEach(container => {
          try {
            const link = container.querySelector('a[href*="/pd/"]') || container.querySelector('a');
            const img = container.querySelector('img');
            const nameEl = container.querySelector('[class*="name"], [class*="title"], h2, h3, h4');

            let originalPrice = '';
            let salePrice = '';

            // Find prices
            const priceEls = container.querySelectorAll('[class*="price"]');
            priceEls.forEach(el => {
              const text = el.textContent.trim();
              if (text.includes('$')) {
                const style = window.getComputedStyle(el);
                if (style.textDecoration.includes('line-through') || el.className.includes('was') || el.className.includes('original')) {
                  originalPrice = text;
                } else {
                  salePrice = text;
                }
              }
            });

            if (link && nameEl) {
              items.push({
                name: nameEl.textContent.trim(),
                url: link.href,
                image: img ? (img.src || img.dataset.src) : '',
                originalPrice,
                salePrice
              });
            }
          } catch (e) {}
        });

        return items;
      });

      console.log(`Found ${products.length} products`);

      if (products.length > 0) {
        fs.writeFileSync('/tmp/nb-playwright-products.json', JSON.stringify(products, null, 2));
        console.log('Saved products to /tmp/nb-playwright-products.json');
      }

      // Save page content
      const content = await page.content();
      fs.writeFileSync('/tmp/nb-playwright.html', content);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

// Check if playwright is installed
try {
  require('playwright');
  scrapeNewBalance();
} catch (e) {
  console.error('Playwright not installed. Install with: npm install playwright');
  console.error('Then run: npx playwright install firefox');
}
