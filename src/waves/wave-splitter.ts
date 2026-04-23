/**
 * Wave Splitter
 * Splits large waves to respect Salesforce deployment limits
 *
 * @ac US-039-AC-1: Split waves with >300 components
 * @ac US-039-AC-2: Maintain dependency order within split waves
 * @ac US-039-AC-3: Generate sub-waves (1a, 1b, etc.)
 * @ac US-039-AC-4: Split CMT waves at 200 records
 * @ac US-039-AC-5: Report split decisions
 * @ac US-039-AC-6: Ensure no dependency violations
 *
 * @issue #39
 */

import type { NodeId, DependencyGraph } from '../types/dependency.js';
import { getLogger } from '../utils/logger.js';
import type { Wave, WaveResult } from './wave-builder.js';

const logger = getLogger('WaveSplitter');

/**
 * Sub-wave (split wave)
 */
export type SubWave = Wave & {
  /** Parent wave number */
  parentWave: number;
  /** Sub-wave letter (a, b, c, ...) */
  subWaveLetter: string;
  /** Full wave identifier (e.g., "1a", "1b") */
  fullWaveId: string;
};

/**
 * Split result
 */
export type SplitResult = {
  /** Original waves (unsplit) */
  originalWaves: Wave[];
  /** Split waves with sub-waves */
  splitWaves: SubWave[];
  /** Split decisions made */
  decisions: SplitDecision[];
  /** Statistics */
  stats: SplitStats;
};

/**
 * Split decision record
 */
export type SplitDecision = {
  /** Original wave number */
  waveNumber: number;
  /** Reason for split */
  reason: string;
  /** Original component count */
  originalCount: number;
  /** Number of sub-waves created */
  subWaveCount: number;
  /** Components per sub-wave */
  componentsPerSubWave: number[];
};

/**
 * Split statistics
 */
export type SplitStats = {
  /** Total original waves */
  originalWaveCount: number;
  /** Total sub-waves after split */
  finalWaveCount: number;
  /** Number of waves that were split */
  splitWaveCount: number;
  /** Total components */
  totalComponents: number;
};

/**
 * Splitter options
 */
export type SplitterOptions = {
  /** Max components per wave (default: 300) */
  maxComponentsPerWave?: number;
  /** Max Custom Metadata records per wave (default: 200) */
  maxCustomMetadataPerWave?: number;
  /** Maintain dependency order within splits */
  maintainDependencyOrder?: boolean;
};

/**
 * Wave Splitter
 *
 * Splits large waves to respect Salesforce limits:
 * - General metadata: 300 components per deploy
 * - Custom Metadata Type records: 200 per deploy
 *
 * Algorithm:
 * 1. Identify waves exceeding limits
 * 2. Split while maintaining dependency order
 * 3. Generate sub-waves (1a, 1b, 1c, ...)
 * 4. Validate no cross-sub-wave dependencies
 *
 * Performance: O(V)
 *
 * @example
 * const splitter = new WaveSplitter({
 *   maxComponentsPerWave: 300,
 *   maxCustomMetadataPerWave: 200
 * });
 *
 * const result = splitter.splitWaves(waveResult, graph);
 * console.log(`Split ${result.decisions.length} waves`);
 */
export class WaveSplitter {
  private options: Required<SplitterOptions>;

  public constructor(options: SplitterOptions = {}) {
    this.options = {
      maxComponentsPerWave: options.maxComponentsPerWave ?? 300,
      maxCustomMetadataPerWave: options.maxCustomMetadataPerWave ?? 200,
      maintainDependencyOrder: options.maintainDependencyOrder ?? true,
    };

    logger.debug('Initialized WaveSplitter', {
      maxComponentsPerWave: this.options.maxComponentsPerWave,
      maxCustomMetadataPerWave: this.options.maxCustomMetadataPerWave,
    });
  }

