const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

// Add stealth plugin
puppeteer.use(StealthPlugin());

const OUTPUT_FILE = '/tmp/forever21-products.json';

// Random delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min, max) => delay(Math.floor(Math.random() * (max - min + 1)) + min);

async function autoScroll(page, maxScrolls = 100) {
  await page.evaluate(async (maxScrolls) => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 600;
      let scrollCount = 0;
      let lastHeight = 0;
      let sameHeightCount = 0;

      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        scrollCount++;

        // Check if we've reached the bottom or same height 5 times
        if (scrollHeight === lastHeight) {
          sameHeightCount++;
        } else {
          sameHeightCount = 0;
        }
        lastHeight = scrollHeight;

        if (sameHeightCount >= 5 || scrollCount >= maxScrolls) {
          clearInterval(timer);
          resolve();
        }
      }, 150);
    });
  }, maxScrolls);
}

async function clickLoadMore(page) {
  try {
    // Look for "Load More" or pagination buttons
    const loadMoreSelectors = [
      'button[data-testid="load-more"]',
      '.load-more-button',
      'button:has-text("Load More")',
      'button:has-text("Show More")',
      'a.load-more',
      '[class*="load-more"]',
      '[class*="loadMore"]',
      '.pagination button',
      'button[class*="pagination"]'
    ];

    for (const selector of loadMoreSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          const isVisible = await button.isIntersectingViewport();
          if (isVisible) {
            await button.click();
            console.log(`  Clicked load more button: ${selector}`);
            await delay(2000);
            return true;
          }
        }
      } catch (e) {}
    }

    // Also try clicking by text content
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      for (const btn of buttons) {
        const text = btn.textContent.toLowerCase();
        if ((text.includes('load more') || text.includes('show more') || text.includes('view more'))
            && btn.offsetParent !== null) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (clicked) {
      console.log('  Clicked load more by text');
      await delay(2000);
      return true;
    }

    return false;
  } catch (e) {
    return false;
  }
}

