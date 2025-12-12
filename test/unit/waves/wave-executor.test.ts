/**
 * Tests for Wave Executor - Wave ordering fix
 */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  sortWavesByNumber,
  validateWaveOrder,
  getWavesInExecutionOrder,
  formatWaveId,
  parseWaveId,
} from '../../../src/waves/wave-executor.js';
import type { WaveResult, Wave } from '../../../src/waves/wave-builder.js';

describe('WaveExecutor', () => {
  describe('sortWavesByNumber', () => {
    it('should sort waves by numeric order', () => {
      const waveResult: WaveResult = {
        waves: [
          { number: 10, components: [], metadata: createMockMetadata() },
          { number: 2, components: [], metadata: createMockMetadata() },
          { number: 1, components: [], metadata: createMockMetadata() },
          { number: 15, components: [], metadata: createMockMetadata() },
        ],
        totalComponents: 0,
        unplacedComponents: [],
        circularDependencies: [],
        stats: {
          totalWaves: 4,
          avgComponentsPerWave: 0,
          largestWaveSize: 0,
          smallestWaveSize: 0,
          totalEstimatedTime: 0,
        },
      };

      const sorted = sortWavesByNumber(waveResult);

      expect(sorted.map((w) => w.number)).to.deep.equal([1, 2, 10, 15]);
    });

    it('should handle already sorted waves', () => {
      const waveResult: WaveResult = {
        waves: [
          { number: 1, components: [], metadata: createMockMetadata() },
          { number: 2, components: [], metadata: createMockMetadata() },
          { number: 3, components: [], metadata: createMockMetadata() },
        ],
        totalComponents: 0,
        unplacedComponents: [],
        circularDependencies: [],
        stats: {
          totalWaves: 3,
          avgComponentsPerWave: 0,
          largestWaveSize: 0,
          smallestWaveSize: 0,
          totalEstimatedTime: 0,
        },
      };

      const sorted = sortWavesByNumber(waveResult);

      expect(sorted.map((w) => w.number)).to.deep.equal([1, 2, 3]);
    });
  });

  describe('validateWaveOrder', () => {
    it('should validate correct sequential order', () => {
      const waves: Wave[] = [
        { number: 1, components: [], metadata: createMockMetadata() },
        { number: 2, components: [], metadata: createMockMetadata() },
        { number: 3, components: [], metadata: createMockMetadata() },
      ];

      expect(validateWaveOrder(waves)).to.be.true;
    });

    it('should detect incorrect order', () => {
      const waves: Wave[] = [
        { number: 1, components: [], metadata: createMockMetadata() },
        { number: 3, components: [], metadata: createMockMetadata() },
        { number: 2, components: [], metadata: createMockMetadata() },
      ];

      expect(validateWaveOrder(waves)).to.be.false;
    });

    it('should detect missing wave numbers', () => {
      const waves: Wave[] = [
        { number: 1, components: [], metadata: createMockMetadata() },
        { number: 3, components: [], metadata: createMockMetadata() },
      ];

      expect(validateWaveOrder(waves)).to.be.false;
    });
  });

  describe('getWavesInExecutionOrder', () => {
    it('should return waves in correct order', () => {
      const waveResult: WaveResult = {
        waves: [
          { number: 10, components: [], metadata: createMockMetadata() },
          { number: 2, components: [], metadata: createMockMetadata() },
          { number: 1, components: [], metadata: createMockMetadata() },
        ],
        totalComponents: 0,
        unplacedComponents: [],
        circularDependencies: [],
        stats: {
          totalWaves: 3,
          avgComponentsPerWave: 0,
          largestWaveSize: 0,
          smallestWaveSize: 0,
          totalEstimatedTime: 0,
        },
      };

      const ordered = getWavesInExecutionOrder(waveResult);

      // Should be sorted but keep original numbers (1, 2, 10)
      expect(ordered.map((w) => w.number)).to.deep.equal([1, 2, 10]);
    });

    it('should sort waves even if not sequential', () => {
      const waveResult: WaveResult = {
        waves: [
          { number: 5, components: [], metadata: createMockMetadata() },
          { number: 10, components: [], metadata: createMockMetadata() },
          { number: 15, components: [], metadata: createMockMetadata() },
        ],
        totalComponents: 0,
        unplacedComponents: [],
        circularDependencies: [],
        stats: {
          totalWaves: 3,
          avgComponentsPerWave: 0,
          largestWaveSize: 0,
          smallestWaveSize: 0,
          totalEstimatedTime: 0,
        },
      };

      const ordered = getWavesInExecutionOrder(waveResult);

      // Should be sorted but keep original numbers (5, 10, 15)
      expect(ordered.map((w) => w.number)).to.deep.equal([5, 10, 15]);
    });
  });

  describe('formatWaveId', () => {
    it('should format wave ID with zero padding', () => {
      expect(formatWaveId(1, 15)).to.equal('wave-001');
      expect(formatWaveId(10, 15)).to.equal('wave-010');
      expect(formatWaveId(15, 15)).to.equal('wave-015');
    });

    it('should handle single digit waves', () => {
      expect(formatWaveId(1, 5)).to.equal('wave-001');
      expect(formatWaveId(5, 5)).to.equal('wave-005');
    });
  });

  describe('parseWaveId', () => {
    it('should parse wave number from formatted ID', () => {
      expect(parseWaveId('wave-001')).to.equal(1);
      expect(parseWaveId('wave-010')).to.equal(10);
      expect(parseWaveId('wave-015')).to.equal(15);
    });

    it('should return undefined for invalid IDs', () => {
      expect(parseWaveId('invalid')).to.be.undefined;
      expect(parseWaveId('wave-abc')).to.be.undefined;
    });
  });
});

function createMockMetadata() {
  return {
    componentCount: 0,
    types: [],
    maxDepth: 0,
    hasCircularDeps: false,
    estimatedTime: 0,
  };
}

