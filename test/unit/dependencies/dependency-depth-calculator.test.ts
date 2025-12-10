/**
 * Unit tests for Dependency Depth Calculator
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { DependencyDepthCalculator } from '../../../src/dependencies/dependency-depth-calculator.js';
import type { DependencyGraph, CircularDependency } from '../../../src/types/dependency.js';

describe('DependencyDepthCalculator', () => {
  /**
   * Helper to create a dependency graph
   */
  function createGraph(edges: Array<[string, string]>): DependencyGraph {
    const graph: DependencyGraph = new Map();

    for (const [from, to] of edges) {
      if (!graph.has(from)) {
        graph.set(from, new Set());
      }
      graph.get(from)!.add(to);

      // Ensure 'to' node exists in graph
      if (!graph.has(to)) {
        graph.set(to, new Set());
      }
    }

    return graph;
  }

  describe('Leaf Nodes', () => {
    /**
     * @ac US-031-AC-1: Calculate depth from leaf nodes
     */
    it('US-031-AC-1: should assign depth 0 to leaf nodes', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:A', 'ApexClass:C'],
      ]);

      const calculator = new DependencyDepthCalculator(graph);
      const result = calculator.calculate();

      expect(result.depths.get('ApexClass:B')?.depth).to.equal(0);
      expect(result.depths.get('ApexClass:C')?.depth).to.equal(0);
      expect(result.depths.get('ApexClass:B')?.isLeaf).to.be.true;
      expect(result.depths.get('ApexClass:C')?.isLeaf).to.be.true;
    });

    it('US-031-AC-1: should calculate depth correctly in linear chain', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:D'],
      ]);

      const calculator = new DependencyDepthCalculator(graph);
      const result = calculator.calculate();

      expect(result.depths.get('ApexClass:D')?.depth).to.equal(0); // Leaf
      expect(result.depths.get('ApexClass:C')?.depth).to.equal(1);
      expect(result.depths.get('ApexClass:B')?.depth).to.equal(2);
      expect(result.depths.get('ApexClass:A')?.depth).to.equal(3);
    });

    it('US-031-AC-1: should calculate depth correctly with multiple dependencies', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:A', 'ApexClass:C'],
        ['ApexClass:B', 'ApexClass:D'],
        ['ApexClass:C', 'ApexClass:D'],
      ]);

      const calculator = new DependencyDepthCalculator(graph);
      const result = calculator.calculate();

      expect(result.depths.get('ApexClass:D')?.depth).to.equal(0); // Leaf
      expect(result.depths.get('ApexClass:B')?.depth).to.equal(1);
      expect(result.depths.get('ApexClass:C')?.depth).to.equal(1);
      expect(result.depths.get('ApexClass:A')?.depth).to.equal(2); // max(B.depth, C.depth) + 1
    });
  });

  describe('High-Risk Components', () => {
    /**
     * @ac US-031-AC-2: Identify components with depth > 10
     */
    it('US-031-AC-2: should identify components with depth > 10 as high-risk', () => {
      // Create a chain of 15 nodes
      const edges: Array<[string, string]> = [];
      for (let i = 0; i < 14; i++) {
        edges.push([`ApexClass:Node${i}`, `ApexClass:Node${i + 1}`]);
      }

      const graph = createGraph(edges);
      const calculator = new DependencyDepthCalculator(graph);
      const result = calculator.calculate();

      expect(result.highRiskComponents.length).to.be.greaterThan(0);

      // Node0 should have depth 14 (high risk)
      const node0 = result.depths.get('ApexClass:Node0');
      expect(node0?.depth).to.equal(14);
      expect(node0?.isHighRisk).to.be.true;
    });

    it('US-031-AC-2: should not mark depth <= 10 as high-risk', () => {
      // Create a chain of 8 nodes
      const edges: Array<[string, string]> = [];
      for (let i = 0; i < 7; i++) {
        edges.push([`ApexClass:Node${i}`, `ApexClass:Node${i + 1}`]);
      }

      const graph = createGraph(edges);
      const calculator = new DependencyDepthCalculator(graph);
      const result = calculator.calculate();

      const node0 = result.depths.get('ApexClass:Node0');
      expect(node0?.depth).to.equal(7);
      expect(node0?.isHighRisk).to.be.false;
    });

    it('US-031-AC-2: should allow custom high-risk threshold', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:D'],
      ]);

      const calculator = new DependencyDepthCalculator(graph, {
        highRiskThreshold: 2,
      });
      const result = calculator.calculate();

      expect(result.highRiskComponents.length).to.be.greaterThan(0);
      expect(result.depths.get('ApexClass:A')?.isHighRisk).to.be.true; // depth 3 > threshold 2
    });
  });

  describe('Circular Dependencies', () => {
    /**
     * @ac US-031-AC-5: Consider cycle depth as infinite
     */
    it('US-031-AC-5: should mark cyclic nodes with infinite depth', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:A'],
      ]);

      const cycles: CircularDependency[] = [
        {
          cycle: ['ApexClass:A', 'ApexClass:B'],
          severity: 'error',
          message: 'Cycle detected',
        },
      ];

      const calculator = new DependencyDepthCalculator(graph, {
        circularDependencies: cycles,
      });
      const result = calculator.calculate();

      expect(result.depths.get('ApexClass:A')?.depth).to.equal(Number.POSITIVE_INFINITY);
      expect(result.depths.get('ApexClass:B')?.depth).to.equal(Number.POSITIVE_INFINITY);
      expect(result.depths.get('ApexClass:A')?.isInCycle).to.be.true;
      expect(result.depths.get('ApexClass:B')?.isInCycle).to.be.true;
    });

    it('US-031-AC-5: should mark nodes depending on cyclic nodes as infinite', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:B'], // B↔C cycle
      ]);

      const cycles: CircularDependency[] = [
        {
          cycle: ['ApexClass:B', 'ApexClass:C'],
          severity: 'error',
          message: 'Cycle detected',
        },
      ];

      const calculator = new DependencyDepthCalculator(graph, {
        circularDependencies: cycles,
      });
      const result = calculator.calculate();

      expect(result.depths.get('ApexClass:A')?.depth).to.equal(Number.POSITIVE_INFINITY);
      expect(result.cyclicComponents).to.include.members(['ApexClass:B', 'ApexClass:C']);
    });

    it('US-031-AC-5: should mark all cyclic nodes as high-risk', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:A'],
      ]);

      const cycles: CircularDependency[] = [
        {
          cycle: ['ApexClass:A', 'ApexClass:B'],
          severity: 'error',
          message: 'Cycle detected',
        },
      ];

      const calculator = new DependencyDepthCalculator(graph, {
        circularDependencies: cycles,
      });
      const result = calculator.calculate();

      expect(result.highRiskComponents.length).to.equal(2);
      expect(result.highRiskComponents.every((c) => c.isInCycle)).to.be.true;
    });
  });

  describe('Critical Path', () => {
    /**
     * @ac US-031-AC-4: Highlight critical path components
     */
    it('US-031-AC-4: should identify critical path', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:D'],
      ]);

      const calculator = new DependencyDepthCalculator(graph);
      const result = calculator.calculate();

      expect(result.criticalPath).to.have.lengthOf(4);
      expect(result.criticalPath).to.include.members([
        'ApexClass:D',
        'ApexClass:C',
        'ApexClass:B',
        'ApexClass:A',
      ]);
    });

    it('US-031-AC-4: should mark critical path nodes', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
      ]);

      const calculator = new DependencyDepthCalculator(graph);
      const result = calculator.calculate();

      for (const nodeId of result.criticalPath) {
        const depth = result.depths.get(nodeId);
        expect(depth?.isCriticalPath).to.be.true;
      }
    });

    it('US-031-AC-4: should handle graph with multiple paths', () => {
      const graph = createGraph([
        // Path 1: A→B→C (depth 2)
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        // Path 2: A→D→E→F (depth 3) - Critical path
        ['ApexClass:A', 'ApexClass:D'],
        ['ApexClass:D', 'ApexClass:E'],
        ['ApexClass:E', 'ApexClass:F'],
      ]);

      const calculator = new DependencyDepthCalculator(graph);
      const result = calculator.calculate();

      // Critical path should be the longer one
      expect(result.criticalPath).to.include('ApexClass:F');
      expect(result.maxDepth).to.equal(3);
    });
  });

  describe('Depth Distribution', () => {
    /**
     * @ac US-031-AC-3: Generate depth distribution report
     */
    it('US-031-AC-3: should generate depth distribution report', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:D'],
      ]);

      const calculator = new DependencyDepthCalculator(graph);
      const result = calculator.calculate();

      expect(result.distribution).to.exist;
      expect(result.distribution.length).to.be.greaterThan(0);
    });

    it('US-031-AC-3: should include count and percentage in distribution', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
      ]);

      const calculator = new DependencyDepthCalculator(graph);
      const result = calculator.calculate();

      for (const dist of result.distribution) {
        expect(dist.count).to.be.a('number');
        expect(dist.percentage).to.be.a('number');
        expect(dist.depthRange).to.be.a('string');
        expect(dist.components).to.be.an('array');
      }
    });

    it('US-031-AC-3: should categorize components correctly', () => {
      const edges: Array<[string, string]> = [];

      // Create components at different depths
      edges.push(['ApexClass:Shallow', 'ApexClass:Leaf1']); // depth 1

      for (let i = 0; i < 15; i++) {
        edges.push([`ApexClass:Deep${i}`, `ApexClass:Deep${i + 1}`]);
      }

      const graph = createGraph(edges);
      const calculator = new DependencyDepthCalculator(graph);
      const result = calculator.calculate();

      // Should have components in multiple ranges
      expect(result.distribution.some((d) => d.depthRange === '0-5')).to.be.true;
      expect(result.distribution.some((d) => d.depthRange === '11-20')).to.be.true;
    });
  });

  describe('Statistics', () => {
    it('should calculate max depth correctly', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:D'],
      ]);

      const calculator = new DependencyDepthCalculator(graph);
      const result = calculator.calculate();

      expect(result.maxDepth).to.equal(3);
    });

    it('should calculate average depth correctly', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:C', 'ApexClass:D'],
      ]);

      const calculator = new DependencyDepthCalculator(graph);
      const result = calculator.calculate();

      // A=1, B=0, C=1, D=0 -> avg = 0.5
      expect(result.averageDepth).to.be.closeTo(0.5, 0.1);
    });

    it('should exclude cyclic nodes from average', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:A'],
        ['ApexClass:C', 'ApexClass:D'],
      ]);

      const cycles: CircularDependency[] = [
        {
          cycle: ['ApexClass:A', 'ApexClass:B'],
          severity: 'error',
          message: 'Cycle',
        },
      ];

      const calculator = new DependencyDepthCalculator(graph, {
        circularDependencies: cycles,
      });
      const result = calculator.calculate();

      // Average should only consider C and D
      expect(result.averageDepth).to.be.lessThan(2);
    });
  });

  describe('getDepth', () => {
    it('should get depth for specific component', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
      ]);

      const calculator = new DependencyDepthCalculator(graph);
      const depth = calculator.getDepth('ApexClass:A');

      expect(depth).to.exist;
      expect(depth?.depth).to.equal(2);
    });

    it('should return undefined for non-existent node', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
      ]);

      const calculator = new DependencyDepthCalculator(graph);
      const depth = calculator.getDepth('ApexClass:NonExistent');

      expect(depth).to.be.undefined;
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty graph', () => {
      const graph: DependencyGraph = new Map();

      const calculator = new DependencyDepthCalculator(graph);
      const result = calculator.calculate();

      expect(result.depths.size).to.equal(0);
      expect(result.maxDepth).to.equal(0);
      expect(result.averageDepth).to.equal(0);
      expect(result.highRiskComponents).to.have.lengthOf(0);
      expect(result.criticalPath).to.have.lengthOf(0);
    });

    it('should handle isolated nodes', () => {
      const graph: DependencyGraph = new Map();
      graph.set('ApexClass:A', new Set());
      graph.set('ApexClass:B', new Set());

      const calculator = new DependencyDepthCalculator(graph);
      const result = calculator.calculate();

      expect(result.depths.get('ApexClass:A')?.depth).to.equal(0);
      expect(result.depths.get('ApexClass:B')?.depth).to.equal(0);
      expect(result.depths.get('ApexClass:A')?.isLeaf).to.be.true;
      expect(result.depths.get('ApexClass:B')?.isLeaf).to.be.true;
    });

    it('should handle complex branching', () => {
      const graph = createGraph([
        ['ApexClass:Root', 'ApexClass:A'],
        ['ApexClass:Root', 'ApexClass:B'],
        ['ApexClass:A', 'ApexClass:C'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:Leaf'],
      ]);

      const calculator = new DependencyDepthCalculator(graph);
      const result = calculator.calculate();

      expect(result.depths.get('ApexClass:Leaf')?.depth).to.equal(0);
      expect(result.depths.get('ApexClass:C')?.depth).to.equal(1);
      expect(result.depths.get('ApexClass:A')?.depth).to.equal(2);
      expect(result.depths.get('ApexClass:B')?.depth).to.equal(2);
      expect(result.depths.get('ApexClass:Root')?.depth).to.equal(3);
    });
  });

  describe('Performance', () => {
    it('should handle large graphs efficiently', function () {
      this.timeout(5000);

      // Create a deep chain
      const edges: Array<[string, string]> = [];
      for (let i = 0; i < 1000; i++) {
        edges.push([`ApexClass:Node${i}`, `ApexClass:Node${i + 1}`]);
      }

      const graph = createGraph(edges);
      const startTime = Date.now();

      const calculator = new DependencyDepthCalculator(graph);
      const result = calculator.calculate();

      const duration = Date.now() - startTime;

      expect(result.depths.size).to.equal(1001);
      expect(result.maxDepth).to.equal(1000);
      expect(duration).to.be.lessThan(1000); // Should complete in < 1 second
    });
  });

  describe('Path Tracking', () => {
    it('should track path to leaf for each component', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
      ]);

      const calculator = new DependencyDepthCalculator(graph);
      const result = calculator.calculate();

      const pathA = result.depths.get('ApexClass:A')?.pathToLeaf;
      expect(pathA).to.exist;
      expect(pathA).to.include('ApexClass:C'); // Should include leaf
    });
  });
});

