import type { MetadataComponent } from '../types/metadata.js';
import type { Wave } from '../waves/wave-builder.js';
import { TestExecutor, type TestExecutionPlan } from './test-executor.js';

export class TestPlanService {
  public createExecutor(components: MetadataComponent[]): TestExecutor {
    const availableTestClasses = components
      .filter((component) => component.type === 'ApexClass')
      .map((component) => component.name)
      .filter((className) => this.isTestClassName(className));
    const availableTestComponents = components.filter((component) => component.type === 'ApexClass');

    return new TestExecutor({ availableTestClasses, availableTestComponents, availableComponents: components });
  }

  public resolveTestPlan(wave: Wave, skipTests: boolean, testExecutor: TestExecutor): TestExecutionPlan {
    if (skipTests) {
      return {
        testLevel: 'NoTestRun',
        tests: [],
        reason: 'Tests skipped via --skip-tests',
      };
    }

    return testExecutor.determineTestLevel(wave, false);
  }

  private isTestClassName(className: string): boolean {
    const normalizedName = className.toLowerCase();
    return normalizedName.includes('test') || normalizedName.endsWith('_test');
  }
}
