import { expect } from 'chai';
import { describe, it } from 'mocha';
import { DependencyGraphBuilder } from '../../../src/dependencies/dependency-graph-builder.js';
import { ProjectAnalysisService } from '../../../src/analysis/project-analysis-service.js';
import type { ScanResult } from '../../../src/services/metadata-scanner-service.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';

function buildScanResult(components: MetadataComponent[]): ScanResult {
  const graphBuilder = new DependencyGraphBuilder();
  graphBuilder.addComponents(components);

  return {
    projectRoot: '/tmp/project-analysis-service',
    components,
    dependencyResult: graphBuilder.build(),
    errors: [],
    warnings: [],
    executionTime: 1,
  };
}

describe('ProjectAnalysisService', () => {
  it('builds analysis results without AI enrichment', async () => {
    const scanResult = buildScanResult([
      {
        name: 'Account',
        type: 'CustomObject',
        filePath: '/tmp/project-analysis-service/objects/Account.object-meta.xml',
        dependencies: new Set(),
        dependents: new Set(),
        priorityBoost: 0,
      },
      {
        name: 'AccountService',
        type: 'ApexClass',
        filePath: '/tmp/project-analysis-service/classes/AccountService.cls',
        dependencies: new Set(['CustomObject:Account']),
        dependents: new Set(),
        priorityBoost: 0,
      },
    ]);

    const service = new ProjectAnalysisService({
      scanner: {
        scan: async () => scanResult,
      } as never,
    });

    const analysis = await service.buildAnalysis();

    expect(analysis.scanResult).to.equal(scanResult);
    expect(analysis.waveResult.waves).to.have.lengthOf(2);
    expect(analysis.orderedWaves.map((wave) => wave.number)).to.deep.equal([1, 2]);
    expect(analysis.priorityOverrides).to.deep.equal({});
    expect(analysis.aiContext).to.equal(undefined);
    expect(analysis.messages).to.deep.equal({
      logs: [],
      warnings: [],
    });
  });

  it('applies AI inference and priority metadata through the shared pipeline', async () => {
    const scanResult = buildScanResult([
      {
        name: 'Account',
        type: 'CustomObject',
        filePath: '/tmp/project-analysis-service/objects/Account.object-meta.xml',
        dependencies: new Set(),
        dependents: new Set(),
        priorityBoost: 0,
      },
      {
        name: 'AccountService',
        type: 'ApexClass',
        filePath: '/tmp/project-analysis-service/classes/AccountService.cls',
        dependencies: new Set(),
        dependents: new Set(),
        priorityBoost: 0,
      },
    ]);

    const service = new ProjectAnalysisService({
      scanner: {
        scan: async () => scanResult,
      } as never,
      createInferenceService: () => ({
        inferDependencies: async () => ({
          dependencies: [
            {
              from: 'AccountService',
              to: 'Account',
              type: 'implicit',
              confidence: 0.91,
              reason: 'Runtime reference',
            },
          ],
          highConfidenceCount: 1,
          totalInferred: 1,
          executionTime: 5,
          usedCache: false,
          fallbackToStatic: false,
        }),
      }),
      createPriorityService: () =>
        ({
          analyzePriorities: async () => ({
            recommendations: [
              {
                componentName: 'AccountService',
                priority: 42,
                confidence: 0.95,
                reason: 'High operational value',
              },
            ],
            aiAdjustments: 1,
            executionTime: 12,
            tokensUsed: 50,
            usedFallback: false,
          }),
          formatDecisionReport: () => 'AI report',
          getProviderConfig: () => ({
            provider: 'openai',
            model: 'gpt-test',
          }),
        } as never),
    });

    const analysis = await service.buildAnalysis({
      useAI: true,
      sourcePath: '/tmp/project-analysis-service',
      orgType: 'Production',
      industry: 'Fintech',
    });

    expect(analysis.scanResult.dependencyResult.stats.totalDependencies).to.equal(1);
    expect(analysis.priorityOverrides['ApexClass:AccountService']).to.deep.include({
      priority: 42,
      source: 'ai',
      confidence: 0.95,
      reason: 'High operational value',
    });
    expect(analysis.aiContext).to.deep.include({
      enabled: true,
      provider: 'openai',
      model: 'gpt-test',
      aiAdjustments: 1,
      inferredDependencies: 1,
      inferenceFallback: false,
      fallback: false,
    });
    expect(analysis.messages.logs).to.include('  🤖 Using AI priority weighting for wave ordering...');
    expect(analysis.messages.logs).to.include('AI report');
  });
});
