/**
 * Cache Health Monitoring
 * Monitor health and status of all cache layers
 */

import { CacheManager } from './cache-manager';
import { CacheHealthStatus } from './types';
import { MetricsTracker } from './metrics';

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  message?: string;
  responseTime?: number;
  lastCheck?: Date;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: Date;
  uptime: number;
  version: string;
  environment: string;
  services: {
    cache: CacheHealthStatus;
    database: HealthCheck;
    memory: {
      status: 'healthy' | 'degraded' | 'down';
      used: number;
      total: number;
      percentage: number;
      limit: number;
    };
  };
  performance: {
    requestsPerSecond: number;
    avgResponseTime: number;
    cacheHitRate: number;
    p95ResponseTime: number;
  };
  checks: HealthCheck[];
}

export class HealthMonitor {
  private cacheManager: CacheManager;
  private metricsTracker: MetricsTracker;
  private startTime: Date = new Date();
  private version: string = '2.0.0';
  private healthChecks: HealthCheck[] = [];
  private memoryLimit: number = 512 * 1024 * 1024; // 512MB default

  constructor(cacheManager: CacheManager, metricsTracker: MetricsTracker) {
    this.cacheManager = cacheManager;
    this.metricsTracker = metricsTracker;
    this.memoryLimit = parseInt(process.env.MEMORY_LIMIT || '536870912'); // 512MB
  }

