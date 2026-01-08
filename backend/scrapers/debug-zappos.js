/**
 * Debug script to understand Zappos page structure
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function debugZappos() {
  console.log('Starting Zappos debug...');

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

  try {
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    // Try different Zappos sale URLs
    const testUrls = [
      'https://www.zappos.com/marty/filters/facet_field_discount/%22On%20Sale%22',
      'https://www.zappos.com/women~/CK_XARCz1wHiAgMBAhg.zso?s=percentOff/desc/',
      'https://www.zappos.com/filters/percentOff/10-100',
      'https://www.zappos.com/marty/landing/sale',
      'https://www.zappos.com/c/sale'
    ];

    for (const url of testUrls) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Testing: ${url}`);
      console.log('='.repeat(60));

      try {
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 60000
        });

        const pageTitle = await page.title();
        console.log(`Page title: ${pageTitle}`);

        const pageUrl = page.url();
        console.log(`Final URL: ${pageUrl}`);

        // Wait a bit for dynamic content
        await new Promise(r => setTimeout(r, 3000));

        // Get page info
        const pageInfo = await page.evaluate(() => {
          const info = {
            articleCount: document.querySelectorAll('article').length,
            productIdCount: document.querySelectorAll('[data-product-id]').length,
            aHrefs: document.querySelectorAll('a[href*="/p/"]').length,
            imgCount: document.querySelectorAll('img').length,
            priceElements: document.querySelectorAll('[class*="price"], [class*="Price"]').length,
            sampleClasses: [],
            sampleLinks: [],
            sampleImages: [],
            bodyText: document.body.innerText.substring(0, 500)
          };

          // Get sample classes
          document.querySelectorAll('*').forEach((el, i) => {
            if (i < 100 && el.className && typeof el.className === 'string' && el.className.includes('product')) {
              info.sampleClasses.push(el.className);
            }
          });

          // Get sample links
          document.querySelectorAll('a').forEach((el, i) => {
            if (i < 20 && el.href.includes('/p/')) {
              info.sampleLinks.push(el.href);
            }
          });

          // Get sample images
          document.querySelectorAll('img').forEach((el, i) => {
            if (i < 10 && el.src) {
              info.sampleImages.push(el.src);
            }
          });

          return info;
        });

        console.log('\nPage info:');
        console.log(`  Articles: ${pageInfo.articleCount}`);
        console.log(`  [data-product-id]: ${pageInfo.productIdCount}`);
        console.log(`  Links with /p/: ${pageInfo.aHrefs}`);
        console.log(`  Images: ${pageInfo.imgCount}`);
        console.log(`  Price elements: ${pageInfo.priceElements}`);

        if (pageInfo.sampleClasses.length > 0) {
          console.log(`\nSample product classes (first 5):`);
          pageInfo.sampleClasses.slice(0, 5).forEach(c => console.log(`  ${c}`));
        }

        if (pageInfo.sampleLinks.length > 0) {
          console.log(`\nSample product links (first 5):`);
          pageInfo.sampleLinks.slice(0, 5).forEach(l => console.log(`  ${l}`));
        }

        if (pageInfo.sampleImages.length > 0) {
          console.log(`\nSample images (first 5):`);
          pageInfo.sampleImages.slice(0, 5).forEach(i => console.log(`  ${i}`));
        }

        console.log(`\nBody text preview:`);
        console.log(pageInfo.bodyText);

        // If we found products, stop here
        if (pageInfo.aHrefs > 10 || pageInfo.articleCount > 10 || pageInfo.productIdCount > 10) {
          console.log('\n*** Found products on this URL! ***');
          break;
        }

      } catch (error) {
        console.log(`Error: ${error.message}`);
      }
    }

    // Try the working URL and extract full HTML structure
    console.log('\n\n' + '='.repeat(60));
    console.log('Trying to analyze a working product page...');
    console.log('='.repeat(60));

    await page.goto('https://www.zappos.com/women~/CK_XARCz1wHiAgMBAhg.zso?s=percentOff/desc/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(r => setTimeout(r, 5000));

    // Scroll to load more
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(r => setTimeout(r, 2000));
    }

    // Get detailed product structure
    const productStructure = await page.evaluate(() => {
      const results = [];

      // Try to find product cards
      const cards = document.querySelectorAll('article, [class*="product"]');

      cards.forEach((card, i) => {
        if (i >= 3) return; // Just first 3

        const info = {
          tagName: card.tagName,
          className: card.className,
          innerHTML: card.innerHTML.substring(0, 2000),
          links: [],
          images: [],
          texts: []
        };

        card.querySelectorAll('a').forEach(a => {
          if (a.href) info.links.push(a.href);
        });

        card.querySelectorAll('img').forEach(img => {
          if (img.src) info.images.push(img.src);
        });

        card.querySelectorAll('*').forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.length < 100 && text.match(/\$[\d,.]+/)) {
            info.texts.push({ tag: el.tagName, class: el.className, text });
          }
        });

        results.push(info);
      });

      return results;
    });

    console.log('\nProduct card structure:');
    productStructure.forEach((card, i) => {
      console.log(`\n--- Card ${i + 1} ---`);
      console.log(`Tag: ${card.tagName}`);
      console.log(`Class: ${card.className}`);
      console.log(`Links: ${card.links.slice(0, 3).join(', ')}`);
      console.log(`Images: ${card.images.slice(0, 2).join(', ')}`);
      console.log(`Price texts:`, card.texts.slice(0, 5));
    });

    // Save HTML for manual inspection
    const html = await page.content();
    fs.writeFileSync('/tmp/zappos-debug.html', html);
    console.log('\n\nFull HTML saved to /tmp/zappos-debug.html');

  } finally {
    await browser.close();
  }
}

debugZappos()
  .then(() => {
    console.log('\nDebug complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('Debug failed:', err);
    process.exit(1);
  });
