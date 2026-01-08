const prisma = require('./db/client');
const axios = require('axios');

async function testImages() {
  console.log('🖼️  Testing product images...\n');

  try {
    // Get random sample of products
    const products = await prisma.product.findMany({
      take: 10,
      select: {
        id: true,
        name: true,
        imageUrl: true,
        source: true
      }
    });

    console.log(`Testing ${products.length} random product images...\n`);

    const results = {
      working: [],
      broken: []
    };

    for (const product of products) {
      try {
        const response = await axios.head(product.imageUrl, {
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        const contentType = response.headers['content-type'];
        const isImage = contentType && contentType.startsWith('image/');

        if (response.status === 200 && isImage) {
          results.working.push(product);
          console.log(`✅ ${product.name.substring(0, 40)} (${product.source})`);
        } else {
          results.broken.push({ ...product, reason: `Invalid content-type: ${contentType}` });
          console.log(`❌ ${product.name.substring(0, 40)} - Not an image (${contentType})`);
        }
      } catch (error) {
        results.broken.push({ ...product, reason: error.message });
        console.log(`❌ ${product.name.substring(0, 40)} - ${error.message}`);
      }
    }

    console.log(`\n📊 Results:`);
    console.log(`   ✅ Working images: ${results.working.length}/${products.length}`);
    console.log(`   ❌ Broken images: ${results.broken.length}/${products.length}`);

    if (results.broken.length > 0) {
      console.log(`\n🗑️  Removing ${results.broken.length} products with broken images...`);

      const deleted = await prisma.product.deleteMany({
        where: {
          id: {
            in: results.broken.map(p => p.id)
          }
        }
      });

      console.log(`✅ Deleted ${deleted.count} products\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testImages();
