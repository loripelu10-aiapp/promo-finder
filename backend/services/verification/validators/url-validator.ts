/**
 * URL Validator
 *
 * Validates product URLs for accessibility and correctness
 * - Checks HTTP status codes
 * - Measures response time
 * - Detects redirects
 * - Validates SSL certificates
 */

import axios, { AxiosResponse } from 'axios';
import { UrlValidationResult, UrlValidatorConfig } from '../types';

/**
 * Default configuration for URL validation
 */
const DEFAULT_CONFIG: UrlValidatorConfig = {
  timeout: 5000, // 5 seconds
  followRedirects: true,
  maxRedirects: 3,
  validateSSL: true
};

/**
 * Validates a URL for accessibility
 *
 * @param url - The URL to validate
 * @param config - Optional validator configuration
 * @returns URL validation result
 */
export async function validateUrl(
  url: string,
  config: Partial<UrlValidatorConfig> = {}
): Promise<UrlValidationResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const startTime = Date.now();

  try {
    // Validate URL format first
    const urlObj = new URL(url);

    // Check if it's HTTP or HTTPS
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return {
        accessible: false,
        error: `Invalid protocol: ${urlObj.protocol}. Only HTTP and HTTPS are supported.`
      };
    }

    // Make HEAD request to check accessibility
    const response: AxiosResponse = await axios.head(url, {
      timeout: finalConfig.timeout,
      maxRedirects: finalConfig.maxRedirects,
      validateStatus: (status) => status < 500, // Accept all status codes < 500
      httpsAgent: finalConfig.validateSSL ? undefined : new (require('https').Agent)({
        rejectUnauthorized: false
      })
    });

    const responseTime = Date.now() - startTime;

    // Check for redirects
    const redirectUrl = response.request.res.responseUrl !== url
      ? response.request.res.responseUrl
      : undefined;

    // Determine if URL is accessible
    const accessible = response.status >= 200 && response.status < 400;

    return {
      accessible,
      httpStatus: response.status,
      responseTime,
      redirectUrl,
      error: accessible ? undefined : `HTTP ${response.status}: ${response.statusText}`
    };

  } catch (error: any) {
    const responseTime = Date.now() - startTime;

    if (error.code === 'ENOTFOUND') {
      return {
        accessible: false,
        responseTime,
        error: 'Domain not found (DNS resolution failed)'
      };
    }

    if (error.code === 'ECONNREFUSED') {
      return {
        accessible: false,
        responseTime,
        error: 'Connection refused'
      };
    }

    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return {
        accessible: false,
        responseTime,
        error: `Request timeout after ${finalConfig.timeout}ms`
      };
    }

    if (error.response) {
      return {
        accessible: false,
        httpStatus: error.response.status,
        responseTime,
        error: `HTTP ${error.response.status}: ${error.response.statusText}`
      };
    }

    return {
      accessible: false,
      responseTime,
      error: error.message || 'Unknown error occurred'
    };
  }
}

/**
 * Validates multiple URLs in parallel
 *
 * @param urls - Array of URLs to validate
 * @param config - Optional validator configuration
 * @returns Map of URL to validation result
 */
export async function validateUrls(
  urls: string[],
  config: Partial<UrlValidatorConfig> = {}
): Promise<Map<string, UrlValidationResult>> {
  const results = await Promise.all(
    urls.map(async (url) => ({
      url,
      result: await validateUrl(url, config)
    }))
  );

  return new Map(results.map(({ url, result }) => [url, result]));
}

/**
 * Quick URL format validation (no network request)
 *
 * @param url - The URL to validate
 * @returns True if URL format is valid
 */
export function isValidUrlFormat(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

/**
 * Extracts domain from URL
 *
 * @param url - The URL to extract domain from
 * @returns Domain name or null if invalid
 */
export function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
}
