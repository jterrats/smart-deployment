/**
 * Wave Builder
 * Generates deployment waves using topological sort
 *
 * @ac US-038-AC-1: Generate waves from dependency graph
 * @ac US-038-AC-2: Each wave contains independent components
 * @ac US-038-AC-3: Components in wave N don't depend on wave N+1
 * @ac US-038-AC-4: Handle components with no dependencies (wave 1)
 * @ac US-038-AC-5: Handle isolated components
 * @ac US-038-AC-6: Generate wave metadata
 *
 * @issue #38
 */

import { getLogger } from '../utils/logger.js';
import type { NodeId, DependencyEdge, DependencyGraph, CircularDependency } from '../types/dependency.js';
import type { MetadataType } from '../types/metadata.js';

const logger = getLogger('WaveBuilder');

/**
 * Wave of independent components
 */
export type Wave = {
  /** Wave number (1-based) */
  number: number;
  /** Components in this wave */
  components: NodeId[];
  /** Metadata about the wave */
  metadata: WaveMetadata;
};

/**
 * Wave metadata
 */
export type WaveMetadata = {
  /** Number of components */
  componentCount: number;
  /** Component types in this wave */
  types: MetadataType[];
  /** Maximum dependency depth in this wave */
  maxDepth: number;
  /** Whether this wave has circular dependencies */
  hasCircularDeps: boolean;
  /** Estimated deployment time (seconds) */
  estimatedTime: number;
};

/**
 * Wave generation result
 */
export type WaveResult = {
  /** Generated waves */
  waves: Wave[];
  /** Total number of components */
  totalComponents: number;
  /** Components that couldn't be placed (circular deps) */
  unplacedComponents: NodeId[];
  /** Circular dependencies detected */
  circularDependencies: CircularDependency[];
  /** Statistics */
  stats: WaveStats;
};

/**
 * Wave statistics
 */
export type WaveStats = {
  /** Total number of waves */
  totalWaves: number;
  /** Average components per wave */
  avgComponentsPerWave: number;
  /** Largest wave size */
  largestWaveSize: number;
  /** Smallest wave size */
  smallestWaveSize: number;
  /** Total estimated time (seconds) */
  totalEstimatedTime: number;
};

/**
 * Wave builder options
 */
export type WaveBuilderOptions = {
  /** Maximum components per wave (0 = unlimited) */
  maxComponentsPerWave?: number;
  /** Respect metadata type deployment order */
  respectTypeOrder?: boolean;
  /** Handle circular dependencies */
  handleCircularDeps?: boolean;
  /** Structured dependency edges for risk-aware ordering inside a wave */
  dependencyEdges?: DependencyEdge[];
};

/**
 * Metadata type deployment order (Salesforce recommended)
 */
const TYPE_DEPLOYMENT_ORDER: MetadataType[] = [
  'CustomObject',
  'CustomField',
  'RecordType',
  'BusinessProcess',
  'CompactLayout',
  'Layout',
  'Profile',
  'PermissionSet',
  'ApexClass',
  'ApexTrigger',
  'Flow',
  'ValidationRule',
  'WorkflowRule',
  'EmailTemplate',
  'FlexiPage',
];

/**
 * Wave Builder
 *
 * Generates deployment waves using topological sort algorithm.
 * Each wave contains components that can be deployed in parallel.
 *
 * Algorithm:
 * 1. Calculate in-degree for all nodes
 * 2. Add nodes with in-degree 0 to first wave
 * 3. Remove those nodes and update in-degrees
 * 4. Repeat until all nodes are placed
 *
 * Performance: O(V + E)
 *
 * @example
 * const builder = new WaveBuilder({
 *   maxComponentsPerWave: 10000,
 *   respectTypeOrder: true
 * });
 *
 * const result = builder.generateWaves(graph);
 * console.log(`Generated ${result.waves.length} waves`);
 */
export class WaveBuilder {
  private options: Required<WaveBuilderOptions>;
  private readonly edgeTypesByFrom: Map<NodeId, Array<DependencyEdge['type']>>;

