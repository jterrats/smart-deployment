/**
 * Dependency Merger
 * Merges static parser dependencies with AI-inferred dependencies
 *
 * @ac US-037-AC-1: Merge static parser dependencies
 * @ac US-037-AC-2: Merge AI-inferred dependencies
 * @ac US-037-AC-3: Resolve conflicts (prefer static)
 * @ac US-037-AC-4: Track dependency source
 * @ac US-037-AC-5: Report merged dependencies
 * @ac US-037-AC-6: Confidence scoring
 *
 * @issue #37
 */

import { getLogger } from '../utils/logger.js';
import type { NodeId, DependencyGraph, InferredDependency } from '../types/dependency.js';
import type { MetadataComponent, MetadataDependencyReference } from '../types/metadata.js';

const logger = getLogger('DependencyMerger');

/**
 * Dependency source
 */
export type DependencySource = 'static' | 'inferred' | 'merged';

/**
 * Merged dependency information
 */
export type MergedDependency = {
  from: NodeId;
  to: NodeId;
  source: DependencySource;
  confidence: number;
  reasons: string[];
};

/**
 * Merge result
 */
export type MergeResult = {
  graph: DependencyGraph;
  components: Map<NodeId, MetadataComponent>;
  dependencies: MergedDependency[];
  stats: MergeStats;
};

/**
 * Merge statistics
 */
export type MergeStats = {
  totalDependencies: number;
  staticDependencies: number;
  inferredDependencies: number;
  mergedDependencies: number;
  conflicts: number;
  avgConfidence: number;
};

/**
 * Merger options
 */
export type MergerOptions = {
  /** Minimum confidence threshold for inferred dependencies (0-1) */
  minConfidence?: number;
  /** Prefer static over inferred in conflicts */
  preferStatic?: boolean;
  /** Include low confidence inferences */
  includeLowConfidence?: boolean;
};

/**
 * Dependency Merger
 *
 * Merges dependencies from multiple sources:
 * 1. Static parser dependencies (from metadata files)
 * 2. AI-inferred dependencies (from heuristics/patterns)
 *
 * Conflict Resolution:
 * - Static dependencies always take precedence
 * - Inferred dependencies are added if not in static
 * - Confidence scores help prioritize inferences
 *
 * Performance: O(V + E)
 *
 * @example
 * const merger = new DependencyMerger({
 *   minConfidence: 0.7,
 *   preferStatic: true
 * });
 *
 * const result = merger.merge(components, inferences);
 * console.log(`Merged ${result.stats.totalDependencies} dependencies`);
 */
export class DependencyMerger {
  private options: Required<MergerOptions>;

  public constructor(options: MergerOptions = {}) {
    this.options = {
      minConfidence: options.minConfidence ?? 0.5,
      preferStatic: options.preferStatic ?? true,
      includeLowConfidence: options.includeLowConfidence ?? false,
    };

    logger.debug('Initialized DependencyMerger', {
      minConfidence: this.options.minConfidence,
      preferStatic: this.options.preferStatic,
    });
  }

  /**
   * @ac US-037-AC-1: Merge static parser dependencies
   * @ac US-037-AC-2: Merge AI-inferred dependencies
   * @ac US-037-AC-3: Resolve conflicts (prefer static)
   * @ac US-037-AC-4: Track dependency source
   * @ac US-037-AC-5: Report merged dependencies
   */
  public merge(components: Map<NodeId, MetadataComponent>, inferences: InferredDependency[]): MergeResult {
    const startTime = Date.now();
    const mergedComponents = this.cloneComponents(components);
    const graph: DependencyGraph = new Map();
    const dependencies: MergedDependency[] = [];
    const staticEdges = new Set<string>();
    this.applyStaticDependencies(mergedComponents, graph, dependencies, staticEdges);
    const inferredStats = this.applyInferredDependencies(
      mergedComponents,
      inferences,
      graph,
      dependencies,
      staticEdges
    );
    const stats = this.buildStats(dependencies, staticEdges.size, inferredStats);

    const duration = Date.now() - startTime;
    logger.info('Dependency merge completed', {
      total: stats.totalDependencies,
      static: stats.staticDependencies,
      inferred: stats.inferredDependencies,
      conflicts: stats.conflicts,
      durationMs: duration,
    });

    return { graph, components: mergedComponents, dependencies, stats };
  }

  private cloneComponents(components: Map<NodeId, MetadataComponent>): Map<NodeId, MetadataComponent> {
    return new Map(
      [...components.entries()].map(([nodeId, component]) => [
        nodeId,
        {
          ...component,
          dependencies: new Set(component.dependencies),
          dependencyDetails: [...(component.dependencyDetails ?? [])],
          dependents: new Set(component.dependents),
        },
      ])
    );
  }

