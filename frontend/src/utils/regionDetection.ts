/**
 * Region Detection Utility
 *
 * Detects user's region based on browser settings and allows manual override
 */

import { Region } from '../types';

const REGION_STORAGE_KEY = 'promofinder_user_region';

/**
 * Detect user's region from browser timezone and language
 */
export function detectUserRegion(): Region {
  // Check if user has manually set a region
  const storedRegion = localStorage.getItem(REGION_STORAGE_KEY);
  if (storedRegion && Object.values(Region).includes(storedRegion as Region)) {
    console.log(`[Region] Using stored region: ${storedRegion}`);
    return storedRegion as Region;
  }

  // Detect from browser language
  const language = navigator.language.toLowerCase();
  console.log(`[Region] Detecting from browser language: ${language}`);

  // Map language codes to regions
  if (language.startsWith('en-us')) return Region.US;
  if (language.startsWith('en-gb')) return Region.UK;
  if (language.startsWith('it')) return Region.IT;
  if (language.startsWith('fr')) return Region.FR;
  if (language.startsWith('de')) return Region.DE;
  if (language.startsWith('es')) return Region.ES;

  // Detect from timezone
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  console.log(`[Region] Detecting from timezone: ${timezone}`);

  if (timezone.includes('America') || timezone.includes('New_York') || timezone.includes('Los_Angeles')) {
    return Region.US;
  }
  if (timezone.includes('London')) {
    return Region.UK;
  }
  if (timezone.includes('Rome')) {
    return Region.IT;
  }
  if (timezone.includes('Paris')) {
    return Region.FR;
  }
  if (timezone.includes('Berlin')) {
    return Region.DE;
  }
  if (timezone.includes('Madrid')) {
    return Region.ES;
  }
  if (timezone.includes('Europe')) {
    return Region.EU;
  }

  // Default to EU
  console.log('[Region] Using default region: EU');
  return Region.EU;
}

/**
 * Set user's region (manual override)
 */
export function setUserRegion(region: Region): void {
  localStorage.setItem(REGION_STORAGE_KEY, region);
  console.log(`[Region] Set user region to: ${region}`);
}

/**
 * Get user's region (with detection fallback)
 */
export function getUserRegion(): Region {
  return detectUserRegion();
}

/**
 * Clear stored region (reset to auto-detect)
 */
export function clearUserRegion(): void {
  localStorage.removeItem(REGION_STORAGE_KEY);
  console.log('[Region] Cleared stored region, will auto-detect');
}

/**
 * Get currency symbol for region
 */
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£'
  };
  return symbols[currency] || currency;
}

/**
 * Format price with currency
 */
export function formatPrice(price: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);

  // For GBP, put symbol before price
  if (currency === 'GBP') {
    return `${symbol}${price.toFixed(2)}`;
  }

  // For EUR, put symbol after price
  if (currency === 'EUR') {
    return `${price.toFixed(2)}${symbol}`;
  }

  // For USD and others, put symbol before price
  return `${symbol}${price.toFixed(2)}`;
}
