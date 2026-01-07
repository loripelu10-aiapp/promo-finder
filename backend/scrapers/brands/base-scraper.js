const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

/**
 * BaseScraper - Abstract base class for all brand-specific scrapers
 *
 * Provides common functionality:
 * - Anti-detection Puppeteer setup
 * - Lazy scroll for loading products
 * - Price extraction and validation
 * - Real discount validation (rejects price estimation)
 * - Rate limiting between requests
 */
class BaseScraper {
  constructor(config = {}) {
    this.config = {
      headless: config.headless !== false,
      timeout: config.timeout || 30000,
      maxProducts: config.maxProducts || 50,
      scrollDelay: config.scrollDelay || 2000,
      rateLimit: config.rateLimit || 5000,
      userAgent: config.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      // Proxy configuration (optional)
      proxy: config.proxy || null, // Format: { server: 'http://proxy:port', username: 'user', password: 'pass' }
      ...config
    };

    this.browser = null;
    this.page = null;
  }

  /**
   * Initialize Puppeteer browser with anti-detection measures
   */
  async initBrowser(browserInstance = null) {
    if (browserInstance) {
      this.browser = browserInstance;
      this.page = await this.browser.newPage();
    } else {
      const launchOptions = {
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ],
        ignoreHTTPSErrors: true,
        defaultViewport: null
      };

      // Add proxy if configured
      if (this.config.proxy) {
        console.log(`🔒 Using proxy: ${this.config.proxy.server}`);
        launchOptions.args.push(`--proxy-server=${this.config.proxy.server}`);
      }

      this.browser = await puppeteer.launch(launchOptions);
      this.page = await this.browser.newPage();

      // Authenticate proxy if credentials provided
      if (this.config.proxy && this.config.proxy.username && this.config.proxy.password) {
        await this.page.authenticate({
          username: this.config.proxy.username,
          password: this.config.proxy.password
        });
      }
    }

    // Set extra HTTP headers
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0'
    });

    await this.setupAntiDetection();
  }

  /**
   * Setup anti-detection measures
   */
  async setupAntiDetection() {
    // Set user agent
    await this.page.setUserAgent(this.config.userAgent);

    // Set viewport
    await this.page.setViewport({
      width: 1920,
      height: 1080
    });

    // Override webdriver detection
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false
      });

      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });

      // Override Chrome detection
      window.chrome = {
        runtime: {}
      };

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });
  }

  /**
   * Lazy scroll to load all products
   */
  async scrollToLoadProducts(maxScrolls = 5) {
    console.log(`📜 Scrolling to load products (max ${maxScrolls} scrolls)...`);

    let previousHeight = 0;
    let scrollCount = 0;

    while (scrollCount < maxScrolls) {
      // Get current scroll height
      const currentHeight = await this.page.evaluate(() => document.body.scrollHeight);

      // If height hasn't changed, we've loaded everything
      if (currentHeight === previousHeight) {
        console.log(`✅ All products loaded after ${scrollCount} scrolls`);
        break;
      }

      // Scroll to bottom
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // Wait for new content to load
      await this.delay(this.config.scrollDelay);

      previousHeight = currentHeight;
      scrollCount++;
    }
  }

  /**
   * Extract price from various formats
   * Supports: $99.99, $99, 99.99, 99
   */
  extractPrice(priceText) {
    if (!priceText) return null;

    // Remove currency symbols and extra whitespace
    const cleaned = priceText.replace(/[$€£¥,\s]/g, '').trim();

    // Extract number
    const match = cleaned.match(/(\d+\.?\d*)/);
    if (!match) return null;

    const price = parseFloat(match[1]);
    return isNaN(price) ? null : price;
  }

  /**
   * Validate if discount is real (not estimated)
   *
   * Rejects:
   * - originalPrice <= salePrice
   * - Discount < 10% or > 70% (unrealistic)
   * - Price estimation patterns (1.3x ratio)
   */
  isRealDiscount(originalPrice, salePrice) {
    if (!originalPrice || !salePrice) {
      return { valid: false, reason: 'Missing price data' };
    }

    if (originalPrice <= salePrice) {
      return { valid: false, reason: 'Original price not greater than sale price' };
    }

    const discount = ((originalPrice - salePrice) / originalPrice) * 100;

    if (discount < 10) {
      return { valid: false, reason: 'Discount too small (< 10%)' };
    }

    if (discount > 70) {
      return { valid: false, reason: 'Discount too large (> 70%), likely error' };
    }

    // Detect price estimation pattern (1.3x ratio = fake 30% discount)
    const ratio = originalPrice / salePrice;
    if (Math.abs(ratio - 1.3) < 0.01) {
      return { valid: false, reason: 'Detected 1.3x estimation pattern (fake discount)' };
    }

    return { valid: true, discount: Math.round(discount) };
  }

  /**
   * Rate limiting delay
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Apply rate limiting between requests
   */
  async rateLimit() {
    await this.delay(this.config.rateLimit);
  }

  /**
   * Clean up resources
   */
  async close(closeBrowser = true) {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }

    if (closeBrowser && this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Abstract method - must be implemented by subclasses
   * Should return array of product objects with:
   * {
   *   id: string,
   *   name: string,
   *   brand: string,
   *   category: string,
   *   originalPrice: number,
   *   salePrice: number,
   *   discount: number,
   *   image: string,
   *   url: string,
   *   source: string,
   *   verified: boolean,
   *   scrapedAt: string
   * }
   */
  async scrape() {
    throw new Error('scrape() must be implemented by subclass');
  }

  /**
   * Get scraper name (for logging)
   */
  getName() {
    return this.constructor.name;
  }
}

module.exports = BaseScraper;
