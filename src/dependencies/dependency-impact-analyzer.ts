/**
 * Dependency Impact Analyzer
 * Analyzes the impact of changes to components in the dependency graph
 *
 * @ac US-032-AC-1: Given a component, find all dependents
 * @ac US-032-AC-2: Calculate impact radius
 * @ac US-032-AC-3: Identify critical components
 * @ac US-032-AC-4: Generate impact report
 * @ac US-032-AC-5: Suggest test scope based on impact
 *
 * @issue #32
 */

import { getLogger } from '../utils/logger.js';
import type { NodeId, DependencyGraph } from '../types/dependency.js';
import { DEFAULT_GRAPH_DEPENDENCY_KIND, shouldTraverseDependencyKind } from './dependency-semantics.js';

const logger = getLogger('DependencyImpactAnalyzer');

type TraversalNode = {
  nodeId: NodeId;
  depth: number;
};

type DistanceNode = {
  nodeId: NodeId;
  distance: number;
};

type ImpactAggregate = {
  impacts: Map<NodeId, ComponentImpact>;
  allAffected: Set<NodeId>;
};

type ImpactTraversal = {
  affected: Set<NodeId>;
  impactRadius: number;
};

type TestBuckets = {
  requiredTests: NodeId[];
  recommendedTests: NodeId[];
  optionalTests: NodeId[];
};

type TestAssociation = {
  nodeId: NodeId;
  associatedTest?: NodeId;
  directTest: boolean;
};

/**
 * Impact level classification
 */
export type ImpactLevel = 'minimal' | 'low' | 'medium' | 'high' | 'critical';

/**
 * Component impact information
 */
export type ComponentImpact = {
  nodeId: NodeId;
  directDependents: NodeId[];
  totalAffected: number;
  impactRadius: number;
  impactLevel: ImpactLevel;
  riskScore: number; // 0-100
  isCritical: boolean;
};

/**
 * Impact analysis result
 */
export type ImpactAnalysisResult = {
  changedComponents: NodeId[];
  impacts: Map<NodeId, ComponentImpact>;
  totalAffected: number;
  overallImpactLevel: ImpactLevel;
  criticalComponents: NodeId[];
  testScope: TestScope;
};

/**
 * Test scope recommendation
 */
export type TestScope = {
  requiredTests: NodeId[];
  recommendedTests: NodeId[];
  optionalTests: NodeId[];
  estimatedTestCount: number;
  priority: 'low' | 'medium' | 'high';
};

/**
 * Options for impact analysis
 */
export type ImpactAnalysisOptions = {
  /** Maximum depth to traverse for impact (default: unlimited) */
  maxDepth?: number;
  /** Include test classes in impact analysis */
  includeTests?: boolean;
  /** Critical threshold: components with > N dependents */
  criticalThreshold?: number;
};

/**
 * Dependency Impact Analyzer
 *
 * Analyzes the impact of changes to determine:
 * - Which components are affected
 * - Impact radius and severity
 * - Critical components
 * - Test scope recommendations
 *
 * Performance: O(V + E) using BFS
 *
 * @example
 * const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph);
 * const result = analyzer.analyze(['ApexClass:AccountService']);
 * console.log(`Total affected: ${result.totalAffected}`);
 * console.log(`Impact level: ${result.overallImpactLevel}`);
 * console.log(`Tests required: ${result.testScope.requiredTests.length}`);
 */
export class DependencyImpactAnalyzer {
  private graph: DependencyGraph;
  private reverseGraph: DependencyGraph;
  private options: Required<ImpactAnalysisOptions>;

  public constructor(graph: DependencyGraph, reverseGraph: DependencyGraph, options: ImpactAnalysisOptions = {}) {
    this.graph = graph;
    this.reverseGraph = reverseGraph;
    this.options = {
      maxDepth: options.maxDepth ?? Number.POSITIVE_INFINITY,
      includeTests: options.includeTests ?? true,
      criticalThreshold: options.criticalThreshold ?? 10,
    };

    logger.debug('Initialized DependencyImpactAnalyzer', {
      nodes: this.graph.size,
      criticalThreshold: this.options.criticalThreshold,
    });
  }

