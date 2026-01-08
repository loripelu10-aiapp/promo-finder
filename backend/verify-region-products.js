/**
 * Verify Region-Tagged Products in Database
 */

const ProductStorageService = require('./services/product-storage');

async function verifyProducts() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 VERIFYING REGION-TAGGED PRODUCTS IN DATABASE');
  console.log('='.repeat(80) + '\n');

  const storageService = new ProductStorageService();

  try {
    // Get all products
    const allProducts = await storageService.getAllProducts();
    console.log(`✅ Total products in database: ${allProducts.length}\n`);

    // Get by region
    const regions = ['EU', 'UK', 'US', 'GLOBAL'];

    console.log('📍 Products by Region:');
    console.log('-'.repeat(80));

    for (const region of regions) {
      const products = await storageService.getProductsByRegion(region);
      console.log(`   ${region.padEnd(10)}: ${products.length} products`);
    }

    // Get products for different user locations
    console.log('\n🌍 Products Visible to Users by Location:');
    console.log('-'.repeat(80));

    const euUserProducts = await storageService.getProductsByRegions(['EU', 'GLOBAL']);
    console.log(`   EU users (EU + GLOBAL)     : ${euUserProducts.length} products`);

    const ukUserProducts = await storageService.getProductsByRegions(['UK', 'GLOBAL']);
    console.log(`   UK users (UK + GLOBAL)     : ${ukUserProducts.length} products`);

    const usUserProducts = await storageService.getProductsByRegions(['US', 'GLOBAL']);
    console.log(`   US users (US + GLOBAL)     : ${usUserProducts.length} products`);

    // Show sample products
    console.log('\n📦 Sample Products with Region Tags:');
    console.log('-'.repeat(80));

    allProducts.slice(0, 10).forEach((p, i) => {
      const price = p.currency === 'GBP' ? `£${p.salePrice}` : `$${p.salePrice}`;
      console.log(`\n${i + 1}. ${p.brand} - ${p.name}`);
      console.log(`   Price: ${price} (${p.discountPercentage}% off)`);
      console.log(`   Regions: ${p.availableRegions.join(', ')}`);
      console.log(`   Currency: ${p.currency}`);
      console.log(`   Source: ${p.source}`);
    });

    // Currency breakdown
    console.log('\n💱 Currency Distribution:');
    console.log('-'.repeat(80));

    const usdProducts = allProducts.filter(p => p.currency === 'USD');
    const gbpProducts = allProducts.filter(p => p.currency === 'GBP');
    const eurProducts = allProducts.filter(p => p.currency === 'EUR');

    console.log(`   USD: ${usdProducts.length} products`);
    console.log(`   GBP: ${gbpProducts.length} products`);
    console.log(`   EUR: ${eurProducts.length} products`);

    // Source breakdown
    console.log('\n🏪 Source Distribution:');
    console.log('-'.repeat(80));

    const sourceBreakdown = allProducts.reduce((acc, p) => {
      acc[p.source] = (acc[p.source] || 0) + 1;
      return acc;
    }, {});

    Object.entries(sourceBreakdown).forEach(([source, count]) => {
      console.log(`   ${source.padEnd(20)}: ${count} products`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ VERIFICATION COMPLETE');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n💥 Error:', error);
    console.error(error.stack);
  } finally {
    await storageService.disconnect();
    process.exit(0);
  }
}

verifyProducts().catch(error => {
  console.error('\n💥 Unhandled error:', error);
  process.exit(1);
});
