import { expect } from 'chai';
import { describe, it } from 'mocha';
import { AnalyzeCommandPresenter } from '../../../src/presentation/analyze-command-presenter.js';
import type { ScanResult } from '../../../src/services/metadata-scanner-service.js';
import type { WaveResult } from '../../../src/waves/wave-builder.js';

function createScanResult(): ScanResult {
  return {
    projectRoot: '/tmp/analyze-presenter',
    components: [
      {
        name: 'Account',
        type: 'CustomObject',
        filePath: '/tmp/analyze-presenter/Account.object-meta.xml',
        dependencies: new Set(),
        dependents: new Set(),
        priorityBoost: 0,
      },
    ],
    dependencyResult: {
      components: new Map(),
      graph: new Map(),
      reverseGraph: new Map(),
      edges: [],
      circularDependencies: [{ cycle: ['A', 'B'], severity: 'error', message: 'cycle' }],
      isolatedComponents: [],
      stats: {
        totalComponents: 1,
        totalDependencies: 3,
        componentsByType: { CustomObject: 1 },
        maxDepth: 1,
        mostDepended: { nodeId: 'CustomObject:Account', count: 0 },
        mostDependencies: { nodeId: 'CustomObject:Account', count: 0 },
      },
    },
    errors: [],
    warnings: [],
    executionTime: 1,
  };
}

function createWaveResult(): WaveResult {
  return {
    waves: [
      {
        number: 1,
        components: ['CustomObject:Account'],
        metadata: {
          componentCount: 1,
          types: ['CustomObject'],
          maxDepth: 1,
          hasCircularDeps: false,
          estimatedTime: 1,
        },
      },
    ],
    circularDependencies: [],
    unplacedComponents: ['ApexClass:Legacy'],
    totalComponents: 1,
    stats: {
      totalEstimatedTime: 1,
      avgComponentsPerWave: 1,
      maxParallelism: 1,
    },
  };
}

describe('AnalyzeCommandPresenter', () => {
  it('reports analysis summaries and saved artifacts', () => {
    const presenter = new AnalyzeCommandPresenter();
    const logs: string[] = [];

    presenter.reportAnalysisSummary(
      {
        log: (message) => logs.push(message),
      },
      createScanResult(),
      createWaveResult()
    );
    presenter.reportPlanSaved(
      {
        log: (message) => logs.push(message),
      },
      '.smart-deployment/deployment-plan.json'
    );
    presenter.reportReportSaved(
      {
        log: (message) => logs.push(message),
      },
      'analysis.json',
      'json'
    );

    expect(logs).to.include.members([
      '✅ Found 1 components with 3 dependencies',
      '⚠️  Warning: 1 circular dependency cycle(s) detected',
      '🌊 Generating deployment waves...',
      '✅ Generated 1 deployment wave(s)',
      '   Total components: 1',
      "   ⚠️  1 component(s) couldn't be placed (circular deps)",
      '✅ Deployment plan saved to: .smart-deployment/deployment-plan.json',
      '📄 Report saved to: analysis.json (format: json)',
    ]);
  });
});