  /**
   * Get comprehensive system health
   */
  async getHealth(): Promise<SystemHealth> {
    const cacheHealth = await this.cacheManager.getHealth();
    const databaseHealth = await this.checkDatabase();
    const memoryHealth = this.checkMemory();
    const performance = this.metricsTracker.getRealTimeStats();
    const report = this.metricsTracker.getReport(5); // Last 5 minutes

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'down' = 'healthy';

    if (
      cacheHealth.status === 'down' ||
      databaseHealth.status === 'down' ||
      memoryHealth.status === 'down'
    ) {
      status = 'down';
    } else if (
      cacheHealth.status === 'degraded' ||
      databaseHealth.status === 'degraded' ||
      memoryHealth.status === 'degraded'
    ) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date(),
      uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      version: this.version,
      environment: process.env.NODE_ENV || 'development',
      services: {
        cache: cacheHealth,
        database: databaseHealth,
        memory: memoryHealth,
      },
      performance: {
        requestsPerSecond: performance.requestsPerSecond,
        avgResponseTime: performance.avgResponseTime,
        cacheHitRate: performance.cacheHitRate,
        p95ResponseTime: report.responseTimes.p95,
      },
      checks: this.healthChecks,
    };
  }

  /**
   * Check cache health
   */
  async checkCache(): Promise<CacheHealthStatus> {
    return await this.cacheManager.getHealth();
  }

  /**
   * Check database health
   */
  async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // Simple database ping
      await this.cacheManager.getL3().getStats();
      const responseTime = Date.now() - startTime;

      return {
        name: 'database',
        status: responseTime < 100 ? 'healthy' : 'degraded',
        message: responseTime < 100 ? 'Database responding normally' : 'Database slow',
        responseTime,
        lastCheck: new Date(),
      };
    } catch (error: any) {
      return {
        name: 'database',
        status: 'down',
        message: `Database error: ${error.message}`,
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
      };
    }
  }

  /**
   * Check memory health
   */
  checkMemory(): {
    status: 'healthy' | 'degraded' | 'down';
    used: number;
    total: number;
    percentage: number;
    limit: number;
  } {
    const memoryUsage = process.memoryUsage();
    const used = memoryUsage.heapUsed;
    const total = memoryUsage.heapTotal;
    const percentage = Math.round((used / this.memoryLimit) * 100);

    let status: 'healthy' | 'degraded' | 'down' = 'healthy';

    if (percentage > 90) {
      status = 'down';
    } else if (percentage > 75) {
      status = 'degraded';
    }

    return {
      status,
      used: Math.round(used / 1024 / 1024), // MB
      total: Math.round(total / 1024 / 1024), // MB
      percentage,
      limit: Math.round(this.memoryLimit / 1024 / 1024), // MB
    };
  }

  /**
   * Run all health checks
   */
  async runHealthChecks(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];

    // Check cache layers
    const cacheHealth = await this.checkCache();
    checks.push({
      name: 'cache_l1',
      status: cacheHealth.l1.status === 'healthy' ? 'healthy' : 'degraded',
      message: cacheHealth.l1.message,
      lastCheck: new Date(),
    });

    checks.push({
      name: 'cache_l2',
      status: cacheHealth.l2.status === 'healthy' ? 'healthy' : 'down',
      message: cacheHealth.l2.message,
      lastCheck: new Date(),
    });

    checks.push({
      name: 'cache_l3',
      status: cacheHealth.l3.status === 'healthy' ? 'healthy' : 'degraded',
      message: cacheHealth.l3.message,
      lastCheck: new Date(),
    });

    // Check database
    const dbHealth = await this.checkDatabase();
    checks.push(dbHealth);

    // Check memory
    const memHealth = this.checkMemory();
    checks.push({
      name: 'memory',
      status: memHealth.status,
      message: `Using ${memHealth.percentage}% of allocated memory`,
      lastCheck: new Date(),
    });

    this.healthChecks = checks;
    return checks;
  }

  /**
   * Check if system is healthy
   */
  async isHealthy(): Promise<boolean> {
    const health = await this.getHealth();
    return health.status === 'healthy';
  }

  /**
   * Get simple health status
   */
  async getSimpleStatus(): Promise<{
    status: 'ok' | 'degraded' | 'down';
    message: string;
  }> {
    const health = await this.getHealth();

    const statusMap = {
      healthy: 'ok' as const,
      degraded: 'degraded' as const,
      down: 'down' as const,
    };

    return {
      status: statusMap[health.status],
      message:
        health.status === 'healthy'
          ? 'All systems operational'
          : health.status === 'degraded'
          ? 'Some systems degraded'
          : 'System down',
    };
  }

  /**
   * Monitor performance targets
   */
  checkPerformanceTargets(): {
    met: boolean;
    violations: string[];
  } {
    const report = this.metricsTracker.getReport();
    const violations: string[] = [];

    // Check p95 response time < 100ms
    if (report.responseTimes.p95 > 100) {
      violations.push(
        `P95 response time (${report.responseTimes.p95}ms) exceeds target (100ms)`
      );
    }

    // Check cache hit rate > 95%
    if (report.cache.hitRate < 95) {
      violations.push(
        `Cache hit rate (${report.cache.hitRate}%) below target (95%)`
      );
    }

    // Check average response time < 50ms
    if (report.responseTimes.avg > 50) {
      violations.push(
        `Average response time (${report.responseTimes.avg}ms) exceeds target (50ms)`
      );
    }

    return {
      met: violations.length === 0,
      violations,
    };
  }

  /**
   * Get degraded services
   */
  async getDegradedServices(): Promise<string[]> {
    const health = await this.getHealth();
    const degraded: string[] = [];

    if (health.services.cache.l1.status === 'degraded') {
      degraded.push('L1 Cache');
    }

    if (health.services.cache.l2.status === 'degraded') {
      degraded.push('L2 Cache (Redis)');
    }

    if (health.services.cache.l3.status === 'degraded') {
      degraded.push('L3 Cache (Materialized Views)');
    }

    if (health.services.database.status === 'degraded') {
      degraded.push('Database');
    }

    if (health.services.memory.status === 'degraded') {
      degraded.push('Memory');
    }

    return degraded;
  }

  /**
   * Get failed services
   */
  async getFailedServices(): Promise<string[]> {
    const health = await this.getHealth();
    const failed: string[] = [];

    if (health.services.cache.l1.status === 'down') {
      failed.push('L1 Cache');
    }

    if (health.services.cache.l2.status === 'down') {
      failed.push('L2 Cache (Redis)');
    }

    if (health.services.cache.l3.status === 'down') {
      failed.push('L3 Cache (Materialized Views)');
    }

    if (health.services.database.status === 'down') {
      failed.push('Database');
    }

    if (health.services.memory.status === 'down') {
      failed.push('Memory');
    }

    return failed;
  }

  /**
   * Start periodic health checks
   */
  startPeriodicChecks(intervalMs: number = 60000): NodeJS.Timer {
    console.log(`[Health Monitor] Starting periodic checks every ${intervalMs}ms`);

    return setInterval(async () => {
      await this.runHealthChecks();

      const health = await this.getHealth();

      if (health.status !== 'healthy') {
        console.warn('[Health Monitor] System status:', health.status);

        const degraded = await this.getDegradedServices();
        if (degraded.length > 0) {
          console.warn('[Health Monitor] Degraded services:', degraded.join(', '));
        }

        const failed = await this.getFailedServices();
        if (failed.length > 0) {
          console.error('[Health Monitor] Failed services:', failed.join(', '));
        }
      }
    }, intervalMs);
  }

  /**
   * Get uptime in seconds
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  /**
   * Get formatted uptime
   */
  getFormattedUptime(): string {
    const uptime = this.getUptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    return parts.join(' ');
  }

  /**
   * Get health summary
   */
  async getSummary(): Promise<string> {
    const health = await this.getHealth();

    return `
System Health Summary
====================
Status: ${health.status.toUpperCase()}
Uptime: ${this.getFormattedUptime()}
Version: ${health.version}
Environment: ${health.environment}

Services:
  - L1 Cache: ${health.services.cache.l1.status}
  - L2 Cache: ${health.services.cache.l2.status}
  - L3 Cache: ${health.services.cache.l3.status}
  - Database: ${health.services.database.status}
  - Memory: ${health.services.memory.status} (${health.services.memory.percentage}%)

Performance:
  - Requests/sec: ${health.performance.requestsPerSecond}
  - Avg Response: ${health.performance.avgResponseTime}ms
  - P95 Response: ${health.performance.p95ResponseTime}ms
  - Cache Hit Rate: ${health.performance.cacheHitRate}%
    `.trim();
  }
}

export default HealthMonitor;
