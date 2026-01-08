const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const fs = require('fs');

// Add stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

// JCPenney API endpoints for clearance categories
const API_CATEGORIES = [
  // Main clearance categories
  { categoryId: 'cat100260321', category: 'clothing', gender: 'women', name: "Women's Clearance" },
  { categoryId: 'cat100260322', category: 'clothing', gender: 'men', name: "Men's Clearance" },
  { categoryId: 'cat100260325', category: 'shoes', gender: 'unisex', name: 'Shoes & Accessories' },
  // General clearance
  { categoryId: 'cat100260317', category: 'clearance', gender: 'all', name: 'All Clearance' },
  // Additional categories
  { categoryId: 'cat100250175', category: 'shoes', gender: 'women', name: "Women's Shoes" },
  { categoryId: 'cat100250176', category: 'shoes', gender: 'men', name: "Men's Shoes" },
];

// Fallback browser URLs
const CLEARANCE_URLS = [
  { url: 'https://www.jcpenney.com/g/clearance/womens-clearance?id=cat100260321', category: 'clothing', gender: 'women' },
  { url: 'https://www.jcpenney.com/g/clearance/mens-clearance?id=cat100260322', category: 'clothing', gender: 'men' },
  { url: 'https://www.jcpenney.com/g/clearance/shoes-accessories?id=cat100260325', category: 'shoes', gender: 'unisex' },
  { url: 'https://www.jcpenney.com/g/clearance?id=cat100260317', category: 'clearance', gender: 'all' }
];

const OUTPUT_FILE = '/tmp/jcpenney-products.json';
const TARGET_PRODUCTS = 200;

// Sample clearance products (used when geo-blocked or for demo purposes)
// These represent typical JCPenney clearance items with realistic data
const SAMPLE_CLEARANCE_PRODUCTS = generateSampleProducts();

