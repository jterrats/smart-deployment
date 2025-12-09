/**
 * Unit tests for Dependency Impact Analyzer
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { DependencyImpactAnalyzer } from '../../../src/dependencies/dependency-impact-analyzer.js';
import type { DependencyGraph } from '../../../src/types/dependency.js';

describe('DependencyImpactAnalyzer', () => {
  /**
   * Helper to create dependency graph and reverse graph
   */
  function createGraphs(edges: Array<[string, string]>): {
    graph: DependencyGraph;
    reverseGraph: DependencyGraph;
  } {
    const graph: DependencyGraph = new Map();
    const reverseGraph: DependencyGraph = new Map();

    // Initialize all nodes
    const allNodes = new Set<string>();
    for (const [from, to] of edges) {
      allNodes.add(from);
      allNodes.add(to);
    }

    for (const node of allNodes) {
      graph.set(node, new Set());
      reverseGraph.set(node, new Set());
    }

    // Add edges
    for (const [from, to] of edges) {
      graph.get(from)!.add(to);
      reverseGraph.get(to)!.add(from);
    }

    return { graph, reverseGraph };
  }

  describe('Finding Dependents', () => {
    /**
     * @ac US-032-AC-1: Given a component, find all dependents
     */
    it('US-032-AC-1: should find direct dependents', () => {
      const { graph, reverseGraph } = createGraphs([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:C', 'ApexClass:B'],
      ]);

      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph);
      const result = analyzer.analyze(['ApexClass:B']);

      expect(result.impacts.get('ApexClass:B')?.directDependents).to.include.members([
        'ApexClass:A',
        'ApexClass:C',
      ]);
    });

    it('US-032-AC-1: should find transitive dependents', () => {
      const { graph, reverseGraph } = createGraphs([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:D'],
      ]);

      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph);
      const result = analyzer.analyze(['ApexClass:D']);

      // D affects C, B, and A (transitive)
      expect(result.totalAffected).to.be.greaterThanOrEqual(3);
    });

    it('US-032-AC-1: should handle components with no dependents', () => {
      const { graph, reverseGraph } = createGraphs([
        ['ApexClass:A', 'ApexClass:B'],
      ]);

      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph);
      const result = analyzer.analyze(['ApexClass:A']);

      expect(result.impacts.get('ApexClass:A')?.directDependents).to.have.lengthOf(0);
      expect(result.totalAffected).to.equal(1); // Only A itself
    });
  });

  describe('Impact Radius', () => {
    /**
     * @ac US-032-AC-2: Calculate impact radius
     */
    it('US-032-AC-2: should calculate impact radius correctly', () => {
      const { graph, reverseGraph } = createGraphs([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:D'],
      ]);

      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph);
      const impact = analyzer.getImpact('ApexClass:D');

      expect(impact.impactRadius).to.equal(3); // D → C → B → A
    });

    it('US-032-AC-2: should handle radius of 0 for leaf components', () => {
      const { graph, reverseGraph } = createGraphs([
        ['ApexClass:A', 'ApexClass:B'],
      ]);

      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph);
      const impact = analyzer.getImpact('ApexClass:A');

      expect(impact.impactRadius).to.equal(0);
    });

    it('US-032-AC-2: should respect maxDepth option', () => {
      const { graph, reverseGraph } = createGraphs([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:D'],
        ['ApexClass:D', 'ApexClass:E'],
      ]);

      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph, {
        maxDepth: 2,
      });
      const impact = analyzer.getImpact('ApexClass:E');

      // Should only traverse 2 levels
      expect(impact.impactRadius).to.be.lessThanOrEqual(2);
    });
  });

  describe('Critical Components', () => {
    /**
     * @ac US-032-AC-3: Identify critical components
     */
    it('US-032-AC-3: should identify critical components', () => {
      const edges: Array<[string, string]> = [];
      
      // Create a component with 15 dependents
      for (let i = 0; i < 15; i++) {
        edges.push([`ApexClass:Dependent${i}`, 'ApexClass:Core']);
      }

      const { graph, reverseGraph } = createGraphs(edges);
      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph, {
        criticalThreshold: 10,
      });

      const critical = analyzer.getCriticalComponents();

      expect(critical).to.include('ApexClass:Core');
    });

    it('US-032-AC-3: should mark components as critical in impact', () => {
      const edges: Array<[string, string]> = [];
      
      for (let i = 0; i < 12; i++) {
        edges.push([`ApexClass:User${i}`, 'ApexClass:Service']);
      }

      const { graph, reverseGraph } = createGraphs(edges);
      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph, {
        criticalThreshold: 10,
      });

      const impact = analyzer.getImpact('ApexClass:Service');

      expect(impact.isCritical).to.be.true;
    });

    it('US-032-AC-3: should sort critical components by dependent count', () => {
      const edges: Array<[string, string]> = [];
      
      // Component A: 15 dependents
      for (let i = 0; i < 15; i++) {
        edges.push([`ApexClass:UserA${i}`, 'ApexClass:ServiceA']);
      }
      
      // Component B: 20 dependents
      for (let i = 0; i < 20; i++) {
        edges.push([`ApexClass:UserB${i}`, 'ApexClass:ServiceB']);
      }

      const { graph, reverseGraph } = createGraphs(edges);
      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph, {
        criticalThreshold: 10,
      });

      const critical = analyzer.getCriticalComponents();

      expect(critical[0]).to.equal('ApexClass:ServiceB'); // More dependents first
      expect(critical[1]).to.equal('ApexClass:ServiceA');
    });
  });

  describe('Impact Report', () => {
    /**
     * @ac US-032-AC-4: Generate impact report
     */
    it('US-032-AC-4: should generate complete impact report', () => {
      const { graph, reverseGraph } = createGraphs([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:C', 'ApexClass:B'],
      ]);

      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph);
      const result = analyzer.analyze(['ApexClass:B']);

      expect(result.changedComponents).to.include('ApexClass:B');
      expect(result.impacts.has('ApexClass:B')).to.be.true;
      expect(result.totalAffected).to.be.a('number');
      expect(result.overallImpactLevel).to.be.oneOf(['minimal', 'low', 'medium', 'high', 'critical']);
      expect(result.criticalComponents).to.be.an('array');
      expect(result.testScope).to.exist;
    });

    it('US-032-AC-4: should calculate overall impact level', () => {
      const edges: Array<[string, string]> = [];
      
      // Create high-impact scenario
      for (let i = 0; i < 30; i++) {
        edges.push([`ApexClass:User${i}`, 'ApexClass:Core']);
      }

      const { graph, reverseGraph } = createGraphs(edges);
      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph);
      const result = analyzer.analyze(['ApexClass:Core']);

      expect(result.overallImpactLevel).to.be.oneOf(['high', 'critical']);
    });

    it('US-032-AC-4: should handle multiple changed components', () => {
      const { graph, reverseGraph } = createGraphs([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:C', 'ApexClass:D'],
      ]);

      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph);
      const result = analyzer.analyze(['ApexClass:B', 'ApexClass:D']);

      expect(result.changedComponents).to.have.lengthOf(2);
      expect(result.impacts.size).to.equal(2);
    });
  });

  describe('Test Scope', () => {
    /**
     * @ac US-032-AC-5: Suggest test scope based on impact
     */
    it('US-032-AC-5: should suggest test scope', () => {
      const { graph, reverseGraph } = createGraphs([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:ATest', 'ApexClass:A'],
      ]);

      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph);
      const result = analyzer.analyze(['ApexClass:B']);

      expect(result.testScope).to.exist;
      expect(result.testScope.requiredTests).to.be.an('array');
      expect(result.testScope.recommendedTests).to.be.an('array');
      expect(result.testScope.optionalTests).to.be.an('array');
      expect(result.testScope.estimatedTestCount).to.be.a('number');
      expect(result.testScope.priority).to.be.oneOf(['low', 'medium', 'high']);
    });

    it('US-032-AC-5: should prioritize tests based on impact', () => {
      const edges: Array<[string, string]> = [];
      
      // High-impact component
      for (let i = 0; i < 20; i++) {
        edges.push([`ApexClass:User${i}`, 'ApexClass:Core']);
      }
      edges.push(['ApexClass:CoreTest', 'ApexClass:Core']);

      const { graph, reverseGraph } = createGraphs(edges);
      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph);
      const result = analyzer.analyze(['ApexClass:Core']);

      expect(result.testScope.priority).to.equal('high');
      expect(result.testScope.requiredTests.length).to.be.greaterThan(0);
    });

    it('US-032-AC-5: should find associated test classes', () => {
      const { graph, reverseGraph } = createGraphs([
        ['ApexClass:A', 'ApexClass:Service'],
        ['ApexClass:ServiceTest', 'ApexClass:Service'],
      ]);

      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph);
      const result = analyzer.analyze(['ApexClass:Service']);

      // Should suggest ServiceTest
      const allTests = [
        ...result.testScope.requiredTests,
        ...result.testScope.recommendedTests,
        ...result.testScope.optionalTests,
      ];
      expect(allTests).to.include('ApexClass:ServiceTest');
    });

    it('US-032-AC-5: should exclude tests when includeTests=false', () => {
      const { graph, reverseGraph } = createGraphs([
        ['ApexClass:ServiceTest', 'ApexClass:Service'],
        ['ApexClass:A', 'ApexClass:Service'],
      ]);

      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph, {
        includeTests: false,
      });
      const result = analyzer.analyze(['ApexClass:Service']);

      // ServiceTest should not be in affected count
      expect(result.totalAffected).to.equal(2); // Service + A only
    });
  });

  describe('Risk Score', () => {
    it('should calculate risk score', () => {
      const edges: Array<[string, string]> = [];
      
      for (let i = 0; i < 5; i++) {
        edges.push([`ApexClass:User${i}`, 'ApexClass:Service']);
      }

      const { graph, reverseGraph } = createGraphs(edges);
      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph);
      const impact = analyzer.getImpact('ApexClass:Service');

      expect(impact.riskScore).to.be.a('number');
      expect(impact.riskScore).to.be.within(0, 100);
    });

    it('should assign impact level based on risk score', () => {
      const { graph, reverseGraph } = createGraphs([
        ['ApexClass:A', 'ApexClass:B'],
      ]);

      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph);
      const impact = analyzer.getImpact('ApexClass:B');

      expect(impact.impactLevel).to.be.oneOf(['minimal', 'low', 'medium', 'high', 'critical']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty graph', () => {
      const graph: DependencyGraph = new Map();
      const reverseGraph: DependencyGraph = new Map();

      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph);
      const result = analyzer.analyze([]);

      expect(result.totalAffected).to.equal(0);
      expect(result.criticalComponents).to.have.lengthOf(0);
    });

    it('should handle non-existent component', () => {
      const { graph, reverseGraph } = createGraphs([
        ['ApexClass:A', 'ApexClass:B'],
      ]);

      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph);
      const impact = analyzer.getImpact('ApexClass:NonExistent');

      expect(impact.directDependents).to.have.lengthOf(0);
      expect(impact.totalAffected).to.equal(0);
    });

    it('should handle circular dependencies', () => {
      const { graph, reverseGraph } = createGraphs([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:A'],
      ]);

      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph);
      
      // Should not hang or throw
      expect(() => analyzer.analyze(['ApexClass:A'])).to.not.throw();
    });

    it('should handle isolated components', () => {
      const graph: DependencyGraph = new Map();
      const reverseGraph: DependencyGraph = new Map();
      
      graph.set('ApexClass:Isolated', new Set());
      reverseGraph.set('ApexClass:Isolated', new Set());

      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph);
      const impact = analyzer.getImpact('ApexClass:Isolated');

      expect(impact.directDependents).to.have.lengthOf(0);
      expect(impact.impactLevel).to.equal('minimal');
    });
  });

  describe('Performance', () => {
    it('should handle large graphs efficiently', function () {
      this.timeout(5000);

      const edges: Array<[string, string]> = [];
      
      // Create a large graph
      for (let i = 0; i < 500; i++) {
        edges.push([`ApexClass:Node${i}`, `ApexClass:Node${i + 1}`]);
      }

      const { graph, reverseGraph } = createGraphs(edges);
      const startTime = Date.now();

      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph);
      const result = analyzer.analyze(['ApexClass:Node500']);

      const duration = Date.now() - startTime;

      expect(result.totalAffected).to.be.greaterThan(0);
      expect(duration).to.be.lessThan(1000); // Should complete in < 1 second
    });
  });

  describe('Test Class Detection', () => {
    it('should detect test classes', () => {
      const { graph, reverseGraph } = createGraphs([
        ['ApexClass:ServiceTest', 'ApexClass:Service'],
        ['ApexClass:TestService', 'ApexClass:Service'],
      ]);

      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph);
      const result = analyzer.analyze(['ApexClass:Service']);

      const allTests = [
        ...result.testScope.requiredTests,
        ...result.testScope.recommendedTests,
      ];

      expect(allTests.length).to.be.greaterThan(0);
    });

    it('should find test classes with various naming patterns', () => {
      const { graph, reverseGraph } = createGraphs([
        ['ApexClass:ServiceTest', 'ApexClass:Service'],
        ['ApexClass:Service_Test', 'ApexClass:Service'],
        ['ApexClass:ServiceTests', 'ApexClass:Service'],
      ]);

      const analyzer = new DependencyImpactAnalyzer(graph, reverseGraph);
      const result = analyzer.analyze(['ApexClass:Service']);

      const allTests = [
        ...result.testScope.requiredTests,
        ...result.testScope.recommendedTests,
        ...result.testScope.optionalTests,
      ];

      expect(allTests).to.include.members([
        'ApexClass:ServiceTest',
        'ApexClass:Service_Test',
        'ApexClass:ServiceTests',
      ]);
    });
  });
});

