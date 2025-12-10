/**
 * Unit tests for Wave Splitter
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { WaveSplitter } from '../../../src/waves/wave-splitter.js';
import type { Wave, WaveResult } from '../../../src/waves/wave-builder.js';
import type { DependencyGraph } from '../../../src/types/dependency.js';

describe('WaveSplitter', () => {
  /**
   * Helper to create a wave
   */
  function createWave(number: number, components: string[]): Wave {
    return {
      number,
      components,
      metadata: {
        componentCount: components.length,
        types: ['ApexClass'],
        maxDepth: 0,
        hasCircularDeps: false,
        estimatedTime: components.length * 0.1,
      },
    };
  }

  /**
   * Helper to create a graph
   */
  function createGraph(edges: Array<[string, string]>): DependencyGraph {
    const graph: DependencyGraph = new Map();
    const allNodes = new Set<string>();

    for (const [from, to] of edges) {
      allNodes.add(from);
      allNodes.add(to);
    }

    for (const node of allNodes) {
      graph.set(node, new Set());
    }

    for (const [from, to] of edges) {
      graph.get(from)!.add(to);
    }

    return graph;
  }

  describe('Component Limit Splitting', () => {
    /**
     * @ac US-039-AC-1: Split waves with >300 components
     */
    it('US-039-AC-1: should split waves exceeding component limit', () => {
      const components: string[] = [];
      for (let i = 0; i < 400; i++) {
        components.push(`ApexClass:Node${i}`);
      }

      const waveResult: WaveResult = {
        waves: [createWave(1, components)],
        totalComponents: 400,
        unplacedComponents: [],
        circularDependencies: [],
        stats: {
          totalWaves: 1,
          avgComponentsPerWave: 400,
          largestWaveSize: 400,
          smallestWaveSize: 400,
          totalEstimatedTime: 40,
        },
      };

      const splitter = new WaveSplitter({ maxComponentsPerWave: 300 });
      const graph = createGraph([]);
      const result = splitter.splitWaves(waveResult, graph);

      // Should be split into 2 sub-waves (300 + 100)
      expect(result.splitWaves.length).to.be.greaterThan(1);
      expect(result.decisions.length).to.equal(1);
      expect(result.decisions[0].originalCount).to.equal(400);
    });

    it('US-039-AC-1: should not split waves within limit', () => {
      const components: string[] = [];
      for (let i = 0; i < 200; i++) {
        components.push(`ApexClass:Node${i}`);
      }

      const waveResult: WaveResult = {
        waves: [createWave(1, components)],
        totalComponents: 200,
        unplacedComponents: [],
        circularDependencies: [],
        stats: {
          totalWaves: 1,
          avgComponentsPerWave: 200,
          largestWaveSize: 200,
          smallestWaveSize: 200,
          totalEstimatedTime: 20,
        },
      };

      const splitter = new WaveSplitter({ maxComponentsPerWave: 300 });
      const graph = createGraph([]);
      const result = splitter.splitWaves(waveResult, graph);

      // Should not be split
      expect(result.splitWaves.length).to.equal(1);
      expect(result.decisions.length).to.equal(0);
    });
  });

  describe('Dependency Order', () => {
    /**
     * @ac US-039-AC-2: Maintain dependency order within split waves
     */
    it('US-039-AC-2: should maintain dependency order when splitting independent components', () => {
      const components: string[] = [];
      // Create independent components (no dependencies)
      for (let i = 0; i < 400; i++) {
        components.push(`ApexClass:Node${i}`);
      }

      const waveResult: WaveResult = {
        waves: [createWave(1, components)],
        totalComponents: 400,
        unplacedComponents: [],
        circularDependencies: [],
        stats: {
          totalWaves: 1,
          avgComponentsPerWave: 400,
          largestWaveSize: 400,
          smallestWaveSize: 400,
          totalEstimatedTime: 40,
        },
      };

      // No dependencies - all independent
      const graph = createGraph([]);

      const splitter = new WaveSplitter({ 
        maxComponentsPerWave: 300,
        maintainDependencyOrder: true 
      });
      const result = splitter.splitWaves(waveResult, graph);

      // Validate no dependency violations (should pass for independent components)
      const isValid = splitter.validateSplit(result, graph);
      expect(isValid).to.be.true;
    });

    it('US-039-AC-2: should sort components by dependency order', () => {
      // Create components where some depend on others
      const components = [
        'ApexClass:A',
        'ApexClass:B',
        'ApexClass:C',
        'ApexClass:D',
        'ApexClass:E',
      ];

      const waveResult: WaveResult = {
        waves: [createWave(1, components)],
        totalComponents: 5,
        unplacedComponents: [],
        circularDependencies: [],
        stats: {
          totalWaves: 1,
          avgComponentsPerWave: 5,
          largestWaveSize: 5,
          smallestWaveSize: 5,
          totalEstimatedTime: 0.5,
        },
      };

      // Create dependencies: A→E, B→E, C→E, D→E
      // E has no dependencies, should come first
      const edges: Array<[string, string]> = [
        ['ApexClass:A', 'ApexClass:E'],
        ['ApexClass:B', 'ApexClass:E'],
        ['ApexClass:C', 'ApexClass:E'],
        ['ApexClass:D', 'ApexClass:E'],
      ];
      const graph = createGraph(edges);

      const splitter = new WaveSplitter({ 
        maxComponentsPerWave: 3,  // Force split
        maintainDependencyOrder: true 
      });
      const result = splitter.splitWaves(waveResult, graph);

      // E should be in first sub-wave (no dependencies)
      const firstSubWave = result.splitWaves[0];
      expect(firstSubWave.components).to.include('ApexClass:E');
    });
  });

  describe('Sub-Wave Generation', () => {
    /**
     * @ac US-039-AC-3: Generate sub-waves (1a, 1b, etc.)
     */
    it('US-039-AC-3: should generate sub-wave identifiers', () => {
      const components: string[] = [];
      for (let i = 0; i < 350; i++) {
        components.push(`ApexClass:Node${i}`);
      }

      const waveResult: WaveResult = {
        waves: [createWave(1, components)],
        totalComponents: 350,
        unplacedComponents: [],
        circularDependencies: [],
        stats: {
          totalWaves: 1,
          avgComponentsPerWave: 350,
          largestWaveSize: 350,
          smallestWaveSize: 350,
          totalEstimatedTime: 35,
        },
      };

      const splitter = new WaveSplitter({ maxComponentsPerWave: 300 });
      const graph = createGraph([]);
      const result = splitter.splitWaves(waveResult, graph);

      // Should have sub-wave identifiers
      expect(result.splitWaves[0].fullWaveId).to.match(/^1[a-z]$/);
      expect(result.splitWaves[0].subWaveLetter).to.be.a('string');
      expect(result.splitWaves[0].parentWave).to.equal(1);
    });

    it('US-039-AC-3: should generate sequential sub-wave letters', () => {
      const components: string[] = [];
      for (let i = 0; i < 1000; i++) {
        components.push(`ApexClass:Node${i}`);
      }

      const waveResult: WaveResult = {
        waves: [createWave(1, components)],
        totalComponents: 1000,
        unplacedComponents: [],
        circularDependencies: [],
        stats: {
          totalWaves: 1,
          avgComponentsPerWave: 1000,
          largestWaveSize: 1000,
          smallestWaveSize: 1000,
          totalEstimatedTime: 100,
        },
      };

      const splitter = new WaveSplitter({ maxComponentsPerWave: 300 });
      const graph = createGraph([]);
      const result = splitter.splitWaves(waveResult, graph);

      // Should have multiple sub-waves with sequential letters
      const letters = result.splitWaves.map((sw) => sw.subWaveLetter);
      expect(letters[0]).to.equal('a');
      expect(letters[1]).to.equal('b');
      expect(letters[2]).to.equal('c');
    });
  });

  describe('Custom Metadata Splitting', () => {
    /**
     * @ac US-039-AC-4: Split CMT waves at 200 records
     */
    it('US-039-AC-4: should split Custom Metadata at 200 records', () => {
      const components: string[] = [];
      for (let i = 0; i < 250; i++) {
        components.push(`CustomMetadata:Config.Record${i}`);
      }

      const waveResult: WaveResult = {
        waves: [createWave(1, components)],
        totalComponents: 250,
        unplacedComponents: [],
        circularDependencies: [],
        stats: {
          totalWaves: 1,
          avgComponentsPerWave: 250,
          largestWaveSize: 250,
          smallestWaveSize: 250,
          totalEstimatedTime: 25,
        },
      };

      const splitter = new WaveSplitter({ 
        maxCustomMetadataPerWave: 200 
      });
      const graph = createGraph([]);
      const result = splitter.splitWaves(waveResult, graph);

      // Should be split into 2 sub-waves (200 + 50)
      expect(result.splitWaves.length).to.be.greaterThan(1);
      expect(result.decisions[0].reason).to.include('Custom Metadata');
    });

    it('US-039-AC-4: should not split CMT within limit', () => {
      const components: string[] = [];
      for (let i = 0; i < 150; i++) {
        components.push(`CustomMetadata:Config.Record${i}`);
      }

      const waveResult: WaveResult = {
        waves: [createWave(1, components)],
        totalComponents: 150,
        unplacedComponents: [],
        circularDependencies: [],
        stats: {
          totalWaves: 1,
          avgComponentsPerWave: 150,
          largestWaveSize: 150,
          smallestWaveSize: 150,
          totalEstimatedTime: 15,
        },
      };

      const splitter = new WaveSplitter({ 
        maxCustomMetadataPerWave: 200 
      });
      const graph = createGraph([]);
      const result = splitter.splitWaves(waveResult, graph);

      // Should not be split
      expect(result.splitWaves.length).to.equal(1);
      expect(result.decisions.length).to.equal(0);
    });
  });

  describe('Split Reporting', () => {
    /**
     * @ac US-039-AC-5: Report split decisions
     */
    it('US-039-AC-5: should report split decisions', () => {
      const components: string[] = [];
      for (let i = 0; i < 400; i++) {
        components.push(`ApexClass:Node${i}`);
      }

      const waveResult: WaveResult = {
        waves: [createWave(1, components)],
        totalComponents: 400,
        unplacedComponents: [],
        circularDependencies: [],
        stats: {
          totalWaves: 1,
          avgComponentsPerWave: 400,
          largestWaveSize: 400,
          smallestWaveSize: 400,
          totalEstimatedTime: 40,
        },
      };

      const splitter = new WaveSplitter({ maxComponentsPerWave: 300 });
      const graph = createGraph([]);
      const result = splitter.splitWaves(waveResult, graph);

      expect(result.decisions.length).to.be.greaterThan(0);
      
      const decision = result.decisions[0];
      expect(decision.waveNumber).to.equal(1);
      expect(decision.reason).to.be.a('string');
      expect(decision.originalCount).to.equal(400);
      expect(decision.subWaveCount).to.be.a('number');
      expect(decision.componentsPerSubWave).to.be.an('array');
    });

    it('US-039-AC-5: should generate split report', () => {
      const components: string[] = [];
      for (let i = 0; i < 350; i++) {
        components.push(`ApexClass:Node${i}`);
      }

      const waveResult: WaveResult = {
        waves: [createWave(1, components)],
        totalComponents: 350,
        unplacedComponents: [],
        circularDependencies: [],
        stats: {
          totalWaves: 1,
          avgComponentsPerWave: 350,
          largestWaveSize: 350,
          smallestWaveSize: 350,
          totalEstimatedTime: 35,
        },
      };

      const splitter = new WaveSplitter({ maxComponentsPerWave: 300 });
      const graph = createGraph([]);
      const result = splitter.splitWaves(waveResult, graph);

      const report = splitter.generateReport(result);
      
      expect(report).to.include('Wave Split Report');
      expect(report).to.include('Statistics');
      expect(report).to.include('Original Waves');
      expect(report).to.include('Final Waves');
    });
  });

  describe('Dependency Validation', () => {
    /**
     * @ac US-039-AC-6: Ensure no dependency violations
     */
    it('US-039-AC-6: should validate no dependency violations', () => {
      const components: string[] = [];
      for (let i = 0; i < 350; i++) {
        components.push(`ApexClass:Node${i}`);
      }

      const waveResult: WaveResult = {
        waves: [createWave(1, components)],
        totalComponents: 350,
        unplacedComponents: [],
        circularDependencies: [],
        stats: {
          totalWaves: 1,
          avgComponentsPerWave: 350,
          largestWaveSize: 350,
          smallestWaveSize: 350,
          totalEstimatedTime: 35,
        },
      };

      const graph = createGraph([]);
      
      const splitter = new WaveSplitter({ maxComponentsPerWave: 300 });
      const result = splitter.splitWaves(waveResult, graph);

      const isValid = splitter.validateSplit(result, graph);
      expect(isValid).to.be.true;
    });

    it('US-039-AC-6: should detect dependency violations', () => {
      const components = ['ApexClass:A', 'ApexClass:B'];
      
      const waveResult: WaveResult = {
        waves: [createWave(1, components)],
        totalComponents: 2,
        unplacedComponents: [],
        circularDependencies: [],
        stats: {
          totalWaves: 1,
          avgComponentsPerWave: 2,
          largestWaveSize: 2,
          smallestWaveSize: 2,
          totalEstimatedTime: 1,
        },
      };

      // A depends on B, but they're in wrong order
      const graph = createGraph([['ApexClass:A', 'ApexClass:B']]);
      
      // Manually create invalid split (A before B)
      const result = {
        originalWaves: waveResult.waves,
        splitWaves: [
          {
            ...createWave(1, ['ApexClass:A']),
            parentWave: 1,
            subWaveLetter: 'a',
            fullWaveId: '1a',
          },
          {
            ...createWave(1, ['ApexClass:B']),
            parentWave: 1,
            subWaveLetter: 'b',
            fullWaveId: '1b',
          },
        ],
        decisions: [],
        stats: {
          originalWaveCount: 1,
          finalWaveCount: 2,
          splitWaveCount: 0,
          totalComponents: 2,
        },
      };

      const splitter = new WaveSplitter();
      const isValid = splitter.validateSplit(result, graph);
      expect(isValid).to.be.false;
    });
  });

  describe('Statistics', () => {
    it('should calculate split statistics', () => {
      const components: string[] = [];
      for (let i = 0; i < 600; i++) {
        components.push(`ApexClass:Node${i}`);
      }

      const waveResult: WaveResult = {
        waves: [
          createWave(1, components.slice(0, 400)),
          createWave(2, components.slice(400, 600)),
        ],
        totalComponents: 600,
        unplacedComponents: [],
        circularDependencies: [],
        stats: {
          totalWaves: 2,
          avgComponentsPerWave: 300,
          largestWaveSize: 400,
          smallestWaveSize: 200,
          totalEstimatedTime: 60,
        },
      };

      const splitter = new WaveSplitter({ maxComponentsPerWave: 300 });
      const graph = createGraph([]);
      const result = splitter.splitWaves(waveResult, graph);

      expect(result.stats.originalWaveCount).to.equal(2);
      expect(result.stats.finalWaveCount).to.be.greaterThan(2);
      expect(result.stats.splitWaveCount).to.be.greaterThan(0);
      expect(result.stats.totalComponents).to.equal(600);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty waves', () => {
      const waveResult: WaveResult = {
        waves: [],
        totalComponents: 0,
        unplacedComponents: [],
        circularDependencies: [],
        stats: {
          totalWaves: 0,
          avgComponentsPerWave: 0,
          largestWaveSize: 0,
          smallestWaveSize: 0,
          totalEstimatedTime: 0,
        },
      };

      const splitter = new WaveSplitter();
      const graph = createGraph([]);
      const result = splitter.splitWaves(waveResult, graph);

      expect(result.splitWaves).to.have.lengthOf(0);
      expect(result.decisions).to.have.lengthOf(0);
    });

    it('should handle single component wave', () => {
      const waveResult: WaveResult = {
        waves: [createWave(1, ['ApexClass:Single'])],
        totalComponents: 1,
        unplacedComponents: [],
        circularDependencies: [],
        stats: {
          totalWaves: 1,
          avgComponentsPerWave: 1,
          largestWaveSize: 1,
          smallestWaveSize: 1,
          totalEstimatedTime: 0.1,
        },
      };

      const splitter = new WaveSplitter();
      const graph = createGraph([]);
      const result = splitter.splitWaves(waveResult, graph);

      expect(result.splitWaves).to.have.lengthOf(1);
      expect(result.decisions).to.have.lengthOf(0);
    });

    it('should handle mixed CMT and regular components', () => {
      const components = [
        ...Array.from({ length: 150 }, (_, i) => `CustomMetadata:Config.Record${i}`),
        ...Array.from({ length: 150 }, (_, i) => `ApexClass:Node${i}`),
      ];

      const waveResult: WaveResult = {
        waves: [createWave(1, components)],
        totalComponents: 300,
        unplacedComponents: [],
        circularDependencies: [],
        stats: {
          totalWaves: 1,
          avgComponentsPerWave: 300,
          largestWaveSize: 300,
          smallestWaveSize: 300,
          totalEstimatedTime: 30,
        },
      };

      const splitter = new WaveSplitter({ 
        maxComponentsPerWave: 300,
        maxCustomMetadataPerWave: 200 
      });
      const graph = createGraph([]);
      const result = splitter.splitWaves(waveResult, graph);

      // Should not need splitting
      expect(result.decisions.length).to.equal(0);
    });
  });
});

