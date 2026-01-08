/**
 * Check Uniqlo Product Detail Page for original prices
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function checkPdp() {
  console.log('Checking Uniqlo product detail pages for original prices...');

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

  // Product IDs from the sale page
  const productIds = [
    'E481195-000', // Ultra Light Down Long Coat
    'E479588-000', // Ribbed High Neck T-Shirt
    'E479157-000', // Souffle Yarn Sweater
    'E450543-000', // Cashmere Sweater
    'E478280-000'  // Seamless Down Coat
  ];

  for (const productId of productIds) {
    const url = `https://www.uniqlo.com/us/en/products/${productId}/00`;
    console.log(`\n\nChecking: ${url}`);

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 2000));

      // Look for all price-related elements
      const priceInfo = await page.evaluate(() => {
        const result = {
          allPrices: [],
          strikethroughPrices: [],
          promotionalPrices: [],
          regularPrices: [],
          productName: null
        };

        // Get product name
        const nameEl = document.querySelector('h1');
        result.productName = nameEl ? nameEl.textContent.trim() : 'Unknown';

        // Get the main price area
        const priceArea = document.querySelector('[class*="price"]');
        if (priceArea) {
          const allPriceTexts = priceArea.innerHTML.match(/\$[\d.]+/g) || [];
          result.allPrices = allPriceTexts;
        }

        // Look for promotional prices (red/sale color)
        const promoElements = document.querySelectorAll('[class*="promotional"], [class*="sale"], [style*="color: red"]');
        promoElements.forEach(el => {
          const match = el.textContent.match(/\$[\d.]+/);
          if (match) result.promotionalPrices.push(match[0]);
        });

        // Look for strikethrough prices
        document.querySelectorAll('*').forEach(el => {
          const style = window.getComputedStyle(el);
          if (style.textDecoration.includes('line-through')) {
            const match = el.textContent.match(/\$[\d.]+/);
            if (match) result.strikethroughPrices.push(match[0]);
          }
        });

        // Look for "Was" / "Now" price patterns
        const bodyText = document.body.textContent;
        const wasMatch = bodyText.match(/Was:?\s*\$?([\d.]+)/i);
        const nowMatch = bodyText.match(/Now:?\s*\$?([\d.]+)/i);
        if (wasMatch) result.wasPrice = wasMatch[1];
        if (nowMatch) result.nowPrice = nowMatch[1];

        return result;
      });

      console.log(`  Product: ${priceInfo.productName}`);
      console.log(`  All prices found: ${priceInfo.allPrices.join(', ') || 'None'}`);
      console.log(`  Promotional prices: ${priceInfo.promotionalPrices.join(', ') || 'None'}`);
      console.log(`  Strikethrough prices: ${priceInfo.strikethroughPrices.join(', ') || 'None'}`);
      if (priceInfo.wasPrice) console.log(`  Was: $${priceInfo.wasPrice}`);
      if (priceInfo.nowPrice) console.log(`  Now: $${priceInfo.nowPrice}`);

      // Also check the API for this specific product
      const apiResponse = await page.evaluate(async (id) => {
        try {
          const res = await fetch(`https://www.uniqlo.com/us/api/commerce/v5/en/products/${id}/price-groups/00/l2s?withPrices=true&withStocks=true&includePreviousPrice=true&httpFailure=true`);
          return await res.json();
        } catch (e) {
          return null;
        }
      }, productId);

      if (apiResponse?.result?.prices) {
        const prices = apiResponse.result.prices;
        const firstKey = Object.keys(prices)[0];
        if (firstKey) {
          const priceData = prices[firstKey];
          console.log(`  API base price: $${priceData.base?.value}`);
          console.log(`  API promo price: $${priceData.promo?.value}`);
          if (priceData.previous) {
            console.log(`  API previous price: $${priceData.previous?.value}`);
          }
        }
      }

    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }

  await browser.close();
}

checkPdp().catch(console.error);
