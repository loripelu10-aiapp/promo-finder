const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

const OUTPUT_FILE = '/tmp/lululemon-products.json';
const TARGET_PRODUCTS = 100;

// GraphQL API endpoint
const GRAPHQL_URL = 'https://shop.lululemon.com/api/graphql';

/**
 * Scraper for Lululemon "We Made Too Much" sale products
 * Uses puppeteer-extra with stealth plugin to avoid bot detection
 * Fetches product data via the Salesforce GraphQL API
 */
async function scrapeLululemon() {
  console.log('Starting Lululemon "We Made Too Much" scraper...');
  console.log(`Target products: ${TARGET_PRODUCTS}+`);

  let browser = null;
  const allProducts = new Map(); // Use Map to deduplicate by product URL

  try {
    // Launch browser with stealth settings
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
        '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });

    const page = await browser.newPage();

    // Set additional headers
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    });

    // First, load the main page to get cookies and establish session
    console.log('Loading main page to establish session...');
    await page.goto('https://shop.lululemon.com/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await delay(3000);

    // Now try to fetch products via the GraphQL API
    console.log('\nFetching products via GraphQL API...');

    // Categories to fetch from the sale section
    const categoryIds = [
      'we-made-too-much-702',     // Main WMTM
      'womens-we-made-too-much',  // Women's sale
      'mens-we-made-too-much',    // Men's sale
      'accessories-we-made-too-much' // Accessories sale
    ];

    for (const categoryId of categoryIds) {
      console.log(`\nFetching category: ${categoryId}`);

      // Fetch multiple pages
      for (let pageNum = 0; pageNum < 5; pageNum++) {
        const offset = pageNum * 48;

        try {
          const products = await page.evaluate(async (catId, off) => {
            // GraphQL query for product listing
            const query = `
              query productSearch($searchQuery: String, $sortBy: String, $limit: Int, $offset: Int) {
                productSearch(
                  searchQuery: $searchQuery
                  sortBy: $sortBy
                  limit: $limit
                  offset: $offset
                ) {
                  total
                  products {
                    productId
                    displayName
                    pdpUrl
                    swatchImage
                    price {
                      listPrice
                      salePrice
                    }
                  }
                }
              }
            `;

            try {
              const response = await fetch('https://shop.lululemon.com/.graph/intl', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify({
                  query: query,
                  variables: {
                    searchQuery: catId,
                    sortBy: 'relevance',
                    limit: 48,
                    offset: off
                  }
                })
              });

              if (response.ok) {
                const data = await response.json();
                return data?.data?.productSearch?.products || [];
              }
            } catch (e) {
              console.error('GraphQL fetch error:', e);
            }

            return [];
          }, categoryId, offset);

          if (products.length === 0) {
            console.log(`  No more products found at offset ${offset}`);
            break;
          }

          console.log(`  Found ${products.length} products at offset ${offset}`);

          // Process products
          for (const p of products) {
            if (p.displayName && p.pdpUrl && p.price) {
              const salePrice = p.price.salePrice || 0;
              const originalPrice = p.price.listPrice || salePrice;

              // Only add if there's a discount
              if (originalPrice > salePrice && salePrice > 0) {
                const key = p.pdpUrl.split('?')[0];
                if (!allProducts.has(key)) {
                  const discount = Math.round(((originalPrice - salePrice) / originalPrice) * 100);

                  allProducts.set(key, {
                    id: `lululemon-${p.productId || Date.now()}-${allProducts.size}`,
                    name: p.displayName.replace(/\*/g, '').trim(),
                    brand: 'lululemon',
                    category: 'clothing',
                    originalPrice,
                    salePrice,
                    discount,
                    imageUrl: p.swatchImage ? `https://images.lululemon.com${p.swatchImage}` : null,
                    productUrl: `https://shop.lululemon.com${p.pdpUrl}`,
                    source: 'lululemon.com',
                    scrapedAt: new Date().toISOString()
                  });
                }
              }
            }
          }

          console.log(`  Total unique discounted products: ${allProducts.size}`);

          if (allProducts.size >= TARGET_PRODUCTS) {
            console.log(`  Reached target of ${TARGET_PRODUCTS}+ products!`);
            break;
          }

          await delay(1000); // Rate limiting

        } catch (fetchError) {
          console.error(`  Error fetching page ${pageNum}:`, fetchError.message);
          break;
        }
      }

      if (allProducts.size >= TARGET_PRODUCTS) {
        break;
      }
    }

    // If we didn't get enough from API, fall back to DOM scraping
    if (allProducts.size < TARGET_PRODUCTS) {
      console.log('\nFalling back to DOM scraping...');

      const urls = [
        'https://shop.lululemon.com/c/sale/_/N-1z0xcmkZ1z0xl1eZ8ok'
      ];

      for (const url of urls) {
        console.log(`Scraping: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await delay(4000);
        await closePopups(page);
        await scrollToLoadAll(page);
        await delay(2000);

        const domProducts = await extractProductsFromPage(page);
        console.log(`Found ${domProducts.length} products in DOM`);

        for (const product of domProducts) {
          const key = product.productUrl.split('?')[0];
          if (!allProducts.has(key)) {
            allProducts.set(key, product);
          }
        }
      }
    }

    // Save debug info
    const html = await page.content();
    fs.writeFileSync('/tmp/lululemon-debug.html', html);

    // Convert map to array
    const productsArray = Array.from(allProducts.values());
    console.log(`\nTotal extracted products: ${productsArray.length}`);

    // Filter to only products with real discounts
    const discountedProducts = productsArray.filter(p =>
      p.originalPrice > p.salePrice && p.salePrice > 0
    );

    console.log(`Products with real discounts: ${discountedProducts.length}`);

    // Save to JSON file
    const output = {
      scrapedAt: new Date().toISOString(),
      source: 'lululemon.com',
      url: 'https://shop.lululemon.com/c/womens-we-made-too-much',
      totalProducts: discountedProducts.length,
      products: discountedProducts
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`Saved ${discountedProducts.length} products to ${OUTPUT_FILE}`);

    return discountedProducts;

  } catch (error) {
    console.error('Scraper error:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Extract products from API response JSON
 */
function extractProductsFromApiResponse(json, products) {
  const traverse = (obj) => {
    if (!obj || typeof obj !== 'object') return;

    // Check if this object looks like a product
    if (obj.displayName || obj.productName) {
      const name = obj.displayName || obj.productName;
      let salePrice = 0;
      let originalPrice = 0;

      // Try different price structures
      if (obj.price) {
        salePrice = obj.price.salePrice || obj.price.sale || obj.price.current || 0;
        originalPrice = obj.price.listPrice || obj.price.original || obj.price.regular || salePrice;
      } else if (obj.prices) {
        salePrice = obj.prices.salePrice || obj.prices.sale || 0;
        originalPrice = obj.prices.listPrice || obj.prices.original || obj.prices.regular || salePrice;
      } else {
        salePrice = obj.salePrice || obj.currentPrice || 0;
        originalPrice = obj.listPrice || obj.originalPrice || obj.regularPrice || salePrice;
      }

      const url = obj.pdpUrl || obj.url || obj.productUrl || '';
      const imageUrl = obj.swatchImage || obj.mainImage || obj.defaultImage || obj.imageUrl || '';

      if (name && (salePrice > 0 || originalPrice > 0)) {
        const fullUrl = url.startsWith('http') ? url : `https://shop.lululemon.com${url}`;
        const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : (imageUrl ? `https://images.lululemon.com${imageUrl}` : null);

        const discount = originalPrice > salePrice
          ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
          : 0;

        const nameL = name.toLowerCase();
        let category = 'clothing';
        if (nameL.includes('shoe') || nameL.includes('sneaker') || nameL.includes('sandal')) {
          category = 'shoes';
        } else if (nameL.includes('bag') || nameL.includes('belt') || nameL.includes('hat') ||
                   nameL.includes('sock') || nameL.includes('mat') || nameL.includes('bottle')) {
          category = 'accessories';
        }

        products.push({
          id: `lululemon-api-${Date.now()}-${products.length}`,
          name: String(name).replace(/\*/g, '').trim().substring(0, 200),
          brand: 'lululemon',
          category,
          originalPrice: originalPrice || salePrice,
          salePrice: salePrice || originalPrice,
          discount,
          imageUrl: fullImageUrl,
          productUrl: fullUrl,
          source: 'lululemon.com',
          scrapedAt: new Date().toISOString()
        });
      }
    }

    // Recursively search through arrays and objects
    if (Array.isArray(obj)) {
      obj.forEach(item => traverse(item));
    } else {
      Object.values(obj).forEach(val => traverse(val));
    }
  };

  traverse(json);
}

