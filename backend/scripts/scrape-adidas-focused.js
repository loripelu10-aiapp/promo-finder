#!/usr/bin/env node

const AdidasOutletFocused = require('../scrapers/brands/adidas-outlet-focused');

async function main() {
  console.log('\n========== ADIDAS OUTLET FOCUSED SCRAPING ==========\n');

  try {
    const scraper = new AdidasOutletFocused({ maxProducts: 15 });
    const products = await scraper.scrape();

    console.log(`\n========== RESULTS: ${products.length} products ==========\n`);

    if (products.length > 0) {
      const formatted = products.map((p, i) => ({
        id: `adidas-${String(i + 1).padStart(3, '0')}`,
        name: p.name,
        brand: 'Adidas',
        merchant: 'adidas',
        merchantName: 'Adidas',
        merchantLogo: 'https://upload.wikimedia.org/wikipedia/commons/2/20/Adidas_Logo.svg',
        merchantColor: '#000000',
        originalPrice: p.originalPrice,
        salePrice: p.salePrice,
        discount: p.discount,
        currency: 'USD',
        image: p.image,
        affiliateUrl: p.url,
        category: p.category || 'shoes',
        inStock: true,
        commission: '6%',
        lastUpdated: new Date().toISOString()
      }));

      console.log(JSON.stringify(formatted, null, 2));
    }
  } catch (error) {
    console.error('Failed:', error.message);
  }
}

main().catch(console.error);
