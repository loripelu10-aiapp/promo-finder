/**
 * Full Adidas page diagnostic with stealth
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function diagnoseAdidas() {
  console.log('🔍 Full Adidas diagnostic with stealth...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('📄 Loading page...');
    await page.goto('https://www.adidas.com/us/outlet', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('✅ Page loaded\n');

    // Wait for JavaScript to render
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Get page title and URL
    const title = await page.title();
    const url = page.url();
    console.log(`📄 Title: ${title}`);
    console.log(`🔗 URL: ${url}\n`);

    // Save full HTML
    const html = await page.content();
    fs.writeFileSync('/tmp/adidas-full.html', html);
    console.log('💾 HTML saved to /tmp/adidas-full.html\n');

    // Take screenshot
    await page.screenshot({ path: '/tmp/adidas-screenshot.png', fullPage: true });
    console.log('📸 Screenshot saved to /tmp/adidas-screenshot.png\n');

    // Comprehensive selector analysis
    const analysis = await page.evaluate(() => {
      const results = {
        allSelectors: {},
        bodyText: document.body.textContent.substring(0, 500),
        bodyClasses: document.body.className,
        mainContent: null
      };

      // Check all possible selectors
      const selectorsToCheck = [
        'div[class*="plp"]',
        'div[class*="product"]',
        'div[class*="grid"]',
        'div[class*="item"]',
        'div[class*="card"]',
        'article',
        '[data-auto-id*="product"]',
        '[data-auto-id*="plp"]',
        'a[href*="/"]'
      ];

      selectorsToCheck.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            results.allSelectors[selector] = elements.length;
          }
        } catch (e) {
          // Skip invalid selectors
        }
      });

      // Get main element
      const main = document.querySelector('main, [role="main"], #main');
      if (main) {
        results.mainContent = {
          tagName: main.tagName,
          className: main.className,
          id: main.id,
          childrenCount: main.children.length,
          innerHTML: main.innerHTML.substring(0, 1000)
        };
      }

      return results;
    });

    console.log('📊 Analysis Results:\n');
    console.log('Body classes:', analysis.bodyClasses);
    console.log('\nBody text preview:', analysis.bodyText.substring(0, 200));
    console.log('\n🔍 Elements found:');
    Object.entries(analysis.allSelectors).forEach(([selector, count]) => {
      console.log(`   ${selector}: ${count}`);
    });

    if (analysis.mainContent) {
      console.log('\n📦 Main content element:');
      console.log(`   Tag: ${analysis.mainContent.tagName}`);
      console.log(`   Class: ${analysis.mainContent.className}`);
      console.log(`   Children: ${analysis.mainContent.childrenCount}`);
      console.log(`   HTML preview: ${analysis.mainContent.innerHTML.substring(0, 300)}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

diagnoseAdidas();
