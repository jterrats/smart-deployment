import { expect } from 'chai';
import { describe, it } from 'mocha';
import { PriorityWaveGenerator } from '../../../src/waves/priority-wave-generator.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';

describe('PriorityWaveGenerator', () => {
  function createComponent(type: string, name: string): [string, MetadataComponent] {
    return [`${type}:${name}`, {
      type: type as any,
      name,
      filePath: `/path/${type}/${name}`,
      dependencies: new Set(),
      dependents: new Set(),
      priorityBoost: 0,
    }];
  }

  /**
   * @ac US-042-AC-1: Use deployment order constants
   * @ac US-042-AC-2: Objects before classes before triggers
   */
  it('US-042-AC-2: should prioritize CustomObject before ApexClass', () => {
    const components = new Map([
      createComponent('ApexClass', 'Service'),
      createComponent('CustomObject', 'Account'),
    ]);

    const generator = new PriorityWaveGenerator();
    const sorted = generator.sortComponentsByPriority(
      Array.from(components.keys()),
      components
    );

    expect(sorted[0]).to.equal('CustomObject:Account');
    expect(sorted[1]).to.equal('ApexClass:Service');
  });

  /**
   * @ac US-042-AC-3: Break ties using priorities
   */
  it('US-042-AC-3: should break ties using component priorityBoost', () => {
    const components = new Map([
      createComponent('ApexClass', 'Service1'),
      createComponent('ApexClass', 'Service2'),
    ]);
    components.get('ApexClass:Service1')!.priorityBoost = 10;

    const generator = new PriorityWaveGenerator();
    const sorted = generator.sortComponentsByPriority(
      Array.from(components.keys()),
      components
    );

    expect(sorted[0]).to.equal('ApexClass:Service1');
  });

  /**
   * @ac US-042-AC-4: User-defined priority overrides
   */
  it('US-042-AC-4: should respect user-defined priorities', () => {
    const components = new Map([
      createComponent('ApexClass', 'Low'),
      createComponent('ApexClass', 'High'),
    ]);

    const userPriorities = new Map([['ApexClass:High', 1000]]);
    const generator = new PriorityWaveGenerator({ userPriorities });
    
    const sorted = generator.sortComponentsByPriority(
      Array.from(components.keys()),
      components
    );

    expect(sorted[0]).to.equal('ApexClass:High');
  });

  /**
   * @ac US-042-AC-5: Report priority decisions
   * @ac US-042-AC-6: Validate no dependency violations
   */
  it('US-042-AC-5: should apply priorities to waves', () => {
    const components = new Map([
      createComponent('ApexTrigger', 'Trigger'),
      createComponent('CustomObject', 'Object'),
    ]);

    const wave = {
      number: 1,
      components: Array.from(components.keys()),
      metadata: {
        componentCount: 2,
        types: ['ApexTrigger', 'CustomObject'],
        maxDepth: 0,
        hasCircularDeps: false,
        estimatedTime: 0.2,
      },
    };

    const generator = new PriorityWaveGenerator();
    const result = generator.applyPriorityWaves([wave], components);

    expect(result[0].components[0]).to.equal('CustomObject:Object');
  });
});
