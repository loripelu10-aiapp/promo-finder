const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

// Enable stealth plugin
puppeteerExtra.use(StealthPlugin());

/**
 * Target Clearance Scraper with Puppeteer Stealth
 * Scrapes clearance products focusing on shoes and clothing
 * Target: 200+ products with real discounts
 */

// Target clearance URLs for shoes and clothing
const TARGET_CLEARANCE_URLS = {
  womenShoes: 'https://www.target.com/c/women-s-clearance-shoes/-/N-hnwvi',
  menShoes: 'https://www.target.com/c/men-s-clearance-shoes/-/N-mjp2a',
  womenClothing: 'https://www.target.com/c/women-s-clearance-clothing/-/N-56ez2',
  menClothing: 'https://www.target.com/c/men-s-clearance-clothing/-/N-vdpam',
  kidsClothing: 'https://www.target.com/c/kids-clearance-clothing/-/N-y9cit',
  kidsShoes: 'https://www.target.com/c/kids-clearance-shoes/-/N-2ajxz',
  // Additional categories for more products
  allClearance: 'https://www.target.com/c/clearance/-/N-5q0ga',
  athleticShoes: 'https://www.target.com/c/athletic-shoes-clearance/-/N-2k1f3',
  dresses: 'https://www.target.com/c/dresses-clearance-women-s-clothing/-/N-5tdq2',
  activewear: 'https://www.target.com/c/activewear-clearance-women-s-clothing/-/N-5xtvd'
};

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function randomDelay(min = 1000, max = 3000) {
  const time = min + Math.random() * (max - min);
  return delay(time);
}

async function scrollPage(page, maxScrolls = 30) {
  console.log('Scrolling to load more products...');

  let previousHeight = 0;
  let scrollCount = 0;
  let noChangeCount = 0;

  while (scrollCount < maxScrolls && noChangeCount < 5) {
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);

    if (currentHeight === previousHeight) {
      noChangeCount++;
    } else {
      noChangeCount = 0;
    }

    previousHeight = currentHeight;

    // Scroll down in chunks
    await page.evaluate(async () => {
      const scrollStep = 800;
      const currentScroll = window.scrollY;
      window.scrollTo({
        top: currentScroll + scrollStep,
        behavior: 'smooth'
      });
    });

    await delay(500 + Math.random() * 500);
    scrollCount++;

    // Every 10 scrolls, wait longer for lazy load
    if (scrollCount % 10 === 0) {
      console.log(`  Scrolled ${scrollCount} times, waiting for content...`);
      await delay(2000);
    }
  }

  // Scroll back to middle and then bottom to trigger any remaining lazy loads
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight / 2);
  });
  await delay(1000);

  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await delay(1000);

  console.log(`  Completed ${scrollCount} scrolls`);
}

