/**
 * Database Connection Pool Manager
 * Manages Prisma connection pooling and optimization
 */

import { PrismaClient } from '@prisma/client';

export interface ConnectionPoolConfig {
  maxConnections?: number;
  minConnections?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
  maxLifetime?: number;
}

export interface PoolStats {
  total: number;
  active: number;
  idle: number;
  waiting: number;
}

export class ConnectionPool {
  private static instance: PrismaClient | null = null;
  private static config: ConnectionPoolConfig = {};
  private static connectionCount = 0;
  private static activeQueries = 0;

  /**
   * Initialize connection pool
   */
  static initialize(config?: ConnectionPoolConfig): PrismaClient {
    if (this.instance) {
      return this.instance;
    }

    this.config = {
      maxConnections: config?.maxConnections || parseInt(process.env.DATABASE_POOL_SIZE || '10'),
      minConnections: config?.minConnections || 2,
      connectionTimeout: config?.connectionTimeout || 30000, // 30s
      idleTimeout: config?.idleTimeout || 300000, // 5min
      maxLifetime: config?.maxLifetime || 3600000, // 1 hour
    };

    // Build connection URL with pool settings
    const databaseUrl = this.buildConnectionUrl();

    this.instance = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });

    // Track query events
    this.instance.$on('query' as any, (e: any) => {
      this.activeQueries++;
      setTimeout(() => {
        this.activeQueries--;
      }, e.duration);
    });

    this.instance.$on('error' as any, (e: any) => {
      console.error('[Connection Pool] Error:', e);
    });

    console.log('[Connection Pool] Initialized with config:', {
      maxConnections: this.config.maxConnections,
      minConnections: this.config.minConnections,
    });

    return this.instance;
  }

  /**
   * Get Prisma instance
   */
  static getInstance(): PrismaClient {
    if (!this.instance) {
      return this.initialize();
    }
    return this.instance;
  }

  /**
   * Build connection URL with pool parameters
   */
  private static buildConnectionUrl(): string {
    const baseUrl = process.env.DATABASE_URL || '';

    if (!baseUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    // Parse URL and add pool parameters
    const url = new URL(baseUrl);
    const params = new URLSearchParams(url.search);

    // Add pool parameters
    params.set('connection_limit', this.config.maxConnections!.toString());
    params.set('pool_timeout', (this.config.connectionTimeout! / 1000).toString());

    url.search = params.toString();
    return url.toString();
  }

  /**
   * Execute query with connection from pool
   */
  static async executeQuery<T>(
    queryFn: (prisma: PrismaClient) => Promise<T>
  ): Promise<T> {
    const prisma = this.getInstance();
    this.connectionCount++;

    try {
      const result = await queryFn(prisma);
      return result;
    } finally {
      this.connectionCount--;
    }
  }

  /**
   * Execute transaction
   */
  static async executeTransaction<T>(
    transactionFn: (prisma: PrismaClient) => Promise<T>
  ): Promise<T> {
    const prisma = this.getInstance();

    return await prisma.$transaction(async (tx) => {
      return await transactionFn(tx as PrismaClient);
    });
  }

  /**
   * Get pool statistics
   */
  static getStats(): PoolStats {
    return {
      total: this.config.maxConnections || 0,
      active: this.activeQueries,
      idle: (this.config.maxConnections || 0) - this.activeQueries,
      waiting: 0, // Not tracked in Prisma
    };
  }

  /**
   * Check pool health
   */
  static async checkHealth(): Promise<boolean> {
    try {
      const prisma = this.getInstance();
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('[Connection Pool] Health check failed:', error);
      return false;
    }
  }

  /**
   * Disconnect all connections
   */
  static async disconnect(): Promise<void> {
    if (this.instance) {
      await this.instance.$disconnect();
      this.instance = null;
      console.log('[Connection Pool] Disconnected');
    }
  }

  /**
   * Test connection
   */
  static async testConnection(): Promise<boolean> {
    try {
      const prisma = this.getInstance();
      await prisma.$connect();
      console.log('[Connection Pool] Connection test successful');
      return true;
    } catch (error: any) {
      console.error('[Connection Pool] Connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Get connection info
   */
  static getInfo(): any {
    return {
      config: this.config,
      stats: this.getStats(),
      instanceExists: this.instance !== null,
    };
  }

  /**
   * Warm up connection pool
   */
  static async warmup(): Promise<void> {
    console.log('[Connection Pool] Warming up...');

    const prisma = this.getInstance();

    try {
      // Execute a simple query to establish connections
      await prisma.$queryRaw`SELECT 1`;
      console.log('[Connection Pool] Warmup complete');
    } catch (error: any) {
      console.error('[Connection Pool] Warmup failed:', error.message);
    }
  }
}

export default ConnectionPool;
