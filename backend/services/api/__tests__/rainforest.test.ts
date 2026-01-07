import RainforestApiClient from '../rainforest';

describe('RainforestApiClient', () => {
  let client: RainforestApiClient;

  beforeAll(() => {
    // Skip tests if API key is not set
    if (!process.env.RAINFOREST_API_KEY) {
      console.warn('RAINFOREST_API_KEY not set, skipping Rainforest tests');
    }
  });

  beforeEach(() => {
    if (process.env.RAINFOREST_API_KEY) {
      client = new RainforestApiClient();
    }
  });

  describe('searchProducts', () => {
    it('should search for products', async () => {
      if (!process.env.RAINFOREST_API_KEY) {
        return; // Skip test
      }

      const result = await client.searchProducts({
        query: 'Nike running shoes',
      });

      expect(result).toBeDefined();
      expect(result.provider).toBe('rainforest');

      if (result.success) {
        expect(result.data).toBeInstanceOf(Array);
        expect(result.responseTime).toBeGreaterThan(0);

        if (result.data && result.data.length > 0) {
          const product = result.data[0];
          expect(product.name).toBeDefined();
          expect(product.brand).toBeDefined();
          expect(product.originalPrice).toBeGreaterThan(0);
          expect(product.salePrice).toBeGreaterThan(0);
          expect(product.discountPercentage).toBeGreaterThanOrEqual(10);
          expect(product.productUrl).toMatch(/^https?:\/\//);
          expect(product.confidenceScore).toBeGreaterThanOrEqual(70);
          expect(product.confidenceScore).toBeLessThanOrEqual(99);
          expect(product.externalId).toBeDefined(); // ASIN
        }
      } else {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('getProduct', () => {
    it('should get product by ASIN', async () => {
      if (!process.env.RAINFOREST_API_KEY) {
        return;
      }

      // Test with a known ASIN (example)
      const testAsin = 'B00X4WHP5E'; // Example Nike product

      const result = await client.getProduct(testAsin);

      expect(result).toBeDefined();
      expect(result.provider).toBe('rainforest');

      if (result.success && result.data) {
        expect(result.data.externalId).toBe(testAsin);
        expect(result.data.name).toBeDefined();
      }
    });
  });

  describe('searchByBrand', () => {
    it('should search products by brand', async () => {
      if (!process.env.RAINFOREST_API_KEY) {
        return;
      }

      const result = await client.searchByBrand('Adidas', {
        maxPrice: 150,
        limit: 5,
      });

      expect(result).toBeDefined();

      if (result.success && result.data && result.data.length > 0) {
        expect(result.data.length).toBeLessThanOrEqual(5);

        result.data.forEach((product) => {
          expect(product.salePrice).toBeLessThanOrEqual(150);
          expect(product.brand.toLowerCase()).toContain('adidas');
        });
      }
    });
  });

  describe('searchDeals', () => {
    it('should search for deals', async () => {
      if (!process.env.RAINFOREST_API_KEY) {
        return;
      }

      const result = await client.searchDeals('clothing', {
        minDiscount: 30,
        maxPrice: 100,
        limit: 10,
      });

      expect(result).toBeDefined();

      if (result.success && result.data && result.data.length > 0) {
        result.data.forEach((product) => {
          expect(product.discountPercentage).toBeGreaterThanOrEqual(30);
          expect(product.salePrice).toBeLessThanOrEqual(100);
        });
      }
    });
  });

  describe('validation', () => {
    it('should validate product data', async () => {
      if (!process.env.RAINFOREST_API_KEY) {
        return;
      }

      const result = await client.searchProducts({
        query: 'fashion shoes',
      });

      if (result.success && result.data && result.data.length > 0) {
        result.data.forEach((product) => {
          // Validate required fields
          expect(product.name).toBeDefined();
          expect(product.name.length).toBeGreaterThan(0);
          expect(product.brand).toBeDefined();
          expect(product.productUrl).toMatch(/^https?:\/\//);
          expect(product.originalPrice).toBeGreaterThan(0);
          expect(product.salePrice).toBeGreaterThan(0);

          // Validate discount is reasonable
          expect(product.discountPercentage).toBeGreaterThanOrEqual(10);
          expect(product.discountPercentage).toBeLessThanOrEqual(90);

          // Validate confidence score
          expect(product.confidenceScore).toBeGreaterThanOrEqual(70);
          expect(product.confidenceScore).toBeLessThanOrEqual(99);
        });
      }
    });
  });
});
