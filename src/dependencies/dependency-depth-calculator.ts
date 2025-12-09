/**
 * Dependency Depth Calculator
 * Calculates dependency depth for each component to identify high-risk components
 *
 * @ac US-031-AC-1: Calculate depth from leaf nodes
 * @ac US-031-AC-2: Identify components with depth > 10 (warning)
 * @ac US-031-AC-3: Generate depth distribution report
 * @ac US-031-AC-4: Highlight critical path components
 * @ac US-031-AC-5: Consider cycle depth as infinite
 *
 * @issue #31
 */

import { getLogger } from '../utils/logger.js';
import type { NodeId, DependencyGraph, CircularDependency } from '../types/dependency.js';

const logger = getLogger('DependencyDepthCalculator');

/**
 * Depth information for a component
 */
export type ComponentDepth = {
  nodeId: NodeId;
  depth: number;
  isInCycle: boolean;
  isLeaf: boolean;
  isHighRisk: boolean; // depth > 10
  isCriticalPath: boolean;
  pathToLeaf: NodeId[]; // Longest path to a leaf node
};

/**
 * Depth distribution report
 */
export type DepthDistribution = {
  depthRange: string; // e.g., "0-5", "6-10", ">10"
  count: number;
  percentage: number;
  components: NodeId[];
};

/**
 * Complete depth analysis result
 */
export type DepthAnalysisResult = {
  /** Depth information for each component */
  depths: Map<NodeId, ComponentDepth>;
  /** Components with depth > 10 */
  highRiskComponents: ComponentDepth[];
  /** Critical path (longest dependency chain) */
  criticalPath: NodeId[];
  /** Maximum depth in the graph */
  maxDepth: number;
  /** Average depth */
  averageDepth: number;
  /** Depth distribution */
  distribution: DepthDistribution[];
  /** Components in cycles (infinite depth) */
  cyclicComponents: NodeId[];
};

/**
 * Options for depth calculation
 */
export type DepthCalculationOptions = {
  /** Circular dependencies to consider */
  circularDependencies?: CircularDependency[];
  /** Depth threshold for high-risk warning */
  highRiskThreshold?: number;
};

/**
 * Dependency Depth Calculator
 *
 * Calculates the dependency depth of each component from leaf nodes.
 * Leaf nodes (no dependencies) have depth 0.
 * Components depending on others have depth = max(dep.depth) + 1.
 *
 * Performance: O(V + E) using topological sort
 *
 * @example
 * const calculator = new DependencyDepthCalculator(graph);
 * const result = calculator.calculate();
 * console.log(`Max depth: ${result.maxDepth}`);
 * console.log(`High-risk: ${result.highRiskComponents.length}`);
 */
export class DependencyDepthCalculator {
  private graph: DependencyGraph;
  private options: Required<DepthCalculationOptions>;
  private cyclicNodes: Set<NodeId>;

  public constructor(graph: DependencyGraph, options: DepthCalculationOptions = {}) {
    this.graph = graph;
    this.options = {
      circularDependencies: options.circularDependencies ?? [],
      highRiskThreshold: options.highRiskThreshold ?? 10,
    };

    // Build set of cyclic nodes for O(1) lookup
    this.cyclicNodes = new Set();
    for (const cycle of this.options.circularDependencies) {
      for (const nodeId of cycle.cycle) {
        this.cyclicNodes.add(nodeId);
      }
    }

    logger.debug('Initialized DependencyDepthCalculator', {
      nodes: this.graph.size,
      cyclicNodes: this.cyclicNodes.size,
      highRiskThreshold: this.options.highRiskThreshold,
    });
  }

  /**
   * Calculate depths for all components
   *
   * @ac US-031-AC-1: Calculate depth from leaf nodes
   * @ac US-031-AC-2: Identify components with depth > 10
   * @ac US-031-AC-5: Consider cycle depth as infinite
   */
  public calculate(): DepthAnalysisResult {
    const startTime = Date.now();

    // Calculate depth for each node
    const depths = this.calculateDepths();

    // Find high-risk components
    const highRiskComponents = this.findHighRiskComponents(depths);

    // Find critical path
    const criticalPath = DependencyDepthCalculator.findCriticalPath(depths);

    // Generate distribution
    const distribution = DependencyDepthCalculator.generateDistribution(depths);

    // Calculate statistics
    const maxDepth = DependencyDepthCalculator.calculateMaxDepth(depths);
    const averageDepth = DependencyDepthCalculator.calculateAverageDepth(depths);

    const duration = Date.now() - startTime;
    logger.info('Depth calculation completed', {
      totalNodes: depths.size,
      maxDepth,
      averageDepth: averageDepth.toFixed(2),
      highRisk: highRiskComponents.length,
      cyclicNodes: this.cyclicNodes.size,
      durationMs: duration,
    });

    return {
      depths,
      highRiskComponents,
      criticalPath,
      maxDepth,
      averageDepth,
      distribution,
      cyclicComponents: Array.from(this.cyclicNodes),
    };
  }