  public constructor(options: WaveBuilderOptions = {}) {
    this.options = {
      maxComponentsPerWave: options.maxComponentsPerWave ?? 0,
      respectTypeOrder: options.respectTypeOrder ?? true,
      handleCircularDeps: options.handleCircularDeps ?? true,
      dependencyEdges: options.dependencyEdges ?? [],
    };
    this.edgeTypesByFrom = new Map();
    for (const edge of this.options.dependencyEdges) {
      const existing = this.edgeTypesByFrom.get(edge.from) ?? [];
      existing.push(edge.type);
      this.edgeTypesByFrom.set(edge.from, existing);
    }

    logger.debug('Initialized WaveBuilder', {
      maxComponentsPerWave: this.options.maxComponentsPerWave,
      respectTypeOrder: this.options.respectTypeOrder,
    });
  }

  /**
   * @ac US-038-AC-1: Generate waves from dependency graph
   * @ac US-038-AC-2: Each wave contains independent components
   * @ac US-038-AC-3: Components in wave N don't depend on wave N+1
   */
  public generateWaves(graph: DependencyGraph): WaveResult {
    const startTime = Date.now();

    // Calculate in-degree for all nodes
    const inDegree = this.calculateInDegree(graph);
    const waves: Wave[] = [];
    const processed = new Set<NodeId>();
    const unplacedComponents: NodeId[] = [];
    let waveNumber = 1;

    // Build waves using topological sort
    while (processed.size < graph.size) {
      // Find nodes with in-degree 0
      const currentWave: NodeId[] = [];

      for (const [nodeId, degree] of inDegree.entries()) {
        if (degree === 0 && !processed.has(nodeId)) {
          currentWave.push(nodeId);
        }
      }

      // No progress - circular dependency
      if (currentWave.length === 0) {
        this.handleCircularWave(graph, processed, unplacedComponents, waves, waveNumber);

        break;
      }

      // Sort by type order if configured
      if (this.options.respectTypeOrder) {
        currentWave.sort((a, b) => this.compareWavePriority(a, b));
      }

      // Split into multiple waves if exceeds max size
      if (this.options.maxComponentsPerWave > 0 && currentWave.length > this.options.maxComponentsPerWave) {
        const chunks = this.chunkArray(currentWave, this.options.maxComponentsPerWave);
        for (const chunk of chunks) {
          waves.push({
            number: waveNumber++,
            components: chunk,
            metadata: this.generateWaveMetadata(chunk, false),
          });

          // Mark as processed
          for (const nodeId of chunk) {
            processed.add(nodeId);
          }
        }
      } else {
        // Add wave
        waves.push({
          number: waveNumber++,
          components: currentWave,
          metadata: this.generateWaveMetadata(currentWave, false),
        });

        // Mark as processed
        for (const nodeId of currentWave) {
          processed.add(nodeId);
        }
      }

      // Update in-degrees: reduce count for nodes that depended on current wave nodes
      for (const [nodeId, deps] of graph.entries()) {
        if (processed.has(nodeId)) continue;

        // Count how many of its dependencies were in the current wave
        let removedDeps = 0;
        for (const dep of deps) {
          if (currentWave.includes(dep)) {
            removedDeps++;
          }
        }

        if (removedDeps > 0) {
          inDegree.set(nodeId, (inDegree.get(nodeId) ?? 0) - removedDeps);
        }
      }
    }

    // Calculate statistics
    const stats = this.calculateStats(waves);

    const duration = Date.now() - startTime;
    logger.info('Wave generation completed', {
      waves: waves.length,
      components: processed.size,
      unplaced: unplacedComponents.length,
      durationMs: duration,
    });

    // Ensure waves are sorted by number before returning
    waves.sort((a, b) => a.number - b.number);

    return {
      waves,
      totalComponents: graph.size,
      unplacedComponents,
      circularDependencies: [],
      stats,
    };
  }

  /**
   * Calculate in-degree for all nodes
   * In-degree = number of dependencies this node has (how many nodes it depends on)
   * Nodes with in-degree 0 have no dependencies and can be deployed first
   */
  private calculateInDegree(graph: DependencyGraph): Map<NodeId, number> {
    const inDegree = new Map<NodeId, number>();

    // Initialize all nodes with their dependency count
    for (const [nodeId, deps] of graph.entries()) {
      inDegree.set(nodeId, deps.size);
    }

    return inDegree;
  }

