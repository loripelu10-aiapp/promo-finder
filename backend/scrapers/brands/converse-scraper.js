const BaseScraper = require('./base-scraper');

/**
 * ConverseScraper - Scrapes Converse sale page for deals
 *
 * Target: https://www.converse.com/shop/sale
 * Extracts products with real discounts only (no price estimation)
 *
 * Note: Converse is owned by Nike, so the site structure may be similar
 * Commission: 8%
 */
class ConverseScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: 100, // Aim for 50+ valid products
      scrollDelay: 3000, // Converse loads products dynamically
      rateLimit: 5000,
      timeout: 60000, // 60 second timeout for slow pages
      ...config
    });

    this.targetUrl = 'https://www.converse.com/shop/sale';
    this.brand = 'Converse';
    this.source = 'converse.com';
    this.currency = 'USD';
    this.commission = 0.08; // 8% commission
    this.availableRegions = ['US', 'GLOBAL'];
  }

  /**
   * Main scraping method
   */
  async scrape(browserInstance = null) {
    const products = [];

    try {
      console.log(`[${this.getName()}] Starting scrape of ${this.targetUrl}`);

      await this.initBrowser(browserInstance);

      // Navigate to Converse sale page
      await this.page.goto(this.targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout
      });

      // Wait additional time for dynamic content
      await this.delay(5000);

      console.log(`[${this.getName()}] Page loaded, waiting for products...`);

      // Debug: Get page title and URL
      const pageTitle = await this.page.title();
      const pageUrl = await this.page.url();
      console.log(`[${this.getName()}] Page title: ${pageTitle}`);
      console.log(`[${this.getName()}] Current URL: ${pageUrl}`);

      // Wait for product grid to load - try multiple selectors
      const productSelectors = [
        '[data-testid="product-card"]',
        '.product-card',
        '.product-grid__item',
        '[class*="ProductCard"]',
        '[class*="product-card"]',
        'article[class*="product"]',
        '.product-tile',
        '[data-component="ProductCard"]'
      ];

      let foundSelector = null;
      for (const selector of productSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          foundSelector = selector;
          console.log(`[${this.getName()}] Found products using selector: ${selector}`);
          break;
        } catch (e) {
          // Continue to next selector
        }
      }

      if (!foundSelector) {
        console.log(`[${this.getName()}] No product cards found with standard selectors, trying page analysis...`);
        // Take a screenshot for debugging if needed
        await this.delay(3000);
      }

      // Scroll to load more products
      await this.scrollToLoadProducts(8);

      // Scroll up and down to trigger lazy loading of images
      await this.page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await this.delay(2000);
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await this.delay(2000);
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await this.delay(3000);

      // Debug: Check what's on the page
      const debugInfo = await this.page.evaluate(() => {
        const allDivs = document.querySelectorAll('div');
        const allLinks = document.querySelectorAll('a');
        const allImages = document.querySelectorAll('img');
        const productTiles = document.querySelectorAll('.product-tile');
        const productCards = document.querySelectorAll('[class*="product"]');
        const priceElements = document.querySelectorAll('[class*="price"]');

        return {
          totalDivs: allDivs.length,
          totalLinks: allLinks.length,
          totalImages: allImages.length,
          productTiles: productTiles.length,
          productCards: productCards.length,
          priceElements: priceElements.length,
          bodyText: document.body.innerText.slice(0, 2000),
          productTileClasses: productTiles.length > 0 ? productTiles[0].className : 'none',
          sampleLinks: Array.from(allLinks).slice(0, 10).map(a => a.href)
        };
      });
      console.log(`[${this.getName()}] Debug - Divs: ${debugInfo.totalDivs}, Links: ${debugInfo.totalLinks}, Images: ${debugInfo.totalImages}`);
      console.log(`[${this.getName()}] Debug - Product tiles: ${debugInfo.productTiles}, Product cards: ${debugInfo.productCards}`);
      console.log(`[${this.getName()}] Debug - Price elements: ${debugInfo.priceElements}`);
      console.log(`[${this.getName()}] Debug - Sample links:`, debugInfo.sampleLinks);

      // Get more detailed info about product tiles
      const tileDebug = await this.page.evaluate(() => {
        const tiles = document.querySelectorAll('.product-tile');
        const sampleTiles = [];
        for (let i = 0; i < Math.min(3, tiles.length); i++) {
          const tile = tiles[i];
          const links = tile.querySelectorAll('a');
          const images = tile.querySelectorAll('img');
          sampleTiles.push({
            html: tile.outerHTML.slice(0, 500),
            text: tile.innerText.slice(0, 300),
            links: Array.from(links).map(a => a.href),
            images: Array.from(images).map(img => img.src || img.dataset?.src)
          });
        }
        return sampleTiles;
      });
      console.log(`[${this.getName()}] Sample tile 1:`, tileDebug[0]?.text);
      console.log(`[${this.getName()}] Sample tile 1 links:`, tileDebug[0]?.links);
      console.log(`[${this.getName()}] Sample tile 1 images:`, tileDebug[0]?.images);

      // Extract products using multiple strategies
      const scrapedProducts = await this.page.evaluate(() => {
        const results = [];
        const processedUrls = new Set();

        // Strategy 1: Work with .product-tile elements directly
        const productTiles = document.querySelectorAll('.product-tile');

        productTiles.forEach((tile) => {
          try {
            // Find all links in the tile
            const links = tile.querySelectorAll('a');
            let productUrl = '';
            let productName = '';

            // Look for the main product link
            links.forEach(link => {
              const href = link.href;
              // Look for product page links - Converse uses various patterns
              if (href && (href.includes('/pd/') || href.includes('/shop/p/') || href.match(/\/[a-z0-9-]+\/[a-z0-9]+$/i))) {
                if (!productUrl || href.length < productUrl.length) {
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
              productUrl = links[0].href;
            }

            // Get product name from various sources
            if (!productName) {
              const nameElement = tile.querySelector('.product-tile__title') ||
                                  tile.querySelector('[class*="title"]') ||
                                  tile.querySelector('[class*="name"]') ||
                                  tile.querySelector('h2') ||
                                  tile.querySelector('h3');
              if (nameElement) {
                productName = nameElement.textContent.trim();
              }
            }

            // If still no name, try to extract from tile text
            if (!productName) {
              const tileText = tile.innerText;
              const lines = tileText.split('\n').filter(l => l.trim().length > 0);
              if (lines.length > 0) {
                // First non-price line is usually the product name
                for (const line of lines) {
                  if (!line.match(/^\$/) && line.length > 3 && line.length < 100) {
                    productName = line.trim();
                    break;
                  }
                }
              }
            }

            if (!productName || productName.length < 3) return;
            if (processedUrls.has(productUrl)) return;

            // Extract image - try to find a real image, not a placeholder
            const images = tile.querySelectorAll('img');
            let image = '';
            for (const img of images) {
              const src = img.src || img.dataset.src || '';
              // Skip placeholder images
              if (src && !src.startsWith('data:') && src !== '//:0' && src.includes('converse.com')) {
                image = src;
                break;
              }
            }
            // Fallback to first image with srcset
            if (!image) {
              for (const img of images) {
                const srcset = img.getAttribute('srcset');
                if (srcset) {
                  const firstSrc = srcset.split(' ')[0];
                  if (firstSrc && !firstSrc.startsWith('data:')) {
                    image = firstSrc;
                    break;
                  }
                }
              }
            }

            // Extract prices - look for dollar amounts in the tile
            const tileText = tile.innerText;
            const priceMatches = tileText.match(/\$\d+\.?\d{0,2}/g);

            let originalPriceText = null;
            let salePriceText = null;

            if (priceMatches && priceMatches.length >= 2) {
              // Parse prices and sort
              const parsedPrices = priceMatches.map(p => ({
                text: p,
                value: parseFloat(p.replace('$', ''))
              }));

              // Deduplicate by value
              const uniquePrices = [];
              const seenValues = new Set();
              for (const p of parsedPrices) {
                if (!seenValues.has(p.value)) {
                  seenValues.add(p.value);
                  uniquePrices.push(p);
                }
              }

              // Sort by value descending
              uniquePrices.sort((a, b) => b.value - a.value);

              if (uniquePrices.length >= 2) {
                originalPriceText = uniquePrices[0].text;
                salePriceText = uniquePrices[1].text;
              }
            } else if (priceMatches && priceMatches.length === 1) {
              // Only one price - might not be on sale
              salePriceText = priceMatches[0];
            }

            // Only add if we have both prices (sale item)
            if (productName && originalPriceText && salePriceText && productUrl) {
              processedUrls.add(productUrl);
              results.push({
                name: productName,
                url: productUrl,
                image,
                originalPriceText,
                salePriceText
              });
            }
          } catch (error) {
            // Skip this tile
          }
        });

        return results;
      });

      console.log(`[${this.getName()}] Found ${scrapedProducts.length} products with price data`);

      // Process and validate products
      for (const rawProduct of scrapedProducts) {
        if (products.length >= this.config.maxProducts) {
          console.log(`[${this.getName()}] Reached max products limit (${this.config.maxProducts})`);
          break;
        }

        try {
          // Extract prices
          const originalPrice = this.extractPrice(rawProduct.originalPriceText);
          const salePrice = this.extractPrice(rawProduct.salePriceText);

          // Validate discount
          const discountCheck = this.isRealDiscount(originalPrice, salePrice);
          if (!discountCheck.valid) {
            console.log(`[${this.getName()}] Rejected "${rawProduct.name}": ${discountCheck.reason}`);
            continue;
          }

          // Validate image URL
          let imageUrl = rawProduct.image;

          // Skip placeholder images
          if (!imageUrl || imageUrl.startsWith('data:') || imageUrl === '//:0') {
            console.log(`[${this.getName()}] Skipped "${rawProduct.name}": No valid image URL`);
            continue;
          }

          if (!imageUrl.startsWith('http')) {
            if (imageUrl.startsWith('//')) {
              imageUrl = 'https:' + imageUrl;
            } else if (imageUrl.startsWith('/')) {
              imageUrl = 'https://www.converse.com' + imageUrl;
            }
          }

          // Validate it's from Converse CDN
          if (!imageUrl.includes('converse.com') && !imageUrl.includes('nike.com')) {
            console.log(`[${this.getName()}] Skipped "${rawProduct.name}": Image not from Converse CDN`);
            continue;
          }

          // Clean up product name (remove "View " prefix if present)
          let cleanName = rawProduct.name;
          if (cleanName.startsWith('View ')) {
            cleanName = cleanName.substring(5);
          }

          // Create product object
          const product = {
            id: `converse-${Date.now()}-${products.length}`,
            name: cleanName,
            brand: this.brand,
            category: this.categorizeProduct(rawProduct.name),
            originalPrice,
            salePrice,
            discount: discountCheck.discount,
            currency: this.currency,
            image: imageUrl,
            url: rawProduct.url,
            source: this.source,
            commission: this.commission,
            availableRegions: this.availableRegions,
            verified: false,
            scrapedAt: new Date().toISOString()
          };

          products.push(product);
          console.log(`[${this.getName()}] Added: ${product.name} (${product.discount}% off)`);

        } catch (error) {
          console.error(`[${this.getName()}] Error processing product:`, error.message);
        }
      }

      console.log(`[${this.getName()}] Scraping complete: ${products.length} valid products`);

    } catch (error) {
      console.error(`[${this.getName()}] Fatal error during scraping:`, error.message);
      throw error;
    } finally {
      // Only close browser if we created it (not provided by pool)
      await this.close(!browserInstance);
    }

    return products;
  }

  /**
   * Categorize product based on name
   */
  categorizeProduct(name) {
    const lower = name.toLowerCase();

    // Converse specific categories
    if (lower.match(/\b(chuck\s?taylor|all\s?star|chuck\s?70|one\s?star|jack\s?purcell|star\s?player|run\s?star|weapon|pro\s?leather|fastbreak)\b/)) {
      return 'shoes';
    }
    if (lower.match(/\b(shoe|sneaker|boot|sandal|trainer|hi-top|low-top|high\s?top|low\s?top|platform|lugged)\b/)) {
      return 'shoes';
    }
    if (lower.match(/\b(shirt|top|jacket|hoodie|sweater|tee|t-shirt|sweatshirt|polo|vest)\b/)) {
      return 'clothing';
    }
    if (lower.match(/\b(pants|jeans|shorts|joggers|sweatpants)\b/)) {
      return 'clothing';
    }
    if (lower.match(/\b(bag|backpack|wallet|hat|cap|beanie|socks|belt)\b/)) {
      return 'accessories';
    }

    return 'shoes'; // Default for Converse
  }
}

