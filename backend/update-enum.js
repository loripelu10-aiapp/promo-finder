const prisma = require('./db/client');

async function updateEnum() {
  try {
    console.log('Adding footlocker and decathlon to ProductSource enum...\n');

    await prisma.$executeRawUnsafe(`
      ALTER TYPE "ProductSource" ADD VALUE IF NOT EXISTS 'footlocker';
    `);

    console.log('✅ Added footlocker to enum');

    await prisma.$executeRawUnsafe(`
      ALTER TYPE "ProductSource" ADD VALUE IF NOT EXISTS 'decathlon';
    `);

    console.log('✅ Added decathlon to enum\n');
    console.log('Enum update complete!');

  } catch (error) {
    console.error('Error updating enum:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

updateEnum();
