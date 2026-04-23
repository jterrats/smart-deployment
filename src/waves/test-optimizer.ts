/**
 * Test Optimizer
 * Optimizes test execution per wave to reduce deployment time
 *
 * @ac US-040-AC-1: Identify waves with Apex/Trigger changes
 * @ac US-040-AC-2: Include tests only in waves with code
 * @ac US-040-AC-3: Sync test classes with production classes
 * @ac US-040-AC-4: Ensure trigger tests are included
 * @ac US-040-AC-5: Calculate test coverage per wave
 * @ac US-040-AC-6: Report test optimization savings
 *
 * @issue #40
 */

import type { NodeId } from '../types/dependency.js';
import { getLogger } from '../utils/logger.js';
import type { Wave } from './wave-builder.js';

const logger = getLogger('TestOptimizer');

/**
 * Test optimization result
 */
export type TestOptimizationResult = {
  /** Original waves */
  originalWaves: Wave[];
  /** Optimized waves with test classes */
  optimizedWaves: OptimizedWave[];
  /** Optimization decisions */
  decisions: OptimizationDecision[];
  /** Statistics */
  stats: OptimizationStats;
};

/**
 * Optimized wave with test information
 */
export type OptimizedWave = Wave & {
  /** Test classes included in this wave */
  testClasses: NodeId[];
  /** Code classes in this wave */
  codeClasses: NodeId[];
  /** Triggers in this wave */
  triggers: NodeId[];
  /** Needs test execution */
  needsTests: boolean;
  /** Estimated test coverage % */
  estimatedCoverage: number;
};

/**
 * Optimization decision
 */
export type OptimizationDecision = {
  /** Wave number */
  waveNumber: number;
  /** Decision type */
  type: 'include-tests' | 'skip-tests' | 'sync-tests';
  /** Reason for decision */
  reason: string;
  /** Tests affected */
  testsAffected: number;
};

/**
 * Optimization statistics
 */
export type OptimizationStats = {
  /** Total waves */
  totalWaves: number;
  /** Waves with tests */
  wavesWithTests: number;
  /** Waves without tests */
  wavesWithoutTests: number;
  /** Total test classes added */
  totalTestsAdded: number;
  /** Estimated time saved (seconds) */
  timeSaved: number;
};

/**
 * Optimizer options
 */
export type OptimizerOptions = {
  /** Always run all tests (disable optimization) */
  alwaysRunAllTests?: boolean;
  /** Minimum test coverage required (0-100) */
  minCoverageRequired?: number;
  /** Include related tests (not just direct) */
  includeRelatedTests?: boolean;
};

/**
 * Test Optimizer
 *
 * Optimizes test execution by only including tests in waves
 * that contain Apex classes or triggers.
 *
 * Strategy:
 * 1. Identify waves with code changes (ApexClass, ApexTrigger)
 * 2. Match test classes to production classes
 * 3. Include only relevant tests per wave
 * 4. Skip tests for metadata-only waves
 *
 * Performance: O(V)
 *
 * @example
 * const optimizer = new TestOptimizer({
 *   minCoverageRequired: 75,
 *   includeRelatedTests: true
 * });
 *
 * const result = optimizer.optimizeTests(waves);
 * console.log(`Time saved: ${result.stats.timeSaved}s`);
 */
export class TestOptimizer {
  private options: Required<OptimizerOptions>;

  public constructor(options: OptimizerOptions = {}) {
    this.options = {
      alwaysRunAllTests: options.alwaysRunAllTests ?? false,
      minCoverageRequired: options.minCoverageRequired ?? 75,
      includeRelatedTests: options.includeRelatedTests ?? false,
    };

    logger.debug('Initialized TestOptimizer', {
      alwaysRunAllTests: this.options.alwaysRunAllTests,
      minCoverageRequired: this.options.minCoverageRequired,
    });
  }

