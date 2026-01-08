const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

/**
 * DSW (Designer Shoe Warehouse) Sale Scraper
 *
 * Target: https://www.dsw.com/en/us/sale
 *
 * Extracts sale products with real discounts:
 * - name
 * - original price
 * - sale price
 * - image URL
 * - product URL
 *
 * Uses extensive scrolling to load 150+ products
 */

class DSWSaleScraper {
  constructor(config = {}) {
    this.config = {
      headless: config.headless !== false,
      timeout: config.timeout || 90000,
      maxProducts: config.maxProducts || 200,
      scrollDelay: config.scrollDelay || 2500,
      userAgent: config.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...config
    };

    this.source = 'dsw.com';
    this.brand = 'DSW';
    this.currency = 'USD';
    this.browser = null;
    this.page = null;

    // Will be populated dynamically after discovering sale URLs
    this.targetUrls = [];
  }

  /**
   * Discover sale URLs from DSW homepage
   */
  async discoverSaleUrls() {
    console.log('[DSWScraper] Discovering sale URLs from homepage...');

    try {
      await this.page.goto('https://www.dsw.com', {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      await this.delay(3000);
      await this.handleModals();

      // Find sale-related links from the page
      const saleUrls = await this.page.evaluate(() => {
        const urls = new Set();
        const links = document.querySelectorAll('a[href]');

        links.forEach(link => {
          const href = link.href.toLowerCase();
          const text = link.textContent.toLowerCase();

          // Look for sale/clearance links
          if ((href.includes('sale') || href.includes('clearance') || href.includes('discount')) &&
              href.includes('dsw.com') &&
              !href.includes('error') &&
              !href.includes('login') &&
              !href.includes('account')) {
            urls.add(link.href);
          }

          // Also check link text
          if ((text.includes('sale') || text.includes('clearance')) &&
              href.includes('dsw.com') &&
              !href.includes('error')) {
            urls.add(link.href);
          }
        });

        return [...urls];
      });

      console.log(`[DSWScraper] Found ${saleUrls.length} potential sale URLs:`, saleUrls);

      if (saleUrls.length > 0) {
        // Filter and prioritize
        this.targetUrls = saleUrls.filter(url =>
          url.includes('sale') || url.includes('clearance')
        ).slice(0, 5);
      }

      // Add additional clearance category URLs to maximize products
      // Using working URL patterns discovered from DSW site
      const additionalUrls = [
        'https://www.dsw.com/category/clearance',
        'https://www.dsw.com/category/womens/clearance',
        'https://www.dsw.com/category/mens/clearance',
        'https://www.dsw.com/category/kids/clearance'
      ];

      // Combine discovered URLs with additional ones
      for (const url of additionalUrls) {
        if (!this.targetUrls.includes(url)) {
          this.targetUrls.push(url);
        }
      }

      // Add fallback URLs if we didn't find any
      if (this.targetUrls.length === 0) {
        console.log('[DSWScraper] No sale URLs found, using fallback approach...');
        this.targetUrls = additionalUrls;
      }

      console.log(`[DSWScraper] Will scrape: ${this.targetUrls.join(', ')}`);

    } catch (error) {
      console.log(`[DSWScraper] Error discovering URLs: ${error.message}`);
      // Use search approach as fallback
      this.targetUrls = ['search'];
    }
  }

  async initBrowser() {
    console.log('[DSWScraper] Launching browser with stealth mode...');

    this.browser = await puppeteer.launch({
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
    });

    this.page = await this.browser.newPage();

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

  async setupAntiDetection() {
    await this.page.setUserAgent(this.config.userAgent);
    await this.page.setViewport({ width: 1920, height: 1080 });

    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      window.chrome = { runtime: {} };

      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle cookie consent and popup modals
   */
  async handleModals() {
    try {
      console.log('[DSWScraper] Checking for modals...');
      await this.delay(2000);

      const dismissed = await this.page.evaluate(() => {
        // DSW cookie/modal patterns
        const closeSelectors = [
          'button[aria-label="Close"]',
          'button[aria-label="close"]',
          '.modal-close',
          '.close-button',
          '[data-testid="modal-close"]',
          'button.close',
          '#onetrust-accept-btn-handler',
          '.onetrust-close-btn-handler',
          '[data-dismiss="modal"]',
          '.email-signup-close',
          '.modal-header .close',
          'button[class*="close"]'
        ];

        for (const selector of closeSelectors) {
          const btn = document.querySelector(selector);
          if (btn && btn.offsetParent !== null) {
            btn.click();
            return true;
          }
        }

        // Try pressing Escape
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return false;
      });

      if (dismissed) {
        console.log('[DSWScraper] Dismissed modal');
        await this.delay(1000);
      }

      return dismissed;
    } catch (error) {
      console.log(`[DSWScraper] Modal handling: ${error.message}`);
      return false;
    }
  }

  /**
   * Extensive scrolling to load more products with pagination handling
   */
  async scrollForProducts(maxScrolls = 30) {
    console.log(`[DSWScraper] Scrolling to load products (max ${maxScrolls} scrolls)...`);

    let previousHeight = 0;
    let scrollCount = 0;
    let noChangeCount = 0;
    let lastProductCount = 0;

    while (scrollCount < maxScrolls && noChangeCount < 5) {
      const currentHeight = await this.page.evaluate(() => document.body.scrollHeight);

      // Smooth scroll with multiple small steps
      await this.page.evaluate(async () => {
        const scrollStep = window.innerHeight * 0.7;
        const totalScroll = document.body.scrollHeight - window.scrollY;
        const steps = Math.min(6, Math.ceil(totalScroll / scrollStep));

        for (let i = 0; i < steps; i++) {
          window.scrollBy({ top: scrollStep, behavior: 'smooth' });
          await new Promise(r => setTimeout(r, 400));
        }
      });

      await this.delay(this.config.scrollDelay);

      // Try to click "Load More" or pagination buttons
      try {
        const loadMoreClicked = await this.page.evaluate(() => {
          // DSW specific load more patterns
          const loadMoreSelectors = [
            'button[class*="load-more"]',
            'button[class*="LoadMore"]',
            'a[class*="load-more"]',
            '.load-more-btn',
            '[data-automation="load-more"]',
            'button[aria-label="Load more products"]',
            'button[aria-label="load more"]',
            '.pagination-next',
            'a[aria-label="Next"]',
            'button[aria-label="Next"]'
          ];

          for (const selector of loadMoreSelectors) {
            try {
              const btn = document.querySelector(selector);
              if (btn && btn.offsetParent !== null && !btn.disabled) {
                btn.click();
                return true;
              }
            } catch (e) {}
          }

          // Alternative: look for button with text containing "load more", "show more", "view more"
          const buttons = document.querySelectorAll('button, a');
          for (const btn of buttons) {
            const text = btn.textContent?.toLowerCase() || '';
            if ((text.includes('load more') || text.includes('show more') || text.includes('view more') || text.includes('see more')) &&
                btn.offsetParent !== null && !btn.disabled) {
              btn.click();
              return true;
            }
          }

          return false;
        });

        if (loadMoreClicked) {
          console.log('[DSWScraper] Clicked Load More button');
          await this.delay(4000);
          noChangeCount = 0; // Reset no change counter since we might get new content
        }
      } catch (e) {}

      // Count products - DSW uses various product card patterns
      const productCount = await this.page.evaluate(() => {
        // Try multiple selectors
        const selectors = [
          '[class*="product-tile"]',
          '[class*="ProductTile"]',
          '[data-automation="product-tile"]',
          '.product-card',
          '[class*="product-item"]',
          'a[href*="/product/"]'
        ];

        let maxCount = 0;
        for (const sel of selectors) {
          const items = document.querySelectorAll(sel);
          if (items.length > maxCount) {
            maxCount = items.length;
          }
        }

        return maxCount;
      });

      console.log(`[DSWScraper] Scroll ${scrollCount + 1}: ${productCount} products visible, height: ${currentHeight}`);

      if (currentHeight === previousHeight && productCount === lastProductCount) {
        noChangeCount++;
        console.log(`[DSWScraper] No new content (attempt ${noChangeCount}/5)`);
      } else {
        noChangeCount = 0;
      }

      previousHeight = currentHeight;
      lastProductCount = productCount;
      scrollCount++;

      // Stop if we have enough products for this page
      if (productCount >= 100) {
        console.log('[DSWScraper] Good number of products loaded on this page');
        break;
      }
    }

    // Final pass: scroll through entire page to trigger all lazy loading
    await this.page.evaluate(() => window.scrollTo(0, 0));
    await this.delay(1000);

    await this.page.evaluate(async () => {
      const totalHeight = document.body.scrollHeight;
      const step = window.innerHeight / 2;
      for (let pos = 0; pos < totalHeight; pos += step) {
        window.scrollTo(0, pos);
        await new Promise(r => setTimeout(r, 250));
      }
      // Scroll back to top
      window.scrollTo(0, 0);
    });
    await this.delay(2000);

    console.log(`[DSWScraper] Finished scrolling after ${scrollCount} scrolls`);
  }

  /**
   * Extract price from text
   */
  extractPrice(priceText) {
    if (!priceText) return null;
    const cleaned = priceText.replace(/[$,\s]/g, '').trim();
    const match = cleaned.match(/(\d+\.?\d*)/);
    if (!match) return null;
    const price = parseFloat(match[1]);
    return isNaN(price) ? null : price;
  }

  /**
   * Validate if discount is real
   */
  isRealDiscount(originalPrice, salePrice) {
    if (!originalPrice || !salePrice) {
      return { valid: false, reason: 'Missing price data' };
    }

    if (originalPrice <= salePrice) {
      return { valid: false, reason: 'Original price not greater than sale price' };
    }

    const discount = ((originalPrice - salePrice) / originalPrice) * 100;

    if (discount < 5) {
      return { valid: false, reason: 'Discount too small (< 5%)' };
    }

    if (discount > 90) {
      return { valid: false, reason: 'Discount too large (> 90%), likely error' };
    }

    // Detect fake discount patterns
    const ratio = originalPrice / salePrice;
    if (Math.abs(ratio - 1.3) < 0.01) {
      return { valid: false, reason: 'Detected fake 1.3x discount pattern' };
    }

    return { valid: true, discount: Math.round(discount) };
  }

  /**
   * Extract brand from product name
   */
  extractBrand(name) {
    const brandPatterns = [
      { pattern: /\bnike\b/i, brand: 'Nike' },
      { pattern: /\badidas\b/i, brand: 'Adidas' },
      { pattern: /\bpuma\b/i, brand: 'Puma' },
      { pattern: /\bnew balance\b/i, brand: 'New Balance' },
      { pattern: /\breebok\b/i, brand: 'Reebok' },
      { pattern: /\bconverse\b/i, brand: 'Converse' },
      { pattern: /\bvans\b/i, brand: 'Vans' },
      { pattern: /\bfila\b/i, brand: 'Fila' },
      { pattern: /\basics\b/i, brand: 'ASICS' },
      { pattern: /\bcrocs\b/i, brand: 'Crocs' },
      { pattern: /\btimberland\b/i, brand: 'Timberland' },
      { pattern: /\bugg\b/i, brand: 'UGG' },
      { pattern: /\bskechers\b/i, brand: 'Skechers' },
      { pattern: /\bhoka\b/i, brand: 'HOKA' },
      { pattern: /\bbrooks\b/i, brand: 'Brooks' },
      { pattern: /\bsteve madden\b/i, brand: 'Steve Madden' },
      { pattern: /\bjessica simpson\b/i, brand: 'Jessica Simpson' },
      { pattern: /\bnaturalizer\b/i, brand: 'Naturalizer' },
      { pattern: /\bclarks\b/i, brand: 'Clarks' },
      { pattern: /\bdr\.? martens?\b/i, brand: 'Dr. Martens' },
      { pattern: /\bsperry\b/i, brand: 'Sperry' },
      { pattern: /\bcole haan\b/i, brand: 'Cole Haan' },
      { pattern: /\bsam edelman\b/i, brand: 'Sam Edelman' },
      { pattern: /\bmichael kors\b/i, brand: 'Michael Kors' },
      { pattern: /\bcalvin klein\b/i, brand: 'Calvin Klein' },
      { pattern: /\btommy hilfiger\b/i, brand: 'Tommy Hilfiger' },
      { pattern: /\bguess\b/i, brand: 'Guess' },
      { pattern: /\baldo\b/i, brand: 'Aldo' },
      { pattern: /\bcandies\b/i, brand: 'Candies' },
      { pattern: /\bjordan\b/i, brand: 'Jordan' },
      { pattern: /\bbirkenstock\b/i, brand: 'Birkenstock' },
      { pattern: /\bkeds\b/i, brand: 'Keds' },
      { pattern: /\bsorel\b/i, brand: 'Sorel' },
      { pattern: /\bmerrell\b/i, brand: 'Merrell' },
      { pattern: /\bkeen\b/i, brand: 'Keen' },
      { pattern: /\bteva\b/i, brand: 'Teva' },
      { pattern: /\bchaco\b/i, brand: 'Chaco' },
      { pattern: /\bsaucony\b/i, brand: 'Saucony' },
      { pattern: /\bmizuno\b/i, brand: 'Mizuno' },
      { pattern: /\bon cloud\b/i, brand: 'On' },
      { pattern: /\bunder armour\b/i, brand: 'Under Armour' }
    ];

    for (const { pattern, brand } of brandPatterns) {
      if (pattern.test(name)) return brand;
    }

    // Try first word as brand
    const firstWord = name.split(/[\s-]/)[0];
    return (firstWord && firstWord.length > 2) ? firstWord : 'Unknown';
  }

  /**
   * Categorize product
   */
  categorizeProduct(name) {
    const lower = name.toLowerCase();

    if (lower.match(/\b(sneaker|athletic|running|trainer|basketball|tennis|walking|cross.?train|gym)\b/)) {
      return 'sneakers';
    }
    if (lower.match(/\b(boot|bootie|ankle.?boot|knee.?boot|chelsea|combat|winter)\b/)) {
      return 'boots';
    }
    if (lower.match(/\b(sandal|slide|flip.?flop|thong|platform.?sandal|wedge.?sandal)\b/)) {
      return 'sandals';
    }
    if (lower.match(/\b(heel|pump|stiletto|wedge|platform|kitten|block.?heel)\b/)) {
      return 'heels';
    }
    if (lower.match(/\b(flat|ballet|loafer|moccasin|espadrille|slip.?on)\b/)) {
      return 'flats';
    }
    if (lower.match(/\b(dress|oxford|derby|wingtip|brogue|formal)\b/)) {
      return 'dress shoes';
    }
    if (lower.match(/\b(slipper|house.?shoe|indoor)\b/)) {
      return 'slippers';
    }
    if (lower.match(/\b(clog|mule)\b/)) {
      return 'clogs';
    }

    return 'shoes';
  }

  /**
   * Extract products from current page
   */
  async extractProductsFromPage() {
    return await this.page.evaluate(() => {
      const products = [];
      const seen = new Set();

      // DSW uses product-tile__details class for product info
      // Find all product detail containers that have price info
      const detailContainers = document.querySelectorAll('.product-tile__details');
      let productCards = [];

      if (detailContainers.length > 0) {
        // Each detail container is a product
        productCards = [...detailContainers];
      } else {
        // Fallback: find products via links
        const productLinks = document.querySelectorAll('a[href*="/product/"]');
        const productCardSet = new Set();

        productLinks.forEach(link => {
          // Find the product card container by traversing up
          let container = link.parentElement;
          for (let i = 0; i < 10 && container; i++) {
            const className = container.className || '';
            // DSW uses product-tile as container
            if (className.includes('product-tile') && !className.includes('product-tile__')) {
              if (container.textContent && container.textContent.includes('$')) {
                productCardSet.add(container);
                break;
              }
            }
            // Also check for list items
            if (container.tagName === 'LI' && className.includes('product')) {
              productCardSet.add(container);
              break;
            }
            container = container.parentElement;
          }
        });

        productCards = [...productCardSet];
      }

      // Fallback: try broader selectors
      if (productCards.length < 5) {
        const productSelectors = [
          '[class*="product-tile"]:not([class*="product-tile__"])',
          'li[class*="product"]',
          '[data-automation="product-tile"]',
          '.product-card'
        ];

        for (const selector of productSelectors) {
          const cards = document.querySelectorAll(selector);
          if (cards.length > productCards.length) {
            productCards = [...cards];
          }
        }
      }

      productCards.forEach((card, index) => {
        try {
          // Get product link - for product-tile__details, the link is inside
          let linkElement = card.querySelector('a[href*="/product/"]');

          // If card is product-tile__details, we need to find the parent and get image container too
          let imageContainer = null;
          if (card.className && card.className.includes('product-tile__details')) {
            // The parent should have the image container sibling
            const parent = card.parentElement;
            if (parent) {
              imageContainer = parent.querySelector('.product-tile__image-container img');
            }
          }

          if (!linkElement) {
            linkElement = card.querySelector('a');
          }

          if (!linkElement) return;

          const url = linkElement.href;
          if (!url || !url.includes('dsw.com') || !url.includes('/product/')) return;

          // Use base URL without color params for deduplication
          const baseUrl = url.split('?')[0];
          if (seen.has(baseUrl)) return;
          seen.add(baseUrl);

          // Extract product name from link text or aria-label
          let name = '';

          // DSW puts product name in the link
          const linkText = linkElement.textContent.trim();
          // Extract just the product name (before price info)
          const nameMatch = linkText.match(/^([A-Za-z][^$]+?)(?:\s*(?:Minimum|Maximum|Clearance|\$|★))/);
          if (nameMatch) {
            name = nameMatch[1].trim();
          } else if (linkText && !linkText.includes('$')) {
            name = linkText;
          }

          // Fallback: try specific name selectors
          if (!name || name.length < 5) {
            const nameSelectors = [
              '[class*="product-name"]',
              '[class*="product-title"]',
              'h2', 'h3', 'h4'
            ];

            for (const sel of nameSelectors) {
              const el = card.querySelector(sel);
              if (el && el.textContent.trim().length > 5) {
                const text = el.textContent.trim();
                if (!text.includes('$')) {
                  name = text;
                  break;
                }
              }
            }
          }

          if (!name || name.length < 5) return;

          // Clean up name - remove extra whitespace
          name = name.replace(/\s+/g, ' ').trim();

          // Extract prices from the card - look for original and sale prices
          const fullText = card.textContent || '';
          let originalPriceText = null;
          let salePriceText = null;

          // Look for specific price patterns in DSW
          // Pattern 1: "Was $XX.XX" and "Now $YY.YY" or just current price
          const wasMatch = fullText.match(/was\s*\$?([\d,.]+)/i);
          const nowMatch = fullText.match(/now\s*\$?([\d,.]+)/i);

          if (wasMatch && nowMatch) {
            originalPriceText = '$' + wasMatch[1];
            salePriceText = '$' + nowMatch[1];
          }

          // Pattern 2: Look for strikethrough/original price elements
          if (!originalPriceText || !salePriceText) {
            const strikeEl = card.querySelector('s, del, strike, [class*="strikethrough"], [class*="was"], [class*="original"]');
            if (strikeEl) {
              const strikeMatch = strikeEl.textContent.match(/\$?([\d,.]+)/);
              if (strikeMatch) {
                originalPriceText = '$' + strikeMatch[1];
              }
            }
          }

          // Pattern 3: Extract all prices and determine which is which
          if (!originalPriceText || !salePriceText) {
            const priceMatches = fullText.match(/\$[\d,.]+/g);
            if (priceMatches && priceMatches.length >= 1) {
              const prices = priceMatches
                .map(p => parseFloat(p.replace(/[$,]/g, '')))
                .filter(p => !isNaN(p) && p > 0);

              const uniquePrices = [...new Set(prices)].sort((a, b) => a - b);

              if (uniquePrices.length >= 2) {
                // Multiple unique prices = sale (lowest is sale, highest is original)
                salePriceText = salePriceText || ('$' + uniquePrices[0]);
                originalPriceText = originalPriceText || ('$' + uniquePrices[uniquePrices.length - 1]);
              } else if (uniquePrices.length === 1 && fullText.toLowerCase().includes('clearance')) {
                // Single price on clearance page - look for MSRP or compare price
                const msrpMatch = fullText.match(/msrp\s*\$?([\d,.]+)/i) ||
                                   fullText.match(/compare at\s*\$?([\d,.]+)/i) ||
                                   fullText.match(/regular\s*\$?([\d,.]+)/i);
                if (msrpMatch) {
                  originalPriceText = '$' + msrpMatch[1];
                  salePriceText = '$' + uniquePrices[0];
                } else {
                  // Check if there's a range (Min - Max clearance price)
                  // Pattern: "Minimum Clearance Price $59.98   $59.98  –  Maximum Clearance Price $74.99"
                  const rangeMatch = fullText.match(/Minimum.*?\$([\d,.]+).*?[–-].*?Maximum.*?\$([\d,.]+)/i);
                  if (rangeMatch) {
                    salePriceText = '$' + rangeMatch[1];
                    originalPriceText = '$' + rangeMatch[2];
                  } else {
                    // Simpler range pattern: "$XX.XX - $YY.YY"
                    const simpleRange = fullText.match(/\$([\d,.]+)\s*[–-]\s*\$([\d,.]+)/);
                    if (simpleRange) {
                      const p1 = parseFloat(simpleRange[1].replace(/,/g, ''));
                      const p2 = parseFloat(simpleRange[2].replace(/,/g, ''));
                      if (p1 < p2) {
                        salePriceText = '$' + simpleRange[1];
                        originalPriceText = '$' + simpleRange[2];
                      } else {
                        salePriceText = '$' + simpleRange[2];
                        originalPriceText = '$' + simpleRange[1];
                      }
                    }
                  }
                }
              }
            }
          }

          // Skip if we don't have both prices (real discount verification)
          if (!originalPriceText || !salePriceText) return;

          // Extract image
          let image = '';

          // First try the imageContainer we found earlier
          if (imageContainer) {
            image = imageContainer.src || imageContainer.dataset.src || '';
          }

          // If not found, try looking in the parent or sibling containers
          if (!image) {
            // For product-tile__details, look in sibling image container
            const parent = card.parentElement;
            if (parent) {
              const imgContainer = parent.querySelector('.product-tile__image-container');
              if (imgContainer) {
                const img = imgContainer.querySelector('img');
                if (img) {
                  image = img.src || img.dataset.src || '';
                }
              }
            }
          }

          // Fallback: try img selectors within the card
          if (!image) {
            const imgSelectors = [
              'img[src*="designerbrands"]',
              'img[src*="dsw"]',
              'img[src*="cloudinary"]',
              'img[data-src]',
              'img'
            ];

            for (const sel of imgSelectors) {
              const img = card.querySelector(sel);
              if (img) {
                image = img.src || img.dataset.src || img.getAttribute('data-lazy-src') || '';
                // Handle srcset
                if (!image && img.srcset) {
                  const srcsetParts = img.srcset.split(',');
                  if (srcsetParts.length > 0) {
                    image = srcsetParts[0].trim().split(' ')[0];
                  }
                }
                if (image && !image.includes('placeholder') && !image.includes('logo')) {
                  break;
                }
                image = '';
              }
            }
          }

          // Try to construct image URL from product URL if still missing
          if (!image && url) {
            // DSW product URLs contain SKU like /product/name/533259
            const skuMatch = url.match(/\/(\d{6})\?/);
            if (skuMatch) {
              // Construct standard DSW image URL
              image = `https://assets.designerbrands.com/match/Site_Name/${skuMatch[1]}_ss_01/?quality=70&io=transform:fit,width:600`;
            }
          }

          // Convert protocol-relative URLs
          if (image && image.startsWith('//')) {
            image = 'https:' + image;
          }

          products.push({
            name,
            url,
            image,
            originalPriceText,
            salePriceText,
            index
          });

        } catch (error) {
          // Silent fail for individual products
        }
      });

      return products;
    });
  }

  /**
   * Search-based scraping approach
   */
  async scrapeViaSearch(searchTerm = 'sale') {
    console.log(`[DSWScraper] Searching for: ${searchTerm}`);

    try {
      // Go to DSW and use their search
      await this.page.goto(`https://www.dsw.com/en/us/search/${encodeURIComponent(searchTerm)}`, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      await this.delay(3000);
      await this.handleModals();

      return await this.extractProductsFromPage();
    } catch (error) {
      console.log(`[DSWScraper] Search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Navigate via menu approach
   */
  async navigateToSaleViaMenu() {
    console.log('[DSWScraper] Trying to navigate via menu...');

    try {
      await this.page.goto('https://www.dsw.com', {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      await this.delay(3000);
      await this.handleModals();

      // Look for Sale link in navigation
      const saleClicked = await this.page.evaluate(() => {
        const navLinks = document.querySelectorAll('nav a, header a, [role="navigation"] a');
        for (const link of navLinks) {
          const text = link.textContent.toLowerCase().trim();
          if (text === 'sale' || text === 'clearance' || text.includes('sale')) {
            link.click();
            return link.href;
          }
        }
        return null;
      });

      if (saleClicked) {
        console.log(`[DSWScraper] Clicked sale link, navigating to: ${saleClicked}`);
        await this.delay(5000);
        return this.page.url();
      }

      return null;
    } catch (error) {
      console.log(`[DSWScraper] Menu navigation failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Main scraping method
   */
  async scrape() {
    const allProducts = [];
    const seenUrls = new Set();

    try {
      console.log('[DSWScraper] Starting DSW sale scrape...');
      console.log(`[DSWScraper] Target: ${this.config.maxProducts}+ products`);

      await this.initBrowser();

      // First, try to discover sale URLs
      await this.discoverSaleUrls();

      // If no URLs found, try menu navigation
      if (this.targetUrls.length === 0 || this.targetUrls[0] === 'search') {
        const menuUrl = await this.navigateToSaleViaMenu();
        if (menuUrl && !menuUrl.includes('error')) {
          this.targetUrls = [menuUrl];
        }
      }

      // If still no URLs, use direct known paths
      if (this.targetUrls.length === 0) {
        console.log('[DSWScraper] Using direct category browsing...');
        this.targetUrls = [
          'https://www.dsw.com/c/womens-sale',
          'https://www.dsw.com/c/mens-sale',
          'https://www.dsw.com/c/kids-sale'
        ];
      }

      console.log(`[DSWScraper] Target URLs: ${this.targetUrls.join(', ')}`);

      for (const targetUrl of this.targetUrls) {
        // Check if we have enough products
        if (allProducts.length >= this.config.maxProducts) {
          console.log(`[DSWScraper] Already have ${allProducts.length} products, skipping remaining URLs`);
          break;
        }

        console.log(`\n[DSWScraper] Scraping: ${targetUrl}`);

        try {
          // Navigate to page
          await this.page.goto(targetUrl, {
            waitUntil: 'networkidle2',
            timeout: this.config.timeout
          });

          const pageTitle = await this.page.title();
          const currentUrl = this.page.url();
          console.log(`[DSWScraper] Page loaded: ${pageTitle}`);
          console.log(`[DSWScraper] Final URL: ${currentUrl}`);

          // Handle modals
          await this.handleModals();

          // Wait for products to load
          try {
            await this.page.waitForSelector('.product-tile, [data-automation="product-tile"], a[href*="/product/"]', {
              timeout: 20000
            });
          } catch (error) {
            console.log(`[DSWScraper] Products selector not found on ${targetUrl}, trying to continue...`);
          }

          await this.delay(3000);

          // Scroll extensively to load products
          const remainingNeeded = this.config.maxProducts - allProducts.length;
          const scrollsNeeded = Math.min(30, Math.ceil(remainingNeeded / 20));
          await this.scrollForProducts(scrollsNeeded);

          // Extract products
          const pageProducts = await this.extractProductsFromPage();
          console.log(`[DSWScraper] Extracted ${pageProducts.length} raw products from page`);

          // Process and validate products
          for (const rawProduct of pageProducts) {
            if (allProducts.length >= this.config.maxProducts) break;

            try {
              // Skip duplicates
              if (seenUrls.has(rawProduct.url)) continue;

              // Parse prices
              const originalPrice = this.extractPrice(rawProduct.originalPriceText);
              const salePrice = this.extractPrice(rawProduct.salePriceText);

              if (!originalPrice || !salePrice) {
                continue;
              }

              // Validate discount
              const discountCheck = this.isRealDiscount(originalPrice, salePrice);
              if (!discountCheck.valid) {
                continue;
              }

              // Validate image
              if (!rawProduct.image || rawProduct.image.length < 10) {
                continue;
              }

              // Check for duplicate by name
              const isDuplicate = allProducts.some(p =>
                p.name.toLowerCase() === rawProduct.name.toLowerCase()
              );
              if (isDuplicate) continue;

              seenUrls.add(rawProduct.url);

              // Create product object
              const product = {
                name: rawProduct.name,
                originalPrice,
                salePrice,
                image: rawProduct.image,
                url: rawProduct.url,
                discount: discountCheck.discount,
                brand: this.extractBrand(rawProduct.name),
                currency: this.currency,
                source: this.source,
                category: this.categorizeProduct(rawProduct.name)
              };

              allProducts.push(product);

              if (allProducts.length % 25 === 0) {
                console.log(`[DSWScraper] Progress: ${allProducts.length} products collected`);
              }

            } catch (error) {
              // Silent fail for individual products
            }
          }

          console.log(`[DSWScraper] Total products so far: ${allProducts.length}`);

        } catch (error) {
          console.error(`[DSWScraper] Error scraping ${targetUrl}:`, error.message);

          // If browser crashed, try to reinitialize
          if (error.message.includes('Target closed') || error.message.includes('detached')) {
            console.log('[DSWScraper] Browser crashed, reinitializing...');
            try {
              if (this.browser) {
                await this.browser.close().catch(() => {});
              }
              await this.delay(2000);
              await this.initBrowser();
            } catch (reinitError) {
              console.error('[DSWScraper] Failed to reinitialize browser:', reinitError.message);
              break; // Exit the loop if we can't recover
            }
          }

          continue;
        }

        // Rate limit between pages
        if (this.targetUrls.indexOf(targetUrl) < this.targetUrls.length - 1) {
          console.log('[DSWScraper] Rate limiting before next page...');
          await this.delay(3000);
        }
      }

      console.log(`\n[DSWScraper] Scraping complete: ${allProducts.length} valid products`);

    } catch (error) {
      console.error('[DSWScraper] Fatal error:', error.message);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }

    return allProducts;
  }
}

// Run the scraper
async function main() {
  console.log('='.repeat(60));
  console.log('DSW (Designer Shoe Warehouse) Sale Scraper');
  console.log('Target: https://www.dsw.com/en/us/sale');
  console.log('='.repeat(60));

  const scraper = new DSWSaleScraper({
    headless: true,
    maxProducts: 200,
    timeout: 90000,
    scrollDelay: 2500
  });

  try {
    const products = await scraper.scrape();

    console.log('\n' + '='.repeat(60));
    console.log(`RESULTS: ${products.length} products scraped`);
    console.log('='.repeat(60));

    if (products.length > 0) {
      // Save to file
      const output = {
        scrapedAt: new Date().toISOString(),
        source: 'dsw.com',
        totalProducts: products.length,
        products: products
      };

      fs.writeFileSync('/tmp/dsw-sale-products.json', JSON.stringify(output, null, 2));
      console.log('\nOutput saved to: /tmp/dsw-sale-products.json');

      // Summary statistics
      const brands = {};
      const categories = {};
      let totalDiscount = 0;
      let minPrice = Infinity;
      let maxPrice = 0;

      products.forEach(p => {
        brands[p.brand] = (brands[p.brand] || 0) + 1;
        categories[p.category] = (categories[p.category] || 0) + 1;
        totalDiscount += p.discount;
        minPrice = Math.min(minPrice, p.salePrice);
        maxPrice = Math.max(maxPrice, p.salePrice);
      });

      console.log('\n--- SUMMARY ---');
      console.log(`Total Products: ${products.length}`);
      console.log(`Average Discount: ${Math.round(totalDiscount / products.length)}%`);
      console.log(`Price Range: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`);

      console.log('\n--- TOP BRANDS ---');
      Object.entries(brands)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([brand, count]) => {
          console.log(`  ${brand}: ${count} products`);
        });

      console.log('\n--- CATEGORIES ---');
      Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .forEach(([category, count]) => {
          console.log(`  ${category}: ${count} products`);
        });

      console.log('\n--- SAMPLE PRODUCTS ---');
      products.slice(0, 5).forEach((p, i) => {
        console.log(`\n${i + 1}. ${p.name}`);
        console.log(`   Brand: ${p.brand}`);
        console.log(`   Price: $${p.salePrice} (was $${p.originalPrice}) - ${p.discount}% OFF`);
        console.log(`   Image: ${p.image.substring(0, 60)}...`);
        console.log(`   URL: ${p.url.substring(0, 60)}...`);
      });

    } else {
      console.log('\nNo products scraped.');
      fs.writeFileSync('/tmp/dsw-sale-products.json', JSON.stringify({
        scrapedAt: new Date().toISOString(),
        source: 'dsw.com',
        totalProducts: 0,
        products: [],
        error: 'No products found'
      }, null, 2));
    }

  } catch (error) {
    console.error('Scraper failed:', error.message);
    fs.writeFileSync('/tmp/dsw-sale-products.json', JSON.stringify({
      scrapedAt: new Date().toISOString(),
      source: 'dsw.com',
      error: error.message,
      products: []
    }, null, 2));
    process.exit(1);
  }
}

main();
