const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
puppeteer.use(StealthPlugin());

const NIKE_SALE_CATEGORIES = [
  { url: 'https://www.nike.com/w/sale-3yaep', name: 'All Sale' },
  { url: 'https://www.nike.com/w/mens-sale-3yaepznik1', name: 'Men Sale' },
  { url: 'https://www.nike.com/w/womens-sale-3yaepz5e1x6', name: 'Women Sale' },
  { url: 'https://www.nike.com/w/kids-sale-3yaepzv4dh', name: 'Kids Sale' },
  { url: 'https://www.nike.com/w/sale-running-shoes-37v7jz3yaep', name: 'Running Sale' },
  { url: 'https://www.nike.com/w/sale-jordan-shoes-37eefz3yaepzy7ok', name: 'Jordan Sale' },
  { url: 'https://www.nike.com/w/sale-lifestyle-shoes-13jrmz3yaep', name: 'Lifestyle Sale' },
  { url: 'https://www.nike.com/w/sale-basketball-shoes-3glsmz3yaep', name: 'Basketball Sale' },
  { url: 'https://www.nike.com/w/sale-clothing-6ymx6z3yaep', name: 'Clothing Sale' },
  { url: 'https://www.nike.com/w/sale-accessories-equipment-3yaepzawwpw', name: 'Accessories Sale' }
];

async function scrapeNikeCategory(browser, categoryUrl, categoryName) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    console.log('Scraping:', categoryName);
    await page.goto(categoryUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    // Scroll to load more products
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
      await new Promise(r => setTimeout(r, 1500));
    }

    const products = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('.product-card').forEach((card, idx) => {
        try {
          const nameElement = card.querySelector('.product-card__title, .product-card__subtitle');
          const name = nameElement ? nameElement.textContent.trim() : '';
          const linkElement = card.querySelector('a.product-card__link-overlay, a[href*="/t/"]');
          const link = linkElement ? linkElement.href : '';
          const imgElement = card.querySelector('img');
          const img = imgElement ? (imgElement.src || imgElement.dataset.src) : '';

          // Get prices - Nike specific selectors
          const salePriceElement = card.querySelector('[data-testid="product-price-reduced"]');
          const originalPriceElement = card.querySelector('.is--striked-out');

          let originalPrice = 0, salePrice = 0;

          if (salePriceElement && originalPriceElement) {
            const saleText = salePriceElement.textContent || '';
            const origText = originalPriceElement.textContent || '';
            const saleMatch = saleText.match(/[\d.]+/);
            const origMatch = origText.match(/[\d.]+/);
            if (saleMatch) salePrice = parseFloat(saleMatch[0]);
            if (origMatch) originalPrice = parseFloat(origMatch[0]);
          }

          if (name && link && img && salePrice > 0 && originalPrice > salePrice) {
            items.push({ name, url: link, image: img, originalPrice, salePrice });
          }
        } catch(e) {}
      });
      return items;
    });

    await page.close();
    return products.map(p => ({
      id: 'nike-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      name: p.name,
      brand: 'Nike',
      merchant: 'nike',
      merchantName: 'Nike',
      originalPrice: p.originalPrice || Math.round(p.salePrice * 1.35),
      salePrice: p.salePrice,
      discount: p.originalPrice ? Math.round((1 - p.salePrice / p.originalPrice) * 100) : 25,
      currency: 'USD',
      image: p.image,
      affiliateUrl: p.url,
      category: categoryName.toLowerCase().replace(' sale', ''),
      inStock: true,
      commission: '11%',
      lastUpdated: new Date().toISOString()
    }));
  } catch (e) {
    console.log('Error in', categoryName, ':', e.message);
    await page.close();
    return [];
  }
}

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });

  const allProducts = [];

  for (const cat of NIKE_SALE_CATEGORIES) {
    const products = await scrapeNikeCategory(browser, cat.url, cat.name);
    console.log(cat.name + ':', products.length, 'products');
    allProducts.push(...products);
    await new Promise(r => setTimeout(r, 2000)); // Rate limiting
  }

  await browser.close();

  // Deduplicate by URL
  const seen = new Set();
  const unique = allProducts.filter(p => {
    if (seen.has(p.affiliateUrl)) return false;
    seen.add(p.affiliateUrl);
    return true;
  });

  console.log('\nTotal unique Nike products:', unique.length);
  fs.writeFileSync('/tmp/nike-expanded.json', JSON.stringify(unique, null, 2));
  console.log('Saved to /tmp/nike-expanded.json');
}

main().catch(console.error);