  /**
   * @ac US-039-AC-1: Split waves with >300 components
   * @ac US-039-AC-2: Maintain dependency order within split waves
   * @ac US-039-AC-3: Generate sub-waves (1a, 1b, etc.)
   * @ac US-039-AC-5: Report split decisions
   */
  public splitWaves(waveResult: WaveResult, graph: DependencyGraph): SplitResult {
    const startTime = Date.now();
    const decisions: SplitDecision[] = [];
    const splitWaves: SubWave[] = [];

    for (const wave of waveResult.waves) {
      const needsSplit = this.needsSplit(wave);

      if (!needsSplit) {
        // No split needed, convert to sub-wave format
        splitWaves.push(this.toSubWave(wave, 'a'));
      } else {
        // Split the wave
        const subWaves = this.splitWave(wave, graph);
        splitWaves.push(...subWaves);

        // Record decision
        decisions.push({
          waveNumber: wave.number,
          reason: this.getSplitReason(wave),
          originalCount: wave.components.length,
          subWaveCount: subWaves.length,
          componentsPerSubWave: subWaves.map((sw) => sw.components.length),
        });

        logger.info('Split wave', {
          wave: wave.number,
          originalCount: wave.components.length,
          subWaves: subWaves.length,
        });
      }
    }

    // Calculate statistics
    const stats: SplitStats = {
      originalWaveCount: waveResult.waves.length,
      finalWaveCount: splitWaves.length,
      splitWaveCount: decisions.length,
      totalComponents: waveResult.totalComponents,
    };

    const duration = Date.now() - startTime;
    logger.info('Wave splitting completed', {
      originalWaves: stats.originalWaveCount,
      finalWaves: stats.finalWaveCount,
      splits: stats.splitWaveCount,
      durationMs: duration,
    });

    return {
      originalWaves: waveResult.waves,
      splitWaves,
      decisions,
      stats,
    };
  }

  /**
   * Check if wave needs to be split
   */
  private needsSplit(wave: Wave): boolean {
    // Check general component limit
    if (wave.components.length > this.options.maxComponentsPerWave) {
      return true;
    }

    // Check Custom Metadata limit
    const cmtCount = wave.components.filter((c) => c.startsWith('CustomMetadata:')).length;

    if (cmtCount > this.options.maxCustomMetadataPerWave) {
      return true;
    }

    return false;
  }

  /**
   * Get reason for split
   */
  private getSplitReason(wave: Wave): string {
    const cmtCount = wave.components.filter((c) => c.startsWith('CustomMetadata:')).length;

    if (cmtCount > this.options.maxCustomMetadataPerWave) {
      return `Exceeded Custom Metadata limit (${cmtCount} > ${this.options.maxCustomMetadataPerWave})`;
    }

    return `Exceeded component limit (${wave.components.length} > ${this.options.maxComponentsPerWave})`;
  }

  /**
   * @ac US-039-AC-4: Split CMT waves at 200 records
   * @ac US-039-AC-6: Ensure no dependency violations
   */
  private splitWave(wave: Wave, graph: DependencyGraph): SubWave[] {
    const subWaves: SubWave[] = [];
    const components = [...wave.components];

    // Sort to maintain dependency order if configured
    if (this.options.maintainDependencyOrder) {
      this.sortByDependencyOrder(components, graph);
    }

    // Check if we need special CMT handling
    const cmtComponents = components.filter((c) => c.startsWith('CustomMetadata:'));
    const needsCmtSplit = cmtComponents.length > this.options.maxCustomMetadataPerWave;

    if (needsCmtSplit) {
      // Split CMT and non-CMT separately but maintain order
      const cmtChunks = this.chunkComponents(cmtComponents, this.options.maxCustomMetadataPerWave);
      const nonCmtComponents = components.filter((c) => !c.startsWith('CustomMetadata:'));

      // Add CMT sub-waves first
      for (const chunk of cmtChunks) {
        const letter = this.getSubWaveLetter(subWaves.length);
        subWaves.push(this.createSubWave(wave, chunk, letter));
      }

      // Add non-CMT components
      if (nonCmtComponents.length > 0) {
        const nonCmtChunks = this.chunkComponents(nonCmtComponents, this.options.maxComponentsPerWave);
        for (const chunk of nonCmtChunks) {
          const letter = this.getSubWaveLetter(subWaves.length);
          subWaves.push(this.createSubWave(wave, chunk, letter));
        }
      }
    } else {
      // Simple component-based splitting
      const chunks = this.chunkComponents(components, this.options.maxComponentsPerWave);

      for (const chunk of chunks) {
        const letter = this.getSubWaveLetter(subWaves.length);
        subWaves.push(this.createSubWave(wave, chunk, letter));
      }
    }

    // If no components were added, create at least one sub-wave
    if (subWaves.length === 0) {
      subWaves.push(this.toSubWave(wave, 'a'));
    }

    return subWaves;
  }

