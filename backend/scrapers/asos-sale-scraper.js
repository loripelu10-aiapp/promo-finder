const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

// Enable stealth plugin
puppeteerExtra.use(StealthPlugin());

/**
 * ASOS Sale Scraper with Puppeteer Stealth
 * Scrapes sale products from multiple categories: men, women, shoes
 * Target: 200+ products with real discounts
 */

const ASOS_SALE_URLS = {
  women: 'https://www.asos.com/us/women/sale/cat/?cid=7046&page=',
  men: 'https://www.asos.com/us/men/sale/cat/?cid=8409&page=',
  womenShoes: 'https://www.asos.com/us/women/sale/shoes/cat/?cid=4172&page=',
  menShoes: 'https://www.asos.com/us/men/sale/shoes-boots-sneakers/cat/?cid=1935&page='
};

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrollPage(page) {
  await page.evaluate(async () => {
    const scrollStep = 800;
    const scrollDelay = 300;
    let currentPosition = 0;
    const maxScroll = Math.min(document.body.scrollHeight, 15000);

    while (currentPosition < maxScroll) {
      window.scrollTo(0, currentPosition);
      currentPosition += scrollStep;
      await new Promise(r => setTimeout(r, scrollDelay));
    }

    // Scroll back up a bit to trigger lazy load
    window.scrollTo(0, maxScroll / 2);
    await new Promise(r => setTimeout(r, 500));
    window.scrollTo(0, maxScroll);
  });
}

async function extractProducts(page, category) {
  return await page.evaluate((cat) => {
    const products = [];

    // ASOS uses CSS-in-JS with dynamic class names like "productTile_U0clN"
    // We need to use partial class matching
    const productTiles = document.querySelectorAll('[class*="productTile_"], li[class*="productTile"]');

    console.log(`Found ${productTiles.length} product tiles`);

    productTiles.forEach((el, index) => {
      try {
        // Extract product link - they use "/prd/" in product URLs
        const linkEl = el.querySelector('a[href*="/prd/"]');
        const productUrl = linkEl ? linkEl.href : '';

        if (!productUrl) return;

        // Extract name from product description element
        let name = '';
        const descEl = el.querySelector('[class*="productDescription"]');
        if (descEl) {
          name = descEl.textContent.trim();
        }

        // Extract brand (usually first child of product info)
        let brand = 'ASOS';
        const brandEl = el.querySelector('[class*="productBrand"], [class*="productInfo"] > p:first-child');
        if (brandEl && brandEl.textContent.trim() !== name) {
          const brandText = brandEl.textContent.trim();
          if (brandText && brandText.length < 50 && !brandText.includes('$')) {
            brand = brandText;
          }
        }

        // Extract prices - ASOS has originalPrice and reducedPrice classes
        let originalPrice = 0;
        let salePrice = 0;

        // Look for reduced price (sale price)
        const reducedPriceEl = el.querySelector('[class*="reducedPrice"]');
        if (reducedPriceEl) {
          const match = reducedPriceEl.textContent.match(/\$[\d,.]+/);
          if (match) {
            salePrice = parseFloat(match[0].replace(/[$,]/g, ''));
          }
        }

        // Look for original price (marked down price)
        const originalPriceEl = el.querySelector('[class*="originalPrice"]');
        if (originalPriceEl) {
          const match = originalPriceEl.textContent.match(/\$[\d,.]+/);
          if (match) {
            originalPrice = parseFloat(match[0].replace(/[$,]/g, ''));
          }
        }

        // Fallback: look for any price elements
        if (salePrice === 0) {
          const priceEls = el.querySelectorAll('[class*="price"]');
          const prices = [];
          priceEls.forEach(pel => {
            const match = pel.textContent.match(/\$[\d,.]+/);
            if (match) {
              prices.push(parseFloat(match[0].replace(/[$,]/g, '')));
            }
          });

          // Remove duplicates
          const uniquePrices = [...new Set(prices)].sort((a, b) => a - b);
          if (uniquePrices.length >= 2) {
            salePrice = uniquePrices[0];
            originalPrice = uniquePrices[uniquePrices.length - 1];
          } else if (uniquePrices.length === 1) {
            salePrice = uniquePrices[0];
            originalPrice = uniquePrices[0];
          }
        }

        // Extract image URL
        let imageUrl = '';
        const imgEl = el.querySelector('img');
        if (imgEl) {
          imageUrl = imgEl.src || imgEl.dataset.src || '';
          // Handle srcset
          if (!imageUrl && imgEl.srcset) {
            const srcsetParts = imgEl.srcset.split(',');
            if (srcsetParts.length > 0) {
              imageUrl = srcsetParts[0].trim().split(' ')[0];
            }
          }
          // Ensure absolute URL
          if (imageUrl && !imageUrl.startsWith('http')) {
            imageUrl = 'https:' + imageUrl;
          }
        }

        // Also check for picture element source
        if (!imageUrl) {
          const sourceEl = el.querySelector('picture source');
          if (sourceEl && sourceEl.srcset) {
            const srcsetParts = sourceEl.srcset.split(',');
            if (srcsetParts.length > 0) {
              imageUrl = srcsetParts[0].trim().split(' ')[0];
              if (!imageUrl.startsWith('http')) {
                imageUrl = 'https:' + imageUrl;
              }
            }
          }
        }

        // Calculate discount
        const discount = originalPrice > 0 && salePrice < originalPrice && salePrice > 0
          ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
          : 0;

        // Only add if we have minimum required data and there's an actual discount
        if (name && name.length > 3 && salePrice > 0 && originalPrice > 0 && discount > 0) {
          products.push({
            name: name.substring(0, 150),
            brand,
            category: cat,
            originalPrice: Math.round(originalPrice * 100) / 100,
            salePrice: Math.round(salePrice * 100) / 100,
            discount,
            imageUrl,
            productUrl,
            source: 'asos.com'
          });
        }
      } catch (err) {
        // Skip problematic elements
      }
    });

    return products;
  }, category);
}

