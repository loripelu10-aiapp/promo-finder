const prisma = require('./db/client');

async function verifyProducts() {
  console.log('🔍 Verifying all products...\n');

  try {
    // Get all products
    const products = await prisma.product.findMany();

    console.log(`📦 Total products: ${products.length}\n`);

    // Check for missing images
    const noImage = products.filter(p => !p.imageUrl || p.imageUrl.trim() === '');
    console.log(`❌ Products without images: ${noImage.length}`);
    if (noImage.length > 0) {
      noImage.forEach(p => {
        console.log(`   - ${p.name} (${p.source})`);
      });
    }

    // Check for invalid discounts
    const invalidDiscount = products.filter(p => p.originalPrice <= p.salePrice);
    console.log(`\n❌ Products with invalid discounts: ${invalidDiscount.length}`);
    if (invalidDiscount.length > 0) {
      invalidDiscount.forEach(p => {
        console.log(`   - ${p.name}: £${p.salePrice} >= £${p.originalPrice} (${p.source})`);
      });
    }

    // Check for zero/negative discounts
    const noDiscount = products.filter(p => p.discountPercentage <= 0);
    console.log(`\n❌ Products with 0% or negative discount: ${noDiscount.length}`);
    if (noDiscount.length > 0) {
      noDiscount.forEach(p => {
        console.log(`   - ${p.name}: ${p.discountPercentage}% (${p.source})`);
      });
    }

    // Products to remove
    const toRemove = new Set();
    noImage.forEach(p => toRemove.add(p.id));
    invalidDiscount.forEach(p => toRemove.add(p.id));
    noDiscount.forEach(p => toRemove.add(p.id));

    console.log(`\n🗑️  Total products to remove: ${toRemove.size}`);

    if (toRemove.size > 0) {
      console.log('\n⚠️  These products will be DELETED from database.');
      console.log('Continue? (This script will delete them automatically)\n');

      // Delete invalid products
      const deleted = await prisma.product.deleteMany({
        where: {
          id: {
            in: Array.from(toRemove)
          }
        }
      });

      console.log(`✅ Deleted ${deleted.count} invalid products\n`);
    }

    // Show final stats
    const remaining = await prisma.product.count();
    console.log(`📊 Final product count: ${remaining}`);

    // Verify all remaining have images and discounts
    const validProducts = await prisma.product.findMany({
      where: {
        AND: [
          { imageUrl: { not: null } },
          { imageUrl: { not: '' } },
          { discountPercentage: { gt: 0 } },
          { originalPrice: { gt: prisma.product.fields.salePrice } }
        ]
      }
    });

    console.log(`✅ Valid products (image + discount): ${validProducts.length}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyProducts();