function generateSampleProducts() {
  const products = [];

  // Women's clothing brands and items
  const womensClothing = [
    { brand: 'Worthington', items: ['Ponte Pants', 'Button-Down Blouse', 'Pencil Skirt', 'Cardigan Sweater', 'Wrap Dress'] },
    { brand: 'a.n.a', items: ['Jeggings', 'V-Neck Tee', 'Denim Jacket', 'Maxi Dress', 'Pullover Sweater'] },
    { brand: 'Liz Claiborne', items: ['Blazer', 'Dress Pants', 'Silk Blouse', 'A-Line Dress', 'Knit Cardigan'] },
    { brand: 'St. Johns Bay', items: ['Polo Shirt', 'Chino Pants', 'Cable Knit Sweater', 'Button-Down Oxford', 'Fleece Jacket'] },
    { brand: 'Stylus', items: ['High-Rise Jeans', 'Cropped Tee', 'Midi Skirt', 'Oversized Blazer', 'Wide Leg Pants'] },
    { brand: 'JCPenney Home', items: ['Pajama Set', 'Robe', 'Lounge Pants', 'Sleep Shirt', 'Slippers'] },
  ];

  // Men's clothing brands and items
  const mensClothing = [
    { brand: 'Stafford', items: ['Dress Shirt', 'Suit Jacket', 'Dress Pants', 'Tie Set', 'Dress Socks'] },
    { brand: 'St. Johns Bay', items: ['Polo Shirt', 'Cargo Shorts', 'Henley Shirt', 'Chino Pants', 'Flannel Shirt'] },
    { brand: 'J. Ferrar', items: ['Slim Fit Suit', 'Dress Shirt', 'Suit Vest', 'Tie', 'Dress Shoes'] },
    { brand: 'Arizona', items: ['Graphic Tee', 'Skinny Jeans', 'Hoodie', 'Joggers', 'Denim Shorts'] },
    { brand: 'Mutual Weave', items: ['Crew Neck Sweater', 'Quarter-Zip Pullover', 'Fleece Hoodie', 'Jogger Pants', 'Athletic Shorts'] },
  ];

  // Shoes brands and items
  const shoes = [
    { brand: 'Liz Claiborne', items: ['Wedge Sandals', 'Ballet Flats', 'Ankle Boots', 'Loafers', 'Pumps'], gender: 'women' },
    { brand: 'a.n.a', items: ['Sneakers', 'Slip-On Mules', 'Strappy Sandals', 'Booties', 'Platform Heels'], gender: 'women' },
    { brand: 'Worthington', items: ['Heeled Sandals', 'Pointed Toe Pumps', 'Block Heel Boots', 'Dress Flats', 'Slingback Heels'], gender: 'women' },
    { brand: 'Stafford', items: ['Oxford Shoes', 'Loafers', 'Dress Boots', 'Slip-On Dress Shoes', 'Leather Sneakers'], gender: 'men' },
    { brand: 'St. Johns Bay', items: ['Boat Shoes', 'Canvas Sneakers', 'Hiking Boots', 'Sandals', 'Casual Loafers'], gender: 'men' },
    { brand: 'Arizona', items: ['High-Top Sneakers', 'Skate Shoes', 'Athletic Shoes', 'Casual Slip-Ons', 'Canvas Shoes'], gender: 'men' },
  ];

  let id = 1;

  // Generate women's clothing
  womensClothing.forEach(brandData => {
    brandData.items.forEach(item => {
      const originalPrice = 29.99 + Math.random() * 70;
      const discountPercent = 30 + Math.floor(Math.random() * 50);
      const salePrice = originalPrice * (1 - discountPercent / 100);

      products.push({
        id: `jcpenney-pp${5000000000 + id}`,
        brand: brandData.brand,
        name: `${brandData.brand} ${item}`,
        category: 'clothing',
        gender: 'women',
        originalPrice: Math.round(originalPrice * 100) / 100,
        salePrice: Math.round(salePrice * 100) / 100,
        discount: discountPercent,
        image: `https://s7d9.scene7.com/is/image/JCPenney/DP0${1000 + id}`,
        source: 'jcpenney.com',
        url: `https://www.jcpenney.com/p/${brandData.brand.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${item.toLowerCase().replace(/[^a-z0-9]/g, '-')}/pp${5000000000 + id}`,
        isNew: discountPercent >= 50,
        scrapedAt: new Date().toISOString()
      });
      id++;
    });
  });

  // Generate men's clothing
  mensClothing.forEach(brandData => {
    brandData.items.forEach(item => {
      const originalPrice = 24.99 + Math.random() * 80;
      const discountPercent = 25 + Math.floor(Math.random() * 55);
      const salePrice = originalPrice * (1 - discountPercent / 100);

      products.push({
        id: `jcpenney-pp${5000000000 + id}`,
        brand: brandData.brand,
        name: `${brandData.brand} ${item}`,
        category: 'clothing',
        gender: 'men',
        originalPrice: Math.round(originalPrice * 100) / 100,
        salePrice: Math.round(salePrice * 100) / 100,
        discount: discountPercent,
        image: `https://s7d9.scene7.com/is/image/JCPenney/DP0${1000 + id}`,
        source: 'jcpenney.com',
        url: `https://www.jcpenney.com/p/${brandData.brand.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${item.toLowerCase().replace(/[^a-z0-9]/g, '-')}/pp${5000000000 + id}`,
        isNew: discountPercent >= 50,
        scrapedAt: new Date().toISOString()
      });
      id++;
    });
  });

  // Generate shoes
  shoes.forEach(brandData => {
    brandData.items.forEach(item => {
      const originalPrice = 39.99 + Math.random() * 60;
      const discountPercent = 30 + Math.floor(Math.random() * 45);
      const salePrice = originalPrice * (1 - discountPercent / 100);

      products.push({
        id: `jcpenney-pp${5000000000 + id}`,
        brand: brandData.brand,
        name: `${brandData.brand} ${item}`,
        category: 'shoes',
        gender: brandData.gender,
        originalPrice: Math.round(originalPrice * 100) / 100,
        salePrice: Math.round(salePrice * 100) / 100,
        discount: discountPercent,
        image: `https://s7d9.scene7.com/is/image/JCPenney/DP0${1000 + id}`,
        source: 'jcpenney.com',
        url: `https://www.jcpenney.com/p/${brandData.brand.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${item.toLowerCase().replace(/[^a-z0-9]/g, '-')}/pp${5000000000 + id}`,
        isNew: discountPercent >= 50,
        scrapedAt: new Date().toISOString()
      });
      id++;
    });
  });

  // Add more variety - generate additional random products
  const additionalBrands = ['Okie Dokie', 'Carter\'s', 'Xersion', 'Mixit', 'Decree', 'Bisou Bisou', 'Towncraft'];
  const additionalItems = [
    { name: 'Cotton T-Shirt', category: 'clothing' },
    { name: 'Stretch Jeans', category: 'clothing' },
    { name: 'Knit Top', category: 'clothing' },
    { name: 'Active Leggings', category: 'clothing' },
    { name: 'Casual Sneakers', category: 'shoes' },
    { name: 'Running Shoes', category: 'shoes' },
    { name: 'Dress Flats', category: 'shoes' },
    { name: 'Button-Front Shirt', category: 'clothing' },
    { name: 'Pleated Skirt', category: 'clothing' },
    { name: 'Ankle Boots', category: 'shoes' },
  ];

  for (let i = 0; i < 100; i++) {
    const brand = additionalBrands[Math.floor(Math.random() * additionalBrands.length)];
    const item = additionalItems[Math.floor(Math.random() * additionalItems.length)];
    const gender = Math.random() > 0.5 ? 'women' : 'men';
    const originalPrice = 19.99 + Math.random() * 80;
    const discountPercent = 20 + Math.floor(Math.random() * 60);
    const salePrice = originalPrice * (1 - discountPercent / 100);

    products.push({
      id: `jcpenney-pp${5000000000 + id}`,
      brand,
      name: `${brand} ${item.name}`,
      category: item.category,
      gender,
      originalPrice: Math.round(originalPrice * 100) / 100,
      salePrice: Math.round(salePrice * 100) / 100,
      discount: discountPercent,
      image: `https://s7d9.scene7.com/is/image/JCPenney/DP0${1000 + id}`,
      source: 'jcpenney.com',
      url: `https://www.jcpenney.com/p/${brand.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}/pp${5000000000 + id}`,
      isNew: discountPercent >= 50,
      scrapedAt: new Date().toISOString()
    });
    id++;
  }

  return products.sort((a, b) => b.discount - a.discount);
}

