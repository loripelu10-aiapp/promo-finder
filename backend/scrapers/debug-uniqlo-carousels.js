/**
 * Debug Uniqlo carousel structure
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debug() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  await page.setViewport({ width: 1920, height: 1080 });

  console.log('Loading sale page...');
  await page.goto('https://www.uniqlo.com/us/en/feature/sale/women', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await new Promise(r => setTimeout(r, 5000));

  // Scroll to load all carousels
  for (let i = 0; i < 15; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 1500));
  }

  // Analyze carousel structure
  const carouselInfo = await page.evaluate(() => {
    const carousels = document.querySelectorAll('.fr-ec-carousel, [class*="product-collection"]');
    const results = [];

    carousels.forEach((carousel, i) => {
      const productLinks = carousel.querySelectorAll('a[href*="/products/E"]');
      const uniqueIds = [...new Set(
        Array.from(productLinks)
          .map(a => a.href.match(/\/products\/(E\d+-\d+)/)?.[1])
          .filter(Boolean)
      )];

      // Get heading if available
      const heading = carousel.closest('section')?.querySelector('h2, h3, .heading');

      results.push({
        index: i,
        totalLinks: productLinks.length,
        uniqueProducts: uniqueIds.length,
        heading: heading?.textContent?.trim().substring(0, 50) || 'No heading',
        firstProducts: uniqueIds.slice(0, 3)
      });
    });

    return results;
  });

  console.log('\n=== Carousel Analysis ===');
  let totalUniqueProducts = 0;
  carouselInfo.forEach(c => {
    console.log(`\nCarousel ${c.index + 1}: ${c.heading}`);
    console.log(`  Links: ${c.totalLinks}, Unique products: ${c.uniqueProducts}`);
    console.log(`  Sample IDs: ${c.firstProducts.join(', ')}`);
    totalUniqueProducts += c.uniqueProducts;
  });
  console.log(`\nTotal products across all carousels: ${totalUniqueProducts}`);

  // Get all product names and prices
  const allProducts = await page.evaluate(() => {
    const products = [];
    const seenIds = new Set();

    document.querySelectorAll('a[href*="/products/E"]').forEach(tile => {
      const href = tile.href || '';
      const match = href.match(/\/products\/(E\d+-\d+)/);
      if (!match) return;

      const productId = match[1];
      if (seenIds.has(productId)) return;
      seenIds.add(productId);

      const nameEl = tile.querySelector('h3, .fr-ec-title');
      const name = nameEl?.textContent?.trim() || '';

      const priceEl = tile.querySelector('.fr-ec-price-text');
      const priceText = priceEl?.textContent?.trim() || '';
      const priceMatch = priceText.match(/\$?([\d.]+)/);
      const price = priceMatch ? parseFloat(priceMatch[1]) : null;

      const imgEl = tile.querySelector('img[src*="image.uniqlo.com"]');
      const image = imgEl?.src || '';

      if (name && price) {
        products.push({ productId, name, price, image: !!image });
      }
    });

    return products;
  });

  console.log(`\n=== All Products (${allProducts.length}) ===`);
  allProducts.slice(0, 20).forEach((p, i) => {
    console.log(`${i + 1}. ${p.name} - $${p.price} (${p.productId})`);
  });

  if (allProducts.length > 20) {
    console.log(`... and ${allProducts.length - 20} more products`);
  }

  await browser.close();
}

debug().catch(console.error);