  private applyStaticDependencies(
    mergedComponents: Map<NodeId, MetadataComponent>,
    graph: DependencyGraph,
    dependencies: MergedDependency[],
    staticEdges: Set<string>
  ): void {
    for (const [nodeId, component] of mergedComponents.entries()) {
      graph.set(nodeId, new Set());
      const staticDependencyDetails = this.getStaticDependencyDetails(component);
      component.dependencyDetails = [...staticDependencyDetails];

      for (const dep of staticDependencyDetails) {
        graph.get(nodeId)!.add(dep.nodeId);
        staticEdges.add(`${nodeId}→${dep.nodeId}`);
        dependencies.push({
          from: nodeId,
          to: dep.nodeId,
          source: 'static',
          confidence: 1.0,
          reasons: [dep.reason ?? 'Explicit reference in metadata'],
        });
      }
    }
  }

  private getStaticDependencyDetails(component: MetadataComponent): MetadataDependencyReference[] {
    if (component.dependencyDetails && component.dependencyDetails.length > 0) {
      return component.dependencyDetails.filter((dependency) => dependency.kind !== 'inferred');
    }

    return [...component.dependencies].map(
      (dep): MetadataDependencyReference => ({
        nodeId: dep,
        kind: component.optionalDependencies?.has(dep) ? 'soft' : 'hard',
        source: 'parser',
        reason: 'Explicit reference in metadata',
      })
    );
  }

  private applyInferredDependencies(
    mergedComponents: Map<NodeId, MetadataComponent>,
    inferences: InferredDependency[],
    graph: DependencyGraph,
    dependencies: MergedDependency[],
    staticEdges: Set<string>
  ): { conflicts: number; inferredCount: number; totalConfidence: number } {
    let conflicts = 0;
    let inferredCount = 0;
    let totalConfidence = 0;

    for (const inference of inferences) {
      if (!this.shouldIncludeInference(inference)) {
        continue;
      }

      const edgeKey = `${inference.from}→${inference.to}`;
      if (staticEdges.has(edgeKey)) {
        conflicts++;
        this.mergeConflictReason(dependencies, inference);
        continue;
      }

      this.addInferredDependency(mergedComponents, graph, dependencies, inference);
      inferredCount++;
      totalConfidence += inference.confidence;
    }

    return { conflicts, inferredCount, totalConfidence };
  }

  private shouldIncludeInference(inference: InferredDependency): boolean {
    if (inference.confidence >= this.options.minConfidence || this.options.includeLowConfidence) {
      return true;
    }

    logger.debug('Skipping low confidence inference', {
      from: inference.from,
      to: inference.to,
      confidence: inference.confidence,
    });
    return false;
  }

  private mergeConflictReason(dependencies: MergedDependency[], inference: InferredDependency): void {
    logger.debug('Conflict: static dependency exists', {
      from: inference.from,
      to: inference.to,
    });

    if (this.options.preferStatic) {
      return;
    }

    const existing = dependencies.find(
      (dependency) => dependency.from === inference.from && dependency.to === inference.to
    );
    if (existing) {
      existing.source = 'merged';
      existing.reasons.push(inference.reason);
    }
  }

  private addInferredDependency(
    mergedComponents: Map<NodeId, MetadataComponent>,
    graph: DependencyGraph,
    dependencies: MergedDependency[],
    inference: InferredDependency
  ): void {
    if (!graph.has(inference.from)) {
      graph.set(inference.from, new Set());
    }

    graph.get(inference.from)!.add(inference.to);
    this.updateComponentInferenceDetails(mergedComponents.get(inference.from), inference);

    dependencies.push({
      from: inference.from,
      to: inference.to,
      source: 'inferred',
      confidence: inference.confidence,
      reasons: [inference.reason],
    });
  }

  private updateComponentInferenceDetails(
    sourceComponent: MetadataComponent | undefined,
    inference: InferredDependency
  ): void {
    if (!sourceComponent) {
      return;
    }

    const component = sourceComponent;
    component.dependencies.add(inference.to);
    component.dependencyDetails ??= [];
    const existing = component.dependencyDetails.find((dependency) => dependency.nodeId === inference.to);
    if (existing) {
      existing.kind = existing.kind === 'hard' ? 'hard' : 'inferred';
      existing.source = existing.source === 'parser' ? 'merged' : 'ai';
      existing.reason = existing.reason ? `${existing.reason}; ${inference.reason}` : inference.reason;
      existing.confidence = inference.confidence;
      return;
    }

    component.dependencyDetails.push({
      nodeId: inference.to,
      kind: 'inferred',
      source: 'ai',
      reason: inference.reason,
      confidence: inference.confidence,
    });
  }

