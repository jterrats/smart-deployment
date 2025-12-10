/**
 * Unit tests for Wave Builder
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { WaveBuilder } from '../../../src/waves/wave-builder.js';
import type { DependencyGraph } from '../../../src/types/dependency.js';

describe('WaveBuilder', () => {
  /**
   * Helper to create a dependency graph
   */
  function createGraph(edges: Array<[string, string]>): DependencyGraph {
    const graph: DependencyGraph = new Map();

    // Collect all nodes
    const allNodes = new Set<string>();
    for (const [from, to] of edges) {
      allNodes.add(from);
      allNodes.add(to);
    }

    // Initialize nodes
    for (const node of allNodes) {
      graph.set(node, new Set<string>());
    }

    // Add edges
    for (const [from, to] of edges) {
      graph.get(from)!.add(to);
    }

    return graph;
  }

  describe('Wave Generation', () => {
    /**
     * @ac US-038-AC-1: Generate waves from dependency graph
     */
    it('US-038-AC-1: should generate waves from dependency graph', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
      ]);

      const builder = new WaveBuilder();
      const result = builder.generateWaves(graph);

      expect(result.waves.length).to.be.greaterThan(0);
      expect(result.totalComponents).to.equal(3);
    });

    it('US-038-AC-1: should generate correct wave order', () => {
      // A depends on B, B depends on C
      // So: C (wave 1), B (wave 2), A (wave 3)
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
      ]);

      const builder = new WaveBuilder();
      const result = builder.generateWaves(graph);

      // Find which wave each component is in
      const waveC = builder.getComponentWave(result, 'ApexClass:C');
      const waveB = builder.getComponentWave(result, 'ApexClass:B');
      const waveA = builder.getComponentWave(result, 'ApexClass:A');

      // C should be deployed first (no deps)
      expect(waveC).to.equal(1);
      // B depends on C, so after C
      expect(waveB).to.be.greaterThan(waveC!);
      // A depends on B, so after B
      expect(waveA).to.be.greaterThan(waveB!);
    });
  });

  describe('Independent Components', () => {
    /**
     * @ac US-038-AC-2: Each wave contains independent components
     */
    it('US-038-AC-2: should group independent components in same wave', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:D'],
        ['ApexClass:B', 'ApexClass:D'],
        ['ApexClass:C', 'ApexClass:D'],
      ]);

      const builder = new WaveBuilder();
      const result = builder.generateWaves(graph);

      // D should be in first wave
      expect(result.waves[0].components).to.include('ApexClass:D');

      // A, B, C should be in second wave (all depend only on D)
      expect(result.waves[1].components).to.have.lengthOf(3);
      expect(result.waves[1].components).to.include('ApexClass:A');
      expect(result.waves[1].components).to.include('ApexClass:B');
      expect(result.waves[1].components).to.include('ApexClass:C');
    });
  });

  describe('Dependency Order', () => {
    /**
     * @ac US-038-AC-3: Components in wave N don't depend on wave N+1
     */
    it('US-038-AC-3: should not have dependencies on later waves', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:D'],
      ]);

      const builder = new WaveBuilder();
      const result = builder.generateWaves(graph);

      // Verify each wave only depends on previous waves
      for (let i = 0; i < result.waves.length; i++) {
        const wave = result.waves[i];
        for (const component of wave.components) {
          const deps = graph.get(component) ?? new Set();
          for (const dep of deps) {
            // Find which wave the dependency is in
            const depWave = builder.getComponentWave(result, dep);
            if (depWave !== undefined) {
              // Dependency should be in same or earlier wave
              expect(depWave).to.be.lessThanOrEqual(wave.number);
            }
          }
        }
      }
    });
  });

  describe('No Dependencies', () => {
    /**
     * @ac US-038-AC-4: Handle components with no dependencies (wave 1)
     */
    it('US-038-AC-4: should place components with no dependencies in first wave', () => {
      // A depends on B, so B has no deps and should be in wave 1
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
      ]);

      const builder = new WaveBuilder();
      const result = builder.generateWaves(graph);

      // B has no incoming edges (no one depends on it from outside)
      // but B is depended upon by A
      // So B should be in wave 1 (no dependencies on other components)
      const waveB = builder.getComponentWave(result, 'ApexClass:B');
      expect(waveB).to.equal(1);
    });

    it('US-038-AC-4: should handle multiple components with no dependencies', () => {
      const graph: DependencyGraph = new Map();
      graph.set('ApexClass:A', new Set());
      graph.set('ApexClass:B', new Set());
      graph.set('ApexClass:C', new Set());

      const builder = new WaveBuilder();
      const result = builder.generateWaves(graph);

      // All should be in first wave
      expect(result.waves).to.have.lengthOf(1);
      expect(result.waves[0].components).to.have.lengthOf(3);
    });
  });

  describe('Isolated Components', () => {
    /**
     * @ac US-038-AC-5: Handle isolated components
     */
    it('US-038-AC-5: should handle isolated components', () => {
      const graph: DependencyGraph = new Map();
      graph.set('ApexClass:Isolated1', new Set());
      graph.set('ApexClass:Isolated2', new Set());

      const builder = new WaveBuilder();
      const result = builder.generateWaves(graph);

      expect(result.waves).to.have.lengthOf(1);
      expect(result.waves[0].components).to.include('ApexClass:Isolated1');
      expect(result.waves[0].components).to.include('ApexClass:Isolated2');
    });

    it('US-038-AC-5: should mix isolated and dependent components correctly', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
      ]);
      graph.set('ApexClass:Isolated', new Set());

      const builder = new WaveBuilder();
      const result = builder.generateWaves(graph);

      // Isolated and B should be in first wave (no dependencies)
      const waveIsolated = builder.getComponentWave(result, 'ApexClass:Isolated');
      const waveB = builder.getComponentWave(result, 'ApexClass:B');
      const waveA = builder.getComponentWave(result, 'ApexClass:A');

      expect(waveIsolated).to.equal(1);
      expect(waveB).to.equal(1);
      expect(waveA).to.be.greaterThan(1);
    });
  });

  describe('Wave Metadata', () => {
    /**
     * @ac US-038-AC-6: Generate wave metadata
     */
    it('US-038-AC-6: should generate wave metadata', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
      ]);

      const builder = new WaveBuilder();
      const result = builder.generateWaves(graph);

      for (const wave of result.waves) {
        expect(wave.metadata).to.exist;
        expect(wave.metadata.componentCount).to.be.a('number');
        expect(wave.metadata.types).to.be.an('array');
        expect(wave.metadata.estimatedTime).to.be.a('number');
        expect(wave.metadata.hasCircularDeps).to.be.a('boolean');
      }
    });

    it('US-038-AC-6: should calculate component count correctly', () => {
      // A, B, C all depend on D
      // So D should be in wave 1, and A,B,C in wave 2
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:D'],
        ['ApexClass:B', 'ApexClass:D'],
        ['ApexClass:C', 'ApexClass:D'],
      ]);

      const builder = new WaveBuilder();
      const result = builder.generateWaves(graph);

      // Wave 1 should have D (1 component)
      const wave1 = result.waves.find(w => w.components.includes('ApexClass:D'));
      expect(wave1?.metadata.componentCount).to.equal(1);

      // Wave 2 should have A, B, C (3 components)
      const wave2 = result.waves.find(w => w.components.includes('ApexClass:A'));
      expect(wave2?.metadata.componentCount).to.equal(3);
    });

    it('US-038-AC-6: should identify metadata types', () => {
      const graph = createGraph([
        ['ApexClass:A', 'CustomObject:Account'],
        ['ApexTrigger:T', 'CustomObject:Account'],
      ]);

      const builder = new WaveBuilder();
      const result = builder.generateWaves(graph);

      // CustomObject should be in first wave
      const wave1 = result.waves.find(w => w.components.some(c => c.startsWith('CustomObject:')));
      expect(wave1?.metadata.types).to.include('CustomObject');

      // ApexClass and ApexTrigger should be in later wave
      const wave2 = result.waves.find(w => w.components.some(c => c.startsWith('ApexClass:')));
      expect(wave2?.metadata.types.length).to.be.greaterThan(0);
    });
  });

  describe('Circular Dependencies', () => {
    it('should handle circular dependencies', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:A'], // Circular
      ]);

      const builder = new WaveBuilder({ handleCircularDeps: true });
      const result = builder.generateWaves(graph);

      expect(result.unplacedComponents.length).to.be.greaterThan(0);
    });

    it('should place circular components in final wave', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:A'],
      ]);

      const builder = new WaveBuilder({ handleCircularDeps: true });
      const result = builder.generateWaves(graph);

      const finalWave = result.waves[result.waves.length - 1];
      expect(finalWave.metadata.hasCircularDeps).to.be.true;
    });
  });

  describe('Type Order', () => {
    it('should respect metadata type order when configured', () => {
      const graph: DependencyGraph = new Map();
      graph.set('ApexClass:A', new Set());
      graph.set('CustomObject:Account', new Set());
      graph.set('CustomField:Name', new Set());

      const builder = new WaveBuilder({ respectTypeOrder: true });
      const result = builder.generateWaves(graph);

      const wave = result.waves[0];
      // CustomObject should come before ApexClass
      const customObjIndex = wave.components.findIndex((c) => c.startsWith('CustomObject:'));
      const apexClassIndex = wave.components.findIndex((c) => c.startsWith('ApexClass:'));

      if (customObjIndex !== -1 && apexClassIndex !== -1) {
        expect(customObjIndex).to.be.lessThan(apexClassIndex);
      }
    });
  });

  describe('Max Components Per Wave', () => {
    it('should split large waves when maxComponentsPerWave is set', () => {
      const graph: DependencyGraph = new Map();
      
      // Create 15 independent components
      for (let i = 0; i < 15; i++) {
        graph.set(`ApexClass:Node${i}`, new Set());
      }

      const builder = new WaveBuilder({ maxComponentsPerWave: 5 });
      const result = builder.generateWaves(graph);

      // Should be split into 3 waves (5 + 5 + 5)
      expect(result.waves.length).to.equal(3);
      expect(result.waves[0].components).to.have.lengthOf(5);
      expect(result.waves[1].components).to.have.lengthOf(5);
      expect(result.waves[2].components).to.have.lengthOf(5);
    });

    it('should not split when maxComponentsPerWave is 0', () => {
      const graph: DependencyGraph = new Map();
      
      for (let i = 0; i < 100; i++) {
        graph.set(`ApexClass:Node${i}`, new Set());
      }

      const builder = new WaveBuilder({ maxComponentsPerWave: 0 });
      const result = builder.generateWaves(graph);

      // Should be one wave
      expect(result.waves).to.have.lengthOf(1);
      expect(result.waves[0].components).to.have.lengthOf(100);
    });
  });

  describe('Statistics', () => {
    it('should calculate wave statistics', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:C', 'ApexClass:B'],
      ]);

      const builder = new WaveBuilder();
      const result = builder.generateWaves(graph);

      expect(result.stats.totalWaves).to.be.greaterThan(0);
      expect(result.stats.avgComponentsPerWave).to.be.a('number');
      expect(result.stats.largestWaveSize).to.be.a('number');
      expect(result.stats.smallestWaveSize).to.be.a('number');
      expect(result.stats.totalEstimatedTime).to.be.a('number');
    });
  });

  describe('Helper Methods', () => {
    it('should get wave by number', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
      ]);

      const builder = new WaveBuilder();
      const result = builder.generateWaves(graph);

      const wave1 = builder.getWave(result, 1);
      expect(wave1).to.exist;
      expect(wave1?.number).to.equal(1);
    });

    it('should get component wave number', () => {
      const graph = createGraph([
        ['ApexClass:A', 'ApexClass:B'],
      ]);

      const builder = new WaveBuilder();
      const result = builder.generateWaves(graph);

      // B should be in wave 1 (no dependencies)
      const waveBNum = builder.getComponentWave(result, 'ApexClass:B');
      expect(waveBNum).to.exist;
      expect(waveBNum).to.equal(1);

      // A should be in wave 2 (depends on B)
      const waveANum = builder.getComponentWave(result, 'ApexClass:A');
      expect(waveANum).to.exist;
      expect(waveANum).to.be.greaterThan(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty graph', () => {
      const graph: DependencyGraph = new Map();

      const builder = new WaveBuilder();
      const result = builder.generateWaves(graph);

      expect(result.waves).to.have.lengthOf(0);
      expect(result.totalComponents).to.equal(0);
    });

    it('should handle single component', () => {
      const graph: DependencyGraph = new Map();
      graph.set('ApexClass:Single', new Set());

      const builder = new WaveBuilder();
      const result = builder.generateWaves(graph);

      expect(result.waves).to.have.lengthOf(1);
      expect(result.waves[0].components).to.have.lengthOf(1);
    });

    it('should handle complex dependency tree', () => {
      const edges: Array<[string, string]> = [];
      
      // Create a tree: 1 -> 2,3  ; 2 -> 4,5 ; 3 -> 6,7
      for (let i = 1; i <= 7; i++) {
        if (i * 2 <= 7) {
          edges.push([`ApexClass:Node${i}`, `ApexClass:Node${i * 2}`]);
        }
        if (i * 2 + 1 <= 7) {
          edges.push([`ApexClass:Node${i}`, `ApexClass:Node${i * 2 + 1}`]);
        }
      }

      const graph = createGraph(edges);
      const builder = new WaveBuilder();
      const result = builder.generateWaves(graph);

      expect(result.waves.length).to.be.greaterThan(0);
      expect(result.totalComponents).to.equal(7);
    });

    it('should handle large graphs efficiently', function () {
      this.timeout(5000);

      const edges: Array<[string, string]> = [];
      
      // Linear chain of 500 nodes
      for (let i = 0; i < 499; i++) {
        edges.push([`ApexClass:Node${i}`, `ApexClass:Node${i + 1}`]);
      }

      const graph = createGraph(edges);
      const startTime = Date.now();

      const builder = new WaveBuilder();
      const result = builder.generateWaves(graph);

      const duration = Date.now() - startTime;

      expect(result.waves.length).to.equal(500);
      expect(duration).to.be.lessThan(1000); // Should complete in < 1 second
    });
  });
});

