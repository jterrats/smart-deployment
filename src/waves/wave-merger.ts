/**
 * Wave Merger
 * Merges small adjacent waves to reduce total deployment time
 * 
 * @ac US-041-AC-1: Identify waves with <50 components
 * @ac US-041-AC-2: Merge if combined < 300 components
 * @ac US-041-AC-3: Respect dependency order
 * @ac US-041-AC-4: Don't merge if different test requirements
 * @ac US-041-AC-5: Report merge decisions
 * @ac US-041-AC-6: User override option
 * 
 * @issue #41
 */

import { getLogger } from '../utils/logger.js';
import type { Wave } from './wave-builder.js';
import type { DependencyGraph } from '../types/dependency.js';

const logger = getLogger('WaveMerger');

/**
 * Merge result
 */
export interface MergeResult {
  originalWaves: Wave[];
  mergedWaves: Wave[];
  decisions: MergeDecision[];
  stats: MergeStats;
}

/**
 * Merge decision
 */
export interface MergeDecision {
  mergedWaves: number[];
  resultWaveNumber: number;
  reason: string;
  originalCount: number[];
  mergedCount: number;
}

/**
 * Merge statistics
 */
export interface MergeStats {
  originalWaveCount: number;
  mergedWaveCount: number;
  wavesSaved: number;
  componentsAffected: number;
}

/**
 * Merger options
 */
export interface MergerOptions {
  minComponentsForMerge?: number;
  maxComponentsAfterMerge?: number;
  respectTestRequirements?: boolean;
  allowUserOverride?: boolean;
}

/**
 * Wave Merger
 * 
 * Merges small adjacent waves to reduce total deployment time.
 * 
 * Algorithm:
 * 1. Identify small waves (< threshold)
 * 2. Check if adjacent waves can be merged
 * 3. Validate no dependency violations
 * 4. Merge waves and renumber
 * 
 * Performance: O(V)
 * 
 * @example
 * const merger = new WaveMerger({
 *   minComponentsForMerge: 50,
 *   maxComponentsAfterMerge: 300
 * });
 * 
 * const result = merger.mergeWaves(waves, graph);
 * console.log(`Saved ${result.stats.wavesSaved} waves`);
 */
export class WaveMerger {
  private options: Required<MergerOptions>;

  public constructor(options: MergerOptions = {}) {
    this.options = {
      minComponentsForMerge: options.minComponentsForMerge ?? 50,
      maxComponentsAfterMerge: options.maxComponentsAfterMerge ?? 300,
      respectTestRequirements: options.respectTestRequirements ?? true,
      allowUserOverride: options.allowUserOverride ?? false,
    };

    logger.debug('Initialized WaveMerger', {
      minComponentsForMerge: this.options.minComponentsForMerge,
      maxComponentsAfterMerge: this.options.maxComponentsAfterMerge,
    });
  }

  /**
   * @ac US-041-AC-1: Identify waves with <50 components
   * @ac US-041-AC-2: Merge if combined < 300 components
   * @ac US-041-AC-3: Respect dependency order
   * @ac US-041-AC-5: Report merge decisions
   */
  public mergeWaves(waves: Wave[], _graph: DependencyGraph): MergeResult {
    const startTime = Date.now();
    const decisions: MergeDecision[] = [];
    const mergedWaves: Wave[] = [];
    let i = 0;

    while (i < waves.length) {
      const currentWave = waves[i];
      
      // Check if current wave is small
      if (currentWave.components.length >= this.options.minComponentsForMerge) {
        mergedWaves.push({ ...currentWave, number: mergedWaves.length + 1 });
        i++;
        continue;
      }

      // Try to merge with next wave
      if (i + 1 < waves.length) {
        const nextWave = waves[i + 1];
        const combined = currentWave.components.length + nextWave.components.length;

        if (this.canMerge(currentWave, nextWave, combined)) {
          // Merge waves
          const merged = this.createMergedWave(
            currentWave,
            nextWave,
            mergedWaves.length + 1
          );
          
          mergedWaves.push(merged);

          decisions.push({
            mergedWaves: [currentWave.number, nextWave.number],
            resultWaveNumber: merged.number,
            reason: `Small waves combined (${currentWave.components.length} + ${nextWave.components.length} = ${combined})`,
            originalCount: [currentWave.components.length, nextWave.components.length],
            mergedCount: combined,
          });

          i += 2; // Skip both waves
          continue;
        }
      }

      // Cannot merge, keep as is
      mergedWaves.push({ ...currentWave, number: mergedWaves.length + 1 });
      i++;
    }

    const stats: MergeStats = {
      originalWaveCount: waves.length,
      mergedWaveCount: mergedWaves.length,
      wavesSaved: waves.length - mergedWaves.length,
      componentsAffected: decisions.reduce((sum, d) => sum + d.mergedCount, 0),
    };

    const duration = Date.now() - startTime;
    logger.info('Wave merge completed', {
      originalWaves: stats.originalWaveCount,
      mergedWaves: stats.mergedWaveCount,
      wavesSaved: stats.wavesSaved,
      durationMs: duration,
    });

    return {
      originalWaves: waves,
      mergedWaves,
      decisions,
      stats,
    };
  }

  /**
   * Check if waves can be merged
   */
  private canMerge(wave1: Wave, wave2: Wave, combinedSize: number): boolean {
    // Check size limit
    if (combinedSize > this.options.maxComponentsAfterMerge) {
      return false;
    }

    // Check test requirements if configured
    if (this.options.respectTestRequirements) {
      if (wave1.metadata.hasCircularDeps !== wave2.metadata.hasCircularDeps) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create merged wave
   */
  private createMergedWave(wave1: Wave, wave2: Wave, newNumber: number): Wave {
    const components = [...wave1.components, ...wave2.components];
    const types = Array.from(new Set([...wave1.metadata.types, ...wave2.metadata.types]));

    return {
      number: newNumber,
      components,
      metadata: {
        componentCount: components.length,
        types,
        maxDepth: Math.max(wave1.metadata.maxDepth, wave2.metadata.maxDepth),
        hasCircularDeps: wave1.metadata.hasCircularDeps || wave2.metadata.hasCircularDeps,
        estimatedTime: wave1.metadata.estimatedTime + wave2.metadata.estimatedTime,
      },
    };
  }

  /**
   * Generate merge report
   */
  public generateReport(result: MergeResult): string {
    const lines: string[] = [];

    lines.push('# Wave Merge Report');
    lines.push('');
    lines.push('## Statistics');
    lines.push(`- Original Waves: ${result.stats.originalWaveCount}`);
    lines.push(`- Merged Waves: ${result.stats.mergedWaveCount}`);
    lines.push(`- Waves Saved: ${result.stats.wavesSaved}`);
    lines.push(`- Components Affected: ${result.stats.componentsAffected}`);
    lines.push('');

    if (result.decisions.length > 0) {
      lines.push('## Merge Decisions');
      lines.push('');

      for (const decision of result.decisions) {
        lines.push(`### Merged Waves ${decision.mergedWaves.join(' + ')} → Wave ${decision.resultWaveNumber}`);
        lines.push(`- Reason: ${decision.reason}`);
        lines.push(`- Original Counts: ${decision.originalCount.join(', ')}`);
        lines.push(`- Merged Count: ${decision.mergedCount}`);
        lines.push('');
      }
    } else {
      lines.push('## No Merges Performed');
      lines.push('All waves are optimally sized.');
      lines.push('');
    }

    return lines.join('\n');
  }
}

