/**
 * Circular Dependency Detector
 * Detects and reports circular dependencies in the dependency graph
 *
 * @ac US-030-AC-1: Detect simple cycles (A→B→A)
 * @ac US-030-AC-2: Detect complex cycles (A→B→C→A)
 * @ac US-030-AC-3: Report all nodes in cycle
 * @ac US-030-AC-4: Suggest where to break cycle
 * @ac US-030-AC-5: Support user-defined cycle breaks
 * @ac US-030-AC-6: Handle multiple separate cycles
 *
 * @issue #30
 */

import { getLogger } from '../utils/logger.js';
import type { NodeId, DependencyGraph, CircularDependency } from '../types/dependency.js';
import { DEFAULT_GRAPH_DEPENDENCY_KIND, shouldTraverseDependencyKind } from './dependency-semantics.js';

const logger = getLogger('CircularDependencyDetector');

type RawCycle = {
  cycle: NodeId[];
  closingNode: NodeId;
};

/**
 * Cycle break suggestion
 */
export type CycleBreakSuggestion = {
  from: NodeId;
  to: NodeId;
  reason: string;
  priority: number; // Higher = better candidate
};

/**
 * Detected cycle with break suggestions
 */
export type DetectedCycle = CircularDependency & {
  id: string;
  breakSuggestions: CycleBreakSuggestion[];
};

/**
 * Options for cycle detection
 */
export type CycleDetectionOptions = {
  /** Maximum depth to search for cycles */
  maxDepth?: number;
  /** User-defined edges to ignore (cycle breaks) */
  ignoreEdges?: Array<{ from: NodeId; to: NodeId }>;
  /** Generate break suggestions */
  generateSuggestions?: boolean;
};

/**
 * Circular Dependency Detector
 *
 * Uses depth-first search (DFS) to detect cycles in the dependency graph.
 * Supports both simple (A→B→A) and complex (A→B→C→A) cycles.
 *
 * Performance: O(V + E) where V = vertices, E = edges
 *
 * @example
 * const detector = new CircularDependencyDetector(graph);
 * const cycles = detector.detectCycles();
 * if (cycles.length > 0) {
 *   console.log(`Found ${cycles.length} circular dependencies`);
 *   console.log('Suggestion:', cycles[0].breakSuggestions[0]);
 * }
 */
export class CircularDependencyDetector {
  private graph: DependencyGraph;
  private options: Required<CycleDetectionOptions>;
  private ignoredEdges: Set<string>;

  public constructor(graph: DependencyGraph, options: CycleDetectionOptions = {}) {
    this.graph = graph;
    this.options = {
      maxDepth: options.maxDepth ?? 100,
      ignoreEdges: options.ignoreEdges ?? [],
      generateSuggestions: options.generateSuggestions ?? true,
    };

    // Create set of ignored edges for O(1) lookup
    this.ignoredEdges = new Set(this.options.ignoreEdges.map(({ from, to }) => `${from}->${to}`));

    logger.debug('Initialized CircularDependencyDetector', {
      nodes: this.graph.size,
      ignoredEdges: this.ignoredEdges.size,
    });
  }

  // Private static helper methods
  /**
   * Calculate priority for breaking an edge
   * Higher = better candidate to break
   */
  private static calculateBreakPriority(from: NodeId, to: NodeId): number {
    let priority = 50; // Base priority

    // Test classes are good candidates to break (they can be deployed separately)
    if (from.includes('Test') || to.includes('Test')) {
      priority += 30;
    }

    // Utility/helper classes are good candidates
    if (CircularDependencyDetector.isUtilityClass(from) || CircularDependencyDetector.isUtilityClass(to)) {
      priority += 20;
    }

    // Handler -> Service edges are typically safe to break
    if (from.includes('Handler') && to.includes('Service')) {
      priority += 15;
    }

    // Controller -> Service edges can be broken
    if (from.includes('Controller') && to.includes('Service')) {
      priority += 15;
    }

    // Trigger -> Handler edges should not be broken (tightly coupled)
    if (from.includes('Trigger') && to.includes('Handler')) {
      priority -= 20;
    }

    // Core domain classes should not be broken if possible
    if (CircularDependencyDetector.isCoreDomainClass(from) && CircularDependencyDetector.isCoreDomainClass(to)) {
      priority -= 15;
    }

    return Math.max(0, Math.min(100, priority));
  }

