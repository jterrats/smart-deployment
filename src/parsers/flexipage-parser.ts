/**
 * FlexiPage Parser
 * Parses Salesforce Lightning Page metadata files (.flexipage-meta.xml)
 *
 * @ac US-022-AC-1: Extract LWC component references
 * @ac US-022-AC-2: Extract Aura component references
 * @ac US-022-AC-3: Extract object references
 * @ac US-022-AC-4: Extract record type filters
 * @ac US-022-AC-5: Extract region configurations
 * @ac US-022-AC-6: Link to all component dependencies
 *
 * @issue #22
 */

import { readFile } from 'node:fs/promises';
import { XMLParser } from 'fast-xml-parser';
import type {
  FlexiPageMetadata,
  FlexiPageRegion,
  ItemInstance,
  QuickActionListItem,
  PlatformActionListItem,
  UiFormulaRule,
} from '../types/salesforce/flexipage.js';

/**
 * Result of parsing a FlexiPage file
 */
export type FlexiPageParseResult = {
  /** Name of the FlexiPage (from filename) */
  name: string;
  /** Master label */
  masterLabel: string;
  /** FlexiPage type (AppPage, HomePage, RecordPage, etc.) */
  type: string;
  /** SObject type (for RecordPage) */
  sobjectType?: string;
  /** LWC components referenced */
  lwcComponents: string[];
  /** Aura components referenced */
  auraComponents: string[];
  /** Objects referenced */
  objects: string[];
  /** Record type filters */
  recordTypeFilters: string[];
  /** Region names configured */
  regions: string[];
  /** Quick actions */
  quickActions: string[];
  /** All dependencies extracted from this FlexiPage */
  dependencies: {
    lwcComponents: string[];
    auraComponents: string[];
    objects: string[];
    recordTypes: string[];
    regions: string[];
    quickActions: string[];
  };
};

/**
 * Normalize value to array (handles XML parser returning single object vs array)
 */
function normalizeArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function extractRecordTypesFromVisibilityRule(visibilityRule: UiFormulaRule | undefined): string[] {
  if (!visibilityRule) {
    return [];
  }

  const recordTypes: string[] = [];
  const criteria = normalizeArray(visibilityRule.criteria);

  for (const criterion of criteria) {
    if (criterion.leftValue?.includes('RecordType') || criterion.rightValue?.includes('RecordType')) {
      const candidate = criterion.rightValue?.includes('RecordType') ? criterion.leftValue : criterion.rightValue;
      if (candidate && !candidate.includes('RecordType')) {
        recordTypes.push(candidate);
      }
    }
  }

  return recordTypes;
}

function extractObjectName(value: string): string | undefined {
  if (!value.includes('.')) {
    return undefined;
  }

  const [objectName] = value.split('.');
  return objectName || undefined;
}

/**
 * Extract components from item instances
 */
function extractComponentsFromItems(items: ItemInstance[]): {
  lwc: string[];
  aura: string[];
  objects: string[];
  recordTypes: string[];
} {
  const lwcComponents: string[] = [];
  const auraComponents: string[] = [];
  const objects: string[] = [];
  const recordTypes: string[] = [];

  for (const item of items) {
    if (item.componentInstance) {
      const componentName = item.componentInstance.componentName;

      // LWC components use namespace:componentName or c:componentName format
      // Aura components use namespace:componentName or c:componentName format
      // Distinguish by convention: LWC typically lowercase, Aura camelCase
      if (componentName.includes(':')) {
        const [namespace, name] = componentName.split(':');

        // Standard components (force:*, lightning:*, etc.)
        if (namespace === 'force' || namespace === 'lightning' || namespace === 'forceChatter') {
          // Standard component, skip or log
        } else if (namespace === 'flexipage') {
          // Flexipage components, skip
        } else if (name && name.startsWith(name[0].toUpperCase())) {
          // Custom component - check naming convention
          // LWC: lowercase or camelCase starting with lowercase
          // Aura: PascalCase (starts with uppercase)
          auraComponents.push(componentName);
        } else {
          lwcComponents.push(componentName);
        }
      } else if (componentName.startsWith(componentName[0].toUpperCase())) {
        // No namespace - could be either, use naming convention
        auraComponents.push(componentName);
      } else {
        lwcComponents.push(componentName);
      }

      recordTypes.push(...extractRecordTypesFromVisibilityRule(item.componentInstance.visibilityRule));
    }

    if (item.fieldInstance?.fieldItem) {
      const objectName = extractObjectName(item.fieldInstance.fieldItem);
      if (objectName) {
        objects.push(objectName);
      }

      recordTypes.push(...extractRecordTypesFromVisibilityRule(item.fieldInstance.visibilityRule));
    }
  }

  return {
    lwc: lwcComponents,
    aura: auraComponents,
    objects,
    recordTypes,
  };
}

