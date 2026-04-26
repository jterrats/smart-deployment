import { expect } from 'chai';
import { describe, it } from 'mocha';
import { AnalyzeContextService } from '../../../src/analysis/analyze-context-service.js';
import { DependencyGraphBuilder } from '../../../src/dependencies/dependency-graph-builder.js';
import type { ScanResult } from '../../../src/services/metadata-scanner-service.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';

function buildScanResult(components: MetadataComponent[]): ScanResult {
  const graphBuilder = new DependencyGraphBuilder();
  graphBuilder.addComponents(components);

  return {
    projectRoot: '/tmp/analyze-context-service',
    components,
    dependencyResult: graphBuilder.build(),
    errors: [],
    warnings: [],
    executionTime: 1,
  };
}

describe('AnalyzeContextService', () => {
  it('maps shared project analysis results into analyze command context', async () => {
    const scanResult = buildScanResult([
      {
        name: 'Account',
        type: 'CustomObject',
        filePath: '/tmp/analyze-context-service/objects/Account.object-meta.xml',
        dependencies: new Set(),
        dependents: new Set(),
        priorityBoost: 0,
      },
      {
        name: 'AccountService',
        type: 'ApexClass',
        filePath: '/tmp/analyze-context-service/classes/AccountService.cls',
        dependencies: new Set(['CustomObject:Account']),
        dependents: new Set(),
        priorityBoost: 0,
      },
    ]);

    const service = new AnalyzeContextService({
      scanner: {
        scan: async () => scanResult,
      } as never,
      createPriorityService: () =>
        ({
          analyzePriorities: async () => ({
            recommendations: [],
            aiAdjustments: 0,
            executionTime: 1,
            tokensUsed: 1,
            usedFallback: true,
          }),
          formatDecisionReport: () => 'AI report',
          getProviderConfig: () => ({
            provider: 'openai',
            model: 'gpt-test',
          }),
        } as never),
    });

    const context = await service.buildContext({
      useAI: true,
      sourcePath: '/tmp/analyze-context-service',
      orgType: 'Production',
      industry: 'Fintech',
    });

    expect(context.scanResult).to.equal(scanResult);
    expect(context.waveResult.waves).to.have.lengthOf(2);
    expect(context.priorityOverrides).to.deep.equal({});
    expect(context.aiContext).to.deep.include({
      enabled: true,
      provider: 'openai',
      model: 'gpt-test',
      aiAdjustments: 0,
      inferredDependencies: 0,
      inferenceFallback: true,
    });
    expect(context.messages.logs).to.include('  🤖 Using AI priority weighting for wave ordering...');
  });
});
