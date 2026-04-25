import { writeFile } from 'node:fs/promises';
import { GraphVisualizer } from '../dependencies/graph-visualizer.js';
import type { ScanResult } from '../services/metadata-scanner-service.js';
import type { WaveResult } from '../waves/wave-builder.js';
import type { DependencyEdge } from '../types/dependency.js';
import type { MetadataDependencyKind } from '../types/metadata.js';

export type AnalysisAIContext = {
  enabled: boolean;
  provider?: string;
  model?: string;
  aiAdjustments?: number;
  unknownTypes?: string[];
  inferredDependencies?: number;
  inferenceFallback?: boolean;
};

export type AnalysisAIEffect = {
  priorityAdjustments: number;
  inferredDependencies: number;
  fallbackApplied: boolean;
  unknownTypeCount: number;
  summary: string;
};

export type AnalysisReport = {
  generatedAt: string;
  projectRoot: string;
  summary: {
    components: number;
    dependencies: number;
    dependencyBreakdown: Record<MetadataDependencyKind, number>;
    waves: number;
    circularDependencies: number;
    unplacedComponents: number;
    estimatedTimeSeconds: number;
  };
  ai?: AnalysisAIContext & {
    effect: AnalysisAIEffect;
  };
  componentsByType: Record<string, string[]>;
  dependencyGraph: {
    edges: DependencyEdge[];
    visualizations: {
      mermaid: string;
      dot: string;
    };
  };
  issues: Array<{
    severity: 'error' | 'warning';
    message: string;
  }>;
  waves: Array<{
    number: number;
    components: string[];
    metadata: {
      componentCount: number;
      types: string[];
      maxDepth: number;
      hasCircularDeps: boolean;
      estimatedTime: number;
    };
  }>;
};

export class AnalysisReporter {
  public createReport(scanResult: ScanResult, waveResult: WaveResult, aiContext?: AnalysisAIContext): AnalysisReport {
    const componentsByType = scanResult.components.reduce<Record<string, string[]>>((accumulator, component) => {
      const nodeId = `${component.type}:${component.name}`;
      const next = accumulator[component.type] ?? [];
      return {
        ...accumulator,
        [component.type]: [...next, nodeId],
      };
    }, {});

    for (const componentNames of Object.values(componentsByType)) {
      componentNames.sort();
    }

    const aiReportContext = aiContext
      ? {
          ...aiContext,
          effect: AnalysisReporter.createAIEffect(aiContext),
        }
      : undefined;
    const dependencyGraph = AnalysisReporter.createDependencyGraph(scanResult);

    return {
      generatedAt: new Date().toISOString(),
      projectRoot: scanResult.projectRoot,
      summary: {
        components: scanResult.components.length,
        dependencies: scanResult.dependencyResult.stats.totalDependencies,
        dependencyBreakdown: AnalysisReporter.createDependencyBreakdown(scanResult),
        waves: waveResult.waves.length,
        circularDependencies: waveResult.circularDependencies.length,
        unplacedComponents: waveResult.unplacedComponents.length,
        estimatedTimeSeconds: waveResult.stats.totalEstimatedTime,
      },
      ai: aiReportContext,
      componentsByType,
      dependencyGraph,
      issues: [
        ...scanResult.errors.map((message) => ({ severity: 'error' as const, message })),
        ...scanResult.warnings.map((message) => ({ severity: 'warning' as const, message })),
        ...waveResult.circularDependencies.map((cycle) => ({
          severity: cycle.severity === 'warning' ? ('warning' as const) : ('error' as const),
          message: cycle.message,
        })),
      ],
      waves: waveResult.waves.map((wave) => ({
        number: wave.number,
        components: [...wave.components],
        metadata: {
          componentCount: wave.metadata.componentCount,
          types: [...wave.metadata.types],
          maxDepth: wave.metadata.maxDepth,
          hasCircularDeps: wave.metadata.hasCircularDeps,
          estimatedTime: wave.metadata.estimatedTime,
        },
      })),
    };
  }

  public toJSON(report: AnalysisReport): string {
    return JSON.stringify(report, null, 2);
  }

  private static createAIEffect(aiContext: AnalysisAIContext): AnalysisAIEffect {
    const priorityAdjustments = aiContext.aiAdjustments ?? 0;
    const inferredDependencies = aiContext.inferredDependencies ?? 0;
    const fallbackApplied = aiContext.inferenceFallback ?? false;
    const unknownTypeCount = aiContext.unknownTypes?.length ?? 0;
    const summary = [
      `${priorityAdjustments} priority adjustment(s) applied`,
      `${inferredDependencies} inferred dependenc${inferredDependencies === 1 ? 'y' : 'ies'} accepted`,
      fallbackApplied ? 'static fallback used for dependency inference' : 'no dependency inference fallback',
      `${unknownTypeCount} unknown type(s) flagged`,
    ].join('; ');

    return {
      priorityAdjustments,
      inferredDependencies,
      fallbackApplied,
      unknownTypeCount,
      summary,
    };
  }

  private static createDependencyBreakdown(scanResult: ScanResult): Record<MetadataDependencyKind, number> {
    return scanResult.dependencyResult.edges.reduce<Record<MetadataDependencyKind, number>>(
      (accumulator, edge) => ({
        ...accumulator,
        [edge.type]: accumulator[edge.type] + 1,
      }),
      {
        hard: 0,
        soft: 0,
        inferred: 0,
      }
    );
  }

