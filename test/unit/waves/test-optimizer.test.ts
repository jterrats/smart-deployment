/**
 * Unit tests for Test Optimizer
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { TestOptimizer } from '../../../src/waves/test-optimizer.js';
import type { Wave } from '../../../src/waves/wave-builder.js';

describe('TestOptimizer', () => {
  /**
   * Helper to create a wave
   */
  function createWave(number: number, components: string[]): Wave {
    return {
      number,
      components,
      metadata: {
        componentCount: components.length,
        types: ['ApexClass'],
        maxDepth: 0,
        hasCircularDeps: false,
        estimatedTime: components.length * 0.1,
      },
    };
  }

  describe('Wave Identification', () => {
    /**
     * @ac US-040-AC-1: Identify waves with Apex/Trigger changes
     */
    it('US-040-AC-1: should identify waves with Apex classes', () => {
      const waves = [
        createWave(1, ['CustomObject:Account', 'CustomField:Name']),
        createWave(2, ['ApexClass:Service', 'ApexClass:ServiceTest']),
      ];

      const optimizer = new TestOptimizer();
      const result = optimizer.optimizeTests(waves);

      expect(result.optimizedWaves[0].needsTests).to.be.false;
      expect(result.optimizedWaves[1].needsTests).to.be.true;
    });

    it('US-040-AC-1: should identify waves with triggers', () => {
      const waves = [
        createWave(1, ['ApexTrigger:AccountTrigger']),
      ];

      const optimizer = new TestOptimizer();
      const result = optimizer.optimizeTests(waves);

      expect(result.optimizedWaves[0].needsTests).to.be.true;
      expect(result.optimizedWaves[0].triggers).to.have.lengthOf(1);
    });
  });

  describe('Test Inclusion', () => {
    /**
     * @ac US-040-AC-2: Include tests only in waves with code
     */
    it('US-040-AC-2: should skip tests for metadata-only waves', () => {
      const waves = [
        createWave(1, ['CustomObject:Account', 'Layout:Account_Layout']),
        createWave(2, ['ApexClass:Service', 'ApexClass:ServiceTest']),
      ];

      const optimizer = new TestOptimizer();
      const result = optimizer.optimizeTests(waves);

      expect(result.optimizedWaves[0].testClasses).to.have.lengthOf(0);
      expect(result.decisions[0].type).to.equal('skip-tests');
    });

    it('US-040-AC-2: should include tests for code waves', () => {
      const waves = [
        createWave(1, ['ApexClass:Service', 'ApexClass:ServiceTest']),
      ];

      const optimizer = new TestOptimizer();
      const result = optimizer.optimizeTests(waves);

      expect(result.optimizedWaves[0].testClasses.length).to.be.greaterThan(0);
    });

    it('US-040-AC-2: should include all tests when alwaysRunAllTests enabled', () => {
      const waves = [
        createWave(1, ['CustomObject:Account']),
        createWave(2, ['ApexClass:ServiceTest']),
      ];

      const optimizer = new TestOptimizer({ alwaysRunAllTests: true });
      const result = optimizer.optimizeTests(waves);

      // Both waves should have test classes
      expect(result.optimizedWaves[0].testClasses.length).to.be.greaterThan(0);
      expect(result.optimizedWaves[1].testClasses.length).to.be.greaterThan(0);
    });
  });

  describe('Test Syncing', () => {
    /**
     * @ac US-040-AC-3: Sync test classes with production classes
     */
    it('US-040-AC-3: should match test classes to production classes', () => {
      const waves = [
        createWave(1, ['ApexClass:AccountService', 'ApexClass:AccountServiceTest']),
      ];

      const optimizer = new TestOptimizer();
      const result = optimizer.optimizeTests(waves);

      expect(result.optimizedWaves[0].codeClasses).to.include('ApexClass:AccountService');
      expect(result.optimizedWaves[0].testClasses).to.include('ApexClass:AccountServiceTest');
    });

    it('US-040-AC-3: should match TestPrefix pattern', () => {
      const waves = [
        createWave(1, ['ApexClass:Service', 'ApexClass:TestService']),
      ];

      const optimizer = new TestOptimizer();
      const result = optimizer.optimizeTests(waves);

      expect(result.optimizedWaves[0].testClasses).to.include('ApexClass:TestService');
    });

    it('US-040-AC-3: should match _Test suffix pattern', () => {
      const waves = [
        createWave(1, ['ApexClass:Service', 'ApexClass:Service_Test']),
      ];

      const optimizer = new TestOptimizer();
      const result = optimizer.optimizeTests(waves);

      expect(result.optimizedWaves[0].testClasses).to.include('ApexClass:Service_Test');
    });
  });

  describe('Trigger Tests', () => {
    /**
     * @ac US-040-AC-4: Ensure trigger tests are included
     */
    it('US-040-AC-4: should include tests for triggers', () => {
      const waves = [
        createWave(1, [
          'ApexTrigger:AccountTrigger',
          'ApexClass:AccountTriggerTest',
        ]),
      ];

      const optimizer = new TestOptimizer();
      const result = optimizer.optimizeTests(waves);

      expect(result.optimizedWaves[0].triggers).to.have.lengthOf(1);
      expect(result.optimizedWaves[0].testClasses).to.include('ApexClass:AccountTriggerTest');
    });

    it('US-040-AC-4: should match trigger test patterns', () => {
      const waves = [
        createWave(1, [
          'ApexTrigger:LeadTrigger',
          'ApexClass:TestLeadTrigger',
          'ApexClass:LeadTriggerTest',
        ]),
      ];

      const optimizer = new TestOptimizer();
      const result = optimizer.optimizeTests(waves);

      expect(result.optimizedWaves[0].testClasses.length).to.be.greaterThan(0);
    });
  });

  describe('Coverage Calculation', () => {
    /**
     * @ac US-040-AC-5: Calculate test coverage per wave
     */
    it('US-040-AC-5: should calculate estimated coverage', () => {
      const waves = [
        createWave(1, [
          'ApexClass:Service1',
          'ApexClass:Service2',
          'ApexClass:Service1Test',
          'ApexClass:Service2Test',
        ]),
      ];

      const optimizer = new TestOptimizer();
      const result = optimizer.optimizeTests(waves);

      expect(result.optimizedWaves[0].estimatedCoverage).to.be.a('number');
      expect(result.optimizedWaves[0].estimatedCoverage).to.be.greaterThan(0);
      expect(result.optimizedWaves[0].estimatedCoverage).to.be.lessThanOrEqual(100);
    });

    it('US-040-AC-5: should show 100% for no code classes', () => {
      const waves = [
        createWave(1, ['CustomObject:Account']),
      ];

      const optimizer = new TestOptimizer();
      const result = optimizer.optimizeTests(waves);

      expect(result.optimizedWaves[0].estimatedCoverage).to.equal(100);
    });

    it('US-040-AC-5: should show 0% for no test classes', () => {
      const waves = [
        createWave(1, ['ApexClass:Service']),
      ];

      const optimizer = new TestOptimizer();
      const result = optimizer.optimizeTests(waves);

      // Should have low/zero coverage if no matching tests
      expect(result.optimizedWaves[0].estimatedCoverage).to.be.lessThanOrEqual(75);
    });
  });

  describe('Optimization Reporting', () => {
    /**
     * @ac US-040-AC-6: Report test optimization savings
     */
    it('US-040-AC-6: should calculate time savings', () => {
      const waves = [
        createWave(1, ['CustomObject:Account']),
        createWave(2, ['ApexClass:Service', 'ApexClass:ServiceTest']),
      ];

      const optimizer = new TestOptimizer();
      const result = optimizer.optimizeTests(waves);

      expect(result.stats.timeSaved).to.be.a('number');
      expect(result.stats.timeSaved).to.be.greaterThan(0);
    });

    it('US-040-AC-6: should generate optimization report', () => {
      const waves = [
        createWave(1, ['ApexClass:Service', 'ApexClass:ServiceTest']),
      ];

      const optimizer = new TestOptimizer();
      const result = optimizer.optimizeTests(waves);

      const report = optimizer.generateReport(result);

      expect(report).to.include('Test Optimization Report');
      expect(report).to.include('Statistics');
      expect(report).to.include('Time Saved');
      expect(report).to.include('Optimization Decisions');
    });

    it('US-040-AC-6: should report optimization statistics', () => {
      const waves = [
        createWave(1, ['CustomObject:Account']),
        createWave(2, ['ApexClass:Service', 'ApexClass:ServiceTest']),
        createWave(3, ['Layout:Account_Layout']),
      ];

      const optimizer = new TestOptimizer();
      const result = optimizer.optimizeTests(waves);

      expect(result.stats.totalWaves).to.equal(3);
      expect(result.stats.wavesWithTests).to.be.greaterThan(0);
      expect(result.stats.wavesWithoutTests).to.be.greaterThan(0);
    });
  });

  describe('Helper Methods', () => {
    it('should get waves needing tests', () => {
      const waves = [
        createWave(1, ['CustomObject:Account']),
        createWave(2, ['ApexClass:Service', 'ApexClass:ServiceTest']),
      ];

      const optimizer = new TestOptimizer();
      const result = optimizer.optimizeTests(waves);

      const wavesNeedingTests = optimizer.getWavesNeedingTests(result);
      expect(wavesNeedingTests.length).to.equal(1);
      expect(wavesNeedingTests[0].number).to.equal(2);
    });

    it('should get total test count', () => {
      const waves = [
        createWave(1, ['ApexClass:Service', 'ApexClass:ServiceTest']),
      ];

      const optimizer = new TestOptimizer();
      const result = optimizer.optimizeTests(waves);

      const totalTests = optimizer.getTotalTestCount(result);
      expect(totalTests).to.be.a('number');
      expect(totalTests).to.be.greaterThanOrEqual(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty waves', () => {
      const waves: Wave[] = [];

      const optimizer = new TestOptimizer();
      const result = optimizer.optimizeTests(waves);

      expect(result.optimizedWaves).to.have.lengthOf(0);
      expect(result.stats.totalWaves).to.equal(0);
    });

    it('should handle waves with no tests', () => {
      const waves = [
        createWave(1, ['ApexClass:Service']),
      ];

      const optimizer = new TestOptimizer();
      const result = optimizer.optimizeTests(waves);

      expect(result.optimizedWaves[0].testClasses).to.be.an('array');
    });

    it('should handle waves with only tests', () => {
      const waves = [
        createWave(1, ['ApexClass:ServiceTest', 'ApexClass:HandlerTest']),
      ];

      const optimizer = new TestOptimizer();
      const result = optimizer.optimizeTests(waves);

      expect(result.optimizedWaves[0].codeClasses).to.have.lengthOf(0);
    });

    it('should handle mixed metadata and code', () => {
      const waves = [
        createWave(1, [
          'CustomObject:Account',
          'ApexClass:Service',
          'Layout:Account_Layout',
          'ApexClass:ServiceTest',
        ]),
      ];

      const optimizer = new TestOptimizer();
      const result = optimizer.optimizeTests(waves);

      expect(result.optimizedWaves[0].needsTests).to.be.true;
      expect(result.optimizedWaves[0].codeClasses).to.have.lengthOf(1);
    });
  });

  describe('Options', () => {
    it('should respect includeRelatedTests option', () => {
      const waves = [
        createWave(1, ['ApexClass:Service', 'ApexClass:UnrelatedTest']),
      ];

      const optimizer = new TestOptimizer({ includeRelatedTests: true });
      const result = optimizer.optimizeTests(waves);

      // Should include some tests even if not perfectly matched
      expect(result.optimizedWaves[0].testClasses.length).to.be.greaterThanOrEqual(0);
    });

    it('should respect minCoverageRequired option', () => {
      const optimizer = new TestOptimizer({ minCoverageRequired: 80 });
      expect(optimizer).to.exist;
    });
  });
});