async function extractProducts(page) {
  return await page.evaluate(() => {
    const products = [];

    // Forever 21 product selectors - try multiple patterns
    const productSelectors = [
      '.product-tile',
      '.product-card',
      '[class*="ProductTile"]',
      '[class*="product-tile"]',
      '[data-component="ProductTile"]',
      '.product-grid-item',
      '[class*="ProductCard"]',
      '.plp-product-tile',
      'article[class*="product"]',
      '.product-list-item',
      '[data-testid*="product"]',
      'li[class*="product"]',
      'div[class*="ProductItem"]',
      '.ProductTile_container'
    ];

    let productElements = [];
    for (const selector of productSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        productElements = elements;
        console.log(`Found ${elements.length} products with selector: ${selector}`);
        break;
      }
    }

    // If still no products, try generic approach
    if (productElements.length === 0) {
      // Look for elements that contain both price and product links
      const allLinks = document.querySelectorAll('a[href*="/product/"], a[href*="/p/"], a[href*="/sale/"]');
      const containers = new Set();
      allLinks.forEach(link => {
        let parent = link.parentElement;
        for (let i = 0; i < 5 && parent; i++) {
          if (parent.querySelector('img') && parent.textContent.includes('$')) {
            containers.add(parent);
            break;
          }
          parent = parent.parentElement;
        }
      });
      productElements = [...containers];
    }

    productElements.forEach((el) => {
      try {
        // Extract product name
        const nameSelectors = [
          '.product-name',
          '.product-title',
          '[class*="product-name"]',
          '[class*="product-title"]',
          '[class*="ProductName"]',
          '[class*="name"]',
          'h2',
          'h3',
          '.title',
          'a[href*="/product/"]',
          'a[href*="/p/"]'
        ];

        let name = '';
        for (const sel of nameSelectors) {
          const nameEl = el.querySelector(sel);
          if (nameEl) {
            name = nameEl.textContent.trim();
            if (name && name.length > 3 && name.length < 200) break;
          }
        }

        // Extract prices
        let originalPrice = '';
        let salePrice = '';

        // Look for price elements
        const priceContainer = el.querySelector('[class*="price"], [class*="Price"]') || el;
        const priceText = priceContainer.textContent || '';

        // Find all price matches
        const priceMatches = priceText.match(/\$[\d,.]+/g);

        if (priceMatches && priceMatches.length >= 2) {
          // Multiple prices - likely original and sale
          const prices = priceMatches.map(p => parseFloat(p.replace(/[$,]/g, '')));
          const uniquePrices = [...new Set(prices)].filter(p => p > 0).sort((a, b) => b - a);

          if (uniquePrices.length >= 2) {
            originalPrice = '$' + uniquePrices[0].toFixed(2);
            salePrice = '$' + uniquePrices[uniquePrices.length - 1].toFixed(2);
          } else if (uniquePrices.length === 1) {
            salePrice = '$' + uniquePrices[0].toFixed(2);
          }
        } else if (priceMatches && priceMatches.length === 1) {
          salePrice = priceMatches[0];
        }

        // Also check for specific price elements
        const originalPriceEl = el.querySelector('[class*="original"], [class*="was"], [class*="strikethrough"], [class*="crossed"], del, s, .list-price, [class*="regular"]');
        const salePriceEl = el.querySelector('[class*="sale"], [class*="now"], [class*="current"], [class*="special"], .sale-price, [class*="discounted"]');

        if (originalPriceEl) {
          const match = originalPriceEl.textContent.match(/\$[\d,.]+/);
          if (match) originalPrice = match[0];
        }
        if (salePriceEl) {
          const match = salePriceEl.textContent.match(/\$[\d,.]+/);
          if (match) salePrice = match[0];
        }

        // Extract image URL
        let imageUrl = '';
        const imgEl = el.querySelector('img');
        if (imgEl) {
          imageUrl = imgEl.src || imgEl.dataset.src || imgEl.getAttribute('srcset')?.split(' ')[0] || '';
          // Handle lazy loading
          if (!imageUrl || imageUrl.includes('data:')) {
            imageUrl = imgEl.dataset.lazy || imgEl.dataset.original || '';
          }
        }

        // Also check for background images
        if (!imageUrl) {
          const bgEl = el.querySelector('[style*="background-image"]');
          if (bgEl) {
            const style = bgEl.getAttribute('style');
            const urlMatch = style.match(/url\(['"]?([^'"]+)['"]?\)/);
            if (urlMatch) imageUrl = urlMatch[1];
          }
        }

        // Extract product URL
        let productUrl = '';
        const linkEl = el.querySelector('a[href*="/product/"], a[href*="/p/"], a[href]');
        if (linkEl) {
          productUrl = linkEl.href;
          if (!productUrl.startsWith('http')) {
            productUrl = 'https://www.forever21.com' + productUrl;
          }
        }

        // Clean up name if it includes price
        if (name.includes('$')) {
          name = name.split('$')[0].trim();
        }

        if (name && (salePrice || originalPrice)) {
          products.push({
            name: name.substring(0, 200),
            originalPrice,
            salePrice: salePrice || originalPrice,
            imageUrl,
            productUrl
          });
        }
      } catch (e) {}
    });

    return products;
  });
}