  /**
   * Analyze impact of changes to one or more components
   *
   * @ac US-032-AC-1: Given a component, find all dependents
   * @ac US-032-AC-2: Calculate impact radius
   * @ac US-032-AC-4: Generate impact report
   */
  public analyze(changedComponents: NodeId[]): ImpactAnalysisResult {
    const startTime = Date.now();
    const aggregate = this.collectImpactAggregate(changedComponents);
    const criticalComponents = this.identifyCriticalComponents();
    const overallImpactLevel = this.calculateOverallImpactLevel(aggregate.impacts);
    const testScope = this.generateTestScope(Array.from(aggregate.allAffected), aggregate.impacts);

    const duration = Date.now() - startTime;
    logger.info('Impact analysis completed', {
      changedComponents: changedComponents.length,
      totalAffected: aggregate.allAffected.size,
      impactLevel: overallImpactLevel,
      criticalComponents: criticalComponents.length,
      durationMs: duration,
    });

    return {
      changedComponents,
      impacts: aggregate.impacts,
      totalAffected: aggregate.allAffected.size,
      overallImpactLevel,
      criticalComponents,
      testScope,
    };
  }

  /**
   * Calculate impact for a single component
   */
  private calculateImpact(nodeId: NodeId): ComponentImpact {
    const directDependents = Array.from(this.reverseGraph.get(nodeId) ?? []);
    const traversal = this.analyzeDependentTraversal(nodeId);
    const riskScore = this.calculateRiskScore(directDependents.length, traversal.affected.size);
    const impactLevel = DependencyImpactAnalyzer.getImpactLevel(riskScore);

    return {
      nodeId,
      directDependents,
      totalAffected: traversal.affected.size,
      impactRadius: traversal.impactRadius,
      impactLevel,
      riskScore,
      isCritical: directDependents.length >= this.options.criticalThreshold,
    };
  }

  private analyzeDependentTraversal(nodeId: NodeId): ImpactTraversal {
    const affected = this.findAllDependents(nodeId);
    return {
      affected,
      impactRadius: this.calculateImpactRadius(nodeId, affected),
    };
  }

  /**
   * Find all dependents (transitive closure) of a component using BFS
   */
  private findAllDependents(nodeId: NodeId): Set<NodeId> {
    const affected = new Set<NodeId>();
    const queue: TraversalNode[] = [{ nodeId, depth: 0 }];
    const visited = new Set<NodeId>();

    while (queue.length > 0) {
      const { nodeId: current, depth } = queue.shift()!;

      if (visited.has(current) || depth > this.options.maxDepth) {
        continue;
      }

      visited.add(current);
      affected.add(current);

      const dependents = this.collectTraversableDependents(current);
      for (const dependent of dependents) {
        if (!visited.has(dependent)) {
          queue.push({ nodeId: dependent, depth: depth + 1 });
        }
      }
    }

    // Remove the original node from affected set
    affected.delete(nodeId);

    return affected;
  }

  /**
   * Calculate impact radius (maximum distance to affected component)
   */
  private calculateImpactRadius(nodeId: NodeId, affected: Set<NodeId>): number {
    let maxRadius = 0;
    const queue: DistanceNode[] = [{ nodeId, distance: 0 }];
    const visited = new Set<NodeId>();

    while (queue.length > 0) {
      const { nodeId: current, distance } = queue.shift()!;

      if (visited.has(current)) {
        continue;
      }

      visited.add(current);
      maxRadius = Math.max(maxRadius, distance);

      const dependents = this.reverseGraph.get(current) ?? new Set();
      for (const dependent of dependents) {
        if (affected.has(dependent) && !visited.has(dependent)) {
          queue.push({ nodeId: dependent, distance: distance + 1 });
        }
      }
    }

    return maxRadius;
  }

