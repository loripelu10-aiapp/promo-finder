/**
 * Performance Metrics Tracker
 * Track and analyze cache and performance metrics
 */

import { CacheMetrics, PerformanceMetrics } from './types';

export interface MetricsSample {
  timestamp: Date;
  responseTime: number;
  cacheHit: boolean;
  layer?: string;
  endpoint?: string;
}

export interface PerformanceReport {
  period: {
    start: Date;
    end: Date;
    duration: number;
  };
  requests: {
    total: number;
    successful: number;
    failed: number;
  };
  responseTimes: {
    min: number;
    max: number;
    avg: number;
    median: number;
    p50: number;
    p95: number;
    p99: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    l1HitRate: number;
    l2HitRate: number;
  };
  endpoints: Record<string, {
    count: number;
    avgResponseTime: number;
    cacheHitRate: number;
  }>;
}

export class MetricsTracker {
  private samples: MetricsSample[] = [];
  private maxSamples: number = 10000;
  private startTime: Date = new Date();
  private requestCount: number = 0;
  private errorCount: number = 0;
  private endpointStats: Map<string, {
    count: number;
    totalTime: number;
    cacheHits: number;
  }> = new Map();

  constructor(maxSamples?: number) {
    if (maxSamples) {
      this.maxSamples = maxSamples;
    }
  }

  /**
   * Record a metric sample
   */
  record(sample: Omit<MetricsSample, 'timestamp'>): void {
    this.samples.push({
      ...sample,
      timestamp: new Date(),
    });

    // Keep only recent samples
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    this.requestCount++;

    // Update endpoint stats
    if (sample.endpoint) {
      const stats = this.endpointStats.get(sample.endpoint) || {
        count: 0,
        totalTime: 0,
        cacheHits: 0,
      };

      stats.count++;
      stats.totalTime += sample.responseTime;
      if (sample.cacheHit) {
        stats.cacheHits++;
      }

      this.endpointStats.set(sample.endpoint, stats);
    }
  }

  /**
   * Record an error
   */
  recordError(error: Error, endpoint?: string): void {
    this.errorCount++;
    console.error(`[Metrics] Error in ${endpoint || 'unknown'}:`, error.message);
  }

