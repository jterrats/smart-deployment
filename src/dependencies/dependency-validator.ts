/**
 * Dependency Validator
 * Validates the dependency graph for correctness and consistency
 * 
 * @ac US-034-AC-1: Validate no dangling references
 * @ac US-034-AC-2: Validate all nodes have types
 * @ac US-034-AC-3: Validate no self-loops (except cycles)
 * @ac US-034-AC-4: Validate edge consistency
 * @ac US-034-AC-5: Generate validation report
 * @ac US-034-AC-6: Fail on critical issues
 * 
 * @issue #34
 */

import { getLogger } from '../utils/logger.js';
import type { NodeId, DependencyGraph, CircularDependency } from '../types/dependency.js';
import type { MetadataComponent } from '../types/metadata.js';

const logger = getLogger('DependencyValidator');

/**
 * Validation severity
 */
export type ValidationSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Validation issue
 */
export type ValidationIssue = {
  severity: ValidationSeverity;
  code: string;
  message: string;
  nodeId?: NodeId;
  relatedNodes?: NodeId[];
  suggestion?: string;
};

/**
 * Validation result
 */
export type ValidationResult = {
  isValid: boolean;
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  critical: ValidationIssue[];
  stats: ValidationStats;
};

/**
 * Validation statistics
 */
export type ValidationStats = {
  totalNodes: number;
  totalEdges: number;
  danglingReferences: number;
  selfLoops: number;
  invalidNodes: number;
  edgeInconsistencies: number;
};

/**
 * Validator options
 */
export type ValidatorOptions = {
  /** Fail on warnings (not just errors) */
  strictMode?: boolean;
  /** Known circular dependencies to ignore for self-loop checks */
  circularDependencies?: CircularDependency[];
  /** Allow self-loops in specific node types */
  allowSelfLoops?: boolean;
};

/**
 * Dependency Validator
 * 
 * Validates dependency graph integrity:
 * - No dangling references (edges to non-existent nodes)
 * - All nodes have valid types
 * - No self-loops (unless in known cycles)
 * - Edge consistency (graph ↔ components)
 * 
 * Performance: O(V + E)
 * 
 * @example
 * const validator = new DependencyValidator(graph, components);
 * const result = validator.validate();
 * if (!result.isValid) {
 *   console.error(`Found ${result.errors.length} errors`);
 *   result.errors.forEach(e => console.error(e.message));
 * }
 */
export class DependencyValidator {
  private graph: DependencyGraph;
  private components: Map<NodeId, MetadataComponent>;
  private options: Required<ValidatorOptions>;

  public constructor(
    graph: DependencyGraph,
    components: Map<NodeId, MetadataComponent>,
    options: ValidatorOptions = {}
  ) {
    this.graph = graph;
    this.components = components;
    this.options = {
      strictMode: options.strictMode ?? false,
      circularDependencies: options.circularDependencies ?? [],
      allowSelfLoops: options.allowSelfLoops ?? false,
    };

    logger.debug('Initialized DependencyValidator', {
      nodes: this.graph.size,
      components: this.components.size,
      strictMode: this.options.strictMode,
    });
  }

  /**
   * Validate the dependency graph
   * 
   * @ac US-034-AC-5: Generate validation report
   * @ac US-034-AC-6: Fail on critical issues
   */
  public validate(): ValidationResult {
    const startTime = Date.now();
    const issues: ValidationIssue[] = [];

    // Run all validations
    issues.push(...this.validateDanglingReferences());
    issues.push(...this.validateNodeTypes());
    issues.push(...this.validateSelfLoops());
    issues.push(...this.validateEdgeConsistency());

    // Categorize issues by severity
    const errors = issues.filter((i) => i.severity === 'error');
    const warnings = issues.filter((i) => i.severity === 'warning');
    const critical = issues.filter((i) => i.severity === 'critical');

    // Calculate stats
    const stats = this.calculateStats(issues);

    // Determine if valid
    const isValid = critical.length === 0 && errors.length === 0 && (!this.options.strictMode || warnings.length === 0);

    const duration = Date.now() - startTime;
    logger.info('Validation completed', {
      isValid,
      issues: issues.length,
      errors: errors.length,
      warnings: warnings.length,
      critical: critical.length,
      durationMs: duration,
    });

    return {
      isValid,
      issues,
      errors,
      warnings,
      critical,
      stats,
    };
  }

  /**
   * @ac US-034-AC-1: Validate no dangling references
   */
  private validateDanglingReferences(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const [nodeId, deps] of this.graph.entries()) {
      for (const dep of deps) {
        // Check if dependency exists in graph
        if (!this.graph.has(dep) && !this.components.has(dep)) {
          issues.push({
            severity: 'error',
            code: 'DANGLING_REFERENCE',
            message: `Dangling reference: ${nodeId} references non-existent ${dep}`,
            nodeId,
            relatedNodes: [dep],
            suggestion: `Ensure ${dep} exists in the project or remove the reference`,
          });
        }
      }
    }

