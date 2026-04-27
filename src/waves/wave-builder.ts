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

type WavePlacementPolicy = {
  maxComponentsPerWave: number;
  respectTypeOrder: boolean;
  handleCircularDeps: boolean;
};

type WavePlacementState = {
  inDegree: Map<NodeId, number>;
  waves: Wave[];
  processed: Set<NodeId>;
  unplacedComponents: NodeId[];
  nextWaveNumber: number;
};

type DependencyRiskProfile = {
  hard: number;
  soft: number;
  inferred: number;
};

type WaveCandidateBatch = {
  orderedCandidates: NodeId[];
  chunks: NodeId[][];
};

type CircularWaveResolution = {
  remaining: NodeId[];
  fallbackWave?: Wave;
};

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

function calculateInDegree(graph: DependencyGraph): Map<NodeId, number> {
  const inDegree = new Map<NodeId, number>();

  for (const [nodeId, deps] of graph.entries()) {
    inDegree.set(nodeId, deps.size);
  }

  return inDegree;
}

function collectWaveCandidates(inDegree: ReadonlyMap<NodeId, number>, processed: ReadonlySet<NodeId>): NodeId[] {
  const candidates: NodeId[] = [];

  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0 && !processed.has(nodeId)) {
      candidates.push(nodeId);
    }
  }

  return candidates;
}

