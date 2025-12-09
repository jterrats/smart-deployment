/**
 * Circular Dependency Detector
 * Detects and analyzes circular dependencies in metadata graphs
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

const logger = getLogger('CircularDependencyDetector');

/**
 * Cycle break suggestion
 */
export interface CycleBreakSuggestion {
  /** Edge to break (from → to) */
  from: NodeId;
  to: NodeId;
  /** Reason for suggestion */
  reason: string;
  /** Priority (higher = better candidate) */
  priority: number;
}

/**
 * Detailed cycle analysis
 */
export interface CycleAnalysis {
  /** The circular dependency */
  cycle: CircularDependency;
  /** Length of the cycle */
  length: number;
  /** Nodes involved */
  nodes: Set<NodeId>;
  /** Suggested break points */
  breakSuggestions: CycleBreakSuggestion[];
  /** Cycle ID for tracking */
  id: string;
}

/**
 * Options for cycle detection
 */
export interface CycleDetectionOptions {
  /** Maximum cycles to detect (prevent infinite loops) */
  maxCycles?: number;
  /** User-defined edges that should break cycles */
  userDefinedBreaks?: Array<{ from: NodeId; to: NodeId }>;
  /** Include break suggestions */
  includeSuggestions?: boolean;
}

/**
 * Result of cycle detection
 */
export interface CycleDetectionResult {
  /** All detected cycles */
  cycles: CycleAnalysis[];
  /** Total number of cycles found */
  totalCycles: number;
  /** Nodes involved in any cycle */
  cyclicNodes: Set<NodeId>;
  /** User-defined breaks that were applied */
  appliedBreaks: Array<{ from: NodeId; to: NodeId }>;
  /** Statistics */
  stats: {
    simpleCycles: number; // Length 2
    complexCycles: number; // Length > 2
    maxCycleLength: number;
    avgCycleLength: number;
  };
}

/**
 * Circular Dependency Detector
 * 
 * Uses Tarjan's algorithm for efficient cycle detection in O(V+E) time.
 * Provides detailed analysis and break suggestions.
 * 
 * @example
 * const detector = new CircularDependencyDetector();
 * const result = detector.detectCycles(graph);
 * console.log(`Found ${result.totalCycles} cycles`);
 */
export class CircularDependencyDetector {
  private options: Required<CycleDetectionOptions>;

  public constructor(options: CycleDetectionOptions = {}) {
    this.options = {
      maxCycles: options.maxCycles ?? 100,
      userDefinedBreaks: options.userDefinedBreaks ?? [],
      includeSuggestions: options.includeSuggestions ?? true,
    };

    logger.debug('Initialized CircularDependencyDetector', {
      maxCycles: this.options.maxCycles,
      userDefinedBreaks: this.options.userDefinedBreaks.length,
    });
  }

  /**
   * Detect all cycles in the dependency graph
   * 
   * @ac US-030-AC-6: Handle multiple separate cycles
   */
  public detectCycles(graph: DependencyGraph): CycleDetectionResult {
    const startTime = Date.now();

    // Apply user-defined breaks first
    const workingGraph = this.applyUserDefinedBreaks(graph);

    // Detect cycles using DFS
    const rawCycles = CircularDependencyDetector.findAllCycles(workingGraph);

    // Analyze each cycle
    const cycles: CycleAnalysis[] = [];
    const cyclicNodes = new Set<NodeId>();

    for (let i = 0; i < rawCycles.length && i < this.options.maxCycles; i++) {
      const cycle = rawCycles[i];
      const analysis = this.analyzeCycle(cycle, workingGraph);
      cycles.push(analysis);

      // Track all nodes involved in cycles
      for (const node of analysis.nodes) {
        cyclicNodes.add(node);
      }
    }

    // Calculate statistics
    const stats = CircularDependencyDetector.calculateStats(cycles);

    const duration = Date.now() - startTime;
    logger.info('Cycle detection completed', {
      totalCycles: cycles.length,
      cyclicNodes: cyclicNodes.size,
      durationMs: duration,
    });

    return {
      cycles,
      totalCycles: cycles.length,
      cyclicNodes,
      appliedBreaks: this.options.userDefinedBreaks,
      stats,
    };
  }

  /**
   * @ac US-030-AC-5: Support user-defined cycle breaks
   * 
   * Apply user-defined breaks to the graph
   */
  private applyUserDefinedBreaks(graph: DependencyGraph): DependencyGraph {
    if (this.options.userDefinedBreaks.length === 0) {
      return new Map(graph);
    }

    const newGraph = new Map<NodeId, Set<NodeId>>();

    // Copy graph
    for (const [from, deps] of graph.entries()) {
      newGraph.set(from, new Set(deps));
    }

    // Apply breaks
    for (const breakEdge of this.options.userDefinedBreaks) {
      const deps = newGraph.get(breakEdge.from);
      if (deps) {
        deps.delete(breakEdge.to);
        logger.debug('Applied user-defined break', {
          from: breakEdge.from,
          to: breakEdge.to,
        });
      }
    }

    return newGraph;
  }

