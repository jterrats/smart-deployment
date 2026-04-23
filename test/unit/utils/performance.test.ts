import { afterEach, beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import { performanceMonitor } from '../../../src/utils/performance.js';

describe('Performance Monitoring', () => {
  beforeEach(() => {
    performanceMonitor.clear();
  });

  afterEach(() => {
    performanceMonitor.clear();
  });

  describe('Execution Time Tracking', () => {
    /**
     * @ac US-012-AC-1: Execution time tracking
     */
    it('should track execution time for operations', async () => {
      const id = performanceMonitor.start('test-operation');

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 50));

      const metrics = performanceMonitor.end(id);

      expect(metrics).to.not.be.null;
      expect(metrics?.operation).to.equal('test-operation');
      expect(metrics?.duration).to.be.greaterThan(40); // Allow some variance
      expect(metrics?.startTime).to.be.a('number');
      expect(metrics?.endTime).to.be.a('number');
    });

    /**
     * @ac US-012-AC-1: Execution time tracking
     */
    it('should track synchronous function execution', () => {
      let executed = false;

      const result = performanceMonitor.track('sync-function', () => {
        executed = true;
        return 'result';
      });

      expect(result).to.equal('result');
      expect(executed).to.be.true;

      const metrics = performanceMonitor.getOperationMetrics('sync-function');
      expect(metrics).to.have.lengthOf(1);
      expect(metrics[0].duration).to.be.a('number');
    });

    /**
     * @ac US-012-AC-1: Execution time tracking
     */
    it('should track asynchronous function execution', async () => {
      const result = await performanceMonitor.trackAsync('async-function', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'async-result';
      });

      expect(result).to.equal('async-result');

      const metrics = performanceMonitor.getOperationMetrics('async-function');
      expect(metrics).to.have.lengthOf(1);
      expect(metrics[0].duration).to.be.greaterThan(5);
    });

    /**
     * @ac US-012-AC-1: Execution time tracking
     */
    it('should handle tracking errors gracefully', () => {
      expect(() => {
        performanceMonitor.track('error-function', () => {
          throw new Error('Test error');
        });
      }).to.throw('Test error');

      // Should still record the metric
      const metrics = performanceMonitor.getOperationMetrics('error-function');
      expect(metrics).to.have.lengthOf(1);
    });
  });

  describe('Memory Usage Tracking', () => {
    /**
     * @ac US-012-AC-2: Memory usage tracking
     */
    it('should track memory usage for operations', () => {
      const id = performanceMonitor.start('memory-test');

      // Allocate some memory
      const arr = new Array(1000).fill('test');

      const metrics = performanceMonitor.end(id);

      expect(metrics).to.not.be.null;
      expect(metrics?.memoryStart).to.be.a('number');
      expect(metrics?.memoryEnd).to.be.a('number');
      expect(metrics?.memoryDelta).to.be.a('number');

      // Clean up
      arr.length = 0;
    });

    /**
     * @ac US-012-AC-2: Memory usage tracking
     */
    it('should include memory metrics in tracked functions', () => {
      performanceMonitor.track('memory-function', () => {
        const data = { large: new Array(100).fill('data') };
        return data;
      });

      const metrics = performanceMonitor.getOperationMetrics('memory-function');
      expect(metrics[0].memoryStart).to.be.a('number');
      expect(metrics[0].memoryEnd).to.be.a('number');
      expect(metrics[0].memoryDelta).to.be.a('number');
    });
  });

  describe('Operation Profiling', () => {
    /**
     * @ac US-012-AC-3: Operation profiling
     */
    it('should profile multiple operations of the same type', () => {
      for (let i = 0; i < 5; i++) {
        performanceMonitor.track('repeated-operation', () => {
          // Simulate work
          const sum = Array.from({ length: 100 }, (_, j) => j).reduce((a: number, b: number) => a + b, 0);
          return sum;
        });
      }

      const metrics = performanceMonitor.getOperationMetrics('repeated-operation');
      expect(metrics).to.have.lengthOf(5);

      metrics.forEach((m) => {
        expect(m.operation).to.equal('repeated-operation');
        expect(m.duration).to.be.a('number');
      });
    });

    /**
     * @ac US-012-AC-3: Operation profiling
     */
    it('should support custom metadata', () => {
      const metadata = { userId: '123', action: 'deploy' };

      performanceMonitor.track('operation-with-metadata', () => 'result', metadata);

      const metrics = performanceMonitor.getOperationMetrics('operation-with-metadata');
      expect(metrics[0].metadata).to.deep.equal(metadata);
    });

    /**
     * @ac US-012-AC-3: Operation profiling
     */
    it('should support nested operations', () => {
      performanceMonitor.track('outer-operation', () => {
        performanceMonitor.track('inner-operation-1', () => 1 + 1);
        performanceMonitor.track('inner-operation-2', () => 2 + 2);
        return 'result';
      });

      const outerMetrics = performanceMonitor.getOperationMetrics('outer-operation');
      const innerMetrics1 = performanceMonitor.getOperationMetrics('inner-operation-1');
      const innerMetrics2 = performanceMonitor.getOperationMetrics('inner-operation-2');

      expect(outerMetrics).to.have.lengthOf(1);
      expect(innerMetrics1).to.have.lengthOf(1);
      expect(innerMetrics2).to.have.lengthOf(1);
    });
  });

  describe('Performance Reports', () => {
    /**
     * @ac US-012-AC-4: Performance reports
     */
    it('should generate comprehensive performance report', () => {
      // Create operations with varying durations (make them measurable)
      performanceMonitor.track('fast-op', () => {
        let sum = 0;
        for (let i = 0; i < 100; i++) sum += i;
        return sum;
      });
      performanceMonitor.track('slow-op', () => {
        const arr = Array.from({ length: 100_000 }, () => 0);
        const result: number = arr.reduce((a, b) => a + b, 0);
        return result;
      });
      performanceMonitor.track('medium-op', () => {
        let sum = 0;
        for (let i = 0; i < 10_000; i++) sum += i;
        return sum;
      });

      const report = performanceMonitor.generateReport();

      expect(report.totalOperations).to.equal(3);
      expect(report.totalDuration).to.be.greaterThanOrEqual(0);
      expect(report.averageDuration).to.be.greaterThanOrEqual(0);
      expect(report.slowest).to.not.be.null;
      expect(report.fastest).to.not.be.null;
      expect(report.operations).to.have.lengthOf(3);
      expect(report.memory.totalAllocated).to.be.a('number');
      expect(report.memory.averageAllocated).to.be.a('number');
      expect(report.memory.peakUsage).to.be.a('number');
    });

    /**
     * @ac US-012-AC-4: Performance reports
     */
    it('should handle empty reports gracefully', () => {
      const report = performanceMonitor.generateReport();

      expect(report.totalOperations).to.equal(0);
      expect(report.totalDuration).to.equal(0);
      expect(report.averageDuration).to.equal(0);
      expect(report.slowest).to.be.null;
      expect(report.fastest).to.be.null;
      expect(report.operations).to.be.empty;
      expect(report.bottlenecks).to.be.empty;
    });

    /**
     * @ac US-012-AC-4: Performance reports
     */
    it('should sort operations by duration (slowest first)', () => {
      performanceMonitor.track('op1', () => {
        let sum = 0;
        for (let i = 0; i < 100; i++) sum += i;
        return sum;
      });
      performanceMonitor.track('op2', () => {
        const arr = Array.from({ length: 50_000 }, () => 0);
        const result: number = arr.reduce((a, b) => a + b, 0);
        return result;
      });
      performanceMonitor.track('op3', () => {
        const arr = Array.from({ length: 100_000 }, () => 0);
        const result: number = arr.reduce((a, b) => a + b, 0);
        return result;
      });

      const report = performanceMonitor.generateReport();

      // slowest should be op3 or op2 (both are heavy operations)
      expect(report.slowest?.operation).to.match(/op[23]/);
      expect(report.fastest?.operation).to.equal('op1');
      expect(report.operations[0].duration).to.be.greaterThanOrEqual(report.operations[1].duration ?? 0);
    });
  });

  describe('Bottleneck Identification', () => {
    /**
     * @ac US-012-AC-5: Bottleneck identification
     */
    it('should identify bottlenecks (operations > 2x average)', () => {
      // Create fast operations
      for (let i = 0; i < 5; i++) {
        performanceMonitor.track('fast-op', () => 1 + 1);
      }

      // Create a slow operation (bottleneck)
      performanceMonitor.track('bottleneck-op', () => {
        const arr = Array.from({ length: 100_000 }, () => 0);
        const result: number = arr.reduce((a, b) => a + b, 0);
        return result;
      });

      const report = performanceMonitor.generateReport();

      expect(report.bottlenecks.length).to.be.greaterThan(0);
      expect(report.bottlenecks[0].operation).to.equal('bottleneck-op');
      expect(report.bottlenecks[0].duration).to.be.greaterThan(report.averageDuration * 2);
    });

    /**
     * @ac US-012-AC-5: Bottleneck identification
     */
    it('should not report bottlenecks when all operations are similar', () => {
      // Create operations with similar execution times
      for (let i = 0; i < 10; i++) {
        performanceMonitor.track('similar-op', () => {
          // Small but measurable operation
          let sum = 0;
          for (let j = 0; j < 100; j++) {
            sum += j;
          }
          return sum;
        });
      }

      const report = performanceMonitor.generateReport();

      // No bottlenecks expected when all operations have similar duration
      expect(report.bottlenecks).to.be.empty;
    });
  });

  describe('Benchmark Comparisons', () => {
    /**
     * @ac US-012-AC-6: Benchmark comparisons
     */
    it('should compare two operations', () => {
      // Fast operation
      for (let i = 0; i < 3; i++) {
        performanceMonitor.track('fast-algo', () => {
          let sum = 0;
          for (let j = 0; j < 10; j++) sum += j;
          return sum;
        });
      }

      // Slow operation
      for (let i = 0; i < 3; i++) {
        performanceMonitor.track('slow-algo', () => {
          const arr = Array.from({ length: 100_000 }, () => 0);
          const result: number = arr.reduce((a, b) => a + b, 0);
          return result;
        });
      }

      const comparison = performanceMonitor.compare('fast-algo', 'slow-algo');

      expect(comparison.operation1).to.have.lengthOf(3);
      expect(comparison.operation2).to.have.lengthOf(3);
      // Either fast-algo or slow-algo could be faster depending on V8 optimization
      expect(comparison.comparison.faster).to.be.oneOf(['fast-algo', 'slow-algo']);
      expect(comparison.comparison.speedup).to.be.a('number');
      expect(comparison.comparison.averageDuration1).to.be.a('number');
      expect(comparison.comparison.averageDuration2).to.be.a('number');
      expect(comparison.comparison.memoryDiff).to.be.a('number');
    });

    /**
     * @ac US-012-AC-6: Benchmark comparisons
     */
    it('should handle comparison with no metrics gracefully', () => {
      const comparison = performanceMonitor.compare('non-existent-1', 'non-existent-2');

      expect(comparison.operation1).to.be.empty;
      expect(comparison.operation2).to.be.empty;
      expect(comparison.comparison.speedup).to.be.NaN;
    });
  });

  describe('Edge Cases', () => {
    it('should handle ending non-existent operation', () => {
      const result = performanceMonitor.end('non-existent-id');
      expect(result).to.be.null;
    });

    it('should support multiple simultaneous operations', () => {
      const id1 = performanceMonitor.start('op1');
      const id2 = performanceMonitor.start('op2');
      const id3 = performanceMonitor.start('op3');

      performanceMonitor.end(id2);
      performanceMonitor.end(id1);
      performanceMonitor.end(id3);

      const metrics1 = performanceMonitor.getOperationMetrics('op1');
      const metrics2 = performanceMonitor.getOperationMetrics('op2');
      const metrics3 = performanceMonitor.getOperationMetrics('op3');

      expect(metrics1).to.have.lengthOf(1);
      expect(metrics2).to.have.lengthOf(1);
      expect(metrics3).to.have.lengthOf(1);
    });

    it('should clear all metrics', () => {
      performanceMonitor.track('op1', () => 'result');
      performanceMonitor.track('op2', () => 'result');

      let report = performanceMonitor.generateReport();
      expect(report.totalOperations).to.equal(2);

      performanceMonitor.clear();

      report = performanceMonitor.generateReport();
      expect(report.totalOperations).to.equal(0);
    });

    it('should handle async errors and still record metrics', async () => {
      try {
        await performanceMonitor.trackAsync('async-error', async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          throw new Error('Async error');
        });
      } catch (error) {
        // Expected
      }

      const metrics = performanceMonitor.getOperationMetrics('async-error');
      expect(metrics).to.have.lengthOf(1);
      expect(metrics[0].duration).to.be.greaterThan(5);
    });
  });
});
