import { mkdtemp, readFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { WaveManifestService } from '../../../src/deployment/wave-manifest-service.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';

describe('WaveManifestService', () => {
  it('generates a sorted package.xml manifest for a wave', async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), 'wave-manifest-'));
    const service = new WaveManifestService();
    const components = new Map<string, MetadataComponent>([
      [
        'ApexClass:BetaService',
        {
          name: 'BetaService',
          type: 'ApexClass',
          filePath: 'force-app/main/default/classes/BetaService.cls',
          dependencies: new Set<string>(),
          dependents: new Set<string>(),
          priorityBoost: 0,
        },
      ],
      [
        'CustomObject:Invoice__c',
        {
          name: 'Invoice__c',
          type: 'CustomObject',
          filePath: 'force-app/main/default/objects/Invoice__c/Invoice__c.object-meta.xml',
          dependencies: new Set<string>(),
          dependents: new Set<string>(),
          priorityBoost: 0,
        },
      ],
      [
        'ApexClass:AlphaService',
        {
          name: 'AlphaService',
          type: 'ApexClass',
          filePath: 'force-app/main/default/classes/AlphaService.cls',
          dependencies: new Set<string>(),
          dependents: new Set<string>(),
          priorityBoost: 0,
        },
      ],
    ]);

    const manifestPath = await service.generateManifest({
      baseDir,
      waveNumber: 7,
      components: ['ApexClass:BetaService', 'CustomObject:Invoice__c', 'ApexClass:AlphaService'],
      componentMap: components,
    });

    const content = await readFile(manifestPath, 'utf8');

    expect(manifestPath).to.match(/wave-007\.xml$/);
    expect(content).to.include('<name>ApexClass</name>');
    expect(content).to.include('<name>CustomObject</name>');
    expect(content.indexOf('<members>AlphaService</members>')).to.be.lessThan(
      content.indexOf('<members>BetaService</members>')
    );
    expect(content.indexOf('<name>ApexClass</name>')).to.be.lessThan(content.indexOf('<name>CustomObject</name>'));
    expect(content).to.include('<version>61.0</version>');
  });
});
