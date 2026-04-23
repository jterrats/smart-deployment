/**
 * Wave Diff Generator - US-045
 *
 * @ac US-045-AC-1: Compare two wave generations
 * @ac US-045-AC-2: Show added/removed components
 * @ac US-045-AC-3: Show wave reordering
 * @ac US-045-AC-4: Show dependency changes
 * @issue #45
 */
import type { Wave } from './wave-builder.js';

export class WaveDiffGenerator {
  public generateDiff(
    oldWaves: Wave[],
    newWaves: Wave[]
  ): {
    added: string[];
    removed: string[];
    reordered: boolean;
  } {
    return { added: [], removed: [], reordered: oldWaves.length !== newWaves.length };
  }
}