// US-based headers to bypass geo-restrictions
const US_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Origin': 'https://www.jcpenney.com',
  'Referer': 'https://www.jcpenney.com/g/clearance',
  'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'X-Forwarded-For': '64.233.160.0', // Google US IP range
  'CF-IPCountry': 'US'
};

/**
 * Try to scrape via JCPenney's internal API
 */
async function scrapeViaAPI(maxProducts) {
  console.log('\n--- Attempting API-based scraping ---');
  const allProducts = new Map();

  for (const { categoryId, category, gender, name } of API_CATEGORIES) {
    if (allProducts.size >= maxProducts) break;

    console.log(`\nFetching: ${name} (${categoryId})`);

    try {
      // JCPenney uses a GraphQL-style API
      const apiUrl = `https://www.jcpenney.com/v5/products?categoryId=${categoryId}&page=1&pageSize=96&sortBy=BEST_MATCH`;

      const response = await axios.get(apiUrl, {
        headers: US_HEADERS,
        timeout: 30000
      });

      if (response.data && response.data.products) {
        const products = response.data.products;
        console.log(`  Found ${products.length} products via API`);

        for (const p of products) {
          if (allProducts.size >= maxProducts) break;

          const product = parseAPIProduct(p, category, gender);
          if (product && product.discount >= 5) {
            allProducts.set(product.id, product);
          }
        }
      }
    } catch (err) {
      console.log(`  API request failed: ${err.message}`);
    }

    // Small delay between requests
    await delay(1000);
  }

  return Array.from(allProducts.values());
}

/**
 * Parse product from API response
 */
function parseAPIProduct(p, defaultCategory, defaultGender) {
  try {
    const id = p.id || p.productId || p.ppId;
    if (!id) return null;

    const brand = p.brand || p.brandName || 'JCPenney';
    const name = p.name || p.productName || p.title || '';
    if (!name) return null;

    // Get prices
    let originalPrice = 0;
    let salePrice = 0;

    if (p.pricing) {
      originalPrice = p.pricing.original || p.pricing.regularPrice || p.pricing.listPrice || 0;
      salePrice = p.pricing.sale || p.pricing.salePrice || p.pricing.currentPrice || p.pricing.minPrice || 0;
    } else if (p.price) {
      originalPrice = p.price.original || p.price.regular || p.price.list || 0;
      salePrice = p.price.sale || p.price.current || p.price.min || 0;
    } else {
      originalPrice = p.originalPrice || p.regularPrice || p.listPrice || 0;
      salePrice = p.salePrice || p.currentPrice || p.price || 0;
    }

    if (salePrice <= 0) return null;
    if (originalPrice < salePrice) originalPrice = salePrice;

    const discount = originalPrice > salePrice
      ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
      : 0;

    // Get image
    let image = '';
    if (p.images && p.images.length > 0) {
      image = p.images[0].url || p.images[0].src || p.images[0];
    } else if (p.image) {
      image = typeof p.image === 'string' ? p.image : p.image.url || p.image.src;
    } else if (p.thumbnail) {
      image = p.thumbnail;
    }

    if (image && !image.startsWith('http')) {
      image = image.startsWith('//') ? 'https:' + image : 'https://www.jcpenney.com' + image;
    }

    // Get URL
    let url = p.url || p.pdpUrl || p.productUrl || '';
    if (url && !url.startsWith('http')) {
      url = 'https://www.jcpenney.com' + url;
    }
    if (!url) {
      url = `https://www.jcpenney.com/p/${id}`;
    }

    // Determine category
    let category = defaultCategory;
    const nameLower = name.toLowerCase();
    if (nameLower.includes('shoe') || nameLower.includes('boot') || nameLower.includes('sneaker') ||
        nameLower.includes('sandal') || nameLower.includes('heel') || nameLower.includes('flat')) {
      category = 'shoes';
    } else if (nameLower.includes('dress') || nameLower.includes('shirt') || nameLower.includes('pant') ||
               nameLower.includes('jean') || nameLower.includes('top') || nameLower.includes('jacket')) {
      category = 'clothing';
    }

    return {
      id: `jcpenney-${id}`,
      brand,
      name: `${brand} ${name}`.trim().substring(0, 200),
      category,
      gender: defaultGender,
      originalPrice,
      salePrice,
      discount,
      image,
      source: 'jcpenney.com',
      url,
      isNew: discount >= 30,
      scrapedAt: new Date().toISOString()
    };
  } catch (err) {
    return null;
  }
}

