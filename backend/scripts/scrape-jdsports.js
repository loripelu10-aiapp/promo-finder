#!/usr/bin/env node

const JDSportsUKScraper = require('../scrapers/eu-retailers/jdsports-uk');

async function main() {
  console.log('\n========== JD SPORTS UK SCRAPING ==========\n');
  console.log('Looking for Adidas products...\n');

  try {
    const scraper = new JDSportsUKScraper({ maxProducts: 15, timeout: 45000 });

    // Just search for Adidas
    const products = await scraper.searchBrand('adidas', 'trainers');

    console.log(`\n========== RESULTS: ${products.length} products ==========\n`);

    if (products.length > 0) {
      const formatted = products.map((p, i) => ({
        id: `adidas-${String(i + 1).padStart(3, '0')}`,
        name: p.name,
        brand: 'Adidas',
        merchant: 'jdsports',
        merchantName: 'JD Sports',
        merchantLogo: 'https://upload.wikimedia.org/wikipedia/commons/8/80/JD_Sports_logo.svg',
        merchantColor: '#000000',
        originalPrice: p.originalPrice,
        salePrice: p.salePrice,
        discount: p.discount,
        currency: 'GBP',
        image: p.image,
        affiliateUrl: p.url,
        category: p.category || 'shoes',
        inStock: true,
        commission: '4%',
        lastUpdated: new Date().toISOString()
      }));

      console.log(JSON.stringify(formatted, null, 2));
    }
  } catch (error) {
    console.error('Failed:', error.message);
  }
}

main().catch(console.error);
