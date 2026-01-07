/**
 * Main Translation Service
 * Orchestrates translation providers and caching
 */

import {
  Language,
  TranslationService,
  TranslationProvider,
  TranslationOptions,
  Product,
  TranslatedProduct,
} from './types';
import { DeepLProvider } from './providers/deepl';
import { FallbackProvider } from './providers/fallback';
import { TranslationCache } from './cache';

export class Translator implements TranslationService {
  private provider: TranslationProvider;
  private fallbackProvider: TranslationProvider;
  private cache: TranslationCache;
  private options: Required<TranslationOptions>;

  constructor(
    deeplApiKey?: string,
    redisConfig?: any,
    options?: TranslationOptions
  ) {
    // Initialize providers
    if (deeplApiKey) {
      this.provider = new DeepLProvider({
        apiKey: deeplApiKey,
        freeApi: true,
        timeout: 10000,
      });
    } else {
      console.warn('No DeepL API key provided, using fallback provider');
      this.provider = new FallbackProvider();
    }

    this.fallbackProvider = new FallbackProvider();

    // Initialize cache
    this.cache = new TranslationCache(redisConfig);

    // Set default options
    this.options = {
      fallbackLanguage: 'en',
      cacheEnabled: true,
      cacheTTL: 24 * 60 * 60, // 24 hours
      provider: deeplApiKey ? 'deepl' : 'fallback',
      ...options,
    };
  }

  /**
   * Initialize the translation service
   */
  async initialize(): Promise<void> {
    if (this.options.cacheEnabled) {
      await this.cache.connect();
    }
  }

  /**
   * Shutdown the translation service
   */
  async shutdown(): Promise<void> {
    await this.cache.disconnect();
  }

  /**
   * Translate a product to target language
   */
  async translateProduct(
    product: Product,
    targetLang: Language
  ): Promise<TranslatedProduct> {
    const sourceLang = 'en'; // Assume products are in English by default

    if (sourceLang === targetLang) {
      return {
        id: product.id,
        name: product.name,
        description: product.description || '',
        language: targetLang,
        originalLanguage: sourceLang,
      };
    }

    try {
      // Prepare texts to translate
      const textsToTranslate = [
        product.name,
        product.description || '',
      ].filter((text) => text.trim() !== '');

      // Translate with caching
      const translatedTexts = await this.batchTranslateWithCache(
        textsToTranslate,
        sourceLang,
        targetLang
      );

      return {
        id: product.id,
        name: translatedTexts[0] || product.name,
        description: translatedTexts[1] || product.description || '',
        language: targetLang,
        originalLanguage: sourceLang,
      };
    } catch (error: any) {
      console.error('Product translation error:', error.message);

      // Return original on error
      return {
        id: product.id,
        name: product.name,
        description: product.description || '',
        language: sourceLang,
        originalLanguage: sourceLang,
      };
    }
  }

  /**
   * Translate UI strings (from locale files)
   */
  async translateUI(
    key: string,
    lang: Language,
    params?: Record<string, any>
  ): Promise<string> {
    // UI translations are pre-translated in locale files
    // This method is here for dynamic translations if needed
    return key;
  }

  /**
   * Batch translate multiple strings
   */
  async batchTranslate(
    items: string[],
    sourceLang: Language,
    targetLang: Language
  ): Promise<string[]> {
    if (sourceLang === targetLang) {
      return items;
    }

    return this.batchTranslateWithCache(items, sourceLang, targetLang);
  }

  /**
   * Batch translate with cache support
   */
  private async batchTranslateWithCache(
    texts: string[],
    sourceLang: Language,
    targetLang: Language
  ): Promise<string[]> {
    // Check cache first
    let cachedResults: (string | null)[] = [];
    let uncachedIndices: number[] = [];
    let uncachedTexts: string[] = [];

    if (this.options.cacheEnabled && this.cache.isConnected()) {
      cachedResults = await this.cache.getMultiple(texts, sourceLang, targetLang);

      // Find texts that need translation
      texts.forEach((text, index) => {
        if (cachedResults[index] === null) {
          uncachedIndices.push(index);
          uncachedTexts.push(text);
        }
      });
    } else {
      // No cache, translate everything
      uncachedIndices = texts.map((_, index) => index);
      uncachedTexts = [...texts];
    }

    // Translate uncached texts
    let translatedTexts: string[] = [];

    if (uncachedTexts.length > 0) {
      try {
        translatedTexts = await this.provider.batchTranslate(
          uncachedTexts,
          sourceLang,
          targetLang
        );

        // Cache the new translations
        if (this.options.cacheEnabled && this.cache.isConnected()) {
          await this.cache.setMultiple(
            uncachedTexts,
            sourceLang,
            targetLang,
            translatedTexts,
            this.options.cacheTTL
          );
        }
      } catch (error: any) {
        console.error('Batch translation error:', error.message);

        // Use fallback provider
        try {
          translatedTexts = await this.fallbackProvider.batchTranslate(
            uncachedTexts,
            sourceLang,
            targetLang
          );
        } catch (fallbackError: any) {
          console.error('Fallback translation error:', fallbackError.message);
          translatedTexts = uncachedTexts; // Return originals
        }
      }
    }

    // Combine cached and newly translated results
    const results: string[] = [];
    let translatedIndex = 0;

    for (let i = 0; i < texts.length; i++) {
      if (cachedResults[i] !== null) {
        results.push(cachedResults[i]!);
      } else {
        results.push(translatedTexts[translatedIndex] || texts[i]);
        translatedIndex++;
      }
    }

    return results;
  }

  /**
   * Translate a single text with caching
   */
  async translateText(
    text: string,
    sourceLang: Language,
    targetLang: Language
  ): Promise<string> {
    if (sourceLang === targetLang || !text) {
      return text;
    }

    // Check cache
    if (this.options.cacheEnabled && this.cache.isConnected()) {
      const cached = await this.cache.get(text, sourceLang, targetLang);
      if (cached) {
        return cached;
      }
    }

    // Translate
    try {
      const translated = await this.provider.translate(text, sourceLang, targetLang);

      // Cache result
      if (this.options.cacheEnabled && this.cache.isConnected()) {
        await this.cache.set(text, sourceLang, targetLang, translated, this.options.cacheTTL);
      }

      return translated;
    } catch (error: any) {
      console.error('Translation error:', error.message);

      // Try fallback
      try {
        return await this.fallbackProvider.translate(text, sourceLang, targetLang);
      } catch (fallbackError: any) {
        console.error('Fallback translation error:', fallbackError.message);
        return text; // Return original
      }
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ totalKeys: number; memoryUsage: string; connected: boolean }> {
    if (!this.cache.isConnected()) {
      return { totalKeys: 0, memoryUsage: '0 KB', connected: false };
    }

    const stats = await this.cache.getStats();
    return { ...stats, connected: true };
  }

  /**
   * Clear translation cache
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return this.provider.name;
  }
}
