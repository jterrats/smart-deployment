import { expect } from 'chai';
import { describe, it } from 'mocha';
import { TestPlanService } from '../../../src/deployment/test-plan-service.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';
import type { Wave } from '../../../src/waves/wave-builder.js';

describe('TestPlanService', () => {
  const service = new TestPlanService();

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

  it('creates a TestExecutor from project metadata and resolves RunSpecifiedTests', () => {
    const components: MetadataComponent[] = [
      {
        name: 'AccountService',
        type: 'ApexClass',
        filePath: 'force-app/main/default/classes/AccountService.cls',
        dependencies: new Set<string>(),
        dependents: new Set<string>(),
        priorityBoost: 0,
      },
      {
        name: 'ServiceValidationSpec',
        type: 'ApexClass',
        filePath: 'force-app/main/default/classes/ServiceValidationSpec.cls',
        dependencies: new Set(['ApexClass:AccountService']),
        dependents: new Set<string>(),
        priorityBoost: 0,
        isTest: true,
      } as MetadataComponent & { isTest: boolean },
    ];

    const executor = service.createExecutor(components);
    const plan = service.resolveTestPlan(createWave(['ApexClass:AccountService'], ['ApexClass']), false, executor);

    expect(plan.testLevel).to.equal('RunSpecifiedTests');
    expect(plan.tests).to.include('ServiceValidationSpec');
  });

  it('returns NoTestRun when tests are skipped', () => {
    const executor = service.createExecutor([]);
    const plan = service.resolveTestPlan(createWave(['ApexClass:AccountService'], ['ApexClass']), true, executor);

    expect(plan).to.deep.equal({
      testLevel: 'NoTestRun',
      tests: [],
      reason: 'Tests skipped via --skip-tests',
    });
  });
});
