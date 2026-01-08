const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Target the clearance URL as specified
const CLEARANCE_URL = 'https://oldnavy.gap.com/browse/category.do?cid=1090980';
const OUTPUT_FILE = '/tmp/oldnavy-products.json';
const TARGET_PRODUCTS = 200;

/**
 * Scraper for Old Navy clearance products
 * Uses puppeteer-extra with stealth plugin to avoid bot detection
 */
async function scrapeOldNavyClearance() {
  console.log('Starting Old Navy Clearance scraper...');
  console.log(`Target URL: ${CLEARANCE_URL}`);
  console.log(`Target: ${TARGET_PRODUCTS}+ products`);

  let browser = null;
  const allProducts = new Map();

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1920,1080',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--lang=en-US,en'
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });

    const page = await browser.newPage();

    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    });

    // Block heavy resources
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      const resourceType = request.resourceType();

      if (resourceType === 'font' ||
          url.includes('analytics') ||
          url.includes('facebook') ||
          url.includes('tiktok') ||
          url.includes('google-analytics') ||
          url.includes('fullstory') ||
          url.includes('newrelic')) {
        request.abort();
      } else {
        request.continue();
      }
    });

    console.log('\n--- Navigating to clearance page...');
    await page.goto(CLEARANCE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await delay(5000);

    // Close popups
    await closePopups(page);

    // Scroll the page
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await delay(1000);
    }

    // Save debug HTML
    const html = await page.content();
    fs.writeFileSync('/tmp/oldnavy-debug.html', html);
    console.log('Debug HTML saved');

    // Extract product IDs from recommendation links
    const productIds = await page.evaluate(() => {
      const ids = new Set();
      const links = document.querySelectorAll('a[href*="pid="]');

      links.forEach(link => {
        const href = link.getAttribute('href') || '';
        const match = href.match(/pid=(\d+)/);
        if (match) {
          ids.add(match[1]);
        }
      });

      return Array.from(ids);
    });

    console.log(`Found ${productIds.length} unique product IDs`);

    // Fetch each product page to get accurate data
    const productsPerBatch = 10;
    const batches = Math.ceil(Math.min(productIds.length, TARGET_PRODUCTS) / productsPerBatch);

    for (let batch = 0; batch < batches; batch++) {
      const startIdx = batch * productsPerBatch;
      const endIdx = Math.min(startIdx + productsPerBatch, productIds.length, TARGET_PRODUCTS);
      const batchIds = productIds.slice(startIdx, endIdx);

      console.log(`\nBatch ${batch + 1}/${batches}: Processing ${batchIds.length} products...`);

      for (const pid of batchIds) {
        if (allProducts.size >= TARGET_PRODUCTS) break;

        try {
          const productUrl = `https://oldnavy.gap.com/browse/product.do?pid=${pid}`;

          // Navigate to product page
          const response = await page.goto(productUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });

          if (!response || response.status() >= 400) {
            continue;
          }

          await delay(2000);

          // Extract product data from page
          const product = await page.evaluate((pid) => {
            try {
              // Get product name - prioritize meta tags and page title
              let name = '';

              // Try og:title meta tag first (most reliable)
              const ogTitle = document.querySelector('meta[property="og:title"]');
              if (ogTitle) {
                name = ogTitle.getAttribute('content') || '';
              }

              // Try page title (second most reliable)
              if (!name || name.length < 5) {
                const pageTitle = document.title || '';
                // Extract product name from title like "Product Name | Old Navy"
                const titleParts = pageTitle.split('|');
                if (titleParts.length > 0) {
                  name = titleParts[0].trim();
                }
              }

              // Try product detail selectors as last resort
              if (!name || name.length < 5) {
                const selectors = [
                  '[data-testid="product-title"]',
                  '[class*="pdp-product-title"]',
                  '[class*="productTitle"]',
                  'h1[class*="product"]'
                ];
                for (const sel of selectors) {
                  const el = document.querySelector(sel);
                  if (el?.textContent) {
                    const text = el.textContent.trim();
                    if (text.length > 5 && text.length < 200 && !text.includes('TODDLER') && !text.includes('Shop by')) {
                      name = text;
                      break;
                    }
                  }
                }
              }

              if (!name || name.length < 3) return null;

              // Clean up name - remove any navigation cruft
              name = name.replace(/TODDLER.*$/i, '').replace(/Shop by.*$/i, '').trim();

              // Get prices
              const pageText = document.body.textContent || '';
              const priceMatches = pageText.match(/\$[\d,]+(?:\.\d{2})?/g) || [];
              const prices = [...new Set(priceMatches)]
                .map(p => parseFloat(p.replace(/[$,]/g, '')))
                .filter(p => p > 0 && p < 500)
                .sort((a, b) => a - b);

              let salePrice = prices[0] || 0;
              let originalPrice = prices.length >= 2 ? prices[prices.length - 1] : salePrice;

              // Try to get specific price elements
              const nowPriceEl = document.querySelector('[class*="now-price"], [class*="sale-price"], [class*="current-price"]');
              const wasPriceEl = document.querySelector('[class*="was-price"], [class*="original-price"], del, s');

              if (nowPriceEl) {
                const match = nowPriceEl.textContent?.match(/\$?([\d,]+(?:\.\d{2})?)/);
                if (match) salePrice = parseFloat(match[1].replace(',', ''));
              }

              if (wasPriceEl) {
                const match = wasPriceEl.textContent?.match(/\$?([\d,]+(?:\.\d{2})?)/);
                if (match) originalPrice = parseFloat(match[1].replace(',', ''));
              }

              if (salePrice <= 0) return null;

              // Ensure original >= sale
              if (originalPrice < salePrice) {
                originalPrice = salePrice;
              }

              // Get image
              let imageUrl = null;
              const ogImage = document.querySelector('meta[property="og:image"]');
              if (ogImage) {
                imageUrl = ogImage.getAttribute('content');
              }

              if (!imageUrl) {
                const mainImg = document.querySelector('[class*="product"] img, img[alt*="product"], img[alt*="Product"]');
                if (mainImg) {
                  imageUrl = mainImg.getAttribute('src') || mainImg.getAttribute('data-src');
                }
              }

              if (imageUrl) {
                if (imageUrl.startsWith('//')) {
                  imageUrl = 'https:' + imageUrl;
                } else if (imageUrl.startsWith('/')) {
                  imageUrl = 'https://oldnavy.gap.com' + imageUrl;
                }
              }

              // Calculate discount
              const discount = originalPrice > salePrice
                ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
                : 0;

              // Categorize
              const nameL = name.toLowerCase();
              let category = 'clothing';
              if (nameL.includes('shoe') || nameL.includes('sneaker') || nameL.includes('sandal') ||
                  nameL.includes('boot') || nameL.includes('slipper') || nameL.includes('flip')) {
                category = 'shoes';
              } else if (nameL.includes('bag') || nameL.includes('belt') || nameL.includes('hat') ||
                         nameL.includes('cap') || nameL.includes('sock') || nameL.includes('scarf')) {
                category = 'accessories';
              }

              return {
                id: `oldnavy-${pid}`,
                name: name.substring(0, 200),
                brand: 'Old Navy',
                category,
                originalPrice,
                salePrice,
                discount,
                imageUrl,
                productUrl: `https://oldnavy.gap.com/browse/product.do?pid=${pid}`,
                source: 'oldnavy.com',
                scrapedAt: new Date().toISOString()
              };

            } catch (err) {
              return null;
            }
          }, pid);

          if (product && product.name && product.salePrice > 0) {
            allProducts.set(product.id, product);
            console.log(`  + ${product.name.substring(0, 40)}... $${product.originalPrice} -> $${product.salePrice}`);
          }

        } catch (err) {
          // Skip failed products
          continue;
        }

        // Small delay between requests
        await delay(500);
      }

      if (allProducts.size >= TARGET_PRODUCTS) break;
    }

    console.log(`\n--- Extraction complete ---`);
    console.log(`Total products extracted: ${allProducts.size}`);

    // Convert to array
    const productsArray = Array.from(allProducts.values());

    // Filter for products with real discounts
    const discountedProducts = productsArray.filter(p =>
      p.originalPrice > p.salePrice && p.salePrice > 0
    );

    console.log(`Products with real discounts: ${discountedProducts.length}`);

    // Use all products if we don't have enough discounted ones
    let finalProducts = discountedProducts.length > 0 ? discountedProducts : productsArray;

    // Save output
    const output = {
      scrapedAt: new Date().toISOString(),
      source: 'oldnavy.com',
      category: 'clearance',
      url: CLEARANCE_URL,
      totalProducts: finalProducts.length,
      products: finalProducts
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`\nSaved ${finalProducts.length} products to ${OUTPUT_FILE}`);

    return finalProducts;

  } catch (error) {
    console.error('Scraper error:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function closePopups(page) {
  const selectors = [
    '[data-testid="modal-close"]',
    '[aria-label="Close"]',
    'button[class*="close"]',
    '#onetrust-accept-btn-handler'
  ];

  for (const selector of selectors) {
    try {
      const btn = await page.$(selector);
      if (btn) await btn.click().catch(() => {});
    } catch (e) {}
  }

  try {
    await page.keyboard.press('Escape');
  } catch (e) {}
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run
if (require.main === module) {
  scrapeOldNavyClearance()
    .then(products => {
      console.log('\n=== SCRAPING COMPLETE ===');
      console.log(`Total products: ${products.length}`);

      if (products.length > 0) {
        const withDiscount = products.filter(p => p.discount > 0);
        console.log(`Products with discounts: ${withDiscount.length}`);

        if (withDiscount.length > 0) {
          const avgDiscount = Math.round(withDiscount.reduce((s, p) => s + p.discount, 0) / withDiscount.length);
          console.log(`Average discount: ${avgDiscount}%`);
        }

        console.log('\nTop 10 products by discount:');
        const sorted = [...products].sort((a, b) => b.discount - a.discount);
        sorted.slice(0, 10).forEach((p, i) => {
          console.log(`${i + 1}. ${p.name.substring(0, 50)}...`);
          console.log(`   $${p.originalPrice.toFixed(2)} -> $${p.salePrice.toFixed(2)} (${p.discount}% off)`);
        });
      }

      console.log(`\nOutput saved to: ${OUTPUT_FILE}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('Scraping failed:', error);
      process.exit(1);
    });
}

module.exports = { scrapeOldNavyClearance };