  /**
   * Calculate risk score (0-100) based on number of affected components
   */
  private calculateRiskScore(directDependents: number, totalAffected: number): number {
    // Risk factors:
    // - Direct dependents (40% weight)
    // - Total affected (60% weight)

    const directScore = Math.min((directDependents / this.options.criticalThreshold) * 40, 40);
    const totalScore = Math.min((totalAffected / (this.options.criticalThreshold * 3)) * 60, 60);

    return Math.round(directScore + totalScore);
  }

  /**
   * Get impact level based on risk score
   */
  private static getImpactLevel(riskScore: number): ImpactLevel {
    if (riskScore >= 80) return 'critical';
    if (riskScore >= 60) return 'high';
    if (riskScore >= 40) return 'medium';
    if (riskScore >= 20) return 'low';
    return 'minimal';
  }

  /**
   * @ac US-032-AC-3: Identify critical components
   *
   * Find components with many dependents
   */
  private identifyCriticalComponents(): NodeId[] {
    const critical = this.collectCriticalComponentCandidates();
    critical.sort((a, b) => this.getDependentCount(b) - this.getDependentCount(a));

    logger.info('Critical components identified', {
      count: critical.length,
      threshold: this.options.criticalThreshold,
    });

    return critical;
  }

  /**
   * Calculate overall impact level from individual impacts
   */
  private calculateOverallImpactLevel(impacts: Map<NodeId, ComponentImpact>): ImpactLevel {
    let maxScore = 0;

    for (const impact of impacts.values()) {
      maxScore = Math.max(maxScore, impact.riskScore);
    }

    return DependencyImpactAnalyzer.getImpactLevel(maxScore);
  }

  /**
   * @ac US-032-AC-5: Suggest test scope based on impact
   *
   * Generate test scope recommendations
   */
  private generateTestScope(affectedComponents: NodeId[], impacts: Map<NodeId, ComponentImpact>): TestScope {
    const buckets = this.collectTestBuckets(affectedComponents, impacts);
    const estimatedTestCount = buckets.requiredTests.length + buckets.recommendedTests.length;
    const priority = this.determineTestPriority(
      buckets.requiredTests.length,
      estimatedTestCount,
      affectedComponents.length,
      impacts.size
    );

    return {
      requiredTests: this.deduplicateNodeIds(buckets.requiredTests),
      recommendedTests: this.deduplicateNodeIds(buckets.recommendedTests),
      optionalTests: this.deduplicateNodeIds(buckets.optionalTests),
      estimatedTestCount,
      priority,
    };
  }

  /**
   * Check if a component is a test class
   */
  private isTestClass(nodeId: NodeId): boolean {
    return nodeId.toLowerCase().includes('test');
  }

  /**
   * Find associated test class for a component
   */
  private findTestClass(nodeId: NodeId): NodeId | undefined {
    // Extract component name
    const parts = nodeId.split(':');
    if (parts.length !== 2) return undefined;

    const [type, name] = parts;

    // Common test naming patterns
    const testPatterns = [`${type}:${name}Test`, `${type}:Test${name}`, `${type}:${name}_Test`, `${type}:${name}Tests`];

    for (const pattern of testPatterns) {
      if (this.graph.has(pattern)) {
        return pattern;
      }
    }

    return undefined;
  }

  private collectImpactAggregate(changedComponents: NodeId[]): ImpactAggregate {
    const impacts = new Map<NodeId, ComponentImpact>();
    const allAffected = new Set<NodeId>();

    for (const nodeId of changedComponents) {
      this.mergeComponentImpact(nodeId, impacts, allAffected);
    }

    return { impacts, allAffected };
  }

  private mergeComponentImpact(nodeId: NodeId, impacts: Map<NodeId, ComponentImpact>, allAffected: Set<NodeId>): void {
    const impact = this.calculateImpact(nodeId);
    impacts.set(nodeId, impact);
    allAffected.add(nodeId);

    const transitiveAffected = this.findAllDependents(nodeId);
    for (const affectedNode of transitiveAffected) {
      allAffected.add(affectedNode);
    }
  }

