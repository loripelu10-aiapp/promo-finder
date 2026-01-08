const { scrapeAllSites } = require('./scrapers/universal-puppeteer');

async function test() {
  const products = await scrapeAllSites();

  if (products.length > 0) {
    console.log('\n📦 Sample products:\n');
    products.slice(0, 5).forEach((p, i) => {
      console.log(`${i + 1}. ${p.name}`);
      console.log(`   ${p.brand} | €${p.salePrice} (was €${p.originalPrice}) - ${p.discount}% OFF`);
      console.log(`   🔗 ${p.url}`);
      console.log(`   🖼️  ${p.image.substring(0, 60)}...`);
      console.log('');
    });
  } else {
    console.log('\n⚠️  No products found');
  }
}

test().catch(console.error);
