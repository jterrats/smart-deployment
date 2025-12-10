/**
 * Dependency Resolver
 * Resolves component dependencies and generates deployment order
 *
 * @ac US-033-AC-1: Resolve direct dependencies
 * @ac US-033-AC-2: Resolve transitive dependencies
 * @ac US-033-AC-3: Handle optional dependencies
 * @ac US-033-AC-4: Skip managed package dependencies
 * @ac US-033-AC-5: Report unresolved dependencies
 * @ac US-033-AC-6: Generate dependency report
 *
 * @issue #33
 */

import { getLogger } from '../utils/logger.js';
import type { NodeId, DependencyGraph, CircularDependency } from '../types/dependency.js';
import type { MetadataComponent } from '../types/metadata.js';

const logger = getLogger('DependencyResolver');

/**
 * Dependency resolution status
 */
export type ResolutionStatus = 'resolved' | 'unresolved' | 'optional' | 'managed' | 'circular';

/**
 * Resolved dependency information
 */
export type ResolvedDependency = {
  nodeId: NodeId;
  dependencies: NodeId[];
  status: ResolutionStatus;
  order: number; // Position in deployment order
  reason?: string; // Reason for status
};

/**
 * Dependency resolution result
 */
export type ResolutionResult = {
  resolved: Map<NodeId, ResolvedDependency>;
  deploymentOrder: NodeId[];
  unresolved: Array<{ nodeId: NodeId; missingDependencies: NodeId[] }>;
  optional: NodeId[];
  managed: NodeId[];
  circular: CircularDependency[];
  report: DependencyReport;
};

/**
 * Dependency report
 */
export type DependencyReport = {
  totalComponents: number;
  resolvedCount: number;
  unresolvedCount: number;
  optionalCount: number;
  managedCount: number;
  circularCount: number;
  deploymentLevels: number;
};

/**
 * Resolver options
 */
export type ResolverOptions = {
  /** Include optional dependencies in resolution */
  includeOptional?: boolean;
  /** Skip managed package components */
  skipManaged?: boolean;
  /** Circular dependencies to handle */
  circularDependencies?: CircularDependency[];
  /** Manual ordering constraints: [before, after] */
  orderingConstraints?: Array<{ before: NodeId; after: NodeId }>;
};

/**
 * Dependency Resolver
 *
 * Resolves dependencies and generates deployment order using topological sort.
 * Handles circular dependencies, optional dependencies, and managed packages.
 *
 * Performance: O(V + E) using Kahn's algorithm
 *
 * @example
 * const resolver = new DependencyResolver(graph, components);
 * const result = resolver.resolve();
 * console.log(`Deployment order: ${result.deploymentOrder.join(' → ')}`);
 * console.log(`Unresolved: ${result.unresolved.length}`);
 */
export class DependencyResolver {
  private graph: DependencyGraph;
  private components: Map<NodeId, MetadataComponent>;
  private options: Required<ResolverOptions>;

  public constructor(
    graph: DependencyGraph,
    components: Map<NodeId, MetadataComponent>,
    options: ResolverOptions = {}
  ) {
    this.graph = graph;
    this.components = components;
    this.options = {
      includeOptional: options.includeOptional ?? false,
      skipManaged: options.skipManaged ?? true,
      circularDependencies: options.circularDependencies ?? [],
      orderingConstraints: options.orderingConstraints ?? [],
    };

    logger.debug('Initialized DependencyResolver', {
      components: this.components.size,
      includeOptional: this.options.includeOptional,
      skipManaged: this.options.skipManaged,
      circularDeps: this.options.circularDependencies.length,
    });
  }