async function scrapeSalePage(page, url, seenUrls, pageNum = 1) {
  const targetUrl = pageNum > 1 ? `${url}?page=${pageNum}` : url;
  console.log(`\nScraping page ${pageNum}: ${targetUrl}`);

  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    console.log(`  Navigation failed: ${e.message}`);
    return { products: [], hasMore: false };
  }

  await randomDelay(3000, 5000);

  // Check for blocks
  const html = await page.content();
  if (html.includes('Access Denied') || html.includes('blocked') || html.includes('captcha')) {
    console.log('  Access blocked, waiting and retrying...');
    await delay(10000);
    try {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await randomDelay(5000, 8000);
    } catch (e) {}
  }

  // Handle cookie consent
  try {
    const cookieSelectors = [
      '#onetrust-accept-btn-handler',
      '[data-testid="cookie-accept"]',
      '.cookie-accept',
      'button[class*="cookie"]',
      '#accept-cookies',
      '.accept-all-cookies'
    ];
    for (const sel of cookieSelectors) {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        console.log('  Accepted cookies');
        await delay(1000);
        break;
      }
    }
  } catch (e) {}

  // Scroll to load lazy content
  console.log('  Scrolling to load products...');
  await autoScroll(page, 80);
  await randomDelay(2000, 3000);

  // Try to click "Load More" buttons multiple times
  for (let i = 0; i < 5; i++) {
    const clicked = await clickLoadMore(page);
    if (clicked) {
      await autoScroll(page, 30);
      await delay(1500);
    } else {
      break;
    }
  }

  // Final scroll
  await autoScroll(page, 20);
  await delay(2000);

  // Extract products
  const pageProducts = await extractProducts(page);
  console.log(`  Found ${pageProducts.length} products on this page`);

  // Filter for new products only
  const newProducts = pageProducts.filter(p => {
    const key = p.productUrl || p.name;
    if (seenUrls.has(key)) return false;
    seenUrls.add(key);
    return true;
  });

  console.log(`  New unique products: ${newProducts.length}`);

  // Check if there's more pages
  const hasMore = await page.evaluate(() => {
    const nextBtn = document.querySelector('.pagination-next:not(.disabled), [class*="next"]:not(.disabled), a[rel="next"]');
    const pageIndicator = document.querySelector('[class*="pagination"], [class*="page-count"]');
    if (pageIndicator) {
      const text = pageIndicator.textContent;
      const match = text.match(/(\d+)\s*of\s*(\d+)/i);
      if (match) {
        return parseInt(match[1]) < parseInt(match[2]);
      }
    }
    return !!nextBtn;
  });

  return { products: newProducts, hasMore };
}

