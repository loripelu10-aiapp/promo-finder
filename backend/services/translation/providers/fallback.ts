/**
 * Fallback Translation Provider
 * Returns English text when DeepL fails or is unavailable
 */

import { Language, TranslationProvider } from '../types';

export class FallbackProvider implements TranslationProvider {
  public readonly name = 'fallback';

  /**
   * Returns the original text (no translation)
   */
  async translate(
    text: string,
    sourceLang: Language,
    targetLang: Language
  ): Promise<string> {
    console.warn(
      `Fallback provider: No translation available for ${sourceLang} -> ${targetLang}`
    );
    return text;
  }

  /**
   * Returns all texts unchanged
   */
  async batchTranslate(
    texts: string[],
    sourceLang: Language,
    targetLang: Language
  ): Promise<string[]> {
    console.warn(
      `Fallback provider: No batch translation for ${sourceLang} -> ${targetLang}`
    );
    return texts;
  }

  /**
   * Returns English as the default detected language
   */
  async detectLanguage(text: string): Promise<Language> {
    return 'en';
  }
}
