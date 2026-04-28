/**
 * Dependency Graph Builder
 * Builds a dependency graph from parsed metadata components
 *
 * @ac US-028-AC-1: Add nodes for each component
 * @ac US-028-AC-2: Add edges for each dependency
 * @ac US-028-AC-3: Handle bidirectional dependencies
 * @ac US-028-AC-4: Track dependency types (hard, soft)
 * @ac US-028-AC-5: Support incremental graph building
 * @ac US-028-AC-6: Validate graph structure
 *
 * @issue #28
 */

import { getLogger } from '../utils/logger.js';
import type { MetadataComponent, MetadataDependencyKind, MetadataType } from '../types/metadata.js';
import type {
  NodeId,
  DependencyGraph,
  ReverseGraph,
  DependencyAnalysisResult,
  DependencyStats,
  CircularDependency,
  DependencyEdge,
} from '../types/dependency.js';
import {
  DEFAULT_GRAPH_DEPENDENCY_KIND,
  expandComponentDependencyReferences,
  getDependencySourceForKind,
} from './dependency-semantics.js';

const logger = getLogger('DependencyGraphBuilder');

type ExpandedDependencyDetail = {
  nodeId: NodeId;
  kind: DependencyType;
  reason?: string;
  confidence?: number;
};

type ValidationSummary = {
  selfLoopErrors: string[];
};

type GraphCounts = {
  dependencyCounts: Map<NodeId, number>;
  dependentCounts: Map<NodeId, number>;
};

type ComponentIntake = {
  nodeId: NodeId;
  dependencyDetails: ExpandedDependencyDetail[];
};

type BuildAnnotations = {
  circularDependencies: CircularDependency[];
  isolatedComponents: NodeId[];
};

type EdgeEndpoints = {
  from: NodeId;
  to: NodeId;
};

type GraphMetrics = {
  totalComponents: number;
  totalDependencies: number;
  maxDepth: number;
  componentsByType: Record<string, number>;
  counts: GraphCounts;
};

/**
 * Dependency types for tracking relationship strength
 */
export type DependencyType = MetadataDependencyKind;

/**
 * Options for building the dependency graph
 */
export type GraphBuilderOptions = {
  /** Track dependency types (hard/soft/inferred) */
  trackDependencyTypes?: boolean;
  /** Validate graph structure during build */
  validateStructure?: boolean;
  /** Max nodes before warning (performance) */
  maxNodes?: number;
};

/**
 * Dependency Graph Builder
 *
 * Performance optimized for 10,000+ nodes:
 * - Uses Map/Set for O(1) lookups
 * - Lazy validation
 * - Incremental building support
 *
 * @example
 * const builder = new DependencyGraphBuilder();
 * builder.addComponent(apexClassComponent);
 * builder.addComponent(triggerComponent);
 * const result = builder.build();
 * console.log(result.stats.totalComponents); // 2
 */
export class DependencyGraphBuilder {
  // Private properties
  private components: Map<NodeId, MetadataComponent> = new Map();
  private graph: DependencyGraph = new Map();
  private reverseGraph: ReverseGraph = new Map();
  private edges: Map<string, DependencyEdge> = new Map(); // "from->to" => edge
  private options: Required<GraphBuilderOptions>;

  // Constructor
  public constructor(options: GraphBuilderOptions = {}) {
    this.options = {
      trackDependencyTypes: options.trackDependencyTypes ?? true,
      validateStructure: options.validateStructure ?? true,
      maxNodes: options.maxNodes ?? 50_000,
    };

    logger.debug('Initialized DependencyGraphBuilder', {
      options: this.options,
    });
  }

  // Public getters
  /**
   * Get current size of the graph
   */
  public get size(): number {
    return this.components.size;
  }

  /**
   * Check if graph is empty
   */
  public get isEmpty(): boolean {
    return this.components.size === 0;
  }

  // Private static methods
  /**
   * Create a node ID from type and name
   */
  private static createNodeId(type: MetadataType, name: string): NodeId {
    return `${type}:${name}`;
  }

  // Public methods
  /**
   * Add a metadata component to the graph
   *
   * @ac US-028-AC-1: Add nodes for each component
   * @ac US-028-AC-5: Support incremental graph building
   */
  public addComponent(component: MetadataComponent): void {
    const intake = this.normalizeComponentIntake(component);
    this.ingestComponentDependencies(intake);

    logger.debug('Added component to graph', {
      nodeId: intake.nodeId,
      dependencies: intake.dependencyDetails.length,
    });
  }

