/**
 * Image Validator
 *
 * Validates product images for:
 * - URL accessibility
 * - Valid image format
 * - Appropriate dimensions
 * - File size limits
 */

import axios from 'axios';
import { ImageValidationResult, ImageValidatorConfig } from '../types';

/**
 * Default configuration for image validation
 */
const DEFAULT_CONFIG: ImageValidatorConfig = {
  timeout: 8000, // 8 seconds for image downloads
  minWidth: 200,
  minHeight: 200,
  maxWidth: 5000,
  maxHeight: 5000,
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif']
};

/**
 * Validates an image URL
 *
 * @param imageUrl - The image URL to validate
 * @param config - Optional validator configuration
 * @returns Image validation result
 */
export async function validateImage(
  imageUrl: string,
  config: Partial<ImageValidatorConfig> = {}
): Promise<ImageValidationResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    // Validate URL format
    const urlObj = new URL(imageUrl);

    // Check for common image extensions in URL
    const extension = extractImageExtension(imageUrl);
    if (extension && !finalConfig.allowedFormats.includes(extension)) {
      return {
        valid: false,
        accessible: false,
        error: `Invalid image format: ${extension}. Allowed formats: ${finalConfig.allowedFormats.join(', ')}`
      };
    }

    // Make HEAD request first to check accessibility and get content info
    const headResponse = await axios.head(imageUrl, {
      timeout: finalConfig.timeout,
      validateStatus: (status) => status < 500
    });

    if (headResponse.status >= 400) {
      return {
        valid: false,
        accessible: false,
        error: `HTTP ${headResponse.status}: Image not accessible`
      };
    }

    // Check content type
    const contentType = headResponse.headers['content-type'];
    if (contentType && !contentType.startsWith('image/')) {
      return {
        valid: false,
        accessible: true,
        error: `Invalid content type: ${contentType}. Expected image/*`
      };
    }

    // Check file size from headers
    const contentLength = headResponse.headers['content-length'];
    if (contentLength) {
      const fileSize = parseInt(contentLength, 10);
      if (fileSize > finalConfig.maxFileSize) {
        return {
          valid: false,
          accessible: true,
          fileSize,
          error: `Image too large: ${formatBytes(fileSize)}. Max allowed: ${formatBytes(finalConfig.maxFileSize)}`
        };
      }

      // For very small files that claim to be images, they might be placeholders
      if (fileSize < 1024) { // Less than 1KB
        return {
          valid: false,
          accessible: true,
          fileSize,
          error: 'Image file too small, likely a placeholder or broken image'
        };
      }
    }

    // Determine format from content type
    const format = contentType ? contentType.split('/')[1] : extension;

    // For now, we'll consider it valid if it passes basic checks
    // In production, you might want to download the image and check dimensions
    // using a library like 'sharp' or 'jimp'
    return {
      valid: true,
      accessible: true,
      format,
      fileSize: contentLength ? parseInt(contentLength, 10) : undefined
    };

  } catch (error: any) {
    if (error.code === 'ENOTFOUND') {
      return {
        valid: false,
        accessible: false,
        error: 'Domain not found'
      };
    }

    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return {
        valid: false,
        accessible: false,
        error: 'Request timeout'
      };
    }

    if (error.response) {
      return {
        valid: false,
        accessible: false,
        error: `HTTP ${error.response.status}: ${error.response.statusText}`
      };
    }

    return {
      valid: false,
      accessible: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}

/**
 * Validates an image with full download and dimension checking
 * (More thorough but slower - use sparingly)
 *
 * @param imageUrl - The image URL to validate
 * @param config - Optional validator configuration
 * @returns Image validation result with dimensions
 */
export async function validateImageFull(
  imageUrl: string,
  config: Partial<ImageValidatorConfig> = {}
): Promise<ImageValidationResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    // Download image data
    const response = await axios.get(imageUrl, {
      timeout: finalConfig.timeout,
      responseType: 'arraybuffer',
      maxContentLength: finalConfig.maxFileSize,
      validateStatus: (status) => status < 500
    });

    if (response.status >= 400) {
      return {
        valid: false,
        accessible: false,
        error: `HTTP ${response.status}: Image not accessible`
      };
    }

    const buffer = Buffer.from(response.data);
    const fileSize = buffer.length;

    // Check file size
    if (fileSize > finalConfig.maxFileSize) {
      return {
        valid: false,
        accessible: true,
        fileSize,
        error: `Image too large: ${formatBytes(fileSize)}`
      };
    }

    // Get image dimensions from buffer
    const dimensions = getImageDimensions(buffer);

    if (!dimensions) {
      return {
        valid: false,
        accessible: true,
        fileSize,
        error: 'Could not determine image dimensions'
      };
    }

    // Validate dimensions
    if (dimensions.width < finalConfig.minWidth || dimensions.height < finalConfig.minHeight) {
      return {
        valid: false,
        accessible: true,
        dimensions,
        fileSize,
        error: `Image too small: ${dimensions.width}x${dimensions.height}. Minimum: ${finalConfig.minWidth}x${finalConfig.minHeight}`
      };
    }

    if (dimensions.width > finalConfig.maxWidth || dimensions.height > finalConfig.maxHeight) {
      return {
        valid: false,
        accessible: true,
        dimensions,
        fileSize,
        error: `Image too large: ${dimensions.width}x${dimensions.height}. Maximum: ${finalConfig.maxWidth}x${finalConfig.maxHeight}`
      };
    }

    // Determine format
    const format = detectImageFormat(buffer);

    return {
      valid: true,
      accessible: true,
      format,
      dimensions,
      fileSize
    };

  } catch (error: any) {
    return {
      valid: false,
      accessible: false,
      error: error.message || 'Failed to download and validate image'
    };
  }
}

/**
 * Extract image extension from URL
 */
function extractImageExtension(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    const match = pathname.match(/\.([a-z]+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Get image dimensions from buffer
 * (Basic implementation - checks PNG and JPEG headers)
 */
function getImageDimensions(buffer: Buffer): { width: number; height: number } | null {
  try {
    // PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20)
      };
    }

    // JPEG
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
      let offset = 2;
      while (offset < buffer.length) {
        if (buffer[offset] !== 0xFF) break;

        const marker = buffer[offset + 1];
        if (marker === 0xC0 || marker === 0xC2) {
          return {
            height: buffer.readUInt16BE(offset + 5),
            width: buffer.readUInt16BE(offset + 7)
          };
        }

        offset += 2 + buffer.readUInt16BE(offset + 2);
      }
    }

    // WEBP
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
      // Simplified WEBP dimension detection
      return {
        width: buffer.readUInt16LE(26) + 1,
        height: buffer.readUInt16LE(28) + 1
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Detect image format from buffer
 */
function detectImageFormat(buffer: Buffer): string {
  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'png';
  }

  // JPEG
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    return 'jpeg';
  }

  // GIF
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'gif';
  }

  // WEBP
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }

  return 'unknown';
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Validates multiple images in parallel
 *
 * @param imageUrls - Array of image URLs to validate
 * @param config - Optional validator configuration
 * @returns Map of URL to validation result
 */
export async function validateImages(
  imageUrls: string[],
  config: Partial<ImageValidatorConfig> = {}
): Promise<Map<string, ImageValidationResult>> {
  const results = await Promise.all(
    imageUrls.map(async (url) => ({
      url,
      result: await validateImage(url, config)
    }))
  );

  return new Map(results.map(({ url, result }) => [url, result]));
}
