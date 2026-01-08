/**
 * New Balance scraper via Zappos (less protected retailer)
 * Zappos sells New Balance products and has lighter bot protection
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

    // Zappos sale URL for New Balance
    this.targetUrl = 'https://www.zappos.com/new-balance-shoes~Og#!/new-balance-sale/WgLpHRXuAY_FAQHiAgMBGAI.zso?s=percentOff/desc/';
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

      // Wait for product grid
      try {
        await this.page.waitForSelector('[data-product-id], article[class*="product"], [id*="product"]', {
          timeout: 15000
        });
        console.log('Found product elements');
      } catch (e) {
        console.log('Could not find standard product selectors, trying alternatives...');
      }

      // Scroll to load more
      await this.scrollToLoadProducts(5);

      // Take screenshot for debugging
      await this.page.screenshot({ path: '/tmp/zappos-nb.png' });
      console.log('Screenshot saved to /tmp/zappos-nb.png');

      // Extract products
      const scrapedProducts = await this.page.evaluate(() => {
        const results = [];

        // Zappos uses various selectors for product cards
        const selectors = [
          '[data-product-id]',
          'article[itemtype*="Product"]',
          '[id^="product-"]',
          'article',
          '[class*="productCard"]',
          '[class*="ProductCard"]',
          'a[href*="/p/new-balance"]'
        ];

        let productElements = [];
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 5) {
            productElements = elements;
            break;
          }
        }

        console.log(`Found ${productElements.length} potential products`);

        productElements.forEach((card, index) => {
          try {
            // Find link
            let link = card.querySelector('a[href*="/p/"]');
            if (!link && card.tagName === 'A') link = card;
            if (!link) return;

            const url = link.href;
            if (!url.includes('new-balance') && !url.includes('New-Balance')) return;

            // Find name
            let name = '';
            const nameEl = card.querySelector('[itemprop="name"], [class*="name"], [class*="Name"], [class*="title"], [class*="Title"]');
            if (nameEl) {
              name = nameEl.textContent.trim();
            } else {
              // Try to extract from link text or alt
              const img = card.querySelector('img');
              if (img && img.alt) name = img.alt.trim();
            }

            if (!name || !name.toLowerCase().includes('new balance')) {
              // Skip non-New Balance products
              return;
            }

            // Find image
            let image = '';
            const img = card.querySelector('img');
            if (img) {
              image = img.src || img.dataset.src || '';
              // Prefer high-res
              if (img.srcset) {
                const srcsets = img.srcset.split(',');
                if (srcsets.length > 0) {
                  const lastSrc = srcsets[srcsets.length - 1].trim().split(' ')[0];
                  if (lastSrc) image = lastSrc;
                }
              }
            }

            // Find prices
            let originalPrice = '';
            let salePrice = '';

            // Zappos typically shows prices in specific elements
            const priceEls = card.querySelectorAll('[class*="price"], [class*="Price"]');
            priceEls.forEach(el => {
              const text = el.textContent.trim();
              if (text.includes('$')) {
                const style = window.getComputedStyle(el);
                if (style.textDecoration.includes('line-through') ||
                    el.className.includes('was') ||
                    el.className.includes('original') ||
                    el.className.includes('msrp')) {
                  originalPrice = text;
                } else if (!salePrice) {
                  salePrice = text;
                }
              }
            });

            // Also check for discount percentage
            const discountEl = card.querySelector('[class*="discount"], [class*="percent"], [class*="savings"]');
            const discountText = discountEl ? discountEl.textContent : '';

            if (name && url && (salePrice || originalPrice)) {
              results.push({
                name: name.replace(/New Balance/gi, '').trim() || name,
                fullName: name,
                url,
                image,
                originalPriceText: originalPrice,
                salePriceText: salePrice,
                discountText,
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

      // Process products
      for (const rawProduct of scrapedProducts) {
        if (products.length >= this.config.maxProducts) break;

        try {
          const originalPrice = this.extractPrice(rawProduct.originalPriceText);
          const salePrice = this.extractPrice(rawProduct.salePriceText);

          // If we only have sale price, try to estimate original from discount text
          let finalOriginal = originalPrice;
          let finalSale = salePrice || originalPrice;

          if (!originalPrice && rawProduct.discountText) {
            const discountMatch = rawProduct.discountText.match(/(\d+)/);
            if (discountMatch && salePrice) {
              const discountPercent = parseInt(discountMatch[1]);
              finalOriginal = Math.round(salePrice / (1 - discountPercent / 100) * 100) / 100;
            }
          }

          if (!finalOriginal || !finalSale) continue;

          const discountCheck = this.isRealDiscount(finalOriginal, finalSale);
          if (!discountCheck.valid) {
            console.log(`Rejected "${rawProduct.name}": ${discountCheck.reason}`);
            continue;
          }

          const product = {
            name: rawProduct.fullName,
            brand: this.brand,
            originalPrice: finalOriginal,
            salePrice: finalSale,
            discount: discountCheck.discount,
            currency: this.currency,
            image: rawProduct.image,
            url: rawProduct.url,
            category: this.categorizeProduct(rawProduct.fullName)
          };

          products.push(product);
          console.log(`Added: ${product.name} (${product.discount}% off)`);

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
    if (lower.match(/\b(shoe|sneaker|trainer|running|walking|990|574|550|327|530|608|2002r|9060|boot|sandal)\b/)) {
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
      products.slice(0, 3).forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.name}`);
        console.log(`     $${p.originalPrice} -> $${p.salePrice} (${p.discount}% off)`);
      });
    }
  }).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = NewBalanceZapposScraper;
