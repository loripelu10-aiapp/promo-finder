/**
 * Debug Gap page structure for non-jeans categories
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function debug() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1920, height: 1080 });

  console.log('Loading Gap tops page...\n');

  await page.goto('https://www.gapcanada.ca/browse/women/tops?cid=5753', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await new Promise(r => setTimeout(r, 5000));

  // Scroll to load more
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 2000));
  }

  // Get debug info
  const debug = await page.evaluate(() => {
    const result = {
      title: document.title,
      url: window.location.href,
      productCards: 0,
      allClasses: [],
      priceElements: [],
      sampleProducts: []
    };

    // Find potential product cards
    const cards = document.querySelectorAll('[class*="plp_product-card"], [class*="product-card"], [class*="ProductCard"], [data-testid*="product"]');
    result.productCards = cards.length;

    // Get first 3 cards HTML
    Array.from(cards).slice(0, 3).forEach((card, i) => {
      const cardInfo = {
        outerHTML: card.outerHTML.substring(0, 1500),
        innerText: card.innerText.substring(0, 500),
        prices: (card.innerText.match(/\$\d+\.?\d*/g) || [])
      };
      result.sampleProducts.push(cardInfo);
    });

    // Get all price-related elements
    const priceEls = document.querySelectorAll('[class*="price"], [class*="Price"]');
    Array.from(priceEls).slice(0, 10).forEach(el => {
      result.priceElements.push({
        class: el.className,
        text: el.innerText.substring(0, 100)
      });
    });

    // Find body text prices
    const bodyPrices = document.body.innerText.match(/\$\d+\.?\d*/g) || [];
    result.allPrices = bodyPrices.slice(0, 30);

    return result;
  });

  console.log('Page title:', debug.title);
  console.log('Product cards found:', debug.productCards);
  console.log('\nSample prices on page:', debug.allPrices.slice(0, 10).join(', '));

  console.log('\nPrice elements found:');
  debug.priceElements.forEach((p, i) => {
    console.log(`  ${i + 1}. Class: ${p.class.substring(0, 50)}, Text: ${p.text}`);
  });

  if (debug.sampleProducts.length > 0) {
    console.log('\nFirst product card text:');
    console.log(debug.sampleProducts[0].innerText);
    console.log('\nPrices in card:', debug.sampleProducts[0].prices.join(', '));
  }

  // Save HTML for analysis
  const html = await page.content();
  fs.writeFileSync('/tmp/gap-tops-page.html', html);
  console.log('\nHTML saved to /tmp/gap-tops-page.html');

  await page.screenshot({ path: '/tmp/gap-tops.png', fullPage: false });
  console.log('Screenshot saved to /tmp/gap-tops.png');

  await browser.close();
}

debug();
