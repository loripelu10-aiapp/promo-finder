/**
 * Debug script to see actual price values extracted
 */

const puppeteer = require('puppeteer');

async function debugNikePrices() {
  console.log('🔍 Debugging Nike price extraction...\n');

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  try {
    await page.goto('https://www.nike.com/w/sale-3yaep', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await page.waitForSelector('.product-card', { timeout: 10000 });

    const debugData = await page.evaluate(() => {
      const cards = document.querySelectorAll('.product-card');
      const results = [];

      // Only check first 5 products
      for (let i = 0; i < Math.min(5, cards.length); i++) {
        const card = cards[i];

        try {
          const name = card.querySelector('.product-card__title, .product-card__subtitle')?.textContent.trim();
          const priceElements = card.querySelectorAll('[data-testid*="price"], .product-price');

          if (priceElements.length > 0) {
            const combinedText = priceElements[0].textContent.trim();
            const priceMatches = combinedText.match(/\$\s*(\d+(?:\.\d{2})?)/g);

            results.push({
              name: name || 'Unknown',
              combinedText,
              priceMatches: priceMatches || [],
              elementCount: priceElements.length
            });
          }
        } catch (error) {
          results.push({ error: error.message });
        }
      }

      return results;
    });

    console.log('📋 First 5 products:\n');
    debugData.forEach((item, i) => {
      console.log(`${i + 1}. ${item.name}`);
      console.log(`   Combined text: "${item.combinedText}"`);
      console.log(`   Price matches: ${JSON.stringify(item.priceMatches)}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

debugNikePrices();