  /**
   * Get human-readable reason for break suggestion
   */
  private static getBreakReason(from: NodeId, to: NodeId, priority: number): string {
    if (priority >= 80) {
      return `High priority: ${from} → ${to} is a test or utility dependency`;
    } else if (priority >= 65) {
      return `Medium priority: ${from} → ${to} can be broken safely`;
    } else if (priority >= 50) {
      return `Low priority: ${from} → ${to} may be tightly coupled`;
    } else {
      return `Not recommended: ${from} → ${to} appears to be core business logic`;
    }
  }

  /**
   * Check if a class is a utility/helper class
   */
  private static isUtilityClass(nodeId: NodeId): boolean {
    const name = nodeId.toLowerCase();
    return name.includes('util') || name.includes('helper') || name.includes('constant') || name.includes('logger');
  }

  /**
   * Check if a class is core domain logic
   */
  private static isCoreDomainClass(nodeId: NodeId): boolean {
    const name = nodeId.toLowerCase();
    // Core classes typically don't have suffixes like Test, Handler, etc.
    return (
      !name.includes('test') &&
      !name.includes('handler') &&
      !name.includes('controller') &&
      !name.includes('util') &&
      !name.includes('helper')
    );
  }

  /**
   * Generate a unique ID for a cycle (order-independent)
   */
  private static generateCycleId(cycle: NodeId[]): string {
    // Sort to make it order-independent: [A,B,C] and [B,C,A] are the same cycle
    const sorted = [...cycle].sort();
    return sorted.join('->');
  }

  /**
   * Check if a cycle is a duplicate of already found cycles
   */
  private static isDuplicateCycle(cycle: NodeId[], existingCycles: DetectedCycle[]): boolean {
    const cycleId = CircularDependencyDetector.generateCycleId(cycle);
    return existingCycles.some((c) => c.id === cycleId);
  }

  // Public methods
  /**
   * Detect all circular dependencies in the graph
   *
   * @ac US-030-AC-1: Detect simple cycles (A→B→A)
   * @ac US-030-AC-2: Detect complex cycles (A→B→C→A)
   * @ac US-030-AC-6: Handle multiple separate cycles
   */
  public detectCycles(): DetectedCycle[] {
    const startTime = Date.now();
    const visited = new Set<NodeId>();
    const rawCycles = this.discoverCyclesAcrossGraph(visited);
    const allCycles = this.materializeUniqueCycles(rawCycles);

    const duration = Date.now() - startTime;
    logger.info('Cycle detection completed', {
      cyclesFound: allCycles.length,
      nodesScanned: visited.size,
      durationMs: duration,
    });

    return allCycles;
  }

  /**
   * Detect cycles starting from a specific node
   */
  public detectCyclesFromNode(startNode: NodeId): DetectedCycle[] {
    const rawCycles = this.discoverCyclesFromNode(startNode);
    return this.materializeUniqueCycles(rawCycles);
  }

  /**
   * Check if a specific path creates a cycle
   */
  public wouldCreateCycle(from: NodeId, to: NodeId): boolean {
    // Check if adding edge from->to would create a cycle
    // This means: can we reach 'from' starting from 'to'?

    const visited = new Set<NodeId>();
    const queue: NodeId[] = [to];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current === from) {
        return true; // Found a path back to 'from'
      }

      if (visited.has(current)) {
        continue;
      }

      visited.add(current);