/**
 * Scroll the page to load all lazy-loaded products
 */
async function scrollToLoadAll(page) {
  let lastHeight = 0;
  let stableCount = 0;

  for (let i = 0; i < 30; i++) {
    const currentHeight = await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight * 2);
      return document.body.scrollHeight;
    });

    await delay(1500);

    // Check if height hasn't changed
    if (currentHeight === lastHeight) {
      stableCount++;
      if (stableCount >= 3) {
        break;
      }
    } else {
      stableCount = 0;
    }

    lastHeight = currentHeight;
  }

  // Scroll back to top to trigger any remaining lazy loads
  await page.evaluate(() => window.scrollTo(0, 0));
  await delay(500);
}

/**
 * Extract products from the page using product tile structure
 * Based on Lululemon's actual DOM structure
 */
async function extractProductsFromPage(page) {
  return await page.evaluate(() => {
    const products = [];
    const processedUrls = new Set();

    // Find all product tiles using Lululemon's class structure
    const productTiles = document.querySelectorAll('[class*="product-tile_productTile"], [data-lll-pl="product-tile-with-swatches"]');

    productTiles.forEach((tile, index) => {
      try {
        // Find the main product link with data attributes
        const productLink = tile.querySelector('a[data-product-name][data-product-id]');
        if (!productLink) return;

        const name = productLink.getAttribute('data-product-name')?.replace(/\*/g, '').trim();
        const productId = productLink.getAttribute('data-product-id');
        const href = productLink.getAttribute('href');

        if (!name || !href) return;

        // Deduplicate by product ID (not color variants)
        const productKey = href.split('/_/')[1]?.split('?')[0] || href;
        if (processedUrls.has(productKey)) return;
        processedUrls.add(productKey);

        const fullUrl = href.startsWith('http')
          ? href
          : `https://shop.lululemon.com${href}`;

        // Find prices in the product tile
        const priceContainer = tile.querySelector('[class*="product-tile_productPrice"], .price');
        let salePrice = 0;
        let originalPrice = 0;

        if (priceContainer) {
          const priceText = priceContainer.textContent || '';

          // Extract all dollar amounts
          const prices = [];
          const priceMatches = priceText.match(/\$(\d+(?:\.\d{2})?)/g) || [];
          priceMatches.forEach(p => {
            const num = parseFloat(p.replace('$', ''));
            if (num > 0 && num < 1000 && !prices.includes(num)) {
              prices.push(num);
            }
          });

          if (prices.length >= 2) {
            // Sort and take lowest as sale, highest as original
            prices.sort((a, b) => a - b);
            salePrice = prices[0];
            originalPrice = prices[prices.length - 1];
          } else if (prices.length === 1) {
            // Check if there's an "original price" element
            const originalPriceEl = tile.querySelector('[class*="originalPrice"], [class*="inactive-list-price"]');
            if (originalPriceEl) {
              const origMatch = originalPriceEl.textContent.match(/\$(\d+(?:\.\d{2})?)/);
              if (origMatch) {
                originalPrice = parseFloat(origMatch[1]);
                salePrice = prices[0];
              }
            } else {
              salePrice = prices[0];
              originalPrice = prices[0];
            }
          }
        }

        // Skip if no valid prices
        if (salePrice === 0 && originalPrice === 0) return;

        // Find image URL
        let imageUrl = null;
        const imgElement = tile.querySelector('picture source, picture img, img');
        if (imgElement) {
          // Try srcset first for better quality
          const srcset = imgElement.getAttribute('srcset');
          if (srcset) {
            // Parse srcset and get highest resolution
            const srcsetParts = srcset.split(',');
            for (const part of srcsetParts) {
              const [url] = part.trim().split(' ');
              if (url && url.includes('images.lululemon.com') && !url.includes('68w')) {
                imageUrl = url;
                break;
              }
            }
          }
          if (!imageUrl) {
            imageUrl = imgElement.getAttribute('src');
          }
        }

        // Clean up image URL
        if (imageUrl && imageUrl.startsWith('//')) {
          imageUrl = 'https:' + imageUrl;
        }

        // Calculate discount
        const discount = originalPrice > salePrice
          ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
          : 0;

        // Determine category from name
        const nameL = name.toLowerCase();
        let category = 'clothing';
        if (nameL.includes('shoe') || nameL.includes('sneaker') || nameL.includes('sandal') || nameL.includes('slide')) {
          category = 'shoes';
        } else if (nameL.includes('bag') || nameL.includes('belt') || nameL.includes('hat') ||
                   nameL.includes('headband') || nameL.includes('sock') || nameL.includes('accessory') ||
                   nameL.includes('mat') || nameL.includes('bottle') || nameL.includes('towel') ||
                   nameL.includes('scrunchie') || nameL.includes('glove')) {
          category = 'accessories';
        }

        products.push({
          id: `lululemon-${productId || Date.now()}-${index}`,
          name: name.substring(0, 200),
          brand: 'lululemon',
          category,
          originalPrice: originalPrice || salePrice,
          salePrice: salePrice || originalPrice,
          discount,
          imageUrl,
          productUrl: fullUrl,
          source: 'lululemon.com',
          scrapedAt: new Date().toISOString()
        });

      } catch (err) {
        // Skip this product on error
      }
    });

    return products;
  });
}

