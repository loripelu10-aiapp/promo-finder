/**
 * Analyze Uniqlo sale page structure
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function analyze() {
  console.log('Analyzing Uniqlo sale page structure...');

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

  console.log('Navigating to women\'s sale page...');
  await page.goto('https://www.uniqlo.com/us/en/feature/sale/women', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  console.log('Waiting for content to load...');
  await new Promise(r => setTimeout(r, 5000));

  // Scroll to load more
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 2000));
  }

  // Analyze the page structure
  const analysis = await page.evaluate(() => {
    const results = {
      products: []
    };

    // Find all links to products
    const productLinks = document.querySelectorAll('a[href*="/products/"]');
    console.log(`Found ${productLinks.length} product links`);

    productLinks.forEach((link, index) => {
      if (index >= 10) return; // Analyze first 10 only

      const product = {
        index,
        href: link.href,
        text: link.textContent?.trim().substring(0, 200),
        className: link.className,
        parentClasses: [],
        images: [],
        priceInfo: null
      };

      // Get parent structure
      let parent = link.parentElement;
      for (let i = 0; i < 5 && parent; i++) {
        product.parentClasses.push({
          tag: parent.tagName,
          className: parent.className?.substring(0, 100)
        });
        parent = parent.parentElement;
      }

      // Look for images in the link or nearby
      const imgs = link.querySelectorAll('img');
      imgs.forEach(img => {
        product.images.push({
          src: img.src,
          dataSrc: img.dataset?.src,
          srcset: img.srcset?.substring(0, 200)
        });
      });

      // Get all text content and look for price patterns
      const allText = link.textContent || '';
      const priceMatches = allText.match(/\$[\d.]+/g);
      if (priceMatches) {
        product.priceInfo = priceMatches;
      }

      results.products.push(product);
    });

    return results;
  });

  console.log('\n=== Product Structure Analysis ===');
  analysis.products.forEach((p, i) => {
    console.log(`\nProduct ${i + 1}:`);
    console.log(`  URL: ${p.href}`);
    console.log(`  Class: ${p.className}`);
    console.log(`  Text: ${p.text?.substring(0, 100)}...`);
    console.log(`  Prices found: ${JSON.stringify(p.priceInfo)}`);
    console.log(`  Images: ${p.images.length}`);
    if (p.images.length > 0) {
      console.log(`    First image src: ${p.images[0].src?.substring(0, 100)}`);
    }
    console.log(`  Parent hierarchy:`);
    p.parentClasses.forEach((pc, j) => {
      console.log(`    ${j}. ${pc.tag}: ${pc.className}`);
    });
  });

  // Save HTML for reference
  const html = await page.content();
  fs.writeFileSync('/tmp/uniqlo-sale-page.html', html);
  console.log('\nSaved page HTML to /tmp/uniqlo-sale-page.html');

  // Take a screenshot
  await page.screenshot({ path: '/tmp/uniqlo-sale-page.png', fullPage: false });
  console.log('Saved screenshot to /tmp/uniqlo-sale-page.png');

  // Get detailed structure of first product
  console.log('\n=== First Product Detailed Structure ===');
  const firstProductDetail = await page.evaluate(() => {
    const link = document.querySelector('a[href*="/products/"]');
    if (!link) return null;

    // Function to get element details
    function getDetails(el, depth = 0) {
      if (depth > 3) return null;
      return {
        tag: el.tagName,
        className: el.className?.substring(0, 100),
        id: el.id,
        text: el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 ?
              el.textContent.trim().substring(0, 50) : null,
        children: Array.from(el.children).slice(0, 5).map(c => getDetails(c, depth + 1))
      };
    }

    // Get the product card container (go up until we find something substantial)
    let container = link;
    while (container.parentElement && !container.className?.includes('tile') && !container.className?.includes('card') && !container.className?.includes('product')) {
      container = container.parentElement;
      if (container.tagName === 'BODY') break;
    }

    return {
      containerClass: container.className,
      containerTag: container.tagName,
      structure: getDetails(container)
    };
  });

  console.log(JSON.stringify(firstProductDetail, null, 2));

  await browser.close();
}

analyze().catch(console.error);
