const prisma = require('./db/client');
const axios = require('axios');

async function testAllImages() {
  console.log('🖼️  Testing ALL product images...\n');

  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        imageUrl: true,
        source: true
      }
    });

    console.log(`Testing ${products.length} product images...\n`);

    const results = {
      working: [],
      broken: []
    };

    for (const product of products) {
      try {
        const response = await axios.head(product.imageUrl, {
          timeout: 5000,
          maxRedirects: 5,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        const contentType = response.headers['content-type'];
        const isImage = contentType && contentType.startsWith('image/');

        if (response.status === 200 && isImage) {
          results.working.push(product);
          process.stdout.write('.');
        } else {
          results.broken.push({ ...product, reason: `Invalid: ${contentType}` });
          console.log(`\n❌ ${product.name.substring(0, 40)} (${product.source}) - ${contentType}`);
        }
      } catch (error) {
        results.broken.push({ ...product, reason: error.message });
        console.log(`\n❌ ${product.name.substring(0, 40)} (${product.source}) - ${error.message}`);
      }
    }

    console.log(`\n\n📊 Image Validation Results:`);
    console.log(`   ✅ Working: ${results.working.length}/${products.length}`);
    console.log(`   ❌ Broken: ${results.broken.length}/${products.length}`);

    // Group by source
    const bySource = {};
    results.broken.forEach(p => {
      if (!bySource[p.source]) bySource[p.source] = [];
      bySource[p.source].push(p);
    });

    if (results.broken.length > 0) {
      console.log(`\n💔 Broken images by source:`);
      Object.entries(bySource).forEach(([source, items]) => {
        console.log(`   ${source}: ${items.length} broken`);
      });

      console.log(`\n🗑️  Deleting ${results.broken.length} products with broken images...`);

      const deleted = await prisma.product.deleteMany({
        where: {
          id: {
            in: results.broken.map(p => p.id)
          }
        }
      });

      console.log(`✅ Deleted ${deleted.count} products`);

      const remaining = await prisma.product.count();
      console.log(`📦 Remaining products: ${remaining}\n`);
    } else {
      console.log(`\n🎉 All images are working!\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testAllImages();