/**
 * Extract products from embedded JSON data (__NEXT_DATA__, Redux state, etc.)
 */
async function extractFromEmbeddedData(page) {
  return await page.evaluate(() => {
    const products = [];

    try {
      // Try to find __NEXT_DATA__ (Next.js)
      const nextDataScript = document.querySelector('script#__NEXT_DATA__');
      if (nextDataScript) {
        const nextData = JSON.parse(nextDataScript.textContent);
        // Traverse the object looking for product arrays
        const findProducts = (obj, path = '') => {
          if (!obj || typeof obj !== 'object') return;
          if (Array.isArray(obj)) {
            obj.forEach((item, i) => findProducts(item, `${path}[${i}]`));
            return;
          }
          // Check if this looks like a product
          if (obj.displayName || obj.productName || obj.name) {
            if (obj.price || obj.prices || obj.salePrice || obj.listPrice) {
              const name = obj.displayName || obj.productName || obj.name;
              const url = obj.pdpUrl || obj.url || obj.productUrl || '';
              const imageUrl = obj.swatchImage || obj.mainImage || obj.defaultImage || obj.imageUrl || '';

              // Extract prices
              let salePrice = 0, originalPrice = 0;
              if (obj.prices) {
                salePrice = obj.prices.salePrice || obj.prices.sale || 0;
                originalPrice = obj.prices.listPrice || obj.prices.regular || obj.prices.original || 0;
              } else {
                salePrice = obj.salePrice || obj.price || 0;
                originalPrice = obj.listPrice || obj.originalPrice || obj.regularPrice || salePrice;
              }

              if (name && (salePrice || originalPrice)) {
                const discount = originalPrice > salePrice
                  ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
                  : 0;

                products.push({
                  id: `lululemon-${Date.now()}-${products.length}`,
                  name: String(name).substring(0, 200),
                  brand: 'lululemon',
                  category: 'clothing',
                  originalPrice: originalPrice || salePrice,
                  salePrice: salePrice || originalPrice,
                  discount,
                  imageUrl: imageUrl.startsWith('http') ? imageUrl : (imageUrl ? `https://images.lululemon.com${imageUrl}` : null),
                  productUrl: url.startsWith('http') ? url : `https://shop.lululemon.com${url}`,
                  source: 'lululemon.com',
                  scrapedAt: new Date().toISOString()
                });
              }
            }
          }
          // Recursively search
          Object.values(obj).forEach((val, i) => findProducts(val, `${path}.${Object.keys(obj)[i]}`));
        };
        findProducts(nextData);
      }

      // Try to find window.__PRELOADED_STATE__ or similar global state
      const globalStateKeys = ['__PRELOADED_STATE__', '__REDUX_STATE__', '__INITIAL_STATE__', 'initialState'];
      for (const key of globalStateKeys) {
        if (window[key]) {
          // Similar extraction logic
          const findProducts = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            if (Array.isArray(obj)) {
              obj.forEach(item => findProducts(item));
              return;
            }
            if (obj.displayName || obj.productName || obj.name) {
              if (obj.price || obj.prices || obj.salePrice) {
                // Extract and add to products (similar to above)
              }
            }
            Object.values(obj).forEach(val => findProducts(val));
          };
          findProducts(window[key]);
        }
      }

      // Look for any script tags containing product JSON
      const scripts = document.querySelectorAll('script:not([src])');
      scripts.forEach(script => {
        const content = script.textContent || '';
        if (content.includes('products') && content.includes('price')) {
          try {
            // Try to find JSON objects in the script
            const jsonMatches = content.match(/\{[^{}]*"(product|displayName|productName)"[^{}]*\}/g);
            if (jsonMatches) {
              jsonMatches.forEach(match => {
                try {
                  const obj = JSON.parse(match);
                  // Extract product data similar to above
                } catch (e) {}
              });
            }
          } catch (e) {}
        }
      });

    } catch (e) {
      console.error('Error extracting from embedded data:', e);
    }

    return products;
  });
}

