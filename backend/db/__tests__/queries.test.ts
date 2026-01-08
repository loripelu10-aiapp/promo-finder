import { PrismaClient, ProductCategory, ProductSource } from '@prisma/client';
import {
  findActiveDeals,
  findById,
  updateConfidenceScore,
  bulkInsertProducts,
  getTopDealsByCategory,
  recordInteraction,
  findProductsNeedingVerification,
  getStatsBySource,
  ProductInput,
} from '../queries';

const prisma = new PrismaClient();

// Test data
const testProducts: ProductInput[] = [
  {
    name: 'Nike Air Max Test',
    brand: 'Nike',
    category: 'shoes' as ProductCategory,
    source: 'nike' as ProductSource,
    originalPrice: 150,
    salePrice: 105,
    discountPercentage: 30,
    productUrl: 'https://nike.com/test-product-1',
    imageUrl: 'https://nike.com/image-1.jpg',
    isNew: true,
  },
  {
    name: 'Adidas Ultraboost Test',
    brand: 'Adidas',
    category: 'shoes' as ProductCategory,
    source: 'adidas' as ProductSource,
    originalPrice: 200,
    salePrice: 120,
    discountPercentage: 40,
    productUrl: 'https://adidas.com/test-product-2',
    imageUrl: 'https://adidas.com/image-2.jpg',
    isNew: false,
  },
  {
    name: 'Zara Blazer Test',
    brand: 'Zara',
    category: 'clothing' as ProductCategory,
    source: 'zara' as ProductSource,
    originalPrice: 70,
    salePrice: 35,
    discountPercentage: 50,
    productUrl: 'https://zara.com/test-product-3',
    imageUrl: 'https://zara.com/image-3.jpg',
  },
];

