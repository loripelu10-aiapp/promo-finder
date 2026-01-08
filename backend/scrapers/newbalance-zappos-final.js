/**
 * New Balance scraper via Zappos - Clean extraction version
 * Properly parses product names and prices
 */

const BaseScraper = require('./brands/base-scraper');
const fs = require('fs');

class NewBalanceZapposScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: 60,
      scrollDelay: 2000,
      rateLimit: 3000,
      ...config
    });

    this.targetUrl = 'https://www.zappos.com/new-balance-sale';
    this.brand = 'New Balance';
    this.source = 'zappos.com';
    this.currency = 'USD';
    this.commission = 6;
  }

  async scrape(browserInstance = null) {
    const products = [];

    try {
      console.log(`[${this.getName()}] Starting scrape of Zappos New Balance sale`);
      console.log(`URL: ${this.targetUrl}`);
      console.log('');

      await this.initBrowser(browserInstance);

      await this.page.goto(this.targetUrl, {
        waitUntil: 'networkidle2',
        timeout: 45000
      });

      console.log(`[${this.getName()}] Page loaded, waiting for products...`);
      await this.delay(5000);

      // Scroll to load more products
      console.log('Scrolling to load more products...');
      for (let i = 0; i < 10; i++) {
        await this.page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await this.delay(1500);
      }

      await this.page.evaluate(() => window.scrollTo(0, 0));
      await this.delay(2000);

      // Extract products with cleaner approach
      const scrapedProducts = await this.page.evaluate(() => {
        const results = [];
        const processedUrls = new Set();

        // Find all product links
        const productLinks = document.querySelectorAll('a[href*="/p/new-balance"]');

        productLinks.forEach((link) => {
          try {
            const url = link.href;
            if (processedUrls.has(url)) return;
            if (!url.includes('/p/new-balance')) return;

            // Find the product card - usually an article or specific container
            let card = link.closest('article') || link.closest('[data-product-id]');

            // If no article found, traverse up to find a suitable container
            if (!card) {
              let parent = link.parentElement;
              for (let i = 0; i < 8 && parent; i++) {
                // Stop when we find a container that seems like a product card
                if (parent.querySelector('img') &&
                    parent.textContent.includes('$') &&
                    parent.textContent.length < 1000) {
                  card = parent;
                  break;
                }
                parent = parent.parentElement;
              }
            }

            if (!card) return;

            // Extract product name from URL (most reliable)
            // URL format: /p/new-balance-product-name-color/product/id/color/id
            const urlParts = url.split('/');
            const productSlug = urlParts.find(p => p.startsWith('new-balance-'));
            let name = '';

            if (productSlug) {
              // Convert slug to readable name: new-balance-574-grey -> New Balance 574 Grey
              name = productSlug
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            }

            // Also try to get name from aria-label or title
            const ariaLabel = link.getAttribute('aria-label') || link.getAttribute('title');
            if (ariaLabel && ariaLabel.toLowerCase().includes('new balance')) {
              name = ariaLabel;
            }

            // Get image
            let image = '';
            const img = card.querySelector('img');
            if (img) {
              image = img.src || img.dataset.src || '';
              // Try to get higher quality from srcset
              if (img.srcset) {
                const srcsets = img.srcset.split(',');
                // Get the last (usually highest quality) image
                const lastSrc = srcsets[srcsets.length - 1].trim().split(' ')[0];
                if (lastSrc) image = lastSrc;
              }
            }

            // Extract prices more carefully
            // Look for specific price patterns in the card text
            const cardText = card.textContent;

            // Find all dollar amounts
            const priceRegex = /\$\d+(?:\.\d{2})?/g;
            const priceMatches = cardText.match(priceRegex) || [];

            // Extract discount percentage if present
            const discountMatch = cardText.match(/(\d+)%\s*(?:off|OFF)/i);
            const discountPercent = discountMatch ? parseInt(discountMatch[1]) : null;

            let originalPrice = null;
            let salePrice = null;

            // Try to find MSRP text
            const msrpMatch = cardText.match(/MSRP[:\s]*\$(\d+(?:\.\d{2})?)/i);
            if (msrpMatch) {
              originalPrice = parseFloat(msrpMatch[1]);
            }

            // Unique prices (remove duplicates and sort)
            const uniquePrices = [...new Set(priceMatches)]
              .map(p => parseFloat(p.replace('$', '')))
              .filter(p => !isNaN(p) && p > 0)
              .sort((a, b) => a - b);

            if (uniquePrices.length >= 2) {
              // Lower price is sale, higher is original
              salePrice = uniquePrices[0];
              if (!originalPrice) {
                originalPrice = uniquePrices[uniquePrices.length - 1];
              }
            } else if (uniquePrices.length === 1 && discountPercent) {
              // Calculate original from discount
              salePrice = uniquePrices[0];
              originalPrice = Math.round(salePrice / (1 - discountPercent / 100) * 100) / 100;
            }

            // Validate we have good data
            if (!name || !originalPrice || !salePrice) return;
            if (originalPrice <= salePrice) return;

            processedUrls.add(url);
            results.push({
              name: name.trim(),
              url,
              image,
              originalPrice,
              salePrice,
              discountPercent
            });

          } catch (e) {
            console.error('Error processing product:', e.message);
          }
        });

        return results;
      });

      console.log(`[${this.getName()}] Extracted ${scrapedProducts.length} products`);

      // Process and validate products
      for (const rawProduct of scrapedProducts) {
        if (products.length >= this.config.maxProducts) break;

        try {
          const originalPrice = rawProduct.originalPrice;
          const salePrice = rawProduct.salePrice;

          // Validate discount
          const discountCheck = this.isRealDiscount(originalPrice, salePrice);
          if (!discountCheck.valid) {
            continue;
          }

          const product = {
            name: rawProduct.name,
            brand: this.brand,
            originalPrice,
            salePrice,
            discount: discountCheck.discount,
            currency: this.currency,
            image: rawProduct.image,
            url: rawProduct.url,
            category: this.categorizeProduct(rawProduct.name)
          };

          products.push(product);
          console.log(`Added: ${product.name} - $${originalPrice} -> $${salePrice} (${product.discount}% off)`);

        } catch (e) {
          console.error('Processing error:', e.message);
        }
      }

      console.log('');
      console.log(`[${this.getName()}] Complete: ${products.length} valid products`);

    } catch (error) {
      console.error(`[${this.getName()}] Error:`, error.message);
    } finally {
      await this.close(!browserInstance);
    }

    return products;
  }

  categorizeProduct(name) {
    const lower = name.toLowerCase();
    if (lower.match(/\b(shoe|sneaker|trainer|running|walking|990|574|550|327|530|608|2002r|9060|boot|sandal|foam|fresh|fuelcell|minimus|arishi|dynasoft|880|860|1080|vongo)\b/)) {
      return 'shoes';
    }
    if (lower.match(/\b(shirt|top|jacket|hoodie|pants|shorts|tee|jersey|tank)\b/)) {
      return 'clothing';
    }
    return 'shoes';
  }
}

// Run if called directly
if (require.main === module) {
  const scraper = new NewBalanceZapposScraper({
    headless: true,
    maxProducts: 60
  });

  scraper.scrape().then(products => {
    console.log('');
    console.log('='.repeat(60));
    console.log(`Total products scraped: ${products.length}`);

    if (products.length < 50) {
      console.log('WARNING: Less than 50 products found. May need to retry or adjust scraper.');
    }

    // Format for output
    const formatted = products.map(p => ({
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

    // Save output
    fs.writeFileSync('/tmp/newbalance-scrape-output.txt', JSON.stringify(formatted, null, 2));
    console.log('');
    console.log('Output saved to /tmp/newbalance-scrape-output.txt');

    if (products.length > 0) {
      console.log('');
      console.log('Sample products:');
      products.slice(0, 5).forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.name}`);
        console.log(`     Original: $${p.originalPrice} -> Sale: $${p.salePrice} (${p.discount}% off)`);
        console.log(`     Image: ${p.image.substring(0, 70)}...`);
        console.log(`     URL: ${p.url.substring(0, 70)}...`);
        console.log('');
      });
    }
  }).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = NewBalanceZapposScraper;
