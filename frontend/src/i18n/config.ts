/**
 * i18next Configuration
 * Sets up internationalization for the frontend
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import locale files
import enCommon from '../../../shared/locales/en/common.json';
import enErrors from '../../../shared/locales/en/errors.json';
import enProducts from '../../../shared/locales/en/products.json';

import itCommon from '../../../shared/locales/it/common.json';
import itErrors from '../../../shared/locales/it/errors.json';
import itProducts from '../../../shared/locales/it/products.json';

import esCommon from '../../../shared/locales/es/common.json';
import esErrors from '../../../shared/locales/es/errors.json';
import esProducts from '../../../shared/locales/es/products.json';

import frCommon from '../../../shared/locales/fr/common.json';
import frErrors from '../../../shared/locales/fr/errors.json';
import frProducts from '../../../shared/locales/fr/products.json';

import deCommon from '../../../shared/locales/de/common.json';
import deErrors from '../../../shared/locales/de/errors.json';
import deProducts from '../../../shared/locales/de/products.json';

import ptCommon from '../../../shared/locales/pt/common.json';
import ptErrors from '../../../shared/locales/pt/errors.json';
import ptProducts from '../../../shared/locales/pt/products.json';

// Supported languages
export const SUPPORTED_LANGUAGES = ['en', 'it', 'es', 'fr', 'de', 'pt'] as const;
export type Language = typeof SUPPORTED_LANGUAGES[number];

// Language metadata
export const LANGUAGE_METADATA: Record<Language, { name: string; flag: string }> = {
  en: { name: 'English', flag: '🇬🇧' },
  it: { name: 'Italiano', flag: '🇮🇹' },
  es: { name: 'Español', flag: '🇪🇸' },
  fr: { name: 'Français', flag: '🇫🇷' },
  de: { name: 'Deutsch', flag: '🇩🇪' },
  pt: { name: 'Português', flag: '🇵🇹' },
};

// Configure i18next
i18n
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next) // Pass i18n to react-i18next
  .init({
    resources: {
      en: {
        common: enCommon,
        errors: enErrors,
        products: enProducts,
      },
      it: {
        common: itCommon,
        errors: itErrors,
        products: itProducts,
      },
      es: {
        common: esCommon,
        errors: esErrors,
        products: esProducts,
      },
      fr: {
        common: frCommon,
        errors: frErrors,
        products: frProducts,
      },
      de: {
        common: deCommon,
        errors: deErrors,
        products: deProducts,
      },
      pt: {
        common: ptCommon,
        errors: ptErrors,
        products: ptProducts,
      },
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'errors', 'products'],
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    react: {
      useSuspense: false, // Disable suspense for now
    },
  });

export default i18n;
