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
  };
};

/**
 * Normalize value to array (handles XML parser returning single object vs array)
 */
function normalizeArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
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
export async function parseProfile(
  filePath: string,
  profileName: string
): Promise<ProfileParseResult> {
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
  const flowAccesses = normalizeArray(metadata.flowAccesses);
  const userPermissions = normalizeArray(metadata.userPermissions);

  // Extract object names
  const objectNames = objectPermissions.map((perm) => perm.object);

  // Extract field names (format: ObjectName.FieldName)
  const fieldNames = fieldPermissions.map((perm) => perm.field);

  // Extract Apex class names
  const apexClassNames = classAccesses.map((access) => access.apexClass);

  // Extract Visualforce page names
  const visualforcePageNames = pageAccesses.map((access) => access.apexPage);

  // Extract layout names
  const layoutNames = layoutAssignments.map((assignment) => assignment.layout);

  // Extract record type names
  const recordTypeNames = recordTypeVisibilities
    .filter((rt) => rt.visible)
    .map((rt) => rt.recordType);

  // Extract application names
  const applicationNames = applicationVisibilities.map((app) => app.application);

  // Extract tab names
  const tabNames = tabVisibilities.map((tab) => tab.tab);

  // Extract custom permission names
  const customPermissionNames = customPermissions
    .filter((perm) => perm.enabled)
    .map((perm) => perm.name);

  // Extract custom metadata type names
  const customMetadataTypeNames = customMetadataTypeAccesses
    .filter((access) => access.enabled)
    .map((access) => access.name);

  // Extract flow names
  const flowNames = flowAccesses
    .filter((access) => access.enabled)
    .map((access) => access.flow);

  // Extract user permission names
  const userPermissionNames = userPermissions
    .filter((perm) => perm.enabled)
    .map((perm) => perm.name);

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
    },
  };
}

