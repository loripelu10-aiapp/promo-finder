/**
 * Debug Uniqlo product count
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

  // Scroll multiple times
  for (let i = 0; i < 15; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 2000));
    console.log(`Scroll ${i + 1}`);
  }

  // Count all product links
  const counts = await page.evaluate(() => {
    return {
      allProductLinks: document.querySelectorAll('a[href*="/products/E"]').length,
      uniqueProductIds: [...new Set(
        Array.from(document.querySelectorAll('a[href*="/products/E"]'))
          .map(a => a.href.match(/\/products\/(E\d+-\d+)/)?.[1])
          .filter(Boolean)
      )].length,
      productTiles: document.querySelectorAll('a.fr-ec-product-tile').length,
      allTiles: document.querySelectorAll('.fr-ec-product-tile').length,
      carouselSlides: document.querySelectorAll('.fr-ec-carousel-slide').length,
      pageHeight: document.body.scrollHeight
    };
  });

  console.log('\n=== Product Counts ===');
  console.log('All product links:', counts.allProductLinks);
  console.log('Unique product IDs:', counts.uniqueProductIds);
  console.log('Product tiles (anchor):', counts.productTiles);
  console.log('All tiles:', counts.allTiles);
  console.log('Carousel slides:', counts.carouselSlides);
  console.log('Page height:', counts.pageHeight);

  // Check if there's a "load more" button or pagination
  const loadMore = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    const loadMoreButtons = [];
    buttons.forEach(b => {
      const text = b.textContent.toLowerCase();
      if (text.includes('load') || text.includes('more') || text.includes('show')) {
        loadMoreButtons.push(text.substring(0, 50));
      }
    });
    return loadMoreButtons;
  });

  console.log('\nLoad more buttons:', loadMore);

  // Check the page structure
  const structure = await page.evaluate(() => {
    const sections = document.querySelectorAll('section, [class*="section"], [class*="carousel"]');
    return Array.from(sections).slice(0, 10).map(s => ({
      tag: s.tagName,
      className: s.className?.substring(0, 80),
      productCount: s.querySelectorAll('a[href*="/products/"]').length
    }));
  });

  console.log('\nPage sections:');
  structure.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.tag} (${s.className}) - ${s.productCount} products`);
  });

  await browser.close();
}

debug().catch(console.error);