/**
 * Improved product extraction that finds products by analyzing all product links
 * and their parent containers
 */
async function extractProductsImproved(page) {
  return await page.evaluate(() => {
    const products = [];
    const processedUrls = new Set();

    // Find all product links
    const productLinks = document.querySelectorAll('a[href*="/prod"]');

    productLinks.forEach((link, index) => {
      try {
        const href = link.getAttribute('href');
        if (!href || !href.includes('/prod')) return;

        // Skip if already processed
        const baseHref = href.split('?')[0];
        if (processedUrls.has(baseHref)) return;
        processedUrls.add(baseHref);

        const fullUrl = href.startsWith('http')
          ? href
          : `https://shop.lululemon.com${href}`;

        // Find the product card container (parent element)
        // Lululemon typically wraps products in a div with specific attributes
        let container = link;
        for (let i = 0; i < 10; i++) {
          if (container.parentElement) {
            container = container.parentElement;
            // Stop at likely product card boundaries
            const classList = container.className || '';
            if (classList.includes('product') ||
                classList.includes('tile') ||
                classList.includes('card') ||
                classList.includes('item') ||
                container.tagName === 'LI' ||
                container.tagName === 'ARTICLE') {
              break;
            }
          }
        }

        // Extract product name from various possible locations
        let name = '';

        // Try to find name in the link itself
        const linkText = link.textContent?.trim();
        if (linkText && linkText.length > 3 && linkText.length < 200 && !linkText.includes('$')) {
          name = linkText;
        }

        // Try image alt text
        if (!name) {
          const img = container.querySelector('img') || link.querySelector('img');
          if (img && img.alt && img.alt.length > 3) {
            name = img.alt.trim();
          }
        }

        // Try common name selectors in the container
        if (!name) {
          const nameSelectors = [
            'h2', 'h3', 'h4',
            '[class*="name"]',
            '[class*="title"]',
            '[class*="Name"]',
            '[class*="Title"]'
          ];
          for (const sel of nameSelectors) {
            const el = container.querySelector(sel);
            if (el) {
              const text = el.textContent?.trim();
              if (text && text.length > 3 && text.length < 200 && !text.includes('$')) {
                name = text;
                break;
              }
            }
          }
        }

        // Skip if we can't find a name
        if (!name || name.length < 3) return;

        // Clean up name - remove extra whitespace
        name = name.replace(/\s+/g, ' ').trim();

        // Find prices - look for all text containing dollar signs
        let priceText = '';
        const priceElements = container.querySelectorAll('[class*="price"], [class*="Price"], span, p');
        priceElements.forEach(el => {
          const text = el.textContent || '';
          if (text.includes('$')) {
            priceText += ' ' + text;
          }
        });

        // Also check the container's direct text content
        const containerText = container.textContent || '';
        if (containerText.includes('$')) {
          priceText += ' ' + containerText;
        }

        // Parse all prices from the text
        const priceMatches = priceText.match(/\$[\d,]+(?:\.\d{2})?/g) || [];
        const prices = [...new Set(priceMatches)]
          .map(p => parseFloat(p.replace(/[$,]/g, '')))
          .filter(p => p > 0 && p < 10000);

        let salePrice = 0;
        let originalPrice = 0;

        if (prices.length >= 2) {
          // Sort prices - lowest is likely sale price, highest is original
          const sortedPrices = [...prices].sort((a, b) => a - b);
          salePrice = sortedPrices[0];
          originalPrice = sortedPrices[sortedPrices.length - 1];
        } else if (prices.length === 1) {
          salePrice = prices[0];
          originalPrice = prices[0];
        }

        // Skip if no valid prices
        if (salePrice === 0 && originalPrice === 0) return;

        // Find image URL
        let imageUrl = null;
        const imgElement = container.querySelector('img') || link.querySelector('img');
        if (imgElement) {
          // Try multiple image source attributes
          let imgSrc = imgElement.getAttribute('src') ||
                      imgElement.getAttribute('data-src') ||
                      imgElement.getAttribute('data-lazy-src');

          // Try srcset for higher resolution
          if (!imgSrc || imgSrc.includes('data:')) {
            const srcset = imgElement.getAttribute('srcset');
            if (srcset) {
              const srcsetParts = srcset.split(',');
              if (srcsetParts.length > 0) {
                imgSrc = srcsetParts[srcsetParts.length - 1].trim().split(' ')[0];
              }
            }
          }

          if (imgSrc && !imgSrc.includes('data:')) {
            // Clean up URL
            if (imgSrc.startsWith('//')) {
              imgSrc = 'https:' + imgSrc;
            } else if (!imgSrc.startsWith('http')) {
              imgSrc = 'https://shop.lululemon.com' + imgSrc;
            }
            imageUrl = imgSrc;
          }
        }

        // Calculate discount
        const discount = originalPrice > salePrice
          ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
          : 0;

        // Determine category
        const nameL = name.toLowerCase();
        let category = 'clothing';
        if (nameL.includes('shoe') || nameL.includes('sneaker') || nameL.includes('sandal') || nameL.includes('slide')) {
          category = 'shoes';
        } else if (nameL.includes('bag') || nameL.includes('belt') || nameL.includes('hat') ||
                   nameL.includes('headband') || nameL.includes('sock') || nameL.includes('accessory') ||
                   nameL.includes('mat') || nameL.includes('bottle') || nameL.includes('towel')) {
          category = 'accessories';
        }

        products.push({
          id: `lululemon-${Date.now()}-${index}`,
          name: name.substring(0, 200),
          brand: 'lululemon',
          category,
          originalPrice: originalPrice || salePrice,
          salePrice: salePrice || originalPrice,
          discount,
          imageUrl,
          productUrl: fullUrl,
          source: 'lululemon.com',
          scrapedAt: new Date().toISOString()
        });

      } catch (err) {
        // Skip this product on error
      }
    });

    return products;
  });
}

