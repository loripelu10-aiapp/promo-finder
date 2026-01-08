/**
 * Comprehensive Retailer Diagnostic Tool
 *
 * Analyzes Dick's Sporting Goods and JD Sports HTML structure
 * to identify correct CSS selectors for product cards, prices, etc.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function analyzeSite(siteName, url, waitForSelectors = []) {
  console.log('\n' + '='.repeat(80));
  console.log(`🔍 ANALYZING: ${siteName}`);
  console.log('='.repeat(80));
  console.log(`URL: ${url}\n`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false, // Show browser for debugging
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080'
      ]
    });

    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('📄 Loading page...');

    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 90000 // 90 seconds
    });

    console.log(`✅ Page loaded: ${response.status()}`);
    console.log('⏳ Waiting 10 seconds for JavaScript to render...\n');

    await new Promise(resolve => setTimeout(resolve, 10000));

    // Take screenshot
    const screenshotPath = `/tmp/${siteName.toLowerCase().replace(/\s+/g, '-')}-analysis.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);

    // Save full HTML
    const html = await page.content();
    const htmlPath = `/tmp/${siteName.toLowerCase().replace(/\s+/g, '-')}-full.html`;
    fs.writeFileSync(htmlPath, html);
    console.log(`💾 Full HTML saved: ${htmlPath}\n`);

    // Analyze structure
    const analysis = await page.evaluate(() => {
      const results = {
        title: document.title,
        allClasses: new Set(),
        allDataAttrs: new Set(),
        possibleProductContainers: [],
        possiblePriceElements: [],
        possibleImageElements: [],
        possibleLinkElements: []
      };

      // Collect all unique classes and data attributes
      document.querySelectorAll('*').forEach(el => {
        if (el.className && typeof el.className === 'string') {
          el.className.split(/\s+/).forEach(cls => {
            if (cls && cls.length > 0) results.allClasses.add(cls);
          });
        }

        Array.from(el.attributes).forEach(attr => {
          if (attr.name.startsWith('data-')) {
            results.allDataAttrs.add(attr.name);
          }
        });
      });

      // Find potential product containers
      const containerKeywords = ['product', 'card', 'item', 'tile', 'listing'];
      containerKeywords.forEach(keyword => {
        // By class
        document.querySelectorAll(`[class*="${keyword}"]`).forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 100 && rect.height > 100) {
            results.possibleProductContainers.push({
              selector: el.className ? `.${el.className.split(/\s+/)[0]}` : el.tagName.toLowerCase(),
              count: document.querySelectorAll(`[class*="${keyword}"]`).length,
              sample: el.outerHTML.substring(0, 200)
            });
          }
        });

        // By data attribute
        document.querySelectorAll(`[data-*="${keyword}"], [data-*="${keyword}"]`).forEach(el => {
          const dataAttr = Array.from(el.attributes).find(a =>
            a.name.startsWith('data-') && a.value.includes(keyword)
          );
          if (dataAttr) {
            results.possibleProductContainers.push({
              selector: `[${dataAttr.name}]`,
              count: 1,
              sample: el.outerHTML.substring(0, 200)
            });
          }
        });
      });

      // Find price elements
      const priceSelectors = [
        '[class*="price"]', '[class*="Price"]',
        '[data-*="price"]', '[data-testid*="price"]',
        '.price', '.Price', '.sale-price', '.regular-price'
      ];

      priceSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            results.possiblePriceElements.push({
              selector,
              count: elements.length,
              samples: Array.from(elements).slice(0, 3).map(el => ({
                text: el.textContent.trim(),
                html: el.outerHTML.substring(0, 150)
              }))
            });
          }
        } catch (e) {}
      });

      // Find images
      const images = document.querySelectorAll('img');
      results.possibleImageElements = Array.from(images).slice(0, 10).map(img => ({
        src: img.src?.substring(0, 100),
        alt: img.alt,
        classes: img.className,
        parent: img.parentElement?.tagName
      }));

      // Find product links
      const links = document.querySelectorAll('a[href*="product"], a[href*="/p/"]');
      results.possibleLinkElements = Array.from(links).slice(0, 5).map(a => ({
        href: a.href?.substring(0, 100),
        text: a.textContent?.trim().substring(0, 50),
        classes: a.className
      }));

      // Convert Sets to Arrays
      results.allClasses = Array.from(results.allClasses).filter(c =>
        c.includes('product') || c.includes('card') || c.includes('item') ||
        c.includes('price') || c.includes('Price')
      );
      results.allDataAttrs = Array.from(results.allDataAttrs);

      return results;
    });

    console.log('📊 ANALYSIS RESULTS:');
    console.log('='.repeat(80));

    console.log(`\n📄 Page Title: ${analysis.title}`);

    console.log(`\n🏷️  Relevant Classes (${analysis.allClasses.length}):`);
    analysis.allClasses.slice(0, 30).forEach(cls => console.log(`   - ${cls}`));

    console.log(`\n📦 Data Attributes (${analysis.allDataAttrs.length}):`);
    analysis.allDataAttrs.slice(0, 20).forEach(attr => console.log(`   - ${attr}`));

    console.log(`\n📦 Possible Product Containers (${analysis.possibleProductContainers.length}):`);
    const uniqueContainers = [...new Map(analysis.possibleProductContainers.map(c => [c.selector, c])).values()];
    uniqueContainers.slice(0, 10).forEach(container => {
      console.log(`\n   Selector: ${container.selector}`);
      console.log(`   Count: ${container.count}`);
      console.log(`   Sample: ${container.sample}...`);
    });

    console.log(`\n💰 Possible Price Elements (${analysis.possiblePriceElements.length}):`);
    analysis.possiblePriceElements.slice(0, 10).forEach(price => {
      console.log(`\n   Selector: ${price.selector}`);
      console.log(`   Count: ${price.count}`);
      price.samples.forEach(s => console.log(`   - ${s.text}`));
    });

    console.log(`\n🖼️  Image Elements (${analysis.possibleImageElements.length}):`);
    analysis.possibleImageElements.slice(0, 5).forEach((img, i) => {
      console.log(`\n   Image ${i + 1}:`);
      console.log(`   - Alt: ${img.alt}`);
      console.log(`   - Classes: ${img.classes}`);
      console.log(`   - Src: ${img.src}...`);
    });

    console.log(`\n🔗 Product Links (${analysis.possibleLinkElements.length}):`);
    analysis.possibleLinkElements.forEach((link, i) => {
      console.log(`\n   Link ${i + 1}:`);
      console.log(`   - Text: ${link.text}`);
      console.log(`   - Classes: ${link.classes}`);
      console.log(`   - Href: ${link.href}...`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ Analysis complete!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error(`\n❌ Error analyzing ${siteName}:`, error.message);
    console.error(error.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🔬 RETAILER DIAGNOSTIC TOOL');
  console.log('='.repeat(80));
  console.log('\nThis tool will:');
  console.log('  1. Load each retailer website');
  console.log('  2. Wait for JavaScript to render');
  console.log('  3. Analyze HTML structure');
  console.log('  4. Identify product containers, prices, images');
  console.log('  5. Save screenshots and HTML for inspection');
  console.log('\n' + '='.repeat(80));

  // Test 1: Dick's Sporting Goods
  await analyzeSite(
    'Dicks Sporting Goods',
    'https://www.dickssportinggoods.com/s/products?q=adidas%20shoes%20clearance'
  );

  console.log('\n\n⏳ Waiting 5 seconds before next site...\n\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Test 2: JD Sports
  await analyzeSite(
    'JD Sports',
    'https://www.jdsports.com/store/search/?query=adidas%20shoes&sort=price-low-to-high'
  );

  console.log('\n\n' + '='.repeat(80));
  console.log('🎉 ALL ANALYSES COMPLETE!');
  console.log('='.repeat(80));
  console.log('\n📁 Check /tmp/ for:');
  console.log('   - dicks-sporting-goods-analysis.png');
  console.log('   - dicks-sporting-goods-full.html');
  console.log('   - jd-sports-analysis.png');
  console.log('   - jd-sports-full.html');
  console.log('\n💡 Use these files to identify correct CSS selectors!\n');
}

main().catch(console.error);
