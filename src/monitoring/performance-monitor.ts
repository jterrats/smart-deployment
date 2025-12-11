/**
 * Performance Monitor - US-012
 * Comprehensive performance monitoring and bottleneck identification
 *
 * @ac US-012-AC-1: Execution time tracking
 * @ac US-012-AC-2: Memory usage tracking
 * @ac US-012-AC-3: Operation profiling
 * @ac US-012-AC-4: Performance reports
 * @ac US-012-AC-5: Bottleneck identification
 * @ac US-012-AC-6: Benchmark comparisons
 * @issue #12
 */

import { performance } from 'node:perf_hooks';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('PerformanceMonitor');

export interface PerformanceMetric {
  operation: string;
  executionTime: number;
  memoryBefore: number;
  memoryAfter: number;
  memoryDelta: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface PerformanceReport {
  totalOperations: number;
  totalTime: number;
  averageTime: number;
  slowestOperations: PerformanceMetric[];
  memoryPeak: number;
  memoryAverage: number;
  bottlenecks: Bottleneck[];
  benchmarks: BenchmarkComparison[];
}

export interface Bottleneck {
  operation: string;
  executionTime: number;
  percentage: number;
  suggestion: string;
}

export interface BenchmarkComparison {
  operation: string;
  currentTime: number;
  baselineTime: number;
  improvement: number;
  status: 'improved' | 'degraded' | 'stable';
}

/**
 * @ac US-012-AC-1: Execution time tracking
 * @ac US-012-AC-2: Memory usage tracking
 * @ac US-012-AC-3: Operation profiling
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private baselines: Map<string, number> = new Map();

  /**
   * @ac US-012-AC-1: Execution time tracking
   * Track execution time for an operation
   */
  public async trackOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const memoryBefore = this.getMemoryUsage();
    const startTime = performance.now();

