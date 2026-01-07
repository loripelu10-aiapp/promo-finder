const puppeteer = require('puppeteer');

/**
 * Scraper universale Puppeteer per siti di moda
 * Approccio intelligente che si adatta a diverse strutture
 */

const SITES = [
  {
    name: 'Foot Locker',
    url: 'https://www.footlocker.it/it/category/sale.html',
    brand: 'Foot Locker',
    category: 'shoes'
  },
  {
    name: 'Decathlon',
    url: 'https://www.decathlon.it/saldi',
    brand: 'Decathlon',
    category: 'clothing'
  }
];

async function scrapeWithPuppeteer(siteConfig) {
  console.log(`🔍 Scraping ${siteConfig.name}...`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    const page = await browser.newPage();

    // Anti-detection
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    // Extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });

    console.log(`📄 Loading ${siteConfig.url}...`);
    await page.goto(siteConfig.url, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Aspetta un po' per caricamenti dinamici
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Scroll per triggerare lazy loading
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('✅ Page loaded, extracting products...');

    // Estrai TUTTI i link e immagini dalla pagina
    const products = await page.evaluate((brandName, defaultCategory) => {
      const items = [];

      // Strategia universale: cerca tutti i potenziali container di prodotti
      const selectors = [
        'article',
        '[data-testid*="product"]',
        '[class*="product-card"]',
        '[class*="ProductCard"]',
        '[class*="product-item"]',
        '[class*="product-tile"]',
        'li[class*="product"]',
        'div[class*="product-"]'
      ];

      let productElements = [];
      for (const selector of selectors) {
        const els = document.querySelectorAll(selector);
        if (els.length > 0) {
          productElements = Array.from(els);
          console.log(`Found ${els.length} products with selector: ${selector}`);
          break;
        }
      }

      // Se non trova container specifici, cerca pattern comuni
      if (productElements.length === 0) {
        // Cerca immagini con link
        const links = document.querySelectorAll('a[href*="product"], a[href*="/p/"], a[href*="/item/"]');
        productElements = Array.from(links);
      }

      productElements.forEach((el, index) => {
        if (index >= 15) return; // Limita a 15 per site

        try {
          // Link del prodotto
          let productUrl = '';
          const link = el.tagName === 'A' ? el : el.querySelector('a');
          if (link) {
            productUrl = link.href;
          }

          // Immagine
          let image = '';
          const img = el.querySelector('img');
          if (img) {
            image = img.src || img.dataset.src || img.getAttribute('data-original') || '';
            // Fix relative URLs
            if (image && !image.startsWith('http')) {
              image = new URL(image, window.location.origin).href;
            }
          }

          // Nome prodotto
          let name = '';
          const nameSelectors = ['h2', 'h3', 'h4', '[class*="name"]', '[class*="title"]', '[class*="Title"]'];
          for (const sel of nameSelectors) {
            const nameEl = el.querySelector(sel);
            if (nameEl && nameEl.textContent.trim()) {
              name = nameEl.textContent.trim();
              break;
            }
          }

          // Se non trova nome, usa alt dell'immagine
          if (!name && img) {
            name = img.alt || img.title || '';
          }

          // Prezzi
          const priceSelectors = [
            '[class*="price"]',
            '[class*="Price"]',
            '[data-testid*="price"]',
            'span[class*="sale"]',
            '.price-value',
            '.product-price'
          ];

          let priceElements = [];
          for (const sel of priceSelectors) {
            const els = el.querySelectorAll(sel);
            if (els.length > 0) {
              priceElements = Array.from(els);
              break;
            }
          }

          let originalPrice = 0;
          let salePrice = 0;

          if (priceElements.length > 0) {
            const prices = priceElements
              .map(p => {
                const text = p.textContent.replace(/[^\d,\.]/g, '').replace(',', '.');
                return parseFloat(text);
              })
              .filter(p => !isNaN(p) && p > 0);

            if (prices.length >= 2) {
              salePrice = Math.min(...prices);
              originalPrice = Math.max(...prices);
            } else if (prices.length === 1) {
              salePrice = prices[0];
              originalPrice = prices[0];
            }
          }

          const discount = originalPrice > 0 && salePrice < originalPrice
            ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
            : 0;

          // Solo prodotti validi
          if (name && productUrl && image && salePrice > 0) {
            items.push({
              brand: brandName,
              name: name.substring(0, 100),
              category: defaultCategory,
              originalPrice: originalPrice || salePrice,
              salePrice,
              discount,
              image,
              url: productUrl,
              source: new URL(productUrl).hostname.replace('www.', '')
            });
          }
        } catch (err) {
          // Skip errori per singoli prodotti
        }
      });

      return items;
    }, siteConfig.brand, siteConfig.category);

    console.log(`✅ ${siteConfig.name}: ${products.length} products found`);

    await browser.close();

    // Enrichment
    return products.map((p, i) => ({
      ...p,
      id: `${siteConfig.brand.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${i}`,
      isNew: p.discount >= 30,
      scrapedAt: new Date().toISOString()
    }));

  } catch (error) {
    console.error(`❌ ${siteConfig.name} error:`, error.message);
    if (browser) await browser.close();
    return [];
  }
}

async function scrapeAllSites() {
  console.log('🚀 Starting universal scraper for multiple sites...\n');

  const results = await Promise.allSettled(
    SITES.map(site => scrapeWithPuppeteer(site))
  );

  let allProducts = [];
  results.forEach((result, index) => {
    const siteName = SITES[index].name;
    if (result.status === 'fulfilled') {
      const products = result.value;
      console.log(`✅ ${siteName}: ${products.length} products`);
      allProducts = allProducts.concat(products);
    } else {
      console.error(`❌ ${siteName} failed:`, result.reason.message);
    }
  });

  console.log(`\n🎉 Total products scraped: ${allProducts.length}`);
  return allProducts;
}

module.exports = { scrapeAllSites, scrapeWithPuppeteer, SITES };