  /**
   * Add multiple components at once
   *
   * @ac US-028-AC-5: Support incremental graph building
   */
  public addComponents(components: MetadataComponent[]): void {
    const startTime = Date.now();

    for (const component of components) {
      this.addComponent(component);
    }

    const duration = Date.now() - startTime;
    logger.info('Added multiple components', {
      count: components.length,
      totalNodes: this.components.size,
      durationMs: duration,
    });
  }

  /**
   * Add a dependency edge between two nodes
   *
   * @ac US-028-AC-2: Add edges for each dependency
   * @ac US-028-AC-3: Handle bidirectional dependencies
   * @ac US-028-AC-4: Track dependency types
   */
  public addEdge(from: NodeId, to: NodeId, type: DependencyType = 'hard', reason?: string, confidence?: number): void {
    this.ensureEdgeEndpoints(from, to);
    this.graph.get(from)!.add(to);
    this.reverseGraph.get(to)!.add(from);

    if (this.options.trackDependencyTypes) {
      const edgeKey = `${from}->${to}`;
      this.edges.set(edgeKey, {
        from,
        to,
        type,
        reason,
        confidence,
        source: getDependencySourceForKind(type),
      });
    }

    logger.debug('Added dependency edge', { from, to, type });
  }

  /**
   * Remove a component and its edges from the graph
   */
  public removeComponent(nodeId: NodeId): boolean {
    if (!this.components.has(nodeId)) {
      return false;
    }

    // Remove component
    this.components.delete(nodeId);

    // Remove outgoing edges
    const outgoing = this.graph.get(nodeId);
    if (outgoing) {
      for (const to of outgoing) {
        this.reverseGraph.get(to)?.delete(nodeId);
      }
      this.graph.delete(nodeId);
    }

    // Remove incoming edges
    const incoming = this.reverseGraph.get(nodeId);
    if (incoming) {
      for (const from of incoming) {
        this.graph.get(from)?.delete(nodeId);
      }
      this.reverseGraph.delete(nodeId);
    }

    logger.debug('Removed component from graph', { nodeId });
    return true;
  }

  /**
   * Get all dependencies of a component (outgoing edges)
   */
  public getDependencies(nodeId: NodeId): Set<NodeId> {
    return this.graph.get(nodeId) ?? new Set();
  }

  /**
   * Get all dependents of a component (incoming edges)
   */
  public getDependents(nodeId: NodeId): Set<NodeId> {
    return this.reverseGraph.get(nodeId) ?? new Set();
  }

  /**
   * Check if there's a direct dependency between two nodes
   */
  public hasDependency(from: NodeId, to: NodeId): boolean {
    return this.graph.get(from)?.has(to) ?? false;
  }

  /**
   * Build the final dependency analysis result
   *
   * @ac US-028-AC-6: Validate graph structure
   */
  public build(): DependencyAnalysisResult {
    const startTime = Date.now();
    const totalEdges = this.countEdges();

    logger.info('Building dependency analysis result', {
      components: this.components.size,
      edges: totalEdges,
    });

    if (this.options.validateStructure) {
      this.validate();
    }

    const annotations = this.createBuildAnnotations();
    const stats = this.generateStats();

    const duration = Date.now() - startTime;
    logger.info('Dependency graph built successfully', {
      totalComponents: stats.totalComponents,
      totalDependencies: stats.totalDependencies,
      circularDeps: annotations.circularDependencies.length,
      isolated: annotations.isolatedComponents.length,
      durationMs: duration,
    });

    return this.createBuildResult(stats, annotations);
  }

  /**
   * Clear the entire graph
   */
  public clear(): void {
    this.components.clear();
    this.graph.clear();
    this.reverseGraph.clear();
    this.edges.clear();
    logger.debug('Graph cleared');
  }

  private createBuildResult(stats: DependencyStats, annotations: BuildAnnotations): DependencyAnalysisResult {
    return {
      components: new Map(this.components),
      graph: new Map(this.graph),
      reverseGraph: new Map(this.reverseGraph),
      edges: [...this.edges.values()],
      circularDependencies: annotations.circularDependencies,
      isolatedComponents: annotations.isolatedComponents,
      stats,
    };
  }

  /**
   * Collect non-statistical build annotations from the graph.
   */
  private createBuildAnnotations(): BuildAnnotations {
    return {
      circularDependencies: this.detectCircularDependencies(),
      isolatedComponents: this.findIsolatedComponents(),
    };
  }