/**
 * Original extraction function (kept as fallback)
 */
async function extractProducts(page) {
  return await page.evaluate(() => {
    const products = [];

    // Try multiple selectors for product tiles
    const productSelectors = [
      '[data-testid="product-tile"]',
      '.product-tile',
      '[class*="ProductCard"]',
      '[class*="product-card"]',
      '.lll-product-tile',
      'article[class*="product"]',
      '[data-testid="product-card"]',
      '.product-list__item'
    ];

    let productElements = [];
    for (const selector of productSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > productElements.length) {
        productElements = Array.from(elements);
      }
    }

    // Fallback: find all links to product pages
    if (productElements.length === 0) {
      const allLinks = document.querySelectorAll('a[href*="/prod"]');
      const uniqueProducts = new Map();

      allLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.includes('/prod') && !uniqueProducts.has(href)) {
          const container = link.closest('div[class], article, li') || link;
          uniqueProducts.set(href, container);
        }
      });

      productElements = Array.from(uniqueProducts.values());
    }

    productElements.forEach((element, index) => {
      try {
        // Find product link
        const linkElement = element.querySelector('a[href*="/prod"]') ||
                           element.closest('a[href*="/prod"]');
        const productUrl = linkElement ? linkElement.getAttribute('href') : null;

        if (!productUrl) return;

        const fullUrl = productUrl.startsWith('http')
          ? productUrl
          : `https://shop.lululemon.com${productUrl}`;

        // Find product name
        let name = '';
        const nameSelectors = [
          '[data-testid="product-title"]',
          '[class*="product-name"]',
          '[class*="ProductName"]',
          '.product-tile__name',
          'h3',
          'h2',
          '[class*="title"]'
        ];

        for (const selector of nameSelectors) {
          const nameEl = element.querySelector(selector);
          if (nameEl && nameEl.textContent.trim()) {
            name = nameEl.textContent.trim();
            break;
          }
        }

        // Fallback: use link text or alt text
        if (!name) {
          const img = element.querySelector('img');
          name = img?.alt || linkElement?.textContent?.trim() || 'Lululemon Product';
        }

        // Find prices
        const priceSelectors = [
          '[data-testid="product-price"]',
          '[class*="price"]',
          '[class*="Price"]',
          '.product-tile__price',
          'span[class*="price"]'
        ];

        let priceText = '';
        for (const selector of priceSelectors) {
          const priceElements = element.querySelectorAll(selector);
          priceElements.forEach(el => {
            priceText += ' ' + el.textContent;
          });
        }

        // Parse prices from text - look for dollar amounts
        const priceMatches = priceText.match(/\$[\d,]+(?:\.\d{2})?/g) || [];
        const prices = priceMatches.map(p => parseFloat(p.replace(/[$,]/g, '')));

        let salePrice = 0;
        let originalPrice = 0;

        if (prices.length >= 2) {
          // Usually sale price comes first, original price second (or vice versa)
          const sortedPrices = [...prices].sort((a, b) => a - b);
          salePrice = sortedPrices[0];
          originalPrice = sortedPrices[sortedPrices.length - 1];
        } else if (prices.length === 1) {
          salePrice = prices[0];
          originalPrice = prices[0];
        }

        // Find image URL
        let imageUrl = '';
        const imgElement = element.querySelector('img');
        if (imgElement) {
          imageUrl = imgElement.getAttribute('src') ||
                    imgElement.getAttribute('data-src') ||
                    imgElement.getAttribute('srcset')?.split(' ')[0] ||
                    '';

          // Handle relative URLs
          if (imageUrl && !imageUrl.startsWith('http')) {
            imageUrl = 'https://shop.lululemon.com' + imageUrl;
          }

          // Try to get higher resolution image
          if (imageUrl.includes('?')) {
            imageUrl = imageUrl.split('?')[0];
          }
        }

        // Calculate discount percentage
        const discount = originalPrice > salePrice
          ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
          : 0;

        // Determine category from name
        const nameL = name.toLowerCase();
        let category = 'clothing';
        if (nameL.includes('shoe') || nameL.includes('sneaker') || nameL.includes('sandal') || nameL.includes('slide')) {
          category = 'shoes';
        } else if (nameL.includes('bag') || nameL.includes('belt') || nameL.includes('hat') || nameL.includes('headband') || nameL.includes('sock') || nameL.includes('accessory')) {
          category = 'accessories';
        }

        // Only add if we have essential data
        if (name && (salePrice > 0 || originalPrice > 0)) {
          products.push({
            id: `lululemon-${Date.now()}-${index}`,
            name: name.substring(0, 200),
            brand: 'lululemon',
            category,
            originalPrice: originalPrice || salePrice,
            salePrice: salePrice || originalPrice,
            discount,
            imageUrl: imageUrl || null,
            productUrl: fullUrl,
            source: 'lululemon.com',
            scrapedAt: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error('Error parsing product:', err);
      }
    });

    return products;
  });
}

