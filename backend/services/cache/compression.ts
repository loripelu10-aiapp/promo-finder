/**
 * Response Compression Service
 * Compress API responses for faster transmission
 */

import zlib from 'zlib';
import { promisify } from 'util';
import { CompressionOptions } from './types';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const deflate = promisify(zlib.deflate);
const inflate = promisify(zlib.inflate);

export class CompressionService {
  private config: Required<CompressionOptions>;
  private stats: {
    compressionCount: number;
    decompressionCount: number;
    totalBytesIn: number;
    totalBytesOut: number;
    avgCompressionRatio: number;
  };

  constructor(config?: Partial<CompressionOptions>) {
    this.config = {
      enabled: config?.enabled !== undefined ? config.enabled : true,
      threshold: config?.threshold || 1024, // 1KB
      level: config?.level !== undefined ? config.level : 6, // Default zlib compression level
    };

    this.stats = {
      compressionCount: 0,
      decompressionCount: 0,
      totalBytesIn: 0,
      totalBytesOut: 0,
      avgCompressionRatio: 0,
    };
  }

  /**
   * Compress data using gzip
   */
  async compress(data: string | Buffer): Promise<Buffer> {
    if (!this.config.enabled) {
      return Buffer.from(data);
    }

    const input = typeof data === 'string' ? Buffer.from(data) : data;

    // Skip compression if below threshold
    if (input.length < this.config.threshold) {
      return input;
    }

    try {
      const compressed = await gzip(input, { level: this.config.level });

      // Update stats
      this.stats.compressionCount++;
      this.stats.totalBytesIn += input.length;
      this.stats.totalBytesOut += compressed.length;
      this.updateCompressionRatio();

      console.log(
        `[Compression] Compressed ${input.length} bytes to ${compressed.length} bytes (${this.getCompressionRatio(input.length, compressed.length)}% reduction)`
      );

      return compressed;
    } catch (error: any) {
      console.error('[Compression] Compression failed:', error.message);
      return input;
    }
  }

  /**
   * Decompress gzip data
   */
  async decompress(data: Buffer): Promise<Buffer> {
    if (!this.config.enabled) {
      return data;
    }

    try {
      const decompressed = await gunzip(data);

      this.stats.decompressionCount++;

      return decompressed;
    } catch (error: any) {
      console.error('[Compression] Decompression failed:', error.message);
      return data;
    }
  }

  /**
   * Compress JSON object
   */
  async compressJSON(obj: any): Promise<Buffer> {
    const json = JSON.stringify(obj);
    return this.compress(json);
  }

  /**
   * Decompress to JSON object
   */
  async decompressJSON<T = any>(data: Buffer): Promise<T> {
    const decompressed = await this.decompress(data);
    const json = decompressed.toString('utf-8');
    return JSON.parse(json);
  }

  /**
   * Compress data using deflate (alternative)
   */
  async compressDeflate(data: string | Buffer): Promise<Buffer> {
    if (!this.config.enabled) {
      return Buffer.from(data);
    }

    const input = typeof data === 'string' ? Buffer.from(data) : data;

    if (input.length < this.config.threshold) {
      return input;
    }

    try {
      return await deflate(input, { level: this.config.level });
    } catch (error: any) {
      console.error('[Compression] Deflate compression failed:', error.message);
      return input;
    }
  }

  /**
   * Decompress deflate data
   */
  async decompressDeflate(data: Buffer): Promise<Buffer> {
    if (!this.config.enabled) {
      return data;
    }

    try {
      return await inflate(data);
    } catch (error: any) {
      console.error('[Compression] Deflate decompression failed:', error.message);
      return data;
    }
  }

  /**
   * Check if data should be compressed
   */
  shouldCompress(data: string | Buffer): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const size = typeof data === 'string' ? Buffer.byteLength(data) : data.length;
    return size >= this.config.threshold;
  }

  /**
   * Get compression ratio as percentage
   */
  private getCompressionRatio(originalSize: number, compressedSize: number): number {
    return Math.round(((originalSize - compressedSize) / originalSize) * 100);
  }

  /**
   * Update average compression ratio
   */
  private updateCompressionRatio(): void {
    if (this.stats.totalBytesIn === 0) {
      this.stats.avgCompressionRatio = 0;
      return;
    }

    this.stats.avgCompressionRatio = Math.round(
      ((this.stats.totalBytesIn - this.stats.totalBytesOut) / this.stats.totalBytesIn) * 100
    );
  }

  /**
   * Get compression statistics
   */
  getStats(): any {
    return {
      compressionCount: this.stats.compressionCount,
      decompressionCount: this.stats.decompressionCount,
      totalBytesIn: this.stats.totalBytesIn,
      totalBytesOut: this.stats.totalBytesOut,
      avgCompressionRatio: this.stats.avgCompressionRatio,
      enabled: this.config.enabled,
      threshold: this.config.threshold,
      level: this.config.level,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      compressionCount: 0,
      decompressionCount: 0,
      totalBytesIn: 0,
      totalBytesOut: 0,
      avgCompressionRatio: 0,
    };
  }

  /**
   * Estimate compressed size
   */
  estimateCompressedSize(dataSize: number): number {
    // Rough estimate based on typical compression ratio (60-70%)
    const estimatedRatio = 0.35; // 35% of original size
    return Math.round(dataSize * estimatedRatio);
  }

  /**
   * Check if compression is beneficial
   */
  isBeneficial(originalSize: number, compressedSize: number): boolean {
    // Compression is beneficial if it reduces size by at least 10%
    return (originalSize - compressedSize) / originalSize >= 0.1;
  }

  /**
   * Compress for cache storage
   */
  async compressForCache(data: any): Promise<{ compressed: boolean; data: Buffer | string }> {
    const json = JSON.stringify(data);
    const size = Buffer.byteLength(json);

    if (!this.shouldCompress(json)) {
      return { compressed: false, data: json };
    }

    const compressed = await this.compress(json);

    // Check if compression was beneficial
    if (this.isBeneficial(size, compressed.length)) {
      return { compressed: true, data: compressed };
    }

    return { compressed: false, data: json };
  }

  /**
   * Decompress from cache storage
   */
  async decompressFromCache(
    data: Buffer | string,
    compressed: boolean
  ): Promise<any> {
    if (!compressed) {
      return typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString());
    }

    const buffer = typeof data === 'string' ? Buffer.from(data, 'base64') : data;
    const decompressed = await this.decompress(buffer);
    return JSON.parse(decompressed.toString('utf-8'));
  }

  /**
   * Batch compress multiple items
   */
  async compressBatch(items: Array<{ key: string; data: any }>): Promise<
    Array<{ key: string; compressed: boolean; data: Buffer | string }>
  > {
    const results = await Promise.all(
      items.map(async (item) => {
        const result = await this.compressForCache(item.data);
        return {
          key: item.key,
          ...result,
        };
      })
    );

    return results;
  }

  /**
   * Enable/disable compression
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Set compression threshold
   */
  setThreshold(threshold: number): void {
    this.config.threshold = threshold;
  }

  /**
   * Set compression level
   */
  setLevel(level: number): void {
    if (level < 0 || level > 9) {
      throw new Error('Compression level must be between 0 and 9');
    }
    this.config.level = level;
  }

  /**
   * Get configuration
   */
  getConfig(): Required<CompressionOptions> {
    return { ...this.config };
  }
}

export default CompressionService;
