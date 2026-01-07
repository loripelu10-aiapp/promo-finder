/**
 * Translation Service Tests
 * Test suite for the translation infrastructure
 */

import { Translator } from '../translator';
import { Language, Product } from '../types';

describe('Translator Service', () => {
  let translator: Translator;

  beforeAll(async () => {
    // Initialize without DeepL API key (fallback mode for testing)
    translator = new Translator(undefined, undefined, {
      cacheEnabled: false,
    });
    await translator.initialize();
  });

  afterAll(async () => {
    await translator.shutdown();
  });

  describe('Text Translation', () => {
    it('should return the same text for same source and target language', async () => {
      const text = 'Hello World';
      const result = await translator.translateText(text, 'en', 'en');
      expect(result).toBe(text);
    });

    it('should handle empty text', async () => {
      const result = await translator.translateText('', 'en', 'it');
      expect(result).toBe('');
    });
  });

  describe('Batch Translation', () => {
    it('should translate multiple texts', async () => {
      const texts = ['Hello', 'World', 'Test'];
      const results = await translator.batchTranslate(texts, 'en', 'it');
      expect(results).toHaveLength(texts.length);
    });

    it('should return same texts for same source and target language', async () => {
      const texts = ['Hello', 'World'];
      const results = await translator.batchTranslate(texts, 'en', 'en');
      expect(results).toEqual(texts);
    });
  });

  describe('Product Translation', () => {
    it('should translate product name and description', async () => {
      const product: Product = {
        id: '1',
        name: 'Nike Air Max',
        description: 'Comfortable running shoes',
        brand: 'Nike',
        category: 'shoes',
        salePrice: 89.99,
        originalPrice: 129.99,
        discount: 31,
        image: 'https://example.com/image.jpg',
        url: 'https://example.com/product',
        source: 'test',
      };

      const translated = await translator.translateProduct(product, 'it');

      expect(translated).toHaveProperty('id', product.id);
      expect(translated).toHaveProperty('name');
      expect(translated).toHaveProperty('description');
      expect(translated.language).toBe('it');
      expect(translated.originalLanguage).toBe('en');
    });

    it('should return original for same language', async () => {
      const product: Product = {
        id: '1',
        name: 'Test Product',
        description: 'Test Description',
        brand: 'Test',
        category: 'clothing',
        salePrice: 50,
        originalPrice: 100,
        discount: 50,
        image: 'https://example.com/image.jpg',
        url: 'https://example.com/product',
        source: 'test',
      };

      const translated = await translator.translateProduct(product, 'en');

      expect(translated.name).toBe(product.name);
      expect(translated.description).toBe(product.description);
    });
  });

  describe('Cache Statistics', () => {
    it('should return cache stats', async () => {
      const stats = await translator.getCacheStats();
      expect(stats).toHaveProperty('connected');
      expect(stats).toHaveProperty('totalKeys');
      expect(stats).toHaveProperty('memoryUsage');
    });
  });

  describe('Provider', () => {
    it('should return provider name', () => {
      const providerName = translator.getProviderName();
      expect(providerName).toBe('fallback');
    });
  });
});
