/**
 * Debug script with visible browser and human-like behavior
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function randomDelay(min = 500, max = 1500) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(r => setTimeout(r, delay));
}

async function debug() {
  console.log('Starting New Balance with human-like behavior...');

  const browser = await puppeteer.launch({
    headless: false, // Visible browser
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080'
    ],
    defaultViewport: null
  });

  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Override webdriver
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    window.chrome = { runtime: {} };
  });

  try {
    console.log('Navigating to New Balance homepage first...');

    // Start from homepage
    await page.goto('https://www.newbalance.com/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('Loaded homepage, waiting...');
    await randomDelay(3000, 5000);

    // Check for cookie banner and accept
    try {
      const acceptButton = await page.$('[id*="accept"], [class*="accept"], button:has-text("Accept")');
      if (acceptButton) {
        await acceptButton.click();
        console.log('Accepted cookies');
        await randomDelay(1000, 2000);
      }
    } catch (e) {}

    // Move mouse randomly
    await page.mouse.move(500, 300);
    await randomDelay(500, 1000);
    await page.mouse.move(800, 400);
    await randomDelay(500, 1000);

    console.log('Now navigating to sale page...');
    await page.goto('https://www.newbalance.com/sale/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('On sale page, waiting for content...');
    await randomDelay(5000, 8000);

    // Scroll down slowly
    for (let i = 0; i < 3; i++) {
      await page.evaluate((scrollAmount) => {
        window.scrollBy(0, scrollAmount);
      }, 300 + Math.random() * 200);
      await randomDelay(1000, 2000);
    }

    // Take screenshot
    await page.screenshot({ path: '/tmp/newbalance-human.png', fullPage: false });
    console.log('Screenshot saved');

    const title = await page.title();
    console.log(`Title: ${title}`);

    const url = page.url();
    console.log(`URL: ${url}`);

    // Check content
    const bodyText = await page.evaluate(() => document.body.textContent.substring(0, 500));
    console.log(`Body preview: ${bodyText.substring(0, 200)}`);

    // Check for products
    const analysis = await page.evaluate(() => {
      const result = {
        hasProducts: false,
        productCount: 0,
        classes: [],
        links: []
      };

      // Look for any product indicators
      const allElements = document.querySelectorAll('*');
      const classSet = new Set();
      allElements.forEach(el => {
        if (el.className && typeof el.className === 'string') {
          el.className.split(' ').forEach(c => {
            if (c && (c.includes('product') || c.includes('tile') || c.includes('card') || c.includes('Product'))) {
              classSet.add(c);
            }
          });
        }
      });
      result.classes = Array.from(classSet);

      // Look for product links
      const links = document.querySelectorAll('a');
      links.forEach(a => {
        if (a.href && a.href.includes('/pd/')) {
          if (result.links.length < 5) {
            result.links.push(a.href);
          }
          result.productCount++;
        }
      });

      result.hasProducts = result.productCount > 0;
      return result;
    });

    console.log('\nAnalysis:');
    console.log(`Has products: ${analysis.hasProducts}`);
    console.log(`Product count: ${analysis.productCount}`);
    console.log(`Product classes: ${analysis.classes.join(', ')}`);
    console.log(`Sample links: ${analysis.links.join('\n')}`);

    // Save full HTML
    const content = await page.content();
    fs.writeFileSync('/tmp/newbalance-full.html', content);
    console.log('\nFull HTML saved to /tmp/newbalance-full.html');

    // Keep browser open for 10 seconds to see
    console.log('\nKeeping browser open for 10 seconds...');
    await new Promise(r => setTimeout(r, 10000));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

debug();
