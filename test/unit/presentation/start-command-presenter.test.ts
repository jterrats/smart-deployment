import { expect } from 'chai';
import { describe, it } from 'mocha';
import { StartCommandPresenter } from '../../../src/presentation/start-command-presenter.js';
import type { ScanResult } from '../../../src/services/metadata-scanner-service.js';

function createScanResult(): ScanResult {
  return {
    projectRoot: '/tmp/start-presenter',
    components: [],
    dependencyResult: {
      components: new Map(),
      graph: new Map(),
      reverseGraph: new Map(),
      edges: [],
      circularDependencies: [],
      isolatedComponents: [],
      stats: {
        totalComponents: 0,
        totalDependencies: 0,
        componentsByType: {},
        maxDepth: 0,
        mostDepended: { nodeId: 'None:None', count: 0 },
        mostDependencies: { nodeId: 'None:None', count: 0 },
      },
    },
    errors: ['scan error'],
    warnings: ['scan warning'],
    executionTime: 1,
  };
}

describe('StartCommandPresenter', () => {
  it('reports scan diagnostics and context messages', () => {
    const presenter = new StartCommandPresenter();
    const logs: string[] = [];
    const warnings: string[] = [];

    presenter.reportScanDiagnostics(
      {
        log: (message) => logs.push(message),
        warn: (message) => warnings.push(message),
      },
      createScanResult()
    );
    presenter.reportContextMessages(
      {
        log: (message) => logs.push(message),
        warn: (message) => warnings.push(message),
      },
      {
        logs: ['context log'],
        warnings: ['context warning'],
      }
    );

    expect(logs).to.deep.equal(['context log']);
    expect(warnings).to.deep.equal(['scan error', 'scan warning', 'context warning']);
  });

  it('reports analysis and deployment summaries', () => {
    const presenter = new StartCommandPresenter();
    const logs: string[] = [];

    presenter.reportAnalysisSummary(
      {
        log: (message) => logs.push(message),
      },
      {
        metadataCount: 4,
        waves: 2,
        aiEnabled: true,
      }
    );
    presenter.reportDeploymentReport(
      {
        log: (message) => logs.push(message),
      },
      2
    );

    expect(logs).to.include.members([
      '✅ Found 4 metadata components',
      '🌊 Generating deployment waves...',
      '✅ Generated 2 waves',
      '🤖 AI-enhanced prioritization enabled',
      '\n📊 Deployment Report:',
      '   - Waves: 2',
      '   - Status: Success',
    ]);
  });
});