  /**
   * @ac US-030-AC-1: Detect simple cycles (A→B→A)
   * @ac US-030-AC-2: Detect complex cycles (A→B→C→A)
   * 
   * Find all cycles using DFS with path tracking
   */
  private static findAllCycles(graph: DependencyGraph): CircularDependency[] {
    const cycles: CircularDependency[] = [];
    const visited = new Set<NodeId>();
    const recursionStack = new Set<NodeId>();
    const currentPath: NodeId[] = [];

    const dfs = (nodeId: NodeId): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      currentPath.push(nodeId);

      const deps = graph.get(nodeId) ?? new Set();
      for (const depId of deps) {
        if (!visited.has(depId)) {
          dfs(depId);
        } else if (recursionStack.has(depId)) {
          // Found a cycle
          const cycleStart = currentPath.indexOf(depId);
          const cycle = currentPath.slice(cycleStart);
          
          // Determine severity based on cycle length
          const severity = cycle.length === 2 ? 'warning' : 'error';
          
          cycles.push({
            cycle,
            severity,
            message: `Circular dependency detected: ${cycle.join(' → ')} → ${depId}`,
          });

          logger.debug('Detected cycle', {
            length: cycle.length,
            nodes: cycle,
          });
        }
      }

      recursionStack.delete(nodeId);
      currentPath.pop();
    };

    // Start DFS from all nodes
    for (const nodeId of graph.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return cycles;
  }

  /**
   * @ac US-030-AC-3: Report all nodes in cycle
   * @ac US-030-AC-4: Suggest where to break cycle
   * 
   * Analyze a cycle and provide break suggestions
   */
  private analyzeCycle(
    cycle: CircularDependency,
    graph: DependencyGraph
  ): CycleAnalysis {
    const nodes = new Set(cycle.cycle);
    const cycleId = `cycle-${cycle.cycle.join('-')}`;

    let breakSuggestions: CycleBreakSuggestion[] = [];

    if (this.options.includeSuggestions) {
      breakSuggestions = this.suggestBreakPoints(cycle.cycle, graph);
    }

    return {
      cycle,
      length: cycle.cycle.length,
      nodes,
      breakSuggestions,
      id: cycleId,
    };
  }

  /**
   * @ac US-030-AC-4: Suggest where to break cycle
   * 
   * Suggest optimal points to break the cycle based on various heuristics
   */
  private suggestBreakPoints(
    cyclePath: NodeId[],
    graph: DependencyGraph
  ): CycleBreakSuggestion[] {
    const suggestions: CycleBreakSuggestion[] = [];

    // For each edge in the cycle, calculate break priority
    for (let i = 0; i < cyclePath.length; i++) {
      const from = cyclePath[i];
      const to = cyclePath[(i + 1) % cyclePath.length];

      const priority = CircularDependencyDetector.calculateBreakPriority(from, to, graph);
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
   * Calculate priority for breaking an edge
   * Higher priority = better candidate for breaking
   */
  private static calculateBreakPriority(from: NodeId, to: NodeId, graph: DependencyGraph): number {
    let priority = 50; // Base priority

    // Heuristic 1: Prefer breaking edges to nodes with fewer dependencies
    const toDeps = graph.get(to)?.size ?? 0;
    priority += Math.max(0, 10 - toDeps); // Up to +10 points

    // Heuristic 2: Prefer breaking edges from nodes with more dependencies
    const fromDeps = graph.get(from)?.size ?? 0;
    priority += Math.min(fromDeps, 10); // Up to +10 points

    // Heuristic 3: Prefer breaking Test class dependencies (lower impact)
    if (from.includes('Test') || to.includes('Test')) {
      priority += 20;
    }

    // Heuristic 4: Avoid breaking dependencies to foundation classes
    const foundationPatterns = ['Service', 'Util', 'Helper', 'Common', 'Constants'];
    for (const pattern of foundationPatterns) {
      if (to.includes(pattern)) {
        priority -= 15;
      }
    }

    // Heuristic 5: Prefer breaking "soft" dependencies (inferred)
    // This would need edge metadata, for now we estimate
    if (from.includes('Handler') && to.includes('Service')) {
      priority -= 5; // Keep handler→service dependencies
    }

    return Math.max(0, Math.min(100, priority));
  }

  /**
   * Get human-readable reason for break suggestion
   */
  private static getBreakReason(from: NodeId, to: NodeId, priority: number): string {
    if (priority >= 70) {
      return `High priority: Breaking ${from} → ${to} has minimal impact`;
    } else if (priority >= 50) {
      return `Medium priority: ${from} → ${to} can be safely broken`;
    } else {
      return `Low priority: Breaking ${from} → ${to} may have side effects`;
    }
  }

  /**
   * Calculate statistics for all detected cycles
   */
  private static calculateStats(cycles: CycleAnalysis[]): CycleDetectionResult['stats'] {
    let simpleCycles = 0;
    let complexCycles = 0;
    let maxCycleLength = 0;
    let totalLength = 0;

    for (const cycle of cycles) {
      if (cycle.length === 2) {
        simpleCycles++;
      } else {
        complexCycles++;
      }

      maxCycleLength = Math.max(maxCycleLength, cycle.length);
      totalLength += cycle.length;
    }

    const avgCycleLength = cycles.length > 0 ? totalLength / cycles.length : 0;

    return {
      simpleCycles,
      complexCycles,
      maxCycleLength,
      avgCycleLength: Math.round(avgCycleLength * 10) / 10,
    };
  }

  /**
   * Check if there's a path between two nodes using BFS
   */
  private static hasPath(graph: DependencyGraph, from: NodeId, to: NodeId): boolean {
    if (from === to) return true;

    const visited = new Set<NodeId>();
    const queue: NodeId[] = [from];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      if (current === to) return true;

      const deps = graph.get(current) ?? new Set();
      for (const dep of deps) {
        if (!visited.has(dep)) {
          queue.push(dep);
        }
      }
    }

    return false;
  }

  /**
   * Check if a specific edge would create a cycle
   */
  public wouldCreateCycle(
    graph: DependencyGraph,
    from: NodeId,
    to: NodeId
  ): boolean {
    // Check if adding this edge would create a cycle
    // by seeing if there's already a path from 'to' to 'from'
    return CircularDependencyDetector.hasPath(graph, to, from);
  }
}

