const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

// Enable stealth plugin
puppeteerExtra.use(StealthPlugin());

/**
 * Kohl's Clearance Scraper
 * Attempts multiple approaches to bypass Akamai protection:
 * 1. Mobile user agent
 * 2. Different domain endpoints
 * 3. API-like requests
 */

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function randomDelay(min, max) {
  return delay(min + Math.random() * (max - min));
}

async function humanScroll(page) {
  const scrollHeight = await page.evaluate(() => Math.min(document.body.scrollHeight, 10000));
  let currentPosition = 0;

  while (currentPosition < scrollHeight) {
    const scrollAmount = 200 + Math.random() * 400;
    currentPosition = Math.min(currentPosition + scrollAmount, scrollHeight);

    await page.evaluate((pos) => {
      window.scrollTo({ top: pos, behavior: 'smooth' });
    }, currentPosition);

    await delay(400 + Math.random() * 600);
  }
}

async function extractProducts(page, category) {
  try {
    return await page.evaluate((cat) => {
      const products = [];

      if (document.body.innerText.includes('Access Denied')) {
        return [];
      }

      // Find product containers
      let containers = [];
      const selectors = [
        'li[class*="product"]',
        '.product-card',
        '[data-automation*="product"]',
        'article[class*="product"]'
      ];

      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        if (els.length > 0) {
          containers = Array.from(els);
          break;
        }
      }

      // Fallback: find by product links
      if (containers.length === 0) {
        const links = document.querySelectorAll('a[href*="/product/"]');
        const seen = new Set();
        links.forEach(link => {
          let parent = link.parentElement;
          for (let i = 0; i < 6 && parent; i++) {
            if (!seen.has(parent) && parent.querySelector('img')) {
              seen.add(parent);
              containers.push(parent);
              break;
            }
            parent = parent.parentElement;
          }
        });
      }

      containers.forEach(el => {
        try {
          const linkEl = el.querySelector('a[href*="/product/"]');
          if (!linkEl) return;

          let productUrl = linkEl.href || linkEl.getAttribute('href');
          if (!productUrl) return;
          if (!productUrl.startsWith('http')) {
            productUrl = 'https://www.kohls.com' + productUrl;
          }

          let name = '';
          const nameEl = el.querySelector('[class*="prod_name"], [class*="title"], h2, h3, [class*="name"]');
          if (nameEl) name = nameEl.textContent.trim();
          if (!name) name = linkEl.getAttribute('title') || linkEl.textContent.trim().split('\n')[0] || '';
          name = name.substring(0, 200).trim();

          const text = el.textContent || '';
          const priceMatches = text.match(/\$\d+\.?\d*/g) || [];
          const prices = priceMatches.map(p => parseFloat(p.replace('$', ''))).filter(p => p > 0 && p < 2000);
          const sortedPrices = [...new Set(prices)].sort((a, b) => b - a);

          let originalPrice = sortedPrices[0] || 0;
          let salePrice = sortedPrices.length > 1 ? sortedPrices[sortedPrices.length - 1] : originalPrice;

          let imageUrl = '';
          const img = el.querySelector('img');
          if (img) {
            imageUrl = img.src || img.dataset.src || img.getAttribute('data-src') || '';
            if (imageUrl && !imageUrl.startsWith('http')) imageUrl = 'https:' + imageUrl;
          }

          const discount = originalPrice > salePrice && salePrice > 0
            ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
            : 0;

          if (name && name.length > 3 && salePrice > 0) {
            products.push({
              name,
              category: cat,
              originalPrice,
              salePrice,
              discount,
              imageUrl,
              productUrl,
              source: 'kohls.com'
            });
          }
        } catch (e) {}
      });

      return products;
    }, category);
  } catch (e) {
    console.log('Extract error:', e.message);
    return [];
  }
}

async function setupMobileBrowser() {
  const browser = await puppeteerExtra.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=390,844'
    ],
    ignoreDefaultArgs: ['--enable-automation']
  });

  const page = await browser.newPage();

  // Mobile iPhone user agent
  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  );

  await page.setViewport({
    width: 390,
    height: 844,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3
  });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'platform', { get: () => 'iPhone' });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
  });

  await page.setExtraHTTPHeaders({
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none'
  });

  return { browser, page };
}

async function setupDesktopBrowser() {
  const browser = await puppeteerExtra.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
      '--user-data-dir=/tmp/kohls-chrome-profile-' + Date.now()
    ],
    ignoreDefaultArgs: ['--enable-automation']
  });

  const page = await browser.newPage();

  await page.setViewport({ width: 1920, height: 1080 });

  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
  );

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    window.chrome = { runtime: {} };
  });

  await page.setExtraHTTPHeaders({
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none'
  });

  return { browser, page };
}

async function tryMobileApproach() {
  console.log('\n=== Trying Mobile Approach ===\n');
  const allProducts = [];

  const { browser, page } = await setupMobileBrowser();

  try {
    // Try mobile URLs
    const mobileUrls = [
      { name: 'Mobile Home', url: 'https://m.kohls.com/' },
      { name: 'Mobile Clearance', url: 'https://m.kohls.com/sale-clearance.jsp' },
      { name: 'Mobile Search', url: 'https://m.kohls.com/search.jsp?search=clearance+shoes' }
    ];

    for (const urlInfo of mobileUrls) {
      console.log(`Trying: ${urlInfo.name}`);

      try {
        await page.goto(urlInfo.url, {
          waitUntil: 'networkidle2',
          timeout: 45000
        });

        await randomDelay(3000, 5000);
        await page.screenshot({ path: `/tmp/kohls-mobile-${urlInfo.name.replace(/\s+/g, '-')}.png` });

        const content = await page.content();
        if (!content.includes('Access Denied')) {
          console.log('Page loaded! Extracting products...');
          await humanScroll(page);
          await delay(2000);

          const products = await extractProducts(page, urlInfo.name);
          const discounted = products.filter(p => p.discount > 0);
          allProducts.push(...discounted);
          console.log(`Found ${discounted.length} discounted products`);
        } else {
          console.log('Blocked');
        }

        await randomDelay(3000, 5000);
      } catch (e) {
        console.log(`Error: ${e.message}`);
      }
    }

  } finally {
    await browser.close();
  }

  return allProducts;
}

