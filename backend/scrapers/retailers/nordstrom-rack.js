const BaseScraper = require('../brands/base-scraper');

/**
 * NordstromRackScraper - Scrapes Nordstrom Rack clearance page
 *
 * Nordstrom Rack sells discounted designer brands
 * Commission: 4%
 * CDN: n.nordstrommedia.com
 */
class NordstromRackScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: config.maxProducts || 150,
      scrollDelay: 2500,
      rateLimit: 3000,
      timeout: 60000,
      ...config
    });

    // Use specific clearance category URLs that show products directly
    this.clearanceUrls = [
      'https://www.nordstromrack.com/clearance/Women',
      'https://www.nordstromrack.com/clearance/Men',
      'https://www.nordstromrack.com/clearance/Shoes',
      'https://www.nordstromrack.com/clearance/Bags-Accessories'
    ];
    this.source = 'nordstromrack.com';
    this.commission = 0.04; // 4% commission
  }

  /**
   * Main scraping method for clearance products
   */
  async scrape(browserInstance = null) {
    const products = [];
    const seenUrls = new Set();

    try {
      console.log(`[NordstromRackScraper] Starting scrape of ${this.clearanceUrls.length} clearance categories`);

      await this.initBrowser(browserInstance);

      // Iterate through each clearance category
      for (const url of this.clearanceUrls) {
        if (products.length >= this.config.maxProducts) {
          console.log(`[NordstromRackScraper] Reached max products limit (${this.config.maxProducts})`);
          break;
        }

        console.log(`\n[NordstromRackScraper] Navigating to: ${url}`);

        try {
          await this.page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: this.config.timeout
          });

          // Wait for initial load
          await this.delay(4000);

          // Debug: Analyze page structure
          const pageAnalysis = await this.page.evaluate(() => {
            const analysis = {
              title: document.title,
              url: window.location.href,
              nordstromImages: document.querySelectorAll('img[src*="nordstrommedia"]').length,
              priceTexts: (document.body.textContent.match(/\$\d+\.\d{2}/g) || []).length
            };
            return analysis;
          });

          console.log(`[NordstromRackScraper] Page Analysis:`);
          console.log(`  - Title: ${pageAnalysis.title}`);
          console.log(`  - Nordstrom images: ${pageAnalysis.nordstromImages}`);
          console.log(`  - Price patterns found: ${pageAnalysis.priceTexts}`);

          // Scroll to load more products
          console.log(`[NordstromRackScraper] Scrolling to load more products...`);
          await this.scrollToLoadMoreProducts(10);

          // Additional delay after scrolling
          await this.delay(2000);

          // Use the robust image-based extraction
          console.log(`[NordstromRackScraper] Extracting products...`);
          const scrapedProducts = await this.extractProductsByImages();

          console.log(`[NordstromRackScraper] Found ${scrapedProducts.length} products from this category`);

          // Process and validate products
          for (const rawProduct of scrapedProducts) {
            if (products.length >= this.config.maxProducts) {
              break;
            }

            // Skip duplicates
            if (seenUrls.has(rawProduct.url)) {
              continue;
            }

            try {
              const processedProduct = this.processProduct(rawProduct, products.length);
              if (processedProduct) {
                seenUrls.add(rawProduct.url);
                products.push(processedProduct);
              }
            } catch (error) {
              // Skip products with processing errors
            }
          }

          console.log(`[NordstromRackScraper] Total products so far: ${products.length}`);

          // Rate limit between categories
          await this.delay(2000);

        } catch (error) {
          console.log(`[NordstromRackScraper] Error scraping ${url}: ${error.message}`);
          continue;
        }
      }

      console.log(`\n[NordstromRackScraper] Scraping complete: ${products.length} valid products`);

    } catch (error) {
      console.error(`[NordstromRackScraper] Fatal error during scraping: ${error.message}`);

      // Save debug info
      try {
        await this.page.screenshot({ path: '/tmp/nordstrom-rack-error.png', fullPage: false });
        console.log(`[NordstromRackScraper] Error screenshot saved to /tmp/nordstrom-rack-error.png`);
      } catch (e) {}

      throw error;
    } finally {
      await this.close(!browserInstance);
    }

    return products;
  }

  /**
   * Custom scroll method for Nordstrom Rack infinite scroll
   */
  async scrollToLoadMoreProducts(maxScrolls = 20) {
    let previousImageCount = 0;
    let scrollCount = 0;
    let noChangeCount = 0;

    while (scrollCount < maxScrolls && noChangeCount < 3) {
      // Get current image count
      const currentImageCount = await this.page.evaluate(() => {
        return document.querySelectorAll('img[src*="nordstrommedia.com"]').length;
      });

      console.log(`  Scroll ${scrollCount + 1}: ${currentImageCount} product images found`);

      if (currentImageCount === previousImageCount) {
        noChangeCount++;
      } else {
        noChangeCount = 0;
      }

      previousImageCount = currentImageCount;

      // Stop if we have enough products
      if (currentImageCount >= 150) {
        console.log(`  Reached target product count (${currentImageCount})`);
        break;
      }

      // Scroll down
      await this.page.evaluate(() => {
        window.scrollBy(0, window.innerHeight * 2);
      });

      // Wait for new content
      await this.delay(2000);

      // Try clicking "Load More" button if present
      try {
        const loadMoreClicked = await this.page.evaluate(() => {
          const buttons = document.querySelectorAll('button, a');
          for (const btn of buttons) {
            const text = btn.textContent.toLowerCase();
            if (text.includes('load more') || text.includes('show more') || text.includes('view more')) {
              btn.click();
              return true;
            }
          }
          return false;
        });
        if (loadMoreClicked) {
          console.log(`  Clicked "Load More" button`);
          await this.delay(3000);
        }
      } catch (e) {}

      scrollCount++;
    }

    console.log(`  Scrolling complete after ${scrollCount} scrolls`);
  }

  /**
   * Extract products by finding Nordstrom images and extracting nearby data
   */
  async extractProductsByImages() {
    return await this.page.evaluate(() => {
      const products = [];
      const seenUrls = new Set();

      // Find all product images from Nordstrom CDN
      const images = document.querySelectorAll('img[src*="nordstrommedia.com"]');

      images.forEach((img, idx) => {
        try {
          const imageSrc = img.src || img.dataset.src || '';
          if (!imageSrc.includes('nordstrommedia.com')) return;

          // Walk up DOM to find the product card container
          let container = img;
          let productLink = null;
          let depth = 0;

          while (container && depth < 10) {
            container = container.parentElement;
            if (!container) break;

            // Check if this container has a product link
            const link = container.querySelector('a[href*="/s/"]');
            if (link && !productLink) {
              productLink = link;
            }

            // Check if container has price information
            const text = container.textContent || '';
            if (text.match(/\$\d+/) && productLink) {
              // Extract URL
              const url = productLink.href;
              if (!url || seenUrls.has(url)) {
                depth++;
                continue;
              }

              // Look for price elements more specifically
              // Nordstrom Rack typically shows: "Compare At $X" and current price "$Y"
              let salePrice = null;
              let originalPrice = null;

              // Method 1: Look for "Compare At" price (original)
              const compareMatch = text.match(/Compare\s*At\s*\$?([\d,]+\.?\d*)/i);
              if (compareMatch) {
                originalPrice = parseFloat(compareMatch[1].replace(/,/g, ''));
              }

              // Method 2: Find all dollar amounts
              const priceMatches = text.match(/\$[\d,]+\.?\d*/g) || [];
              const prices = priceMatches
                .map(p => parseFloat(p.replace(/[$,]/g, '')))
                .filter(p => p > 0 && p < 10000);

              if (prices.length === 0) {
                depth++;
                continue;
              }

              // Get unique prices
              const uniquePrices = [...new Set(prices)].sort((a, b) => a - b);

              // The sale price is typically the lowest (or one of the lowest)
              // The compare at price is the highest
              if (uniquePrices.length >= 2) {
                salePrice = uniquePrices[0];
                // Use compare at price if found, otherwise use highest price
                if (!originalPrice) {
                  originalPrice = uniquePrices[uniquePrices.length - 1];
                }
                // Make sure original is higher than sale
                if (originalPrice <= salePrice) {
                  originalPrice = uniquePrices.find(p => p > salePrice) || salePrice * 1.5;
                }
              } else {
                salePrice = uniquePrices[0];
              }

              if (!salePrice || salePrice <= 0) {
                depth++;
                continue;
              }

              // Extract product name from aria-label, title, or text content
              let name = '';

              // Try aria-label on the link
              if (productLink.getAttribute('aria-label')) {
                name = productLink.getAttribute('aria-label');
              }

              // Try heading elements
              if (!name) {
                const headingEl = container.querySelector('h1, h2, h3, h4, span[class*="name"], span[class*="title"], div[class*="name"], p[class*="name"]');
                if (headingEl) {
                  const headingText = headingEl.textContent.trim();
                  if (headingText.length > 3 && headingText.length < 150 && !headingText.includes('$')) {
                    name = headingText;
                  }
                }
              }

              // Try the image alt text
              if (!name && img.alt && img.alt.length > 3) {
                name = img.alt;
              }

              // Extract text that looks like a product name
              if (!name) {
                const textContent = container.textContent
                  .replace(/\$[\d,.]+/g, '')
                  .replace(/\d+%\s*off/gi, '')
                  .replace(/Compare At/gi, '')
                  .trim();

                const lines = textContent.split(/\n/).map(l => l.trim()).filter(l => l.length > 3 && l.length < 100);
                if (lines.length > 0) {
                  const nameLine = lines.find(l => !l.match(/^\d+$/) && !l.match(/^(save|off|clearance|sale)/i));
                  if (nameLine) {
                    name = nameLine;
                  }
                }
              }

              if (!name) name = 'Nordstrom Rack Item';

              // Clean up name - remove ", Image" suffix
              name = name.replace(/,?\s*Image$/i, '').trim();

              // Extract brand if present
              let brand = 'Various';
              const brandPatterns = [
                /^([A-Z][A-Za-z&\s]+)\s+\|/,
                /^([A-Z][A-Za-z&\s]+)\s+-/,
              ];
              for (const pattern of brandPatterns) {
                const match = name.match(pattern);
                if (match) {
                  brand = match[1].trim();
                  break;
                }
              }

              // Check for discount percentage in text
              let discountText = null;
              const discountMatch = text.match(/(\d+)%\s*off/i);
              if (discountMatch) {
                discountText = discountMatch[1];
              }

              seenUrls.add(url);
              products.push({
                name: name.substring(0, 150),
                brand,
                url,
                image: imageSrc,
                originalPriceText: originalPrice ? '$' + originalPrice.toFixed(2) : null,
                salePriceText: '$' + salePrice.toFixed(2),
                discountText
              });

              break; // Found product data, move to next image
            }
            depth++;
          }
        } catch (e) {
          // Continue with next image
        }
      });

      return products;
    });
  }

  /**
   * Find product container by looking for Nordstrom CDN images
   */
  async findProductContainerByImages() {
    return await this.page.evaluate(() => {
      // Find all elements containing Nordstrom media images
      const images = document.querySelectorAll('img[src*="nordstrommedia.com"], img[data-src*="nordstrommedia.com"]');

      if (images.length === 0) return null;

      // Find the common parent that likely contains product info
      let commonSelector = null;
      const sampleImage = images[0];

      // Walk up the DOM to find a suitable container
      let parent = sampleImage.parentElement;
      let depth = 0;

      while (parent && depth < 10) {
        // Check if this parent has price-like text
        const text = parent.textContent || '';
        if (text.match(/\$\d+/) && parent.querySelector('a[href]')) {
          // Try to identify a class or data attribute
          if (parent.className) {
            const classes = parent.className.split(' ').filter(c => c.length > 2);
            if (classes.length > 0) {
              commonSelector = '.' + classes[0];
              break;
            }
          }
          if (parent.getAttribute('data-testid')) {
            commonSelector = `[data-testid="${parent.getAttribute('data-testid')}"]`;
            break;
          }
        }
        parent = parent.parentElement;
        depth++;
      }

      return commonSelector;
    });
  }

  /**
   * Alternative extraction method - directly parse page for product data
   */
  async extractProductsAlternative() {
    console.log(`[NordstromRackScraper] Using alternative extraction...`);

    return await this.page.evaluate(() => {
      const products = [];

      // Method 1: Find all Nordstrom media images and work outward
      const images = document.querySelectorAll('img[src*="nordstrommedia.com"]');

      images.forEach((img) => {
        try {
          // Find the nearest container with price and link
          let container = img.parentElement;
          let depth = 0;

          while (container && depth < 8) {
            const text = container.textContent || '';
            const link = container.querySelector('a[href*="/s/"]') || container.closest('a[href*="/s/"]');

            // Check for price patterns
            const priceMatches = text.match(/\$[\d,.]+/g);

            if (link && priceMatches && priceMatches.length >= 1) {
              const url = link.href;
              const imageSrc = img.src || img.dataset.src;

              // Extract name - usually near the image or in the link
              let name = '';
              const nameEl = container.querySelector('[class*="name"], [class*="title"], h2, h3, h4');
              if (nameEl) {
                name = nameEl.textContent.trim();
              } else {
                // Try to get text that's not a price
                const allText = container.textContent.replace(/\$[\d,.]+/g, '').trim();
                const textParts = allText.split('\n').filter(t => t.trim().length > 3 && t.trim().length < 100);
                if (textParts.length > 0) {
                  name = textParts[0].trim();
                }
              }

              // Extract brand from name if present
              let brand = 'Various';
              const brandEl = container.querySelector('[class*="brand"], [class*="Brand"]');
              if (brandEl) {
                brand = brandEl.textContent.trim();
              }

              // Parse prices
              let originalPrice = null;
              let salePrice = null;

              // Look for strikethrough/original price
              const origEl = container.querySelector('del, s, [class*="original"], [class*="compare"], [class*="was"]');
              if (origEl) {
                const origText = origEl.textContent.match(/\$[\d,.]+/);
                if (origText) originalPrice = origText[0];
              }

              // Look for current/sale price
              const saleEl = container.querySelector('[class*="sale"], [class*="current"], [class*="now"]');
              if (saleEl) {
                const saleText = saleEl.textContent.match(/\$[\d,.]+/);
                if (saleText) salePrice = saleText[0];
              }

              // Fallback: parse all prices
              if (!originalPrice || !salePrice) {
                const prices = priceMatches.map(p => parseFloat(p.replace(/[$,]/g, '')));
                if (prices.length >= 2) {
                  // Assume higher is original, lower is sale
                  prices.sort((a, b) => b - a);
                  originalPrice = '$' + prices[0].toFixed(2);
                  salePrice = '$' + prices[prices.length - 1].toFixed(2);
                } else if (prices.length === 1) {
                  salePrice = '$' + prices[0].toFixed(2);
                }
              }

              if (name && url && imageSrc && salePrice) {
                // Avoid duplicates
                const exists = products.some(p => p.url === url);
                if (!exists) {
                  products.push({
                    name: name.substring(0, 100),
                    brand,
                    url,
                    image: imageSrc,
                    originalPriceText: originalPrice,
                    salePriceText: salePrice
                  });
                }
              }
              break;
            }

            container = container.parentElement;
            depth++;
          }
        } catch (e) {
          // Continue with next image
        }
      });

      return products;
    });
  }

  /**
   * Extract products from page using working selector
   */
  async extractProducts(selector) {
    return await this.page.evaluate((sel) => {
      const results = [];
      const cards = document.querySelectorAll(sel);

      cards.forEach((card) => {
        try {
          // Get product link
          const linkEl = card.querySelector('a[href]') || card.closest('a[href]');
          if (!linkEl) return;

          const url = linkEl.href;
          if (!url || !url.includes('nordstromrack.com')) return;

          // Get product image (must be from Nordstrom CDN)
          let image = null;
          const imgEl = card.querySelector('img[src*="nordstrommedia.com"], img[data-src*="nordstrommedia.com"]');
          if (imgEl) {
            image = imgEl.src || imgEl.dataset.src;
          }

          // Also check for background images
          if (!image) {
            const bgEl = card.querySelector('[style*="nordstrommedia.com"]');
            if (bgEl) {
              const bgMatch = bgEl.getAttribute('style').match(/url\(['"]?(https:\/\/n\.nordstrommedia\.com[^'")\s]+)/);
              if (bgMatch) image = bgMatch[1];
            }
          }

          if (!image) return;

          // Get product name
          let name = null;
          const nameSelectors = [
            '[class*="productTitle"]',
            '[class*="product-title"]',
            '[class*="ProductName"]',
            '[class*="product-name"]',
            '[class*="name"]',
            '[class*="title"]',
            'h2', 'h3', 'h4'
          ];

          for (const ns of nameSelectors) {
            const el = card.querySelector(ns);
            if (el && el.textContent.trim().length > 3 && !el.textContent.includes('$')) {
              name = el.textContent.trim();
              break;
            }
          }

          if (!name) {
            // Fallback: get non-price text
            const allText = card.textContent.replace(/\$[\d,.]+/g, '').trim();
            const parts = allText.split('\n').filter(t => t.trim().length > 3 && t.trim().length < 100);
            if (parts.length > 0) name = parts[0].trim();
          }

          if (!name || name.length < 3) return;

          // Get brand
          let brand = 'Various';
          const brandEl = card.querySelector('[class*="brand"], [class*="Brand"], [class*="designer"]');
          if (brandEl) {
            brand = brandEl.textContent.trim();
          }

          // Get prices
          let originalPriceText = null;
          let salePriceText = null;

          // Look for price elements
          const priceContainer = card.querySelector('[class*="price"], [class*="Price"]') || card;

          // Original/compare price
          const origSelectors = ['del', 's', '[class*="compare"]', '[class*="original"]', '[class*="was"]', '[class*="strike"]'];
          for (const os of origSelectors) {
            const el = priceContainer.querySelector(os);
            if (el) {
              const priceMatch = el.textContent.match(/\$[\d,.]+/);
              if (priceMatch) {
                originalPriceText = priceMatch[0];
                break;
              }
            }
          }

          // Sale/current price
          const saleSelectors = ['[class*="sale"]', '[class*="current"]', '[class*="now"]', '[class*="final"]'];
          for (const ss of saleSelectors) {
            const el = priceContainer.querySelector(ss);
            if (el) {
              const priceMatch = el.textContent.match(/\$[\d,.]+/);
              if (priceMatch) {
                salePriceText = priceMatch[0];
                break;
              }
            }
          }

          // Fallback: find all prices in container
          if (!originalPriceText || !salePriceText) {
            const allPrices = (card.textContent.match(/\$[\d,.]+/g) || [])
              .map(p => parseFloat(p.replace(/[$,]/g, '')))
              .filter(p => p > 0 && p < 10000);

            if (allPrices.length >= 2) {
              const sorted = [...new Set(allPrices)].sort((a, b) => b - a);
              originalPriceText = '$' + sorted[0].toFixed(2);
              salePriceText = '$' + sorted[sorted.length - 1].toFixed(2);
            } else if (allPrices.length === 1) {
              salePriceText = '$' + allPrices[0].toFixed(2);
            }
          }

          // Extract discount if shown
          let discountText = null;
          const discountEl = card.querySelector('[class*="discount"], [class*="percent"], [class*="saving"]');
          if (discountEl) {
            const discMatch = discountEl.textContent.match(/(\d+)%/);
            if (discMatch) discountText = discMatch[1];
          }

          if (salePriceText) {
            results.push({
              name,
              brand,
              url,
              image,
              originalPriceText,
              salePriceText,
              discountText
            });
          }
        } catch (e) {
          // Continue with next card
        }
      });

      return results;
    }, selector);
  }

  /**
   * Process and validate a raw product
   */
  processProduct(rawProduct, index) {
    // Extract prices
    const salePrice = this.extractPrice(rawProduct.salePriceText);
    let originalPrice = rawProduct.originalPriceText ? this.extractPrice(rawProduct.originalPriceText) : null;

    if (!salePrice || salePrice <= 0) {
      return null;
    }

    // Validate price relationships
    if (originalPrice) {
      // Original price should be higher than sale price
      if (originalPrice <= salePrice) {
        // Swap if wrong order
        if (salePrice > originalPrice) {
          const temp = originalPrice;
          originalPrice = salePrice;
          // Keep sale price as is if it's reasonable
        }
      }

      // Sanity check: original should not be more than 10x sale price
      if (originalPrice > salePrice * 10) {
        // Price parsing likely captured wrong values, use reasonable estimate
        originalPrice = salePrice * 1.5;
      }
    }

    // Calculate discount
    let discount = 0;

    if (rawProduct.discountText) {
      discount = parseInt(rawProduct.discountText, 10);
    }

    if (originalPrice && originalPrice > salePrice) {
      discount = Math.round(((originalPrice - salePrice) / originalPrice) * 100);
    } else if (!originalPrice && discount > 0 && discount <= 85) {
      // Calculate original price from discount
      originalPrice = Math.round(salePrice / (1 - discount / 100) * 100) / 100;
    } else if (!originalPrice) {
      // Estimate original price for Nordstrom Rack (typically 40-60% off retail)
      originalPrice = Math.round(salePrice * 1.7 * 100) / 100;
      discount = Math.round(((originalPrice - salePrice) / originalPrice) * 100);
    }

    // Skip if discount is unrealistic (too small or too large)
    if (discount < 10 || discount > 85) {
      // Don't log for every skip to reduce noise
      return null;
    }

    // Validate image is from Nordstrom CDN
    if (!rawProduct.image || !rawProduct.image.includes('nordstrommedia.com')) {
      return null;
    }

    // Clean up name
    let name = rawProduct.name
      .replace(/\s+/g, ' ')
      .replace(/,?\s*Image$/i, '')
      .trim()
      .substring(0, 150);

    // Skip if name looks invalid
    if (!name || name.length < 3 || name === 'Nordstrom Rack Item') {
      return null;
    }

    // Clean up brand
    let brand = rawProduct.brand || 'Various';
    if (brand.length > 50) brand = brand.substring(0, 50);

    // Ensure URL is absolute
    let url = rawProduct.url;
    if (url && !url.startsWith('http')) {
      url = 'https://www.nordstromrack.com' + url;
    }

    return {
      name,
      brand,
      originalPrice: Math.round(originalPrice * 100) / 100,
      salePrice: Math.round(salePrice * 100) / 100,
      discount,
      currency: 'USD',
      image: rawProduct.image,
      url,
      category: this.categorizeProduct(name),
      source: this.source,
      commission: this.commission,
      scrapedAt: new Date().toISOString()
    };
  }

  /**
   * Categorize product based on name
   */
  categorizeProduct(name) {
    const lower = name.toLowerCase();

    if (lower.match(/\b(shoe|sneaker|boot|sandal|heel|flat|loafer|pump|mule|slipper)\b/)) {
      return 'shoes';
    }
    if (lower.match(/\b(shirt|blouse|top|tee|sweater|cardigan|pullover|tank|cami)\b/)) {
      return 'tops';
    }
    if (lower.match(/\b(pants|jeans|shorts|skirt|legging|trouser)\b/)) {
      return 'bottoms';
    }
    if (lower.match(/\b(dress|gown|romper|jumpsuit)\b/)) {
      return 'dresses';
    }
    if (lower.match(/\b(jacket|coat|blazer|vest|hoodie|sweatshirt)\b/)) {
      return 'outerwear';
    }
    if (lower.match(/\b(bag|purse|wallet|clutch|tote|backpack|handbag)\b/)) {
      return 'bags';
    }
    if (lower.match(/\b(watch|jewelry|necklace|bracelet|earring|ring|sunglasses|scarf|hat|belt)\b/)) {
      return 'accessories';
    }
    if (lower.match(/\b(bra|underwear|panty|lingerie|sock)\b/)) {
      return 'intimates';
    }
    if (lower.match(/\b(makeup|lipstick|mascara|foundation|skincare|perfume|fragrance)\b/)) {
      return 'beauty';
    }

    return 'clothing';
  }
}

// Main execution
async function main() {
  console.log('=== Nordstrom Rack Clearance Scraper ===\n');

  const scraper = new NordstromRackScraper({
    maxProducts: 150,
    headless: true
  });

  try {
    const products = await scraper.scrape();

    console.log(`\n=== Results ===`);
    console.log(`Total products scraped: ${products.length}`);

    if (products.length > 0) {
      // Format products for output
      const outputProducts = products.map(p => ({
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

      // Save to file
      const fs = require('fs');
      const output = JSON.stringify(outputProducts, null, 2);
      fs.writeFileSync('/tmp/nordstromrack-scrape-output.txt', output);
      console.log(`\nOutput saved to /tmp/nordstromrack-scrape-output.txt`);

      // Show sample products
      console.log(`\n=== Sample Products ===`);
      outputProducts.slice(0, 5).forEach((p, i) => {
        console.log(`\n${i + 1}. ${p.name}`);
        console.log(`   Brand: ${p.brand}`);
        console.log(`   Price: $${p.salePrice} (was $${p.originalPrice})`);
        console.log(`   Discount: ${p.discount}%`);
        console.log(`   Category: ${p.category}`);
        console.log(`   Image: ${p.image.substring(0, 60)}...`);
      });

      // Statistics
      const avgDiscount = Math.round(products.reduce((sum, p) => sum + p.discount, 0) / products.length);
      const categories = {};
      products.forEach(p => {
        categories[p.category] = (categories[p.category] || 0) + 1;
      });

      console.log(`\n=== Statistics ===`);
      console.log(`Average discount: ${avgDiscount}%`);
      console.log(`Categories:`);
      Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, count]) => {
          console.log(`  - ${cat}: ${count} products`);
        });
    }

  } catch (error) {
    console.error('Scraper failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = NordstromRackScraper;
