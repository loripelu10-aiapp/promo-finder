import { ApiAggregator } from '../aggregator';
import { ProductCategory } from '@prisma/client';

describe('ApiAggregator', () => {
  let aggregator: ApiAggregator;

  beforeEach(() => {
    aggregator = new ApiAggregator();
  });

  describe('searchProducts', () => {
    it('should search products across multiple providers', async () => {
      const result = await aggregator.searchProducts('Nike shoes', {
        maxPrice: 150,
        limit: 10,
      });

      expect(result).toBeDefined();
      expect(result.products).toBeInstanceOf(Array);
      expect(result.sources).toBeInstanceOf(Array);
      expect(result.totalResults).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty results gracefully', async () => {
      const result = await aggregator.searchProducts('nonexistentbrandxyz123', {
        limit: 5,
      });

      expect(result).toBeDefined();
      expect(result.products).toEqual([]);
      expect(result.totalResults).toBe(0);
    });

    it('should deduplicate products', async () => {
      const result = await aggregator.searchProducts('Adidas', {
        limit: 20,
      });

      if (result.products.length > 0) {
        const urls = result.products.map((p) => p.productUrl);
        const uniqueUrls = new Set(urls);
        expect(urls.length).toBe(uniqueUrls.size);
      }
    });
  });

  describe('searchByBrand', () => {
    it('should search products by brand', async () => {
      const result = await aggregator.searchByBrand({
        brand: 'Nike',
        minDiscount: 30,
        maxPrice: 200,
      });

      expect(result).toBeDefined();
      expect(result.products).toBeInstanceOf(Array);

      if (result.products.length > 0) {
        result.products.forEach((product) => {
          expect(product.brand.toLowerCase()).toContain('nike');
          expect(product.discountPercentage).toBeGreaterThanOrEqual(30);
          expect(product.salePrice).toBeLessThanOrEqual(200);
        });
      }
    });
  });

  describe('searchByCategory', () => {
    it('should search products by category', async () => {
      const result = await aggregator.searchByCategory({
        category: ProductCategory.shoes,
        minDiscount: 25,
        maxPrice: 150,
      });

      expect(result).toBeDefined();
      expect(result.products).toBeInstanceOf(Array);

      if (result.products.length > 0) {
        result.products.forEach((product) => {
          expect(product.category).toBe(ProductCategory.shoes);
          expect(product.discountPercentage).toBeGreaterThanOrEqual(25);
          expect(product.salePrice).toBeLessThanOrEqual(150);
        });
      }
    });
  });

  describe('searchDeals', () => {
    it('should search for deals with minimum discount', async () => {
      const result = await aggregator.searchDeals({
        minDiscount: 40,
        maxPrice: 200,
      });

      expect(result).toBeDefined();
      expect(result.products).toBeInstanceOf(Array);

      if (result.products.length > 0) {
        result.products.forEach((product) => {
          expect(product.discountPercentage).toBeGreaterThanOrEqual(40);
          expect(product.salePrice).toBeLessThanOrEqual(200);
        });

        // Should be sorted by discount
        for (let i = 1; i < result.products.length; i++) {
          expect(result.products[i - 1].discountPercentage).toBeGreaterThanOrEqual(
            result.products[i].discountPercentage
          );
        }
      }
    });
  });

  describe('getUsageStats', () => {
    it('should return usage statistics', async () => {
      const stats = await aggregator.getUsageStats();

      expect(stats).toBeDefined();
      expect(stats.providers).toBeInstanceOf(Array);
      expect(stats.cache).toBeDefined();
      expect(stats.database).toBeDefined();

      stats.providers.forEach((provider) => {
        expect(provider.provider).toBeDefined();
        expect(provider.requestsToday).toBeGreaterThanOrEqual(0);
        expect(provider.requestsRemaining).toBeGreaterThanOrEqual(0);
        expect(provider.dailyLimit).toBeGreaterThan(0);
      });
    });
  });
});
