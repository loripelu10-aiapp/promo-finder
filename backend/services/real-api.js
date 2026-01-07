const axios = require('axios');

/**
 * Real API Integration - Fetches ACTUAL deals from RapidAPI and Rainforest
 * This replaces the mock data with real product information
 */

class RealApiService {
  constructor() {
    this.rapidApiKey = process.env.RAPIDAPI_KEY;
    this.rainforestApiKey = process.env.RAINFOREST_API_KEY;
    this.timeout = 10000; // 10 seconds
  }

  /**
   * Search for products using RapidAPI Real-Time Product Search
   */
  async searchRapidApi(query, options = {}) {
    if (!this.rapidApiKey) {
      console.warn('⚠️  RAPIDAPI_KEY not set, skipping RapidAPI search');
      return [];
    }

    try {
      console.log(`🔍 Searching RapidAPI for: ${query}`);

      const params = {
        q: query,
        country: 'us',
        language: 'en',
        limit: options.limit || 10,
        page: 1,
        sort_by: 'BEST_MATCH',
      };

      if (options.max_price) {
        params.max_price = options.max_price;
      }

      const response = await axios.get('https://real-time-product-search.p.rapidapi.com/search-v2', {
        params,
        headers: {
          'X-RapidAPI-Key': this.rapidApiKey,
          'X-RapidAPI-Host': 'real-time-product-search.p.rapidapi.com',
        },
        timeout: this.timeout,
      });

      if (response.data && response.data.data && response.data.data.products) {
        const products = response.data.data.products
          .filter(p => p.offer && p.offer.price && p.offer.price_string)
          .map(p => this.mapRapidApiProduct(p))
          .filter(p => p !== null);

        console.log(`✅ RapidAPI returned ${products.length} products`);
        return products;
      }

      return [];
    } catch (error) {
      console.error('❌ RapidAPI error:', error.response?.data?.message || error.message);
      return [];
    }
  }

  /**
   * Search for products using Rainforest API (Amazon)
   */
  async searchRainforest(query, options = {}) {
    if (!this.rainforestApiKey) {
      console.warn('⚠️  RAINFOREST_API_KEY not set, skipping Rainforest search');
      return [];
    }

    try {
      console.log(`🔍 Searching Rainforest API for: ${query}`);

      const params = {
        api_key: this.rainforestApiKey,
        type: 'search',
        amazon_domain: 'amazon.com',
        search_term: query,
        page: 1,
        output: 'json',
      };

      if (options.max_price) {
        params.max_price = options.max_price;
      }

      const response = await axios.get('https://api.rainforestapi.com/request', {
        params,
        timeout: this.timeout,
      });

      if (response.data && response.data.search_results) {
        const products = response.data.search_results
          .filter(p => p.prices && p.prices.length > 0)
          .map(p => this.mapRainforestProduct(p))
          .filter(p => p !== null);

        console.log(`✅ Rainforest returned ${products.length} products`);
        return products;
      }

      return [];
    } catch (error) {
      console.error('❌ Rainforest API error:', error.response?.data?.message || error.message);
      return [];
    }
  }