  /**
   * @ac US-040-AC-1: Identify waves with Apex/Trigger changes
   * @ac US-040-AC-2: Include tests only in waves with code
   * @ac US-040-AC-3: Sync test classes with production classes
   */
  public optimizeTests(waves: Wave[]): TestOptimizationResult {
    const startTime = Date.now();
    const decisions: OptimizationDecision[] = [];
    const optimizedWaves: OptimizedWave[] = [];

    // Collect all test classes across all waves
    const allTestClasses = this.collectAllTestClasses(waves);

    for (const wave of waves) {
      const codeClasses = this.getCodeClasses(wave);
      const triggers = this.getTriggers(wave);
      const needsTests = codeClasses.length > 0 || triggers.length > 0;

      let testClasses: NodeId[] = [];
      let estimatedCoverage = 100;

      if (this.options.alwaysRunAllTests) {
        // Include all test classes in every wave
        testClasses = allTestClasses;

        decisions.push({
          waveNumber: wave.number,
          type: 'include-tests',
          reason: 'alwaysRunAllTests option enabled',
          testsAffected: allTestClasses.length,
        });
      } else if (!needsTests) {
        // No code changes, skip tests
        testClasses = [];

        decisions.push({
          waveNumber: wave.number,
          type: 'skip-tests',
          reason: 'No Apex classes or triggers in wave',
          testsAffected: 0,
        });
      } else {
        // Sync test classes with code classes
        testClasses = this.syncTestClasses(codeClasses, triggers, allTestClasses);
        estimatedCoverage = this.estimateCoverage(codeClasses.length, testClasses.length);

        decisions.push({
          waveNumber: wave.number,
          type: 'sync-tests',
          reason: `Matched ${testClasses.length} tests to ${codeClasses.length} classes`,
          testsAffected: testClasses.length,
        });
      }

      optimizedWaves.push({
        ...wave,
        testClasses,
        codeClasses,
        triggers,
        needsTests,
        estimatedCoverage,
      });
    }

    // Calculate statistics
    const stats = this.calculateStats(optimizedWaves, allTestClasses.length);

    const duration = Date.now() - startTime;
    logger.info('Test optimization completed', {
      totalWaves: stats.totalWaves,
      wavesWithTests: stats.wavesWithTests,
      testsAdded: stats.totalTestsAdded,
      timeSaved: stats.timeSaved,
      durationMs: duration,
    });

    return {
      originalWaves: waves,
      optimizedWaves,
      decisions,
      stats,
    };
  }

  /**
   * Collect all test classes from all waves
   */
  private collectAllTestClasses(waves: Wave[]): NodeId[] {
    const testClasses = new Set<NodeId>();

    for (const wave of waves) {
      for (const component of wave.components) {
        if (this.isTestClass(component)) {
          testClasses.add(component);
        }
      }
    }

    return Array.from(testClasses);
  }

  /**
   * Get code classes (non-test Apex classes)
   */
  private getCodeClasses(wave: Wave): NodeId[] {
    return wave.components.filter((c) => c.startsWith('ApexClass:') && !this.isTestClass(c));
  }

  /**
   * @ac US-040-AC-4: Ensure trigger tests are included
   */
  private getTriggers(wave: Wave): NodeId[] {
    return wave.components.filter((c) => c.startsWith('ApexTrigger:'));
  }

  /**
   * Check if component is a test class
   */
  private isTestClass(component: NodeId): boolean {
    return (
      component.startsWith('ApexClass:') &&
      (component.toLowerCase().includes('test') || component.toLowerCase().endsWith('_test'))
    );
  }

  /**
   * Sync test classes with production classes
   */
  private syncTestClasses(codeClasses: NodeId[], triggers: NodeId[], allTestClasses: NodeId[]): NodeId[] {
    const matchedTests = new Set<NodeId>();

    // Match tests to code classes
    for (const codeClass of codeClasses) {
      const className = codeClass.split(':')[1];

      for (const testClass of allTestClasses) {
        const testName = testClass.split(':')[1].toLowerCase();
        const codeName = className.toLowerCase();

        // Match patterns:
        // - AccountService → AccountServiceTest
        // - AccountService → TestAccountService
        // - AccountService → AccountService_Test
        if (testName.includes(codeName) || codeName.includes(testName.replace('test', ''))) {
          matchedTests.add(testClass);
        }
      }
    }

    // Match tests to triggers
    for (const trigger of triggers) {
      const triggerName = trigger.split(':')[1];

      for (const testClass of allTestClasses) {
        const testName = testClass.split(':')[1].toLowerCase();
        const trgName = triggerName.toLowerCase();

        // Match patterns:
        // - AccountTrigger → AccountTriggerTest
        // - AccountTrigger → TestAccountTrigger
        if (testName.includes(trgName) || testName.includes('trigger')) {
          matchedTests.add(testClass);
        }
      }
    }

    // If no tests matched and we have code, include related tests
    if (matchedTests.size === 0 && this.options.includeRelatedTests) {
      // Include a reasonable subset (e.g., first 10 test classes)
      for (let i = 0; i < Math.min(10, allTestClasses.length); i++) {
        matchedTests.add(allTestClasses[i]);
      }
    }

    return Array.from(matchedTests);
  }