async function scrapeForever21Sale() {
  console.log('Starting Forever 21 Sale Scraper...');
  console.log('Target: https://www.forever21.com/us/shop/catalog/category/f21/sale');
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log('');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  const page = await browser.newPage();

  // Set realistic viewport and user agent
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  });

  // Extra stealth measures
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    window.chrome = { runtime: {} };
  });

  try {
    let allProducts = [];
    const seenUrls = new Set();

    // Main sale categories to scrape
    const saleUrls = [
      'https://www.forever21.com/us/shop/catalog/category/f21/sale',
      'https://www.forever21.com/us/shop/catalog/category/f21/sale/womens-sale',
      'https://www.forever21.com/us/shop/catalog/category/f21/sale/mens-sale',
      'https://www.forever21.com/us/shop/catalog/category/f21/sale/womens-sale/tops',
      'https://www.forever21.com/us/shop/catalog/category/f21/sale/womens-sale/dresses',
      'https://www.forever21.com/us/shop/catalog/category/f21/sale/womens-sale/bottoms',
      'https://www.forever21.com/us/shop/catalog/category/f21/sale/womens-sale/shoes',
      'https://www.forever21.com/us/shop/catalog/category/f21/sale/womens-sale/accessories',
      'https://www.forever21.com/us/shop/catalog/category/f21/sale/mens-sale/tops',
      'https://www.forever21.com/us/shop/catalog/category/f21/sale/mens-sale/bottoms'
    ];

    console.log('=== Phase 1: Scraping main sale page ===');

    // First, go to main sale page and get any sub-category links
    const mainUrl = 'https://www.forever21.com/us/shop/catalog/category/f21/sale';
    await page.goto(mainUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await randomDelay(4000, 6000);

    // Try to get category links from the page
    const dynamicLinks = await page.evaluate(() => {
      const links = new Set();
      document.querySelectorAll('a[href*="/sale"]').forEach(a => {
        const href = a.href;
        if (href.includes('forever21.com') && href.includes('/sale') && !href.includes('#')) {
          links.add(href);
        }
      });
      return [...links];
    });

    console.log(`Found ${dynamicLinks.length} dynamic sale links`);

    // Combine with predefined URLs (deduplicated)
    const allSaleUrls = [...new Set([...saleUrls, ...dynamicLinks])];

    // Scrape each category
    for (const url of allSaleUrls) {
      if (allProducts.length >= 300) {
        console.log('Reached 300 products, stopping...');
        break;
      }

      console.log(`\n=== Scraping: ${url} ===`);

      // Try multiple pages for each category
      for (let pageNum = 1; pageNum <= 5; pageNum++) {
        const { products, hasMore } = await scrapeSalePage(page, url, seenUrls, pageNum);

        for (const p of products) {
          allProducts.push(p);
        }

        console.log(`  Total products so far: ${allProducts.length}`);

        if (!hasMore || products.length === 0) {
          break;
        }

        await randomDelay(2000, 4000);
      }

      await randomDelay(3000, 5000);
    }

    // Filter for products with real discounts
    const discountedProducts = allProducts.filter(p => {
      if (!p.originalPrice || !p.salePrice) return false;
      const original = parseFloat(p.originalPrice.replace(/[$,]/g, ''));
      const sale = parseFloat(p.salePrice.replace(/[$,]/g, ''));
      return original > sale && sale > 0;
    });

    // Calculate discount percentage
    discountedProducts.forEach(p => {
      const original = parseFloat(p.originalPrice.replace(/[$,]/g, ''));
      const sale = parseFloat(p.salePrice.replace(/[$,]/g, ''));
      p.discountPercent = Math.round(((original - sale) / original) * 100);
    });

    // Sort by discount
    discountedProducts.sort((a, b) => b.discountPercent - a.discountPercent);

    console.log(`\n========================================`);
    console.log(`SCRAPING COMPLETE`);
    console.log(`========================================`);
    console.log(`Total products found: ${allProducts.length}`);
    console.log(`Products with real discounts: ${discountedProducts.length}`);

    // Prepare output - use all products if no discounts found
    const outputProducts = discountedProducts.length > 0 ? discountedProducts : allProducts;

    const output = {
      scrapedAt: new Date().toISOString(),
      source: 'Forever 21 Sale',
      sourceUrl: 'https://www.forever21.com/us/shop/catalog/category/f21/sale',
      totalProductsFound: allProducts.length,
      productsWithDiscounts: discountedProducts.length,
      products: outputProducts.map(p => ({
        name: p.name,
        originalPrice: p.originalPrice,
        salePrice: p.salePrice,
        discountPercent: p.discountPercent || null,
        imageUrl: p.imageUrl,
        productUrl: p.productUrl
      }))
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`\nResults saved to ${OUTPUT_FILE}`);

    if (output.products.length > 0) {
      console.log('\n--- Sample Products (Top 20 by discount) ---');
      output.products.slice(0, 20).forEach((p, i) => {
        console.log(`\n${i + 1}. ${p.name}`);
        if (p.originalPrice && p.salePrice !== p.originalPrice) {
          console.log(`   Price: ${p.originalPrice} -> ${p.salePrice}`);
        } else {
          console.log(`   Price: ${p.salePrice}`);
        }
        if (p.discountPercent) console.log(`   Discount: ${p.discountPercent}%`);
        console.log(`   URL: ${p.productUrl || 'N/A'}`);
      });
    }

    return output;

  } catch (error) {
    console.error('Scraping error:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the scraper
scrapeForever21Sale()
  .then((result) => {
    console.log(`\n✓ Done! Scraped ${result.products.length} products`);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n✗ Failed:', error);
    process.exit(1);
  });