async function scrapeCategory(browser, categoryName, baseUrl, maxPages = 3) {
  console.log(`\n--- Scraping ASOS ${categoryName} ---`);
  const allProducts = [];

  const page = await browser.newPage();

  // Set realistic viewport
  await page.setViewport({ width: 1920, height: 1080 });

  // Set extra headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"'
  });

  try {
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const url = baseUrl + pageNum;
      console.log(`Loading page ${pageNum}: ${url}`);

      try {
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 60000
        });

        // Random delay to appear more human
        await delay(3000 + Math.random() * 2000);

        // Wait for products to load - use the actual ASOS selector
        try {
          await page.waitForSelector('[class*="productTile_"], a[href*="/prd/"]', {
            timeout: 20000
          });
        } catch (e) {
          console.log(`No products found on page ${pageNum}, might be end of results`);
          break;
        }

        // Scroll to load lazy images
        await scrollPage(page);
        await delay(2000);

        // Extract products
        const products = await extractProducts(page, categoryName);
        console.log(`Page ${pageNum}: Found ${products.length} products with discounts`);

        if (products.length === 0 && pageNum > 1) {
          console.log('No more products found, stopping pagination');
          break;
        }

        allProducts.push(...products);

        // Check if we have enough products
        if (allProducts.length >= 300) {
          console.log('Reached target product count, stopping');
          break;
        }

        // Delay between pages
        if (pageNum < maxPages) {
          await delay(3000 + Math.random() * 3000);
        }

      } catch (pageError) {
        console.log(`Error loading page ${pageNum}:`, pageError.message);
        if (pageNum === 1) {
          // First page failed, take screenshot for debugging
          try {
            await page.screenshot({ path: `/tmp/asos-error-${categoryName.replace(/\s/g, '-')}.png` });
          } catch (e) {}
          throw pageError;
        }
        break;
      }
    }
  } finally {
    await page.close();
  }

  return allProducts;
}