    logger.debug('Dangling reference validation', { danglingRefs: issues.length });
    return issues;
  }

  /**
   * @ac US-034-AC-2: Validate all nodes have types
   */
  private validateNodeTypes(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const nodeId of this.graph.keys()) {
      // Check if node ID has valid format: "Type:Name"
      if (!nodeId.includes(':')) {
        issues.push({
          severity: 'critical',
          code: 'INVALID_NODE_FORMAT',
          message: `Invalid node format: ${nodeId} (expected "Type:Name")`,
          nodeId,
          suggestion: 'Node IDs must follow the format "MetadataType:ComponentName"',
        });
        continue;
      }

      const [type, name] = nodeId.split(':');

      if (!type || type.trim().length === 0) {
        issues.push({
          severity: 'critical',
          code: 'MISSING_TYPE',
          message: `Node ${nodeId} has no type`,
          nodeId,
          suggestion: 'All nodes must have a valid metadata type',
        });
      }

      if (!name || name.trim().length === 0) {
        issues.push({
          severity: 'critical',
          code: 'MISSING_NAME',
          message: `Node ${nodeId} has no name`,
          nodeId,
          suggestion: 'All nodes must have a valid component name',
        });
      }
    }

    logger.debug('Node type validation', { invalidNodes: issues.length });
    return issues;
  }

  /**
   * @ac US-034-AC-3: Validate no self-loops (except cycles)
   */
  private validateSelfLoops(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Build set of nodes in known cycles
    const cyclicNodes = new Set<NodeId>();
    for (const cycle of this.options.circularDependencies) {
      for (const nodeId of cycle.cycle) {
        cyclicNodes.add(nodeId);
      }
    }

    for (const [nodeId, deps] of this.graph.entries()) {
      if (deps.has(nodeId)) {
        // Self-loop detected
        if (!this.options.allowSelfLoops && !cyclicNodes.has(nodeId)) {
          issues.push({
            severity: 'error',
            code: 'SELF_LOOP',
            message: `Self-loop detected: ${nodeId} depends on itself`,
            nodeId,
            suggestion: 'Remove the self-reference or declare it as a circular dependency',
          });
        } else if (cyclicNodes.has(nodeId)) {
          issues.push({
            severity: 'info',
            code: 'KNOWN_SELF_LOOP',
            message: `Self-loop in known circular dependency: ${nodeId}`,
            nodeId,
          });
        }
      }
    }

    logger.debug('Self-loop validation', { selfLoops: issues.length });
    return issues;
  }

  /**
   * @ac US-034-AC-4: Validate edge consistency
   */
  private validateEdgeConsistency(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Validate that components match graph
    for (const [nodeId, component] of this.components.entries()) {
      const graphDeps = this.graph.get(nodeId) ?? new Set();
      const componentDeps = component.dependencies;

      // Check if graph has all component dependencies
      for (const dep of componentDeps) {
        if (!graphDeps.has(dep)) {
          issues.push({
            severity: 'warning',
            code: 'GRAPH_COMPONENT_MISMATCH',
            message: `Component ${nodeId} declares dependency ${dep} but not in graph`,
            nodeId,
            relatedNodes: [dep],
            suggestion: 'Ensure dependency graph is built from component metadata',
          });
        }
      }

      // Check if component has all graph dependencies
      for (const dep of graphDeps) {
        if (!componentDeps.has(dep)) {
          issues.push({
            severity: 'warning',
            code: 'COMPONENT_GRAPH_MISMATCH',
            message: `Graph has edge ${nodeId} → ${dep} but component doesn't declare it`,
            nodeId,
            relatedNodes: [dep],
            suggestion: 'Synchronize graph with component metadata',
          });
        }
      }
    }

    logger.debug('Edge consistency validation', { inconsistencies: issues.length });
    return issues;
  }

  /**
   * Calculate validation statistics
   */
  private calculateStats(issues: ValidationIssue[]): ValidationStats {
    const danglingReferences = issues.filter((i) => i.code === 'DANGLING_REFERENCE').length;
    const selfLoops = issues.filter((i) => i.code === 'SELF_LOOP' || i.code === 'KNOWN_SELF_LOOP').length;
    const invalidNodes = issues.filter((i) => i.code === 'INVALID_NODE_FORMAT' || i.code === 'MISSING_TYPE' || i.code === 'MISSING_NAME').length;
    const edgeInconsistencies = issues.filter((i) => i.code === 'GRAPH_COMPONENT_MISMATCH' || i.code === 'COMPONENT_GRAPH_MISMATCH').length;

    let totalEdges = 0;
    for (const deps of this.graph.values()) {
      totalEdges += deps.size;
    }

    return {
      totalNodes: this.graph.size,
      totalEdges,
      danglingReferences,
      selfLoops,
      invalidNodes,
      edgeInconsistencies,
    };
  }

  /**
   * Validate a specific component
   */
  public validateComponent(nodeId: NodeId): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check if component exists
    if (!this.graph.has(nodeId)) {
      issues.push({
        severity: 'error',
        code: 'NODE_NOT_FOUND',
        message: `Component ${nodeId} not found in graph`,
        nodeId,
      });
      return issues;
    }

    // Validate its dependencies
    const deps = this.graph.get(nodeId)!;
    for (const dep of deps) {
      if (!this.graph.has(dep)) {
        issues.push({
          severity: 'error',
          code: 'DANGLING_REFERENCE',
          message: `${nodeId} references non-existent ${dep}`,
          nodeId,
          relatedNodes: [dep],
        });
      }
    }

    return issues;
  }

  /**
   * Check if validation would pass
   */
  public isValid(): boolean {
    const result = this.validate();
    return result.isValid;
  }
}

