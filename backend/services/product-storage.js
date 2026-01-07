// Use existing Prisma client singleton from db/client.ts
const prisma = require('../db/client');

/**
 * Product Storage Service
 *
 * Stores scraped products in database with region tags
 */
class ProductStorageService {
  constructor() {
    this.prisma = prisma.default || prisma;
  }

  /**
   * Store products from scrapers with region support
   *
   * @param {Array} products - Array of scraped products
   * @param {Object} options - Storage options
   * @returns {Object} - Storage result stats
   */
  async storeProducts(products, options = {}) {
    const {
      updateExisting = true,
      batchSize = 50
    } = options;

    console.log(`\n📦 Storing ${products.length} products in database...`);

    const stats = {
      total: products.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    // Process in batches
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      console.log(`\n   Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(products.length / batchSize)} (${batch.length} products)...`);

      for (const product of batch) {
        try {
          // Map scraper product to database schema
          const productData = this.mapProductData(product);

          // Check if product exists by URL
          const existing = await this.prisma.product.findFirst({
            where: { productUrl: productData.productUrl }
          });

          if (existing) {
            if (updateExisting) {
              // Update existing product
              await this.prisma.product.update({
                where: { id: existing.id },
                data: {
                  ...productData,
                  updatedAt: new Date()
                }
              });
              stats.updated++;
              console.log(`   ✅ Updated: ${product.name}`);
            } else {
              stats.skipped++;
              console.log(`   ⏭️  Skipped (exists): ${product.name}`);
            }
          } else {
            // Create new product
            await this.prisma.product.create({
              data: productData
            });
            stats.created++;
            console.log(`   ✅ Created: ${product.name}`);
          }

        } catch (error) {
          stats.errors.push({
            product: product.name,
            error: error.message
          });
          console.error(`   ❌ Error storing ${product.name}: ${error.message}`);
        }
      }
    }

    console.log(`\n📊 Storage complete:`);
    console.log(`   Created: ${stats.created}`);
    console.log(`   Updated: ${stats.updated}`);
    console.log(`   Skipped: ${stats.skipped}`);
    console.log(`   Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log(`\n❌ Errors:`);
      stats.errors.forEach(e => console.log(`   - ${e.product}: ${e.error}`));
    }

    return stats;
  }

  /**
   * Map scraper product format to database schema
   */
  mapProductData(product) {
    // Map source to ProductSource enum
    const sourceMap = {
      'nike.com': 'nike',
      'footlocker.co.uk': 'manual', // Or create new enum value
      'jdsports.co.uk': 'manual',
      'sportsdirect.com': 'manual'
    };

    // Map category to ProductCategory enum
    const categoryMap = {
      'shoes': 'shoes',
      'clothing': 'clothing',
      'bags': 'bags',
      'accessories': 'accessories',
      'other': 'other'
    };

    return {
      name: product.name,
      brand: product.brand,
      category: categoryMap[product.category] || 'other',
      source: sourceMap[product.source] || 'manual',

      originalPrice: product.originalPrice,
      salePrice: product.salePrice,
      discountPercentage: product.discount,
      currency: product.currency || 'USD',

      // CRITICAL: Region support
      availableRegions: product.availableRegions || ['EU'],

      productUrl: product.url,
      imageUrl: product.image,

      confidenceScore: 70, // Default, will be updated by validation
      isActive: true,
      isNew: true,

      attributes: {},
      description: null
    };
  }

  /**
   * Get products by region
   */
  async getProductsByRegion(region) {
    return await this.prisma.product.findMany({
      where: {
        availableRegions: {
          has: region
        },
        isActive: true
      },
      orderBy: {
        discountPercentage: 'desc'
      }
    });
  }

  /**
   * Get products available in multiple regions (e.g., EU OR GLOBAL)
   */
  async getProductsByRegions(regions) {
    return await this.prisma.product.findMany({
      where: {
        availableRegions: {
          hasSome: regions
        },
        isActive: true
      },
      orderBy: {
        discountPercentage: 'desc'
      }
    });
  }

  /**
   * Get all active products with region info
   */
  async getAllProducts() {
    return await this.prisma.product.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        discountPercentage: 'desc'
      }
    });
  }

  /**
   * Close database connection
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}

module.exports = ProductStorageService;
