import RapidApiClient from '../rapidapi';

describe('RapidApiClient', () => {
  let client: RapidApiClient;

  beforeAll(() => {
    // Skip tests if API key is not set
    if (!process.env.RAPIDAPI_KEY) {
      console.warn('RAPIDAPI_KEY not set, skipping RapidAPI tests');
    }
  });

  beforeEach(() => {
    if (process.env.RAPIDAPI_KEY) {
      client = new RapidApiClient();
    }
  });

  describe('searchProducts', () => {
    it('should search for products', async () => {
      if (!process.env.RAPIDAPI_KEY) {
        return; // Skip test
      }

      const result = await client.searchProducts({
        query: 'Nike shoes',
        limit: 5,
      });

      expect(result).toBeDefined();
      expect(result.provider).toBe('rapidapi');

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
        }
      } else {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle invalid queries', async () => {
      if (!process.env.RAPIDAPI_KEY) {
        return;
      }

      const result = await client.searchProducts({
        query: '',
        limit: 5,
      });

      expect(result).toBeDefined();
      expect(result.provider).toBe('rapidapi');
    });
  });

  describe('searchByBrand', () => {
    it('should search products by brand', async () => {
      if (!process.env.RAPIDAPI_KEY) {
        return;
      }

      const result = await client.searchByBrand('Nike', {
        maxPrice: 150,
        limit: 5,
      });

      expect(result).toBeDefined();

      if (result.success && result.data && result.data.length > 0) {
        result.data.forEach((product) => {
          expect(product.salePrice).toBeLessThanOrEqual(150);
          expect(product.brand.toLowerCase()).toContain('nike');
        });
      }
    });
  });

  describe('searchDeals', () => {
    it('should search for deals', async () => {
      if (!process.env.RAPIDAPI_KEY) {
        return;
      }

      const result = await client.searchDeals('shoes', {
        minDiscount: 30,
        maxPrice: 100,
        limit: 5,
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
      if (!process.env.RAPIDAPI_KEY) {
        return;
      }

      const result = await client.searchProducts({
        query: 'Adidas',
        limit: 10,
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

          // Validate discount calculation
          const expectedDiscount = Math.round(
            ((product.originalPrice - product.salePrice) / product.originalPrice) * 100
          );
          expect(product.discountPercentage).toBeCloseTo(expectedDiscount, 5);

          // Validate confidence score
          expect(product.confidenceScore).toBeGreaterThanOrEqual(70);
          expect(product.confidenceScore).toBeLessThanOrEqual(99);
        });
      }
    });
  });
});