/**
 * Extract components from all regions
 */
function extractComponents(regions: FlexiPageRegion[]): {
  lwc: string[];
  aura: string[];
  objects: string[];
  recordTypes: string[];
} {
  const allLwc: string[] = [];
  const allAura: string[] = [];
  const allObjects: string[] = [];
  const allRecordTypes: string[] = [];

  for (const region of regions) {
    const items = normalizeArray(region.itemInstances);
    const { lwc, aura, objects, recordTypes } = extractComponentsFromItems(items);
    allLwc.push(...lwc);
    allAura.push(...aura);
    allObjects.push(...objects);
    allRecordTypes.push(...recordTypes);
  }

  return {
    lwc: [...new Set(allLwc)],
    aura: [...new Set(allAura)],
    objects: [...new Set(allObjects)],
    recordTypes: [...new Set(allRecordTypes)],
  };
}

/**
 * Extract quick actions from FlexiPage
 */
function extractQuickActions(metadata: FlexiPageMetadata): string[] {
  const quickActions: string[] = [];

  if (metadata.quickActionList?.quickActionListItems) {
    const items = normalizeArray<QuickActionListItem>(metadata.quickActionList.quickActionListItems);
    for (const item of items) {
      quickActions.push(item.quickActionName);
    }
  }

  if (metadata.platformActionList?.platformActionListItems) {
    const items = normalizeArray<PlatformActionListItem>(metadata.platformActionList.platformActionListItems);
    for (const item of items) {
      if (item.actionType === 'QuickAction') {
        quickActions.push(item.actionName);
      }
    }
  }

  return [...new Set(quickActions)];
}

/**
 * Parse a FlexiPage metadata XML file
 *
 * @param filePath - Path to the .flexipage-meta.xml file
 * @param flexiPageName - Name of the FlexiPage (typically from filename)
 * @returns Parsed FlexiPage metadata with dependencies
 *
 * @example
 * const result = await parseFlexiPage(
 *   'force-app/main/default/flexipages/Account_Record_Page.flexipage-meta.xml',
 *   'Account_Record_Page'
 * );
 * console.log(result.sobjectType); // 'Account'
 * console.log(result.lwcComponents); // ['c:accountSummary', 'c:relatedContacts']
 * console.log(result.dependencies.auraComponents); // ['c:AccountChart']
 */
export async function parseFlexiPage(filePath: string, flexiPageName: string): Promise<FlexiPageParseResult> {
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
      `Failed to parse FlexiPage XML at ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Type assertion with validation
  const root = parsed as { FlexiPage?: FlexiPageMetadata };
  if (!root.FlexiPage) {
    throw new Error(`Invalid FlexiPage XML structure at ${filePath}: missing FlexiPage root element`);
  }

  const metadata = root.FlexiPage;

  // Extract regions
  const regions = normalizeArray(metadata.flexiPageRegions);
  const regionNames = regions.map((region) => region.name);

  // Extract components
  const { lwc, aura, objects: regionObjects, recordTypes } = extractComponents(regions);

  // Extract objects
  const objects: string[] = [];
  if (metadata.sobjectType) {
    objects.push(metadata.sobjectType);
  }
  objects.push(...regionObjects);

  // Extract quick actions
  const quickActions = extractQuickActions(metadata);
  const uniqueObjects = [...new Set(objects)];

  // Build result
  return {
    name: flexiPageName,
    masterLabel: metadata.masterLabel,
    type: metadata.type,
    sobjectType: metadata.sobjectType,
    lwcComponents: lwc,
    auraComponents: aura,
    objects: uniqueObjects,
    recordTypeFilters: recordTypes,
    regions: regionNames,
    quickActions,
    dependencies: {
      lwcComponents: lwc,
      auraComponents: aura,
      objects: uniqueObjects,
      recordTypes,
      regions: regionNames,
      quickActions,
    },
  };
}
