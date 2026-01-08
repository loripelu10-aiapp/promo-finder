const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

// Enable stealth plugin with all evasions
const stealth = StealthPlugin();
stealth.enabledEvasions.delete('iframe.contentWindow');
stealth.enabledEvasions.delete('media.codecs');
puppeteerExtra.use(stealth);

/**
 * Target Clearance Scraper V2 - Enhanced Anti-Detection
 * Uses Target's internal API endpoints and advanced stealth measures
 * Target: 200+ products with real discounts
 */

// Target API endpoints discovered from network analysis
const TARGET_API_BASE = 'https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2';

// Clearance category IDs for shoes and clothing
const CATEGORY_IDS = {
  womenShoes: { id: 'hnwvi', name: 'Women Shoes Clearance' },
  menShoes: { id: 'mjp2a', name: 'Men Shoes Clearance' },
  womenClothing: { id: '56ez2', name: 'Women Clothing Clearance' },
  menClothing: { id: 'vdpam', name: 'Men Clothing Clearance' },
  kidsClothing: { id: 'y9cit', name: 'Kids Clothing Clearance' },
  allClearance: { id: '5q0ga', name: 'All Clearance' }
};

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function randomDelay(min = 2000, max = 5000) {
  const time = min + Math.random() * (max - min);
  return delay(time);
}

// More extensive scroll function that mimics human behavior
async function humanScroll(page) {
  await page.evaluate(async () => {
    const totalHeight = document.body.scrollHeight;
    const viewportHeight = window.innerHeight;
    let currentPosition = 0;

    // Scroll like a human - with variable speeds and pauses
    while (currentPosition < totalHeight) {
      // Random scroll amount between 200-600px
      const scrollAmount = 200 + Math.random() * 400;
      currentPosition = Math.min(currentPosition + scrollAmount, totalHeight);

      window.scrollTo({
        top: currentPosition,
        behavior: 'smooth'
      });

      // Variable wait time
      await new Promise(r => setTimeout(r, 300 + Math.random() * 500));

      // Occasionally scroll back up a bit
      if (Math.random() < 0.15) {
        const backScroll = Math.random() * 200;
        window.scrollTo({
          top: currentPosition - backScroll,
          behavior: 'smooth'
        });
        await new Promise(r => setTimeout(r, 200));
        window.scrollTo({
          top: currentPosition,
          behavior: 'smooth'
        });
      }
    }

    // Wait at bottom
    await new Promise(r => setTimeout(r, 1000));

    // Scroll back to middle then top to trigger any remaining lazy loads
    window.scrollTo({ top: totalHeight / 2, behavior: 'smooth' });
    await new Promise(r => setTimeout(r, 500));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await new Promise(r => setTimeout(r, 500));
    window.scrollTo({ top: totalHeight, behavior: 'smooth' });
  });
}

// Simulate mouse movements
async function simulateMouseMovement(page) {
  const viewport = await page.viewport();
  if (!viewport) return;

  // Random mouse movements
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(Math.random() * viewport.width);
    const y = Math.floor(Math.random() * viewport.height);
    await page.mouse.move(x, y, { steps: 10 });
    await delay(100 + Math.random() * 200);
  }
}

