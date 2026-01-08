const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

// Add stealth plugin
puppeteer.use(StealthPlugin());

const OUTPUT_FILE = '/tmp/asics-products.json';

// Random delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min, max) => delay(Math.floor(Math.random() * (max - min + 1)) + min);

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 400;
      const maxScrolls = 60;
      let scrollCount = 0;

      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        scrollCount++;

        if (totalHeight >= scrollHeight - 500 || scrollCount >= maxScrolls) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
    });
  });
}

async function extractProducts(page) {
  return await page.evaluate(() => {
    const products = [];
    const productElements = document.querySelectorAll('.productTile__root');

    productElements.forEach((el) => {
      try {
        const nameEl = el.querySelector('.productTile__title');
        const name = nameEl ? nameEl.textContent.trim() : '';

        const priceContainer = el.querySelector('.productTile__price, [class*="price"]');
        let originalPrice = '';
        let salePrice = '';

        if (priceContainer) {
          const priceText = priceContainer.textContent || '';
          // Handle both $ and GBP prices
          const priceMatches = priceText.match(/[\$£][\d,.]+/g);

          if (priceMatches && priceMatches.length >= 2) {
            const prices = priceMatches.map(p => parseFloat(p.replace(/[£$,]/g, '')));
            const uniquePrices = [...new Set(prices)].sort((a, b) => b - a);

            if (uniquePrices.length >= 2) {
              const currency = priceText.includes('£') ? '£' : '$';
              originalPrice = currency + uniquePrices[0].toFixed(2);
              salePrice = currency + uniquePrices[1].toFixed(2);
            }
          } else if (priceMatches && priceMatches.length === 1) {
            salePrice = priceMatches[0];
          }
        }

        const imgEl = el.querySelector('img');
        let imageUrl = '';
        if (imgEl) {
          imageUrl = imgEl.src || imgEl.dataset.src || '';
        }

        let productUrl = '';
        const linkEl = el.querySelector('a[href*="/p/"]');
        if (linkEl) {
          productUrl = linkEl.href;
        }

        if (name && productUrl) {
          products.push({
            name,
            originalPrice,
            salePrice,
            imageUrl,
            productUrl,
            hasDiscount: !!(originalPrice && salePrice && originalPrice !== salePrice)
          });
        }
      } catch (e) {}
    });

    return products;
  });
}

async function findCategoryLinks(page) {
  return await page.evaluate(() => {
    const links = new Set();
    const allLinks = document.querySelectorAll('a[href]');

    allLinks.forEach(link => {
      const href = link.href;
      // Look for outlet or sale category pages
      if ((href.includes('/outlet/') || href.includes('/sale/')) &&
          href.includes('/c/') &&
          !href.includes('#') &&
          !links.has(href)) {
        links.add(href);
      }
    });

    return [...links];
  });
}

async function scrapePage(page, url, seenUrls) {
  console.log(`\nScraping: ${url}`);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    console.log(`  Navigation failed: ${e.message}`);
    return [];
  }

  await randomDelay(3000, 5000);

  // Check for block
  const html = await page.content();
  if (html.includes('<title>Access Denied</title>')) {
    console.log('  Access denied, skipping...');
    return [];
  }

  // Handle cookies
  try {
    const cookieBtn = await page.$('#onetrust-accept-btn-handler');
    if (cookieBtn) {
      await cookieBtn.click();
      await delay(1000);
    }
  } catch (e) {}

  // Scroll to load all products
  await autoScroll(page);
  await randomDelay(2000, 3000);

  let pageProducts = [];
  let prevCount = 0;
  let stable = 0;

  for (let i = 0; i < 10; i++) {
    const products = await extractProducts(page);
    const newProducts = products.filter(p => p.productUrl && !seenUrls.has(p.productUrl));

    for (const p of newProducts) {
      seenUrls.add(p.productUrl);
      pageProducts.push(p);
    }

    console.log(`  Extraction ${i + 1}: ${products.length} on page, ${newProducts.length} new`);

    if (products.length === prevCount) {
      stable++;
      if (stable >= 3) break;
    } else {
      stable = 0;
    }
    prevCount = products.length;

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await randomDelay(1500, 2500);
    await autoScroll(page);
    await delay(1000);
  }

  return pageProducts;
}

