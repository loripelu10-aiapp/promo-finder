const HMEUScraper = require('./scrapers/eu-retailers/hm-eu');
const prisma = require('./db/client');

async function scrapeAllHMCategories() {
  console.log('🔍 Scraping H&M EU - All Sale Categories...\n');

  const categories = [
    { url: 'https://www2.hm.com/en_gb/ladies/sale/shoes.html', name: "Women's Shoes" },
    { url: 'https://www2.hm.com/en_gb/ladies/sale/view-all.html', name: "Women's All Sale" },
    { url: 'https://www2.hm.com/en_gb/men/sale/shoes.html', name: "Men's Shoes" },
    { url: 'https://www2.hm.com/en_gb/men/sale/view-all.html', name: "Men's All Sale" }
  ];

  let totalStored = 0;

  for (const category of categories) {
    console.log(`\n📦 Category: ${category.name}`);
    console.log(`🔗 URL: ${category.url}\n`);

    try {
      const scraper = new HMEUScraper({ maxProducts: 50 });

      // Override the scrape URL
      scraper.scrapeUrl = category.url;

      const products = await scraper.scrape();

      console.log(`✅ Extracted ${products.length} products from ${category.name}`);

      // Store products
      for (const product of products) {
        try {
          // Check if already exists
          const existing = await prisma.product.findFirst({
            where: { productUrl: product.url }
          });

          if (!existing) {
            await prisma.product.create({
              data: {
                name: product.name,
                brand: product.brand,
                category: product.category,
                originalPrice: product.originalPrice,
                salePrice: product.salePrice,
                discountPercentage: product.discount,
                currency: product.currency,
                imageUrl: product.image,
                productUrl: product.url,
                source: 'hm',
                availableRegions: product.availableRegions || ['EU', 'UK', 'FR', 'DE', 'IT', 'ES']
              }
            });
            totalStored++;
          }
        } catch (error) {
          console.log(`   ⚠️  Failed to store: ${error.message}`);
        }
      }

      console.log(`💾 Stored ${totalStored} new products so far\n`);

      // Delay between categories
      await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (error) {
      console.error(`❌ Error scraping ${category.name}:`, error.message);
    }
  }

  const total = await prisma.product.count();
  console.log(`\n✅ COMPLETE! Total products in database: ${total}\n`);

  await prisma.$disconnect();
  process.exit(0);
}

scrapeAllHMCategories();