// Extract products from the page
async function extractProducts(page, category) {
  return await page.evaluate((cat) => {
    const products = [];

    // Multiple selector strategies for Target
    const selectors = [
      '[data-test="@web/site-top-of-funnel/ProductCardWrapper"]',
      '[data-test="product-grid"] > div',
      'article[data-test*="product"]',
      '[class*="ProductCard"]',
      'div[data-test*="ProductCard"]',
      'a[href*="/p/"][href*="/-/A-"]'
    ];

    let elements = [];

    for (const sel of selectors) {
      const found = document.querySelectorAll(sel);
      if (found.length > 0) {
        elements = Array.from(found);
        console.log(`Found ${found.length} elements with: ${sel}`);
        break;
      }
    }

    // If no elements found, try to get parent containers of product links
    if (elements.length === 0) {
      const links = document.querySelectorAll('a[href*="/p/"][href*="/-/A-"]');
      const parentSet = new Set();
      links.forEach(link => {
        let parent = link.closest('[data-test], article, [class*="Card"], [class*="Product"]');
        if (parent && !parentSet.has(parent)) {
          parentSet.add(parent);
          elements.push(parent);
        }
      });
    }

    console.log(`Processing ${elements.length} product elements`);

    elements.forEach((el, idx) => {
      try {
        // Find product link
        const link = el.querySelector('a[href*="/p/"]') || (el.tagName === 'A' ? el : null);
        if (!link) return;

        let productUrl = link.href || link.getAttribute('href') || '';
        if (!productUrl.startsWith('http')) {
          productUrl = 'https://www.target.com' + productUrl;
        }

        // Get product ID from URL
        const idMatch = productUrl.match(/A-(\d+)/);
        const productId = idMatch ? idMatch[1] : `${idx}`;

        // Extract name
        let name = '';
        const nameSelectors = [
          '[data-test="product-title"]',
          '[class*="ProductTitle"]',
          '[class*="truncate"]',
          'h3', 'h4',
          '[class*="Title"]'
        ];

        for (const sel of nameSelectors) {
          const nameEl = el.querySelector(sel);
          if (nameEl) {
            const text = nameEl.textContent?.trim();
            if (text && text.length > 3 && !text.includes('$')) {
              name = text;
              break;
            }
          }
        }

        if (!name) {
          name = link.getAttribute('aria-label') || link.textContent?.trim() || '';
        }

        // Extract prices
        let salePrice = 0;
        let originalPrice = 0;

        // Current/sale price
        const salePriceSelectors = [
          '[data-test="current-price"]',
          '[class*="CurrentPrice"]',
          '[class*="styles_priceWrapper"] [class*="styles_price"]',
          'span[class*="price"]:not([class*="compare"]):not([class*="regular"])'
        ];

        for (const sel of salePriceSelectors) {
          const priceEl = el.querySelector(sel);
          if (priceEl) {
            const text = priceEl.textContent;
            const match = text.match(/\$\s*([\d,.]+)/);
            if (match) {
              salePrice = parseFloat(match[1].replace(/,/g, ''));
              break;
            }
          }
        }

        // Original/compare price
        const origPriceSelectors = [
          '[data-test="compare-at-price"]',
          '[data-test="compare-price"]',
          '[class*="ComparePrice"]',
          's', 'del',
          '[class*="strikethrough"]',
          '[class*="regular"]'
        ];

        for (const sel of origPriceSelectors) {
          const priceEl = el.querySelector(sel);
          if (priceEl) {
            const text = priceEl.textContent;
            const match = text.match(/\$\s*([\d,.]+)/);
            if (match) {
              originalPrice = parseFloat(match[1].replace(/,/g, ''));
              break;
            }
          }
        }

        // Look for "reg" or "was" patterns
        const fullText = el.textContent || '';
        if (!originalPrice) {
          const regMatch = fullText.match(/(?:reg|was|originally)[.\s]*\$?([\d,.]+)/i);
          if (regMatch) {
            originalPrice = parseFloat(regMatch[1].replace(/,/g, ''));
          }
        }

        // Fallback: extract all prices
        if (salePrice === 0) {
          const allPrices = fullText.match(/\$[\d,.]+/g) || [];
          const prices = allPrices
            .map(p => parseFloat(p.replace(/[$,]/g, '')))
            .filter(p => p > 0 && p < 1000)
            .sort((a, b) => a - b);

          const unique = [...new Set(prices)];
          if (unique.length >= 2) {
            salePrice = unique[0];
            originalPrice = unique[unique.length - 1];
          } else if (unique.length === 1) {
            salePrice = unique[0];
          }
        }

        // Extract image
        let imageUrl = '';
        const img = el.querySelector('img');
        if (img) {
          imageUrl = img.src || img.dataset.src || '';
          if (!imageUrl) {
            const srcset = img.srcset || img.dataset.srcset;
            if (srcset) {
              imageUrl = srcset.split(',')[0].trim().split(' ')[0];
            }
          }
        }

        // Try picture source
        if (!imageUrl) {
          const source = el.querySelector('picture source');
          if (source && source.srcset) {
            imageUrl = source.srcset.split(',')[0].trim().split(' ')[0];
          }
        }

        // Ensure absolute URL
        if (imageUrl && !imageUrl.startsWith('http')) {
          imageUrl = imageUrl.startsWith('//') ? 'https:' + imageUrl : 'https://www.target.com' + imageUrl;
        }

        // Calculate discount
        const discount = originalPrice > 0 && salePrice > 0 && salePrice < originalPrice
          ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
          : 0;

        // Only add valid products with discounts
        if (name && name.length > 3 && salePrice > 0 && discount > 0) {
          products.push({
            name: name.substring(0, 200),
            category: cat,
            originalPrice: Math.round(originalPrice * 100) / 100,
            salePrice: Math.round(salePrice * 100) / 100,
            discount,
            imageUrl,
            productUrl,
            productId,
            source: 'target.com'
          });
        }
      } catch (err) {
        // Skip problematic elements
      }
    });

    return products;
  }, category);
}