  // Private methods
  /**
   * Stage 1: normalize node identity and typed dependency details for intake.
   */
  private normalizeComponentIntake(component: MetadataComponent): ComponentIntake {
    const nodeId = this.intakeComponentNode(component);
    const dependencyDetails = this.expandTypedDependencies(component);

    return {
      nodeId,
      dependencyDetails,
    };
  }

  /**
   * Stage 2 orchestration: ingest expanded dependency details for a component.
   */
  private ingestComponentDependencies(component: ComponentIntake): void {
    this.assembleComponentEdges(component.nodeId, component.dependencyDetails);
  }

  /**
   * Stage 1a: intake and register the component node.
   */
  private intakeComponentNode(component: MetadataComponent): NodeId {
    const nodeId = DependencyGraphBuilder.createNodeId(component.type, component.name);
    this.warnIfGraphIsLarge();
    this.components.set(nodeId, component);
    this.initializeNodeEntries(nodeId);

    return nodeId;
  }

  /**
   * Stage 2: expand legacy dependency sets into typed dependency details.
   */
  private expandTypedDependencies(component: MetadataComponent): ExpandedDependencyDetail[] {
    return expandComponentDependencyReferences(component, DEFAULT_GRAPH_DEPENDENCY_KIND).map((dependency) => ({
      nodeId: dependency.nodeId,
      kind: dependency.kind,
      reason: dependency.reason,
      confidence: dependency.confidence,
    }));
  }

  /**
   * Stage 3: assemble graph edges from expanded dependency details.
   */
  private assembleComponentEdges(nodeId: NodeId, dependencyDetails: ExpandedDependencyDetail[]): void {
    for (const dependency of dependencyDetails) {
      const edge = this.createDependencyEdgeInput(nodeId, dependency);
      this.addEdge(edge.from, edge.to, dependency.kind, dependency.reason, dependency.confidence);
    }
  }

  private createDependencyEdgeInput(nodeId: NodeId, dependency: ExpandedDependencyDetail): EdgeEndpoints {
    return {
      from: nodeId,
      to: dependency.nodeId,
    };
  }

  /**
   * Validation orchestration.
   *
   * @ac US-028-AC-6: Validate graph structure
   */
  private validate(): void {
    this.reportDanglingReferences();
    const summary = this.validateGraphStructure();

    if (summary.selfLoopErrors.length > 0) {
      logger.error('Graph validation failed', { errors: summary.selfLoopErrors });
      throw new Error(`Graph validation failed:\n${summary.selfLoopErrors.join('\n')}`);
    }

    logger.debug('Graph validation passed');
  }

  /**
   * Detect circular dependencies using DFS
   */
  private detectCircularDependencies(): CircularDependency[] {
    const cycles: CircularDependency[] = [];
    const visited = new Set<NodeId>();
    const recursionStack = new Set<NodeId>();
    const currentPath: NodeId[] = [];

    const dfs = (nodeId: NodeId): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      currentPath.push(nodeId);

      const deps = this.graph.get(nodeId) ?? new Set();
      for (const depId of deps) {
        if (!visited.has(depId)) {
          dfs(depId);
        } else if (recursionStack.has(depId)) {
          // Found a cycle
          const cycleStart = currentPath.indexOf(depId);
          const cycle = currentPath.slice(cycleStart);
          cycles.push({
            cycle,
            severity: 'warning',
            message: `Circular dependency detected: ${cycle.join(' → ')} → ${depId}`,
          });
        }
      }

      recursionStack.delete(nodeId);
      currentPath.pop();
    };

    for (const nodeId of this.graph.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return cycles;
  }

  /**
   * Find components with no dependencies or dependents
   */
  private findIsolatedComponents(): NodeId[] {
    const isolated: NodeId[] = [];

    for (const nodeId of this.components.keys()) {
      const deps = this.graph.get(nodeId)?.size ?? 0;
      const dependents = this.reverseGraph.get(nodeId)?.size ?? 0;

      if (deps === 0 && dependents === 0) {
        isolated.push(nodeId);
      }
    }

    return isolated;
  }

  /**
   * Generate graph statistics
   */
  private generateStats(): DependencyStats {
    const metrics = this.collectGraphMetrics();

    return {
      totalComponents: metrics.totalComponents,
      totalDependencies: metrics.totalDependencies,
      componentsByType: metrics.componentsByType,
      maxDepth: metrics.maxDepth,
      mostDepended: this.findMaxCountEntry(metrics.counts.dependentCounts),
      mostDependencies: this.findMaxCountEntry(metrics.counts.dependencyCounts),
    };
  }

