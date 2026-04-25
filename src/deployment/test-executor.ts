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
import type { MetadataComponent } from '../types/metadata.js';
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

export type TestExecutorOptions = {
  availableTestClasses?: string[];
  availableTestComponents?: MetadataComponent[];
};

type TestClassCatalogEntry = {
  name: string;
  dependencies: Set<string>;
};

type SfTestFailure = {
  name?: string;
  methodName?: string;
};

type SfCodeCoverage = {
  percentage?: number;
  numLinesCovered?: number;
  numLinesUncovered?: number;
};

type SfRunTestResult = {
  numTestsRun?: number;
  numFailures?: number;
  failures?: SfTestFailure[];
  codeCoverage?: SfCodeCoverage[];
  codeCoverageWarnings?: Array<{ message?: string }>;
  summary?: {
    testsRan?: number;
    failRate?: string | number;
    passing?: number;
    failing?: number;
    orgWideCoverage?: string | number;
    testRunCoverage?: string | number;
  };
};

type SfDeployResultLike = {
  testsRun?: number;
  testFailures?: number;
  coverage?: number;
  result?: {
    numberTestsTotal?: number;
    numberTestErrors?: number;
    details?: {
      runTestResult?: SfRunTestResult;
    };
  };
  details?: {
    runTestResult?: SfRunTestResult;
  };
};

/**
 * @ac US-087-AC-1: Run tests only in Apex waves
 * @ac US-087-AC-2: Support RunLocalTests
 * @ac US-087-AC-3: Support RunSpecifiedTests
 * @ac US-087-AC-4: Support NoTestRun (sandbox)
 */
export class TestExecutor {
  private readonly availableTestClasses: string[];
  private readonly availableTestCatalog: TestClassCatalogEntry[];

  public constructor(options: TestExecutorOptions = {}) {
    this.availableTestCatalog = (options.availableTestComponents ?? [])
      .filter((component) => component.type === 'ApexClass')
      .filter((component) => this.isTestComponent(component))
      .map((component) => ({
        name: component.name,
        dependencies: new Set(component.dependencies),
      }));
    this.availableTestClasses = Array.from(
      new Set([
        ...this.availableTestCatalog.map((component) => component.name),
        ...(options.availableTestClasses ?? []),
      ])
    );
  }

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
    const explicitTests = apexComponents
      .filter((component) => component.startsWith('ApexClass:'))
      .map((component) => component.replace('ApexClass:', ''))
      .filter((className) => this.isKnownOrNamedTestClass(className));
    const codeClasses = apexComponents
      .filter((component) => component.startsWith('ApexClass:'))
      .map((component) => component.replace('ApexClass:', ''))
      .filter((className) => !this.isTestClass(className));
    const triggers = apexComponents
      .filter((component) => component.startsWith('ApexTrigger:'))
      .map((component) => component.replace('ApexTrigger:', ''));