function collectRemainingNodes(graph: DependencyGraph, processed: ReadonlySet<NodeId>): NodeId[] {
  const remaining: NodeId[] = [];

  for (const nodeId of graph.keys()) {
    if (!processed.has(nodeId)) {
      remaining.push(nodeId);
    }
  }

  return remaining;
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

function getMetadataTypeDeploymentOrder(type: MetadataType): number {
  const order = TYPE_DEPLOYMENT_ORDER.indexOf(type);
  return order === -1 ? 9999 : order;
}

function extractMetadataType(nodeId: NodeId): MetadataType {
  return nodeId.split(':')[0] as MetadataType;
}

function compareTypedDependencyRisk(left: DependencyRiskProfile, right: DependencyRiskProfile): number {
  if (left.inferred !== right.inferred) {
    return left.inferred - right.inferred;
  }

  if (left.soft !== right.soft) {
    return left.soft - right.soft;
  }

  if (left.hard !== right.hard) {
    return right.hard - left.hard;
  }

  return 0;
}

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
    const policy = this.getPlacementPolicy();
    const state = this.createPlacementState(graph);

    while (state.processed.size < graph.size) {
      const candidateBatch = this.planCandidateBatch(state, policy);
      if (candidateBatch.orderedCandidates.length === 0) {
        const circularResolution = this.resolveCircularWave(graph, state.processed, state.nextWaveNumber, policy);
        state.unplacedComponents.push(...circularResolution.remaining);
        if (circularResolution.fallbackWave) {
          state.waves.push(circularResolution.fallbackWave);
        }
        break;
      }

      for (const chunk of candidateBatch.chunks) {
        state.waves.push(this.createWave(chunk, state.nextWaveNumber, false));
        state.nextWaveNumber += 1;
        this.markProcessed(state.processed, chunk);
      }

      this.updateInDegreeForPlacedCandidates(graph, state.inDegree, state.processed, candidateBatch.orderedCandidates);
    }

    const stats = this.calculateStats(state.waves);

    const duration = Date.now() - startTime;
    logger.info('Wave generation completed', {
      waves: state.waves.length,
      components: state.processed.size,
      unplaced: state.unplacedComponents.length,
      durationMs: duration,
    });

    state.waves.sort((a, b) => a.number - b.number);

    return {
      waves: state.waves,
      totalComponents: graph.size,
      unplacedComponents: state.unplacedComponents,
      circularDependencies: [],
      stats,
    };
  }

  private createPlacementState(graph: DependencyGraph): WavePlacementState {
    return {
      inDegree: calculateInDegree(graph),
      waves: [],
      processed: new Set<NodeId>(),
      unplacedComponents: [],
      nextWaveNumber: 1,
    };
  }

  private getPlacementPolicy(): WavePlacementPolicy {
    return {
      maxComponentsPerWave: this.options.maxComponentsPerWave,
      respectTypeOrder: this.options.respectTypeOrder,
      handleCircularDeps: this.options.handleCircularDeps,
    };
  }

  private selectWaveCandidates(
    inDegree: ReadonlyMap<NodeId, number>,
    processed: ReadonlySet<NodeId>,
    policy: WavePlacementPolicy
  ): NodeId[] {
    const candidates = collectWaveCandidates(inDegree, processed);

    if (policy.respectTypeOrder) {
      candidates.sort((left, right) => this.compareWavePriority(left, right));
    }

    return candidates;
  }

  private planCandidateBatch(
    state: Pick<WavePlacementState, 'inDegree' | 'processed'>,
    policy: WavePlacementPolicy
  ): WaveCandidateBatch {
    const orderedCandidates = this.selectWaveCandidates(state.inDegree, state.processed, policy);
    return {
      orderedCandidates,
      chunks: this.createWaveChunks(orderedCandidates, policy.maxComponentsPerWave),
    };
  }

  private createWaveChunks(candidates: NodeId[], maxComponentsPerWave: number): NodeId[][] {
    if (maxComponentsPerWave > 0 && candidates.length > maxComponentsPerWave) {
      return chunkArray(candidates, maxComponentsPerWave);
    }

    return [candidates];
  }

  private createWave(components: NodeId[], waveNumber: number, hasCircularDeps: boolean): Wave {
    return {
      number: waveNumber,
      components,
      metadata: this.generateWaveMetadata(components, hasCircularDeps),
    };
  }

  private markProcessed(processed: Set<NodeId>, components: Iterable<NodeId>): void {
    for (const nodeId of components) {
      processed.add(nodeId);
    }
  }

  private updateInDegreeForPlacedCandidates(
    graph: DependencyGraph,
    inDegree: Map<NodeId, number>,
    processed: ReadonlySet<NodeId>,
    placedCandidates: readonly NodeId[]
  ): void {
    for (const [nodeId, deps] of graph.entries()) {
      if (processed.has(nodeId)) {
        continue;
      }

      let removedDeps = 0;
      for (const dep of deps) {
        if (placedCandidates.includes(dep)) {
          removedDeps += 1;
        }
      }

      if (removedDeps > 0) {
        inDegree.set(nodeId, (inDegree.get(nodeId) ?? 0) - removedDeps);
      }
    }
  }

  private resolveCircularWave(
    graph: DependencyGraph,
    processed: ReadonlySet<NodeId>,
    waveNumber: number,
    policy: WavePlacementPolicy
  ): CircularWaveResolution {
    const remaining = collectRemainingNodes(graph, processed);

    logger.warn('Circular dependencies detected', {
      remaining: remaining.length,
    });

    if (policy.handleCircularDeps) {
      if (policy.respectTypeOrder) {
        remaining.sort((left, right) => this.compareWavePriority(left, right));
      }

      return {
        remaining,
        fallbackWave: this.createWave(remaining, waveNumber, true),
      };
    }

    return { remaining };
  }

  private compareWavePriority(a: NodeId, b: NodeId): number {
    const typeOrderComparison =
      getMetadataTypeDeploymentOrder(extractMetadataType(a)) - getMetadataTypeDeploymentOrder(extractMetadataType(b));
    if (typeOrderComparison !== 0) {
      return typeOrderComparison;
    }

    const riskA = this.getDependencyRiskProfile(a);
    const riskB = this.getDependencyRiskProfile(b);
    const riskComparison = compareTypedDependencyRisk(riskA, riskB);
    if (riskComparison !== 0) {
      return riskComparison;
    }

    return a.localeCompare(b);
  }

  private getDependencyRiskProfile(nodeId: NodeId): DependencyRiskProfile {
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
   * @ac US-038-AC-6: Generate wave metadata
   */
  private generateWaveMetadata(components: NodeId[], hasCircularDeps: boolean): WaveMetadata {
    const types = new Set<MetadataType>();
    const maxDepth = 0;

    for (const component of components) {
      types.add(extractMetadataType(component));
    }

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
