import { expect } from 'chai';
import { describe, it } from 'mocha';
import { TestExecutor } from '../../../src/deployment/test-executor.js';
import type { Wave } from '../../../src/waves/wave-builder.js';

describe('TestExecutor', () => {
  function createWave(components: string[], types: string[]): Wave {
    return {
      number: 1,
      components,
      metadata: {
        componentCount: components.length,
        types: types as Wave['metadata']['types'],
        maxDepth: 0,
        hasCircularDeps: false,
        estimatedTime: 30,
      },
    };
  }

  describe('determineTestLevel', () => {
    it('uses related tests for small Apex waves', () => {
      const executor = new TestExecutor();
      const wave = createWave(['ApexClass:AccountService'], ['ApexClass']);

      const plan = executor.determineTestLevel(wave, false);

      expect(plan.testLevel).to.equal('RunSpecifiedTests');
      expect(plan.tests).to.include.members(['AccountServiceTest', 'AccountServiceTests']);
    });

    it('keeps explicit test classes when deploying tests directly', () => {
      const executor = new TestExecutor();
      const wave = createWave(['ApexClass:AccountServiceTest'], ['ApexClass']);

      const plan = executor.determineTestLevel(wave, false);

      expect(plan.testLevel).to.equal('RunSpecifiedTests');
      expect(plan.tests).to.deep.equal(['AccountServiceTest']);
    });
  });

  describe('analyzeTestResults', () => {
    it('parses failed tests from sf deployment result payloads', () => {
      const executor = new TestExecutor();

      const results = executor.analyzeTestResults({
        result: {
          numberTestsTotal: 3,
          numberTestErrors: 1,
          details: {
            runTestResult: {
              numTestsRun: 3,
              numFailures: 1,
              failures: [
                {
                  name: 'AccountServiceTest',
                  methodName: 'testInsert',
                },
              ],
              summary: {
                orgWideCoverage: '81',
              },
            },
          },
        },
      });

      expect(results.testsRun).to.equal(3);
      expect(results.testFailures).to.equal(1);
      expect(results.coverage).to.equal(81);
      expect(results.failedTests).to.deep.equal(['AccountServiceTest.testInsert']);
    });

    it('calculates coverage from code coverage entries when summary is unavailable', () => {
      const executor = new TestExecutor();

      const results = executor.analyzeTestResults({
        details: {
          runTestResult: {
            numTestsRun: 2,
            numFailures: 0,
            codeCoverage: [
              { numLinesCovered: 8, numLinesUncovered: 2 },
              { numLinesCovered: 4, numLinesUncovered: 1 },
            ],
          },
        },
      });

      expect(results.testsRun).to.equal(2);
      expect(results.testFailures).to.equal(0);
      expect(results.coverage).to.equal(80);
      expect(results.failedTests).to.deep.equal([]);
    });

    it('preserves numeric fallback behavior', () => {
      const executor = new TestExecutor();

      const results = executor.analyzeTestResults(5, 2, 72);

      expect(results).to.deep.equal({
        testsRun: 5,
        testFailures: 2,
        coverage: 72,
        failedTests: [],
      });
    });
  });
});
