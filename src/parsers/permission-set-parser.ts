/**
 * Permission Set Parser
 * Parses Salesforce Permission Set metadata files (.permissionset-meta.xml)
 *
 * @ac AC-1: Parse permission set metadata files
 * @ac AC-2: Extract object permissions (CRUD + modify/view all)
 * @ac AC-3: Extract field-level security (FLS) permissions
 * @ac AC-4: Extract Apex class access permissions
 * @ac AC-5: Extract Visualforce page access permissions
 * @ac AC-6: Extract custom permission references
 * @ac AC-7: Extract application visibility settings
 * @ac AC-8: Extract tab visibility settings
 * @ac AC-9: Identify all dependent metadata types
 *
 * @issue #22
 */

import { readFile } from 'node:fs/promises';
import { XMLParser } from 'fast-xml-parser';
import type { PermissionSetMetadata } from '../types/salesforce/permission.js';

/**
 * Result of parsing a Permission Set file
 */
export type PermissionSetParseResult = {
  /** Name of the permission set (from filename) */
  name: string;
  /** Permission set label */
  label: string;
  /** Description */
  description?: string;
  /** Whether activation is required */
  hasActivationRequired?: boolean;
  /** License type (e.g., 'Salesforce', 'SalesforcePlatform') */
  license?: string;
  /** Objects with permissions granted */
  objectPermissions: string[];
  /** Fields with FLS permissions granted */
  fieldPermissions: string[];
  /** Apex classes with access granted */
  apexClassAccesses: string[];
  /** Visualforce pages with access granted */
  visualforcePageAccesses: string[];
  /** Custom permissions granted */
  customPermissions: string[];
  /** Applications with visibility settings */
  applicationVisibilities: string[];
  /** Tabs with visibility settings */
  tabSettings: string[];
  /** Custom Metadata Types with access */
  customMetadataTypeAccesses: string[];
  /** Flows with access */
  flowAccesses: string[];
  /** External data sources with access */
  externalDataSourceAccesses: string[];
  /** Custom settings with access */
  customSettingAccesses: string[];
  /** User permissions granted */
  userPermissions: string[];
  /** All dependencies extracted from this permission set */
  dependencies: {
    objects: string[];
    fields: string[];
    apexClasses: string[];
    visualforcePages: string[];
    customPermissions: string[];
    applications: string[];
    tabs: string[];
    customMetadataTypes: string[];
    flows: string[];
    externalDataSources: string[];
    customSettings: string[];
    recordTypes: string[];
  };
  /** Soft dependencies that may not block deploy ordering */
  optionalDependencies: {
    visualforcePages: string[];
    applications: string[];
    tabs: string[];
  };
};

/**
 * Normalize value to array (handles XML parser returning single object vs array)
 */
function normalizeArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function uniqueDefined(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function hasObjectAccess(permission: {
  allowCreate?: boolean;
  allowDelete?: boolean;
  allowEdit?: boolean;
  allowRead?: boolean;
  modifyAllRecords?: boolean;
  viewAllRecords?: boolean;
}): boolean {
  return [
    permission.allowCreate,
    permission.allowDelete,
    permission.allowEdit,
    permission.allowRead,
    permission.modifyAllRecords,
    permission.viewAllRecords,
  ].some((value) => value === true);
}

/**
 * Parse a Permission Set metadata XML file
 *
 * @param filePath - Path to the .permissionset-meta.xml file
 * @param permissionSetName - Name of the permission set (typically from filename)
 * @returns Parsed permission set metadata with dependencies
 *
 * @example
 * const result = await parsePermissionSet(
 *   'force-app/main/default/permissionsets/Sales_User.permissionset-meta.xml',
 *   'Sales_User'
 * );
 * console.log(result.objectPermissions); // ['Account', 'Contact', 'Opportunity']
 * console.log(result.dependencies.apexClasses); // ['AccountService', 'OpportunityHandler']
 */
export async function parsePermissionSet(
  filePath: string,
  permissionSetName: string
): Promise<PermissionSetParseResult> {
  // Read and parse XML
  const xmlContent = await readFile(filePath, 'utf-8');
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseAttributeValue: true,
    trimValues: true,
  });

  let parsed: unknown;
  try {
    parsed = parser.parse(xmlContent);
  } catch (error) {
    throw new Error(
      `Failed to parse Permission Set XML at ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Type assertion with validation
  const root = parsed as { PermissionSet?: PermissionSetMetadata };
  if (!root.PermissionSet) {
    throw new Error(`Invalid Permission Set XML structure at ${filePath}: missing PermissionSet root element`);
  }

  const metadata = root.PermissionSet;

  // Normalize arrays
  const objectPermissions = normalizeArray(metadata.objectPermissions);
  const fieldPermissions = normalizeArray(metadata.fieldPermissions);
  const classAccesses = normalizeArray(metadata.classAccesses);
  const pageAccesses = normalizeArray(metadata.pageAccesses);
  const customPermissions = normalizeArray(metadata.customPermissions);
  const applicationVisibilities = normalizeArray(metadata.applicationVisibilities);
  const tabSettings = normalizeArray(metadata.tabSettings);
  const customMetadataTypeAccesses = normalizeArray(metadata.customMetadataTypeAccesses);
  const flowAccesses = normalizeArray(metadata.flowAccesses);
  const externalDataSourceAccesses = normalizeArray(metadata.externalDataSourceAccesses);
  const customSettingAccesses = normalizeArray(metadata.customSettingAccesses);
  const userPermissions = normalizeArray(metadata.userPermissions);
  const recordTypeVisibilities = normalizeArray(metadata.recordTypeVisibilities);

  const objectNames = uniqueDefined(
    objectPermissions.filter((perm) => hasObjectAccess(perm)).map((perm) => perm.object)
  );

  const fieldNames = uniqueDefined(
    fieldPermissions.filter((perm) => perm.editable || perm.readable).map((perm) => perm.field)
  );

  const apexClassNames = uniqueDefined(
    classAccesses.filter((access) => access.enabled).map((access) => access.apexClass)
  );

  const visualforcePageNames = uniqueDefined(
    pageAccesses.filter((access) => access.enabled).map((access) => access.apexPage)
  );

  const customPermissionNames = uniqueDefined(
    customPermissions.filter((perm) => perm.enabled).map((perm) => perm.name)
  );

  const applicationNames = uniqueDefined(
    applicationVisibilities.filter((app) => app.visible).map((app) => app.application)
  );

  const tabNames = uniqueDefined(tabSettings.filter((tab) => tab.visibility !== 'None').map((tab) => tab.tab));

  const customMetadataTypeNames = uniqueDefined(
    customMetadataTypeAccesses.filter((access) => access.enabled).map((access) => access.name)
  );

  const flowNames = uniqueDefined(flowAccesses.filter((access) => access.enabled).map((access) => access.flow));

  const externalDataSourceNames = uniqueDefined(
    externalDataSourceAccesses.filter((access) => access.enabled).map((access) => access.externalDataSource)
  );

  const customSettingNames = uniqueDefined(
    customSettingAccesses.filter((access) => access.enabled).map((access) => access.name)
  );

  const userPermissionNames = uniqueDefined(userPermissions.filter((perm) => perm.enabled).map((perm) => perm.name));

  const recordTypeNames = uniqueDefined(recordTypeVisibilities.filter((rt) => rt.visible).map((rt) => rt.recordType));

  // Build result
  return {
    name: permissionSetName,
    label: metadata.label,
    description: metadata.description,
    hasActivationRequired: metadata.hasActivationRequired,
    license: metadata.license,
    objectPermissions: objectNames,
    fieldPermissions: fieldNames,
    apexClassAccesses: apexClassNames,
    visualforcePageAccesses: visualforcePageNames,
    customPermissions: customPermissionNames,
    applicationVisibilities: applicationNames,
    tabSettings: tabNames,
    customMetadataTypeAccesses: customMetadataTypeNames,
    flowAccesses: flowNames,
    externalDataSourceAccesses: externalDataSourceNames,
    customSettingAccesses: customSettingNames,
    userPermissions: userPermissionNames,
    dependencies: {
      objects: objectNames,
      fields: fieldNames,
      apexClasses: apexClassNames,
      visualforcePages: visualforcePageNames,
      customPermissions: customPermissionNames,
      applications: applicationNames,
      tabs: tabNames,
      customMetadataTypes: customMetadataTypeNames,
      flows: flowNames,
      externalDataSources: externalDataSourceNames,
      customSettings: customSettingNames,
      recordTypes: recordTypeNames,
    },
    optionalDependencies: {
      visualforcePages: visualforcePageNames,
      applications: applicationNames,
      tabs: tabNames,
    },
  };
}
