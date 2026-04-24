/**
 * Performance Monitoring Utilities
 *
 * Provides execution time tracking, memory profiling, and bottleneck identification
 */

import { getLogger } from './logger.js';

const logger = getLogger('PerformanceMonitor');

export type PerformanceMetrics = {
  /** Operation name */
  operation: string;
  /** Start timestamp (ms since epoch) */
  startTime: number;
  /** End timestamp (ms since epoch) */
  endTime?: number;
  /** Duration in milliseconds */
  duration?: number;
  /** Memory usage at start (bytes) */
  memoryStart: number;
  /** Memory usage at end (bytes) */
  memoryEnd?: number;
  /** Memory delta (bytes) */
  memoryDelta?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
};

export type PerformanceReport = {
  /** Total operations tracked */
  totalOperations: number;
  /** Total execution time (ms) */
  totalDuration: number;
  /** Average execution time (ms) */
  averageDuration: number;
  /** Slowest operation */
  slowest: PerformanceMetrics | null;
  /** Fastest operation */
  fastest: PerformanceMetrics | null;
  /** All operations sorted by duration */
  operations: PerformanceMetrics[];
  /** Bottlenecks (operations > 2x average) */
  bottlenecks: PerformanceMetrics[];
  /** Memory statistics */
  memory: {
    totalAllocated: number;
    averageAllocated: number;
    peakUsage: number;
  };
};

/**
 * Performance Monitor Singleton
 *
 * @ac US-012-AC-1: Execution time tracking
 * @ac US-012-AC-2: Memory usage tracking
 * @ac US-012-AC-3: Operation profiling
 */
