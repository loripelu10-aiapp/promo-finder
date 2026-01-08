const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

/**
 * Scraper for Nordstrom Rack Clearance
 * Uses puppeteer-extra with stealth plugin
 */
async function scrapeNordstromRack(options = {}) {
  const {
    maxProducts = 150,
    outputPath = '/tmp/nordstromrack-products.json',
    headless = true,
    categories = ['shoes', 'clothing']
  } = options;

  console.log('Starting Nordstrom Rack clearance scraper...');
  console.log(`Target: ${maxProducts} products from categories: ${categories.join(', ')}`);

  let browser;
  const allProducts = [];

  try {
    browser = await puppeteer.launch({
      headless: headless ? 'new' : false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--window-size=1920,1080'
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });

    const page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
    });

    // Define clearance category URLs
    const categoryUrls = [
      { url: 'https://www.nordstromrack.com/clearance/shoes', category: 'shoes' },
      { url: 'https://www.nordstromrack.com/clearance/women/clothing', category: 'clothing' },
      { url: 'https://www.nordstromrack.com/clearance/men/clothing', category: 'clothing' },
      { url: 'https://www.nordstromrack.com/clearance', category: 'clearance' }
    ];

    // Filter URLs based on requested categories
    const urlsToScrape = categoryUrls.filter(item =>
      categories.includes(item.category) || categories.includes('all')
    );

    // Scrape each category
    for (const { url, category } of urlsToScrape) {
      if (allProducts.length >= maxProducts) break;

      console.log(`\nScraping category: ${category}`);
      console.log(`URL: ${url}`);

      try {
        const categoryProducts = await scrapeCategory(page, url, category, maxProducts - allProducts.length);

        // Add only unique products
        const existingUrls = new Set(allProducts.map(p => p.url));
        for (const product of categoryProducts) {
          if (!existingUrls.has(product.url)) {
            allProducts.push(product);
            existingUrls.add(product.url);
          }
        }

        console.log(`Found ${categoryProducts.length} products in ${category}`);
        console.log(`Total collected: ${allProducts.length}`);
      } catch (err) {
        console.error(`Error scraping ${category}:`, err.message);
      }

      // Random delay between categories
      await delay(2000 + Math.random() * 2000);
    }

  } catch (error) {
    console.error('Browser error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Filter for real discounts (at least 10% off)
  const discountedProducts = allProducts.filter(p => p.discount >= 10);

  console.log(`\n=== Scraping Complete ===`);
  console.log(`Total products found: ${allProducts.length}`);
  console.log(`Products with real discounts (>=10%): ${discountedProducts.length}`);

  // Save to file
  const output = {
    scrapedAt: new Date().toISOString(),
    source: 'nordstromrack.com',
    totalProducts: discountedProducts.length,
    products: discountedProducts
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved to: ${outputPath}`);

  return discountedProducts;
}

/**
 * Scrape a specific category page with infinite scroll
 */
async function scrapeCategory(page, url, category, maxProducts) {
  const products = [];

  // Navigate to the page
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  // Wait for page to settle
  await delay(5000);

  // Dismiss any popups
  await dismissPopups(page);

  // Wait for products to potentially load
  await delay(3000);

  // First, let's debug what's on the page
  const pageInfo = await page.evaluate(() => {
    // Check for common product container patterns
    const articleCount = document.querySelectorAll('article').length;
    const divWithProduct = document.querySelectorAll('div[class*="product"], div[class*="Product"]').length;
    const linksWithProduct = document.querySelectorAll('a[href*="/product"], a[href*="/pd/"]').length;
    const allDivs = document.querySelectorAll('div[class]');

    // Get class names that might contain product info
    const classesWithNumbers = new Set();
    allDivs.forEach(div => {
      const classes = Array.from(div.classList);
      classes.forEach(c => {
        if (c.toLowerCase().includes('product') ||
            c.toLowerCase().includes('card') ||
            c.toLowerCase().includes('item') ||
            c.toLowerCase().includes('tile')) {
          classesWithNumbers.add(c);
        }
      });
    });

    return {
      articleCount,
      divWithProduct,
      linksWithProduct,
      potentialClasses: Array.from(classesWithNumbers).slice(0, 20),
      bodyText: document.body.innerText.substring(0, 500)
    };
  });

  console.log('  Page analysis:', JSON.stringify(pageInfo, null, 2));

  // Scroll and load more products
  let scrollAttempts = 0;
  const maxScrollAttempts = 15;

  while (scrollAttempts < maxScrollAttempts && products.length < maxProducts) {
    // Extract products currently visible
    const newProducts = await extractProducts(page, category);

    // Add new unique products
    const existingUrls = new Set(products.map(p => p.url));
    for (const product of newProducts) {
      if (!existingUrls.has(product.url) && products.length < maxProducts) {
        products.push(product);
        existingUrls.add(product.url);
      }
    }

    console.log(`  Scroll ${scrollAttempts + 1}: ${products.length} products collected`);

    // If we haven't found anything after first scroll, break early
    if (scrollAttempts > 2 && products.length === 0) {
      console.log('  No products found after multiple attempts, trying different approach...');
      break;
    }

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await delay(2000 + Math.random() * 1000);

    // Try clicking "Load More" or similar buttons
    try {
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        const loadMore = buttons.find(b =>
          b.textContent.toLowerCase().includes('load more') ||
          b.textContent.toLowerCase().includes('show more') ||
          b.textContent.toLowerCase().includes('view more')
        );
        if (loadMore) loadMore.click();
      });
    } catch (e) {
      // Ignore
    }

    scrollAttempts++;
  }

  return products;
}

/**
 * Dismiss popups and modals
 */
async function dismissPopups(page) {
  try {
    await page.evaluate(() => {
      // Common close button selectors
      const closeSelectors = [
        'button[aria-label="Close"]',
        'button[aria-label="close"]',
        '[class*="close"]',
        '[class*="Close"]',
        '[data-testid="close"]',
        '.modal-close',
        '.popup-close'
      ];

      closeSelectors.forEach(sel => {
        const elements = document.querySelectorAll(sel);
        elements.forEach(el => {
          try { el.click(); } catch(e) {}
        });
      });

      // Also try pressing Escape
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
  } catch (e) {
    // Ignore popup dismissal errors
  }
}

/**
 * Extract product data from the current page state
 */
async function extractProducts(page, category) {
  return await page.evaluate((cat) => {
    const products = [];

    // Strategy 1: Look for links that go to product pages
    const productLinks = document.querySelectorAll('a[href*="/pd/"], a[href*="/product/"], a[href*="/events/"]');

    // Strategy 2: Look for article elements or divs with product-like classes
    const productContainers = document.querySelectorAll(
      'article, ' +
      '[class*="ProductCard"], [class*="product-card"], [class*="productCard"], ' +
      '[class*="ProductModule"], [class*="product-module"], ' +
      '[class*="ProductTile"], [class*="product-tile"], ' +
      '[data-testid*="product"], [data-automation*="product"]'
    );

    // Process containers first
    const processedUrls = new Set();

    productContainers.forEach((container, index) => {
      try {
        const product = extractProductFromContainer(container, index, cat);
        if (product && !processedUrls.has(product.url)) {
          products.push(product);
          processedUrls.add(product.url);
        }
      } catch (e) {
        // Skip failed extractions
      }
    });

    // If no products from containers, try product links
    if (products.length === 0) {
      productLinks.forEach((link, index) => {
        try {
          // Get the parent container that might have more info
          let container = link.closest('article') || link.closest('div[class*="product"]') || link.parentElement.parentElement;
          const product = extractProductFromContainer(container || link, index, cat);
          if (product && !processedUrls.has(product.url)) {
            products.push(product);
            processedUrls.add(product.url);
          }
        } catch (e) {
          // Skip
        }
      });
    }

    return products;

    function extractProductFromContainer(container, index, cat) {
      // Get the product URL
      let link = container.tagName === 'A' ? container : container.querySelector('a[href*="/pd/"], a[href*="/product/"], a[href*="/events/"], a[href*="/s/"]');
      if (!link) {
        link = container.querySelector('a[href]');
      }
      if (!link) return null;

      let productUrl = link.href || link.getAttribute('href') || '';
      if (!productUrl) return null;

      // Make sure it's a Nordstrom Rack product URL
      if (!productUrl.includes('nordstromrack.com') && !productUrl.startsWith('/')) {
        return null;
      }
      if (productUrl.startsWith('/')) {
        productUrl = 'https://www.nordstromrack.com' + productUrl;
      }

      // Extract brand from URL pattern: /s/brand-name-product-description/
      // Example: /s/dr-martens-leona-lug-sole-platform-derby-women/
      let urlBrand = '';
      const urlMatch = productUrl.match(/\/s\/([a-z0-9-]+)-[a-z0-9-]+\/\d+/i);
      if (urlMatch) {
        // Extract what looks like a brand from the URL
        const urlSlug = urlMatch[1];
        // Common brand patterns in URLs
        const brandPatterns = [
          { pattern: /^dr-martens/, brand: 'Dr. Martens' },
          { pattern: /^adidas/, brand: 'Adidas' },
          { pattern: /^nike/, brand: 'Nike' },
          { pattern: /^new-balance/, brand: 'New Balance' },
          { pattern: /^ugg/, brand: 'UGG' },
          { pattern: /^koolaburra-by-ugg/, brand: 'Koolaburra by UGG' },
          { pattern: /^birkenstock/, brand: 'Birkenstock' },
          { pattern: /^vince/, brand: 'Vince' },
          { pattern: /^sam-edelman/, brand: 'Sam Edelman' },
          { pattern: /^steve-madden/, brand: 'Steve Madden' },
          { pattern: /^calvin-klein/, brand: 'Calvin Klein' },
          { pattern: /^ralph-lauren/, brand: 'Ralph Lauren' },
          { pattern: /^polo-ralph-lauren/, brand: 'Polo Ralph Lauren' },
          { pattern: /^tommy-hilfiger/, brand: 'Tommy Hilfiger' },
          { pattern: /^michael-kors/, brand: 'Michael Kors' },
          { pattern: /^coach/, brand: 'Coach' },
          { pattern: /^kate-spade/, brand: 'Kate Spade' },
          { pattern: /^tory-burch/, brand: 'Tory Burch' },
          { pattern: /^stuart-weitzman/, brand: 'Stuart Weitzman' },
          { pattern: /^theory/, brand: 'Theory' },
          { pattern: /^free-people/, brand: 'Free People' },
          { pattern: /^madewell/, brand: 'Madewell' },
          { pattern: /^allsaints/, brand: 'AllSaints' },
          { pattern: /^ted-baker/, brand: 'Ted Baker' },
          { pattern: /^cole-haan/, brand: 'Cole Haan' },
          { pattern: /^clarks/, brand: 'Clarks' },
          { pattern: /^ecco/, brand: 'ECCO' },
          { pattern: /^lucky-brand/, brand: 'Lucky Brand' },
          { pattern: /^levis/, brand: "Levi's" },
          { pattern: /^hudson-jeans/, brand: 'Hudson Jeans' },
          { pattern: /^7-for-all-mankind/, brand: '7 For All Mankind' },
          { pattern: /^citizens-of-humanity/, brand: 'Citizens of Humanity' },
          { pattern: /^ag-jeans|^ag-/, brand: 'AG Jeans' },
          { pattern: /^paige/, brand: 'PAIGE' },
          { pattern: /^north-face/, brand: 'The North Face' },
          { pattern: /^columbia/, brand: 'Columbia' },
          { pattern: /^under-armour/, brand: 'Under Armour' },
          { pattern: /^puma/, brand: 'PUMA' },
          { pattern: /^reebok/, brand: 'Reebok' },
          { pattern: /^converse/, brand: 'Converse' },
          { pattern: /^vans/, brand: 'Vans' },
          { pattern: /^asics/, brand: 'ASICS' },
          { pattern: /^brooks/, brand: 'Brooks' },
          { pattern: /^skechers/, brand: 'Skechers' },
          { pattern: /^crocs/, brand: 'Crocs' },
          { pattern: /^sorel/, brand: 'SOREL' },
          { pattern: /^hoka/, brand: 'HOKA' },
          { pattern: /^on-running|^on-cloud/, brand: 'On Running' },
        ];

        for (const bp of brandPatterns) {
          if (bp.pattern.test(urlSlug)) {
            urlBrand = bp.brand;
            break;
          }
        }

        // If no known brand matched, try to extract from URL
        if (!urlBrand) {
          // Take the first 1-3 hyphenated words as potential brand
          const parts = urlSlug.split('-');
          if (parts.length >= 2) {
            // Capitalize each word
            const potentialBrand = parts.slice(0, Math.min(2, parts.length))
              .map(w => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ');
            urlBrand = potentialBrand;
          }
        }
      }

      // Extract all text from the container for analysis
      const allText = container.innerText || container.textContent || '';
      const lines = allText.split('\n').map(l => l.trim()).filter(l => l && l.length > 1);

      // Extract brand and name from DOM
      let brand = '';
      let name = '';

      // Look for specific elements
      const brandEl = container.querySelector('[class*="brand"], [class*="Brand"], [data-testid*="brand"]');
      const nameEl = container.querySelector('[class*="title"], [class*="Title"], [class*="name"], [class*="Name"], h3, h4, [data-testid*="title"]');

      if (brandEl) brand = brandEl.textContent.trim();
      if (nameEl) name = nameEl.textContent.trim();

      // Use URL brand if no brand found in DOM
      if (!brand && urlBrand) {
        brand = urlBrand;
      }

      // Fallback: use first lines of text
      if (!brand && !name && lines.length > 0) {
        // First non-price line is likely brand
        for (const line of lines) {
          if (!line.startsWith('$') && !line.match(/^\d+%/) && line.length > 2) {
            if (!brand) {
              brand = line;
            } else if (!name) {
              name = line;
              break;
            }
          }
        }
      }

      // Extract prices - look for dollar amounts
      const priceMatches = allText.match(/\$[\d,]+\.?\d*/g) || [];
      let originalPrice = 0;
      let salePrice = 0;
      let discount = 0;

      if (priceMatches.length >= 2) {
        const prices = priceMatches
          .map(p => parseFloat(p.replace(/[$,]/g, '')))
          .filter(p => !isNaN(p) && p > 0)
          .sort((a, b) => a - b);

        if (prices.length >= 2) {
          salePrice = prices[0];
          originalPrice = prices[prices.length - 1];
          discount = Math.round(((originalPrice - salePrice) / originalPrice) * 100);
        } else if (prices.length === 1) {
          salePrice = prices[0];
          originalPrice = salePrice;
        }
      } else if (priceMatches.length === 1) {
        salePrice = parseFloat(priceMatches[0].replace(/[$,]/g, ''));
        originalPrice = salePrice;
      }

      // Look for explicit discount text
      const discountMatch = allText.match(/(\d+)%\s*off/i) || allText.match(/save\s*(\d+)%/i);
      if (discountMatch && !discount) {
        discount = parseInt(discountMatch[1]);
      }

      // Get image URL
      const img = container.querySelector('img');
      let imageUrl = '';
      if (img) {
        imageUrl = img.src || img.getAttribute('data-src') || img.currentSrc || '';
        // Handle srcset
        if (!imageUrl && img.srcset) {
          const srcsetParts = img.srcset.split(',');
          if (srcsetParts.length > 0) {
            imageUrl = srcsetParts[0].trim().split(' ')[0];
          }
        }
      }

      // Ensure image URL is absolute
      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = imageUrl.startsWith('//') ? 'https:' + imageUrl : 'https://www.nordstromrack.com' + imageUrl;
      }

      // Validate we have enough data
      if (!brand && !name) return null;
      if (salePrice <= 0) return null;

      // Create full name, avoiding duplication
      let fullName = name || '';
      if (brand && fullName && !fullName.toLowerCase().includes(brand.toLowerCase())) {
        fullName = `${brand} - ${fullName}`;
      } else if (!fullName) {
        fullName = brand;
      }

      return {
        id: `nordstromrack-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
        brand: brand || 'Nordstrom Rack',
        name: fullName.substring(0, 150),
        category: cat,
        originalPrice: originalPrice || salePrice,
        salePrice,
        discount,
        image: imageUrl,
        source: 'nordstromrack.com',
        url: productUrl,
        isNew: discount >= 30,
        scrapedAt: new Date().toISOString()
      };
    }
  }, category);
}

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main execution
if (require.main === module) {
  scrapeNordstromRack({
    maxProducts: 150,
    outputPath: '/tmp/nordstromrack-products.json',
    headless: true,
    categories: ['shoes', 'clothing']
  })
    .then(products => {
      console.log(`\nSuccessfully scraped ${products.length} products`);
      process.exit(0);
    })
    .catch(error => {
      console.error('Scraping failed:', error);
      process.exit(1);
    });
}

module.exports = { scrapeNordstromRack };