async function tryDesktopWithRefer() {
  console.log('\n=== Trying Desktop with Referrer ===\n');
  const allProducts = [];

  const { browser, page } = await setupDesktopBrowser();

  try {
    // First visit Google
    console.log('Visiting Google first...');
    await page.goto('https://www.google.com/search?q=kohls+clearance', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await randomDelay(3000, 5000);

    // Set referer
    await page.setExtraHTTPHeaders({
      'Referer': 'https://www.google.com/',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    });

    // Try Kohl's
    console.log('Navigating to Kohl\'s...');
    await page.goto('https://www.kohls.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });

    await randomDelay(5000, 8000);
    await page.screenshot({ path: '/tmp/kohls-desktop-refer.png' });

    const content = await page.content();
    if (!content.includes('Access Denied')) {
      console.log('Homepage loaded!');

      // Try search
      const searches = ['clearance shoes', 'clearance clothing', 'sale womens'];
      for (const term of searches) {
        const searchUrl = `https://www.kohls.com/search.jsp?search=${encodeURIComponent(term)}`;
        console.log(`Searching: ${term}`);

        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 45000 });
        await randomDelay(4000, 6000);

        const searchContent = await page.content();
        if (!searchContent.includes('Access Denied')) {
          await humanScroll(page);
          await delay(2000);

          const products = await extractProducts(page, term);
          const discounted = products.filter(p => p.discount > 0);
          allProducts.push(...discounted);
          console.log(`Found ${discounted.length} discounted products`);
        }

        await randomDelay(5000, 8000);
      }
    } else {
      console.log('Desktop blocked');
    }

  } finally {
    await browser.close();
  }

  return allProducts;
}

async function scrapeKohlsClearance() {
  console.log('==============================================');
  console.log('KOHLS CLEARANCE SCRAPER');
  console.log('Trying multiple approaches to bypass protection');
  console.log('==============================================\n');

  const startTime = Date.now();
  let allProducts = [];

  // Try mobile approach first
  try {
    const mobileProducts = await tryMobileApproach();
    allProducts.push(...mobileProducts);
    console.log(`After mobile: ${allProducts.length} products`);
  } catch (e) {
    console.log('Mobile approach failed:', e.message);
  }

  // Try desktop with referrer
  if (allProducts.length < 50) {
    try {
      const desktopProducts = await tryDesktopWithRefer();
      allProducts.push(...desktopProducts);
      console.log(`After desktop: ${allProducts.length} products`);
    } catch (e) {
      console.log('Desktop approach failed:', e.message);
    }
  }

  // Deduplicate
  const uniqueProducts = [];
  const seenUrls = new Set();

  for (const product of allProducts) {
    if (product.productUrl && !seenUrls.has(product.productUrl)) {
      seenUrls.add(product.productUrl);
      uniqueProducts.push({
        id: `kohls-${Date.now()}-${uniqueProducts.length}`,
        ...product,
        scrapedAt: new Date().toISOString()
      });
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n==============================================');
  console.log('SCRAPING COMPLETE');
  console.log('==============================================');
  console.log(`Total products: ${allProducts.length}`);
  console.log(`Unique products: ${uniqueProducts.length}`);
  console.log(`Time elapsed: ${elapsed}s`);

  if (uniqueProducts.length === 0) {
    console.log('\nNOTE: Kohl\'s has very strong Akamai bot protection.');
    console.log('To successfully scrape Kohl\'s, you would need:');
    console.log('1. Residential proxies (not data center IPs)');
    console.log('2. A real browser with GUI (headful mode on actual desktop)');
    console.log('3. CAPTCHA solving service integration');
    console.log('4. Or use Kohl\'s official API/affiliate program');
  }

  console.log('==============================================\n');

  return uniqueProducts;
}

async function main() {
  const outputPath = '/tmp/kohls-products.json';

  try {
    const products = await scrapeKohlsClearance();

    const output = {
      scrapeDate: new Date().toISOString(),
      totalProducts: products.length,
      source: 'kohls.com',
      note: products.length === 0 ? 'Kohl\'s blocked all scraping attempts due to Akamai protection. Consider using residential proxies or their official API.' : undefined,
      products
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`Results saved to: ${outputPath}`);

    if (products.length > 0) {
      console.log('\n--- Sample Products ---');
      products.slice(0, 10).forEach((p, i) => {
        console.log(`\n${i + 1}. ${p.name}`);
        console.log(`   Original: $${p.originalPrice} -> Sale: $${p.salePrice} (${p.discount}% off)`);
        console.log(`   URL: ${p.productUrl?.substring(0, 70)}...`);
      });
    }

    return products;

  } catch (error) {
    console.error('Scraper failed:', error);

    fs.writeFileSync(outputPath, JSON.stringify({
      scrapeDate: new Date().toISOString(),
      totalProducts: 0,
      source: 'kohls.com',
      error: error.message,
      note: 'Kohl\'s has strong Akamai bot protection. Consider using residential proxies.',
      products: []
    }, null, 2));

    throw error;
  }
}

module.exports = { scrapeKohlsClearance };

if (require.main === module) {
  main().catch(console.error);
}
