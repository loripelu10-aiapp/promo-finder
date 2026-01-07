/**
 * Google WebSearch for finding shoe deals
 * Uses Puppeteer to search Google for deals and extract URLs
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

class GoogleDealsFinder {
  constructor(config = {}) {
    this.config = {
      headless: config.headless !== false,
      timeout: config.timeout || 30000,
      maxResults: config.maxResults || 20,
      ...config
    };
  }

  /**
   * Search Google for product deals
   * @param {string} query - Search query (e.g., "nike shoes sale", "adidas outlet deals")
   * @param {object} filters - Optional filters { site: 'adidas.com', minDiscount: 20 }
   * @returns {Array} - Array of deal URLs with metadata
   */
  async searchDeals(query, filters = {}) {
    console.log(`🔍 [GoogleDealsFinder] Searching for: "${query}"`);

    const browser = await puppeteer.launch({
      headless: this.config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const results = [];

    try {
      // Build Google search URL
      let searchQuery = query;
      if (filters.site) {
        searchQuery += ` site:${filters.site}`;
      }

      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&num=20`;

      console.log(`📄 Loading Google search: ${googleUrl}`);

      await page.goto(googleUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      // Wait for results
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract search results
      const searchResults = await page.evaluate(() => {
        const results = [];
        const resultElements = document.querySelectorAll('div.g, div[data-sokoban-container]');

        resultElements.forEach(element => {
          try {
            // Get link
            const linkElement = element.querySelector('a[href^="http"], a[href^="https"]');
            if (!linkElement) return;

            const url = linkElement.href;
            if (!url || url.includes('google.com')) return;

            // Get title
            const titleElement = element.querySelector('h3');
            const title = titleElement ? titleElement.textContent.trim() : '';

            // Get snippet
            const snippetElement = element.querySelector('[data-sncf], div[style*="-webkit-line-clamp"]');
            const snippet = snippetElement ? snippetElement.textContent.trim() : '';

            if (title && url) {
              results.push({
                title,
                url,
                snippet,
                source: new URL(url).hostname.replace('www.', '')
              });
            }
          } catch (error) {
            // Skip invalid results
          }
        });

        return results;
      });

      console.log(`📦 Found ${searchResults.length} search results`);

      // Filter and enhance results
      for (const result of searchResults) {
        if (results.length >= this.config.maxResults) break;

        // Apply filters
        if (filters.site && !result.url.includes(filters.site)) {
          continue;
        }

        // Check if result mentions sale/discount
        const lowerText = (result.title + ' ' + result.snippet).toLowerCase();
        const hasSaleKeywords = lowerText.match(/\b(sale|discount|off|clearance|outlet|deal|promo)\b/);

        if (hasSaleKeywords) {
          results.push({
            ...result,
            foundVia: 'google-search',
            searchQuery: query
          });
        }
      }

      console.log(`✅ Filtered to ${results.length} relevant deals`);

    } catch (error) {
      console.error(`❌ [GoogleDealsFinder] Error:`, error.message);
    } finally {
      await browser.close();
    }

    return results;
  }

  /**
   * Search for deals from specific brand
   */
  async findBrandDeals(brand, category = 'shoes') {
    const queries = [
      `${brand} ${category} sale outlet`,
      `${brand} ${category} clearance discount`,
      `${brand} official ${category} deals`
    ];

    const allResults = [];

    for (const query of queries) {
      const results = await this.searchDeals(query, { site: `${brand.toLowerCase()}.com` });
      allResults.push(...results);

      // Rate limit between searches
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Deduplicate by URL
    const uniqueResults = [];
    const seen = new Set();

    for (const result of allResults) {
      if (!seen.has(result.url)) {
        seen.add(result.url);
        uniqueResults.push(result);
      }
    }

    return uniqueResults;
  }
}

module.exports = GoogleDealsFinder;
