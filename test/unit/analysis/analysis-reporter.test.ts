import { expect } from 'chai';
import { AnalysisReporter } from '../../../src/analysis/analysis-reporter.js';
import type { ScanResult } from '../../../src/services/metadata-scanner-service.js';
import type { WaveResult } from '../../../src/waves/wave-builder.js';

describe('AnalysisReporter', () => {
  function createScanResult(): ScanResult {
    const components = [
      {
        name: 'Service',
        type: 'ApexClass' as const,
        filePath: 'classes/Service.cls',
        dependencies: new Set(['ApexClass:Base', 'CustomObject:Account']),
        optionalDependencies: new Set(['CustomObject:Account']),
        dependents: new Set<string>(),
        priorityBoost: 0,
      },
      {
        name: 'Base',
        type: 'ApexClass' as const,
        filePath: 'classes/Base.cls',
        dependencies: new Set<string>(),
        dependents: new Set(['ApexClass:Service']),
        priorityBoost: 0,
      },
      {
        name: 'Account',
        type: 'CustomObject' as const,
        filePath: 'objects/Account.object-meta.xml',
        dependencies: new Set<string>(),
        dependents: new Set(['ApexClass:Service']),
        priorityBoost: 0,
      },
      {
        name: 'Utility',
        type: 'ApexClass' as const,
        filePath: 'classes/Utility.cls',
        dependencies: new Set<string>(),
        dependents: new Set(['ApexClass:Service']),
        priorityBoost: 0,
      },
    ];

    return {
      projectRoot: '/tmp/project',
      components,
      dependencyResult: {
        components: new Map(components.map((component) => [`${component.type}:${component.name}`, component])),
        graph: new Map([
          ['ApexClass:Service', new Set(['ApexClass:Base', 'CustomObject:Account', 'ApexClass:Utility'])],
          ['ApexClass:Base', new Set()],
          ['CustomObject:Account', new Set()],
          ['ApexClass:Utility', new Set()],
        ]),
        reverseGraph: new Map([
          ['ApexClass:Base', new Set(['ApexClass:Service'])],
          ['CustomObject:Account', new Set(['ApexClass:Service'])],
          ['ApexClass:Utility', new Set(['ApexClass:Service'])],
          ['ApexClass:Service', new Set()],
        ]),
        edges: [
          {
            from: 'ApexClass:Service',
            to: 'ApexClass:Base',
            type: 'hard',
            source: 'parser',
          },
          {
            from: 'ApexClass:Service',
            to: 'CustomObject:Account',
            type: 'soft',
            source: 'parser',
          },
          {
            from: 'ApexClass:Service',
            to: 'ApexClass:Utility',
            type: 'inferred',
            source: 'ai',
            confidence: 0.91,
            reason: 'AI-inferred dependency',
          },
        ],
        circularDependencies: [],
        isolatedComponents: [],
        stats: {
          totalComponents: 4,
          totalDependencies: 3,
          componentsByType: {
            ApexClass: 3,
            CustomObject: 1,
          },
          maxDepth: 2,
          mostDepended: { nodeId: 'ApexClass:Base', count: 1 },
          mostDependencies: { nodeId: 'ApexClass:Service', count: 3 },
        },
      },
      errors: [],
      warnings: [],
      executionTime: 42,
    };
  }

  function createWaveResult(): WaveResult {
    return {
      waves: [
        {
          number: 1,
          components: ['ApexClass:Base', 'CustomObject:Account', 'ApexClass:Utility'],
          metadata: {
            componentCount: 3,
            types: ['ApexClass', 'CustomObject'],
            maxDepth: 1,
            hasCircularDeps: false,
            estimatedTime: 30,
          },
        },
        {
          number: 2,
          components: ['ApexClass:Service'],
          metadata: {
            componentCount: 1,
            types: ['ApexClass'],
            maxDepth: 2,
            hasCircularDeps: false,
            estimatedTime: 10,
          },
        },
      ],
      totalComponents: 4,
      unplacedComponents: [],
      circularDependencies: [],
      stats: {
        totalWaves: 2,
        avgComponentsPerWave: 2,
        largestWaveSize: 3,
        smallestWaveSize: 1,
        totalEstimatedTime: 40,
      },
    };
  }

  it('creates a report with typed dependency edges and breakdown', () => {
    const reporter = new AnalysisReporter();
    const report = reporter.createReport(createScanResult(), createWaveResult(), {
      enabled: true,
      provider: 'openai',
      model: 'gpt-test',
      aiAdjustments: 1,
      inferredDependencies: 1,
      inferenceFallback: false,
    });

    expect(report.summary.dependencies).to.equal(3);
    expect(report.summary.dependencyBreakdown).to.deep.equal({
      hard: 1,
      soft: 1,
      inferred: 1,
    });
    expect(report.dependencyGraph.edges).to.have.lengthOf(3);
    expect(report.dependencyGraph.visualizations.mermaid).to.include('-.->|soft|');
    expect(report.dependencyGraph.visualizations.mermaid).to.include('==>|inferred|');
    expect(report.dependencyGraph.visualizations.dot).to.include('label="soft"');
    expect(report.dependencyGraph.visualizations.dot).to.include('label="inferred"');
  });

  it('serializes dependency graph data to json output', () => {
    const reporter = new AnalysisReporter();
    const report = reporter.createReport(createScanResult(), createWaveResult());
    const parsed = JSON.parse(reporter.toJSON(report)) as {
      dependencyGraph: {
        edges: Array<{ type: string }>;
        visualizations: { mermaid: string; dot: string };
      };
    };

    expect(parsed.dependencyGraph.edges.map((edge) => edge.type)).to.deep.equal(['hard', 'inferred', 'soft']);
    expect(parsed.dependencyGraph.visualizations.mermaid).to.include('graph TD');
    expect(parsed.dependencyGraph.visualizations.dot).to.include('digraph Dependencies');
  });

  it('renders dependency edges and visualizations in html output', () => {
    const reporter = new AnalysisReporter();
    const report = reporter.createReport(createScanResult(), createWaveResult());
    const html = reporter.toHTML(report);

    expect(html).to.include('Dependency Edges');
    expect(html).to.include('Dependency Visualizations');
    expect(html).to.include('Hard / Soft / Inferred');
    expect(html).to.include('ApexClass:Service');
    expect(html).to.include('CustomObject:Account');
    expect(html).to.include('graph TD');
    expect(html).to.include('digraph Dependencies');
  });
});
