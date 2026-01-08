#!/usr/bin/env node

/**
 * Debug script to understand Urban Outfitters page structure
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function debug() {
  console.log('Starting debug...');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080'
    ]
  });

  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  await page.setViewport({ width: 1920, height: 1080 });

  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
  });

  console.log('Navigating to Urban Outfitters sale page...');

  try {
    await page.goto('https://www.urbanoutfitters.com/sale', {
      waitUntil: 'networkidle2',
      timeout: 45000
    });

    console.log('Page loaded!');
    console.log('URL:', page.url());

    // Wait a bit for dynamic content
    await new Promise(r => setTimeout(r, 5000));

    // Get page title
    const title = await page.title();
    console.log('Page title:', title);

    // Save screenshot
    await page.screenshot({ path: '/tmp/uo-debug.png', fullPage: false });
    console.log('Screenshot saved to /tmp/uo-debug.png');

    // Save HTML
    const html = await page.content();
    fs.writeFileSync('/tmp/uo-debug.html', html);
    console.log('HTML saved to /tmp/uo-debug.html');
    console.log('HTML length:', html.length);

    // Look for various elements
    const elementChecks = [
      '[data-testid="product-tile"]',
      '.c-pwa-tile',
      '.c-pwa-product-tile',
      '.s-pwa-product-grid__tile',
      '[class*="ProductCard"]',
      '[class*="product-card"]',
      '[class*="tile"]',
      '[class*="Tile"]',
      'article',
      '[class*="grid"]',
      '[class*="product"]',
      'a[href*="/shop/"]',
      'a[href*="/product/"]',
      'img[src*="images.urbanoutfitters.com"]',
      '[class*="price"]',
      '.o-pwa-product-grid',
      '.c-pwa-category-page'
    ];

    console.log('\n--- Element checks ---');
    for (const selector of elementChecks) {
      const count = await page.$$eval(selector, els => els.length).catch(() => 0);
      if (count > 0) {
        console.log(`${selector}: ${count} elements`);
      }
    }

    // Get all class names on the page to understand structure
    const allClasses = await page.evaluate(() => {
      const classes = new Set();
      document.querySelectorAll('*').forEach(el => {
        if (el.className && typeof el.className === 'string') {
          el.className.split(' ').forEach(c => {
            if (c && (c.toLowerCase().includes('product') || c.toLowerCase().includes('tile') || c.toLowerCase().includes('grid') || c.toLowerCase().includes('card'))) {
              classes.add(c);
            }
          });
        }
      });
      return Array.from(classes).slice(0, 50);
    });

    console.log('\n--- Relevant class names found ---');
    console.log(allClasses.join(', '));

    // Look for any links to products
    const productLinks = await page.$$eval('a[href]', links => {
      return links
        .map(l => l.href)
        .filter(h => h.includes('/shop/') || h.includes('/product/'))
        .slice(0, 10);
    });

    console.log('\n--- Product links found ---');
    productLinks.forEach(l => console.log(l));

    // Look for images
    const images = await page.$$eval('img', imgs => {
      return imgs
        .map(i => i.src)
        .filter(s => s && (s.includes('urbanoutfitters.com') || s.includes('images')))
        .slice(0, 10);
    });

    console.log('\n--- Images found ---');
    images.forEach(i => console.log(i));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
