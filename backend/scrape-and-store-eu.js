/**
 * Scrape EU Products and Store in Database
 *
 * 1. Scrapes Nike (GLOBAL)
 * 2. Scrapes Foot Locker UK (EU/UK)
 * 3. Stores all products with region tags
 * 4. Verifies storage
 */

const NikeScraper = require('./scrapers/brands/nike-puppeteer');
const FootLockerUKScraper = require('./scrapers/eu-retailers/footlocker-uk');
const ProductStorageService = require('./services/product-storage');

async function scrapeAndStoreEU() {
  console.log('\n' + '='.repeat(80));
  console.log('🌍 EU PRODUCT SCRAPING & STORAGE');
  console.log('='.repeat(80));
  console.log('\nThis will:');
  console.log('  1. Scrape Nike products (GLOBAL region)');
  console.log('  2. Scrape Foot Locker UK products (EU/UK region)');
  console.log('  3. Store all products in database with region tags');
  console.log('  4. Verify stored products\n');
  console.log('='.repeat(80) + '\n');

  const allProducts = [];
  const storageService = new ProductStorageService();

  try {
    // Step 1: Scrape Nike (GLOBAL)
    console.log('📋 STEP 1: Scraping Nike (GLOBAL)');
    console.log('-'.repeat(80));

    try {
      const nikeScraper = new NikeScraper({
        headless: true,
        maxProducts: 15
      });

      const nikeProducts = await nikeScraper.scrape();
      console.log(`✅ Scraped ${nikeProducts.length} Nike products`);
      console.log(`   Regions: ${nikeProducts[0]?.availableRegions.join(', ')}`);
      console.log(`   Currency: ${nikeProducts[0]?.currency}\n`);

      allProducts.push(...nikeProducts);
    } catch (error) {
      console.error(`❌ Nike scraping failed: ${error.message}\n`);
    }

    // Step 2: Scrape Foot Locker UK (EU/UK)
    console.log('\n📋 STEP 2: Scraping Foot Locker UK (EU/UK)');
    console.log('-'.repeat(80));

    try {
      const footlockerScraper = new FootLockerUKScraper({
        headless: true,
        maxProducts: 15
      });

      const footlockerProducts = await footlockerScraper.searchBrand('adidas', 'trainers');
      console.log(`✅ Scraped ${footlockerProducts.length} Foot Locker UK products`);
      console.log(`   Regions: ${footlockerProducts[0]?.availableRegions.join(', ')}`);
      console.log(`   Currency: ${footlockerProducts[0]?.currency}\n`);

      allProducts.push(...footlockerProducts);
    } catch (error) {
      console.error(`❌ Foot Locker UK scraping failed: ${error.message}\n`);
    }

    // Step 3: Store products in database
    console.log('\n📋 STEP 3: Storing Products in Database');
    console.log('-'.repeat(80));

    if (allProducts.length === 0) {
      console.log('❌ No products to store!');
      process.exit(1);
    }

    const storageStats = await storageService.storeProducts(allProducts, {
      updateExisting: true,
      batchSize: 10
    });

    // Step 4: Verify stored products
    console.log('\n📋 STEP 4: Verifying Stored Products');
    console.log('-'.repeat(80));

    // Get all products
    const allStoredProducts = await storageService.getAllProducts();
    console.log(`\n✅ Total products in database: ${allStoredProducts.length}`);

    // Get by region
    const euProducts = await storageService.getProductsByRegion('EU');
    console.log(`✅ EU products: ${euProducts.length}`);

    const ukProducts = await storageService.getProductsByRegion('UK');
    console.log(`✅ UK products: ${ukProducts.length}`);

    const usProducts = await storageService.getProductsByRegion('US');
    console.log(`✅ US products: ${usProducts.length}`);

    const globalProducts = await storageService.getProductsByRegion('GLOBAL');
    console.log(`✅ GLOBAL products: ${globalProducts.length}`);

    // Get products for EU users (EU + GLOBAL)
    const euUserProducts = await storageService.getProductsByRegions(['EU', 'GLOBAL']);
    console.log(`\n🌍 Products visible to EU users (EU + GLOBAL): ${euUserProducts.length}`);

    // Show sample products
    console.log('\n📋 Sample Stored Products:\n');

    allStoredProducts.slice(0, 10).forEach((p, i) => {
      const price = p.currency === 'GBP' ? `£${p.salePrice}` : `$${p.salePrice}`;
      console.log(`${i + 1}. [${p.brand}] ${p.name}`);
      console.log(`   ${price} (${p.discountPercentage}% off)`);
      console.log(`   Regions: ${p.availableRegions.join(', ')}`);
      console.log(`   Source: ${p.source}`);
      console.log(`   DB ID: ${p.id}`);
      console.log('');
    });

    // Final summary
    console.log('='.repeat(80));
    console.log('✅ SUCCESS: EU Products Scraped and Stored!');
    console.log('='.repeat(80));

    console.log(`\n📊 Summary:`);
    console.log(`   Scraped: ${allProducts.length} products`);
    console.log(`   Created: ${storageStats.created} new products`);
    console.log(`   Updated: ${storageStats.updated} existing products`);
    console.log(`   Errors: ${storageStats.errors.length}`);

    console.log(`\n🌍 Region Distribution:`);
    console.log(`   EU: ${euProducts.length} products`);
    console.log(`   UK: ${ukProducts.length} products`);
    console.log(`   US: ${usProducts.length} products`);
    console.log(`   GLOBAL: ${globalProducts.length} products`);

    console.log(`\n💡 User Experience:`);
    console.log(`   EU users will see: ${euUserProducts.length} products (EU + GLOBAL)`);
    console.log(`   UK users will see: ${ukProducts.length} products (UK + GLOBAL)`);
    console.log(`   US users will see: ${usProducts.length} products (US + GLOBAL)`);

    console.log(`\n🎯 Next Steps:`);
    console.log(`   1. Create API endpoint: GET /api/deals?region=EU`);
    console.log(`   2. Add frontend location detection`);
    console.log(`   3. Test with real users in different regions`);
    console.log(`   4. Add more EU retailers (JD Sports, Sports Direct)`);
    console.log(`   5. Add US region with proxy`);
    console.log('');

  } catch (error) {
    console.error('\n💥 Fatal error:', error);
    console.error(error.stack);
  } finally {
    await storageService.disconnect();
    process.exit(0);
  }
}

scrapeAndStoreEU().catch(error => {
  console.error('\n💥 Unhandled error:', error);
  process.exit(1);
});
