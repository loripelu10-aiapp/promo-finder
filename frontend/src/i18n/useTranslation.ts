/**
 * Custom useTranslation Hook
 * Provides type-safe translation functionality
 */

import { useTranslation as useI18nTranslation } from 'react-i18next';
import { Language, SUPPORTED_LANGUAGES } from './config';

export interface UseTranslationReturn {
  t: (key: string, options?: any) => string;
  language: Language;
  changeLanguage: (lang: Language) => Promise<void>;
  isLanguageSupported: (lang: string) => lang is Language;
}

/**
 * Custom hook for translations with type safety
 */
export function useTranslation(namespace: string = 'common'): UseTranslationReturn {
  const { t, i18n } = useI18nTranslation(namespace);

  const changeLanguage = async (lang: Language): Promise<void> => {
    await i18n.changeLanguage(lang);
    // Save to localStorage
    localStorage.setItem('i18nextLng', lang);
  };

  const isLanguageSupported = (lang: string): lang is Language => {
    return SUPPORTED_LANGUAGES.includes(lang as Language);
  };

  return {
    t,
    language: i18n.language as Language,
    changeLanguage,
    isLanguageSupported,
  };
}

/**
 * Hook for translation with fallback
 */
export function useTranslationWithFallback(
  namespace: string = 'common'
): UseTranslationReturn & { tf: (key: string, fallback: string) => string } {
  const translation = useTranslation(namespace);

  const tf = (key: string, fallback: string): string => {
    const result = translation.t(key);
    return result === key ? fallback : result;
  };

  return {
    ...translation,
    tf,
  };
}
