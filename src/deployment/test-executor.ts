/**
 * Test Execution Management - US-087
 * Manages intelligent test execution per wave
 *
 * @ac US-087-AC-1: Run tests only in Apex waves
 * @ac US-087-AC-2: Support RunLocalTests
 * @ac US-087-AC-3: Support RunSpecifiedTests
 * @ac US-087-AC-4: Support NoTestRun (sandbox)
 * @ac US-087-AC-5: Track test results
 * @ac US-087-AC-6: Report coverage
 * @issue #87
 */

import { getLogger } from '../utils/logger.js';
import type { Wave } from '../waves/wave-builder.js';
import type { TestLevel } from './sf-cli-integration.js';

const logger = getLogger('TestExecutor');

export type TestExecutionPlan = {
  testLevel: TestLevel;
  tests: string[];
  reason: string;
};

export type TestResults = {
  testsRun: number;
  testFailures: number;
  coverage?: number;
  failedTests: string[];
};

/**
 * @ac US-087-AC-1: Run tests only in Apex waves
 * @ac US-087-AC-2: Support RunLocalTests
 * @ac US-087-AC-3: Support RunSpecifiedTests
 * @ac US-087-AC-4: Support NoTestRun (sandbox)
 */
export class TestExecutor {
  public determineTestLevel(wave: Wave, isSandbox: boolean): TestExecutionPlan {
    // AC-1: Only run tests in Apex waves
    const hasApex = wave.metadata.types.some((type) => type === 'ApexClass' || type === 'ApexTrigger');

    // AC-4: No tests in sandbox
    if (isSandbox) {
      return {
        testLevel: 'NoTestRun',
        tests: [],
        reason: 'Sandbox deployment - tests not required',
      };
    }

    if (!hasApex) {
      return {
        testLevel: 'NoTestRun',
        tests: [],
        reason: 'No Apex code in wave',
      };
    }

    // AC-3: Run specified tests if available
    const apexComponents = wave.components.filter(
      (component) => component.startsWith('ApexClass:') || component.startsWith('ApexTrigger:')
    );

    if (apexComponents.length > 0 && apexComponents.length <= 10) {
      const tests = this.findRelatedTests(apexComponents);
      if (tests.length > 0) {
        return {
          testLevel: 'RunSpecifiedTests',
          tests,
          reason: `Running ${tests.length} related tests`,
        };
      }
    }

    // AC-2: Default to RunLocalTests
    return {
      testLevel: 'RunLocalTests',
      tests: [],
      reason: 'Running all local tests',
    };
  }

  private findRelatedTests(apexComponents: string[]): string[] {
    // Placeholder: In real implementation, this would analyze test classes
    // and match them to the components being deployed
    return apexComponents
      .filter((component) => component.startsWith('ApexClass:'))
      .map((component) => component.replace('ApexClass:', '') + 'Test');
  }

  /**
   * @ac US-087-AC-5: Track test results
   * @ac US-087-AC-6: Report coverage
   */
  public analyzeTestResults(testsRun: number, testFailures: number, coverage?: number): TestResults {
    logger.info('Analyzing test results', { testsRun, testFailures, coverage });

    return {
      testsRun,
      testFailures,
      coverage,
      failedTests: [], // Would be populated from actual results
    };
  }

  public formatTestResults(results: TestResults): string {
    const lines = [`Tests Run: ${results.testsRun}`, `Failures: ${results.testFailures}`];

    if (results.coverage !== undefined) {
      lines.push(`Coverage: ${results.coverage}%`);
    }

    return lines.join(' | ');
  }
}
