import * as path from 'node:path';
import { parsePermissionSet } from '../../parsers/permission-set-parser.js';
import { parseProfile } from '../../parsers/profile-parser.js';
import type { MetadataComponent } from '../../types/metadata.js';

function addAll(target: Set<string>, values: Iterable<string>, defaultType?: string): void {
  for (const value of values) {
    target.add(defaultType && !value.includes(':') ? `${defaultType}:${value}` : value);
  }
}

export async function parseProfileComponent(filePath: string): Promise<MetadataComponent | undefined> {
  const profileName = path.basename(filePath, '.profile-meta.xml');
  const parsed = await parseProfile(filePath, profileName);

  const deps = new Set<string>();
  const optionalDependencies = new Set<string>();
  addAll(deps, parsed.dependencies.objects);
  addAll(deps, parsed.dependencies.fields);
  addAll(deps, parsed.dependencies.apexClasses, 'ApexClass');
  addAll(deps, parsed.dependencies.layouts, 'Layout');
  addAll(deps, parsed.dependencies.visualforcePages, 'VisualforcePage');
  addAll(deps, parsed.dependencies.recordTypes, 'RecordType');
  addAll(deps, parsed.dependencies.applications, 'LightningApp');
  addAll(deps, parsed.dependencies.tabs);
  addAll(deps, parsed.dependencies.customPermissions, 'CustomPermission');
  addAll(deps, parsed.dependencies.customMetadataTypes, 'CustomMetadata');
  addAll(deps, parsed.dependencies.flows, 'Flow');
  addAll(deps, parsed.dependencies.externalDataSources);
  addAll(deps, parsed.dependencies.customSettings);
  addAll(optionalDependencies, parsed.optionalDependencies.layouts, 'Layout');
  addAll(optionalDependencies, parsed.optionalDependencies.visualforcePages, 'VisualforcePage');
  addAll(optionalDependencies, parsed.optionalDependencies.applications, 'LightningApp');
  addAll(optionalDependencies, parsed.optionalDependencies.tabs);

  return {
    name: profileName,
    type: 'Profile' as const,
    filePath,
    dependencies: deps,
    optionalDependencies,
    dependents: new Set<string>(),
    priorityBoost: 0,
  };
}

export async function parsePermissionSetComponent(filePath: string): Promise<MetadataComponent | undefined> {
  const permSetName = path.basename(filePath, '.permissionset-meta.xml');
  const parsed = await parsePermissionSet(filePath, permSetName);

  const deps = new Set<string>();
  const optionalDependencies = new Set<string>();
  addAll(deps, parsed.dependencies.objects);
  addAll(deps, parsed.dependencies.fields);
  addAll(deps, parsed.dependencies.apexClasses, 'ApexClass');
  addAll(deps, parsed.dependencies.visualforcePages, 'VisualforcePage');
  addAll(deps, parsed.dependencies.customPermissions, 'CustomPermission');
  addAll(deps, parsed.dependencies.applications, 'LightningApp');
  addAll(deps, parsed.dependencies.tabs);
  addAll(deps, parsed.dependencies.customMetadataTypes, 'CustomMetadata');
  addAll(deps, parsed.dependencies.flows, 'Flow');
  addAll(deps, parsed.dependencies.externalDataSources);
  addAll(deps, parsed.dependencies.customSettings);
  addAll(deps, parsed.dependencies.recordTypes, 'RecordType');
  addAll(optionalDependencies, parsed.optionalDependencies.visualforcePages, 'VisualforcePage');
  addAll(optionalDependencies, parsed.optionalDependencies.applications, 'LightningApp');
  addAll(optionalDependencies, parsed.optionalDependencies.tabs);

  return {
    name: permSetName,
    type: 'PermissionSet' as const,
    filePath,
    dependencies: deps,
    optionalDependencies,
    dependents: new Set<string>(),
    priorityBoost: 0,
  };
}
