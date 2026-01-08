/**
 * Analyze Uniqlo product page to find both prices
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function analyze() {
  console.log('Analyzing Uniqlo product page structure...');

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

  // Visit a sale product page
  const productUrl = 'https://www.uniqlo.com/us/en/products/E481195-000/00';
  console.log(`Navigating to: ${productUrl}`);

  await page.goto(productUrl, {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await new Promise(r => setTimeout(r, 3000));

  // Analyze pricing structure
  const priceInfo = await page.evaluate(() => {
    const results = {
      prices: [],
      allPriceText: null,
      productName: null,
      relevantElements: []
    };

    // Get product name
    const nameEl = document.querySelector('h1, [class*="product-name"], [class*="ProductName"], [class*="title"]');
    if (nameEl) {
      results.productName = nameEl.textContent.trim();
    }

    // Find all elements with price-related content
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
      const text = el.textContent || '';
      const className = el.className || '';

      // Look for price patterns
      if (text.match(/\$[\d.]+/) && text.length < 100) {
        // Check if this element or its class suggests pricing
        if (className.toLowerCase().includes('price') ||
            className.toLowerCase().includes('sale') ||
            className.toLowerCase().includes('original') ||
            className.toLowerCase().includes('strikethrough') ||
            className.toLowerCase().includes('was') ||
            el.tagName === 'S' ||
            el.tagName === 'DEL') {
          results.relevantElements.push({
            tag: el.tagName,
            className: className.substring(0, 100),
            text: text.substring(0, 50),
            hasLineThrough: window.getComputedStyle(el).textDecoration.includes('line-through')
          });
        }
      }
    });

    // Look specifically for price containers
    const priceContainers = document.querySelectorAll('[class*="price"], [class*="Price"]');
    priceContainers.forEach(container => {
      const prices = container.textContent.match(/\$[\d.]+/g);
      if (prices) {
        results.prices.push({
          className: container.className?.substring(0, 100),
          prices: prices,
          fullText: container.textContent.substring(0, 100)
        });
      }
    });

    return results;
  });

  console.log('\n=== Product Page Price Analysis ===');
  console.log('Product Name:', priceInfo.productName);
  console.log('\nPrice containers found:');
  priceInfo.prices.forEach((p, i) => {
    console.log(`\n${i + 1}. Class: ${p.className}`);
    console.log(`   Prices: ${JSON.stringify(p.prices)}`);
    console.log(`   Full text: ${p.fullText}`);
  });

  console.log('\nRelevant price elements:');
  priceInfo.relevantElements.forEach((el, i) => {
    console.log(`  ${i + 1}. ${el.tag} (${el.className}) - "${el.text}" - Line-through: ${el.hasLineThrough}`);
  });

  // Save page for reference
  const html = await page.content();
  fs.writeFileSync('/tmp/uniqlo-product-page.html', html);
  console.log('\nSaved page HTML to /tmp/uniqlo-product-page.html');

  // Also check if there's JSON data embedded
  const jsonData = await page.evaluate(() => {
    // Look for __NEXT_DATA__ or similar embedded JSON
    const nextData = document.querySelector('script#__NEXT_DATA__');
    if (nextData) {
      try {
        return JSON.parse(nextData.textContent);
      } catch (e) {}
    }

    // Look for any script with product data
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const content = script.textContent || '';
      if (content.includes('"originalPrice"') || content.includes('"salePrice"') || content.includes('"prices"')) {
        return content.substring(0, 2000);
      }
    }
    return null;
  });

  if (jsonData) {
    console.log('\n=== Embedded JSON Data Found ===');
    console.log(typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData, null, 2).substring(0, 2000));
  }

  await browser.close();
}

analyze().catch(console.error);
