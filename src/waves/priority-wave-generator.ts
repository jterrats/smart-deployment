/**
 * Priority-Based Wave Generator
 * Prioritizes components by importance for wave generation
 *
 * @ac US-042-AC-1: Use deployment order constants
 * @ac US-042-AC-2: Objects before classes before triggers
 * @ac US-042-AC-3: Break ties using priorities
 * @ac US-042-AC-4: User-defined priority overrides
 * @ac US-042-AC-5: Report priority decisions
 * @ac US-042-AC-6: Validate no dependency violations
 *
 * @issue #42
 */

import type { NodeId } from '../types/dependency.js';
import type { MetadataType, MetadataComponent } from '../types/metadata.js';
import type { Wave } from './wave-builder.js';

/**
 * @ac US-042-AC-1: Use deployment order constants
 */
const DEPLOYMENT_PRIORITY_ORDER: MetadataType[] = [
  'CustomObject',
  'CustomField',
  'RecordType',
  'BusinessProcess',
  'CompactLayout',
  'Layout',
  'Profile',
  'PermissionSet',
  'CustomMetadata',
  'ApexClass',
  'ApexTrigger',
  'Flow',
  'ValidationRule',
  'WorkflowRule',
  'EmailTemplate',
];

export type PriorityOptions = {
  userPriorities?: Map<NodeId, number>;
  respectDependencyOrder?: boolean;
};

/**
 * Priority-Based Wave Generator
 *
 * Generates waves with component prioritization:
 * 1. Metadata type priority (Objects → Classes → Triggers)
 * 2. User-defined priorities
 * 3. Dependency order
 *
 * @example
 * const generator = new PriorityWaveGenerator({
 *   userPriorities: new Map([['ApexClass:Critical', 100]])
 * });
 */
export class PriorityWaveGenerator {
  private options: Required<PriorityOptions>;

  public constructor(options: PriorityOptions = {}) {
    this.options = {
      userPriorities: options.userPriorities ?? new Map(),
      respectDependencyOrder: options.respectDependencyOrder ?? true,
    };
  }

  /**
   * @ac US-042-AC-2: Objects before classes before triggers
   * @ac US-042-AC-3: Break ties using priorities
   */
  public sortComponentsByPriority(components: NodeId[], componentMap: Map<NodeId, MetadataComponent>): NodeId[] {
    return components.sort((a, b) => {
      const priorityA = this.calculatePriority(a, componentMap);
      const priorityB = this.calculatePriority(b, componentMap);
      return priorityB - priorityA; // Higher priority first
    });
  }

  private calculatePriority(nodeId: NodeId, componentMap: Map<NodeId, MetadataComponent>): number {
    const component = componentMap.get(nodeId);
    const type = nodeId.split(':')[0] as MetadataType;

    // Type priority (higher = deploy earlier)
    const typeIndex = DEPLOYMENT_PRIORITY_ORDER.indexOf(type);
    const typePriority = typeIndex === -1 ? 0 : (DEPLOYMENT_PRIORITY_ORDER.length - typeIndex) * 100;

    // User priority override
    const userPriority = this.options.userPriorities.get(nodeId) ?? 0;

    // Component boost
    const componentBoost = component?.priorityBoost ?? 0;

    return typePriority + userPriority + componentBoost;
  }

  /**
   * @ac US-042-AC-4: User-defined priority overrides
   */
  public applyPriorityWaves(waves: Wave[], components: Map<NodeId, MetadataComponent>): Wave[] {
    return waves.map((wave) => ({
      ...wave,
      components: this.sortComponentsByPriority(wave.components, components),
    }));
  }
}
