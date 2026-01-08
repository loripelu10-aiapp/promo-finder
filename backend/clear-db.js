const prisma = require('./db/client');

async function clearDatabase() {
  console.log('🗑️  Clearing all products from database...\n');

  try {
    const deleted = await prisma.product.deleteMany({});
    console.log(`✅ Deleted ${deleted.count} products\n`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

clearDatabase();
