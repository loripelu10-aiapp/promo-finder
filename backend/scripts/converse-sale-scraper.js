const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

// Add stealth plugin
puppeteer.use(StealthPlugin());

// Converse sale page
const TARGET_URL = 'https://www.converse.com/shop/sale';
const OUTPUT_FILE = '/tmp/converse-products.json';

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 800;
      const maxScrolls = 150;
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
      }, 150);
    });
  });
}

async function clickLoadMore(page) {
  try {
    // Look for "Load More" or "Show More" buttons
    const loadMoreSelectors = [
      'button[data-testid="load-more"]',
      'button:contains("Load More")',
      'button:contains("Show More")',
      '.load-more-button',
      '[class*="load-more"]',
      'button[class*="LoadMore"]',
      'a[class*="load-more"]'
    ];

    for (const selector of loadMoreSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          const isVisible = await button.isIntersectingViewport();
          if (isVisible) {
            await button.click();
            console.log(`Clicked load more button: ${selector}`);
            return true;
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    // Try to find by text content
    const clicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, a');
      for (const btn of buttons) {
        const text = btn.textContent.toLowerCase();
        if (text.includes('load more') || text.includes('show more') || text.includes('view more')) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    return clicked;
  } catch (e) {
    return false;
  }
}

async function extractProducts(page) {
  return await page.evaluate(() => {
    const products = [];
    const processedUrls = new Set();

    // Strategy 1: Find product tiles (Converse specific)
    const productTiles = document.querySelectorAll('.product-tile, [class*="product-tile"], [data-testid="product-card"]');

    console.log(`Found ${productTiles.length} product tiles`);

    productTiles.forEach((tile) => {
      try {
        // Find all links in the tile
        const links = tile.querySelectorAll('a');
        let productUrl = '';
        let productName = '';

        // Look for the main product link
        links.forEach(link => {
          const href = link.href;
          // Converse product URLs typically contain /pd/ or /shop/p/
          if (href && (href.includes('/pd/') || href.includes('/shop/p/') || href.match(/converse\.com\/[a-z-]+\/[a-z0-9-]+\/[A-Z0-9]+\.html/i))) {
            if (!productUrl) {
              productUrl = href;
            }
          }
          // Get product name from link aria-label or text
          const ariaLabel = link.getAttribute('aria-label');
          if (ariaLabel && ariaLabel.length > 3 && !productName) {
            productName = ariaLabel;
          }
        });

        // Fallback: get first link if no product link found
        if (!productUrl && links.length > 0) {
          for (const link of links) {
            if (link.href && link.href.includes('converse.com') && !link.href.includes('#')) {
              productUrl = link.href;
              break;
            }
          }
        }

        // Get product name from various sources
        if (!productName) {
          const nameElement = tile.querySelector('.product-tile__title, [class*="title"], [class*="name"], h2, h3, h4');
          if (nameElement) {
            productName = nameElement.textContent.trim();
          }
        }

        // If still no name, try to extract from tile text
        if (!productName) {
          const tileText = tile.innerText;
          const lines = tileText.split('\n').filter(l => l.trim().length > 0);
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.match(/^\$/) && trimmed.length > 3 && trimmed.length < 100 && !trimmed.match(/\d+ colors?/i)) {
              productName = trimmed;
              break;
            }
          }
        }

        if (!productName || productName.length < 3) return;
        if (processedUrls.has(productUrl)) return;

        // Extract image URL
        const images = tile.querySelectorAll('img');
        let imageUrl = '';
        for (const img of images) {
          const src = img.src || img.dataset.src || img.getAttribute('data-src') || '';
          // Skip placeholder images
          if (src && !src.startsWith('data:') && src !== '//:0' && (src.includes('converse') || src.includes('nike') || src.includes('images'))) {
            imageUrl = src;
            break;
          }
        }

        // Try srcset if no src found
        if (!imageUrl) {
          for (const img of images) {
            const srcset = img.getAttribute('srcset');
            if (srcset) {
              const firstSrc = srcset.split(',')[0].split(' ')[0];
              if (firstSrc && !firstSrc.startsWith('data:')) {
                imageUrl = firstSrc;
                break;
              }
            }
          }
        }

        // Extract prices - look for dollar amounts
        const tileText = tile.innerText;
        const priceMatches = tileText.match(/\$\d+\.?\d{0,2}/g);

        let originalPrice = '';
        let salePrice = '';

        if (priceMatches && priceMatches.length >= 2) {
          // Parse prices and get unique values
          const parsedPrices = priceMatches.map(p => ({
            text: p,
            value: parseFloat(p.replace('$', ''))
          }));

          // Deduplicate by value
          const uniquePrices = [];
          const seenValues = new Set();
          for (const p of parsedPrices) {
            if (!seenValues.has(p.value) && p.value > 0) {
              seenValues.add(p.value);
              uniquePrices.push(p);
            }
          }

          // Sort by value descending (highest first = original price)
          uniquePrices.sort((a, b) => b.value - a.value);

          if (uniquePrices.length >= 2) {
            originalPrice = uniquePrices[0].text;
            salePrice = uniquePrices[1].text;
          } else if (uniquePrices.length === 1) {
            salePrice = uniquePrices[0].text;
          }
        } else if (priceMatches && priceMatches.length === 1) {
          salePrice = priceMatches[0];
        }

        // Also try to find struck-through price specifically
        const strikethrough = tile.querySelector('del, s, [class*="strikethrough"], [class*="original"], [class*="was-price"]');
        if (strikethrough) {
          const strikePrice = strikethrough.textContent.match(/\$\d+\.?\d{0,2}/);
          if (strikePrice) {
            originalPrice = strikePrice[0];
          }
        }

        // Look for sale price in specific element
        const salePriceEl = tile.querySelector('[class*="sale"], [class*="current"], [class*="now"], .product-tile__price--sale');
        if (salePriceEl) {
          const salePriceMatch = salePriceEl.textContent.match(/\$\d+\.?\d{0,2}/);
          if (salePriceMatch) {
            salePrice = salePriceMatch[0];
          }
        }

        // Only add if we have meaningful data with both prices (indicating a sale)
        if (productName && originalPrice && salePrice && productUrl) {
          const origVal = parseFloat(originalPrice.replace('$', ''));
          const saleVal = parseFloat(salePrice.replace('$', ''));

          // Only add if there's actually a discount
          if (origVal > saleVal && saleVal > 0) {
            processedUrls.add(productUrl);
            products.push({
              name: productName,
              originalPrice,
              salePrice,
              imageUrl,
              productUrl
            });
          }
        }
      } catch (e) {
        // Skip this tile
      }
    });

    // Strategy 2: Find product cards using data attributes
    if (products.length < 20) {
      const productCards = document.querySelectorAll('[data-testid="product-card"], [data-component="ProductCard"], article[class*="product"]');

      productCards.forEach((card) => {
        try {
          const link = card.querySelector('a[href*="/pd/"], a[href*="/shop/p/"]') || card.querySelector('a');
          if (!link) return;

          const productUrl = link.href;
          if (processedUrls.has(productUrl)) return;

          let productName = link.getAttribute('aria-label') ||
                           card.querySelector('h2, h3, h4, [class*="title"], [class*="name"]')?.textContent?.trim();

          if (!productName) return;

          // Get image
          const img = card.querySelector('img');
          let imageUrl = img?.src || img?.dataset?.src || '';

          // Get prices
          const cardText = card.innerText;
          const priceMatches = cardText.match(/\$\d+\.?\d{0,2}/g);

          if (priceMatches && priceMatches.length >= 2) {
            const prices = [...new Set(priceMatches.map(p => parseFloat(p.replace('$', ''))))].sort((a, b) => b - a);
            if (prices.length >= 2 && prices[0] > prices[1]) {
              processedUrls.add(productUrl);
              products.push({
                name: productName,
                originalPrice: '$' + prices[0].toFixed(2),
                salePrice: '$' + prices[1].toFixed(2),
                imageUrl,
                productUrl
              });
            }
          }
        } catch (e) {
          // Skip
        }
      });
    }

    // Strategy 3: Find by generic product elements
    if (products.length < 20) {
      const allLinks = document.querySelectorAll('a[href*="/pd/"], a[href*="/shop/p/"]');

      allLinks.forEach((link) => {
        try {
          const productUrl = link.href;
          if (processedUrls.has(productUrl)) return;

          // Find parent container
          let container = link.closest('[class*="product"], [class*="tile"], [class*="card"], article, li');
          if (!container) container = link.parentElement?.parentElement;
          if (!container) return;

          let productName = link.getAttribute('aria-label') || link.getAttribute('title');
          if (!productName) {
            productName = container.querySelector('h2, h3, h4, [class*="title"], [class*="name"]')?.textContent?.trim();
          }
          if (!productName || productName.length < 3) return;

          // Get image
          const img = container.querySelector('img');
          let imageUrl = img?.src || img?.dataset?.src || '';

          // Get prices from container
          const containerText = container.innerText;
          const priceMatches = containerText.match(/\$\d+\.?\d{0,2}/g);

          if (priceMatches && priceMatches.length >= 2) {
            const prices = [...new Set(priceMatches.map(p => parseFloat(p.replace('$', ''))))].sort((a, b) => b - a);
            if (prices.length >= 2 && prices[0] > prices[1]) {
              processedUrls.add(productUrl);
              products.push({
                name: productName,
                originalPrice: '$' + prices[0].toFixed(2),
                salePrice: '$' + prices[1].toFixed(2),
                imageUrl,
                productUrl
              });
            }
          }
        } catch (e) {
          // Skip
        }
      });
    }

    return products;
  });
}

async function scrapeConverseOutlet() {
  console.log('Starting Converse sale scraper...');
  console.log(`Target: ${TARGET_URL}`);
  console.log(`Output: ${OUTPUT_FILE}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
  });

  // Override webdriver detection
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    window.chrome = { runtime: {} };
  });

  try {
    console.log('Navigating to Converse sale page...');

    // Set a longer timeout and use domcontentloaded for faster initial load
    await page.goto(TARGET_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 120000
    });

    console.log('Page loaded, waiting for content...');
    await delay(8000);

    // Handle cookie consent
    try {
      const cookieButton = await page.$('#onetrust-accept-btn-handler, [id*="accept"], button[class*="accept"]');
      if (cookieButton) {
        await cookieButton.click();
        console.log('Accepted cookies');
        await delay(1000);
      }
    } catch (e) {}

    // Check if we're on the right page
    const currentUrl = await page.url();
    const pageTitle = await page.title();
    console.log(`Current URL: ${currentUrl}`);
    console.log(`Page Title: ${pageTitle}`);

    // Save initial HTML for debugging
    const initialHtml = await page.content();
    fs.writeFileSync('/tmp/converse-debug-initial.html', initialHtml);
    console.log('Saved initial debug HTML');

    // Check what product elements exist
    const elemCount = await page.evaluate(() => {
      return {
        productTile: document.querySelectorAll('.product-tile').length,
        productTileAny: document.querySelectorAll('[class*="product-tile"]').length,
        productCard: document.querySelectorAll('[class*="product-card"]').length,
        productAny: document.querySelectorAll('[class*="product"]').length,
        linkToPd: document.querySelectorAll('a[href*="/pd/"]').length,
        linkToShopP: document.querySelectorAll('a[href*="/shop/p/"]').length,
        images: document.querySelectorAll('img').length,
        articles: document.querySelectorAll('article').length
      };
    });
    console.log('Initial element counts:', elemCount);

    // Take screenshot
    await page.screenshot({ path: '/tmp/converse-screenshot-initial.png', fullPage: false });

    // Scroll to load more products
    console.log('Scrolling to load products...');

    let allProducts = [];
    const seenUrls = new Set();
    let previousCount = 0;
    let stableCount = 0;
    const maxAttempts = 30;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Scroll down
      await autoScroll(page);
      await delay(2000);

      // Try clicking load more button
      const clickedLoadMore = await clickLoadMore(page);
      if (clickedLoadMore) {
        console.log('Clicked load more button, waiting for products...');
        await delay(3000);
      }

      // Extract products
      const products = await extractProducts(page);

      // Filter out duplicates
      const newProducts = products.filter(p => p.productUrl && !seenUrls.has(p.productUrl));

      for (const p of newProducts) {
        seenUrls.add(p.productUrl);
        allProducts.push(p);
      }

      console.log(`Attempt ${attempt + 1}/${maxAttempts}: Found ${products.length} products on page, ${newProducts.length} new. Total unique: ${allProducts.length}`);

      // Check if we've reached our goal
      if (allProducts.length >= 100) {
        console.log('Reached 100+ products!');
        break;
      }

      // Check if product count has stabilized
      if (allProducts.length === previousCount) {
        stableCount++;
        if (stableCount >= 5) {
          console.log('Product count stable for 5 attempts, checking for more content...');

          // Try one more aggressive scroll
          await page.evaluate(() => window.scrollTo(0, 0));
          await delay(1000);
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await delay(3000);

          const finalProducts = await extractProducts(page);
          const finalNew = finalProducts.filter(p => p.productUrl && !seenUrls.has(p.productUrl));

          if (finalNew.length === 0) {
            console.log('No more new products found, stopping...');
            break;
          }

          for (const p of finalNew) {
            seenUrls.add(p.productUrl);
            allProducts.push(p);
          }
          stableCount = 0;
        }
      } else {
        stableCount = 0;
      }
      previousCount = allProducts.length;

      // Additional scroll for infinite scroll pages
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await delay(1500);
    }

    // Take final screenshot
    await page.screenshot({ path: '/tmp/converse-screenshot-final.png', fullPage: false });

    // Save final HTML for debugging
    const finalHtml = await page.content();
    fs.writeFileSync('/tmp/converse-debug-final.html', finalHtml);
    console.log('Saved final debug HTML');

    // Process products - validate discounts and clean data
    const validProducts = [];

    for (const product of allProducts) {
      // Parse prices
      const originalPrice = parseFloat(product.originalPrice.replace(/[$,]/g, ''));
      const salePrice = parseFloat(product.salePrice.replace(/[$,]/g, ''));

      // Validate discount
      if (!originalPrice || !salePrice || originalPrice <= salePrice || salePrice <= 0) {
        continue;
      }

      const discountPercent = Math.round(((originalPrice - salePrice) / originalPrice) * 100);

      // Skip unrealistic discounts
      if (discountPercent < 5 || discountPercent > 80) {
        continue;
      }

      // Clean up name
      let cleanName = product.name;
      if (cleanName.startsWith('View ')) {
        cleanName = cleanName.substring(5);
      }
      cleanName = cleanName.replace(/\s+/g, ' ').trim();

      // Ensure image URL is absolute
      let imageUrl = product.imageUrl;
      if (imageUrl && !imageUrl.startsWith('http')) {
        if (imageUrl.startsWith('//')) {
          imageUrl = 'https:' + imageUrl;
        } else if (imageUrl.startsWith('/')) {
          imageUrl = 'https://www.converse.com' + imageUrl;
        }
      }

      validProducts.push({
        name: cleanName,
        originalPrice: '$' + originalPrice.toFixed(2),
        salePrice: '$' + salePrice.toFixed(2),
        discountPercent,
        imageUrl: imageUrl || '',
        productUrl: product.productUrl
      });
    }

    // Sort by discount percentage
    validProducts.sort((a, b) => b.discountPercent - a.discountPercent);

    console.log(`\n========================================`);
    console.log(`SCRAPING COMPLETE`);
    console.log(`========================================`);
    console.log(`Total products found: ${allProducts.length}`);
    console.log(`Products with valid discounts: ${validProducts.length}`);

    const output = {
      scrapedAt: new Date().toISOString(),
      source: TARGET_URL,
      totalProductsFound: allProducts.length,
      validDiscountedProducts: validProducts.length,
      products: validProducts
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`\nResults saved to ${OUTPUT_FILE}`);

    if (validProducts.length > 0) {
      console.log('\n--- Sample Products (Top 15 by discount) ---');
      validProducts.slice(0, 15).forEach((p, i) => {
        console.log(`\n${i + 1}. ${p.name}`);
        console.log(`   Price: ${p.originalPrice} -> ${p.salePrice} (${p.discountPercent}% off)`);
        console.log(`   URL: ${p.productUrl}`);
      });
    }

    return output;

  } catch (error) {
    console.error('Scraping error:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the scraper
scrapeConverseOutlet()
  .then(result => {
    console.log('\n========================================');
    console.log('Scraping completed successfully!');
    console.log(`Total products saved: ${result.validDiscountedProducts}`);
    console.log('========================================');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nScraping failed:', error);
    process.exit(1);
  });