  /**
   * Map RapidAPI product to our format
   */
  mapRapidApiProduct(product) {
    try {
      const price = parseFloat(product.offer.price);
      const originalPrice = product.offer.original_price
        ? parseFloat(product.offer.original_price)
        : price;

      // Only include products with actual discounts
      if (originalPrice <= price) {
        return null;
      }

      const discount = Math.round(((originalPrice - price) / originalPrice) * 100);

      // Skip products with less than 10% discount
      if (discount < 10) {
        return null;
      }

      return {
        id: `rapid-${product.product_id}`,
        name: product.product_title || 'Product',
        brand: this.extractBrand(product.product_title),
        category: this.categorizeProduct(product.product_title),
        originalPrice: originalPrice,
        salePrice: price,
        discount: discount,
        image: product.product_photos?.[0] || product.product_photo || null,
        url: product.product_page_url || product.offer.offer_page_url,
        source: this.extractDomain(product.product_page_url || product.offer.offer_page_url),
        verified: true,
        lastChecked: new Date().toISOString(),
        isNew: discount >= 30,
        scrapedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error mapping RapidAPI product:', error.message);
      return null;
    }
  }

  /**
   * Map Rainforest product to our format
   */
  mapRainforestProduct(product) {
    try {
      // Get current and original prices
      const currentPrice = product.prices[0];
      let price = currentPrice.value;
      let originalPrice = currentPrice.raw || price;

      // Check for deal price
      if (product.deal && product.deal.price && product.deal.original_price) {
        price = product.deal.price;
        originalPrice = product.deal.original_price;
      }

      // Only include products with actual discounts
      if (originalPrice <= price) {
        return null;
      }

      const discount = Math.round(((originalPrice - price) / originalPrice) * 100);

      // Skip products with less than 10% discount
      if (discount < 10) {
        return null;
      }

      return {
        id: `rain-${product.asin}`,
        name: product.title,
        brand: this.extractBrand(product.title),
        category: this.categorizeProduct(product.title),
        originalPrice: originalPrice,
        salePrice: price,
        discount: discount,
        image: product.image || null,
        url: product.link,
        source: 'amazon.com',
        verified: true,
        lastChecked: new Date().toISOString(),
        isNew: discount >= 30,
        scrapedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error mapping Rainforest product:', error.message);
      return null;
    }
  }

  /**
   * Search multiple fashion retailers for deals
   */
  async searchFashionDeals(options = {}) {
    console.log('🎯 Starting fashion deals search...');
    const queries = [
      'nike shoes',
      'adidas sneakers',
      'fashion deals',
    ];

    const allProducts = [];
    let successCount = 0;
    let errorCount = 0;

    for (const query of queries) {
      try {
        // Try RapidAPI first
        try {
          const rapidProducts = await this.searchRapidApi(query, { limit: 10, max_price: options.maxPrice });
          if (rapidProducts.length > 0) {
            allProducts.push(...rapidProducts);
            successCount++;
            console.log(`✓ RapidAPI: ${rapidProducts.length} products from "${query}"`);
          }
        } catch (error) {
          console.warn(`⚠ RapidAPI failed for "${query}":`, error.message);
          errorCount++;
        }

        // Small delay
        await this.delay(1000);

        // Try Rainforest API
        try {
          const rainforestProducts = await this.searchRainforest(query, { max_price: options.maxPrice });
          if (rainforestProducts.length > 0) {
            allProducts.push(...rainforestProducts);
            successCount++;
            console.log(`✓ Rainforest: ${rainforestProducts.length} products from "${query}"`);
          }
        } catch (error) {
          console.warn(`⚠ Rainforest failed for "${query}":`, error.message);
          errorCount++;
        }

        await this.delay(500);
      } catch (error) {
        console.error(`❌ Error with query "${query}":`, error.message);
        errorCount++;
      }
    }

    console.log(`📊 Search complete: ${successCount} successes, ${errorCount} errors`);

    // Remove duplicates by URL
    const uniqueProducts = this.removeDuplicates(allProducts);

    // Sort by discount (highest first)
    uniqueProducts.sort((a, b) => b.discount - a.discount);

    console.log(`🎉 Found ${uniqueProducts.length} unique deals with real discounts`);
    return uniqueProducts;
  }

  /**
   * Helper methods
   */
  extractBrand(title) {
    const brands = ['Nike', 'Adidas', 'Puma', 'Reebok', 'New Balance', 'Under Armour',
                    'Zara', 'H&M', 'Gap', 'Uniqlo', 'Levi\'s', 'Calvin Klein'];

    for (const brand of brands) {
      if (title.toLowerCase().includes(brand.toLowerCase())) {
        return brand;
      }
    }

    return title.split(' ')[0]; // First word as brand
  }

  categorizeProduct(title) {
    const lower = title.toLowerCase();

    if (lower.includes('shoe') || lower.includes('sneaker') || lower.includes('boot') ||
        lower.includes('sandal') || lower.includes('heel')) {
      return 'shoes';
    }

    if (lower.includes('shirt') || lower.includes('top') || lower.includes('blouse') ||
        lower.includes('sweater') || lower.includes('jacket') || lower.includes('coat') ||
        lower.includes('dress') || lower.includes('pants') || lower.includes('jeans') ||
        lower.includes('shorts') || lower.includes('skirt')) {
      return 'clothing';
    }

    if (lower.includes('bag') || lower.includes('wallet') || lower.includes('watch') ||
        lower.includes('jewelry') || lower.includes('sunglasses')) {
      return 'accessories';
    }

    return 'clothing'; // default
  }

  extractDomain(url) {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return domain;
    } catch {
      return 'unknown';
    }
  }

  removeDuplicates(products) {
    const seen = new Set();
    return products.filter(product => {
      const key = product.url || `${product.name}-${product.salePrice}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new RealApiService();