async function scrapeWithHeadlessBrowser(category, url) {
  console.log(`\n--- Scraping ${category.name} ---`);
  console.log(`URL: ${url}`);

  let browser;
  const products = [];

  try {
    browser = await puppeteerExtra.launch({
      headless: false, // Use headed mode to bypass some detection
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--disable-background-timer-throttling',
        '--disable-popup-blocking',
        '--disable-extensions',
        '--lang=en-US,en',
        '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ],
      ignoreDefaultArgs: ['--enable-automation']
    });

    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Override webdriver detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );

      // Add chrome object
      window.chrome = { runtime: {} };
    });

    // Extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"'
    });

    console.log('  Navigating to page...');

    // First visit homepage to get cookies
    await page.goto('https://www.target.com/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Simulate some human interaction
    await randomDelay(2000, 4000);
    await simulateMouseMovement(page);

    // Now go to clearance page
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await randomDelay(3000, 5000);

    // Check for blocking
    const content = await page.content();
    if (content.includes('unavailable') || content.includes('Access Denied')) {
      console.log('  Page blocked, trying alternative approach...');
      await page.screenshot({ path: `/tmp/target-v2-blocked-${category.id}.png` });
      await browser.close();
      return products;
    }

    // Wait for products
    try {
      await page.waitForSelector('a[href*="/p/"][href*="/-/A-"]', { timeout: 15000 });
      console.log('  Products loaded');
    } catch (e) {
      console.log('  No products found');
      await page.screenshot({ path: `/tmp/target-v2-noproducts-${category.id}.png` });
      await browser.close();
      return products;
    }

    // Simulate human scrolling
    await humanScroll(page);
    await randomDelay(2000, 3000);

    // Click load more buttons
    for (let i = 0; i < 10; i++) {
      const loadMoreBtn = await page.$('button[data-test="load-more-button"], button:contains("Show more"), button:contains("Load more")');
      if (loadMoreBtn) {
        try {
          await loadMoreBtn.click();
          console.log('  Clicked load more button');
          await randomDelay(3000, 5000);
          await humanScroll(page);
        } catch (e) {
          break;
        }
      } else {
        break;
      }
    }

    // Final scroll
    await humanScroll(page);
    await delay(2000);

    // Extract products
    const extracted = await extractProducts(page, category.name);
    products.push(...extracted);
    console.log(`  Extracted ${products.length} products`);

    await page.screenshot({ path: `/tmp/target-v2-success-${category.id}.png` });

  } catch (error) {
    console.error(`  Error: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return products;
}

// Alternative: Try to use Target's redsky API directly
async function fetchFromAPI(categoryId, categoryName, offset = 0, count = 24) {
  const axios = require('axios');

  const apiUrl = `https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2`;

  const params = {
    key: '9f36aeafbe60771e321a7cc95a78140772ab3e96',
    category: categoryId,
    channel: 'WEB',
    count: count,
    default_purchasability_filter: 'true',
    include_sponsored: 'true',
    offset: offset,
    page: `/c/${categoryId}`,
    platform: 'desktop',
    pricing_store_id: '3991',
    scheduled_delivery_store_id: '3991',
    store_ids: '3991,536,948,932,3221',
    useragent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    visitor_id: 'AAAAAAAAAAAAAAAAAA'
  };

  try {
    const response = await axios.get(apiUrl, {
      params,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://www.target.com',
        'Referer': `https://www.target.com/c/${categoryId}`
      },
      timeout: 30000
    });

    if (response.data?.data?.search?.products) {
      return response.data.data.search.products.map(p => {
        const item = p.item || {};
        const price = p.price || {};

        return {
          name: item.product_description?.title || '',
          category: categoryName,
          originalPrice: price.reg_retail || price.current_retail || 0,
          salePrice: price.current_retail || 0,
          discount: Math.round(((price.reg_retail - price.current_retail) / price.reg_retail) * 100) || 0,
          imageUrl: item.enrichment?.images?.primary_image_url || '',
          productUrl: `https://www.target.com${item.enrichment?.buy_url || ''}`,
          productId: item.tcin || '',
          source: 'target.com'
        };
      }).filter(p => p.name && p.salePrice > 0 && p.discount > 0);
    }
  } catch (error) {
    console.log(`API request failed for ${categoryName}: ${error.message}`);
  }

  return [];
}

