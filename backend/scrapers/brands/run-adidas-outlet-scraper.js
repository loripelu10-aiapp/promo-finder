/**
 * Adidas Outlet Scraper - Using Adidas Content Engine API
 *
 * Successfully extracts products from Adidas's internal API
 * Tries multiple API endpoints and pagination to maximize products
 */

const axios = require('axios');
const fs = require('fs');

const OUTPUT_FILE = '/tmp/adidas-products.json';

// API endpoints to try with pagination
const API_CONFIGS = [
  {
    name: 'Outlet',
    baseUrl: 'https://www.adidas.com/api/plp/content-engine/',
    params: { query: 'outlet', start: 0 }
  },
  {
    name: 'Sale',
    baseUrl: 'https://www.adidas.com/api/plp/content-engine/',
    params: { query: 'sale', start: 0 }
  },
  {
    name: 'Men Sale',
    baseUrl: 'https://www.adidas.com/api/plp/content-engine/',
    params: { query: 'men-sale', start: 0 }
  },
  {
    name: 'Women Sale',
    baseUrl: 'https://www.adidas.com/api/plp/content-engine/',
    params: { query: 'women-sale', start: 0 }
  },
  {
    name: 'Kids Sale',
    baseUrl: 'https://www.adidas.com/api/plp/content-engine/',
    params: { query: 'kids-sale', start: 0 }
  },
  {
    name: 'Shoes Sale',
    baseUrl: 'https://www.adidas.com/api/plp/content-engine/',
    params: { query: 'shoes-sale', start: 0 }
  },
  {
    name: 'Clothing Sale',
    baseUrl: 'https://www.adidas.com/api/plp/content-engine/',
    params: { query: 'clothing-sale', start: 0 }
  },
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class AdidasAPIScraper {
  constructor() {
    this.products = new Map();
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.adidas.com/us/outlet',
      'Origin': 'https://www.adidas.com',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
    };
  }

  async fetchAPIPage(config, startOffset = 0) {
    const params = { ...config.params, start: startOffset };

    try {
      const response = await axios.get(config.baseUrl, {
        headers: this.headers,
        params: params,
        timeout: 30000,
      });

      if (response.data) {
        return response.data;
      }
    } catch (error) {
      console.log(`  [ERROR] ${error.message}`);
    }

    return null;
  }

  extractProductsFromResponse(data, categoryName) {
    const products = [];

    // Navigate to the items array
    const itemList = data?.raw?.itemList;
    if (!itemList) {
      console.log('  [DEBUG] No itemList found in response');
      return products;
    }

    const items = itemList.items || [];
    const count = itemList.count || 0;
    const viewSize = itemList.viewSize || 48;

    console.log(`  [INFO] Total items available: ${count}, page size: ${viewSize}`);

    for (const item of items) {
      try {
        const product = this.parseProduct(item, categoryName);
        if (product) {
          products.push(product);
        }
      } catch (e) {
        // Skip malformed items
      }
    }

    return { products, totalCount: count, pageSize: viewSize };
  }

  parseProduct(item, categoryName) {
    // Extract basic info
    const displayName = item.displayName || item.name;
    const modelId = item.modelId;
    const productId = item.productId;

    if (!displayName) return null;

    // Build URL
    let url = item.link;
    if (!url && productId) {
      url = `https://www.adidas.com/us/${productId}.html`;
    }
    if (!url) return null;
    if (!url.startsWith('http')) {
      url = `https://www.adidas.com${url}`;
    }

    // Extract image
    let image = '';
    if (item.image) {
      image = item.image.src || item.image;
    }
    if (image && !image.startsWith('http')) {
      image = `https://www.adidas.com${image}`;
    }
    // Prefer Adidas assets CDN
    if (!image && productId) {
      image = `https://assets.adidas.com/images/w_600,f_auto,q_auto/products/${productId}/${productId}_01_standard.jpg`;
    }

    // Extract prices - Adidas API format
    let originalPrice = null;
    let salePrice = null;

    // Price can be in different formats
    if (item.price !== undefined) {
      // Sometimes price is already the sale price
      salePrice = parseFloat(item.price);
    }

    if (item.salePrice !== undefined) {
      salePrice = parseFloat(item.salePrice);
    }

    if (item.compareAtPrice !== undefined) {
      originalPrice = parseFloat(item.compareAtPrice);
    }

    if (item.standardPrice !== undefined) {
      originalPrice = parseFloat(item.standardPrice);
    }

    // Check pricing object
    if (item.pricing) {
      if (item.pricing.salePrice !== undefined) salePrice = parseFloat(item.pricing.salePrice);
      if (item.pricing.standardPrice !== undefined) originalPrice = parseFloat(item.pricing.standardPrice);
      if (item.pricing.standard !== undefined) originalPrice = parseFloat(item.pricing.standard);
      if (item.pricing.sale !== undefined) salePrice = parseFloat(item.pricing.sale);
    }

    // Check altView or other nested structures
    if (item.pricing_information) {
      const pi = item.pricing_information;
      if (pi.currentPrice) salePrice = parseFloat(pi.currentPrice);
      if (pi.standard_price) originalPrice = parseFloat(pi.standard_price);
      if (pi.standard_price_no_vat) originalPrice = parseFloat(pi.standard_price_no_vat);
    }

    // Sometimes the data structure uses different field names
    if (!originalPrice && item.priceData) {
      originalPrice = parseFloat(item.priceData.standard || item.priceData.was);
      salePrice = parseFloat(item.priceData.sale || item.priceData.now);
    }

    // Debug log for items without valid prices
    if (!originalPrice || !salePrice) {
      // Try to extract from any field that looks like a price
      const itemStr = JSON.stringify(item);
      const priceMatches = itemStr.match(/"(?:price|Price|salePrice|standardPrice)"\s*:\s*(\d+\.?\d*)/g);
      if (priceMatches && priceMatches.length >= 2) {
        const prices = priceMatches.map(m => {
          const num = m.match(/(\d+\.?\d*)/);
          return num ? parseFloat(num[1]) : 0;
        }).filter(p => p > 0);

        if (prices.length >= 2) {
          const sorted = [...new Set(prices)].sort((a, b) => a - b);
          salePrice = sorted[0];
          originalPrice = sorted[sorted.length - 1];
        }
      }
    }

    // If we still don't have both prices, look for display price strings
    if (!originalPrice || !salePrice) {
      const displayPrice = item.displayPrice || item.priceRange;
      if (displayPrice && typeof displayPrice === 'string') {
        const priceNums = displayPrice.match(/\$?([\d,]+\.?\d*)/g);
        if (priceNums && priceNums.length >= 2) {
          const nums = priceNums.map(p => parseFloat(p.replace(/[$,]/g, '')));
          const sorted = [...new Set(nums)].sort((a, b) => a - b);
          if (sorted.length >= 2) {
            salePrice = sorted[0];
            originalPrice = sorted[sorted.length - 1];
          }
        }
      }
    }

    // Validate we have both prices
    if (!originalPrice || !salePrice) return null;
    if (isNaN(originalPrice) || isNaN(salePrice)) return null;
    if (originalPrice <= salePrice) return null;
    if (salePrice <= 0 || originalPrice <= 0) return null;

    // Calculate discount
    const discount = Math.round(((originalPrice - salePrice) / originalPrice) * 100);

    // Validate discount range (10-80% is realistic)
    if (discount < 10 || discount > 80) return null;

    // Skip fake 30% discounts (1.3x ratio pattern)
    const ratio = originalPrice / salePrice;
    if (Math.abs(ratio - 1.3) < 0.02) return null;

    // Categorize product
    const category = this.categorize(displayName);

    return {
      id: `adidas-${modelId || productId || Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: displayName,
      brand: 'Adidas',
      category,
      originalPrice,
      salePrice,
      discount,
      image,
      url,
      source: 'adidas.com',
      sourceCategory: categoryName,
      productId: productId || modelId,
      scrapedAt: new Date().toISOString()
    };
  }

  categorize(name) {
    const lower = name.toLowerCase();
    if (lower.match(/shoe|sneaker|boot|sandal|samba|gazelle|ultraboost|nmd|forum|campus|superstar|slide|clog|trainer|runfalcon|response|adizero|sl72|sl 72|spezial|handball|indoor|terrex.*shoe/)) return 'shoes';
    if (lower.match(/shirt|top|jacket|hoodie|pants|shorts|tee|dress|jersey|sweater|jogger|polo|tank|pullover|vest|track|sweatshirt|legging|tight|bra|coat|parka|windbreaker/)) return 'clothing';
    if (lower.match(/bag|backpack|wallet|hat|cap|sock|ball|watch|belt|headband|glove|scarf|beanie|visor|duffle|gym/)) return 'accessories';
    return 'other';
  }

  async scrapeCategory(config) {
    console.log(`\n[CATEGORY] ${config.name}`);

    let startOffset = 0;
    let totalAvailable = 0;
    let newProductsAdded = 0;
    let pagesScraped = 0;
    const maxPages = 10; // Limit pages per category

    while (pagesScraped < maxPages) {
      console.log(`  [PAGE] Fetching offset ${startOffset}...`);

      const data = await this.fetchAPIPage(config, startOffset);
      if (!data) {
        console.log('  [PAGE] No data returned, stopping');
        break;
      }

      const result = this.extractProductsFromResponse(data, config.name);
      totalAvailable = result.totalCount;

      for (const product of result.products) {
        if (!this.products.has(product.url)) {
          this.products.set(product.url, product);
          newProductsAdded++;
        }
      }

      console.log(`  [PAGE] Found ${result.products.length} valid products (${newProductsAdded} new)`);

      pagesScraped++;
      startOffset += result.pageSize;

      // Stop if we've fetched all available
      if (startOffset >= totalAvailable) {
        console.log(`  [PAGE] Reached end of results (${totalAvailable} total)`);
        break;
      }

      // Delay between pages
      await delay(1500);
    }

    console.log(`  [CATEGORY] Total new products from ${config.name}: ${newProductsAdded}`);
    return newProductsAdded;
  }

  async run() {
    console.log('='.repeat(60));
    console.log('ADIDAS OUTLET SCRAPER (API Method)');
    console.log('Target: 200+ products with real discounts');
    console.log('='.repeat(60));

    const startTime = Date.now();

    // Scrape each category
    for (const config of API_CONFIGS) {
      await this.scrapeCategory(config);

      // Check if we've hit target
      if (this.products.size >= 250) {
        console.log(`\n[SUCCESS] Reached ${this.products.size} products!`);
        break;
      }

      // Delay between categories
      await delay(2000);
    }

    // Prepare output
    const products = Array.from(this.products.values())
      .sort((a, b) => b.discount - a.discount);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    const output = {
      metadata: {
        scrapedAt: new Date().toISOString(),
        totalProducts: products.length,
        elapsedSeconds: parseFloat(elapsed),
        source: 'adidas.com',
        targetUrl: 'https://www.adidas.com/us/outlet',
        method: 'API'
      },
      products
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('SCRAPING COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total unique products: ${products.length}`);
    console.log(`Elapsed time: ${elapsed}s`);
    console.log(`Output file: ${OUTPUT_FILE}`);

    if (products.length > 0) {
      // Category breakdown
      const categories = {};
      for (const p of products) {
        categories[p.category] = (categories[p.category] || 0) + 1;
      }

      console.log('\nCategory Breakdown:');
      for (const [cat, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${cat}: ${count} products`);
      }

      // Discount distribution
      const ranges = { '10-20%': 0, '20-30%': 0, '30-40%': 0, '40-50%': 0, '50%+': 0 };
      for (const p of products) {
        if (p.discount >= 50) ranges['50%+']++;
        else if (p.discount >= 40) ranges['40-50%']++;
        else if (p.discount >= 30) ranges['30-40%']++;
        else if (p.discount >= 20) ranges['20-30%']++;
        else ranges['10-20%']++;
      }

      console.log('\nDiscount Distribution:');
      for (const [range, count] of Object.entries(ranges)) {
        console.log(`  ${range}: ${count} products`);
      }

      console.log('\nTop 10 Deals:');
      for (let i = 0; i < Math.min(10, products.length); i++) {
        const p = products[i];
        console.log(`  ${i + 1}. ${p.name}`);
        console.log(`     ${p.discount}% off: $${p.salePrice.toFixed(2)} (was $${p.originalPrice.toFixed(2)})`);
        console.log(`     ${p.url}`);
      }
    }

    return output;
  }
}

// Run
const scraper = new AdidasAPIScraper();
scraper.run().catch(console.error);
