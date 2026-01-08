/**
 * Detailed HTML diagnostic for Nike price elements
 */

const puppeteer = require('puppeteer');

async function diagnoseNikeHTML() {
  console.log('🔍 Extracting actual price HTML from Nike page...\n');

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  try {
    await page.goto('https://www.nike.com/w/sale-3yaep', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await page.waitForSelector('.product-card', { timeout: 10000 });

    const priceDetails = await page.evaluate(() => {
      const cards = document.querySelectorAll('.product-card');
      const results = [];

      // Analyze first 3 products
      for (let i = 0; i < Math.min(3, cards.length); i++) {
        const card = cards[i];
        const name = card.querySelector('.product-card__title, .product-card__subtitle')?.textContent.trim();

        // Get ALL elements that might contain prices
        const allPriceElements = card.querySelectorAll('[data-testid*="price"], [class*="price"]');

        const priceElementDetails = Array.from(allPriceElements).map(el => ({
          tagName: el.tagName,
          className: el.className,
          textContent: el.textContent.trim(),
          innerHTML: el.innerHTML.substring(0, 200),
          dataTestId: el.getAttribute('data-testid'),
          children: el.children.length
        }));

        results.push({
          name: name || 'Unknown',
          priceElementCount: allPriceElements.length,
          priceElements: priceElementDetails
        });
      }

      return results;
    });

    console.log('📋 Detailed price element analysis:\n');
    priceDetails.forEach((item, i) => {
      console.log(`${i + 1}. ${item.name}`);
      console.log(`   Total price elements found: ${item.priceElementCount}\n`);

      item.priceElements.forEach((el, j) => {
        console.log(`   Element ${j + 1}:`);
        console.log(`     Tag: ${el.tagName}`);
        console.log(`     Class: ${el.className}`);
        console.log(`     data-testid: ${el.dataTestId}`);
        console.log(`     Children count: ${el.children}`);
        console.log(`     Text: "${el.textContent}"`);
        console.log(`     HTML: ${el.innerHTML.substring(0, 150)}`);
        console.log('');
      });
      console.log('---\n');
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

diagnoseNikeHTML();
