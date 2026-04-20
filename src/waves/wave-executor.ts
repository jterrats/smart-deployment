/**
 * Wave Executor Utilities
 * Ensures waves are executed in correct numerical order
 *
 * @ac Wave ordering fix: Ensure numerical execution order
 */

import type { Wave, WaveResult } from './wave-builder.js';

/**
 * Sort waves by numerical order (not alphabetical)
 * @example sortWavesByNumber({ waves: [wave10, wave2, wave1] }) => [wave1, wave2, wave10]
 */
export function sortWavesByNumber(result: WaveResult): Wave[] {
  return [...result.waves].sort((a, b) => a.number - b.number);
}

/**
 * Get waves in execution order (numerically sorted)
 */
export function getWavesInExecutionOrder(result: WaveResult): Wave[] {
  return sortWavesByNumber(result);
}

/**
 * Format wave ID with zero-padding for consistent alphabetical sorting
 * @example formatWaveId(1, 15) => "wave-001"
 */
export function formatWaveId(waveNumber: number, totalWaves: number): string {
  const padding = Math.max(3, String(totalWaves).length);
  return `wave-${String(waveNumber).padStart(padding, '0')}`;
}

/**
 * Parse wave ID back to number
 * @example parseWaveId("wave-001") => 1
 */
export function parseWaveId(waveId: string): number | undefined {
  const match = /^wave-(\d+)$/.exec(waveId);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

/**
 * Validate wave execution order
 */
export function validateWaveOrder(waves: Wave[]): boolean {
  for (let i = 0; i < waves.length; i++) {
    if (waves[i].number !== i + 1) {
      return false;
    }
  }
  return true;
}
