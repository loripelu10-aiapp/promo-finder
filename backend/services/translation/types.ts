/**
 * Translation System Types
 * Defines interfaces for the i18n infrastructure
 */

export type Language = 'en' | 'it' | 'es' | 'fr' | 'de' | 'pt';

export interface TranslatedProduct {
  id: string;
  name: string;
  description: string;
  language: Language;
  originalLanguage: Language;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  brand: string;
  category: string;
  salePrice: number;
  originalPrice: number;
  discount: number;
  image: string;
  url: string;
  source: string;
}

export interface TranslationCache {
  key: string;
  text: string;
  sourceLang: Language;
  targetLang: Language;
  translatedText: string;
  timestamp: number;
  expiresAt: number;
}

export interface TranslationService {
  translateProduct(
    product: Product,
    targetLang: Language
  ): Promise<TranslatedProduct>;

  translateUI(
    key: string,
    lang: Language,
    params?: Record<string, any>
  ): Promise<string>;

  batchTranslate(
    items: string[],
    sourceLang: Language,
    targetLang: Language
  ): Promise<string[]>;
}

export interface TranslationProvider {
  name: string;
  translate(
    text: string,
    sourceLang: Language,
    targetLang: Language
  ): Promise<string>;

  batchTranslate(
    texts: string[],
    sourceLang: Language,
    targetLang: Language
  ): Promise<string[]>;

  detectLanguage(text: string): Promise<Language>;
}

export interface TranslationOptions {
  fallbackLanguage?: Language;
  cacheEnabled?: boolean;
  cacheTTL?: number; // in seconds
  provider?: 'deepl' | 'fallback';
}

export interface DeepLConfig {
  apiKey: string;
  freeApi?: boolean;
  timeout?: number;
}

export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
}
