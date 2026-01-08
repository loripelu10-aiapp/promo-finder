/**
 * Scan multiple Uniqlo products to find any with actual price differences
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function scanProducts() {
  console.log('Scanning Uniqlo products for actual price differences...');

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

  // Navigate to sale page and get all product IDs
  console.log('Getting product IDs from sale pages...');

  const allProductIds = [];

  for (const url of [
    'https://www.uniqlo.com/us/en/feature/sale/women',
    'https://www.uniqlo.com/us/en/feature/sale/men'
  ]) {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    // Scroll to load more
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(r => setTimeout(r, 1500));
    }

    const productIds = await page.evaluate(() => {
      const ids = [];
      document.querySelectorAll('a[href*="/products/E"]').forEach(a => {
        const match = a.href.match(/\/products\/(E\d+-\d+)/);
        if (match) ids.push(match[1]);
      });
      return [...new Set(ids)];
    });

    allProductIds.push(...productIds);
  }

  const uniqueIds = [...new Set(allProductIds)];
  console.log(`Found ${uniqueIds.length} unique product IDs`);

  // Check each product's API for price differences
  console.log('\nChecking API prices for all products...');

  const productsWithDiscounts = [];
  const productsWithSaleFlag = [];

  for (const productId of uniqueIds.slice(0, 50)) {
    try {
      const apiData = await page.evaluate(async (id) => {
        try {
          const res = await fetch(`https://www.uniqlo.com/us/api/commerce/v5/en/products/${id}/price-groups/00/l2s?withPrices=true&withStocks=true&httpFailure=true`);
          const data = await res.json();

          if (data.status !== 'ok') return null;

          const result = {
            productId: id,
            hasSaleFlag: false,
            prices: []
          };

          // Check for sale flags
          if (data.result.l2s) {
            data.result.l2s.forEach(l2 => {
              if (l2.flags?.priceFlags?.some(f => f.code === 'discount' || f.name === 'Sale')) {
                result.hasSaleFlag = true;
              }
            });
          }

          // Get prices
          if (data.result.prices) {
            Object.entries(data.result.prices).forEach(([key, priceData]) => {
              result.prices.push({
                base: priceData.base?.value,
                promo: priceData.promo?.value,
                previous: priceData.previous?.value
              });
            });
          }

          return result;
        } catch (e) {
          return null;
        }
      }, productId);

      if (apiData) {
        // Check if any price entries have different base/promo
        const hasPriceDiff = apiData.prices.some(p => p.base && p.promo && p.base !== p.promo);
        const hasPreviousPrice = apiData.prices.some(p => p.previous);

        if (hasPriceDiff || hasPreviousPrice) {
          productsWithDiscounts.push(apiData);
          console.log(`FOUND DISCOUNT: ${productId}`);
          apiData.prices.slice(0, 1).forEach(p => {
            console.log(`  Base: $${p.base}, Promo: $${p.promo}, Previous: ${p.previous ? '$' + p.previous : 'N/A'}`);
          });
        } else if (apiData.hasSaleFlag) {
          productsWithSaleFlag.push(apiData);
        }
      }

      // Small delay
      await new Promise(r => setTimeout(r, 100));

    } catch (e) {
      // Skip errors
    }
  }

  console.log('\n=== RESULTS ===');
  console.log(`Products checked: ${Math.min(uniqueIds.length, 50)}`);
  console.log(`Products with actual price differences: ${productsWithDiscounts.length}`);
  console.log(`Products with sale flag (no price diff): ${productsWithSaleFlag.length}`);

  if (productsWithDiscounts.length > 0) {
    console.log('\nProducts with discounts:');
    productsWithDiscounts.forEach(p => {
      console.log(`  ${p.productId}:`);
      p.prices.slice(0, 1).forEach(price => {
        const discount = price.base && price.promo && price.base > price.promo
          ? Math.round(((price.base - price.promo) / price.base) * 100)
          : 0;
        console.log(`    $${price.base} -> $${price.promo} (${discount}% off)`);
      });
    });
  }

  await browser.close();
}

scanProducts().catch(console.error);
