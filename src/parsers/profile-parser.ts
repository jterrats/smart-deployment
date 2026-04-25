/**
 * Profile Parser
 * Parses Salesforce Profile metadata files (.profile-meta.xml)
 *
 * @ac US-020-AC-1: Extract object permissions (CRUD + modify/view all)
 * @ac US-020-AC-2: Extract field-level security (FLS) permissions
 * @ac US-020-AC-3: Extract Apex class access permissions
 * @ac US-020-AC-4: Extract page layout assignments
 * @ac US-020-AC-5: Extract record type visibility
 * @ac US-020-AC-6: Extract application assignments
 * @ac US-020-AC-7: Link to all dependent metadata
 *
 * @issue #20
 */

import { readFile } from 'node:fs/promises';
import { XMLParser } from 'fast-xml-parser';
import type { ProfileMetadata } from '../types/salesforce/permission.js';

/**
 * Result of parsing a Profile file
 */
export type ProfileParseResult = {
  /** Name of the profile (from filename) */
  name: string;
  /** Whether this is a custom profile */
  custom: boolean;
  /** Description */
  description?: string;
  /** User license */
  userLicense?: string;
  /** Objects with permissions granted */
  objectPermissions: string[];
  /** Fields with FLS permissions granted */
  fieldPermissions: string[];
  /** Apex classes with access granted */
  apexClassAccesses: string[];
  /** Visualforce pages with access granted */
  visualforcePageAccesses: string[];
  /** Page layout assignments */
  layoutAssignments: string[];
  /** Record types with visibility */
  recordTypeVisibilities: string[];
  /** Applications assigned */
  applicationVisibilities: string[];
  /** Tabs with visibility settings */
  tabVisibilities: string[];
  /** Custom permissions granted */
  customPermissions: string[];
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
  /** All dependencies extracted from this profile */
  dependencies: {
    objects: string[];
    fields: string[];
    apexClasses: string[];
    visualforcePages: string[];
    layouts: string[];
    recordTypes: string[];
    applications: string[];
    tabs: string[];
    customPermissions: string[];
    customMetadataTypes: string[];
    flows: string[];
    externalDataSources: string[];
    customSettings: string[];
  };
  /** Soft dependencies that may not block deploy ordering */
  optionalDependencies: {
    layouts: string[];
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
 * Parse a Profile metadata XML file
 *
 * @param filePath - Path to the .profile-meta.xml file
 * @param profileName - Name of the profile (typically from filename)
 * @returns Parsed profile metadata with dependencies
 *
 * @example
 * const result = await parseProfile(
 *   'force-app/main/default/profiles/Admin.profile-meta.xml',
 *   'Admin'
 * );
 * console.log(result.objectPermissions); // ['Account', 'Contact', 'Opportunity']
 * console.log(result.dependencies.apexClasses); // ['AccountService', 'OpportunityHandler']
 */
export async function parseProfile(filePath: string, profileName: string): Promise<ProfileParseResult> {
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
      `Failed to parse Profile XML at ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Type assertion with validation
  const root = parsed as { Profile?: ProfileMetadata };
  if (!root.Profile) {
    throw new Error(`Invalid Profile XML structure at ${filePath}: missing Profile root element`);
  }

  const metadata = root.Profile;

  // Normalize arrays
  const objectPermissions = normalizeArray(metadata.objectPermissions);
  const fieldPermissions = normalizeArray(metadata.fieldPermissions);
  const classAccesses = normalizeArray(metadata.classAccesses);
  const pageAccesses = normalizeArray(metadata.pageAccesses);
  const layoutAssignments = normalizeArray(metadata.layoutAssignments);
  const recordTypeVisibilities = normalizeArray(metadata.recordTypeVisibilities);
  const applicationVisibilities = normalizeArray(metadata.applicationVisibilities);
  const tabVisibilities = normalizeArray(metadata.tabVisibilities);
  const customPermissions = normalizeArray(metadata.customPermissions);
  const customMetadataTypeAccesses = normalizeArray(metadata.customMetadataTypeAccesses);
  const externalDataSourceAccesses = normalizeArray(metadata.externalDataSourceAccesses);
  const customSettingAccesses = normalizeArray(metadata.customSettingAccesses);
  const flowAccesses = normalizeArray(metadata.flowAccesses);
  const userPermissions = normalizeArray(metadata.userPermissions);

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

  const layoutNames = uniqueDefined(layoutAssignments.map((assignment) => assignment.layout));

  const recordTypeNames = uniqueDefined(recordTypeVisibilities.filter((rt) => rt.visible).map((rt) => rt.recordType));

  const applicationNames = uniqueDefined(
    applicationVisibilities.filter((app) => app.visible).map((app) => app.application)
  );

  const tabNames = uniqueDefined(tabVisibilities.filter((tab) => tab.visibility !== 'Hidden').map((tab) => tab.tab));

  const customPermissionNames = customPermissions.filter((perm) => perm.enabled).map((perm) => perm.name);

  const customMetadataTypeNames = uniqueDefined(
    customMetadataTypeAccesses.filter((access) => access.enabled).map((access) => access.name)
  );

  const externalDataSourceNames = uniqueDefined(
    externalDataSourceAccesses.filter((access) => access.enabled).map((access) => access.externalDataSource)
  );

  const customSettingNames = uniqueDefined(
    customSettingAccesses.filter((access) => access.enabled).map((access) => access.name)
  );

  const flowNames = uniqueDefined(flowAccesses.filter((access) => access.enabled).map((access) => access.flow));

  const userPermissionNames = uniqueDefined(userPermissions.filter((perm) => perm.enabled).map((perm) => perm.name));

  // Build result
  return {
    name: profileName,
    custom: metadata.custom ?? false,
    description: metadata.description,
    userLicense: metadata.userLicense,
    objectPermissions: objectNames,
    fieldPermissions: fieldNames,
    apexClassAccesses: apexClassNames,
    visualforcePageAccesses: visualforcePageNames,
    layoutAssignments: layoutNames,
    recordTypeVisibilities: recordTypeNames,
    applicationVisibilities: applicationNames,
    tabVisibilities: tabNames,
    customPermissions: customPermissionNames,
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
      layouts: layoutNames,
      recordTypes: recordTypeNames,
      applications: applicationNames,
      tabs: tabNames,
      customPermissions: customPermissionNames,
      customMetadataTypes: customMetadataTypeNames,
      flows: flowNames,
      externalDataSources: externalDataSourceNames,
      customSettings: customSettingNames,
    },
    optionalDependencies: {
      layouts: layoutNames,
      visualforcePages: visualforcePageNames,
      applications: applicationNames,
      tabs: tabNames,
    },
  };
}