  private handleCircularWave(
    graph: DependencyGraph,
    processed: Set<NodeId>,
    unplacedComponents: NodeId[],
    waves: Wave[],
    waveNumber: number
  ): void {
    const remaining = this.collectRemainingNodes(graph, processed);
    unplacedComponents.push(...remaining);

    logger.warn('Circular dependencies detected', {
      remaining: remaining.length,
    });

    if (this.options.handleCircularDeps) {
      if (this.options.respectTypeOrder) {
        remaining.sort((a, b) => this.compareWavePriority(a, b));
      }
      waves.push({
        number: waveNumber,
        components: remaining,
        metadata: this.generateWaveMetadata(remaining, true),
      });
    }
  }

  private collectRemainingNodes(graph: DependencyGraph, processed: Set<NodeId>): NodeId[] {
    const remaining: NodeId[] = [];

    for (const nodeId of graph.keys()) {
      if (!processed.has(nodeId)) {
        remaining.push(nodeId);
      }
    }

    return remaining;
  }

  /**
   * @ac US-038-AC-6: Generate wave metadata
   */
  private generateWaveMetadata(components: NodeId[], hasCircularDeps: boolean): WaveMetadata {
    const types = new Set<MetadataType>();
    const maxDepth = 0;

    for (const component of components) {
      const [type] = component.split(':');
      types.add(type as MetadataType);
    }

    // Estimate deployment time (rough estimate: 0.1s per component)
    const estimatedTime = Math.ceil(components.length * 0.1);

    return {
      componentCount: components.length,
      types: Array.from(types),
      maxDepth,
      hasCircularDeps,
      estimatedTime,
    };
  }

  /**
   * Compare nodes by type deployment order
   */
  private compareWavePriority(a: NodeId, b: NodeId): number {
    const typeA = a.split(':')[0] as MetadataType;
    const typeB = b.split(':')[0] as MetadataType;

    const orderA = TYPE_DEPLOYMENT_ORDER.indexOf(typeA);
    const orderB = TYPE_DEPLOYMENT_ORDER.indexOf(typeB);

    // If not in order list, put at end
    const finalOrderA = orderA === -1 ? 9999 : orderA;
    const finalOrderB = orderB === -1 ? 9999 : orderB;

    const typeOrderComparison = finalOrderA - finalOrderB;
    if (typeOrderComparison !== 0) {
      return typeOrderComparison;
    }

    const riskA = this.getDependencyRiskProfile(a);
    const riskB = this.getDependencyRiskProfile(b);

    if (riskA.inferred !== riskB.inferred) {
      return riskA.inferred - riskB.inferred;
    }

    if (riskA.soft !== riskB.soft) {
      return riskA.soft - riskB.soft;
    }

    if (riskA.hard !== riskB.hard) {
      return riskB.hard - riskA.hard;
    }

    return a.localeCompare(b);
  }

  private getDependencyRiskProfile(nodeId: NodeId): { hard: number; soft: number; inferred: number } {
    const edgeTypes = this.edgeTypesByFrom.get(nodeId) ?? [];

    return edgeTypes.reduce(
      (accumulator, type) => ({
        ...accumulator,
        [type]: accumulator[type] + 1,
      }),
      {
        hard: 0,
        soft: 0,
        inferred: 0,
      }
    );
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Calculate wave statistics
   */
  private calculateStats(waves: Wave[]): WaveStats {
    if (waves.length === 0) {
      return {
        totalWaves: 0,
        avgComponentsPerWave: 0,
        largestWaveSize: 0,
        smallestWaveSize: 0,
        totalEstimatedTime: 0,
      };
    }

    const sizes = waves.map((w) => w.components.length);
    const totalComponents = sizes.reduce((sum, size) => sum + size, 0);
    const totalTime = waves.reduce((sum, w) => sum + w.metadata.estimatedTime, 0);

    return {
      totalWaves: waves.length,
      avgComponentsPerWave: Math.round(totalComponents / waves.length),
      largestWaveSize: Math.max(...sizes),
      smallestWaveSize: Math.min(...sizes),
      totalEstimatedTime: totalTime,
    };
  }

  /**
   * Get wave by number
   */
  public getWave(result: WaveResult, waveNumber: number): Wave | undefined {
    return result.waves.find((w) => w.number === waveNumber);
  }

  /**
   * Get component wave number
   */
  public getComponentWave(result: WaveResult, componentId: NodeId): number | undefined {
    for (const wave of result.waves) {
      if (wave.components.includes(componentId)) {
        return wave.number;
      }
    }
    return undefined;
  }
}