/**
 * Try to close popups and modals
 */
async function closePopups(page) {
  const popupSelectors = [
    '[data-testid="modal-close"]',
    '[aria-label="Close"]',
    '[class*="close-button"]',
    '[class*="CloseButton"]',
    'button[class*="close"]',
    '.modal-close',
    '[data-dismiss="modal"]',
    'button[aria-label*="close"]'
  ];

  for (const selector of popupSelectors) {
    try {
      const button = await page.$(selector);
      if (button) {
        await button.click();
        await delay(500);
      }
    } catch (e) {
      // Ignore errors when trying to close popups
    }
  }
}

/**
 * Try to click "Load More" or pagination buttons
 */
async function clickLoadMoreButton(page) {
  const loadMoreSelectors = [
    '[data-testid="load-more"]',
    'button[class*="load-more"]',
    'button[class*="LoadMore"]',
    '[class*="pagination"] button',
    'button:has-text("Load More")',
    'button:has-text("View More")',
    'button:has-text("Show More")',
    'a[class*="load-more"]'
  ];

  for (const selector of loadMoreSelectors) {
    try {
      const button = await page.$(selector);
      if (button) {
        const isVisible = await button.isIntersectingViewport();
        if (isVisible) {
          await button.click();
          await delay(2000);
          return true;
        }
      }
    } catch (e) {
      // Continue to next selector
    }
  }

  return false;
}

/**
 * Delay helper function
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the scraper if executed directly
if (require.main === module) {
  scrapeLululemon()
    .then(products => {
      console.log('\n=== SCRAPING COMPLETE ===');
      console.log(`Total products with discounts: ${products.length}`);
      if (products.length > 0) {
        console.log('\nSample products:');
        products.slice(0, 5).forEach((p, i) => {
          console.log(`${i + 1}. ${p.name}`);
          console.log(`   Original: $${p.originalPrice} -> Sale: $${p.salePrice} (${p.discount}% off)`);
          console.log(`   URL: ${p.productUrl}`);
        });
      }
      console.log(`\nFull data saved to: ${OUTPUT_FILE}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('Scraping failed:', error);
      process.exit(1);
    });
}

module.exports = { scrapeLululemon };