// Run scraper if called directly
if (require.main === module) {
  const fs = require('fs');
  const scraper = new ConverseScraper({ headless: true });

  scraper.scrape()
    .then(products => {
      console.log(`\n========================================`);
      console.log(`SCRAPING COMPLETE`);
      console.log(`Total products found: ${products.length}`);
      console.log(`========================================\n`);

      // Format products for output (simplified format as requested)
      const formattedProducts = products.map(p => ({
        name: p.name,
        brand: p.brand,
        originalPrice: p.originalPrice,
        salePrice: p.salePrice,
        discount: p.discount,
        currency: p.currency,
        image: p.image,
        url: p.url,
        category: p.category
      }));

      // Output as JSON to file
      const outputPath = '/tmp/converse-scrape-output.txt';
      fs.writeFileSync(outputPath, JSON.stringify(formattedProducts, null, 2));
      console.log(`Output saved to: ${outputPath}`);

      // Also print summary
      console.log(`\nSample products:`);
      formattedProducts.slice(0, 5).forEach((p, i) => {
        console.log(`${i + 1}. ${p.name} - $${p.salePrice} (was $${p.originalPrice}, ${p.discount}% off)`);
      });
    })
    .catch(error => {
      console.error('Scraping failed:', error);
      process.exit(1);
    });
}

module.exports = ConverseScraper;
