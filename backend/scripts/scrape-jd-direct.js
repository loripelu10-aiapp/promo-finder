#!/usr/bin/env node

const BaseScraper = require('../scrapers/brands/base-scraper');

class JDDirectScraper extends BaseScraper {
  constructor(config = {}) {
    super({
      maxProducts: 15,
      scrollDelay: 3000,
      timeout: 60000,
      ...config
    });
  }

  async scrape() {
    console.log('🔍 Scraping JD Sports UK - Adidas Sale...');

    const products = [];

    // Direct URL to Adidas sale on JD Sports
    const urls = [
      'https://www.jdsports.co.uk/men/brand/adidas-originals/sale/',
      'https://www.jdsports.co.uk/brand/adidas/footwear/'
    ];

    try {
      await this.initBrowser();

      for (const url of urls) {
        console.log(`\n📄 Loading: ${url}`);

        await this.page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: this.config.timeout
        });

        await this.delay(5000);

        // Screenshot
        await this.page.screenshot({ path: '/tmp/jd-direct-debug.png' });
        console.log('📸 Screenshot saved');

        // Check page title
        const title = await this.page.title();
        console.log(`📄 Title: ${title}`);

        if (title.includes('404') || title.includes('Error')) {
          console.log('⚠️  Page not found, trying next URL...');
          continue;
        }

        // Try to find products
        const productData = await this.page.evaluate(() => {
          const results = [];

          // JD Sports product selectors
          const cards = document.querySelectorAll(
            '.productListItem, [class*="ProductCard"], [data-test-id*="product"], article'
          );

          console.log(`Found ${cards.length} potential product cards`);

          cards.forEach(card => {
            try {
              const link = card.querySelector('a[href*="/product/"]');
              if (!link) return;

              const img = card.querySelector('img');
              const nameEl = card.querySelector('[class*="name"], [class*="title"], h3, h2');
              const priceEls = card.querySelectorAll('[class*="price"]');

              if (img && nameEl) {
                results.push({
                  name: nameEl.textContent.trim(),
                  url: link.href,
                  image: img.src || img.dataset.src,
                  priceText: Array.from(priceEls).map(p => p.textContent.trim()).join(' ')
                });
              }
            } catch (e) {}
          });

          return results;
        });

        console.log(`📦 Found ${productData.length} products`);

        if (productData.length > 0) {
          products.push(...productData);
          break; // Got products, no need to try other URLs
        }
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
    } finally {
      await this.close();
    }

    return products;
  }
}

async function main() {
  const scraper = new JDDirectScraper();
  const products = await scraper.scrape();

  console.log('\n========== RESULTS ==========\n');
  console.log(JSON.stringify(products.slice(0, 10), null, 2));
}

main().catch(console.error);