  private collectTraversableDependents(nodeId: NodeId): NodeId[] {
    const dependents = this.reverseGraph.get(nodeId) ?? new Set();
    const traversable: NodeId[] = [];

    for (const dependent of dependents) {
      if (!shouldTraverseDependencyKind(DEFAULT_GRAPH_DEPENDENCY_KIND)) {
        continue;
      }

      if (!this.options.includeTests && this.isTestClass(dependent)) {
        continue;
      }

      traversable.push(dependent);
    }

    return traversable;
  }

  private collectCriticalComponentCandidates(): NodeId[] {
    const critical: NodeId[] = [];

    for (const [nodeId, dependents] of this.reverseGraph.entries()) {
      if (dependents.size >= this.options.criticalThreshold) {
        critical.push(nodeId);
      }
    }

    return critical;
  }

  private getDependentCount(nodeId: NodeId): number {
    return this.reverseGraph.get(nodeId)?.size ?? 0;
  }

  private collectTestBuckets(affectedComponents: NodeId[], impacts: Map<NodeId, ComponentImpact>): TestBuckets {
    const requiredTests: NodeId[] = [];
    const recommendedTests: NodeId[] = [];
    const optionalTests: NodeId[] = [];

    for (const nodeId of affectedComponents) {
      this.assignTestBucketsForNode(nodeId, impacts, requiredTests, recommendedTests, optionalTests);
    }

    return {
      requiredTests,
      recommendedTests,
      optionalTests,
    };
  }

  private assignTestBucketsForNode(
    nodeId: NodeId,
    impacts: Map<NodeId, ComponentImpact>,
    requiredTests: NodeId[],
    recommendedTests: NodeId[],
    optionalTests: NodeId[]
  ): void {
    const association = this.resolveTestAssociation(nodeId);
    if (association.directTest) {
      this.assignDirectTest(nodeId, impacts, requiredTests, recommendedTests);
      return;
    }

    if (!association.associatedTest) {
      return;
    }

    this.assignAssociatedTest(
      association.associatedTest,
      impacts.get(nodeId),
      requiredTests,
      recommendedTests,
      optionalTests
    );
  }

  private resolveTestAssociation(nodeId: NodeId): TestAssociation {
    if (this.isTestClass(nodeId)) {
      return {
        nodeId,
        directTest: true,
      };
    }

    return {
      nodeId,
      associatedTest: this.findTestClass(nodeId),
      directTest: false,
    };
  }

  private assignDirectTest(
    nodeId: NodeId,
    impacts: Map<NodeId, ComponentImpact>,
    requiredTests: NodeId[],
    recommendedTests: NodeId[]
  ): void {
    if (impacts.has(nodeId)) {
      requiredTests.push(nodeId);
      return;
    }

    recommendedTests.push(nodeId);
  }

  private assignAssociatedTest(
    testClass: NodeId,
    impact: ComponentImpact | undefined,
    requiredTests: NodeId[],
    recommendedTests: NodeId[],
    optionalTests: NodeId[]
  ): void {
    if (!impact) {
      recommendedTests.push(testClass);
      return;
    }

    if (impact.impactLevel === 'high' || impact.impactLevel === 'critical') {
      requiredTests.push(testClass);
    } else if (impact.impactLevel === 'medium') {
      recommendedTests.push(testClass);
    } else {
      optionalTests.push(testClass);
    }
  }

  private determineTestPriority(
    requiredTestCount: number,
    estimatedTestCount: number,
    affectedComponentCount: number,
    changedImpactCount: number
  ): 'low' | 'medium' | 'high' {
    if (requiredTestCount >= 1 && affectedComponentCount > 15) {
      return 'high';
    }

    if (requiredTestCount > 10 || changedImpactCount > 5) {
      return 'high';
    }

    if (requiredTestCount > 3 || estimatedTestCount > 10) {
      return 'medium';
    }

    return 'low';
  }

  private deduplicateNodeIds(nodeIds: NodeId[]): NodeId[] {
    return Array.from(new Set(nodeIds));
  }

  /**
   * Get impact for a specific component
   */
  public getImpact(nodeId: NodeId): ComponentImpact {
    return this.calculateImpact(nodeId);
  }

  /**
   * Get all critical components
   */
  public getCriticalComponents(): NodeId[] {
    return this.identifyCriticalComponents();
  }
}
