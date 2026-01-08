/**
 * New Balance scraper via Zappos - Fixed version
 * Based on actual page structure observed in screenshot
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

    // Direct New Balance sale search URL
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

      // Navigate to Zappos
      await this.page.goto(this.targetUrl, {
        waitUntil: 'networkidle2',
        timeout: 45000
      });

      console.log(`[${this.getName()}] Page loaded, waiting for products...`);

      // Wait for products to load
      await this.delay(5000);

      // Scroll to load more products - do more scrolls
      console.log('Scrolling to load more products...');
      for (let i = 0; i < 8; i++) {
        await this.page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await this.delay(1500);
      }

      // Scroll back to top
      await this.page.evaluate(() => window.scrollTo(0, 0));
      await this.delay(2000);

      // Take screenshot for debugging
      await this.page.screenshot({ path: '/tmp/zappos-nb-v2.png', fullPage: false });
      console.log('Screenshot saved to /tmp/zappos-nb-v2.png');

      // Save HTML for debugging
      const html = await this.page.content();
      fs.writeFileSync('/tmp/zappos-nb-v2.html', html);

      // Extract products using a more generic approach
      const scrapedProducts = await this.page.evaluate(() => {
        const results = [];

        // Find all article elements or divs that contain product info
        // Based on screenshot, products appear in a grid with "New Balance" brand name visible
        const allElements = document.querySelectorAll('article, [data-product], [itemtype*="Product"]');

        // Also try finding by looking for elements containing "New Balance" text
        const allLinks = document.querySelectorAll('a[href*="/p/new-balance"], a[href*="/p/"]');

        console.log(`Found ${allElements.length} articles and ${allLinks.length} product links`);

        // Process each link as potential product
        const processedUrls = new Set();

        allLinks.forEach((link, index) => {
          try {
            const url = link.href;
            if (processedUrls.has(url)) return;
            if (!url.includes('/p/')) return;

            // Find the product card container (go up the DOM tree)
            let container = link;
            for (let i = 0; i < 10 && container; i++) {
              const text = container.textContent || '';
              if (text.includes('$') && text.toLowerCase().includes('new balance')) {
                break;
              }
              container = container.parentElement;
            }

            if (!container) return;

            const containerText = container.textContent || '';
            if (!containerText.toLowerCase().includes('new balance')) return;

            // Extract name - look for heading or specific text
            let name = '';
            const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6, span, p, div');
            for (const h of headings) {
              const t = h.textContent.trim();
              if (t.toLowerCase().includes('new balance') && t.length < 200 && t.length > 10) {
                name = t;
                break;
              }
            }

            if (!name) {
              // Try to extract from link text or nearby elements
              const spans = container.querySelectorAll('span');
              for (const span of spans) {
                if (span.textContent.includes('New Balance')) {
                  // Get the next sibling or parent's text for product name
                  let nameText = '';
                  let sibling = span.nextElementSibling;
                  if (sibling) nameText = sibling.textContent.trim();
                  if (!nameText) {
                    const parent = span.parentElement;
                    if (parent) nameText = parent.textContent.replace(span.textContent, '').trim();
                  }
                  name = `New Balance ${nameText}`.trim();
                  break;
                }
              }
            }

            // Extract image
            let image = '';
            const imgs = container.querySelectorAll('img');
            for (const img of imgs) {
              const src = img.src || img.dataset.src || '';
              if (src && (src.includes('zappos') || src.includes('cloudfront'))) {
                image = src;
                // Try to get higher resolution
                if (img.srcset) {
                  const srcsets = img.srcset.split(',');
                  const lastSrc = srcsets[srcsets.length - 1].trim().split(' ')[0];
                  if (lastSrc) image = lastSrc;
                }
                break;
              }
            }

            // Extract prices - look for dollar amounts
            const priceMatches = containerText.match(/\$[\d,.]+/g) || [];
            let originalPrice = '';
            let salePrice = '';

            if (priceMatches.length >= 2) {
              // Usually first is current price, second might be original
              // Look for strikethrough styling
              const allSpans = container.querySelectorAll('span, div, p');
              for (const el of allSpans) {
                const text = el.textContent.trim();
                if (text.match(/^\$[\d,.]+$/)) {
                  const style = window.getComputedStyle(el);
                  if (style.textDecoration.includes('line-through')) {
                    originalPrice = text;
                  } else if (!salePrice) {
                    salePrice = text;
                  }
                }
              }
            } else if (priceMatches.length === 1) {
              salePrice = priceMatches[0];
            }

            // If we didn't find strikethrough, use position (higher price is original)
            if (!originalPrice && priceMatches.length >= 2) {
              const prices = priceMatches.map(p => parseFloat(p.replace(/[$,]/g, ''))).sort((a, b) => b - a);
              if (prices[0] !== prices[1]) {
                originalPrice = `$${prices[0]}`;
                salePrice = `$${prices[prices.length - 1]}`;
              }
            }

            if (name && url) {
              processedUrls.add(url);
              results.push({
                name,
                url,
                image,
                originalPriceText: originalPrice,
                salePriceText: salePrice,
                priceMatches,
                index
              });
            }
          } catch (e) {
            console.error('Error:', e.message);
          }
        });

        return results;
      });

      console.log(`[${this.getName()}] Found ${scrapedProducts.length} New Balance products`);

      // Log some raw data for debugging
      if (scrapedProducts.length > 0) {
        console.log('Sample raw product:');
        console.log(JSON.stringify(scrapedProducts[0], null, 2));
      }

      // Process products
      for (const rawProduct of scrapedProducts) {
        if (products.length >= this.config.maxProducts) break;

        try {
          let originalPrice = this.extractPrice(rawProduct.originalPriceText);
          let salePrice = this.extractPrice(rawProduct.salePriceText);

          // If only one price found, check if it looks like a sale product
          if (!originalPrice && salePrice) {
            // Skip products without visible discount
            continue;
          }

          if (!salePrice && originalPrice) {
            salePrice = originalPrice;
            originalPrice = null;
            continue; // No discount
          }

          if (!originalPrice || !salePrice) continue;

          const discountCheck = this.isRealDiscount(originalPrice, salePrice);
          if (!discountCheck.valid) {
            console.log(`Rejected "${rawProduct.name}": ${discountCheck.reason}`);
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
          console.log(`Added: ${product.name} ($${originalPrice} -> $${salePrice}, ${product.discount}% off)`);

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
    if (lower.match(/\b(shoe|sneaker|trainer|running|walking|990|574|550|327|530|608|2002r|9060|boot|sandal|foam|fresh|fuelcell)\b/)) {
      return 'shoes';
    }
    if (lower.match(/\b(shirt|top|jacket|hoodie|pants|shorts|tee)\b/)) {
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
        console.log(`     $${p.originalPrice} -> $${p.salePrice} (${p.discount}% off)`);
        console.log(`     Image: ${p.image.substring(0, 60)}...`);
      });
    }
  }).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = NewBalanceZapposScraper;