  /**
   * Calculate depth for all nodes using BFS from leaf nodes
   */
  private calculateDepths(): Map<NodeId, ComponentDepth> {
    const depths = new Map<NodeId, ComponentDepth>();
    const inDegree = this.calculateInDegree();
    const queue = this.initializeLeafNodes(depths, inDegree);
    
    this.processNodesInBFS(depths, queue);
    this.processRemainingNodes(depths);

    return depths;
  }

  /**
   * Calculate in-degree for each node
   */
  private calculateInDegree(): Map<NodeId, number> {
    const inDegree = new Map<NodeId, number>();

    for (const nodeId of this.graph.keys()) {
      inDegree.set(nodeId, 0);
    }

    for (const deps of this.graph.values()) {
      for (const dep of deps) {
        if (inDegree.has(dep)) {
          inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1);
        } else {
          inDegree.set(dep, 1);
        }
      }
    }

    return inDegree;
  }

  /**
   * Initialize leaf nodes in the queue
   */
  private initializeLeafNodes(
    depths: Map<NodeId, ComponentDepth>,
    inDegree: Map<NodeId, number>
  ): Array<{ nodeId: NodeId; depth: number; path: NodeId[] }> {
    const queue: Array<{ nodeId: NodeId; depth: number; path: NodeId[] }> = [];
    
    for (const [nodeId] of inDegree.entries()) {
      const isInCycle = this.cyclicNodes.has(nodeId);
      const isLeaf = (this.graph.get(nodeId)?.size ?? 0) === 0;

      if (isLeaf && !isInCycle) {
        queue.push({ nodeId, depth: 0, path: [nodeId] });
        depths.set(nodeId, {
          nodeId,
          depth: 0,
          isInCycle: false,
          isLeaf: true,
          isHighRisk: false,
          isCriticalPath: false,
          pathToLeaf: [nodeId],
        });
      } else if (isInCycle) {
        // Mark cyclic nodes with infinite depth
        depths.set(nodeId, {
          nodeId,
          depth: Number.POSITIVE_INFINITY,
          isInCycle: true,
          isLeaf: false,
          isHighRisk: true,
          isCriticalPath: false,
          pathToLeaf: [],
        });
      }
    }

    return queue;
  }

  /**
   * Process nodes in BFS order
   */
  private processNodesInBFS(
    depths: Map<NodeId, ComponentDepth>,
    queue: Array<{ nodeId: NodeId; depth: number; path: NodeId[] }>
  ): void {
    const processed = new Set<NodeId>();

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      if (processed.has(nodeId)) {
        continue;
      }

      processed.add(nodeId);

      // Find all nodes that depend on this node (reverse edges)
      for (const [candidateId, candidateDeps] of this.graph.entries()) {
        if (candidateDeps.has(nodeId) && !this.cyclicNodes.has(candidateId)) {
          this.updateCandidateDepth(candidateId, path, depths, queue);
        }
      }
    }
  }

  /**
   * Update candidate node depth if this path is longer
   */
  private updateCandidateDepth(
    candidateId: NodeId,
    path: NodeId[],
    depths: Map<NodeId, ComponentDepth>,
    queue: Array<{ nodeId: NodeId; depth: number; path: NodeId[] }>
  ): void {
    const candidateDepth = this.calculateNodeDepth(candidateId, depths);
    
    // Update if this is a longer path
    const existing = depths.get(candidateId);
    if (!existing || candidateDepth > existing.depth) {
      const newPath = [...path, candidateId];
      depths.set(candidateId, {
        nodeId: candidateId,
        depth: candidateDepth,
        isInCycle: false,
        isLeaf: false,
        isHighRisk: candidateDepth > this.options.highRiskThreshold,
        isCriticalPath: false,
        pathToLeaf: newPath,
      });

      queue.push({ nodeId: candidateId, depth: candidateDepth, path: newPath });
    }
  }

  /**
   * Process remaining nodes not yet in depths map
   */
  private processRemainingNodes(depths: Map<NodeId, ComponentDepth>): void {
    for (const nodeId of this.graph.keys()) {
      if (!depths.has(nodeId) && !this.cyclicNodes.has(nodeId)) {
        const nodeDepth = this.calculateNodeDepth(nodeId, depths);
        depths.set(nodeId, {
          nodeId,
          depth: nodeDepth,
          isInCycle: false,
          isLeaf: (this.graph.get(nodeId)?.size ?? 0) === 0,
          isHighRisk: nodeDepth > this.options.highRiskThreshold,
          isCriticalPath: false,
          pathToLeaf: [nodeId],
        });
      }
    }
  }

  /**
   * Calculate depth for a single node based on its dependencies
   */
  private calculateNodeDepth(nodeId: NodeId, depths: Map<NodeId, ComponentDepth>): number {
    const deps = this.graph.get(nodeId);
    if (!deps || deps.size === 0) {
      return 0; // Leaf node
    }

    let maxDepth = 0;
    for (const depId of deps) {
      const depDepth = depths.get(depId);
      if (depDepth) {
        if (depDepth.isInCycle) {
          return Number.POSITIVE_INFINITY; // Depends on cyclic node
        }
        maxDepth = Math.max(maxDepth, depDepth.depth);
      }
    }

    return maxDepth + 1;
  }

  /**
   * @ac US-031-AC-2: Identify components with depth > 10
   */
  private findHighRiskComponents(depths: Map<NodeId, ComponentDepth>): ComponentDepth[] {
    const highRisk: ComponentDepth[] = [];

    for (const depth of depths.values()) {
      if (depth.isHighRisk) {
        highRisk.push(depth);
      }
    }

    // Sort by depth (highest first)
    highRisk.sort((a, b) => {
      if (a.depth === Number.POSITIVE_INFINITY && b.depth === Number.POSITIVE_INFINITY) {
        return 0;
      }
      if (a.depth === Number.POSITIVE_INFINITY) {
        return -1;
      }
      if (b.depth === Number.POSITIVE_INFINITY) {
        return 1;
      }
      return b.depth - a.depth;
    });

    logger.info('High-risk components identified', {
      count: highRisk.length,
      threshold: this.options.highRiskThreshold,
    });

    return highRisk;
  }

  /**
   * Get depth for a specific component
   */
  public getDepth(nodeId: NodeId): ComponentDepth | undefined {
    const depths = this.calculate();
    return depths.depths.get(nodeId);
  }

  /**
   * @ac US-031-AC-4: Highlight critical path components
   * 
   * Find the critical path (longest dependency chain)
   */
  private static findCriticalPath(depths: Map<NodeId, ComponentDepth>): NodeId[] {
    let longestPath: NodeId[] = [];
    let maxDepth = 0;

    for (const depth of depths.values()) {
      // Skip cyclic nodes
      if (depth.isInCycle || depth.depth === Number.POSITIVE_INFINITY) {
        continue;
      }

      if (depth.depth > maxDepth) {
        maxDepth = depth.depth;
        longestPath = depth.pathToLeaf;
      }
    }

    // Mark nodes in critical path
    const criticalPathSet = new Set(longestPath);
    for (const [nodeId, depth] of depths.entries()) {
      if (criticalPathSet.has(nodeId)) {
        depth.isCriticalPath = true;
      }
    }

    logger.info('Critical path identified', {
      length: longestPath.length,
      depth: maxDepth,
    });

    return longestPath;
  }

  /**
   * Get depth for a specific component
   */
  public getDepth(nodeId: NodeId): ComponentDepth | undefined {
    const depths = this.calculate();
    return depths.depths.get(nodeId);
  }

  /**
   * @ac US-031-AC-3: Generate depth distribution report
   */
  private static generateDistribution(depths: Map<NodeId, ComponentDepth>): DepthDistribution[] {
    const ranges: Array<{ range: string; min: number; max: number }> = [
      { range: '0-5', min: 0, max: 5 },
      { range: '6-10', min: 6, max: 10 },
      { range: '11-20', min: 11, max: 20 },
      { range: '21-50', min: 21, max: 50 },
      { range: '>50', min: 51, max: Number.POSITIVE_INFINITY },
    ];

    const distribution: DepthDistribution[] = [];
    const total = depths.size;

    for (const { range, min, max } of ranges) {
      const components: NodeId[] = [];

      for (const depth of depths.values()) {
        // Handle infinite depth (cycles)
        if (depth.depth === Number.POSITIVE_INFINITY && max === Number.POSITIVE_INFINITY) {
          components.push(depth.nodeId);
        } else if (depth.depth >= min && depth.depth <= max) {
          components.push(depth.nodeId);
        }
      }

      if (components.length > 0) {
        distribution.push({
          depthRange: range,
          count: components.length,
          percentage: (components.length / total) * 100,
          components,
        });
      }
    }

    return distribution;
  }

  /**
   * Calculate maximum depth
   */
  private static calculateMaxDepth(depths: Map<NodeId, ComponentDepth>): number {
    let maxDepth = 0;

    for (const depth of depths.values()) {
      if (depth.depth !== Number.POSITIVE_INFINITY) {
        maxDepth = Math.max(maxDepth, depth.depth);
      }
    }

    return maxDepth;
  }

  /**
   * Calculate average depth (excluding cyclic nodes)
   */
  private static calculateAverageDepth(depths: Map<NodeId, ComponentDepth>): number {
    let sum = 0;
    let count = 0;

    for (const depth of depths.values()) {
      if (depth.depth !== Number.POSITIVE_INFINITY) {
        sum += depth.depth;
        count++;
      }
    }

    return count > 0 ? sum / count : 0;
  }
}