      const deps = this.graph.get(current) ?? new Set();
      for (const dep of deps) {
        if (!this.isEdgeIgnored(current, dep) && !visited.has(dep)) {
          queue.push(dep);
        }
      }
    }

    return false;
  }

  /**
   * @ac US-030-AC-3: Report all nodes in cycle
   *
   * Create a detected cycle with full information
   */
  private createDetectedCycle(cycle: NodeId[], closingNode: NodeId): DetectedCycle {
    const cycleId = CircularDependencyDetector.generateCycleId(cycle);
    const message = `Circular dependency: ${cycle.join(' → ')} → ${closingNode}`;

    const detected: DetectedCycle = {
      id: cycleId,
      cycle: [...cycle],
      severity: cycle.length <= 2 ? 'error' : 'warning',
      message,
      breakSuggestions: [],
    };

    if (this.options.generateSuggestions) {
      detected.breakSuggestions = CircularDependencyDetector.generateBreakSuggestions(cycle, closingNode);
    }

    return detected;
  }

  private discoverCyclesAcrossGraph(visited: Set<NodeId>): RawCycle[] {
    const rawCycles: RawCycle[] = [];
    const recursionStack = new Set<NodeId>();
    const currentPath: NodeId[] = [];

    for (const nodeId of this.graph.keys()) {
      if (!visited.has(nodeId)) {
        this.walkForCycles(nodeId, 0, visited, recursionStack, currentPath, rawCycles, true);
      }
    }

    return rawCycles;
  }

  private discoverCyclesFromNode(startNode: NodeId): RawCycle[] {
    const rawCycles: RawCycle[] = [];
    this.walkForCycles(startNode, 0, undefined, new Set<NodeId>(), [], rawCycles, false);
    return rawCycles;
  }

  private walkForCycles(
    nodeId: NodeId,
    depth: number,
    visited: Set<NodeId> | undefined,
    recursionStack: Set<NodeId>,
    currentPath: NodeId[],
    cycles: RawCycle[],
    warnOnDepthLimit: boolean
  ): void {
    if (depth > this.options.maxDepth) {
      if (warnOnDepthLimit) {
        logger.warn('Max depth reached during cycle detection', { nodeId, depth });
      }

      return;
    }

    visited?.add(nodeId);
    recursionStack.add(nodeId);
    currentPath.push(nodeId);

    for (const depId of this.getTraversableDependencies(nodeId)) {
      if (recursionStack.has(depId)) {
        const cycleStartIndex = currentPath.indexOf(depId);
        cycles.push({
          cycle: currentPath.slice(cycleStartIndex),
          closingNode: depId,
        });
        continue;
      }

      if (visited?.has(depId)) {
        continue;
      }

      this.walkForCycles(depId, depth + 1, visited, recursionStack, currentPath, cycles, warnOnDepthLimit);
    }

    recursionStack.delete(nodeId);
    currentPath.pop();
  }

  private getTraversableDependencies(nodeId: NodeId): NodeId[] {
    const dependencies = this.graph.get(nodeId) ?? new Set();
    const traversable: NodeId[] = [];

    for (const depId of dependencies) {
      if (!this.isEdgeIgnored(nodeId, depId) && shouldTraverseDependencyKind(DEFAULT_GRAPH_DEPENDENCY_KIND)) {
        traversable.push(depId);
      }
    }

    return traversable;
  }

  private materializeUniqueCycles(rawCycles: RawCycle[]): DetectedCycle[] {
    const cycles: DetectedCycle[] = [];

    for (const rawCycle of rawCycles) {
      if (!CircularDependencyDetector.isDuplicateCycle(rawCycle.cycle, cycles)) {
        cycles.push(this.createDetectedCycle(rawCycle.cycle, rawCycle.closingNode));
      }
    }

    return cycles;
  }

  /**
   * @ac US-030-AC-4: Suggest where to break cycle
   *
   * Generate suggestions for breaking the cycle
   * Priority based on:
   * - Test classes (high priority to break)
   * - Utility classes (medium priority)
   * - Core business logic (low priority)
   */
  private static generateBreakSuggestions(cycle: NodeId[], closingNode: NodeId): CycleBreakSuggestion[] {
    const suggestions: CycleBreakSuggestion[] = [];

    // Add closing edge
    const fullCycle = [...cycle, closingNode];

    // Analyze each edge in the cycle
    for (let i = 0; i < fullCycle.length - 1; i++) {
      const from = fullCycle[i];
      const to = fullCycle[i + 1];

      const priority = CircularDependencyDetector.calculateBreakPriority(from, to);
      const reason = CircularDependencyDetector.getBreakReason(from, to, priority);

      suggestions.push({
        from,
        to,
        reason,
        priority,
      });
    }

    // Sort by priority (highest first)
    suggestions.sort((a, b) => b.priority - a.priority);

    return suggestions;
  }

  /**
   * @ac US-030-AC-5: Support user-defined cycle breaks
   *
   * Check if an edge is in the ignore list
   */
  private isEdgeIgnored(from: NodeId, to: NodeId): boolean {
    return this.ignoredEdges.has(`${from}->${to}`);
  }

  /**
   * Get summary statistics
   */
  public getStats(): {
    totalNodes: number;
    totalEdges: number;
    ignoredEdges: number;
  } {
    let totalEdges = 0;
    for (const deps of this.graph.values()) {
      totalEdges += deps.size;
    }

    return {
      totalNodes: this.graph.size,
      totalEdges,
      ignoredEdges: this.ignoredEdges.size,
    };
  }
}
