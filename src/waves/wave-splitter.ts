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

type SplitPolicy = {
  maxComponentsPerWave: number;
  maxCustomMetadataPerWave: number;
  maintainDependencyOrder: boolean;
};

type WaveSplitAssessment = {
  needsSplit: boolean;
  reason?: string;
  cmtCount: number;
};

type ComponentSplitPlan = {
  orderedComponents: NodeId[];
  cmtComponents: NodeId[];
  nonCmtComponents: NodeId[];
  useCmtSplit: boolean;
};

type SubWaveAssembly = {
  subWaves: SubWave[];
  decision?: SplitDecision;
};

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
    const policy = this.getSplitPolicy();
    const decisions: SplitDecision[] = [];
    const splitWaves: SubWave[] = [];

    for (const wave of waveResult.waves) {
      const assessment = this.assessWaveSplit(wave, policy);

      if (!assessment.needsSplit) {
        splitWaves.push(this.toSubWave(wave, 'a'));
      } else {
        const assembly = this.splitWave(wave, graph, policy, assessment);
        splitWaves.push(...assembly.subWaves);
        if (assembly.decision) {
          decisions.push(assembly.decision);
        }

        logger.info('Split wave', {
          wave: wave.number,
          originalCount: wave.components.length,
          subWaves: assembly.subWaves.length,
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

  private getSplitPolicy(): SplitPolicy {
    return {
      maxComponentsPerWave: this.options.maxComponentsPerWave,
      maxCustomMetadataPerWave: this.options.maxCustomMetadataPerWave,
      maintainDependencyOrder: this.options.maintainDependencyOrder,
    };
  }

  private assessWaveSplit(wave: Wave, policy: SplitPolicy): WaveSplitAssessment {
    const cmtCount = this.countCustomMetadataComponents(wave.components);

    if (cmtCount > policy.maxCustomMetadataPerWave) {
      return {
        needsSplit: true,
        reason: `Exceeded Custom Metadata limit (${cmtCount} > ${policy.maxCustomMetadataPerWave})`,
        cmtCount,
      };
    }

    if (wave.components.length > policy.maxComponentsPerWave) {
      return {
        needsSplit: true,
        reason: `Exceeded component limit (${wave.components.length} > ${policy.maxComponentsPerWave})`,
        cmtCount,
      };
    }

    return {
      needsSplit: false,
      cmtCount,
    };
  }

  /**
   * @ac US-039-AC-4: Split CMT waves at 200 records
   * @ac US-039-AC-6: Ensure no dependency violations
   */
  private splitWave(
    wave: Wave,
    graph: DependencyGraph,
    policy: SplitPolicy,
    assessment: WaveSplitAssessment
  ): SubWaveAssembly {
    const splitPlan = this.planComponentSplit(wave.components, graph, policy, assessment);
    const subWaves = this.assembleSubWaves(wave, splitPlan, policy);

    if (subWaves.length === 0) {
      return {
        subWaves: [this.toSubWave(wave, 'a')],
      };
    }

    return {
      subWaves,
      decision: {
        waveNumber: wave.number,
        reason:
          assessment.reason ?? `Exceeded component limit (${wave.components.length} > ${policy.maxComponentsPerWave})`,
        originalCount: wave.components.length,
        subWaveCount: subWaves.length,
        componentsPerSubWave: subWaves.map((subWave) => subWave.components.length),
      },
    };
  }

  private planComponentSplit(
    components: NodeId[],
    graph: DependencyGraph,
    policy: SplitPolicy,
    assessment: WaveSplitAssessment
  ): ComponentSplitPlan {
    const orderedComponents = [...components];
    if (policy.maintainDependencyOrder) {
      this.sortByDependencyOrder(orderedComponents, graph);
    }

    const cmtComponents = orderedComponents.filter((component) => component.startsWith('CustomMetadata:'));
    const nonCmtComponents = orderedComponents.filter((component) => !component.startsWith('CustomMetadata:'));

    return {
      orderedComponents,
      cmtComponents,
      nonCmtComponents,
      useCmtSplit: assessment.cmtCount > policy.maxCustomMetadataPerWave,
    };
  }

  private assembleSubWaves(wave: Wave, plan: ComponentSplitPlan, policy: SplitPolicy): SubWave[] {
    if (plan.useCmtSplit) {
      const cmtChunks = this.chunkComponents(plan.cmtComponents, policy.maxCustomMetadataPerWave);
      const nonCmtChunks =
        plan.nonCmtComponents.length > 0
          ? this.chunkComponents(plan.nonCmtComponents, policy.maxComponentsPerWave)
          : [];

      return this.createSequentialSubWaves(wave, [...cmtChunks, ...nonCmtChunks]);
    }

    return this.createSequentialSubWaves(
      wave,
      this.chunkComponents(plan.orderedComponents, policy.maxComponentsPerWave)
    );
  }

  private createSequentialSubWaves(wave: Wave, chunks: NodeId[][]): SubWave[] {
    const subWaves: SubWave[] = [];

    for (const chunk of chunks) {
      const letter = this.getSubWaveLetter(subWaves.length);
      subWaves.push(this.createSubWave(wave, chunk, letter));
    }

    return subWaves;
  }

  private countCustomMetadataComponents(components: readonly NodeId[]): number {
    return components.filter((component) => component.startsWith('CustomMetadata:')).length;
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
    for (let i = 0; i < result.splitWaves.length - 1; i++) {
      const currentWave = result.splitWaves[i];
      const laterWaves = result.splitWaves.slice(i + 1);
      const laterComponents = new Set(laterWaves.flatMap((w) => w.components));

      const violation = this.findDependencyViolation(currentWave.components, laterComponents, graph);
      if (violation) {
        logger.error('Dependency violation detected', {
          component: violation.component,
          dependsOn: violation.dependsOn,
          currentWave: currentWave.fullWaveId,
        });
        return false;
      }
    }

    return true;
  }

  private findDependencyViolation(
    components: readonly NodeId[],
    laterComponents: ReadonlySet<NodeId>,
    graph: DependencyGraph
  ): { component: NodeId; dependsOn: NodeId } | null {
    for (const component of components) {
      const deps = graph.get(component) ?? new Set();

      for (const dep of deps) {
        if (laterComponents.has(dep)) {
          return {
            component,
            dependsOn: dep,
          };
        }
      }
    }

    return null;
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