  /**
   * Resolve all dependencies and generate deployment order
   *
   * @ac US-033-AC-1: Resolve direct dependencies
   * @ac US-033-AC-2: Resolve transitive dependencies
   * @ac US-033-AC-6: Generate dependency report
   */
  public resolve(): ResolutionResult {
    const startTime = Date.now();

    // Build filtered graph
    const filteredGraph = this.buildFilteredGraph();

    // Perform topological sort
    const { deploymentOrder, unresolved } = this.topologicalSort(filteredGraph);

    // Build resolved dependencies map
    const resolved = this.buildResolvedMap(deploymentOrder, filteredGraph);

    // Categorize components
    const optional = this.findOptionalDependencies();
    const managed = this.findManagedPackages();

    // Generate report
    const report = this.generateReport(resolved, unresolved, optional, managed);

    const duration = Date.now() - startTime;
    logger.info('Dependency resolution completed', {
      totalComponents: this.components.size,
      resolved: resolved.size,
      unresolved: unresolved.length,
      deploymentLevels: report.deploymentLevels,
      durationMs: duration,
    });

    return {
      resolved,
      deploymentOrder,
      unresolved,
      optional,
      managed,
      circular: this.options.circularDependencies,
      report,
    };
  }

  /**
   * Build filtered graph based on options
   */
  private buildFilteredGraph(): DependencyGraph {
    const filtered: DependencyGraph = new Map();

    for (const [nodeId, deps] of this.graph.entries()) {
      // Skip managed packages if configured
      if (this.options.skipManaged && this.isManagedPackage(nodeId)) {
        continue;
      }

      const filteredDeps = new Set<NodeId>();

      for (const dep of deps) {
        // Skip managed dependencies
        if (this.options.skipManaged && this.isManagedPackage(dep)) {
          continue;
        }

        // Handle optional dependencies
        if (this.isOptionalDependency(nodeId, dep)) {
          if (this.options.includeOptional) {
            filteredDeps.add(dep);
          }
          continue;
        }

        filteredDeps.add(dep);
      }

      filtered.set(nodeId, filteredDeps);
    }

    // Apply ordering constraints
    this.applyOrderingConstraints(filtered);

    return filtered;
  }

  /**
   * Apply manual ordering constraints to the graph
   *
   * @ac US-033-AC-5: Support manual ordering constraints
   */
  private applyOrderingConstraints(graph: DependencyGraph): void {
    for (const { before, after } of this.options.orderingConstraints) {
      // Ensure 'before' depends on 'after' (before must be deployed after 'after')
      if (!graph.has(before)) {
        graph.set(before, new Set());
      }
      graph.get(before)!.add(after);
    }
  }

  /**
   * Perform topological sort using Kahn's algorithm
   */
  private topologicalSort(graph: DependencyGraph): {
    deploymentOrder: NodeId[];
    unresolved: Array<{ nodeId: NodeId; missingDependencies: NodeId[] }>;
  } {
    const deploymentOrder: NodeId[] = [];
    const unresolved: Array<{ nodeId: NodeId; missingDependencies: NodeId[] }> = [];

    // Calculate in-degree for each node
    const inDegree = new Map<NodeId, number>();
    for (const nodeId of graph.keys()) {
      inDegree.set(nodeId, 0);
    }

    for (const deps of graph.values()) {
      for (const dep of deps) {
        if (!inDegree.has(dep)) {
          // Dependency not in graph - external/missing
          continue;
        }
        inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1);
      }
    }

    // Start with nodes that have no dependencies (in-degree = 0)
    const queue: NodeId[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    // Process nodes in topological order
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      deploymentOrder.push(nodeId);

      const deps = graph.get(nodeId) ?? new Set();
      for (const dep of deps) {
        if (!inDegree.has(dep)) {
          continue; // External dependency
        }

        const newDegree = (inDegree.get(dep) ?? 0) - 1;
        inDegree.set(dep, newDegree);

        if (newDegree === 0) {
          queue.push(dep);
        }
      }
    }

