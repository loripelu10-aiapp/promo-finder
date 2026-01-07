const BaseScraper = require('./base-scraper');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs').promises;
const { getCostMonitor } = require('../../services/scraping/cost-monitor');

/**
 * Fallback Scraper with AI-Powered Parsing
 *
 * When traditional CSS selectors fail, this scraper uses:
 * 1. Screenshot + Claude Vision API to parse product data from images
 * 2. Full page text extraction + AI parsing
 *
 * Use this when sites are blocking automation or have dynamic selectors
 */
class FallbackScraper extends BaseScraper {
  constructor(config = {}) {
    super(config);

    // Initialize Claude API
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || 'your-api-key-here'
    });

    // Initialize cost monitor
    this.costMonitor = getCostMonitor();

    // Scraper name for tracking (override in subclass)
    this.scraperName = config.scraperName || 'Unknown AI Scraper';
  }

  /**
   * Method 1: Screenshot-based parsing
   * Takes a screenshot and uses Claude Vision to extract product data
   */
  async scrapeFromScreenshot(url, productType = 'shoes on sale') {
    console.log(`\n🖼️  [Screenshot Parser] Loading ${url}...`);

    try {
      await this.initBrowser();

      // Navigate to page
      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      // Wait for page to fully render
      await this.delay(8000);

      // Scroll to load lazy images
      await this.scrollToLoadProducts(2);

      // Take full-page screenshot
      const screenshotPath = '/tmp/scraper-screenshot.png';
      await this.page.screenshot({
        path: screenshotPath,
        fullPage: true
      });

      console.log(`📸 Screenshot saved: ${screenshotPath}`);

      // Read screenshot as base64
      const imageBuffer = await fs.readFile(screenshotPath);
      const base64Image = imageBuffer.toString('base64');

      console.log('🤖 Analyzing screenshot with Claude Vision...');

      // Check if cost monitor has stopped us
      if (this.costMonitor.isStopped()) {
        throw new Error('DAILY_COST_LIMIT_EXCEEDED');
      }

      // Use Claude Vision to parse products from screenshot
      const message = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: base64Image
                }
              },
              {
                type: 'text',
                text: `You are analyzing a screenshot of an e-commerce sale page. Extract ALL visible products that are ${productType}.

For each product, extract:
- Product name (clean, no sale text)
- Brand
- Original price (the crossed-out/higher price)
- Sale price (the current discounted price)
- Discount percentage (if shown)
- Currency (GBP £, EUR €, USD $)

IMPORTANT RULES:
1. ONLY include products that show BOTH original price AND sale price (real discounts)
2. Do NOT estimate prices - only extract visible prices
3. Clean product names (remove "SALE", "Save X%", etc.)
4. If discount % not shown, calculate it: ((original - sale) / original) * 100
5. Only include discounts between 10-70% (reject outliers)

Return data as JSON array:
[
  {
    "name": "Nike Air Max 90",
    "brand": "Nike",
    "originalPrice": 120.00,
    "salePrice": 84.00,
    "discount": 30,
    "currency": "GBP"
  }
]

If no valid products found, return empty array: []`
              }
            ]
          }
        ]
      });

      // Track API call cost
      await this.costMonitor.trackCall({
        scraper: this.scraperName,
        method: 'screenshot',
        usage: {
          input_tokens: message.usage.input_tokens,
          output_tokens: message.usage.output_tokens,
          hasImage: true
        }
      });

      // Parse Claude's response
      const responseText = message.content[0].text;
      console.log('📝 Claude response received');
      console.log(`   💰 API cost: ~$${(message.usage.input_tokens * 0.000003 + message.usage.output_tokens * 0.000015 + 0.01).toFixed(4)}`);

      // Extract JSON from response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.log('⚠️  No products found in screenshot');
        return [];
      }

      const products = JSON.parse(jsonMatch[0]);
      console.log(`✅ Extracted ${products.length} products from screenshot`);

      return products;

    } catch (error) {
      console.error(`❌ Screenshot parsing failed: ${error.message}`);
      return [];
    } finally {
      await this.close();
    }
  }

  /**
   * Method 2: Text-based parsing
   * Extracts all text from page and uses AI to parse product data
   */
  async scrapeFromText(url, productType = 'shoes on sale') {
    console.log(`\n📝 [Text Parser] Loading ${url}...`);

    try {
      await this.initBrowser();

      // Navigate to page
      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      // Wait for content
      await this.delay(5000);

      // Extract all visible text from page
      const pageText = await this.page.evaluate(() => {
        // Get all text content, preserving some structure
        const body = document.body;
        return body.innerText || body.textContent;
      });

      console.log(`📄 Extracted ${pageText.length} characters of text`);

      // Also extract all links (for product URLs)
      const links = await this.page.evaluate(() => {
        const productLinks = [];
        document.querySelectorAll('a[href*="/product"], a[href*="/p/"], a[href*="productpage"]').forEach(link => {
          if (link.href && link.href.includes('http')) {
            productLinks.push(link.href);
          }
        });
        return [...new Set(productLinks)]; // Remove duplicates
      });

      console.log(`🔗 Found ${links.length} product links`);

      console.log('🤖 Analyzing text with Claude AI...');

      // Check if cost monitor has stopped us
      if (this.costMonitor.isStopped()) {
        throw new Error('DAILY_COST_LIMIT_EXCEEDED');
      }

      // Use Claude to parse products from text
      const message = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `You are analyzing text extracted from an e-commerce sale page. Extract ALL products that are ${productType}.

Page Text:
${pageText.substring(0, 15000)}

Product URLs found:
${links.slice(0, 50).join('\n')}

For each product, extract:
- Product name (clean, no sale text)
- Brand
- Original price (the "was" price or RRP)
- Sale price (the current price or "now" price)
- Currency (GBP £, EUR €, USD $)

IMPORTANT RULES:
1. ONLY include products with BOTH original price AND sale price
2. Do NOT estimate or calculate prices
3. Clean product names (remove "SALE", "Save", price text)
4. Calculate discount: ((original - sale) / original) * 100
5. Only include discounts between 10-70%
6. Match products to URLs from the list when possible

Return JSON array:
[
  {
    "name": "Nike Air Max 90",
    "brand": "Nike",
    "originalPrice": 120.00,
    "salePrice": 84.00,
    "discount": 30,
    "currency": "GBP",
    "url": "https://..."
  }
]

If no valid products found, return: []`
          }
        ]
      });

      // Track API call cost
      await this.costMonitor.trackCall({
        scraper: this.scraperName,
        method: 'text',
        usage: {
          input_tokens: message.usage.input_tokens,
          output_tokens: message.usage.output_tokens,
          hasImage: false
        }
      });

      // Parse Claude's response
      const responseText = message.content[0].text;
      console.log('📝 Claude response received');
      console.log(`   💰 API cost: ~$${(message.usage.input_tokens * 0.000003 + message.usage.output_tokens * 0.000015).toFixed(4)}`);

      // Extract JSON from response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.log('⚠️  No products found in text');
        return [];
      }

      const products = JSON.parse(jsonMatch[0]);
      console.log(`✅ Extracted ${products.length} products from text`);

      return products;

    } catch (error) {
      console.error(`❌ Text parsing failed: ${error.message}`);
      return [];
    } finally {
      await this.close();
    }
  }

  /**
   * Hybrid approach: Try both methods and combine results
   */
  async scrapeWithFallback(url, productType = 'shoes on sale', source = 'unknown') {
    console.log(`\n🔄 [Hybrid Scraper] Trying multiple parsing methods for ${source}...`);

    let allProducts = [];

    // Method 1: Try screenshot parsing
    console.log('\n📸 Method 1: Screenshot-based parsing...');
    const screenshotProducts = await this.scrapeFromScreenshot(url, productType);
    allProducts.push(...screenshotProducts);

    // Method 2: Try text parsing if screenshot got few results
    if (allProducts.length < 10) {
      console.log('\n📝 Method 2: Text-based parsing...');
      const textProducts = await this.scrapeFromText(url, productType);
      allProducts.push(...textProducts);
    }

    // Deduplicate by name
    const uniqueProducts = this.deduplicateProducts(allProducts);

    // Format products
    const formattedProducts = uniqueProducts.map((p, i) => ({
      id: `${source}-${Date.now()}-${i}`,
      name: p.name,
      brand: p.brand || this.extractBrandFromName(p.name),
      category: 'shoes',
      originalPrice: p.originalPrice,
      salePrice: p.salePrice,
      discount: p.discount || Math.round(((p.originalPrice - p.salePrice) / p.originalPrice) * 100),
      currency: p.currency,
      image: p.image || '', // No image from text/screenshot parsing
      url: p.url || url,
      source: source,
      availableRegions: this.detectRegions(source),
      verified: false,
      scrapedAt: new Date().toISOString()
    }));

    console.log(`\n✅ Total unique products: ${formattedProducts.length}`);
    return formattedProducts;
  }

  /**
   * Remove duplicate products by name
   */
  deduplicateProducts(products) {
    const seen = new Set();
    return products.filter(p => {
      const key = `${p.name}-${p.salePrice}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Extract brand from product name
   */
  extractBrandFromName(name) {
    const brands = ['Nike', 'Adidas', 'Puma', 'New Balance', 'H&M', 'Zara', 'Mango',
                    'Decathlon', 'Kalenji', 'Kipsta', 'Reebok', 'Asics'];

    const nameLower = name.toLowerCase();
    for (const brand of brands) {
      if (nameLower.includes(brand.toLowerCase())) {
        return brand;
      }
    }
    return 'Unknown';
  }

  /**
   * Detect regions from source domain
   */
  detectRegions(source) {
    if (source.includes('.co.uk')) return ['EU', 'UK'];
    if (source.includes('.com')) return ['GLOBAL', 'US'];
    if (source.includes('.es')) return ['EU', 'ES'];
    if (source.includes('.fr')) return ['EU', 'FR'];
    if (source.includes('.de')) return ['EU', 'DE'];
    if (source.includes('.it')) return ['EU', 'IT'];
    return ['EU'];
  }
}

module.exports = FallbackScraper;