    if (apexComponents.length > 0 && apexComponents.length <= 10) {
      const tests = this.findRelatedTests(codeClasses, triggers, explicitTests);
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

  private findRelatedTests(codeClasses: string[], triggers: string[], explicitTests: string[]): string[] {
    const relatedTests = new Set<string>();
    const candidateTests = new Set<string>([...explicitTests, ...this.availableTestClasses]);

    for (const explicitTest of explicitTests) {
      relatedTests.add(explicitTest);
    }

    for (const codeClass of codeClasses) {
      for (const candidateTest of this.availableTestCatalog) {
        if (candidateTest.dependencies.has(`ApexClass:${codeClass}`)) {
          relatedTests.add(candidateTest.name);
        }
      }

      for (const candidateTest of candidateTests) {
        if (this.matchesTestToClass(codeClass, candidateTest)) {
          relatedTests.add(candidateTest);
        }
      }
    }

    for (const trigger of triggers) {
      for (const candidateTest of candidateTests) {
        if (this.matchesTestToTrigger(trigger, candidateTest)) {
          relatedTests.add(candidateTest);
        }
      }
    }

    if (relatedTests.size === 0) {
      for (const codeClass of codeClasses) {
        relatedTests.add(`${codeClass}Test`);
        relatedTests.add(`${codeClass}Tests`);
      }
    }

    return Array.from(relatedTests);
  }

  private isTestClass(className: string): boolean {
    const normalizedName = className.toLowerCase();
    return normalizedName.includes('test') || normalizedName.endsWith('_test');
  }

  private isKnownOrNamedTestClass(className: string): boolean {
    return this.availableTestCatalog.some((component) => component.name === className) || this.isTestClass(className);
  }

  private isTestComponent(component: MetadataComponent): boolean {
    const apexComponent = component as MetadataComponent & { isTest?: boolean };
    return apexComponent.isTest === true || this.isTestClass(component.name);
  }

  private matchesTestToClass(className: string, testClassName: string): boolean {
    const normalizedClassName = className.toLowerCase();
    const normalizedTestName = testClassName.toLowerCase();
    const strippedTestName = normalizedTestName.replace(/tests?/g, '').replace(/_/g, '');
    const strippedClassName = normalizedClassName.replace(/_/g, '');

    return (
      normalizedTestName.includes(normalizedClassName) ||
      normalizedTestName.includes(strippedClassName) ||
      strippedTestName.includes(strippedClassName) ||
      strippedClassName.includes(strippedTestName)
    );
  }

  private matchesTestToTrigger(triggerName: string, testClassName: string): boolean {
    const normalizedTriggerName = triggerName.toLowerCase();
    const normalizedTestName = testClassName.toLowerCase();

    return normalizedTestName.includes(normalizedTriggerName) || normalizedTestName.includes('trigger');
  }

  /**
   * @ac US-087-AC-5: Track test results
   * @ac US-087-AC-6: Report coverage
   */
  public analyzeTestResults(input: number | SfDeployResultLike, testFailures = 0, coverage?: number): TestResults {
    if (typeof input === 'number') {
      logger.info('Analyzing numeric test results', { testsRun: input, testFailures, coverage });

      return {
        testsRun: input,
        testFailures,
        coverage,
        failedTests: [],
      };
    }

    const runTestResult = input.result?.details?.runTestResult ?? input.details?.runTestResult;
    const testsRun =
      runTestResult?.numTestsRun ??
      runTestResult?.summary?.testsRan ??
      input.result?.numberTestsTotal ??
      input.testsRun ??
      0;
    const failures =
      runTestResult?.numFailures ??
      runTestResult?.summary?.failing ??
      input.result?.numberTestErrors ??
      input.testFailures ??
      0;
    const failedTests =
      runTestResult?.failures
        ?.map((failure) =>
          failure.name && failure.methodName
            ? `${failure.name}.${failure.methodName}`
            : failure.name ?? failure.methodName
        )
        .filter((failureName): failureName is string => failureName !== undefined && failureName !== '') ?? [];
    const resolvedCoverage = this.resolveCoverage(runTestResult) ?? input.coverage ?? coverage;

    logger.info('Analyzing structured test results', {
      testsRun,
      testFailures: failures,
      coverage: resolvedCoverage,
      failedTests: failedTests.length,
    });

    return {
      testsRun,
      testFailures: failures,
      coverage: resolvedCoverage,
      failedTests,
    };
  }

  private resolveCoverage(runTestResult: SfRunTestResult | undefined): number | undefined {
    const summaryCoverage = runTestResult?.summary?.orgWideCoverage ?? runTestResult?.summary?.testRunCoverage;
    if (typeof summaryCoverage === 'number') {
      return summaryCoverage;
    }

    if (typeof summaryCoverage === 'string' && summaryCoverage.trim() !== '') {
      const parsedSummaryCoverage = Number(summaryCoverage);
      if (!Number.isNaN(parsedSummaryCoverage)) {
        return parsedSummaryCoverage;
      }
    }

    const coverageEntries = runTestResult?.codeCoverage ?? [];
    if (coverageEntries.length === 0) {
      return undefined;
    }

    let coveredLines = 0;
    let uncoveredLines = 0;
    let percentageEntries = 0;
    let percentageTotal = 0;

    for (const entry of coverageEntries) {
      if (typeof entry.percentage === 'number') {
        percentageEntries++;
        percentageTotal += entry.percentage;
      }

      coveredLines += entry.numLinesCovered ?? 0;
      uncoveredLines += entry.numLinesUncovered ?? 0;
    }

    const totalLines = coveredLines + uncoveredLines;
    if (totalLines > 0) {
      return Math.round((coveredLines / totalLines) * 100);
    }

    if (percentageEntries > 0) {
      return Math.round(percentageTotal / percentageEntries);
    }

    return undefined;
  }

  public formatTestResults(results: TestResults): string {
    const lines = [`Tests Run: ${results.testsRun}`, `Failures: ${results.testFailures}`];

    if (results.coverage !== undefined) {
      lines.push(`Coverage: ${results.coverage}%`);
    }

    return lines.join(' | ');
  }
}
