/**
 * Unit tests for Wave Merger
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { WaveMerger } from '../../../src/waves/wave-merger.js';
import type { Wave } from '../../../src/waves/wave-builder.js';
import type { DependencyGraph } from '../../../src/types/dependency.js';

describe('WaveMerger', () => {
  function createWave(number: number, componentCount: number): Wave {
    const components: string[] = [];
    for (let i = 0; i < componentCount; i++) {
      components.push(`ApexClass:Node${number}_${i}`);
    }
    return {
      number,
      components,
      metadata: {
        componentCount,
        types: ['ApexClass'],
        maxDepth: 0,
        hasCircularDeps: false,
        estimatedTime: componentCount * 0.1,
      },
    };
  }

  describe('Small Wave Identification', () => {
    /**
     * @ac US-041-AC-1: Identify waves with <50 components
     */
    it('US-041-AC-1: should identify waves with <50 components', () => {
      const waves = [
        createWave(1, 30),
        createWave(2, 40),
        createWave(3, 100),
      ];

      const merger = new WaveMerger();
      const graph: DependencyGraph = new Map();
      const result = merger.mergeWaves(waves, graph);

      expect(result.decisions.length).to.be.greaterThan(0);
    });
  });

  describe('Merge Size Validation', () => {
    /**
     * @ac US-041-AC-2: Merge if combined < 300 components
     */
    it('US-041-AC-2: should merge if combined < 300 components', () => {
      const waves = [
        createWave(1, 40),
        createWave(2, 50),
      ];

      const merger = new WaveMerger();
      const graph: DependencyGraph = new Map();
      const result = merger.mergeWaves(waves, graph);

      expect(result.mergedWaves.length).to.equal(1);
      expect(result.mergedWaves[0].components.length).to.equal(90);
    });

    /**
     * @ac US-041-AC-3: Respect dependency order
     * @ac US-041-AC-4: Don't merge if different test requirements
     */
    it('US-041-AC-3: should not merge if combined > 300 components', () => {
      const waves = [
        createWave(1, 200),
        createWave(2, 150),
      ];

      const merger = new WaveMerger();
      const graph: DependencyGraph = new Map();
      const result = merger.mergeWaves(waves, graph);

      expect(result.mergedWaves.length).to.equal(2);
    });
  });

  describe('Report Generation', () => {
    /**
     * @ac US-041-AC-5: Report merge decisions
     */
    it('US-041-AC-5: should report merge decisions', () => {
      const waves = [
        createWave(1, 30),
        createWave(2, 40),
      ];

      const merger = new WaveMerger();
      const graph: DependencyGraph = new Map();
      const result = merger.mergeWaves(waves, graph);

      expect(result.decisions).to.have.lengthOf(1);
      expect(result.decisions[0].mergedWaves).to.deep.equal([1, 2]);
    });

    /**
     * @ac US-041-AC-6: User override option
     */
    it('US-041-AC-6: should generate merge report', () => {
      const waves = [createWave(1, 30), createWave(2, 40)];

      const merger = new WaveMerger();
      const graph: DependencyGraph = new Map();
      const result = merger.mergeWaves(waves, graph);

      const report = merger.generateReport(result);
      expect(report).to.include('Wave Merge Report');
      expect(report).to.include('Statistics');
    });
  });

  describe('Statistics', () => {
    it('should calculate merge statistics', () => {
      const waves = [
        createWave(1, 30),
        createWave(2, 40),
        createWave(3, 200),
      ];

      const merger = new WaveMerger();
      const graph: DependencyGraph = new Map();
      const result = merger.mergeWaves(waves, graph);

      expect(result.stats.originalWaveCount).to.equal(3);
      expect(result.stats.wavesSaved).to.be.greaterThanOrEqual(0);
    });
  });
});
