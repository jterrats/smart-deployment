import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { AnalyzeArtifactService } from '../../../src/analysis/analyze-artifact-service.js';
import type { ScanResult } from '../../../src/services/metadata-scanner-service.js';
import type { DependencyAnalysisResult } from '../../../src/types/dependency.js';
import type { PriorityOverride } from '../../../src/types/deployment-plan.js';
import type { WaveResult } from '../../../src/waves/wave-builder.js';

function createScanResult(projectRoot: string): ScanResult {
  const dependencyResult: DependencyAnalysisResult = {
    components: new Map(),
    graph: new Map([
      ['ApexClass:Base', new Set<string>()],
      ['ApexClass:Service', new Set<string>(['ApexClass:Base'])],
    ]),
    reverseGraph: new Map(),
    edges: [
      {
        from: 'ApexClass:Service',
        to: 'ApexClass:Base',
        type: 'hard',
        source: 'parser',
      },
    ],
    circularDependencies: [],
    isolatedComponents: [],
    stats: {
      totalComponents: 2,
      totalDependencies: 1,
      componentsByType: { ApexClass: 2 },
      maxDepth: 1,
      mostDepended: { nodeId: 'ApexClass:Base', count: 1 },
      mostDependencies: { nodeId: 'ApexClass:Service', count: 1 },
    },
  };

  return {
    projectRoot,
    executionTime: 1,
    errors: [],
    warnings: [],
    dependencyResult,
    components: [
      {
        name: 'Base',
        type: 'ApexClass',
        filePath: path.join(projectRoot, 'force-app/main/default/classes/Base.cls'),
        dependencies: new Set(),
        dependents: new Set(['ApexClass:Service']),
        priorityBoost: 0,
      },
      {
        name: 'Service',
        type: 'ApexClass',
        filePath: path.join(projectRoot, 'force-app/main/default/classes/Service.cls'),
        dependencies: new Set(['ApexClass:Base']),
        dependents: new Set(),
        priorityBoost: 4,
      },
    ],
  };
}

function createWaveResult(): WaveResult {
  return {
    waves: [
      {
        number: 1,
        components: ['ApexClass:Base'],
        metadata: {
          componentCount: 1,
          types: ['ApexClass'],
          maxDepth: 0,
          hasCircularDeps: false,
          estimatedTime: 5,
        },
      },
      {
        number: 2,
        components: ['ApexClass:Service'],
        metadata: {
          componentCount: 1,
          types: ['ApexClass'],
          maxDepth: 1,
          hasCircularDeps: false,
          estimatedTime: 5,
        },
      },
    ],
    circularDependencies: [],
    unplacedComponents: [],
    totalComponents: 2,
    stats: {
      totalWaves: 2,
      totalEstimatedTime: 10,
      avgComponentsPerWave: 1,
      largestWaveSize: 1,
      smallestWaveSize: 1,
    },
  };
}

describe('AnalyzeArtifactService', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map(async (directory) => rm(directory, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('saves deployment plan and report artifacts together', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'analyze-artifacts-'));
    tempDirs.push(tempDir);
    const service = new AnalyzeArtifactService();
    const planPath = path.join(tempDir, 'plan.json');
    const reportPath = path.join(tempDir, 'report.json');
    const scanResult = createScanResult(tempDir);
    const waveResult = createWaveResult();
    const priorityOverrides: Record<string, PriorityOverride> = {
      'ApexClass:Base': {
        priority: 2,
        source: 'ai',
        appliedAt: '2026-04-25T00:00:00.000Z',
      },
    };

    const result = await service.generateArtifacts(scanResult, waveResult, priorityOverrides, {
      savePlan: true,
      planPath,
      outputPath: reportPath,
      outputFormat: 'json',
      aiEnabled: true,
      aiContext: {
        enabled: true,
        provider: 'agentforce',
        model: 'agentforce-1',
        aiAdjustments: 1,
        inferredDependencies: 0,
        inferenceFallback: true,
      },
      orgType: 'Production',
      industry: 'Fintech',
    });

    const plan = JSON.parse(await readFile(planPath, 'utf8')) as {
      metadata: { aiEnabled: boolean; aiModel?: string };
      priorityOverrides: Record<string, { source: string; priority: number }>;
    };
    const report = JSON.parse(await readFile(reportPath, 'utf8')) as {
      summary: { components: number };
      ai?: { provider?: string };
    };

    expect(result).to.deep.equal({
      planSaved: true,
      planPath,
      reportSaved: true,
      reportPath,
      reportFormat: 'json',
    });
    expect(plan.metadata.aiEnabled).to.equal(true);
    expect(plan.metadata.aiModel).to.equal('agentforce-1');
    expect(plan.priorityOverrides['ApexClass:Base'].source).to.equal('ai');
    expect(plan.priorityOverrides['ApexClass:Service'].source).to.equal('static');
    expect(report.summary.components).to.equal(2);
    expect(report.ai?.provider).to.equal('agentforce');
  });
});