  /**
   * @ac US-040-AC-5: Calculate test coverage per wave
   */
  private estimateCoverage(codeClassCount: number, testClassCount: number): number {
    if (codeClassCount === 0) return 100;
    if (testClassCount === 0) return 0;

    // Simple heuristic: assume each test class covers ~75% of one class
    const coverage = Math.min(100, (testClassCount / codeClassCount) * 75);
    return Math.round(coverage);
  }

  /**
   * Calculate optimization statistics
   */
  private calculateStats(optimizedWaves: OptimizedWave[], totalAvailableTests: number): OptimizationStats {
    let wavesWithTests = 0;
    let wavesWithoutTests = 0;
    let totalTestsAdded = 0;

    for (const wave of optimizedWaves) {
      if (wave.testClasses.length > 0) {
        wavesWithTests++;
        totalTestsAdded += wave.testClasses.length;
      } else {
        wavesWithoutTests++;
      }
    }

    // Estimate time saved (assume 5s per test class skipped)
    const testsSkipped = optimizedWaves.length * totalAvailableTests - totalTestsAdded;
    const timeSaved = testsSkipped * 5;

    return {
      totalWaves: optimizedWaves.length,
      wavesWithTests,
      wavesWithoutTests,
      totalTestsAdded,
      timeSaved,
    };
  }

  /**
   * @ac US-040-AC-6: Report test optimization savings
   */
  public generateReport(result: TestOptimizationResult): string {
    const lines: string[] = [];

    lines.push('# Test Optimization Report');
    lines.push('');
    lines.push('## Statistics');
    lines.push(`- Total Waves: ${result.stats.totalWaves}`);
    lines.push(`- Waves with Tests: ${result.stats.wavesWithTests}`);
    lines.push(`- Waves without Tests: ${result.stats.wavesWithoutTests}`);
    lines.push(`- Total Test Classes Added: ${result.stats.totalTestsAdded}`);
    lines.push(`- Estimated Time Saved: ${result.stats.timeSaved}s (${Math.round(result.stats.timeSaved / 60)}min)`);
    lines.push('');

    lines.push('## Optimization Decisions');
    lines.push('');

    for (const decision of result.decisions) {
      lines.push(`### Wave ${decision.waveNumber}`);
      lines.push(`- Type: ${decision.type}`);
      lines.push(`- Reason: ${decision.reason}`);
      lines.push(`- Tests Affected: ${decision.testsAffected}`);
      lines.push('');
    }

    lines.push('## Wave Details');
    lines.push('');

    for (const wave of result.optimizedWaves) {
      lines.push(`### Wave ${wave.number}`);
      lines.push(`- Code Classes: ${wave.codeClasses.length}`);
      lines.push(`- Triggers: ${wave.triggers.length}`);
      lines.push(`- Test Classes: ${wave.testClasses.length}`);
      lines.push(`- Needs Tests: ${wave.needsTests ? 'Yes' : 'No'}`);
      lines.push(`- Estimated Coverage: ${wave.estimatedCoverage}%`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get waves that need test execution
   */
  public getWavesNeedingTests(result: TestOptimizationResult): OptimizedWave[] {
    return result.optimizedWaves.filter((w) => w.needsTests);
  }

  /**
   * Get total test count across all waves
   */
  public getTotalTestCount(result: TestOptimizationResult): number {
    return result.optimizedWaves.reduce((sum, wave) => sum + wave.testClasses.length, 0);
  }
}