  private collectGraphMetrics(): GraphMetrics {
    return {
      totalComponents: this.components.size,
      totalDependencies: this.countEdges(),
      maxDepth: this.calculateMaxDepth(),
      componentsByType: this.collectComponentsByType(),
      counts: this.collectGraphCounts(),
    };
  }

  private collectComponentsByType(): Record<string, number> {
    const componentsByType: Record<string, number> = {};

    for (const component of this.components.values()) {
      componentsByType[component.type] = (componentsByType[component.type] ?? 0) + 1;
    }

    return componentsByType;
  }

  /**
   * Calculate maximum dependency depth (simplified BFS)
   */
  private calculateMaxDepth(): number {
    let maxDepth = 0;

    for (const startNode of this.components.keys()) {
      const depth = this.bfsDepth(startNode);
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }

  /**
   * BFS to calculate depth from a starting node
   */
  private bfsDepth(startNode: NodeId): number {
    const visited = new Set<NodeId>();
    const queue: Array<{ node: NodeId; depth: number }> = [{ node: startNode, depth: 0 }];
    let maxDepth = 0;

    while (queue.length > 0) {
      const { node, depth } = queue.shift()!;

      if (visited.has(node)) continue;
      visited.add(node);

      maxDepth = Math.max(maxDepth, depth);

      const deps = this.graph.get(node) ?? new Set();
      for (const depId of deps) {
        if (!visited.has(depId)) {
          queue.push({ node: depId, depth: depth + 1 });
        }
      }
    }

    return maxDepth;
  }

  /**
   * Count total edges in the graph
   */
  private countEdges(): number {
    let count = 0;
    for (const deps of this.graph.values()) {
      count += deps.size;
    }
    return count;
  }

  private warnIfGraphIsLarge(): void {
    if (this.components.size >= this.options.maxNodes) {
      logger.warn('Graph size exceeds recommended maximum', {
        current: this.components.size,
        max: this.options.maxNodes,
      });
    }
  }

  private initializeNodeEntries(nodeId: NodeId): void {
    if (!this.graph.has(nodeId)) {
      this.graph.set(nodeId, new Set());
    }

    if (!this.reverseGraph.has(nodeId)) {
      this.reverseGraph.set(nodeId, new Set());
    }
  }

  private ensureEdgeEndpoints(from: NodeId, to: NodeId): void {
    this.initializeOutgoingNode(from);
    this.initializeIncomingNode(to);
  }

  private initializeOutgoingNode(nodeId: NodeId): void {
    if (!this.graph.has(nodeId)) {
      this.graph.set(nodeId, new Set());
    }
  }

  private initializeIncomingNode(nodeId: NodeId): void {
    if (!this.reverseGraph.has(nodeId)) {
      this.reverseGraph.set(nodeId, new Set());
    }
  }

  private reportDanglingReferences(): void {
    for (const [nodeId, deps] of this.graph.entries()) {
      for (const depId of deps) {
        if (!this.components.has(depId) && !this.graph.has(depId)) {
          logger.warn('Dangling reference detected', {
            from: nodeId,
            to: depId,
          });
        }
      }
    }
  }

  private validateGraphStructure(): ValidationSummary {
    const selfLoopErrors: string[] = [];

    for (const [nodeId, deps] of this.graph.entries()) {
      if (deps.has(nodeId)) {
        selfLoopErrors.push(`Self-loop detected: ${nodeId}`);
      }
    }

    return { selfLoopErrors };
  }

  private collectGraphCounts(): GraphCounts {
    const dependencyCounts = new Map<NodeId, number>();
    const dependentCounts = new Map<NodeId, number>();

    for (const [nodeId, deps] of this.graph.entries()) {
      dependencyCounts.set(nodeId, deps.size);
    }

    for (const [nodeId, dependents] of this.reverseGraph.entries()) {
      dependentCounts.set(nodeId, dependents.size);
    }

    return { dependencyCounts, dependentCounts };
  }

  private findMaxCountEntry(counts: ReadonlyMap<NodeId, number>): { nodeId: NodeId; count: number } {
    let maxEntry: { nodeId: NodeId; count: number } = { nodeId: '', count: 0 };

    for (const [nodeId, count] of counts.entries()) {
      if (count > maxEntry.count) {
        maxEntry = { nodeId, count };
      }
    }

    return maxEntry;
  }
}