  /**
   * Sort components by dependency order
   */
  private sortByDependencyOrder(components: NodeId[], graph: DependencyGraph): void {
    // Simple topological sort within the component list
    const inDegree = new Map<NodeId, number>();
    const componentSet = new Set(components);

    // Calculate in-degree within this subset
    for (const component of components) {
      let degree = 0;
      const deps = graph.get(component) ?? new Set();

      for (const dep of deps) {
        if (componentSet.has(dep)) {
          degree++;
        }
      }

      inDegree.set(component, degree);
    }

    // Sort by in-degree (lower degree = fewer dependencies = deploy first)
    components.sort((a, b) => {
      const degreeA = inDegree.get(a) ?? 0;
      const degreeB = inDegree.get(b) ?? 0;
      return degreeA - degreeB;
    });
  }

  /**
   * Chunk components into smaller arrays
   */
  private chunkComponents(components: NodeId[], chunkSize: number): NodeId[][] {
    const chunks: NodeId[][] = [];

    for (let i = 0; i < components.length; i += chunkSize) {
      chunks.push(components.slice(i, i + chunkSize));
    }

    return chunks;
  }

  /**
   * Get sub-wave letter (a, b, c, ...)
   */
  private getSubWaveLetter(index: number): string {
    return String.fromCharCode(97 + index); // 97 = 'a'
  }

  /**
   * Create sub-wave from wave and components
   */
  private createSubWave(wave: Wave, components: NodeId[], letter: string): SubWave {
    return {
      ...wave,
      components,
      parentWave: wave.number,
      subWaveLetter: letter,
      fullWaveId: `${wave.number}${letter}`,
      metadata: {
        ...wave.metadata,
        componentCount: components.length,
        estimatedTime: Math.ceil(components.length * 0.1),
      },
    };
  }

  /**
   * Convert wave to sub-wave format
   */
  private toSubWave(wave: Wave, letter: string): SubWave {
    return {
      ...wave,
      parentWave: wave.number,
      subWaveLetter: letter,
      fullWaveId: `${wave.number}${letter}`,
    };
  }

  /**
   * Validate split result (no dependency violations)
   */
  public validateSplit(result: SplitResult, graph: DependencyGraph): boolean {
    // Check that components in sub-wave N don't depend on sub-wave N+1
    for (let i = 0; i < result.splitWaves.length - 1; i++) {
      const currentWave = result.splitWaves[i];
      const laterWaves = result.splitWaves.slice(i + 1);
      const laterComponents = new Set(laterWaves.flatMap((w) => w.components));

      for (const component of currentWave.components) {
        const deps = graph.get(component) ?? new Set();

        for (const dep of deps) {
          if (laterComponents.has(dep)) {
            logger.error('Dependency violation detected', {
              component,
              dependsOn: dep,
              currentWave: currentWave.fullWaveId,
            });
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Generate split report
   */
  public generateReport(result: SplitResult): string {
    const lines: string[] = [];

    lines.push('# Wave Split Report');
    lines.push('');
    lines.push('## Statistics');
    lines.push(`- Original Waves: ${result.stats.originalWaveCount}`);
    lines.push(`- Final Waves: ${result.stats.finalWaveCount}`);
    lines.push(`- Waves Split: ${result.stats.splitWaveCount}`);
    lines.push(`- Total Components: ${result.stats.totalComponents}`);
    lines.push('');

    if (result.decisions.length > 0) {
      lines.push('## Split Decisions');
      lines.push('');

      for (const decision of result.decisions) {
        lines.push(`### Wave ${decision.waveNumber}`);
        lines.push(`- Reason: ${decision.reason}`);
        lines.push(`- Original Count: ${decision.originalCount}`);
        lines.push(`- Split Into: ${decision.subWaveCount} sub-waves`);
        lines.push(`- Distribution: ${decision.componentsPerSubWave.join(', ')}`);
        lines.push('');
      }
    } else {
      lines.push('## No Splits Required');
      lines.push('All waves are within limits.');
      lines.push('');
    }

    return lines.join('\n');
  }
}
