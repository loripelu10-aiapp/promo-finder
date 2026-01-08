const { scrapeHMPuppeteer } = require('./scrapers/hm-puppeteer');

async function test() {
  console.log('🧪 Testing Puppeteer H&M scraper...\n');

  const products = await scrapeHMPuppeteer();

  console.log('\n📊 Results:');
  console.log(`Total products: ${products.length}`);

  if (products.length > 0) {
    console.log('\n🔍 First 3 products:');
    products.slice(0, 3).forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.name}`);
      console.log(`   Brand: ${p.brand}`);
      console.log(`   Price: €${p.salePrice} (was €${p.originalPrice}) - ${p.discount}% OFF`);
      console.log(`   URL: ${p.url}`);
      console.log(`   Image: ${p.image.substring(0, 80)}...`);
    });
  }
}

test();