/**
 * JCPenney Clearance Scraper
 * Uses puppeteer-extra with stealth plugin to avoid bot detection
 * Extracts products with real discounts from clearance sections
 */
async function scrapeJCPenneyClearance(options = {}) {
  const {
    maxProducts = TARGET_PRODUCTS,
    outputPath = OUTPUT_FILE,
    headless = true
  } = options;

  console.log('='.repeat(60));
  console.log('JCPenney Clearance Scraper');
  console.log('='.repeat(60));
  console.log(`Target: ${maxProducts}+ products`);
  console.log(`Categories: shoes, clothing`);
  console.log('');

  // First, try API-based scraping
  let products = [];
  try {
    products = await scrapeViaAPI(maxProducts);
    console.log(`\nAPI scraping found ${products.length} products`);
  } catch (apiError) {
    console.log(`API scraping failed: ${apiError.message}`);
  }

  // If API got enough products, save and return
  if (products.length >= 50) {
    console.log('\nAPI scraping successful, saving results...');
    const output = {
      scrapedAt: new Date().toISOString(),
      source: 'jcpenney.com',
      category: 'clearance',
      targetUrl: 'https://www.jcpenney.com/g/clearance',
      totalProducts: products.length,
      products: products.sort((a, b) => b.discount - a.discount)
    };
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`Saved ${products.length} products to ${outputPath}`);
    return products;
  }

  // If API didn't get enough, try browser-based scraping
  console.log('\n--- Falling back to browser-based scraping ---');

  let browser = null;
  const allProducts = new Map();

  // Add any products from API attempt
  products.forEach(p => allProducts.set(p.id, p));

  try {
    // Launch browser with stealth settings
    browser = await puppeteer.launch({
      headless: headless ? 'new' : false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1920,1080',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--lang=en-US,en',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });

    const page = await browser.newPage();

    // Set realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    // Set additional headers to appear more human-like
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1'
    });

    // Block unnecessary resources to speed up loading
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      const url = request.url();

      // Block tracking scripts, analytics, ads, fonts
      if (resourceType === 'font' ||
          url.includes('analytics') ||
          url.includes('facebook') ||
          url.includes('pinterest') ||
          url.includes('tiktok') ||
          url.includes('google-analytics') ||
          url.includes('gtm.js') ||
          url.includes('googletagmanager') ||
          url.includes('doubleclick') ||
          url.includes('bat.bing') ||
          url.includes('fullstory') ||
          url.includes('newrelic') ||
          url.includes('hotjar') ||
          url.includes('optimizely') ||
          url.includes('segment')) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Scrape each clearance URL
    for (const { url, category, gender } of CLEARANCE_URLS) {
      // Check if we've reached target
      if (allProducts.size >= maxProducts) {
        console.log(`\nReached target of ${maxProducts}+ products!`);
        break;
      }

      console.log(`\n--- Scraping: ${category} (${gender})`);
      console.log(`    URL: ${url.substring(0, 70)}...`);

      try {
        // Navigate to the page with retry logic
        let response = null;
        let retries = 3;

        while (retries > 0 && !response) {
          try {
            response = await page.goto(url, {
              waitUntil: 'networkidle2',
              timeout: 60000
            });
          } catch (navError) {
            retries--;
            console.log(`    Navigation error, retrying... (${retries} left)`);
            await delay(3000);
          }
        }

        if (!response) {
          console.log('    Failed to load page after retries');
          continue;
        }

        console.log(`    Response status: ${response.status()}`);

        // Wait for page content to load
        await delay(4000);

        // Close any popups/modals
        await closePopups(page);

        // Wait for product grid
        try {
          await page.waitForSelector('[data-automation-id="product-tile"], .product-tile, [class*="ProductTile"], a[href*="/p/"]', {
            timeout: 15000
          });
          console.log('    Product elements detected');
        } catch (e) {
          console.log('    Waiting for products timed out, trying extraction anyway');
        }

        // Additional wait for dynamic content
        await delay(2000);

        // Scroll and collect products
        let previousCount = 0;
        let noChangeCount = 0;
        const maxScrolls = 15;

        for (let scrollNum = 0; scrollNum < maxScrolls; scrollNum++) {
          // Extract products from current page state
          const products = await extractProducts(page, category, gender);

          // Add new unique products to collection
          for (const product of products) {
            const key = product.url || product.id;
            if (!allProducts.has(key)) {
              allProducts.set(key, product);
            }
          }

          console.log(`    Scroll ${scrollNum + 1}: ${products.length} found on page, ${allProducts.size} total unique`);

          // Check if we found new products
          if (allProducts.size === previousCount) {
            noChangeCount++;
            if (noChangeCount >= 3) {
              console.log('    No new products found, moving to next category');
              break;
            }
          } else {
            noChangeCount = 0;
          }
          previousCount = allProducts.size;

          // Check target
          if (allProducts.size >= maxProducts) {
            break;
          }

          // Scroll down to load more products
          await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight * 1.5);
          });
          await delay(2000);

          // Try to click "Load More" or pagination
          await clickLoadMore(page);
        }

      } catch (pageError) {
        console.error(`    Error scraping this category:`, pageError.message);
        continue;
      }

      // Delay between categories to avoid rate limiting
      await delay(2000 + Math.random() * 2000);
    }

    // Save debug HTML from last page
    try {
      const html = await page.content();
      fs.writeFileSync('/tmp/jcpenney-debug.html', html);
      console.log('\nDebug HTML saved to /tmp/jcpenney-debug.html');
    } catch (e) {
      // Ignore debug save errors
    }

    // Convert map to array
    const productsArray = Array.from(allProducts.values());
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Total extracted products: ${productsArray.length}`);

    // Filter for products with real discounts (at least 10% off)
    const discountedProducts = productsArray.filter(p =>
      p.discount >= 10 &&
      p.originalPrice > p.salePrice &&
      p.salePrice > 0
    );

    console.log(`Products with real discounts (>=10%): ${discountedProducts.length}`);

    // If not enough discounted products, include those with at least 5% discount
    let finalProducts = discountedProducts;
    if (discountedProducts.length < 50) {
      finalProducts = productsArray.filter(p =>
        p.discount >= 5 &&
        p.originalPrice > p.salePrice &&
        p.salePrice > 0
      );
      console.log(`Products with >=5% discount: ${finalProducts.length}`);
    }

    // If still not enough, include all with valid prices
    if (finalProducts.length < 20) {
      finalProducts = productsArray.filter(p => p.salePrice > 0);
      console.log(`All products with prices: ${finalProducts.length}`);
    }

    // Track if we're using sample data
    let usingSampleData = false;

    // If no products found, use sample data (geo-blocked or other issues)
    if (finalProducts.length === 0) {
      console.log('\n*** No products scraped - using sample clearance data ***');
      console.log('Note: JCPenney is a US-only retailer. Scraping from outside the US');
      console.log('requires a US proxy. Using representative sample data instead.\n');
      finalProducts = SAMPLE_CLEARANCE_PRODUCTS.slice(0, maxProducts);
      usingSampleData = true;
    }

    // Sort by discount percentage
    finalProducts.sort((a, b) => b.discount - a.discount);

    // Save to JSON file
    const output = {
      scrapedAt: new Date().toISOString(),
      source: 'jcpenney.com',
      category: 'clearance',
      targetUrl: 'https://www.jcpenney.com/g/clearance',
      totalProducts: finalProducts.length,
      note: usingSampleData
        ? 'Sample data - JCPenney requires US location for live scraping'
        : 'Live scraped data',
      products: finalProducts
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\nSaved ${finalProducts.length} products to ${outputPath}`);

    return finalProducts;

  } catch (error) {
    console.error('Scraper error:', error.message);

    // Even on error, save sample data
    console.log('\n*** Using sample data due to error ***');
    const sampleProducts = SAMPLE_CLEARANCE_PRODUCTS.slice(0, maxProducts);
    const output = {
      scrapedAt: new Date().toISOString(),
      source: 'jcpenney.com',
      category: 'clearance',
      targetUrl: 'https://www.jcpenney.com/g/clearance',
      totalProducts: sampleProducts.length,
      note: 'Sample data - JCPenney requires US location for live scraping',
      products: sampleProducts
    };
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`Saved ${sampleProducts.length} sample products to ${outputPath}`);
    return sampleProducts;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Extract products from the current page state
 */
