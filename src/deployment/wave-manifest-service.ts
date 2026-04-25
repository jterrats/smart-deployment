import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import type { NodeId } from '../types/dependency.js';
import type { MetadataComponent, MetadataType } from '../types/metadata.js';

export type WaveManifestParams = {
  baseDir: string;
  waveNumber: number;
  components: NodeId[];
  componentMap: ReadonlyMap<NodeId, MetadataComponent>;
};

export class WaveManifestService {
  public async generateManifest(params: WaveManifestParams): Promise<string> {
    const manifestDir = path.join(params.baseDir, '.smart-deployment', 'manifests');
    await mkdir(manifestDir, { recursive: true });

    const grouped = new Map<MetadataType, Set<string>>();
    for (const nodeId of params.components) {
      const component = params.componentMap.get(nodeId);
      if (!component) {
        continue;
      }

      if (!grouped.has(component.type)) {
        grouped.set(component.type, new Set());
      }
      grouped.get(component.type)!.add(component.name);
    }

    const typeBlocks = [...grouped.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([type, members]) => {
        const memberLines = [...members]
          .sort((left, right) => left.localeCompare(right))
          .map((member) => `        <members>${member}</members>`)
          .join('\n');

        return ['    <types>', memberLines, `        <name>${type}</name>`, '    </types>'].join('\n');
      })
      .join('\n');

    const content = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Package xmlns="http://soap.sforce.com/2006/04/metadata">',
      typeBlocks,
      '    <version>61.0</version>',
      '</Package>',
      '',
    ].join('\n');

    const manifestPath = path.join(manifestDir, `wave-${String(params.waveNumber).padStart(3, '0')}.xml`);
    await writeFile(manifestPath, content, 'utf8');
    return manifestPath;
  }
}