describe('Database Query Functions', () => {
  beforeAll(async () => {
    // Clean up test data before running tests
    await prisma.userInteraction.deleteMany({});
    await prisma.verificationHistory.deleteMany({});
    await prisma.productImage.deleteMany({});
    await prisma.translation.deleteMany({});
    await prisma.product.deleteMany({
      where: {
        productUrl: { contains: 'test-product' },
      },
    });
  });

  afterAll(async () => {
    // Clean up test data after tests
    await prisma.userInteraction.deleteMany({});
    await prisma.verificationHistory.deleteMany({});
    await prisma.productImage.deleteMany({});
    await prisma.translation.deleteMany({});
    await prisma.product.deleteMany({
      where: {
        productUrl: { contains: 'test-product' },
      },
    });
    await prisma.$disconnect();
  });

  describe('bulkInsertProducts', () => {
    it('should insert multiple products successfully', async () => {
      const result = await bulkInsertProducts(testProducts);

      expect(result.count).toBe(3);
      expect(result.ids).toHaveLength(3);
      expect(result.ids.every((id) => typeof id === 'string')).toBe(true);
    });

    it('should return empty result for empty array', async () => {
      const result = await bulkInsertProducts([]);

      expect(result.count).toBe(0);
      expect(result.ids).toHaveLength(0);
    });

    it('should skip duplicates when inserting', async () => {
      // Try to insert same products again
      const result = await bulkInsertProducts(testProducts);

      // Should return 0 as they already exist
      expect(result.count).toBe(0);
    });
  });

  describe('findActiveDeals', () => {
    it('should find all active deals without filters', async () => {
      const products = await findActiveDeals();

      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBeGreaterThan(0);
      expect(products.every((p) => p.isActive)).toBe(true);
    });

    it('should filter by category', async () => {
      const products = await findActiveDeals({
        category: 'shoes' as ProductCategory,
      });

      expect(products.every((p) => p.category === 'shoes')).toBe(true);
    });

    it('should filter by minimum discount', async () => {
      const products = await findActiveDeals({
        minDiscount: 40,
      });

      expect(products.every((p) => p.discountPercentage >= 40)).toBe(true);
    });

    it('should filter by maximum price', async () => {
      const products = await findActiveDeals({
        maxPrice: 100,
      });

      expect(products.every((p) => p.salePrice <= 100)).toBe(true);
    });

    it('should filter by brand', async () => {
      const products = await findActiveDeals({
        brand: 'Nike',
      });

      expect(
        products.every((p) => p.brand.toLowerCase() === 'nike')
      ).toBe(true);
    });

    it('should filter by source', async () => {
      const products = await findActiveDeals({
        source: 'nike' as ProductSource,
      });

      expect(products.every((p) => p.source === 'nike')).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const products = await findActiveDeals({
        limit: 2,
      });

      expect(products.length).toBeLessThanOrEqual(2);
    });

    it('should respect offset parameter', async () => {
      const firstPage = await findActiveDeals({ limit: 1, offset: 0 });
      const secondPage = await findActiveDeals({ limit: 1, offset: 1 });

      if (firstPage.length > 0 && secondPage.length > 0) {
        expect(firstPage[0].id).not.toBe(secondPage[0].id);
      }
    });

    it('should only return products with minimum confidence score', async () => {
      const products = await findActiveDeals({
        minConfidence: 85,
      });

      expect(products.every((p) => p.confidenceScore >= 85)).toBe(true);
    });
  });

  describe('findById', () => {
    it('should find a product by ID', async () => {
      const allProducts = await findActiveDeals({ limit: 1 });
      if (allProducts.length === 0) {
        return; // Skip if no products
      }

      const productId = allProducts[0].id;
      const product = await findById(productId);

      expect(product).not.toBeNull();
      expect(product?.id).toBe(productId);
    });

    it('should return null for non-existent ID', async () => {
      const product = await findById('non-existent-id');

      expect(product).toBeNull();
    });

    it('should include related data', async () => {
      const allProducts = await findActiveDeals({ limit: 1 });
      if (allProducts.length === 0) {
        return; // Skip if no products
      }

      const productId = allProducts[0].id;
      const product = await findById(productId);

      expect(product).toHaveProperty('images');
      expect(product).toHaveProperty('translations');
      expect(product).toHaveProperty('verificationHistory');
    });
  });

  describe('updateConfidenceScore', () => {
    it('should update confidence score and create history', async () => {
      const allProducts = await findActiveDeals({ limit: 1 });
      if (allProducts.length === 0) {
        return; // Skip if no products
      }

      const productId = allProducts[0].id;
      const newScore = 95;

      await updateConfidenceScore(productId, newScore, 'test_verification');

      const updatedProduct = await findById(productId);
      expect(updatedProduct?.confidenceScore).toBe(newScore);
      expect(updatedProduct?.lastVerifiedAt).not.toBeNull();
    });

    it('should throw error for non-existent product', async () => {
      await expect(
        updateConfidenceScore('non-existent-id', 95)
      ).rejects.toThrow('Product with ID non-existent-id not found');
    });

    it('should quarantine product if confidence drops below 50', async () => {
      const allProducts = await findActiveDeals({ limit: 1 });
      if (allProducts.length === 0) {
        return; // Skip if no products
      }

      const productId = allProducts[0].id;

      await updateConfidenceScore(productId, 40, 'test_quarantine');

      const updatedProduct = await findById(productId);
      expect(updatedProduct?.isActive).toBe(false);

      // Restore for other tests
      await updateConfidenceScore(productId, 85, 'test_restore');
    });
  });

  describe('getTopDealsByCategory', () => {
    it('should return top deals for a category', async () => {
      const products = await getTopDealsByCategory('shoes' as ProductCategory, 5);

      expect(Array.isArray(products)).toBe(true);
      expect(products.every((p) => p.category === 'shoes')).toBe(true);
      expect(products.length).toBeLessThanOrEqual(5);
    });

    it('should sort by discount percentage', async () => {
      const products = await getTopDealsByCategory('shoes' as ProductCategory, 10);

      if (products.length > 1) {
        for (let i = 0; i < products.length - 1; i++) {
          expect(products[i].discountPercentage).toBeGreaterThanOrEqual(
            products[i + 1].discountPercentage
          );
        }
      }
    });
  });

  describe('recordInteraction', () => {
    it('should record a view interaction', async () => {
      const allProducts = await findActiveDeals({ limit: 1 });
      if (allProducts.length === 0) {
        return; // Skip if no products
      }

      const productId = allProducts[0].id;
      const initialViewCount = allProducts[0].viewCount;

      await recordInteraction(productId, 'view', {
        sessionId: 'test-session',
        language: 'en',
      });

      const updatedProduct = await findById(productId);
      expect(updatedProduct?.viewCount).toBe(initialViewCount + 1);
    });

    it('should record a click interaction', async () => {
      const allProducts = await findActiveDeals({ limit: 1 });
      if (allProducts.length === 0) {
        return; // Skip if no products
      }

      const productId = allProducts[0].id;
      const initialClickCount = allProducts[0].clickCount;

      await recordInteraction(productId, 'click');

      const updatedProduct = await findById(productId);
      expect(updatedProduct?.clickCount).toBe(initialClickCount + 1);
    });

    it('should update popularity score', async () => {
      const allProducts = await findActiveDeals({ limit: 1 });
      if (allProducts.length === 0) {
        return; // Skip if no products
      }

      const productId = allProducts[0].id;
      const initialPopularity = allProducts[0].popularityScore;

      await recordInteraction(productId, 'favorite');

      const updatedProduct = await findById(productId);
      expect(updatedProduct?.popularityScore).toBeGreaterThan(initialPopularity);
    });
  });

  describe('findProductsNeedingVerification', () => {
    it('should find products needing verification', async () => {
      const products = await findProductsNeedingVerification(1, 10);

      expect(Array.isArray(products)).toBe(true);
      expect(products.every((p) => p.isActive)).toBe(true);
    });

    it('should sort by popularity', async () => {
      const products = await findProductsNeedingVerification(24, 10);

      if (products.length > 1) {
        for (let i = 0; i < products.length - 1; i++) {
          expect(products[i].popularityScore).toBeGreaterThanOrEqual(
            products[i + 1].popularityScore
          );
        }
      }
    });
  });

  describe('getStatsBySource', () => {
    it('should return statistics for each source', async () => {
      const stats = await getStatsBySource();

      expect(Array.isArray(stats)).toBe(true);
      expect(stats.length).toBeGreaterThan(0);

      stats.forEach((stat) => {
        expect(stat).toHaveProperty('source');
        expect(stat).toHaveProperty('total');
        expect(stat).toHaveProperty('active');
        expect(stat).toHaveProperty('avgConfidence');
        expect(stat).toHaveProperty('avgDiscount');
        expect(typeof stat.total).toBe('number');
        expect(typeof stat.avgConfidence).toBe('number');
        expect(typeof stat.avgDiscount).toBe('number');
      });
    });
  });
});
