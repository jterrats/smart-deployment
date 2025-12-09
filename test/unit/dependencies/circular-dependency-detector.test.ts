/**
 * Unit tests for Circular Dependency Detector
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { CircularDependencyDetector } from '../../../src/dependencies/circular-dependency-detector.js';
import type { DependencyGraph, NodeId } from '../../../src/types/dependency.js';

describe('CircularDependencyDetector', () => {
  /**
   * Helper to create a dependency graph from edges
   */
  function createGraph(edges: Array<[string, string]>): DependencyGraph {
    const graph = new Map<NodeId, Set<NodeId>>();

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

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const detector = new CircularDependencyDetector();
      expect(detector).to.exist;
    });

    it('should initialize with custom options', () => {
      const detector = new CircularDependencyDetector({
        maxCycles: 50,
        includeSuggestions: false,
      });
      expect(detector).to.exist;
    });
  });

  describe('Simple Cycles', () => {
    /**
     * @ac US-030-AC-1: Detect simple cycles (A→B→A)
     */
    it('US-030-AC-1: should detect simple cycle A→B→A', () => {
      const graph = createGraph([
        ['A', 'B'],
        ['B', 'A'],
      ]);

      const detector = new CircularDependencyDetector();
      const result = detector.detectCycles(graph);

      expect(result.totalCycles).to.equal(1);
      expect(result.cycles[0].length).to.equal(2);
      expect(result.cycles[0].cycle.severity).to.equal('warning');
    });

    it('US-030-AC-1: should detect multiple simple cycles', () => {
      const graph = createGraph([
        ['A', 'B'],
        ['B', 'A'],
        ['C', 'D'],
        ['D', 'C'],
      ]);

      const detector = new CircularDependencyDetector();
      const result = detector.detectCycles(graph);

      expect(result.totalCycles).to.be.greaterThanOrEqual(2);
      expect(result.stats.simpleCycles).to.be.greaterThanOrEqual(2);
    });
  });

  describe('Complex Cycles', () => {
    /**
     * @ac US-030-AC-2: Detect complex cycles (A→B→C→A)
     */
    it('US-030-AC-2: should detect complex cycle A→B→C→A', () => {
      const graph = createGraph([
        ['A', 'B'],
        ['B', 'C'],
        ['C', 'A'],
      ]);

      const detector = new CircularDependencyDetector();
      const result = detector.detectCycles(graph);

      expect(result.totalCycles).to.equal(1);
      expect(result.cycles[0].length).to.equal(3);
      expect(result.cycles[0].cycle.severity).to.equal('error');
    });

    it('US-030-AC-2: should detect longer cycles', () => {
      const graph = createGraph([
        ['A', 'B'],
        ['B', 'C'],
        ['C', 'D'],
        ['D', 'E'],
        ['E', 'A'],
      ]);

      const detector = new CircularDependencyDetector();
      const result = detector.detectCycles(graph);

      expect(result.totalCycles).to.equal(1);
      expect(result.cycles[0].length).to.equal(5);
      expect(result.stats.maxCycleLength).to.equal(5);
    });
  });

  describe('Report Cycle Nodes', () => {
    /**
     * @ac US-030-AC-3: Report all nodes in cycle
     */
    it('US-030-AC-3: should report all nodes in cycle', () => {
      const graph = createGraph([
        ['A', 'B'],
        ['B', 'C'],
        ['C', 'A'],
      ]);

      const detector = new CircularDependencyDetector();
      const result = detector.detectCycles(graph);

      const cycle = result.cycles[0];
      expect(cycle.nodes.size).to.equal(3);
      expect(cycle.nodes.has('A')).to.be.true;
      expect(cycle.nodes.has('B')).to.be.true;
      expect(cycle.nodes.has('C')).to.be.true;
    });

    it('US-030-AC-3: should track all cyclic nodes globally', () => {
      const graph = createGraph([
        ['A', 'B'],
        ['B', 'A'],
        ['C', 'D'],
        ['D', 'C'],
        ['E', 'F'], // Non-cyclic
      ]);

      const detector = new CircularDependencyDetector();
      const result = detector.detectCycles(graph);

      expect(result.cyclicNodes.size).to.equal(4); // A, B, C, D
      expect(result.cyclicNodes.has('A')).to.be.true;
      expect(result.cyclicNodes.has('B')).to.be.true;
      expect(result.cyclicNodes.has('C')).to.be.true;
      expect(result.cyclicNodes.has('D')).to.be.true;
      expect(result.cyclicNodes.has('E')).to.be.false;
      expect(result.cyclicNodes.has('F')).to.be.false;
    });
  });

  describe('Break Suggestions', () => {
    /**
     * @ac US-030-AC-4: Suggest where to break cycle
     */
    it('US-030-AC-4: should suggest break points for simple cycle', () => {
      const graph = createGraph([
        ['A', 'B'],
        ['B', 'A'],
      ]);

      const detector = new CircularDependencyDetector();
      const result = detector.detectCycles(graph);

      const cycle = result.cycles[0];
      expect(cycle.breakSuggestions).to.exist;
      expect(cycle.breakSuggestions.length).to.be.greaterThan(0);
      
      // Should have a suggestion for each edge in the cycle
      expect(cycle.breakSuggestions.length).to.equal(2);
      
      // Suggestions should be sorted by priority
      const priorities = cycle.breakSuggestions.map((s) => s.priority);
      for (let i = 0; i < priorities.length - 1; i++) {
        expect(priorities[i]).to.be.greaterThanOrEqual(priorities[i + 1]);
      }
    });

    it('US-030-AC-4: should suggest break points for complex cycle', () => {
      const graph = createGraph([
        ['A', 'B'],
        ['B', 'C'],
        ['C', 'A'],
      ]);

      const detector = new CircularDependencyDetector();
      const result = detector.detectCycles(graph);

      const cycle = result.cycles[0];
      expect(cycle.breakSuggestions.length).to.equal(3);
      
      // Each suggestion should have required fields
      for (const suggestion of cycle.breakSuggestions) {
        expect(suggestion.from).to.exist;
        expect(suggestion.to).to.exist;
        expect(suggestion.reason).to.exist;
        expect(suggestion.priority).to.be.a('number');
        expect(suggestion.priority).to.be.greaterThan(0);
      }
    });

    it('US-030-AC-4: should prioritize breaking test dependencies', () => {
      const graph = createGraph([
        ['AccountService', 'Logger'],
        ['Logger', 'AccountServiceTest'],
        ['AccountServiceTest', 'AccountService'],
      ]);

      const detector = new CircularDependencyDetector();
      const result = detector.detectCycles(graph);

      const cycle = result.cycles[0];
      const testBreak = cycle.breakSuggestions.find(
        (s) => s.from.includes('Test') || s.to.includes('Test')
      );
      
      expect(testBreak).to.exist;
      // Test dependencies should have higher priority
      expect(testBreak!.priority).to.be.greaterThan(50);
    });
  });

  describe('User-Defined Breaks', () => {
    /**
     * @ac US-030-AC-5: Support user-defined cycle breaks
     */
    it('US-030-AC-5: should apply user-defined breaks', () => {
      const graph = createGraph([
        ['A', 'B'],
        ['B', 'C'],
        ['C', 'A'],
      ]);

      const detector = new CircularDependencyDetector({
        userDefinedBreaks: [{ from: 'C', to: 'A' }],
      });

      const result = detector.detectCycles(graph);

      // Cycle should be broken
      expect(result.totalCycles).to.equal(0);
      expect(result.appliedBreaks.length).to.equal(1);
      expect(result.appliedBreaks[0].from).to.equal('C');
      expect(result.appliedBreaks[0].to).to.equal('A');
    });

    it('US-030-AC-5: should apply multiple user-defined breaks', () => {
      const graph = createGraph([
        ['A', 'B'],
        ['B', 'A'],
        ['C', 'D'],
        ['D', 'C'],
      ]);

      const detector = new CircularDependencyDetector({
        userDefinedBreaks: [
          { from: 'B', to: 'A' },
          { from: 'D', to: 'C' },
        ],
      });

      const result = detector.detectCycles(graph);

      expect(result.totalCycles).to.equal(0);
      expect(result.appliedBreaks.length).to.equal(2);
    });
  });

  describe('Multiple Cycles', () => {
    /**
     * @ac US-030-AC-6: Handle multiple separate cycles
     */
    it('US-030-AC-6: should handle multiple separate cycles', () => {
      const graph = createGraph([
        // Cycle 1: A→B→A
        ['A', 'B'],
        ['B', 'A'],
        // Cycle 2: C→D→E→C
        ['C', 'D'],
        ['D', 'E'],
        ['E', 'C'],
        // Cycle 3: F→G→F
        ['F', 'G'],
        ['G', 'F'],
      ]);

      const detector = new CircularDependencyDetector();
      const result = detector.detectCycles(graph);

      expect(result.totalCycles).to.be.greaterThanOrEqual(3);
      
      // Should track all unique cyclic nodes
      expect(result.cyclicNodes.size).to.be.greaterThanOrEqual(7); // A,B,C,D,E,F,G
    });

    it('US-030-AC-6: should respect maxCycles limit', () => {
      const graph = createGraph([
        ['A', 'B'],
        ['B', 'A'],
        ['C', 'D'],
        ['D', 'C'],
        ['E', 'F'],
        ['F', 'E'],
      ]);

      const detector = new CircularDependencyDetector({ maxCycles: 2 });
      const result = detector.detectCycles(graph);

      expect(result.cycles.length).to.be.lessThanOrEqual(2);
    });
  });

  describe('Statistics', () => {
    it('should calculate accurate statistics', () => {
      const graph = createGraph([
        ['A', 'B'],
        ['B', 'A'], // Simple cycle
        ['C', 'D'],
        ['D', 'E'],
        ['E', 'C'], // Complex cycle (length 3)
        ['F', 'G'],
        ['G', 'H'],
        ['H', 'I'],
        ['I', 'F'], // Complex cycle (length 4)
      ]);

      const detector = new CircularDependencyDetector();
      const result = detector.detectCycles(graph);

      expect(result.stats.simpleCycles).to.be.greaterThanOrEqual(1);
      expect(result.stats.complexCycles).to.be.greaterThanOrEqual(2);
      expect(result.stats.maxCycleLength).to.be.greaterThanOrEqual(4);
      expect(result.stats.avgCycleLength).to.be.greaterThan(0);
    });
  });

  describe('wouldCreateCycle', () => {
    it('should detect if adding an edge would create a cycle', () => {
      const graph = createGraph([
        ['A', 'B'],
        ['B', 'C'],
      ]);

      const detector = new CircularDependencyDetector();

      // Adding C→A would create cycle
      expect(detector.wouldCreateCycle(graph, 'C', 'A')).to.be.true;

      // Adding C→D would not create cycle
      expect(detector.wouldCreateCycle(graph, 'C', 'D')).to.be.false;
    });

    it('should handle self-loops', () => {
      const graph = createGraph([['A', 'B']]);

      const detector = new CircularDependencyDetector();

      // Adding A→A would create self-loop
      expect(detector.wouldCreateCycle(graph, 'A', 'A')).to.be.true;
    });
  });

  describe('No Cycles', () => {
    it('should return empty result for acyclic graph', () => {
      const graph = createGraph([
        ['A', 'B'],
        ['B', 'C'],
        ['C', 'D'],
      ]);

      const detector = new CircularDependencyDetector();
      const result = detector.detectCycles(graph);

      expect(result.totalCycles).to.equal(0);
      expect(result.cycles).to.be.empty;
      expect(result.cyclicNodes.size).to.equal(0);
    });

    it('should handle empty graph', () => {
      const graph = new Map<NodeId, Set<NodeId>>();

      const detector = new CircularDependencyDetector();
      const result = detector.detectCycles(graph);

      expect(result.totalCycles).to.equal(0);
      expect(result.cycles).to.be.empty;
    });
  });

  describe('Performance', () => {
    it('should handle large graphs efficiently', function () {
      this.timeout(5000);

      // Create a large graph with some cycles
      const edges: Array<[string, string]> = [];
      
      // Create a chain: 0→1→2→...→99
      for (let i = 0; i < 100; i++) {
        edges.push([`Node${i}`, `Node${i + 1}`]);
      }
      
      // Add a few cycles
      edges.push(['Node99', 'Node0']); // Big cycle
      edges.push(['Node50', 'Node48']); // Smaller cycle

      const graph = createGraph(edges);

      const startTime = Date.now();
      const detector = new CircularDependencyDetector();
      const result = detector.detectCycles(graph);
      const duration = Date.now() - startTime;

      expect(result.totalCycles).to.be.greaterThan(0);
      expect(duration).to.be.lessThan(1000); // Should complete in < 1 second
    });
  });

  describe('Edge Cases', () => {
    it('should handle disconnected graph components', () => {
      const graph = createGraph([
        ['A', 'B'],
        ['C', 'D'],
        ['E', 'F'],
      ]);

      const detector = new CircularDependencyDetector();
      const result = detector.detectCycles(graph);

      expect(result.totalCycles).to.equal(0);
    });

    it('should handle graph with no edges', () => {
      const graph = new Map<NodeId, Set<NodeId>>();
      graph.set('A', new Set());
      graph.set('B', new Set());

      const detector = new CircularDependencyDetector();
      const result = detector.detectCycles(graph);

      expect(result.totalCycles).to.equal(0);
    });
  });
});

