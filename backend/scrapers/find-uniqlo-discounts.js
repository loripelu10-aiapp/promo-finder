/**
 * Find Uniqlo pages with actual price discounts visible
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function findDiscounts() {
  console.log('Finding Uniqlo pages with visible discounts...');

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

  // Try various Uniqlo pages
  const urlsToCheck = [
    'https://www.uniqlo.com/us/en/feature/limited-offers/women',
    'https://www.uniqlo.com/us/en/feature/limited-offers/men',
    'https://www.uniqlo.com/us/en/feature/multi-buy',
    'https://www.uniqlo.com/us/en/special-deals',
    'https://www.uniqlo.com/us/en/promo'
  ];

  for (const url of urlsToCheck) {
    console.log(`\n\nChecking: ${url}`);
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      const finalUrl = page.url();
      console.log(`Final URL: ${finalUrl}`);

      if (finalUrl.includes('not-found')) {
        console.log('  -> Not found');
        continue;
      }

      // Look for products with both original and sale prices visible
      const productsWithDiscounts = await page.evaluate(() => {
        const results = [];
        const tiles = document.querySelectorAll('a.fr-ec-product-tile, a[href*="/products/"]');

        tiles.forEach(tile => {
          const text = tile.textContent || '';
          const priceMatches = text.match(/\$[\d.]+/g);

          if (priceMatches && priceMatches.length >= 2) {
            const prices = priceMatches.map(p => parseFloat(p.replace('$', '')));
            const uniquePrices = [...new Set(prices)].sort((a, b) => b - a);

            if (uniquePrices.length >= 2 && uniquePrices[0] > uniquePrices[1]) {
              const nameEl = tile.querySelector('h3, .fr-ec-title');
              results.push({
                name: nameEl ? nameEl.textContent.trim() : 'Unknown',
                originalPrice: uniquePrices[0],
                salePrice: uniquePrices[1],
                discount: Math.round(((uniquePrices[0] - uniquePrices[1]) / uniquePrices[0]) * 100)
              });
            }
          }
        });

        return results;
      });

      if (productsWithDiscounts.length > 0) {
        console.log(`  -> Found ${productsWithDiscounts.length} products with visible discounts!`);
        productsWithDiscounts.slice(0, 5).forEach(p => {
          console.log(`     ${p.name}: $${p.originalPrice} -> $${p.salePrice} (${p.discount}% off)`);
        });
      } else {
        console.log('  -> No products with visible dual prices');
      }

    } catch (e) {
      console.log(`  -> Error: ${e.message}`);
    }
  }

  // Also check the main sale page for any products that show original prices
  console.log('\n\nChecking sale page for strikethrough prices...');
  await page.goto('https://www.uniqlo.com/us/en/feature/sale/women', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await new Promise(r => setTimeout(r, 5000));

  // Scroll to load content
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 2000));
  }

  // Look for strikethrough prices
  const strikethroughPrices = await page.evaluate(() => {
    const results = [];

    // Look for any element with line-through style or strikethrough tags
    const allElements = document.querySelectorAll('s, del, [style*="line-through"], .strikethrough');
    allElements.forEach(el => {
      const text = el.textContent;
      if (text.includes('$')) {
        results.push({
          text: text.trim(),
          tag: el.tagName,
          parent: el.parentElement?.className?.substring(0, 50)
        });
      }
    });

    // Also check computed styles
    const potentialPriceElements = document.querySelectorAll('[class*="price"], p, span');
    potentialPriceElements.forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.textDecoration.includes('line-through') && el.textContent.includes('$')) {
        results.push({
          text: el.textContent.trim(),
          tag: el.tagName,
          computed: true
        });
      }
    });

    return results;
  });

  console.log(`Found ${strikethroughPrices.length} strikethrough price elements:`);
  strikethroughPrices.slice(0, 10).forEach(p => {
    console.log(`  ${p.tag}: "${p.text}" (parent: ${p.parent || 'computed'})`);
  });

  await browser.close();
}

findDiscounts().catch(console.error);
