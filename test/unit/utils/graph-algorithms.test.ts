import { expect } from 'chai';
import {
  topologicalSort,
  detectCycles,
  calculateDepth,
  findPath,
  type DependencyGraph,
} from '../../../src/utils/graph-algorithms.js';

describe('Graph Algorithms', () => {
  describe('topologicalSort', () => {
    /**
     * @ac US-002-AC-1: topologicalSort() returns components in dependency order
     */
    it('should return nodes in dependency order for simple graph', () => {
      const dependencyGraph: DependencyGraph = new Map([
        ['ComponentA', { nodeId: 'ComponentA', dependencies: new Set() }],
        ['ComponentB', { nodeId: 'ComponentB', dependencies: new Set(['ComponentA']) }],
        ['ComponentC', { nodeId: 'ComponentC', dependencies: new Set(['ComponentB']) }],
      ]);

      const sortedNodes = topologicalSort(dependencyGraph);

      expect(sortedNodes).to.deep.equal(['ComponentA', 'ComponentB', 'ComponentC']);
    });

    it('should handle graph with multiple independent nodes', () => {
      const dependencyGraph: DependencyGraph = new Map([
        ['NodeA', { nodeId: 'NodeA', dependencies: new Set() }],
        ['NodeB', { nodeId: 'NodeB', dependencies: new Set() }],
        ['NodeC', { nodeId: 'NodeC', dependencies: new Set(['NodeA', 'NodeB']) }],
      ]);

      const sortedNodes = topologicalSort(dependencyGraph);

      // NodeA and NodeB can be in any order, but both must come before NodeC
      const indexA = sortedNodes.indexOf('NodeA');
      const indexB = sortedNodes.indexOf('NodeB');
      const indexC = sortedNodes.indexOf('NodeC');

      expect(indexA).to.be.lessThan(indexC);
      expect(indexB).to.be.lessThan(indexC);
    });

    it('should handle empty graph', () => {
      const emptyGraph: DependencyGraph = new Map();
      const sortedNodes = topologicalSort(emptyGraph);

      expect(sortedNodes).to.be.an('array').that.is.empty;
    });
  });

  describe('detectCycles', () => {
    /**
     * @ac US-002-AC-2: detectCycles() identifies circular dependencies
     */
    it('should detect simple cycle', () => {
      const cyclicGraph: DependencyGraph = new Map([
        ['NodeA', { nodeId: 'NodeA', dependencies: new Set(['NodeB']) }],
        ['NodeB', { nodeId: 'NodeB', dependencies: new Set(['NodeA']) }],
      ]);

      const cycleDetectionResult = detectCycles(cyclicGraph);

      expect(cycleDetectionResult.hasCycles).to.be.true;
      expect(cycleDetectionResult.cycles).to.have.lengthOf.at.least(1);
    });

    it('should detect no cycles in acyclic graph', () => {
      const acyclicGraph: DependencyGraph = new Map([
        ['NodeA', { nodeId: 'NodeA', dependencies: new Set() }],
        ['NodeB', { nodeId: 'NodeB', dependencies: new Set(['NodeA']) }],
        ['NodeC', { nodeId: 'NodeC', dependencies: new Set(['NodeB']) }],
      ]);

      const cycleDetectionResult = detectCycles(acyclicGraph);

      expect(cycleDetectionResult.hasCycles).to.be.false;
      expect(cycleDetectionResult.cycles).to.be.an('array').that.is.empty;
    });

    it('should detect complex cycle (A -> B -> C -> A)', () => {
      const complexCyclicGraph: DependencyGraph = new Map([
        ['NodeA', { nodeId: 'NodeA', dependencies: new Set(['NodeB']) }],
        ['NodeB', { nodeId: 'NodeB', dependencies: new Set(['NodeC']) }],
        ['NodeC', { nodeId: 'NodeC', dependencies: new Set(['NodeA']) }],
      ]);

      const cycleDetectionResult = detectCycles(complexCyclicGraph);

      expect(cycleDetectionResult.hasCycles).to.be.true;
      expect(cycleDetectionResult.cycles[0]).to.include.members(['NodeA', 'NodeB', 'NodeC']);
    });
  });

  describe('calculateDepth', () => {
    /**
     * @ac US-002-AC-3: calculateDepth() determines dependency depth
     */
    it('should calculate depth for linear dependency chain', () => {
      const linearGraph: DependencyGraph = new Map([
        ['NodeA', { nodeId: 'NodeA', dependencies: new Set() }],
        ['NodeB', { nodeId: 'NodeB', dependencies: new Set(['NodeA']) }],
        ['NodeC', { nodeId: 'NodeC', dependencies: new Set(['NodeB']) }],
      ]);

      const depthMap = calculateDepth(linearGraph);

      expect(depthMap.get('NodeA')).to.equal(0);
      expect(depthMap.get('NodeB')).to.equal(1);
      expect(depthMap.get('NodeC')).to.equal(2);
    });

    it('should calculate depth for diamond-shaped dependency', () => {
      const diamondGraph: DependencyGraph = new Map([
        ['Base', { nodeId: 'Base', dependencies: new Set() }],
        ['Left', { nodeId: 'Left', dependencies: new Set(['Base']) }],
        ['Right', { nodeId: 'Right', dependencies: new Set(['Base']) }],
        ['Top', { nodeId: 'Top', dependencies: new Set(['Left', 'Right']) }],
      ]);

      const depthMap = calculateDepth(diamondGraph);

      expect(depthMap.get('Base')).to.equal(0);
      expect(depthMap.get('Left')).to.equal(1);
      expect(depthMap.get('Right')).to.equal(1);
      expect(depthMap.get('Top')).to.equal(2);
    });
  });

  describe('findPath', () => {
    /**
     * @ac US-002-AC-4: findPath() finds path between components
     */
    it('should find direct path between two nodes', () => {
      const simpleGraph: DependencyGraph = new Map([
        ['NodeA', { nodeId: 'NodeA', dependencies: new Set() }],
        ['NodeB', { nodeId: 'NodeB', dependencies: new Set(['NodeA']) }],
      ]);

      const pathResult = findPath(simpleGraph, 'NodeB', 'NodeA');

      expect(pathResult).to.deep.equal(['NodeB', 'NodeA']);
    });

    it('should find indirect path through multiple nodes', () => {
      const complexGraph: DependencyGraph = new Map([
        ['NodeA', { nodeId: 'NodeA', dependencies: new Set() }],
        ['NodeB', { nodeId: 'NodeB', dependencies: new Set(['NodeA']) }],
        ['NodeC', { nodeId: 'NodeC', dependencies: new Set(['NodeB']) }],
      ]);

      const pathResult = findPath(complexGraph, 'NodeC', 'NodeA');

      expect(pathResult).to.deep.equal(['NodeC', 'NodeB', 'NodeA']);
    });

    it('should return null when no path exists', () => {
      const disconnectedGraph: DependencyGraph = new Map([
        ['NodeA', { nodeId: 'NodeA', dependencies: new Set() }],
        ['NodeB', { nodeId: 'NodeB', dependencies: new Set() }],
      ]);

      const pathResult = findPath(disconnectedGraph, 'NodeA', 'NodeB');

      expect(pathResult).to.be.null;
    });
  });

  describe('Performance', () => {
    /**
     * @ac US-002-AC-5: Algorithms handle graphs with 1000+ nodes efficiently
     * @ac US-002-AC-6: Performance benchmarks < 1 second for 1000 nodes
     */
    it('should handle graph with 1000+ nodes in under 1 second', () => {
      const nodeCount = 1000;
      const largeGraph: DependencyGraph = new Map();

      // Create linear dependency chain with 1000 nodes
      for (let index = 0; index < nodeCount; index++) {
        const currentNodeId = `Node${index}`;
        const dependencies = index > 0 ? new Set([`Node${index - 1}`]) : new Set<string>();
        largeGraph.set(currentNodeId, { nodeId: currentNodeId, dependencies });
      }

      const startTime = Date.now();
      const sortedNodes = topologicalSort(largeGraph);
      const executionTime = Date.now() - startTime;

      expect(sortedNodes).to.have.lengthOf(nodeCount);
      expect(executionTime).to.be.lessThan(1000); // < 1 second
    });

    it('should detect cycles in large graph efficiently', () => {
      const nodeCount = 1000;
      const largeGraphWithCycle: DependencyGraph = new Map();

      // Create linear chain with cycle: Node0 -> Node1 -> ... -> Node999 -> Node0
      for (let index = 0; index < nodeCount; index++) {
        const currentNodeId = `Node${index}`;
        const nextNodeId = `Node${(index + 1) % nodeCount}`; // Wrap around to create cycle
        largeGraphWithCycle.set(currentNodeId, {
          nodeId: currentNodeId,
          dependencies: new Set([nextNodeId]),
        });
      }

      const startTime = Date.now();
      const cycleResult = detectCycles(largeGraphWithCycle);
      const executionTime = Date.now() - startTime;

      expect(cycleResult.hasCycles).to.be.true;
      expect(executionTime).to.be.lessThan(1000); // < 1 second
    });
  });
});
