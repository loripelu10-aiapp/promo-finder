const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteerExtra.use(StealthPlugin());

async function debugAsos() {
  console.log('Debugging ASOS page structure...\n');

  const browser = await puppeteerExtra.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log('Loading ASOS sale page...');
    await page.goto('https://www.asos.com/us/women/sale/cat/?cid=7046', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait a bit for dynamic content
    await new Promise(r => setTimeout(r, 5000));

    // Scroll to trigger lazy loading
    await page.evaluate(async () => {
      for (let i = 0; i < 5; i++) {
        window.scrollTo(0, i * 1000);
        await new Promise(r => setTimeout(r, 500));
      }
      window.scrollTo(0, 0);
    });

    await new Promise(r => setTimeout(r, 3000));

    // Get page title and URL
    const title = await page.title();
    const url = page.url();
    console.log(`Page title: ${title}`);
    console.log(`Current URL: ${url}`);

    // Save screenshot
    await page.screenshot({ path: '/tmp/asos-debug.png', fullPage: false });
    console.log('Screenshot saved to /tmp/asos-debug.png');

    // Get page HTML structure
    const structure = await page.evaluate(() => {
      const info = {
        bodyClasses: document.body.className,
        productContainers: [],
        allArticles: [],
        allSectionTypes: [],
        priceElements: [],
        dataAttributes: []
      };

      // Find all articles
      document.querySelectorAll('article').forEach((el, i) => {
        if (i < 5) {
          info.allArticles.push({
            id: el.id,
            className: el.className,
            dataAttributes: Array.from(el.attributes)
              .filter(a => a.name.startsWith('data-'))
              .map(a => `${a.name}="${a.value}"`)
              .join(', '),
            innerHTML: el.innerHTML.substring(0, 500)
          });
        }
      });

      // Find any divs/sections that might contain products
      document.querySelectorAll('[class*="product"], [class*="Product"], [data-auto-id*="product"]').forEach((el, i) => {
        if (i < 10) {
          info.productContainers.push({
            tag: el.tagName,
            className: el.className,
            id: el.id,
            dataAutoId: el.getAttribute('data-auto-id')
          });
        }
      });

      // Find price elements
      document.querySelectorAll('[class*="price"], [class*="Price"]').forEach((el, i) => {
        if (i < 10) {
          info.priceElements.push({
            className: el.className,
            text: el.textContent.substring(0, 100)
          });
        }
      });

      // Check for any data attributes on body or main containers
      const main = document.querySelector('main, #main, [role="main"]');
      if (main) {
        info.mainElement = {
          tag: main.tagName,
          className: main.className,
          childrenCount: main.children.length
        };
      }

      // Look for section/div with product list
      document.querySelectorAll('section, div').forEach(el => {
        const childArticles = el.querySelectorAll('article');
        if (childArticles.length > 5) {
          info.allSectionTypes.push({
            tag: el.tagName,
            className: el.className?.substring(0, 100),
            articleCount: childArticles.length
          });
        }
      });

      return info;
    });

    console.log('\n--- Page Structure Analysis ---');
    console.log('Body classes:', structure.bodyClasses);
    console.log('\nMain element:', JSON.stringify(structure.mainElement, null, 2));
    console.log('\nProduct containers found:', structure.productContainers.length);
    structure.productContainers.forEach(c => console.log(`  - ${c.tag} class="${c.className}" data-auto-id="${c.dataAutoId}"`));

    console.log('\nSections with multiple articles:');
    structure.allSectionTypes.forEach(s => console.log(`  - ${s.tag} class="${s.className}" (${s.articleCount} articles)`));

    console.log('\nPrice elements found:', structure.priceElements.length);
    structure.priceElements.slice(0, 5).forEach(p => console.log(`  - class="${p.className}" text="${p.text}"`));

    console.log('\nArticles found:', structure.allArticles.length);
    structure.allArticles.forEach((a, i) => {
      console.log(`\n  Article ${i + 1}:`);
      console.log(`    className: ${a.className}`);
      console.log(`    data-attrs: ${a.dataAttributes}`);
      console.log(`    innerHTML preview: ${a.innerHTML.substring(0, 200)}...`);
    });

    // Save full HTML for analysis
    const html = await page.content();
    fs.writeFileSync('/tmp/asos-page.html', html);
    console.log('\nFull HTML saved to /tmp/asos-page.html');

    // Try to find products with broader selectors
    const productCount = await page.evaluate(() => {
      const selectors = [
        'article',
        '[data-auto-id="productTile"]',
        '[class*="productTile"]',
        'section article',
        'li article',
        '[class*="product_"]',
        '[class*="ProductTile"]',
        'a[href*="/prd/"]'
      ];

      const counts = {};
      selectors.forEach(sel => {
        counts[sel] = document.querySelectorAll(sel).length;
      });
      return counts;
    });

    console.log('\n--- Element Counts ---');
    Object.entries(productCount).forEach(([sel, count]) => {
      console.log(`${sel}: ${count}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

debugAsos().catch(console.error);
