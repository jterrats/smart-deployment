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

const logger = getLogger('DependencyImpactAnalyzer');

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

  public constructor(
    graph: DependencyGraph,
    reverseGraph: DependencyGraph,
    options: ImpactAnalysisOptions = {}
  ) {
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

    // Calculate impact for each changed component
    const impacts = new Map<NodeId, ComponentImpact>();
    const allAffected = new Set<NodeId>();

    for (const nodeId of changedComponents) {
      const impact = this.calculateImpact(nodeId);
      impacts.set(nodeId, impact);

      // Collect all affected components (including transitive)
      allAffected.add(nodeId);
      const transitiveAffected = this.findAllDependents(nodeId);
      for (const affected of transitiveAffected) {
        allAffected.add(affected);
      }
    }

    // Find critical components
    const criticalComponents = this.identifyCriticalComponents();

    // Calculate overall impact level
    const overallImpactLevel = this.calculateOverallImpactLevel(impacts);

    // Generate test scope recommendations
    const testScope = this.generateTestScope(Array.from(allAffected), impacts);

    const duration = Date.now() - startTime;
    logger.info('Impact analysis completed', {
      changedComponents: changedComponents.length,
      totalAffected: allAffected.size,
      impactLevel: overallImpactLevel,
      criticalComponents: criticalComponents.length,
      durationMs: duration,
    });

    return {
      changedComponents,
      impacts,
      totalAffected: allAffected.size,
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
    const allAffected = this.findAllDependents(nodeId);
    const impactRadius = this.calculateImpactRadius(nodeId, allAffected);
    const riskScore = this.calculateRiskScore(directDependents.length, allAffected.size);
    const impactLevel = DependencyImpactAnalyzer.getImpactLevel(riskScore);

    return {
      nodeId,
      directDependents,
      totalAffected: allAffected.size,
      impactRadius,
      impactLevel,
      riskScore,
      isCritical: directDependents.length >= this.options.criticalThreshold,
    };
  }

  /**
   * Find all dependents (transitive closure) of a component using BFS
   */
  private findAllDependents(nodeId: NodeId): Set<NodeId> {
    const affected = new Set<NodeId>();
    const queue: Array<{ nodeId: NodeId; depth: number }> = [{ nodeId, depth: 0 }];
    const visited = new Set<NodeId>();

    while (queue.length > 0) {
      const { nodeId: current, depth } = queue.shift()!;

      if (visited.has(current) || depth > this.options.maxDepth) {
        continue;
      }

      visited.add(current);
      affected.add(current);

      const dependents = this.reverseGraph.get(current) ?? new Set();
      for (const dependent of dependents) {
        // Filter out test classes if configured
        if (!this.options.includeTests && this.isTestClass(dependent)) {
          continue;
        }
        
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
    const queue: Array<{ nodeId: NodeId; distance: number }> = [{ nodeId, distance: 0 }];
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
    const critical: NodeId[] = [];

    for (const [nodeId, dependents] of this.reverseGraph.entries()) {
      if (dependents.size >= this.options.criticalThreshold) {
        critical.push(nodeId);
      }
    }

    // Sort by number of dependents (descending)
    critical.sort((a, b) => {
      const aCount = this.reverseGraph.get(a)?.size ?? 0;
      const bCount = this.reverseGraph.get(b)?.size ?? 0;
      return bCount - aCount;
    });

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
    const requiredTests: NodeId[] = [];
    const recommendedTests: NodeId[] = [];
    const optionalTests: NodeId[] = [];

    for (const nodeId of affectedComponents) {
      // Check if it's a test class
      if (this.isTestClass(nodeId)) {
        // Direct changes to test classes are required
        if (impacts.has(nodeId)) {
          requiredTests.push(nodeId);
        } else {
          recommendedTests.push(nodeId);
        }
        continue;
      }

      // Find associated test class
      const testClass = this.findTestClass(nodeId);
      if (testClass) {
        const impact = impacts.get(nodeId);
        if (impact) {
          // High/critical impact = required
          if (impact.impactLevel === 'high' || impact.impactLevel === 'critical') {
            requiredTests.push(testClass);
          } else if (impact.impactLevel === 'medium') {
            recommendedTests.push(testClass);
          } else {
            optionalTests.push(testClass);
          }
        } else {
          // Affected but not directly changed
          recommendedTests.push(testClass);
        }
      }
    }

    // Determine priority
    let priority: 'low' | 'medium' | 'high' = 'low';
    const totalTests = requiredTests.length + recommendedTests.length;
    
    if (requiredTests.length >= 1 && affectedComponents.length > 15) {
      priority = 'high';
    } else if (requiredTests.length > 10 || impacts.size > 5) {
      priority = 'high';
    } else if (requiredTests.length > 3 || totalTests > 10) {
      priority = 'medium';
    }

    return {
      requiredTests: Array.from(new Set(requiredTests)),
      recommendedTests: Array.from(new Set(recommendedTests)),
      optionalTests: Array.from(new Set(optionalTests)),
      estimatedTestCount: requiredTests.length + recommendedTests.length,
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
    const testPatterns = [
      `${type}:${name}Test`,
      `${type}:Test${name}`,
      `${type}:${name}_Test`,
      `${type}:${name}Tests`,
    ];

    for (const pattern of testPatterns) {
      if (this.graph.has(pattern)) {
        return pattern;
      }
    }

    return undefined;
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