  private static createDependencyGraph(scanResult: ScanResult): AnalysisReport['dependencyGraph'] {
    const edges = [...scanResult.dependencyResult.edges].sort(
      (left, right) =>
        left.from.localeCompare(right.from) || left.to.localeCompare(right.to) || left.type.localeCompare(right.type)
    );
    const visualizer = new GraphVisualizer(scanResult.dependencyResult.graph, {
      edgeMetadata: edges,
    });

    return {
      edges,
      visualizations: {
        mermaid: visualizer.toMermaid(),
        dot: visualizer.toDot(),
      },
    };
  }

  public toHTML(report: AnalysisReport): string {
    const issueItems =
      report.issues.length > 0
        ? report.issues
            .map((issue) => `<li><strong>${issue.severity.toUpperCase()}</strong>: ${escapeHtml(issue.message)}</li>`)
            .join('')
        : '<li>No issues detected.</li>';

    const waveRows = report.waves
      .map(
        (wave) => `
      <tr>
        <td>${wave.number}</td>
        <td>${wave.metadata.componentCount}</td>
        <td>${wave.metadata.types.join(', ') || 'Unknown'}</td>
        <td>${wave.metadata.estimatedTime}s</td>
        <td>${wave.metadata.hasCircularDeps ? 'Yes' : 'No'}</td>
      </tr>
    `
      )
      .join('');
    const dependencyRows =
      report.dependencyGraph.edges.length > 0
        ? report.dependencyGraph.edges
            .map(
              (edge) => `
      <tr>
        <td><code>${escapeHtml(edge.from)}</code></td>
        <td><code>${escapeHtml(edge.to)}</code></td>
        <td>${escapeHtml(edge.type)}</td>
        <td>${escapeHtml(edge.source ?? 'parser')}</td>
        <td>${edge.confidence !== undefined ? edge.confidence.toFixed(2) : 'n/a'}</td>
      </tr>
    `
            )
            .join('')
        : '<tr><td colspan="5">No dependency edges detected.</td></tr>';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Analysis Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
    h1, h2 { margin-bottom: 0.5rem; }
    table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
    th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
    th { background: #f3f4f6; }
    .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; background: #fff; }
  </style>
</head>
<body>
  <h1>Metadata Analysis Report</h1>
  <p>Generated at ${escapeHtml(report.generatedAt)}</p>
  <p>Project root: <code>${escapeHtml(report.projectRoot)}</code></p>

  <div class="summary">
    <div class="card"><strong>Components</strong><br>${report.summary.components}</div>
    <div class="card"><strong>Dependencies</strong><br>${report.summary.dependencies}</div>
    <div class="card"><strong>Hard / Soft / Inferred</strong><br>${report.summary.dependencyBreakdown.hard} / ${
      report.summary.dependencyBreakdown.soft
    } / ${report.summary.dependencyBreakdown.inferred}</div>
    <div class="card"><strong>Waves</strong><br>${report.summary.waves}</div>
    <div class="card"><strong>Circular Dependencies</strong><br>${report.summary.circularDependencies}</div>
    <div class="card"><strong>Unplaced Components</strong><br>${report.summary.unplacedComponents}</div>
    <div class="card"><strong>Estimated Time</strong><br>${report.summary.estimatedTimeSeconds}s</div>
  </div>

  ${
    report.ai?.enabled
      ? `
  <h2>AI Transparency</h2>
  <p>Provider: <strong>${escapeHtml(report.ai.provider ?? 'unknown')}</strong></p>
  <p>Model: <strong>${escapeHtml(report.ai.model ?? 'default')}</strong></p>
  <p>Priority adjustments applied: <strong>${report.ai.effect.priorityAdjustments}</strong></p>
  <p>Inferred dependencies accepted: <strong>${report.ai.effect.inferredDependencies}</strong></p>
  <p>Inference fallback used: <strong>${report.ai.effect.fallbackApplied ? 'Yes' : 'No'}</strong></p>
  <p>AI effect summary: <strong>${escapeHtml(report.ai.effect.summary)}</strong></p>
  <p>Unknown types: <strong>${escapeHtml((report.ai.unknownTypes ?? []).join(', ') || 'None')}</strong></p>
  `
      : ''
  }

  <h2>Issues</h2>
  <ul>${issueItems}</ul>

  <h2>Wave Breakdown</h2>
  <table>
    <thead>
      <tr>
        <th>Wave</th>
        <th>Components</th>
        <th>Types</th>
        <th>Estimated Time</th>
        <th>Circular</th>
      </tr>
    </thead>
    <tbody>${waveRows}</tbody>
  </table>

  <h2>Dependency Edges</h2>
  <table>
    <thead>
      <tr>
        <th>From</th>
        <th>To</th>
        <th>Type</th>
        <th>Source</th>
        <th>Confidence</th>
      </tr>
    </thead>
    <tbody>${dependencyRows}</tbody>
  </table>

  <h2>Dependency Visualizations</h2>
  <h3>Mermaid</h3>
  <pre>${escapeHtml(report.dependencyGraph.visualizations.mermaid)}</pre>
  <h3>DOT</h3>
  <pre>${escapeHtml(report.dependencyGraph.visualizations.dot)}</pre>
</body>
</html>
    `.trim();
  }

  public async saveReport(report: AnalysisReport, outputPath: string, format: 'json' | 'html'): Promise<void> {
    const content = format === 'html' ? this.toHTML(report) : this.toJSON(report);
    await writeFile(outputPath, content, 'utf8');
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