async function scrapeAsicsOutlet() {
  console.log('Starting ASICS outlet scraper...');

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
  });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  try {
    let allProducts = [];
    const seenUrls = new Set();
    const visitedPages = new Set();

    // Start with main outlet page
    const startUrl = 'https://www.asics.com/gb/en-gb/outlet';

    console.log('\n=== Phase 1: Main outlet page ===');
    await page.goto(startUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await randomDelay(4000, 6000);

    // Handle cookies
    try {
      const cookieBtn = await page.$('#onetrust-accept-btn-handler');
      if (cookieBtn) {
        await cookieBtn.click();
        console.log('Accepted cookies');
        await delay(1000);
      }
    } catch (e) {}

    // Get products from main page
    let products = await scrapePage(page, startUrl, seenUrls);
    allProducts = [...allProducts, ...products];
    visitedPages.add(startUrl);
    console.log(`Total products: ${allProducts.length}`);

    // Find category links
    console.log('\n=== Phase 2: Finding category links ===');
    const categoryLinks = await findCategoryLinks(page);
    console.log(`Found ${categoryLinks.length} category links`);

    // Scrape each category
    for (const link of categoryLinks) {
      if (visitedPages.has(link)) continue;
      if (allProducts.length >= 100) break;

      visitedPages.add(link);
      await randomDelay(2000, 4000);

      try {
        products = await scrapePage(page, link, seenUrls);
        allProducts = [...allProducts, ...products];
        console.log(`Total products: ${allProducts.length}`);
      } catch (e) {
        console.log(`Error: ${e.message}`);
      }
    }

    // Also try the sale page
    if (allProducts.length < 100) {
      console.log('\n=== Phase 3: Sale page ===');
      const saleUrl = 'https://www.asics.com/gb/en-gb/sale/c/sale/';
      if (!visitedPages.has(saleUrl)) {
        await randomDelay(2000, 4000);
        products = await scrapePage(page, saleUrl, seenUrls);
        allProducts = [...allProducts, ...products];
        console.log(`Total products: ${allProducts.length}`);
      }
    }

    // Filter for products with real discounts
    const discountedProducts = allProducts.filter(p => {
      if (!p.originalPrice || !p.salePrice) return false;
      const original = parseFloat(p.originalPrice.replace(/[£$,]/g, ''));
      const sale = parseFloat(p.salePrice.replace(/[£$,]/g, ''));
      return original > sale && sale > 0;
    });

    // Calculate discount percentage
    discountedProducts.forEach(p => {
      const original = parseFloat(p.originalPrice.replace(/[£$,]/g, ''));
      const sale = parseFloat(p.salePrice.replace(/[£$,]/g, ''));
      p.discountPercent = Math.round(((original - sale) / original) * 100);
    });

    discountedProducts.sort((a, b) => b.discountPercent - a.discountPercent);

    console.log(`\n========================================`);
    console.log(`SCRAPING COMPLETE`);
    console.log(`========================================`);
    console.log(`Total products found: ${allProducts.length}`);
    console.log(`Products with real discounts: ${discountedProducts.length}`);

    const output = {
      scrapedAt: new Date().toISOString(),
      source: 'ASICS GB Outlet',
      totalProducts: allProducts.length,
      discountedProducts: discountedProducts.length,
      products: discountedProducts.length > 0 ? discountedProducts : allProducts
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`\nResults saved to ${OUTPUT_FILE}`);

    if (output.products.length > 0) {
      console.log('\n--- Sample Products ---');
      output.products.slice(0, 15).forEach((p, i) => {
        console.log(`\n${i + 1}. ${p.name}`);
        if (p.originalPrice && p.salePrice) {
          console.log(`   Price: ${p.originalPrice} -> ${p.salePrice}`);
        } else if (p.salePrice) {
          console.log(`   Price: ${p.salePrice}`);
        }
        if (p.discountPercent) console.log(`   Discount: ${p.discountPercent}%`);
        if (p.productUrl) console.log(`   URL: ${p.productUrl}`);
      });
    }

    return output;

  } catch (error) {
    console.error('Scraping error:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

scrapeAsicsOutlet()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nFailed:', error);
    process.exit(1);
  });