    // Check for unresolved dependencies (cycles or missing)
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree > 0) {
        // Node not processed - part of cycle or has missing deps
        const missingDeps = this.findMissingDependencies(nodeId, graph);
        unresolved.push({ nodeId, missingDependencies: missingDeps });
      }
    }

    return { deploymentOrder, unresolved };
  }

  /**
   * Find missing dependencies for a node
   */
  private findMissingDependencies(nodeId: NodeId, graph: DependencyGraph): NodeId[] {
    const deps = graph.get(nodeId) ?? new Set();
    const missing: NodeId[] = [];

    for (const dep of deps) {
      if (!graph.has(dep)) {
        missing.push(dep);
      }
    }

    return missing;
  }

  /**
   * Build resolved dependencies map with deployment order
   */
  private buildResolvedMap(
    deploymentOrder: NodeId[],
    graph: DependencyGraph
  ): Map<NodeId, ResolvedDependency> {
    const resolved = new Map<NodeId, ResolvedDependency>();

    for (let i = 0; i < deploymentOrder.length; i++) {
      const nodeId = deploymentOrder[i];
      const deps = Array.from(graph.get(nodeId) ?? []);

      resolved.set(nodeId, {
        nodeId,
        dependencies: deps,
        status: 'resolved',
        order: i,
      });
    }

    return resolved;
  }

  /**
   * @ac US-033-AC-3: Handle optional dependencies
   * Note: Current MetadataComponent doesn't track dependency types
   */
  private findOptionalDependencies(): NodeId[] {
    // TODO: When MetadataComponent includes dependency types, implement this properly
    return [];
  }

  /**
   * @ac US-033-AC-4: Skip managed package dependencies
   */
  private findManagedPackages(): NodeId[] {
    const managed: NodeId[] = [];

    for (const nodeId of this.components.keys()) {
      if (this.isManagedPackage(nodeId)) {
        managed.push(nodeId);
      }
    }

    return managed;
  }

  /**
   * Check if a component is from a managed package
   */
  private isManagedPackage(nodeId: NodeId): boolean {
    // Check for namespace prefix (e.g., "ns__ObjectName")
    return nodeId.includes('__') || this.components.get(nodeId)?.name.includes('__') || false;
  }

  /**
   * Check if a dependency is optional (soft dependency)
   * Note: Current MetadataComponent uses Set<string> for dependencies
   * For now, we'll return false as type info is not available
   */
  private isOptionalDependency(from: NodeId, to: NodeId): boolean {
    // TODO: When MetadataComponent includes dependency types, implement this properly
    return false;
  }

  /**
   * @ac US-033-AC-6: Generate dependency report
   */
  private generateReport(
    resolved: Map<NodeId, ResolvedDependency>,
    unresolved: Array<{ nodeId: NodeId; missingDependencies: NodeId[] }>,
    optional: NodeId[],
    managed: NodeId[]
  ): DependencyReport {
    // Calculate deployment levels
    let maxOrder = 0;
    for (const dep of resolved.values()) {
      maxOrder = Math.max(maxOrder, dep.order);
    }

    return {
      totalComponents: this.components.size,
      resolvedCount: resolved.size,
      unresolvedCount: unresolved.length,
      optionalCount: optional.length,
      managedCount: managed.length,
      circularCount: this.options.circularDependencies.length,
      deploymentLevels: maxOrder + 1,
    };
  }

  /**
   * Get resolution status for a specific component
   */
  public getResolution(nodeId: NodeId): ResolvedDependency | undefined {
    const result = this.resolve();
    return result.resolved.get(nodeId);
  }

  /**
   * Check if a component can be resolved
   */
  public canResolve(nodeId: NodeId): boolean {
    const result = this.resolve();
    return result.resolved.has(nodeId);
  }

  /**
   * Get deployment order for specific components
   */
  public getDeploymentOrder(nodeIds: NodeId[]): NodeId[] {
    const result = this.resolve();
    const orderMap = new Map<NodeId, number>();

    for (const dep of result.resolved.values()) {
      orderMap.set(dep.nodeId, dep.order);
    }

    // Sort by order
    return nodeIds
      .filter((id) => orderMap.has(id))
      .sort((a, b) => (orderMap.get(a) ?? 0) - (orderMap.get(b) ?? 0));
  }
}