  /**
   * Get performance report
   */
  getReport(periodMinutes?: number): PerformanceReport {
    const now = new Date();
    const samples = periodMinutes
      ? this.getSamplesInPeriod(periodMinutes)
      : this.samples;

    if (samples.length === 0) {
      return this.getEmptyReport();
    }

    const responseTimes = samples.map((s) => s.responseTime).sort((a, b) => a - b);
    const cacheHits = samples.filter((s) => s.cacheHit);
    const l1Hits = samples.filter((s) => s.cacheHit && s.layer === 'l1');
    const l2Hits = samples.filter((s) => s.cacheHit && s.layer === 'l2');

    const endpoints: Record<string, any> = {};
    this.endpointStats.forEach((stats, endpoint) => {
      endpoints[endpoint] = {
        count: stats.count,
        avgResponseTime: Math.round(stats.totalTime / stats.count),
        cacheHitRate: Math.round((stats.cacheHits / stats.count) * 10000) / 100,
      };
    });

    return {
      period: {
        start: this.startTime,
        end: now,
        duration: now.getTime() - this.startTime.getTime(),
      },
      requests: {
        total: this.requestCount,
        successful: this.requestCount - this.errorCount,
        failed: this.errorCount,
      },
      responseTimes: {
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes),
        avg: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
        median: responseTimes[Math.floor(responseTimes.length / 2)],
        p50: this.percentile(responseTimes, 50),
        p95: this.percentile(responseTimes, 95),
        p99: this.percentile(responseTimes, 99),
      },
      cache: {
        hits: cacheHits.length,
        misses: samples.length - cacheHits.length,
        hitRate: Math.round((cacheHits.length / samples.length) * 10000) / 100,
        l1HitRate: Math.round((l1Hits.length / samples.length) * 10000) / 100,
        l2HitRate: Math.round((l2Hits.length / samples.length) * 10000) / 100,
      },
      endpoints,
    };
  }

  /**
   * Get samples within a time period
   */
  private getSamplesInPeriod(minutes: number): MetricsSample[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.samples.filter((s) => s.timestamp >= cutoff);
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  /**
   * Get empty report
   */
  private getEmptyReport(): PerformanceReport {
    return {
      period: {
        start: this.startTime,
        end: new Date(),
        duration: 0,
      },
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
      },
      responseTimes: {
        min: 0,
        max: 0,
        avg: 0,
        median: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        l1HitRate: 0,
        l2HitRate: 0,
      },
      endpoints: {},
    };
  }

  /**
   * Check if performance targets are met
   */
  checkTargets(): {
    met: boolean;
    targets: Record<string, { value: number; target: number; met: boolean }>;
  } {
    const report = this.getReport();

    const targets = {
      p95ResponseTime: {
        value: report.responseTimes.p95,
        target: 100, // <100ms
        met: report.responseTimes.p95 < 100,
      },
      cacheHitRate: {
        value: report.cache.hitRate,
        target: 95, // >95%
        met: report.cache.hitRate > 95,
      },
      avgResponseTime: {
        value: report.responseTimes.avg,
        target: 50, // <50ms avg
        met: report.responseTimes.avg < 50,
      },
    };

    const met = Object.values(targets).every((t) => t.met);

    return { met, targets };
  }

  /**
   * Get slow endpoints
   */
  getSlowEndpoints(thresholdMs: number = 100): Array<{
    endpoint: string;
    avgResponseTime: number;
    count: number;
  }> {
    const slow: Array<{ endpoint: string; avgResponseTime: number; count: number }> = [];

    this.endpointStats.forEach((stats, endpoint) => {
      const avgTime = stats.totalTime / stats.count;
      if (avgTime > thresholdMs) {
        slow.push({
          endpoint,
          avgResponseTime: Math.round(avgTime),
          count: stats.count,
        });
      }
    });

    return slow.sort((a, b) => b.avgResponseTime - a.avgResponseTime);
  }

  /**
   * Get cache efficiency by layer
   */
  getCacheEfficiency(): {
    l1: { hits: number; percentage: number };
    l2: { hits: number; percentage: number };
    miss: { count: number; percentage: number };
  } {
    const total = this.samples.length;
    if (total === 0) {
      return {
        l1: { hits: 0, percentage: 0 },
        l2: { hits: 0, percentage: 0 },
        miss: { count: 0, percentage: 0 },
      };
    }

    const l1Hits = this.samples.filter((s) => s.cacheHit && s.layer === 'l1').length;
    const l2Hits = this.samples.filter((s) => s.cacheHit && s.layer === 'l2').length;
    const misses = total - l1Hits - l2Hits;

    return {
      l1: {
        hits: l1Hits,
        percentage: Math.round((l1Hits / total) * 10000) / 100,
      },
      l2: {
        hits: l2Hits,
        percentage: Math.round((l2Hits / total) * 10000) / 100,
      },
      miss: {
        count: misses,
        percentage: Math.round((misses / total) * 10000) / 100,
      },
    };
  }

  /**
   * Get real-time statistics
   */
  getRealTimeStats(): {
    requestsPerSecond: number;
    avgResponseTime: number;
    cacheHitRate: number;
    errorRate: number;
  } {
    // Get stats from last minute
    const recentSamples = this.getSamplesInPeriod(1);
    const duration = 60; // 1 minute in seconds

    if (recentSamples.length === 0) {
      return {
        requestsPerSecond: 0,
        avgResponseTime: 0,
        cacheHitRate: 0,
        errorRate: 0,
      };
    }

    const cacheHits = recentSamples.filter((s) => s.cacheHit).length;
    const avgResponseTime =
      recentSamples.reduce((sum, s) => sum + s.responseTime, 0) / recentSamples.length;

    return {
      requestsPerSecond: Math.round((recentSamples.length / duration) * 100) / 100,
      avgResponseTime: Math.round(avgResponseTime),
      cacheHitRate: Math.round((cacheHits / recentSamples.length) * 10000) / 100,
      errorRate: Math.round((this.errorCount / this.requestCount) * 10000) / 100,
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.samples = [];
    this.startTime = new Date();
    this.requestCount = 0;
    this.errorCount = 0;
    this.endpointStats.clear();
  }

  /**
   * Export metrics data
   */
  export(): {
    samples: MetricsSample[];
    stats: any;
    report: PerformanceReport;
  } {
    return {
      samples: this.samples,
      stats: {
        requestCount: this.requestCount,
        errorCount: this.errorCount,
        startTime: this.startTime,
      },
      report: this.getReport(),
    };
  }

  /**
   * Get summary statistics
   */
  getSummary(): string {
    const report = this.getReport();
    const efficiency = this.getCacheEfficiency();

    return `
Performance Summary:
--------------------
Total Requests: ${report.requests.total}
Success Rate: ${Math.round((report.requests.successful / report.requests.total) * 100)}%

Response Times:
  - Average: ${report.responseTimes.avg}ms
  - P95: ${report.responseTimes.p95}ms
  - P99: ${report.responseTimes.p99}ms

Cache Performance:
  - Hit Rate: ${report.cache.hitRate}%
  - L1 Hits: ${efficiency.l1.percentage}%
  - L2 Hits: ${efficiency.l2.percentage}%
  - Misses: ${efficiency.miss.percentage}%

Top Endpoints:
${Object.entries(report.endpoints)
  .slice(0, 5)
  .map(([endpoint, stats]) => `  - ${endpoint}: ${stats.avgResponseTime}ms (${stats.cacheHitRate}% cache hit)`)
  .join('\n')}
    `.trim();
  }
}

export default MetricsTracker;