  private buildStats(
    dependencies: MergedDependency[],
    staticDependencyCount: number,
    inferredStats: { conflicts: number; inferredCount: number; totalConfidence: number }
  ): MergeStats {
    return {
      totalDependencies: dependencies.length,
      staticDependencies: staticDependencyCount,
      inferredDependencies: inferredStats.inferredCount,
      mergedDependencies: dependencies.filter((dependency) => dependency.source === 'merged').length,
      conflicts: inferredStats.conflicts,
      avgConfidence:
        inferredStats.inferredCount > 0 ? inferredStats.totalConfidence / inferredStats.inferredCount : 1.0,
    };
  }

  /**
   * Filter dependencies by confidence
   */
  public filterByConfidence(dependencies: MergedDependency[], minConfidence: number): MergedDependency[] {
    return dependencies.filter((dep) => dep.confidence >= minConfidence);
  }

  /**
   * Get dependencies by source
   */
  public getDependenciesBySource(dependencies: MergedDependency[], source: DependencySource): MergedDependency[] {
    return dependencies.filter((dep) => dep.source === source);
  }

  /**
   * Get low confidence dependencies (potential false positives)
   */
  public getLowConfidenceDependencies(dependencies: MergedDependency[], threshold: number = 0.7): MergedDependency[] {
    return dependencies.filter((dep) => dep.source === 'inferred' && dep.confidence < threshold);
  }

  /**
   * @ac US-037-AC-6: Confidence scoring
   */
  public calculateOverallConfidence(dependencies: MergedDependency[]): number {
    if (dependencies.length === 0) {
      return 1.0;
    }

    const total = dependencies.reduce((sum, dep) => sum + dep.confidence, 0);
    return total / dependencies.length;
  }

  /**
   * Get conflicts (dependencies that exist in both static and inferred)
   */
  public getConflicts(
    staticDeps: Set<string>,
    inferences: InferredDependency[]
  ): Array<{ from: NodeId; to: NodeId; confidence: number }> {
    const conflicts: Array<{ from: NodeId; to: NodeId; confidence: number }> = [];

    for (const inference of inferences) {
      const edgeKey = `${inference.from}→${inference.to}`;
      if (staticDeps.has(edgeKey)) {
        conflicts.push({
          from: inference.from,
          to: inference.to,
          confidence: inference.confidence,
        });
      }
    }

    return conflicts;
  }

  /**
   * Generate merge report
   */
  public generateReport(result: MergeResult): string {
    const lines: string[] = [];

    lines.push('# Dependency Merge Report');
    lines.push('');
    lines.push('## Statistics');
    lines.push(`- Total Dependencies: ${result.stats.totalDependencies}`);
    lines.push(`- Static Dependencies: ${result.stats.staticDependencies}`);
    lines.push(`- Inferred Dependencies: ${result.stats.inferredDependencies}`);
    lines.push(`- Merged Dependencies: ${result.stats.mergedDependencies}`);
    lines.push(`- Conflicts Resolved: ${result.stats.conflicts}`);
    lines.push(`- Average Confidence: ${(result.stats.avgConfidence * 100).toFixed(1)}%`);
    lines.push('');

    // Group by source
    const bySource = {
      static: this.getDependenciesBySource(result.dependencies, 'static'),
      inferred: this.getDependenciesBySource(result.dependencies, 'inferred'),
      merged: this.getDependenciesBySource(result.dependencies, 'merged'),
    };

    lines.push('## Dependencies by Source');
    lines.push('');
    lines.push(`### Static (${bySource.static.length})`);
    lines.push('Direct references from metadata files');
    lines.push('');

    lines.push(`### Inferred (${bySource.inferred.length})`);
    if (bySource.inferred.length > 0) {
      lines.push('AI/Heuristic inferred dependencies:');
      for (const dep of bySource.inferred.slice(0, 10)) {
        lines.push(`- ${dep.from} → ${dep.to} (${(dep.confidence * 100).toFixed(0)}%)`);
        lines.push(`  Reason: ${dep.reasons.join(', ')}`);
      }
      if (bySource.inferred.length > 10) {
        lines.push(`... and ${bySource.inferred.length - 10} more`);
      }
    }
    lines.push('');

    lines.push(`### Merged (${bySource.merged.length})`);
    lines.push('Dependencies confirmed by both static and inferred sources');
    lines.push('');

    // Low confidence warnings
    const lowConf = this.getLowConfidenceDependencies(result.dependencies, 0.7);
    if (lowConf.length > 0) {
      lines.push('## ⚠️ Low Confidence Dependencies');
      lines.push(`Found ${lowConf.length} dependencies with confidence < 70%`);
      lines.push('Consider manual review of these inferences.');
      lines.push('');
    }

    return lines.join('\n');
  }
}
