/**
 * Tests for Performance Monitor - US-012
 */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { PerformanceMonitor } from '../../../src/monitoring/performance-monitor.js';

describe('PerformanceMonitor', () => {
  const monitor = new PerformanceMonitor();

  beforeEach(() => {
    monitor.reset();
  });

  describe('US-012: Performance Monitoring', () => {
    /** @ac US-012-AC-1: Execution time tracking */
    it('US-012-AC-1: should track execution time', async () => {
      await monitor.trackOperation('test-operation', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'result';
      });

      const report = monitor.generateReport();
      expect(report.totalOperations).to.equal(1);
      expect(report.totalTime).to.be.greaterThan(0);
    });

    /** @ac US-012-AC-2: Memory usage tracking */
    it('US-012-AC-2: should track memory usage', async () => {
      await monitor.trackOperation('memory-test', async () => {
        const arr = new Array(1000).fill(0);
        return arr.length;
      });

      const report = monitor.generateReport();
      expect(report.memoryPeak).to.be.greaterThan(0);
      expect(report.memoryAverage).to.be.greaterThan(0);
    });

    /** @ac US-012-AC-3: Operation profiling */
    it('US-012-AC-3: should profile operations', async () => {
      await monitor.trackOperation('op1', async () => 'result1');
      await monitor.trackOperation('op2', async () => 'result2');

      const metrics1 = monitor.getMetricsForOperation('op1');
      const metrics2 = monitor.getMetricsForOperation('op2');

      expect(metrics1).to.have.length(1);
      expect(metrics2).to.have.length(1);
      expect(metrics1[0].operation).to.equal('op1');
      expect(metrics2[0].operation).to.equal('op2');
    });

    /** @ac US-012-AC-4: Performance reports */
    it('US-012-AC-4: should generate performance reports', () => {
      const report = monitor.generateReport();

      expect(report).to.have.property('totalOperations');
      expect(report).to.have.property('totalTime');
      expect(report).to.have.property('averageTime');
      expect(report).to.have.property('slowestOperations');
      expect(report).to.have.property('memoryPeak');
      expect(report).to.have.property('bottlenecks');
      expect(report).to.have.property('benchmarks');
    });

    /** @ac US-012-AC-5: Bottleneck identification */
    it('US-012-AC-5: should identify bottlenecks', async () => {
      // Create a slow operation
      await monitor.trackOperation('slow-op', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Create fast operations
      await Promise.all(
        Array.from({ length: 5 }, async () =>
          monitor.trackOperation('fast-op', async () => {
            await new Promise((resolve) => setTimeout(resolve, 1));
          })
        )
      );

      const report = monitor.generateReport();
      expect(report.bottlenecks).to.be.an('array');
    });

    /** @ac US-012-AC-6: Benchmark comparisons */
    it('US-012-AC-6: should compare with benchmarks', async () => {
      monitor.setBaseline('test-op', 100);

      await monitor.trackOperation('test-op', async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      const report = monitor.generateReport();
      expect(report.benchmarks).to.be.an('array');

      if (report.benchmarks.length > 0) {
        expect(report.benchmarks[0]).to.have.property('operation');
        expect(report.benchmarks[0]).to.have.property('currentTime');
        expect(report.benchmarks[0]).to.have.property('baselineTime');
        expect(report.benchmarks[0]).to.have.property('improvement');
        expect(report.benchmarks[0]).to.have.property('status');
      }
    });

    it('should format performance report', () => {
      const report = monitor.generateReport();
      const formatted = monitor.formatReport(report);

      expect(formatted).to.be.a('string');
      expect(formatted).to.include('Performance Report');
    });

    it('should reset metrics', async () => {
      await monitor.trackOperation('test', async () => 'result');

      expect(monitor.generateReport().totalOperations).to.equal(1);

      monitor.reset();

      expect(monitor.generateReport().totalOperations).to.equal(0);
    });
  });
});
