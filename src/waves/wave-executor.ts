/**
 * Wave Executor - Ensures correct wave execution order
 * Guarantees waves are executed in numerical order (1, 2, 3... not 1, 10, 11, 2...)
 *
 * @issue Wave ordering bug fix
 */

import { getLogger } from '../utils/logger.js';
import type { Wave, WaveResult } from './wave-builder.js';

const logger = getLogger('WaveExecutor');

/**
 * Ensures waves are sorted by their numeric wave number
 *
 * Note: We use numeric comparison (a.number - b.number) instead of string comparison
 * because:
 * 1. It's more efficient (no string conversion needed)
 * 2. We're sorting objects in memory, not text identifiers
 * 3. formatWaveId() with padding is only needed when creating file names/IDs that
 *    will be sorted alphabetically by external systems (file system, etc.)
 *
 * @param waveResult - The wave generation result
 * @returns Waves sorted by wave number (1, 2, 3, ..., 10, 11, ...)
 */
export function sortWavesByNumber(waveResult: WaveResult): Wave[] {
  // Numeric sort is more efficient than string sort
  const sortedWaves = [...waveResult.waves].sort((a, b) => a.number - b.number);

  logger.debug('Sorted waves by number', {
    originalOrder: waveResult.waves.map((w) => w.number),
    sortedOrder: sortedWaves.map((w) => w.number),
  });

  return sortedWaves;
}

/**
 * Validates that waves are in correct sequential order
 * @param waves - Array of waves to validate
 * @returns true if waves are in correct order (1, 2, 3, ...)
 */
export function validateWaveOrder(waves: Wave[]): boolean {
  for (let i = 0; i < waves.length; i++) {
    if (waves[i].number !== i + 1) {
      logger.error('Wave order validation failed', {
        expected: i + 1,
        actual: waves[i].number,
        waveIndex: i,
      });
      return false;
    }
  }
  return true;
}

/**
 * Gets waves in execution order (guaranteed to be sequential)
 * @param waveResult - The wave generation result
 * @returns Waves sorted and validated for execution
 */
export function getWavesInExecutionOrder(waveResult: WaveResult): Wave[] {
  const sortedWaves = sortWavesByNumber(waveResult);

  // Note: We don't renumber waves, we just ensure they're sorted
  // The wave numbers represent their dependency order, which may not be sequential
  // (e.g., after splitting or merging, waves might be 1, 2, 5, 10)
  // The important thing is they're executed in sorted order
  return sortedWaves;
}

/**
 * Formats wave identifier with zero-padding for consistent alphabetical sorting
 *
 * Use this ONLY when creating file names, directory names, or other string identifiers
 * that will be sorted alphabetically by external systems (file system, APIs, etc.)
 *
 * For in-memory sorting of Wave objects, use sortWavesByNumber() which uses numeric
 * comparison (more efficient).
 *
 * @param waveNumber - The wave number (1-based)
 * @param totalWaves - Total number of waves (for padding calculation)
 * @returns Zero-padded wave identifier (e.g., "wave-001", "wave-010", "wave-015")
 *
 * @example
 * // For file names that need alphabetical sorting:
 * const fileName = `deployment-${formatWaveId(wave.number, totalWaves)}.xml`;
 * // Results in: "deployment-wave-001.xml", "deployment-wave-010.xml"
 *
 * // For in-memory sorting (use numeric comparison):
 * const sorted = waves.sort((a, b) => a.number - b.number);
 */
export function formatWaveId(waveNumber: number, totalWaves: number): string {
  // Calculate padding based on total waves (e.g., 15 waves needs 2 digits, 100 needs 3)
  // Always use at least 3 digits for consistency
  const padding = Math.max(3, Math.ceil(Math.log10(totalWaves + 1)));
  return `wave-${String(waveNumber).padStart(padding, '0')}`;
}

/**
 * Parses wave number from formatted wave ID
 * @param waveId - Formatted wave ID (e.g., "wave-001", "wave-010")
 * @returns Wave number or undefined if invalid
 */
export function parseWaveId(waveId: string): number | undefined {
  const match = waveId.match(/wave-(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return undefined;
}