    try {
      const result = await fn();
      const endTime = performance.now();
      const memoryAfter = this.getMemoryUsage();

      const metric: PerformanceMetric = {
        operation,
        executionTime: endTime - startTime,
        memoryBefore,
        memoryAfter,
        memoryDelta: memoryAfter - memoryBefore,
        timestamp: new Date(),
        metadata,
      };

      this.metrics.push(metric);
      logger.debug('Operation tracked', {
        operation,
        executionTime: metric.executionTime,
        memoryDelta: metric.memoryDelta,
      });

      return result;
    } catch (error) {
      const endTime = performance.now();
      const memoryAfter = this.getMemoryUsage();

      const metric: PerformanceMetric = {
        operation,
        executionTime: endTime - startTime,
        memoryBefore,
        memoryAfter,
        memoryDelta: memoryAfter - memoryBefore,
        timestamp: new Date(),
        metadata: {
          ...metadata,
          error: error instanceof Error ? error.message : String(error),
        },
      };

      this.metrics.push(metric);
      throw error;
    }
  }

  /**
   * @ac US-012-AC-2: Memory usage tracking
   * Get current memory usage
   */
  private getMemoryUsage(): number {
    const usage = process.memoryUsage();
    return usage.heapUsed;
  }

  /**
   * @ac US-012-AC-4: Performance reports
   * Generate performance report
   */
  public generateReport(): PerformanceReport {
    if (this.metrics.length === 0) {
      return {
        totalOperations: 0,
        totalTime: 0,
        averageTime: 0,
        slowestOperations: [],
        memoryPeak: 0,
        memoryAverage: 0,
        bottlenecks: [],
        benchmarks: [],
      };
    }

    const totalTime = this.metrics.reduce((sum, m) => sum + m.executionTime, 0);
    const averageTime = totalTime / this.metrics.length;

    // Find slowest operations
    const slowestOperations = [...this.metrics]
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 10);

    // Calculate memory stats
    const memoryValues = this.metrics.map((m) => m.memoryAfter);
    const memoryPeak = Math.max(...memoryValues);
    const memoryAverage = memoryValues.reduce((sum, m) => sum + m, 0) / memoryValues.length;

    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(totalTime);

    // Compare with benchmarks
    const benchmarks = this.compareBenchmarks();

    logger.info('Performance report generated', {
      totalOperations: this.metrics.length,
      totalTime,
      averageTime,
      bottlenecks: bottlenecks.length,
    });

    return {
      totalOperations: this.metrics.length,
      totalTime,
      averageTime,
      slowestOperations,
      memoryPeak,
      memoryAverage,
      bottlenecks,
      benchmarks,
    };
  }

  /**
   * @ac US-012-AC-5: Bottleneck identification
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(totalTime: number): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // Group by operation
    const operationGroups = new Map<string, PerformanceMetric[]>();
    for (const metric of this.metrics) {
      const existing = operationGroups.get(metric.operation) || [];
      existing.push(metric);
      operationGroups.set(metric.operation, existing);
    }

    for (const [operation, metrics] of operationGroups.entries()) {
      const operationTotalTime = metrics.reduce((sum, m) => sum + m.executionTime, 0);
      const percentage = (operationTotalTime / totalTime) * 100;

      // Consider bottleneck if > 20% of total time or > 1 second average
      const averageTime = operationTotalTime / metrics.length;
      if (percentage > 20 || averageTime > 1000) {
        bottlenecks.push({
          operation,
          executionTime: operationTotalTime,
          percentage,
          suggestion: this.getSuggestion(operation, averageTime, percentage),
        });
      }
    }

    return bottlenecks.sort((a, b) => b.percentage - a.percentage);
  }

  /**
   * Get suggestion for bottleneck
   */
  private getSuggestion(operation: string, averageTime: number, percentage: number): string {
    if (percentage > 50) {
      return `Consider optimizing ${operation} - it takes ${percentage.toFixed(1)}% of total time`;
    }

    if (averageTime > 5000) {
      return `Consider caching or parallelizing ${operation} - average time: ${averageTime.toFixed(0)}ms`;
    }

    return `Review ${operation} for optimization opportunities`;
  }

  /**
   * @ac US-012-AC-6: Benchmark comparisons
   * Compare with baseline benchmarks
   */
  private compareBenchmarks(): BenchmarkComparison[] {
    const comparisons: BenchmarkComparison[] = [];

    // Group by operation
    const operationGroups = new Map<string, PerformanceMetric[]>();
    for (const metric of this.metrics) {
      const existing = operationGroups.get(metric.operation) || [];
      existing.push(metric);
      operationGroups.set(metric.operation, existing);
    }

    for (const [operation, metrics] of operationGroups.entries()) {
      const currentTime = metrics.reduce((sum, m) => sum + m.executionTime, 0) / metrics.length;
      const baselineTime = this.baselines.get(operation);

      if (baselineTime) {
        const improvement = ((baselineTime - currentTime) / baselineTime) * 100;
        let status: 'improved' | 'degraded' | 'stable' = 'stable';

        if (improvement > 10) {
          status = 'improved';
        } else if (improvement < -10) {
          status = 'degraded';
        }

        comparisons.push({
          operation,
          currentTime,
          baselineTime,
          improvement,
          status,
        });
      }
    }

    return comparisons;
  }

  /**
   * Set baseline for benchmarking
   */
  public setBaseline(operation: string, time: number): void {
    this.baselines.set(operation, time);
    logger.debug('Baseline set', { operation, time });
  }

  /**
   * Format performance report
   */
  public formatReport(report: PerformanceReport): string {
    const lines: string[] = [];

    lines.push('⚡ Performance Report');
    lines.push('═══════════════════════════════════════');
    lines.push(`Total Operations: ${report.totalOperations}`);
    lines.push(`Total Time: ${report.totalTime.toFixed(2)}ms`);
    lines.push(`Average Time: ${report.averageTime.toFixed(2)}ms`);
    lines.push(`Memory Peak: ${(report.memoryPeak / 1024 / 1024).toFixed(2)} MB`);
    lines.push(`Memory Average: ${(report.memoryAverage / 1024 / 1024).toFixed(2)} MB`);
    lines.push('');

    if (report.slowestOperations.length > 0) {
      lines.push('🐌 Slowest Operations:');
      for (const [index, op] of report.slowestOperations.slice(0, 5).entries()) {
        lines.push(`  ${index + 1}. ${op.operation}: ${op.executionTime.toFixed(2)}ms`);
      }
      lines.push('');
    }

    if (report.bottlenecks.length > 0) {
      lines.push('⚠️  Bottlenecks:');
      for (const bottleneck of report.bottlenecks) {
        lines.push(`  • ${bottleneck.operation}: ${bottleneck.percentage.toFixed(1)}%`);
        lines.push(`    ${bottleneck.suggestion}`);
      }
      lines.push('');
    }

    if (report.benchmarks.length > 0) {
      lines.push('📊 Benchmark Comparisons:');
      for (const benchmark of report.benchmarks) {
        const icon = benchmark.status === 'improved' ? '✅' : benchmark.status === 'degraded' ? '❌' : '➡️';
        lines.push(`  ${icon} ${benchmark.operation}: ${benchmark.improvement.toFixed(1)}%`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Reset metrics
   */
  public reset(): void {
    this.metrics = [];
    logger.info('Performance metrics reset');
  }

  /**
   * Get metrics for specific operation
   */
  public getMetricsForOperation(operation: string): PerformanceMetric[] {
    return this.metrics.filter((m) => m.operation === operation);
  }
}