async function scrapeTargetClearance() {
  console.log('==============================================');
  console.log('TARGET CLEARANCE SCRAPER V2 - Starting');
  console.log('Using enhanced stealth with headed browser');
  console.log('Focus: Shoes and Clothing');
  console.log('==============================================\n');

  const allProducts = [];
  const startTime = Date.now();

  // Categories to scrape
  const categories = [
    { id: 'hnwvi', name: 'Women Shoes Clearance', url: 'https://www.target.com/c/women-s-clearance-shoes/-/N-hnwvi' },
    { id: 'mjp2a', name: 'Men Shoes Clearance', url: 'https://www.target.com/c/men-s-clearance-shoes/-/N-mjp2a' },
    { id: '56ez2', name: 'Women Clothing Clearance', url: 'https://www.target.com/c/women-s-clearance-clothing/-/N-56ez2' },
    { id: 'vdpam', name: 'Men Clothing Clearance', url: 'https://www.target.com/c/men-s-clearance-clothing/-/N-vdpam' },
    { id: 'y9cit', name: 'Kids Clothing Clearance', url: 'https://www.target.com/c/kids-clearance-clothing/-/N-y9cit' },
    { id: '2ajxz', name: 'Kids Shoes Clearance', url: 'https://www.target.com/c/kids-clearance-shoes/-/N-2ajxz' },
    { id: '5xtvd', name: 'Activewear Clearance', url: 'https://www.target.com/c/activewear-clearance-women-s-clothing/-/N-5xtvd' },
    { id: '5tdq2', name: 'Dresses Clearance', url: 'https://www.target.com/c/dresses-clearance-women-s-clothing/-/N-5tdq2' }
  ];

  // First try API approach
  console.log('Attempting API approach...\n');

  for (const cat of categories) {
    try {
      // Try multiple pages from API
      for (let offset = 0; offset < 200; offset += 24) {
        const apiProducts = await fetchFromAPI(cat.id, cat.name, offset);
        if (apiProducts.length === 0) break;
        allProducts.push(...apiProducts);
        console.log(`${cat.name} offset ${offset}: ${apiProducts.length} products (total: ${allProducts.length})`);
        await delay(1000);
      }
    } catch (error) {
      console.log(`API failed for ${cat.name}: ${error.message}`);
    }
  }

  // If API didn't yield enough results, try browser approach
  if (allProducts.length < 50) {
    console.log('\n\nAPI approach yielded few results, trying browser approach...\n');

    for (const cat of categories) {
      try {
        const browserProducts = await scrapeWithHeadlessBrowser(cat, cat.url);
        allProducts.push(...browserProducts);
        console.log(`Browser total for ${cat.name}: ${browserProducts.length}`);
        await randomDelay(5000, 10000);
      } catch (error) {
        console.log(`Browser scrape failed for ${cat.name}: ${error.message}`);
      }
    }
  }

  // Deduplicate
  const uniqueProducts = [];
  const seenKeys = new Set();

  for (const product of allProducts) {
    const key = product.productId || product.productUrl || product.name;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueProducts.push({
        id: `target-${product.productId || Date.now()}-${uniqueProducts.length}`,
        ...product,
        scrapedAt: new Date().toISOString()
      });
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n==============================================');
  console.log('SCRAPING COMPLETE');
  console.log('==============================================');
  console.log(`Total products scraped: ${allProducts.length}`);
  console.log(`Unique products: ${uniqueProducts.length}`);
  console.log(`Time elapsed: ${elapsed}s`);
  console.log('==============================================\n');

  return uniqueProducts;
}

async function main() {
  const outputPath = '/tmp/target-products.json';

  try {
    const products = await scrapeTargetClearance();

    // Sort by discount
    products.sort((a, b) => b.discount - a.discount);

    const output = {
      scrapeDate: new Date().toISOString(),
      totalProducts: products.length,
      source: 'target.com',
      categories: [
        'Women Shoes Clearance', 'Men Shoes Clearance',
        'Women Clothing Clearance', 'Men Clothing Clearance',
        'Kids Clothing Clearance', 'Kids Shoes Clearance',
        'Activewear Clearance', 'Dresses Clearance'
      ],
      products
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`Results saved to: ${outputPath}`);

    // Sample products
    console.log('\n--- Sample Products (Top 10 by Discount) ---');
    products.slice(0, 10).forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.name}`);
      console.log(`   Original: $${p.originalPrice} -> Sale: $${p.salePrice} (${p.discount}% off)`);
      console.log(`   URL: ${p.productUrl?.substring(0, 70)}...`);
    });

    // Stats
    const discountStats = {
      '10-20%': products.filter(p => p.discount >= 10 && p.discount < 20).length,
      '20-30%': products.filter(p => p.discount >= 20 && p.discount < 30).length,
      '30-50%': products.filter(p => p.discount >= 30 && p.discount < 50).length,
      '50-70%': products.filter(p => p.discount >= 50 && p.discount < 70).length,
      '70%+': products.filter(p => p.discount >= 70).length
    };

    console.log('\n--- Discount Distribution ---');
    Object.entries(discountStats).forEach(([range, count]) => {
      console.log(`${range}: ${count} products`);
    });

    return products;
  } catch (error) {
    console.error('Scraper failed:', error);
    throw error;
  }
}

module.exports = { scrapeTargetClearance };

if (require.main === module) {
  main().catch(console.error);
}
