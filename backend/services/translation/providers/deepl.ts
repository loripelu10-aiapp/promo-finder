/**
 * DeepL Translation Provider
 * Integrates with DeepL API for high-quality translations
 */

import axios from 'axios';
import { Language, TranslationProvider, DeepLConfig } from '../types';

export class DeepLProvider implements TranslationProvider {
  public readonly name = 'deepl';
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: DeepLConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.freeApi
      ? 'https://api-free.deepl.com/v2'
      : 'https://api.deepl.com/v2';
    this.timeout = config.timeout || 10000;
  }

  /**
   * Translate a single text string
   */
  async translate(
    text: string,
    sourceLang: Language,
    targetLang: Language
  ): Promise<string> {
    if (!text || text.trim() === '') {
      return text;
    }

    if (sourceLang === targetLang) {
      return text;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/translate`,
        {
          text: [text],
          source_lang: this.mapLanguageCode(sourceLang),
          target_lang: this.mapLanguageCode(targetLang),
          formality: 'default',
          preserve_formatting: true,
        },
        {
          headers: {
            Authorization: `DeepL-Auth-Key ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.timeout,
        }
      );

      return response.data.translations[0].text;
    } catch (error: any) {
      console.error('DeepL translation error:', error.message);
      throw new Error(`DeepL translation failed: ${error.message}`);
    }
  }

  /**
   * Translate multiple texts in a single API call
   */
  async batchTranslate(
    texts: string[],
    sourceLang: Language,
    targetLang: Language
  ): Promise<string[]> {
    if (texts.length === 0) {
      return [];
    }

    if (sourceLang === targetLang) {
      return texts;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/translate`,
        {
          text: texts,
          source_lang: this.mapLanguageCode(sourceLang),
          target_lang: this.mapLanguageCode(targetLang),
          formality: 'default',
          preserve_formatting: true,
        },
        {
          headers: {
            Authorization: `DeepL-Auth-Key ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.timeout * 2, // Longer timeout for batch
        }
      );

      return response.data.translations.map((t: any) => t.text);
    } catch (error: any) {
      console.error('DeepL batch translation error:', error.message);
      throw new Error(`DeepL batch translation failed: ${error.message}`);
    }
  }

  /**
   * Detect the language of a text
   */
  async detectLanguage(text: string): Promise<Language> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/translate`,
        {
          text: [text.substring(0, 200)], // Only use first 200 chars
          target_lang: 'EN',
        },
        {
          headers: {
            Authorization: `DeepL-Auth-Key ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.timeout,
        }
      );

      const detectedLang = response.data.translations[0].detected_source_language;
      return this.unmapLanguageCode(detectedLang);
    } catch (error: any) {
      console.error('DeepL language detection error:', error.message);
      return 'en'; // Default to English
    }
  }

  /**
   * Map our language codes to DeepL's format
   */
  private mapLanguageCode(lang: Language): string {
    const mapping: Record<Language, string> = {
      en: 'EN',
      it: 'IT',
      es: 'ES',
      fr: 'FR',
      de: 'DE',
      pt: 'PT-PT', // European Portuguese
    };
    return mapping[lang] || 'EN';
  }

  /**
   * Map DeepL's language codes back to ours
   */
  private unmapLanguageCode(deeplLang: string): Language {
    const mapping: Record<string, Language> = {
      EN: 'en',
      IT: 'it',
      ES: 'es',
      FR: 'fr',
      DE: 'de',
      PT: 'pt',
      'PT-PT': 'pt',
      'PT-BR': 'pt',
    };
    return mapping[deeplLang] || 'en';
  }

  /**
   * Check DeepL API usage statistics
   */
  async getUsageStats(): Promise<{ characterCount: number; characterLimit: number }> {
    try {
      const response = await axios.get(`${this.baseUrl}/usage`, {
        headers: {
          Authorization: `DeepL-Auth-Key ${this.apiKey}`,
        },
        timeout: this.timeout,
      });

      return {
        characterCount: response.data.character_count,
        characterLimit: response.data.character_limit,
      };
    } catch (error: any) {
      console.error('DeepL usage stats error:', error.message);
      throw new Error(`Failed to get DeepL usage: ${error.message}`);
    }
  }
}