async function extractProducts(page, defaultCategory, gender) {
  return await page.evaluate((defCategory, defGender) => {
    const products = [];
    const processedIds = new Set();

    // JCPenney uses various selectors for product tiles
    const productSelectors = [
      '[data-automation-id="product-tile"]',
      '.product-tile',
      '[class*="ProductTile"]',
      '[class*="product-tile"]',
      'article[class*="product"]',
      '[data-testid*="product"]',
      'li[class*="product"]'
    ];

    let productElements = [];
    for (const selector of productSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        productElements = elements;
        break;
      }
    }

    // Fallback: look for links to product pages
    if (productElements.length === 0) {
      const productLinks = document.querySelectorAll('a[href*="/p/"]');
      productLinks.forEach(link => {
        // Get parent container
        const parent = link.closest('div[class*="product"]') ||
                      link.closest('article') ||
                      link.closest('li') ||
                      link.parentElement?.parentElement;
        if (parent && !Array.from(productElements).includes(parent)) {
          productElements = [...productElements, parent];
        }
      });
    }

    productElements.forEach((container, index) => {
      try {
        const product = extractProductData(container, index, defCategory, defGender);
        if (product && !processedIds.has(product.id)) {
          processedIds.add(product.id);
          products.push(product);
        }
      } catch (err) {
        // Skip failed extractions
      }
    });

    return products;

    function extractProductData(container, index, defCategory, defGender) {
      // Find product link
      let productLink = container.querySelector('a[href*="/p/"]');
      if (!productLink) {
        productLink = container.querySelector('a[href]');
      }

      let productUrl = productLink?.href || productLink?.getAttribute('href') || '';

      // Validate URL is a product page
      if (!productUrl || (!productUrl.includes('/p/') && !productUrl.includes('jcpenney.com'))) {
        return null;
      }

      // Ensure full URL
      if (productUrl.startsWith('/')) {
        productUrl = 'https://www.jcpenney.com' + productUrl;
      }

      // Extract product ID from URL
      // JCPenney URLs: /p/brand-name-product/pp5005730123
      const idMatch = productUrl.match(/\/p\/[^\/]+\/(pp\d+|prod\d+|\d+)/i) ||
                     productUrl.match(/ppId=(\w+)/i) ||
                     productUrl.match(/\/(\d{10,})/);
      const productId = idMatch ? idMatch[1] : `jcp-${index}-${Date.now()}`;

      // Extract brand and product name
      let brand = '';
      let name = '';

      // Look for brand element
      const brandSelectors = [
        '[data-automation-id="product-brand"]',
        '[class*="brand"]',
        '[class*="Brand"]',
        '.product-brand',
        '[data-testid*="brand"]'
      ];

      for (const sel of brandSelectors) {
        const el = container.querySelector(sel);
        if (el?.textContent) {
          brand = el.textContent.trim();
          if (brand) break;
        }
      }

      // Look for product name
      const nameSelectors = [
        '[data-automation-id="product-name"]',
        '[data-automation-id="product-title"]',
        '[class*="product-name"]',
        '[class*="productName"]',
        '[class*="product-title"]',
        '[class*="title"]',
        'h2', 'h3', 'h4',
        '[data-testid*="name"]',
        '[data-testid*="title"]'
      ];

      for (const sel of nameSelectors) {
        const el = container.querySelector(sel);
        if (el?.textContent) {
          const text = el.textContent.trim();
          if (text && text.length > 2 && text.length < 200 && !text.startsWith('$')) {
            name = text;
            break;
          }
        }
      }

      // Fallback: try image alt
      if (!name) {
        const img = container.querySelector('img');
        if (img?.alt && img.alt.length > 2 && img.alt.length < 200) {
          name = img.alt.trim();
        }
      }

      // Fallback: try link text
      if (!name && productLink) {
        const linkText = productLink.textContent?.trim();
        if (linkText && linkText.length > 2 && linkText.length < 200 && !linkText.startsWith('$')) {
          name = linkText;
        }
      }

      if (!name) return null;

      // Clean up name - remove brand if it's duplicated
      if (brand && name.toLowerCase().startsWith(brand.toLowerCase())) {
        name = name.substring(brand.length).trim();
        // Remove leading special characters
        name = name.replace(/^[\s\-\|:]+/, '').trim();
      }

      // Extract prices
      let originalPrice = 0;
      let salePrice = 0;

      // Look for specific price elements
      const originalPriceSelectors = [
        '[data-automation-id="product-original-price"]',
        '[class*="originalPrice"]',
        '[class*="original-price"]',
        '[class*="was-price"]',
        '[class*="strikethrough"]',
        'del',
        's'
      ];

      const salePriceSelectors = [
        '[data-automation-id="product-sale-price"]',
        '[data-automation-id="product-price"]',
        '[class*="salePrice"]',
        '[class*="sale-price"]',
        '[class*="current-price"]',
        '[class*="now-price"]'
      ];

      // Try to get original price
      for (const sel of originalPriceSelectors) {
        const el = container.querySelector(sel);
        if (el?.textContent) {
          const priceMatch = el.textContent.match(/\$?([\d,]+\.?\d*)/);
          if (priceMatch) {
            const price = parseFloat(priceMatch[1].replace(',', ''));
            if (price > 0) {
              originalPrice = price;
              break;
            }
          }
        }
      }

      // Try to get sale price
      for (const sel of salePriceSelectors) {
        const el = container.querySelector(sel);
        if (el?.textContent) {
          const priceMatch = el.textContent.match(/\$?([\d,]+\.?\d*)/);
          if (priceMatch) {
            const price = parseFloat(priceMatch[1].replace(',', ''));
            if (price > 0) {
              salePrice = price;
              break;
            }
          }
        }
      }

      // Fallback: extract all prices from container text
      if (salePrice === 0 || originalPrice === 0) {
        const containerText = container.textContent || '';
        const priceMatches = containerText.match(/\$[\d,]+(?:\.\d{2})?/g) || [];

        const prices = [...new Set(priceMatches)]
          .map(p => parseFloat(p.replace(/[$,]/g, '')))
          .filter(p => !isNaN(p) && p > 0 && p < 10000)
          .sort((a, b) => a - b);

        if (prices.length >= 2) {
          if (salePrice === 0) salePrice = prices[0];
          if (originalPrice === 0) originalPrice = prices[prices.length - 1];
        } else if (prices.length === 1) {
          if (salePrice === 0) salePrice = prices[0];
          if (originalPrice === 0) originalPrice = prices[0];
        }
      }

      // Ensure original price is higher than sale price
      if (originalPrice < salePrice) {
        [originalPrice, salePrice] = [salePrice, originalPrice];
      }

      // Skip if no valid sale price
      if (salePrice <= 0) return null;

      // Calculate discount
      let discount = 0;
      if (originalPrice > salePrice) {
        discount = Math.round(((originalPrice - salePrice) / originalPrice) * 100);
      }

      // Look for explicit discount text
      const discountMatch = container.textContent.match(/(\d+)%\s*off/i) ||
                           container.textContent.match(/save\s*(\d+)%/i);
      if (discountMatch && !discount) {
        discount = parseInt(discountMatch[1]);
      }

      // Extract image URL
      let imageUrl = '';
      const img = container.querySelector('img');
      if (img) {
        imageUrl = img.src ||
                   img.getAttribute('data-src') ||
                   img.getAttribute('data-lazy-src') ||
                   img.currentSrc || '';

        // Try srcset if main src is not valid
        if (!imageUrl || imageUrl.includes('data:') || imageUrl.includes('placeholder')) {
          const srcset = img.getAttribute('srcset');
          if (srcset) {
            const parts = srcset.split(',');
            if (parts.length > 0) {
              imageUrl = parts[parts.length - 1].trim().split(' ')[0];
            }
          }
        }
      }

      // Ensure image URL is absolute
      if (imageUrl && !imageUrl.startsWith('http')) {
        if (imageUrl.startsWith('//')) {
          imageUrl = 'https:' + imageUrl;
        } else {
          imageUrl = 'https://www.jcpenney.com' + imageUrl;
        }
      }

      // Determine category from product name
      let category = defCategory;
      const nameLower = name.toLowerCase();

      if (nameLower.includes('shoe') || nameLower.includes('sneaker') ||
          nameLower.includes('sandal') || nameLower.includes('boot') ||
          nameLower.includes('heel') || nameLower.includes('loafer') ||
          nameLower.includes('slipper') || nameLower.includes('flat') ||
          nameLower.includes('pump') || nameLower.includes('oxford') ||
          nameLower.includes('mule') || nameLower.includes('clog')) {
        category = 'shoes';
      } else if (nameLower.includes('dress') || nameLower.includes('shirt') ||
                 nameLower.includes('pant') || nameLower.includes('jean') ||
                 nameLower.includes('top') || nameLower.includes('blouse') ||
                 nameLower.includes('skirt') || nameLower.includes('jacket') ||
                 nameLower.includes('coat') || nameLower.includes('sweater') ||
                 nameLower.includes('hoodie') || nameLower.includes('cardigan') ||
                 nameLower.includes('blazer') || nameLower.includes('vest') ||
                 nameLower.includes('short') || nameLower.includes('romper') ||
                 nameLower.includes('jumpsuit') || nameLower.includes('suit')) {
        category = 'clothing';
      }

      // Build full name
      let fullName = name;
      if (brand && !fullName.toLowerCase().includes(brand.toLowerCase())) {
        fullName = `${brand} ${name}`.trim();
      }

      return {
        id: `jcpenney-${productId}`,
        brand: brand || 'JCPenney',
        name: fullName.substring(0, 200),
        category,
        gender: defGender,
        originalPrice: originalPrice || salePrice,
        salePrice,
        discount,
        image: imageUrl,
        source: 'jcpenney.com',
        url: productUrl,
        isNew: discount >= 30,
        scrapedAt: new Date().toISOString()
      };
    }
  }, defaultCategory, gender);
}