async function scrapeAsosSale() {
  console.log('==============================================');
  console.log('ASOS SALE SCRAPER - Starting');
  console.log('Using puppeteer-extra with stealth plugin');
  console.log('==============================================\n');

  let browser;
  const allProducts = [];
  const startTime = Date.now();

  try {
    browser = await puppeteerExtra.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    console.log('Browser launched successfully\n');

    // Scrape each category - more pages for better coverage
    const categories = [
      { name: 'Women Sale', url: ASOS_SALE_URLS.women, pages: 5 },
      { name: 'Men Sale', url: ASOS_SALE_URLS.men, pages: 5 },
      { name: 'Women Shoes Sale', url: ASOS_SALE_URLS.womenShoes, pages: 3 },
      { name: 'Men Shoes Sale', url: ASOS_SALE_URLS.menShoes, pages: 3 }
    ];

    for (const cat of categories) {
      try {
        const products = await scrapeCategory(browser, cat.name, cat.url, cat.pages);
        allProducts.push(...products);
        console.log(`Total ${cat.name}: ${products.length} products\n`);

        // Delay between categories
        await delay(2000 + Math.random() * 2000);
      } catch (catError) {
        console.error(`Error scraping ${cat.name}:`, catError.message);
      }
    }

  } catch (error) {
    console.error('Browser error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
      console.log('\nBrowser closed');
    }
  }

  // Deduplicate products by URL
  const uniqueProducts = [];
  const seenUrls = new Set();

  for (const product of allProducts) {
    const key = product.productUrl || product.name;
    if (!seenUrls.has(key)) {
      seenUrls.add(key);
      uniqueProducts.push({
        id: `asos-${Date.now()}-${uniqueProducts.length}`,
        ...product,
        scrapedAt: new Date().toISOString()
      });
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n==============================================');
  console.log('SCRAPING COMPLETE');
  console.log('==============================================');
  console.log(`Total products scraped: ${allProducts.length}`);
  console.log(`Unique products: ${uniqueProducts.length}`);
  console.log(`Time elapsed: ${elapsed}s`);
  console.log('==============================================\n');

  return uniqueProducts;
}

// Main execution
async function main() {
  const outputPath = '/tmp/asos-products.json';

  try {
    const products = await scrapeAsosSale();

    // Save to JSON file
    const output = {
      scrapeDate: new Date().toISOString(),
      totalProducts: products.length,
      source: 'asos.com',
      categories: ['Women Sale', 'Men Sale', 'Women Shoes Sale', 'Men Shoes Sale'],
      products
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`Results saved to: ${outputPath}`);

    // Print sample products
    console.log('\n--- Sample Products ---');
    products.slice(0, 5).forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.name}`);
      console.log(`   Brand: ${p.brand}`);
      console.log(`   Original: $${p.originalPrice} -> Sale: $${p.salePrice} (${p.discount}% off)`);
      console.log(`   URL: ${p.productUrl?.substring(0, 70)}...`);
    });

    // Statistics
    const discountStats = {
      '10-20%': products.filter(p => p.discount >= 10 && p.discount < 20).length,
      '20-30%': products.filter(p => p.discount >= 20 && p.discount < 30).length,
      '30-50%': products.filter(p => p.discount >= 30 && p.discount < 50).length,
      '50%+': products.filter(p => p.discount >= 50).length
    };

    console.log('\n--- Discount Distribution ---');
    Object.entries(discountStats).forEach(([range, count]) => {
      console.log(`${range}: ${count} products`);
    });

    return products;
  } catch (error) {
    console.error('Scraper failed:', error);
    throw error;
  }
}

// Export for module use
module.exports = { scrapeAsosSale };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
