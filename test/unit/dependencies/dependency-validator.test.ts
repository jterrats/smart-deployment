/**
 * Unit tests for Dependency Validator
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { DependencyValidator } from '../../../src/dependencies/dependency-validator.js';
import type { DependencyGraph, CircularDependency } from '../../../src/types/dependency.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';

describe('DependencyValidator', () => {
  /**
   * Helper to create test data
   */
  function createTestData(edges: Array<[string, string]>): {
    graph: DependencyGraph;
    components: Map<string, MetadataComponent>;
  } {
    const graph: DependencyGraph = new Map();
    const components = new Map<string, MetadataComponent>();

    // Collect all nodes
    const allNodes = new Set<string>();
    for (const [from, to] of edges) {
      allNodes.add(from);
      allNodes.add(to);
    }

    // Initialize graph and components
    for (const node of allNodes) {
      graph.set(node, new Set<string>());
      components.set(node, {
        type: node.split(':')[0] as any,
        name: node.split(':')[1],
        filePath: `/path/to/${node}`,
        dependencies: new Set<string>(),
        dependents: new Set<string>(),
        priorityBoost: 0,
      });
    }

    // Add edges
    for (const [from, to] of edges) {
      graph.get(from)!.add(to);
      components.get(from)!.dependencies.add(to);
    }

    return { graph, components };
  }

  describe('Dangling References', () => {
    /**
     * @ac US-034-AC-1: Validate no dangling references
     */
    it('US-034-AC-1: should detect dangling references', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:B'],
      ]);

      // Remove B to create dangling reference
      graph.delete('ApexClass:B');
      components.delete('ApexClass:B');

      const validator = new DependencyValidator(graph, components);
      const result = validator.validate();

      expect(result.isValid).to.be.false;
      expect(result.errors.length).to.be.greaterThan(0);
      expect(result.stats.danglingReferences).to.equal(1);
    });

    it('US-034-AC-1: should pass with no dangling references', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
      ]);

      const validator = new DependencyValidator(graph, components);
      const result = validator.validate();

      expect(result.stats.danglingReferences).to.equal(0);
    });

    it('US-034-AC-1: should provide helpful error message', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:Missing'],
      ]);

      graph.delete('ApexClass:Missing');
      components.delete('ApexClass:Missing');

      const validator = new DependencyValidator(graph, components);
      const result = validator.validate();

      const issue = result.errors.find((e) => e.code === 'DANGLING_REFERENCE');
      expect(issue).to.exist;
      expect(issue?.message).to.include('Missing');
      expect(issue?.suggestion).to.exist;
    });
  });

  describe('Node Types', () => {
    /**
     * @ac US-034-AC-2: Validate all nodes have types
     */
    it('US-034-AC-2: should detect invalid node format', () => {
      const graph: DependencyGraph = new Map();
      const components = new Map();

      // Add node without type separator
      graph.set('InvalidNode', new Set());

      const validator = new DependencyValidator(graph, components);
      const result = validator.validate();

      expect(result.isValid).to.be.false;
      expect(result.critical.length).to.be.greaterThan(0);
      expect(result.stats.invalidNodes).to.be.greaterThan(0);
    });

    it('US-034-AC-2: should detect missing type', () => {
      const graph: DependencyGraph = new Map();
      const components = new Map();

      // Add node with empty type
      graph.set(':ComponentName', new Set());

      const validator = new DependencyValidator(graph, components);
      const result = validator.validate();

      expect(result.critical.length).to.be.greaterThan(0);
    });

    it('US-034-AC-2: should detect missing name', () => {
      const graph: DependencyGraph = new Map();
      const components = new Map();

      // Add node with empty name
      graph.set('ApexClass:', new Set());

      const validator = new DependencyValidator(graph, components);
      const result = validator.validate();

      expect(result.critical.length).to.be.greaterThan(0);
    });

    it('US-034-AC-2: should pass with valid node types', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:B'],
        ['CustomObject:Account', 'CustomField:Name'],
      ]);

      const validator = new DependencyValidator(graph, components);
      const result = validator.validate();

      expect(result.stats.invalidNodes).to.equal(0);
    });
  });

  describe('Self-Loops', () => {
    /**
     * @ac US-034-AC-3: Validate no self-loops (except cycles)
     */
    it('US-034-AC-3: should detect self-loops', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:A'],
      ]);

      const validator = new DependencyValidator(graph, components);
      const result = validator.validate();

      expect(result.isValid).to.be.false;
      expect(result.errors.length).to.be.greaterThan(0);
      expect(result.stats.selfLoops).to.be.greaterThan(0);
    });

    it('US-034-AC-3: should allow self-loops in known cycles', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:A'],
      ]);

      const cycles: CircularDependency[] = [{
        cycle: ['ApexClass:A'],
        severity: 'error',
        message: 'Self-loop',
      }];

      const validator = new DependencyValidator(graph, components, {
        circularDependencies: cycles,
      });
      const result = validator.validate();

      // Should be info, not error
      const selfLoopIssues = result.issues.filter((i) => i.code === 'SELF_LOOP');
      expect(selfLoopIssues).to.have.lengthOf(0);
    });

    it('US-034-AC-3: should allow self-loops when configured', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:A'],
      ]);

      const validator = new DependencyValidator(graph, components, {
        allowSelfLoops: true,
      });
      const result = validator.validate();

      const selfLoopErrors = result.errors.filter((e) => e.code === 'SELF_LOOP');
      expect(selfLoopErrors).to.have.lengthOf(0);
    });
  });

  describe('Edge Consistency', () => {
    /**
     * @ac US-034-AC-4: Validate edge consistency
     */
    it('US-034-AC-4: should detect graph-component mismatch', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:B'],
      ]);

      // Add dependency to graph but not to component
      graph.get('ApexClass:A')!.add('ApexClass:C');
      graph.set('ApexClass:C', new Set());
      components.set('ApexClass:C', {
        type: 'ApexClass',
        name: 'C',
        filePath: '/path',
        dependencies: new Set(),
        dependents: new Set(),
        priorityBoost: 0,
      });

      const validator = new DependencyValidator(graph, components);
      const result = validator.validate();

      expect(result.warnings.length).to.be.greaterThan(0);
      expect(result.stats.edgeInconsistencies).to.be.greaterThan(0);
    });

    it('US-034-AC-4: should pass with consistent edges', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
      ]);

      const validator = new DependencyValidator(graph, components);
      const result = validator.validate();

      expect(result.stats.edgeInconsistencies).to.equal(0);
    });
  });

  describe('Validation Report', () => {
    /**
     * @ac US-034-AC-5: Generate validation report
     */
    it('US-034-AC-5: should generate complete validation report', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:B'],
      ]);

      const validator = new DependencyValidator(graph, components);
      const result = validator.validate();

      expect(result.isValid).to.be.a('boolean');
      expect(result.issues).to.be.an('array');
      expect(result.errors).to.be.an('array');
      expect(result.warnings).to.be.an('array');
      expect(result.critical).to.be.an('array');
      expect(result.stats).to.exist;
      expect(result.stats.totalNodes).to.be.a('number');
      expect(result.stats.totalEdges).to.be.a('number');
    });

    it('US-034-AC-5: should categorize issues by severity', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:B'],
      ]);

      // Create various issues
      graph.set('InvalidNode', new Set()); // Critical
      graph.get('ApexClass:A')!.add('ApexClass:Missing'); // Error

      const validator = new DependencyValidator(graph, components);
      const result = validator.validate();

      expect(result.critical.length).to.be.greaterThan(0);
      expect(result.errors.length).to.be.greaterThan(0);
    });
  });

  describe('Critical Issues', () => {
    /**
     * @ac US-034-AC-6: Fail on critical issues
     */
    it('US-034-AC-6: should fail validation on critical issues', () => {
      const graph: DependencyGraph = new Map();
      const components = new Map();

      graph.set('InvalidFormat', new Set());

      const validator = new DependencyValidator(graph, components);
      const result = validator.validate();

      expect(result.isValid).to.be.false;
      expect(result.critical.length).to.be.greaterThan(0);
    });

    it('US-034-AC-6: should fail on errors in normal mode', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:Missing'],
      ]);

      graph.delete('ApexClass:Missing');
      components.delete('ApexClass:Missing');

      const validator = new DependencyValidator(graph, components, {
        strictMode: false,
      });
      const result = validator.validate();

      expect(result.isValid).to.be.false;
    });

    it('US-034-AC-6: should fail on warnings in strict mode', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:B'],
      ]);

      // Create a warning by having graph-component mismatch
      graph.get('ApexClass:A')!.add('ApexClass:C');
      graph.set('ApexClass:C', new Set());
      components.set('ApexClass:C', {
        type: 'ApexClass',
        name: 'C',
        filePath: '/path',
        dependencies: new Set(),
        dependents: new Set(),
        priorityBoost: 0,
      });

      const validator = new DependencyValidator(graph, components, {
        strictMode: true,
      });
      const result = validator.validate();

      expect(result.isValid).to.be.false;
    });
  });

  describe('validateComponent', () => {
    it('should validate specific component', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:B'],
      ]);

      const validator = new DependencyValidator(graph, components);
      const issues = validator.validateComponent('ApexClass:A');

      expect(issues).to.be.an('array');
      expect(issues).to.have.lengthOf(0);
    });

    it('should detect issues in specific component', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:Missing'],
      ]);

      graph.delete('ApexClass:Missing');
      components.delete('ApexClass:Missing');

      const validator = new DependencyValidator(graph, components);
      const issues = validator.validateComponent('ApexClass:A');

      expect(issues.length).to.be.greaterThan(0);
    });

    it('should return error for non-existent component', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:B'],
      ]);

      const validator = new DependencyValidator(graph, components);
      const issues = validator.validateComponent('ApexClass:NonExistent');

      expect(issues).to.have.lengthOf(1);
      expect(issues[0].code).to.equal('NODE_NOT_FOUND');
    });
  });

  describe('isValid', () => {
    it('should return true for valid graph', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
      ]);

      const validator = new DependencyValidator(graph, components);

      expect(validator.isValid()).to.be.true;
    });

    it('should return false for invalid graph', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:Missing'],
      ]);

      graph.delete('ApexClass:Missing');
      components.delete('ApexClass:Missing');

      const validator = new DependencyValidator(graph, components);

      expect(validator.isValid()).to.be.false;
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty graph', () => {
      const graph: DependencyGraph = new Map();
      const components = new Map();

      const validator = new DependencyValidator(graph, components);
      const result = validator.validate();

      expect(result.isValid).to.be.true;
      expect(result.issues).to.have.lengthOf(0);
    });

    it('should handle isolated nodes', () => {
      const graph: DependencyGraph = new Map();
      const components = new Map();

      graph.set('ApexClass:Isolated', new Set());
      components.set('ApexClass:Isolated', {
        type: 'ApexClass',
        name: 'Isolated',
        filePath: '/path',
        dependencies: new Set(),
        dependents: new Set(),
        priorityBoost: 0,
      });

      const validator = new DependencyValidator(graph, components);
      const result = validator.validate();

      expect(result.isValid).to.be.true;
    });

    it('should handle multiple issues in one node', () => {
      const graph: DependencyGraph = new Map();
      const components = new Map();

      // Node with no type AND dangling ref
      graph.set('InvalidNode', new Set(['ApexClass:Missing']));

      const validator = new DependencyValidator(graph, components);
      const result = validator.validate();

      expect(result.issues.length).to.be.greaterThan(1);
    });
  });

  describe('Performance', () => {
    it('should validate large graphs efficiently', function () {
      this.timeout(5000);

      const edges: Array<[string, string]> = [];
      
      for (let i = 0; i < 500; i++) {
        edges.push([`ApexClass:Node${i}`, `ApexClass:Node${i + 1}`]);
      }

      const { graph, components } = createTestData(edges);
      const startTime = Date.now();

      const validator = new DependencyValidator(graph, components);
      const result = validator.validate();

      const duration = Date.now() - startTime;

      expect(result.isValid).to.be.true;
      expect(duration).to.be.lessThan(1000); // Should complete in < 1 second
    });
  });

  describe('Issue Details', () => {
    it('should include nodeId in issues', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:Missing'],
      ]);

      graph.delete('ApexClass:Missing');
      components.delete('ApexClass:Missing');

      const validator = new DependencyValidator(graph, components);
      const result = validator.validate();

      expect(result.errors[0].nodeId).to.exist;
    });

    it('should include related nodes for reference issues', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:Missing'],
      ]);

      graph.delete('ApexClass:Missing');
      components.delete('ApexClass:Missing');

      const validator = new DependencyValidator(graph, components);
      const result = validator.validate();

      const issue = result.errors.find((e) => e.code === 'DANGLING_REFERENCE');
      expect(issue?.relatedNodes).to.exist;
      expect(issue?.relatedNodes).to.include('ApexClass:Missing');
    });

    it('should include suggestions for fixes', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:A'],
      ]);

      const validator = new DependencyValidator(graph, components);
      const result = validator.validate();

      const issue = result.errors.find((e) => e.code === 'SELF_LOOP');
      expect(issue?.suggestion).to.exist;
      expect(issue?.suggestion).to.be.a('string');
    });
  });
});