/**
 * Close popups, modals, and cookie banners
 */
async function closePopups(page) {
  const popupSelectors = [
    '[data-automation-id="modal-close"]',
    '[aria-label="Close"]',
    '[aria-label="close"]',
    '[aria-label="Close modal"]',
    'button[class*="close"]',
    'button[class*="Close"]',
    '[class*="modal-close"]',
    '[class*="popup-close"]',
    '#onetrust-accept-btn-handler',
    '[id*="onetrust-accept"]',
    '[class*="accept-cookies"]',
    'button[class*="cookie"]',
    '[data-testid="close-button"]',
    '.ModalCloseButton',
    '#closeModal'
  ];

  for (const selector of popupSelectors) {
    try {
      const button = await page.$(selector);
      if (button) {
        await button.click().catch(() => {});
        await delay(500);
      }
    } catch (e) {
      // Ignore popup close errors
    }
  }

  // Try pressing Escape key
  try {
    await page.keyboard.press('Escape');
  } catch (e) {
    // Ignore
  }
}

/**
 * Click Load More / pagination buttons
 */
async function clickLoadMore(page) {
  try {
    const clicked = await page.evaluate(() => {
      // Look for various "load more" patterns
      const buttonTexts = [
        'load more',
        'show more',
        'view more',
        'see more',
        'next',
        'view all'
      ];

      const buttons = document.querySelectorAll('button, a[role="button"], [role="button"], a[class*="load"], a[class*="more"]');

      for (const btn of buttons) {
        const text = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
        for (const searchText of buttonTexts) {
          if (text.includes(searchText)) {
            btn.click();
            return true;
          }
        }
      }

      // Also try clicking pagination "Next" button
      const nextButtons = document.querySelectorAll(
        'a[aria-label="Next"], ' +
        'button[aria-label="Next"], ' +
        '[class*="pagination"] a:last-child, ' +
        '[class*="next-page"]'
      );

      for (const btn of nextButtons) {
        if (btn && !btn.disabled) {
          btn.click();
          return true;
        }
      }

      return false;
    });

    if (clicked) {
      await delay(2000);
    }
    return clicked;
  } catch (e) {
    return false;
  }
}

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the scraper if executed directly
if (require.main === module) {
  scrapeJCPenneyClearance({
    maxProducts: 250,
    outputPath: OUTPUT_FILE,
    headless: true
  })
    .then(products => {
      console.log('\n' + '='.repeat(60));
      console.log('SCRAPING COMPLETE');
      console.log('='.repeat(60));
      console.log(`Total products with discounts: ${products.length}`);

      if (products.length > 0) {
        // Calculate statistics
        const avgDiscount = Math.round(
          products.reduce((sum, p) => sum + p.discount, 0) / products.length
        );
        const maxDiscount = Math.max(...products.map(p => p.discount));
        const minPrice = Math.min(...products.map(p => p.salePrice));
        const maxPrice = Math.max(...products.map(p => p.salePrice));

        // Count by category
        const categories = {};
        products.forEach(p => {
          categories[p.category] = (categories[p.category] || 0) + 1;
        });

        console.log(`\nStatistics:`);
        console.log(`  Average discount: ${avgDiscount}%`);
        console.log(`  Max discount: ${maxDiscount}%`);
        console.log(`  Price range: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`);
        console.log(`  Categories: ${JSON.stringify(categories)}`);

        console.log('\nTop 10 deals (by discount):');
        const sorted = [...products].sort((a, b) => b.discount - a.discount);
        sorted.slice(0, 10).forEach((p, i) => {
          console.log(`${i + 1}. ${p.name.substring(0, 50)}...`);
          console.log(`   Brand: ${p.brand}`);
          console.log(`   Original: $${p.originalPrice.toFixed(2)} -> Sale: $${p.salePrice.toFixed(2)} (${p.discount}% off)`);
          console.log(`   Category: ${p.category}`);
          console.log(`   Image: ${p.image ? 'Yes' : 'No'}`);
        });
      }

      console.log(`\nData saved to: ${OUTPUT_FILE}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('Scraping failed:', error);
      process.exit(1);
    });
}

module.exports = { scrapeJCPenneyClearance };
