#!/usr/bin/env node

const AdidasScraper = require('../scrapers/brands/adidas-puppeteer');
const ZaraEUScraper = require('../scrapers/eu-retailers/zara-eu');

async function main() {
  const allProducts = [];

  // Scrape Adidas
  console.log('\n========== ADIDAS SCRAPING ==========\n');
  try {
    const adidasScraper = new AdidasScraper({ maxProducts: 15 });
    const adidasProducts = await adidasScraper.scrape();

    // Format for products.json
    const formattedAdidas = adidasProducts.map((p, i) => ({
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

    allProducts.push(...formattedAdidas);
    console.log(`\nGot ${formattedAdidas.length} Adidas products`);
  } catch (error) {
    console.error('Adidas scraping failed:', error.message);
  }

  // Scrape Zara
  console.log('\n========== ZARA SCRAPING ==========\n');
  try {
    const zaraScraper = new ZaraEUScraper({ maxProducts: 15 });
    const zaraProducts = await zaraScraper.scrape();

    // Format for products.json
    const formattedZara = zaraProducts.map((p, i) => ({
      id: `zara-${String(i + 1).padStart(3, '0')}`,
      name: p.name,
      brand: 'Zara',
      merchant: 'zara',
      merchantName: 'Zara',
      merchantLogo: 'https://upload.wikimedia.org/wikipedia/commons/f/fd/Zara_Logo.svg',
      merchantColor: '#000000',
      originalPrice: p.originalPrice,
      salePrice: p.salePrice,
      discount: p.discount,
      currency: 'EUR',
      image: p.image,
      affiliateUrl: p.url,
      category: p.category || 'shoes',
      inStock: true,
      commission: '5%',
      lastUpdated: new Date().toISOString()
    }));

    allProducts.push(...formattedZara);
    console.log(`\nGot ${formattedZara.length} Zara products`);
  } catch (error) {
    console.error('Zara scraping failed:', error.message);
  }

  // Output results
  console.log('\n========== RESULTS ==========\n');
  console.log(JSON.stringify(allProducts, null, 2));
}

main().catch(console.error);