async function clickLoadMore(page) {
  try {
    // Look for "Load more" or "Show more" buttons
    const loadMoreSelectors = [
      'button[data-test="load-more-button"]',
      'button[data-test="show-more-button"]',
      '[data-test="@web/component-load-more-button"]',
      'button:has-text("Load more")',
      'button:has-text("Show more")',
      '[class*="LoadMore"]',
      '[class*="loadMore"]'
    ];

    for (const selector of loadMoreSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          const isVisible = await button.isIntersectingViewport();
          if (isVisible) {
            console.log('Found and clicking load more button...');
            await button.click();
            await delay(3000);
            return true;
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }
  } catch (e) {
    // No load more button found
  }
  return false;
}

async function extractProducts(page, category) {
  return await page.evaluate((cat) => {
    const products = [];

    // Target uses various product card selectors
    const productSelectors = [
      '[data-test="product-card"]',
      '[data-test="@web/ProductCard"]',
      '[class*="ProductCard"]',
      '[class*="product-card"]',
      'article[class*="Card"]',
      '[data-test="product-list"] > div > div',
      'li[class*="styles_productCardListItem"]',
      '[data-test*="product"]'
    ];

    let productCards = [];
    for (const selector of productSelectors) {
      const cards = document.querySelectorAll(selector);
      if (cards.length > 0) {
        productCards = Array.from(cards);
        console.log(`Found ${cards.length} products using selector: ${selector}`);
        break;
      }
    }

    // Fallback: find products by link structure
    if (productCards.length === 0) {
      // Target product URLs follow pattern: /p/product-name/-/A-XXXXXXXX
      const productLinks = document.querySelectorAll('a[href*="/p/"][href*="/-/A-"]');
      const seenParents = new Set();

      productLinks.forEach(link => {
        // Get parent card element
        let parent = link.closest('div[class*="Card"], div[class*="product"], article, li');
        if (parent && !seenParents.has(parent)) {
          seenParents.add(parent);
          productCards.push(parent);
        }
      });
      console.log(`Fallback: Found ${productCards.length} products from links`);
    }

    productCards.forEach((el, index) => {
      try {
        // Extract product link
        const linkEl = el.querySelector('a[href*="/p/"][href*="/-/A-"]') || el.querySelector('a[href*="/p/"]');
        const productUrl = linkEl ? (linkEl.href.startsWith('http') ? linkEl.href : 'https://www.target.com' + linkEl.getAttribute('href')) : '';

        if (!productUrl || !productUrl.includes('/p/')) return;

        // Extract product ID from URL
        const productIdMatch = productUrl.match(/A-(\d+)/);
        const productId = productIdMatch ? productIdMatch[1] : index.toString();

        // Extract name
        let name = '';
        const nameSelectors = [
          '[data-test="product-title"]',
          '[class*="ProductTitle"]',
          '[class*="product-title"]',
          '[class*="styles_truncate"]',
          'h3', 'h4',
          'a[href*="/p/"] span',
          '[class*="Title"]',
          'a[aria-label]'
        ];

        for (const sel of nameSelectors) {
          const nameEl = el.querySelector(sel);
          if (nameEl) {
            const text = nameEl.textContent?.trim() || nameEl.getAttribute('aria-label') || '';
            if (text && text.length > 5 && !text.includes('$')) {
              name = text;
              break;
            }
          }
        }

        // Fallback: extract from link text or aria-label
        if (!name && linkEl) {
          name = linkEl.getAttribute('aria-label') || linkEl.textContent?.trim() || '';
        }

        // Extract prices - Target typically shows "Was $XX" and current price
        let originalPrice = 0;
        let salePrice = 0;

        // Look for sale/current price
        const salePriceSelectors = [
          '[data-test="current-price"]',
          '[data-test="product-price"]',
          '[class*="CurrentPrice"]',
          '[class*="sale-price"]',
          '[class*="styles_currentPrice"]',
          'span[class*="Price"]:not([class*="Compare"]):not([class*="Regular"])'
        ];

        for (const sel of salePriceSelectors) {
          const priceEl = el.querySelector(sel);
          if (priceEl) {
            const text = priceEl.textContent || '';
            const match = text.match(/\$[\d,.]+/);
            if (match) {
              salePrice = parseFloat(match[0].replace(/[$,]/g, ''));
              break;
            }
          }
        }

        // Look for original/regular price (usually has "Was" or "Reg" text)
        const origPriceSelectors = [
          '[data-test="compare-price"]',
          '[data-test="regular-price"]',
          '[class*="ComparePrice"]',
          '[class*="RegularPrice"]',
          '[class*="styles_comparePrice"]',
          '[class*="was-price"]',
          's', // Strikethrough element
          'del',
          '[class*="strikethrough"]'
        ];

        for (const sel of origPriceSelectors) {
          const priceEl = el.querySelector(sel);
          if (priceEl) {
            const text = priceEl.textContent || '';
            const match = text.match(/\$[\d,.]+/);
            if (match) {
              originalPrice = parseFloat(match[0].replace(/[$,]/g, ''));
              break;
            }
          }
        }

        // Also look for "reg" or "was" text near prices
        const allText = el.textContent || '';
        const wasMatch = allText.match(/(?:was|reg\.?|originally)\s*\$?([\d,.]+)/i);
        if (wasMatch && !originalPrice) {
          originalPrice = parseFloat(wasMatch[1].replace(/,/g, ''));
        }

        // Fallback: find all prices in the element
        if (salePrice === 0) {
          const priceMatches = allText.match(/\$[\d,.]+/g);
          if (priceMatches) {
            const prices = priceMatches.map(p => parseFloat(p.replace(/[$,]/g, '')))
              .filter(p => p > 0 && p < 1000)
              .sort((a, b) => a - b);

            const uniquePrices = [...new Set(prices)];
            if (uniquePrices.length >= 2) {
              salePrice = uniquePrices[0];
              originalPrice = uniquePrices[uniquePrices.length - 1];
            } else if (uniquePrices.length === 1) {
              salePrice = uniquePrices[0];
            }
          }
        }

        // Extract image URL
        let imageUrl = '';
        const imgEl = el.querySelector('img');
        if (imgEl) {
          // Target uses data-src for lazy loading
          imageUrl = imgEl.src || imgEl.dataset.src || imgEl.getAttribute('srcset')?.split(' ')[0] || '';

          // Handle srcset
          if (!imageUrl || imageUrl.includes('placeholder')) {
            const srcset = imgEl.srcset || imgEl.dataset.srcset;
            if (srcset) {
              const srcParts = srcset.split(',')[0];
              imageUrl = srcParts.trim().split(' ')[0];
            }
          }

          // Ensure absolute URL
          if (imageUrl && !imageUrl.startsWith('http')) {
            if (imageUrl.startsWith('//')) {
              imageUrl = 'https:' + imageUrl;
            } else if (imageUrl.startsWith('/')) {
              imageUrl = 'https://www.target.com' + imageUrl;
            }
          }
        }

        // Also check picture element
        if (!imageUrl) {
          const pictureSource = el.querySelector('picture source');
          if (pictureSource) {
            const srcset = pictureSource.srcset;
            if (srcset) {
              imageUrl = srcset.split(',')[0].trim().split(' ')[0];
              if (!imageUrl.startsWith('http')) {
                imageUrl = 'https:' + imageUrl;
              }
            }
          }
        }

        // Calculate discount
        const discount = originalPrice > 0 && salePrice < originalPrice && salePrice > 0
          ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
          : 0;

        // Only add if we have required data and there's a real discount
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

async function scrapeCategory(browser, categoryName, url, maxAttempts = 3) {
  console.log(`\n--- Scraping Target ${categoryName} ---`);
  console.log(`URL: ${url}`);

  const allProducts = [];
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    const page = await browser.newPage();

    try {
      // Set realistic viewport
      await page.setViewport({ width: 1920, height: 1080 });

      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Set extra headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
      });

      // Navigate to page
      console.log(`  Attempt ${attempt}/${maxAttempts}: Loading page...`);
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      // Wait for page to stabilize
      await randomDelay(3000, 5000);

      // Check for CAPTCHA or blocking
      const pageContent = await page.content();
      if (pageContent.includes('captcha') || pageContent.includes('Access Denied') || pageContent.includes('blocked')) {
        console.log(`  Warning: Possible blocking detected`);
        await page.screenshot({ path: `/tmp/target-block-${categoryName.replace(/\s/g, '-')}.png` });
      }

      // Wait for products to appear
      const productSelectors = [
        '[data-test="product-card"]',
        '[data-test*="product"]',
        'a[href*="/p/"][href*="/-/A-"]',
        '[class*="ProductCard"]'
      ];

      let foundProducts = false;
      for (const sel of productSelectors) {
        try {
          await page.waitForSelector(sel, { timeout: 15000 });
          foundProducts = true;
          console.log(`  Products found with selector: ${sel}`);
          break;
        } catch (e) {
          // Continue trying
        }
      }

      if (!foundProducts) {
        console.log(`  No products found on attempt ${attempt}, retrying...`);
        await page.screenshot({ path: `/tmp/target-debug-${categoryName.replace(/\s/g, '-')}-${attempt}.png` });
        await page.close();
        await delay(5000);
        continue;
      }

      // Extensive scrolling to load all products
      await scrollPage(page, 50);

      // Try clicking "Load More" button multiple times
      let loadMoreClicks = 0;
      while (loadMoreClicks < 10) {
        const clicked = await clickLoadMore(page);
        if (!clicked) break;
        loadMoreClicks++;
        await scrollPage(page, 10);
      }

      if (loadMoreClicks > 0) {
        console.log(`  Clicked "Load More" ${loadMoreClicks} times`);
      }

      // Final scroll
      await scrollPage(page, 20);
      await delay(2000);

      // Extract products
      const products = await extractProducts(page, categoryName);
      console.log(`  Extracted ${products.length} products with discounts`);

      allProducts.push(...products);
      await page.close();
      break;

    } catch (error) {
      console.log(`  Error on attempt ${attempt}: ${error.message}`);
      try {
        await page.screenshot({ path: `/tmp/target-error-${categoryName.replace(/\s/g, '-')}-${attempt}.png` });
      } catch (e) {}
      await page.close();

      if (attempt < maxAttempts) {
        console.log(`  Waiting before retry...`);
        await delay(10000);
      }
    }
  }

  return allProducts;
}

async function scrapeTargetClearance() {
  console.log('==============================================');
  console.log('TARGET CLEARANCE SCRAPER - Starting');
  console.log('Using puppeteer-extra with stealth plugin');
  console.log('Focus: Shoes and Clothing');
  console.log('==============================================\n');

  let browser;
  const allProducts = [];
  const startTime = Date.now();

  try {
    browser = await puppeteerExtra.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--lang=en-US,en'
      ]
    });

    console.log('Browser launched successfully\n');

    // Categories to scrape - prioritize shoes and clothing
    const categories = [
      { name: 'Women Shoes Clearance', url: TARGET_CLEARANCE_URLS.womenShoes },
      { name: 'Men Shoes Clearance', url: TARGET_CLEARANCE_URLS.menShoes },
      { name: 'Women Clothing Clearance', url: TARGET_CLEARANCE_URLS.womenClothing },
      { name: 'Men Clothing Clearance', url: TARGET_CLEARANCE_URLS.menClothing },
      { name: 'Kids Clothing Clearance', url: TARGET_CLEARANCE_URLS.kidsClothing },
      { name: 'Kids Shoes Clearance', url: TARGET_CLEARANCE_URLS.kidsShoes },
      { name: 'Athletic Shoes Clearance', url: TARGET_CLEARANCE_URLS.athleticShoes },
      { name: 'Dresses Clearance', url: TARGET_CLEARANCE_URLS.dresses },
      { name: 'Activewear Clearance', url: TARGET_CLEARANCE_URLS.activewear }
    ];

    for (const cat of categories) {
      try {
        const products = await scrapeCategory(browser, cat.name, cat.url);
        allProducts.push(...products);
        console.log(`Total ${cat.name}: ${products.length} products`);
        console.log(`Running total: ${allProducts.length} products\n`);

        // Delay between categories to avoid rate limiting
        await randomDelay(5000, 8000);

      } catch (catError) {
        console.error(`Error scraping ${cat.name}:`, catError.message);
      }
    }

    // If we don't have enough products, try the main clearance page
    if (allProducts.length < 200) {
      console.log('\n--- Scraping main clearance page for more products ---');
      try {
        const mainProducts = await scrapeCategory(browser, 'All Clearance', TARGET_CLEARANCE_URLS.allClearance);
        allProducts.push(...mainProducts);
        console.log(`Added ${mainProducts.length} products from main clearance page`);
      } catch (e) {
        console.error('Error scraping main clearance:', e.message);
      }
    }

  } catch (error) {
    console.error('Browser error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
      console.log('\nBrowser closed');
    }
  }

  // Deduplicate products by URL or product ID
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

// Main execution
async function main() {
  const outputPath = '/tmp/target-products.json';

  try {
    const products = await scrapeTargetClearance();

    // Sort by discount (highest first)
    products.sort((a, b) => b.discount - a.discount);

    // Save to JSON file
    const output = {
      scrapeDate: new Date().toISOString(),
      totalProducts: products.length,
      source: 'target.com',
      categories: [
        'Women Shoes Clearance', 'Men Shoes Clearance',
        'Women Clothing Clearance', 'Men Clothing Clearance',
        'Kids Clothing Clearance', 'Kids Shoes Clearance',
        'Athletic Shoes Clearance', 'Dresses Clearance',
        'Activewear Clearance'
      ],
      products
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`Results saved to: ${outputPath}`);

    // Print sample products
    console.log('\n--- Sample Products (Top 10 by Discount) ---');
    products.slice(0, 10).forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.name}`);
      console.log(`   Category: ${p.category}`);
      console.log(`   Original: $${p.originalPrice} -> Sale: $${p.salePrice} (${p.discount}% off)`);
      console.log(`   URL: ${p.productUrl?.substring(0, 70)}...`);
    });

    // Statistics
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

    // Category breakdown
    const categoryBreakdown = {};
    products.forEach(p => {
      categoryBreakdown[p.category] = (categoryBreakdown[p.category] || 0) + 1;
    });

    console.log('\n--- Category Breakdown ---');
    Object.entries(categoryBreakdown)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        console.log(`${category}: ${count} products`);
      });

    return products;
  } catch (error) {
    console.error('Scraper failed:', error);
    throw error;
  }
}

// Export for module use
module.exports = { scrapeTargetClearance };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
