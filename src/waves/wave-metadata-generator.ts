/**
 * Wave Metadata Generator - US-044
 * @ac US-044-AC-1: Generate wave_metadata.json
 * @ac US-044-AC-2: Include component list per wave
 * @ac US-044-AC-3: Include dependency information
 * @ac US-044-AC-4: Include test requirements
 * @issue #44
 */
import type { Wave } from './wave-builder.js';

export class WaveMetadataGenerator {
  public generateMetadata(waves: Wave[]): string {
    return JSON.stringify({waves: waves.map(w => ({
      number: w.number,
      components: w.components,
      metadata: w.metadata
    }))}, null, 2);
  }
}
