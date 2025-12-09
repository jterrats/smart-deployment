/**
 * Unit tests for Circular Dependency Detector
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { CircularDependencyDetector } from '../../../src/dependencies/circular-dependency-detector.js';
import type { DependencyGraph } from '../../../src/types/dependency.js';

describe('CircularDependencyDetector', () => {
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

  describe('Simple Cycles', () => {
    /**
     * @ac US-030-AC-1: Detect simple cycles (A→B→A)
     */
    it('US-030-AC-1: should detect simple 2-node cycle (A→B→A)', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:A'],
      ]);

      const detector = new CircularDependencyDetector(graph);
      const cycles = detector.detectCycles();

      expect(cycles).to.have.lengthOf(1);
      expect(cycles[0].cycle).to.have.lengthOf(2);
      expect(cycles[0].cycle).to.include('ApexClass:A');
      expect(cycles[0].cycle).to.include('ApexClass:B');
    });

    it('US-030-AC-1: should detect self-loop (A→A)', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:A'],
      ]);

      const detector = new CircularDependencyDetector(graph);
      const cycles = detector.detectCycles();

      expect(cycles).to.have.lengthOf(1);
      expect(cycles[0].cycle).to.have.lengthOf(1);
      expect(cycles[0].cycle[0]).to.equal('ApexClass:A');
    });
  });

  describe('Complex Cycles', () => {
    /**
     * @ac US-030-AC-2: Detect complex cycles (A→B→C→A)
     */
    it('US-030-AC-2: should detect 3-node cycle (A→B→C→A)', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:A'],
      ]);

      const detector = new CircularDependencyDetector(graph);
      const cycles = detector.detectCycles();

      expect(cycles).to.have.lengthOf(1);
      expect(cycles[0].cycle).to.have.lengthOf(3);
    });

    it('US-030-AC-2: should detect 4-node cycle (A→B→C→D→A)', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:D'],
        ['ApexClass:D', 'ApexClass:A'],
      ]);

      const detector = new CircularDependencyDetector(graph);
      const cycles = detector.detectCycles();

      expect(cycles).to.have.lengthOf(1);
      expect(cycles[0].cycle).to.have.lengthOf(4);
    });

    it('US-030-AC-2: should detect cycle in complex graph', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:D'],
        ['ApexClass:D', 'ApexClass:B'], // Creates cycle B→C→D→B
        ['ApexClass:D', 'ApexClass:E'],
      ]);

      const detector = new CircularDependencyDetector(graph);
      const cycles = detector.detectCycles();

      expect(cycles).to.have.lengthOf(1);
      expect(cycles[0].cycle).to.include('ApexClass:B');
      expect(cycles[0].cycle).to.include('ApexClass:C');
      expect(cycles[0].cycle).to.include('ApexClass:D');
    });
  });

  describe('Multiple Cycles', () => {
    /**
     * @ac US-030-AC-6: Handle multiple separate cycles
     */
    it('US-030-AC-6: should detect multiple independent cycles', () => {
      const graph = createGraph([
        // Cycle 1: A→B→A
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:A'],
        // Cycle 2: C→D→C
        ['ApexClass:C', 'ApexClass:D'],
        ['ApexClass:D', 'ApexClass:C'],
      ]);

      const detector = new CircularDependencyDetector(graph);
      const cycles = detector.detectCycles();

      expect(cycles).to.have.lengthOf(2);
    });

    it('US-030-AC-6: should detect overlapping cycles', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:A'], // Cycle 1: A→B→C→A
        ['ApexClass:B', 'ApexClass:D'],
        ['ApexClass:D', 'ApexClass:B'], // Cycle 2: B→D→B
      ]);

      const detector = new CircularDependencyDetector(graph);
      const cycles = detector.detectCycles();

      expect(cycles.length).to.be.greaterThanOrEqual(2);
    });
  });

  describe('No Cycles', () => {
    it('should return empty array for acyclic graph', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:D'],
      ]);

      const detector = new CircularDependencyDetector(graph);
      const cycles = detector.detectCycles();

      expect(cycles).to.have.lengthOf(0);
    });

    it('should return empty array for empty graph', () => {
      const graph: DependencyGraph = new Map();

      const detector = new CircularDependencyDetector(graph);
      const cycles = detector.detectCycles();

      expect(cycles).to.have.lengthOf(0);
    });
  });

  describe('Cycle Information', () => {
    /**
     * @ac US-030-AC-3: Report all nodes in cycle
     */
    it('US-030-AC-3: should report all nodes in cycle', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:A'],
      ]);

      const detector = new CircularDependencyDetector(graph);
      const cycles = detector.detectCycles();

      expect(cycles).to.have.lengthOf(1);
      expect(cycles[0].cycle).to.have.lengthOf(3);
      expect(cycles[0].cycle).to.include.members([
        'ApexClass:A',
        'ApexClass:B',
        'ApexClass:C',
      ]);
    });

    it('US-030-AC-3: should include cycle ID', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:A'],
      ]);

      const detector = new CircularDependencyDetector(graph);
      const cycles = detector.detectCycles();

      expect(cycles[0].id).to.exist;
      expect(cycles[0].id).to.be.a('string');
    });

    it('US-030-AC-3: should include descriptive message', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:A'],
      ]);

      const detector = new CircularDependencyDetector(graph);
      const cycles = detector.detectCycles();

      expect(cycles[0].message).to.exist;
      expect(cycles[0].message).to.include('Circular dependency');
    });

    it('US-030-AC-3: should set severity based on cycle size', () => {
      const simpleGraph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:A'],
      ]);

      const complexGraph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:D'],
        ['ApexClass:D', 'ApexClass:A'],
      ]);

      const simpleDetector = new CircularDependencyDetector(simpleGraph);
      const complexDetector = new CircularDependencyDetector(complexGraph);

      const simpleCycles = simpleDetector.detectCycles();
      const complexCycles = complexDetector.detectCycles();

      expect(simpleCycles[0].severity).to.equal('error');
      expect(complexCycles[0].severity).to.equal('warning');
    });
  });

  describe('Break Suggestions', () => {
    /**
     * @ac US-030-AC-4: Suggest where to break cycle
     */
    it('US-030-AC-4: should generate break suggestions', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:A'],
      ]);

      const detector = new CircularDependencyDetector(graph, {
        generateSuggestions: true,
      });
      const cycles = detector.detectCycles();

      expect(cycles[0].breakSuggestions).to.exist;
      expect(cycles[0].breakSuggestions).to.have.lengthOf.greaterThan(0);
    });

    it('US-030-AC-4: should prioritize test class breaks', () => {
      const graph = createGraph([
        ['ApexClass:AccountService', 'ApexClass:AccountServiceTest'],
        ['ApexClass:AccountServiceTest', 'ApexClass:AccountService'],
      ]);

      const detector = new CircularDependencyDetector(graph);
      const cycles = detector.detectCycles();

      expect(cycles[0].breakSuggestions[0].priority).to.be.greaterThan(70);
      expect(cycles[0].breakSuggestions[0].reason).to.include('test');
    });

    it('US-030-AC-4: should include reason for each suggestion', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:A'],
      ]);

      const detector = new CircularDependencyDetector(graph);
      const cycles = detector.detectCycles();

      for (const suggestion of cycles[0].breakSuggestions) {
        expect(suggestion.reason).to.exist;
        expect(suggestion.reason).to.be.a('string');
        expect(suggestion.reason.length).to.be.greaterThan(0);
      }
    });

    it('US-030-AC-4: should sort suggestions by priority', () => {
      const graph = createGraph([
        ['ApexClass:CoreService', 'ApexClass:Utils'],
        ['ApexClass:Utils', 'ApexClass:CoreService'],
      ]);

      const detector = new CircularDependencyDetector(graph);
      const cycles = detector.detectCycles();

      const suggestions = cycles[0].breakSuggestions;
      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i - 1].priority).to.be.greaterThanOrEqual(suggestions[i].priority);
      }
    });
  });

  describe('User-Defined Breaks', () => {
    /**
     * @ac US-030-AC-5: Support user-defined cycle breaks
     */
    it('US-030-AC-5: should ignore user-defined edges', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:A'],
      ]);

      const detector = new CircularDependencyDetector(graph, {
        ignoreEdges: [{ from: 'ApexClass:B', to: 'ApexClass:A' }],
      });
      const cycles = detector.detectCycles();

      expect(cycles).to.have.lengthOf(0);
    });

    it('US-030-AC-5: should break specific cycle with ignore edge', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:A'],
      ]);

      const detector = new CircularDependencyDetector(graph, {
        ignoreEdges: [{ from: 'ApexClass:C', to: 'ApexClass:A' }],
      });
      const cycles = detector.detectCycles();

      expect(cycles).to.have.lengthOf(0);
    });

    it('US-030-AC-5: should handle multiple ignore edges', () => {
      const graph = createGraph([
        // Cycle 1
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:A'],
        // Cycle 2
        ['ApexClass:C', 'ApexClass:D'],
        ['ApexClass:D', 'ApexClass:C'],
      ]);

      const detector = new CircularDependencyDetector(graph, {
        ignoreEdges: [
          { from: 'ApexClass:B', to: 'ApexClass:A' },
          { from: 'ApexClass:D', to: 'ApexClass:C' },
        ],
      });
      const cycles = detector.detectCycles();

      expect(cycles).to.have.lengthOf(0);
    });
  });

  describe('detectCyclesFromNode', () => {
    it('should detect cycles starting from specific node', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:A'],
      ]);

      const detector = new CircularDependencyDetector(graph);
      const cycles = detector.detectCyclesFromNode('ApexClass:A');

      expect(cycles).to.have.lengthOf(1);
      expect(cycles[0].cycle).to.include('ApexClass:A');
    });

    it('should return empty if no cycles from node', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
      ]);

      const detector = new CircularDependencyDetector(graph);
      const cycles = detector.detectCyclesFromNode('ApexClass:A');

      expect(cycles).to.have.lengthOf(0);
    });
  });

  describe('wouldCreateCycle', () => {
    it('should detect if adding edge would create cycle', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
      ]);

      const detector = new CircularDependencyDetector(graph);
      
      // Adding C→A would create cycle
      const wouldCreate = detector.wouldCreateCycle('ApexClass:C', 'ApexClass:A');
      expect(wouldCreate).to.be.true;
    });

    it('should return false if edge would not create cycle', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
      ]);

      const detector = new CircularDependencyDetector(graph);
      
      // Adding C→D would not create cycle
      const wouldCreate = detector.wouldCreateCycle('ApexClass:C', 'ApexClass:D');
      expect(wouldCreate).to.be.false;
    });
  });

  describe('Performance', () => {
    it('should handle large graphs efficiently', function () {
      this.timeout(5000);

      // Create a large acyclic graph
      const edges: Array<[string, string]> = [];
      for (let i = 0; i < 500; i++) {
        edges.push([`ApexClass:Node${i}`, `ApexClass:Node${i + 1}`]);
      }

      const graph = createGraph(edges);
      const startTime = Date.now();

      const detector = new CircularDependencyDetector(graph);
      const cycles = detector.detectCycles();

      const duration = Date.now() - startTime;

      expect(cycles).to.have.lengthOf(0);
      expect(duration).to.be.lessThan(1000); // Should complete in < 1 second
    });

    it('should respect max depth limit', () => {
      const edges: Array<[string, string]> = [];
      for (let i = 0; i < 200; i++) {
        edges.push([`ApexClass:Node${i}`, `ApexClass:Node${i + 1}`]);
      }

      const graph = createGraph(edges);

      const detector = new CircularDependencyDetector(graph, {
        maxDepth: 50,
      });

      // Should not throw or hang
      expect(() => detector.detectCycles()).to.not.throw();
    });
  });

  describe('getStats', () => {
    it('should return graph statistics', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:D'],
      ]);

      const detector = new CircularDependencyDetector(graph, {
        ignoreEdges: [{ from: 'ApexClass:B', to: 'ApexClass:C' }],
      });

      const stats = detector.getStats();

      expect(stats.totalNodes).to.equal(4);
      expect(stats.totalEdges).to.equal(3);
      expect(stats.ignoredEdges).to.equal(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle graph with isolated nodes', () => {
      const graph: DependencyGraph = new Map();
      graph.set('ApexClass:A', new Set());
      graph.set('ApexClass:B', new Set());

      const detector = new CircularDependencyDetector(graph);
      const cycles = detector.detectCycles();

      expect(cycles).to.have.lengthOf(0);
    });

    it('should handle duplicate cycle detection attempts', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:A'],
      ]);

      const detector = new CircularDependencyDetector(graph);
      
      // Run detection multiple times
      const cycles1 = detector.detectCycles();
      const cycles2 = detector.detectCycles();

      expect(cycles1).to.deep.equal(cycles2);
    });
  });
});