class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private completedMetrics: PerformanceMetrics[] = [];

  private constructor() {
    logger.debug('Performance Monitor initialized');
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  public static resetInstance(): void {
    if (PerformanceMonitor.instance) {
      PerformanceMonitor.instance.clear();
    }
    // @ts-expect-error - Resetting singleton for tests
    PerformanceMonitor.instance = undefined;
  }

  /**
   * Start tracking an operation
   *
   * @ac US-012-AC-1: Execution time tracking
   * @ac US-012-AC-2: Memory usage tracking
   */
  public start(operation: string, metadata?: Record<string, unknown>): string {
    const id = `${operation}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const metric: PerformanceMetrics = {
      operation,
      startTime: Date.now(),
      memoryStart: this.getMemoryUsage(),
      metadata,
    };

    this.metrics.set(id, metric);
    logger.debug(`Performance tracking started: ${operation}`, { id, metadata });

    return id;
  }

  /**
   * End tracking an operation
   *
   * @ac US-012-AC-1: Execution time tracking
   * @ac US-012-AC-2: Memory usage tracking
   */
  public end(id: string): PerformanceMetrics | null {
    const metric = this.metrics.get(id);
    if (!metric) {
      logger.warn(`Performance metric not found: ${id}`);
      return null;
    }

    metric.endTime = Date.now();
    metric.duration = metric.endTime - metric.startTime;
    metric.memoryEnd = this.getMemoryUsage();
    metric.memoryDelta = metric.memoryEnd - metric.memoryStart;

    this.completedMetrics.push(metric);
    this.metrics.delete(id);

    logger.debug(`Performance tracking ended: ${metric.operation}`, {
      duration: `${metric.duration}ms`,
      memoryDelta: this.formatBytes(metric.memoryDelta),
    });

    return metric;
  }

  /**
   * Track a synchronous function execution
   *
   * @ac US-012-AC-1: Execution time tracking
   * @ac US-012-AC-3: Operation profiling
   */
  public track<T>(operation: string, fn: () => T, metadata?: Record<string, unknown>): T {
    const id = this.start(operation, metadata);
    try {
      const result = fn();
      this.end(id);
      return result;
    } catch (error) {
      this.end(id);
      throw error;
    }
  }

  /**
   * Track an asynchronous function execution
   *
   * @ac US-012-AC-1: Execution time tracking
   * @ac US-012-AC-3: Operation profiling
   */
  public async trackAsync<T>(operation: string, fn: () => Promise<T>, metadata?: Record<string, unknown>): Promise<T> {
    const id = this.start(operation, metadata);
    try {
      const result = await fn();
      this.end(id);
      return result;
    } catch (error) {
      this.end(id);
      throw error;
    }
  }

  /**
   * Generate performance report
   *
   * @ac US-012-AC-4: Performance reports
   * @ac US-012-AC-5: Bottleneck identification
   */
  public generateReport(): PerformanceReport {
    const operations = [...this.completedMetrics].filter((m) => m.duration !== undefined);

    if (operations.length === 0) {
      return {
        totalOperations: 0,
        totalDuration: 0,
        averageDuration: 0,
        slowest: null,
        fastest: null,
        operations: [],
        bottlenecks: [],
        memory: {
          totalAllocated: 0,
          averageAllocated: 0,
          peakUsage: 0,
        },
      };
    }

    // Sort by duration (slowest first)
    operations.sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0));

    const totalDuration = operations.reduce((sum, op) => sum + (op.duration ?? 0), 0);
    const averageDuration = totalDuration / operations.length;

    // Ignore timer jitter for sub-5ms work; otherwise short operations with 0/1ms
    // variance produce false bottlenecks in CI.
    const bottlenecks = operations.filter((op) => {
      const duration = op.duration ?? 0;
      return duration >= 5 && duration > averageDuration * 2;
    });

    // Memory statistics
    const memoryDeltas = operations.map((op) => op.memoryDelta ?? 0);
    const totalMemory = memoryDeltas.reduce((sum, delta) => sum + delta, 0);
    const peakMemory = Math.max(...operations.map((op) => op.memoryEnd ?? 0));

    const report: PerformanceReport = {
      totalOperations: operations.length,
      totalDuration,
      averageDuration,
      slowest: operations[0] ?? null,
      fastest: operations[operations.length - 1] ?? null,
      operations,
      bottlenecks,
      memory: {
        totalAllocated: totalMemory,
        averageAllocated: totalMemory / operations.length,
        peakUsage: peakMemory,
      },
    };

    logger.info('Performance report generated', {
      totalOperations: report.totalOperations,
      totalDuration: `${report.totalDuration.toFixed(2)}ms`,
      averageDuration: `${report.averageDuration.toFixed(2)}ms`,
      bottlenecks: report.bottlenecks.length,
    });

    return report;
  }

  /**
   * Get metrics for a specific operation
   *
   * @ac US-012-AC-3: Operation profiling
   */
  public getOperationMetrics(operationName: string): PerformanceMetrics[] {
    return this.completedMetrics.filter((m) => m.operation === operationName);
  }

  /**
   * Compare two operations (benchmarking)
   *
   * @ac US-012-AC-6: Benchmark comparisons
   */
  public compare(
    operation1: string,
    operation2: string
  ): {
    operation1: PerformanceMetrics[];
    operation2: PerformanceMetrics[];
    comparison: {
      averageDuration1: number;
      averageDuration2: number;
      faster: string;
      speedup: number;
      memoryDiff: number;
    };
  } {
    const metrics1 = this.getOperationMetrics(operation1);
    const metrics2 = this.getOperationMetrics(operation2);

    const avgDuration1 = metrics1.reduce((sum, m) => sum + (m.duration ?? 0), 0) / (metrics1.length || 1);
    const avgDuration2 = metrics2.reduce((sum, m) => sum + (m.duration ?? 0), 0) / (metrics2.length || 1);

    const avgMemory1 = metrics1.reduce((sum, m) => sum + (m.memoryDelta ?? 0), 0) / (metrics1.length || 1);
    const avgMemory2 = metrics2.reduce((sum, m) => sum + (m.memoryDelta ?? 0), 0) / (metrics2.length || 1);

    const faster = avgDuration1 < avgDuration2 ? operation1 : operation2;
    const speedup = Math.abs(avgDuration2 / avgDuration1);

    logger.info(`Benchmark comparison: ${operation1} vs ${operation2}`, {
      faster,
      speedup: `${speedup.toFixed(2)}x`,
      avgDuration1: `${avgDuration1.toFixed(2)}ms`,
      avgDuration2: `${avgDuration2.toFixed(2)}ms`,
    });

    return {
      operation1: metrics1,
      operation2: metrics2,
      comparison: {
        averageDuration1: avgDuration1,
        averageDuration2: avgDuration2,
        faster,
        speedup,
        memoryDiff: avgMemory2 - avgMemory1,
      },
    };
  }

  /**
   * Clear all metrics
   */
  public clear(): void {
    this.metrics.clear();
    this.completedMetrics = [];
    logger.debug('Performance metrics cleared');
  }

  /**
   * Get current memory usage
   *
   * @ac US-012-AC-2: Memory usage tracking
   */
  // eslint-disable-next-line class-methods-use-this
  private getMemoryUsage(): number {
    return process?.memoryUsage?.()?.heapUsed ?? 0;
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    if (bytes < 0) return `-${this.formatBytes(-bytes)}`;

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

/**
 * Decorator for tracking method execution time
 *
 * @ac US-012-AC-3: Operation profiling
 */
export function Profile(
  operationName?: string
): (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => void {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor): void {
    const originalMethod = descriptor.value as (...args: unknown[]) => unknown;
    const operation =
      operationName ??
      `${(target as { constructor?: { name?: string } })?.constructor?.name ?? 'Unknown'}.${propertyKey}`;

    const profiledMethod = function (this: unknown, ...args: unknown[]): unknown {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return performanceMonitor.track(operation, () => originalMethod.apply(this, args));
    };

    Object.defineProperty(descriptor, 'value', {
      configurable: true,
      enumerable: descriptor.enumerable ?? false,
      writable: true,
      value: profiledMethod,
    });
  };
}

/**
 * Decorator for tracking async method execution time
 *
 * @ac US-012-AC-3: Operation profiling
 */
export function ProfileAsync(
  operationName?: string
): (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => void {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor): void {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;
    const operation =
      operationName ??
      `${(target as { constructor?: { name?: string } })?.constructor?.name ?? 'Unknown'}.${propertyKey}`;

    const profiledMethod = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return performanceMonitor.trackAsync(operation, () => originalMethod.apply(this, args));
    };

    Object.defineProperty(descriptor, 'value', {
      configurable: true,
      enumerable: descriptor.enumerable ?? false,
      writable: true,
      value: profiledMethod,
    });
  };
}

logger.debug('Performance monitoring utilities loaded');
