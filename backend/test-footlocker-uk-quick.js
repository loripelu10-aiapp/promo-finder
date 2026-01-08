/**
 * Quick Foot Locker UK Test with Updated Selectors
 * Based on /tmp/footlocker-uk-debug.png analysis
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function testFootLockerUK() {
  console.log('\n🔍 Testing Foot Locker UK with corrected selectors...\n');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false, // Show browser to see what's happening
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    const url = 'https://www.footlocker.co.uk/en/search?query=adidas%20trainers%20sale';
    console.log(`📄 Loading: ${url}\n`);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for page to fully load
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Save new screenshot
    await page.screenshot({ path: '/tmp/footlocker-uk-test2.png', fullPage: false });

    // Try to find products with various selectors
    const selectorTests = [
      'article',
      '[class*="ProductCard"]',
      '[class*="product"]',
      'a[href*="/product/"]',
      'div[class*="grid"] > div',
      '[data-testid*="product"]'
    ];

    console.log('Testing selectors:\n');

    for (const selector of selectorTests) {
      try {
        const count = await page.$$eval(selector, els => els.length);
        console.log(`  ${selector.padEnd(40)} → ${count} elements`);

        if (count > 0 && count < 50) {
          // Sample the HTML
          const sample = await page.$$eval(selector, els => {
            return els.slice(0, 2).map(el => ({
              tag: el.tagName,
              classes: el.className,
              innerText: el.innerText?.substring(0, 100)
            }));
          });

          console.log(`     Sample:`, JSON.stringify(sample[0], null, 2).substring(0, 300));
        }
      } catch (e) {
        console.log(`  ${selector.padEnd(40)} → Error: ${e.message}`);
      }
    }

    // Try to extract products using article selector
    console.log('\n\n🔍 Extracting products using best selector...\n');

    const products = await page.evaluate(() => {
      // Try article tag (common for product cards)
      let cards = document.querySelectorAll('article');

      if (cards.length === 0) {
        // Fallback: look for links to product pages
        cards = document.querySelectorAll('a[href*="/product/"]');
      }

      const results = [];

      cards.forEach((card, idx) => {
        if (idx >= 5) return; // Just test first 5

        try {
          const name = card.querySelector('[class*="name"], [class*="title"], h2, h3, strong')?.textContent?.trim();
          const priceEl = card.querySelector('[class*="price"]');
          const price = priceEl?.textContent?.trim();
          const link = card.querySelector('a')?.href || card.href;

          if (name || price || link) {
            results.push({
              name: name || 'N/A',
              price: price || 'N/A',
              link: link || 'N/A',
              html: card.outerHTML.substring(0, 500)
            });
          }
        } catch (e) {}
      });

      return results;
    });

    console.log(`Found ${products.length} potential products:\n`);
    products.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name}`);
      console.log(`   Price: ${p.price}`);
      console.log(`   Link: ${p.link?.substring(0, 80)}...`);
      console.log('');
    });

    await browser.close();

  } catch (error) {
    console.error('Error:', error.message);
    if (browser) await browser.close();
  }
}

testFootLockerUK();
