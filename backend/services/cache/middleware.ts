/**
 * Express Cache Middleware
 * Caching middleware for Express routes
 */

import { Request, Response, NextFunction } from 'express';
import { CacheManager } from './cache-manager';
import { MetricsTracker } from './metrics';
import crypto from 'crypto';

export interface CacheMiddlewareOptions {
  ttl?: number; // seconds
  cacheKey?: (req: Request) => string;
  condition?: (req: Request) => boolean;
  varyBy?: string[]; // Query params to include in cache key
}

export class CacheMiddleware {
  constructor(
    private cacheManager: CacheManager,
    private metricsTracker?: MetricsTracker
  ) {}

  /**
   * Create cache middleware
   */
  cache(options: CacheMiddlewareOptions = {}) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Check if request should be cached
      if (options.condition && !options.condition(req)) {
        return next();
      }

      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }

      // Generate cache key
      const cacheKey = options.cacheKey
        ? options.cacheKey(req)
        : this.generateCacheKey(req, options.varyBy);

      try {
        // Try to get from cache
        const cached = await this.cacheManager.get(cacheKey);

        if (cached.hit && cached.data) {
          const responseTime = Date.now() - startTime;

          // Record metrics
          if (this.metricsTracker) {
            this.metricsTracker.record({
              responseTime,
              cacheHit: true,
              layer: cached.layer,
              endpoint: req.path,
            });
          }

          // Add cache headers
          res.set({
            'X-Cache': 'HIT',
            'X-Cache-Layer': cached.layer || 'unknown',
            'X-Response-Time': `${responseTime}ms`,
          });

          return res.json(cached.data);
        }

        // Cache miss - intercept response
        const originalJson = res.json.bind(res);

        res.json = (data: any) => {
          const responseTime = Date.now() - startTime;

          // Store in cache
          this.cacheManager.set(cacheKey, data, options.ttl).catch((error) => {
            console.error('[Cache Middleware] Failed to cache response:', error);
          });

          // Record metrics
          if (this.metricsTracker) {
            this.metricsTracker.record({
              responseTime,
              cacheHit: false,
              endpoint: req.path,
            });
          }

          // Add cache headers
          res.set({
            'X-Cache': 'MISS',
            'X-Response-Time': `${responseTime}ms`,
          });

          return originalJson(data);
        };

        next();
      } catch (error: any) {
        console.error('[Cache Middleware] Error:', error.message);
        next();
      }
    };
  }

  /**
   * Generate cache key from request
   */
  private generateCacheKey(req: Request, varyBy?: string[]): string {
    const parts = ['api', req.path];

    // Add query params
    if (varyBy && varyBy.length > 0) {
      const params: Record<string, any> = {};
      varyBy.forEach((key) => {
        if (req.query[key]) {
          params[key] = req.query[key];
        }
      });

      if (Object.keys(params).length > 0) {
        const hash = crypto
          .createHash('md5')
          .update(JSON.stringify(params))
          .digest('hex')
          .substring(0, 8);
        parts.push(hash);
      }
    } else if (Object.keys(req.query).length > 0) {
      // Hash all query params
      const hash = crypto
        .createHash('md5')
        .update(JSON.stringify(req.query))
        .digest('hex')
        .substring(0, 8);
      parts.push(hash);
    }

    return parts.join(':');
  }

  /**
   * Middleware to cache product list
   */
  cacheProductList(ttl: number = 300) {
    return this.cache({
      ttl,
      varyBy: ['category', 'brand', 'minDiscount', 'maxPrice', 'source', 'sortBy', 'page'],
      condition: (req) => req.method === 'GET',
    });
  }

  /**
   * Middleware to cache product by ID
   */
  cacheProduct(ttl: number = 600) {
    return this.cache({
      ttl,
      cacheKey: (req) => `deals:product:${req.params.id}`,
    });
  }

  /**
   * Middleware to cache stats
   */
  cacheStats(ttl: number = 1800) {
    return this.cache({
      ttl,
      cacheKey: (req) => 'deals:stats',
    });
  }

  /**
   * Middleware to add cache control headers
   */
  cacheControl(maxAge: number = 300) {
    return (req: Request, res: Response, next: NextFunction) => {
      res.set({
        'Cache-Control': `public, max-age=${maxAge}`,
        'Vary': 'Accept-Encoding',
      });
      next();
    };
  }

  /**
   * Middleware to disable cache
   */
  noCache() {
    return (req: Request, res: Response, next: NextFunction) => {
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0',
      });
      next();
    };
  }

  /**
   * Middleware to measure response time
   */
  measureResponseTime() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Intercept response finish
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;

        if (this.metricsTracker) {
          this.metricsTracker.record({
            responseTime,
            cacheHit: res.get('X-Cache') === 'HIT',
            layer: res.get('X-Cache-Layer'),
            endpoint: req.path,
          });
        }

        console.log(`${req.method} ${req.path} - ${res.statusCode} - ${responseTime}ms`);
      });

      next();
    };
  }

  /**
   * Middleware to invalidate cache on mutations
   */
  invalidateOnMutation(pattern: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Only for non-GET requests
      if (req.method === 'GET') {
        return next();
      }

      // Intercept response
      const originalJson = res.json.bind(res);

      res.json = async (data: any) => {
        // Invalidate cache after successful mutation
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            await this.cacheManager.invalidatePattern(pattern);
            console.log(`[Cache Middleware] Invalidated cache pattern: ${pattern}`);
          } catch (error: any) {
            console.error('[Cache Middleware] Failed to invalidate cache:', error.message);
          }
        }

        return originalJson(data);
      };

      next();
    };
  }
}

export default CacheMiddleware;
