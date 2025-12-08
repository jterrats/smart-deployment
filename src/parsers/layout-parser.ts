/**
 * Layout Parser
 * Parses Salesforce Page Layout metadata files (.layout-meta.xml)
 * 
 * @ac AC-1: Extract related object (from filename)
 * @ac AC-2: Extract custom button references
 * @ac AC-3: Extract Visualforce page references
 * @ac AC-4: Extract field references
 * @ac AC-5: Extract related list references
 * @ac AC-6: Link to dependent metadata
 * 
 * @issue #21
 */

import { readFile } from 'node:fs/promises';
import { XMLParser } from 'fast-xml-parser';
import type { LayoutMetadata } from '../types/salesforce/layout.js';

/**
 * Result of parsing a Layout file
 */
export type LayoutParseResult = {
  /** Name of the layout (from filename, e.g., 'Account-Account Layout') */
  name: string;
  /** Related object name (e.g., 'Account') */
  object: string;
  /** Custom buttons referenced in the layout */
  customButtons: string[];
  /** Visualforce pages referenced in the layout */
  visualforcePages: string[];
  /** Fields displayed in the layout */
  fields: string[];
  /** Related lists included in the layout */
  relatedLists: string[];
  /** Quick actions included in the layout */
  quickActions: string[];
  /** Canvas apps referenced in the layout */
  canvasApps: string[];
  /** Custom links referenced in the layout */
  customLinks: string[];
  /** All dependencies extracted from this layout */
  dependencies: {
    object: string;
    customButtons: string[];
    visualforcePages: string[];
    fields: string[];
    relatedLists: string[];
    quickActions: string[];
    canvasApps: string[];
    customLinks: string[];
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
 * Extract object name from layout filename
 * Examples:
 *   'Account-Account Layout' -> 'Account'
 *   'CustomObject__c-Custom Layout' -> 'CustomObject__c'
 */
function extractObjectFromLayoutName(layoutName: string): string {
  const parts = layoutName.split('-');
  return parts[0] || layoutName;
}

/**
 * Parse a Layout metadata XML file
 * 
 * @param filePath - Path to the .layout-meta.xml file
 * @param layoutName - Name of the layout (typically from filename without extension)
 * @returns Parsed layout metadata with dependencies
 * 
 * @example
 * const result = await parseLayout(
 *   'force-app/main/default/layouts/Account-Account Layout.layout-meta.xml',
 *   'Account-Account Layout'
 * );
 * console.log(result.object); // 'Account'
 * console.log(result.customButtons); // ['New_Custom_Button', 'Edit_Button']
 * console.log(result.dependencies.visualforcePages); // ['AccountDashboard']
 */
export async function parseLayout(
  filePath: string,
  layoutName: string
): Promise<LayoutParseResult> {
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
      `Failed to parse Layout XML at ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Type assertion with validation
  const root = parsed as { Layout?: LayoutMetadata };
  if (!root.Layout) {
    throw new Error(`Invalid Layout XML structure at ${filePath}: missing Layout root element`);
  }

  const metadata = root.Layout;

  // Extract object name from layout name
  const objectName = extractObjectFromLayoutName(layoutName);

  // Extract custom buttons (from layout-level and related lists)
  const layoutCustomButtons = normalizeArray(metadata.customButtons);
  const relatedListCustomButtons: string[] = [];
  
  const relatedLists = normalizeArray(metadata.relatedLists);
  for (const relatedList of relatedLists) {
    const buttons = normalizeArray(relatedList.customButtons);
    relatedListCustomButtons.push(...buttons);
  }
  
  const allCustomButtons = [...new Set([...layoutCustomButtons, ...relatedListCustomButtons])];

  // Extract Visualforce page references
  const visualforcePages: string[] = [];
  
  // From layout items
  const layoutSections = normalizeArray(metadata.layoutSections);
  for (const section of layoutSections) {
    const columns = normalizeArray(section.layoutColumns);
    for (const column of columns) {
      const items = normalizeArray(column.layoutItems);
      for (const item of items) {
        if (item.page) {
          visualforcePages.push(item.page);
        }
      }
    }
  }

  // From feed layout components
  if (metadata.feedLayout) {
    const leftComponents = normalizeArray(metadata.feedLayout.leftComponents);
    const rightComponents = normalizeArray(metadata.feedLayout.rightComponents);
    
    for (const component of [...leftComponents, ...rightComponents]) {
      if (component.componentType === 'Visualforce' && component.page) {
        visualforcePages.push(component.page);
      }
    }
  }

  // Extract fields
  const fields: string[] = [];
  
  for (const section of layoutSections) {
    const columns = normalizeArray(section.layoutColumns);
    for (const column of columns) {
      const items = normalizeArray(column.layoutItems);
      for (const item of items) {
        if (item.field) {
          fields.push(item.field);
        }
      }
    }
  }

  // From related lists
  for (const relatedList of relatedLists) {
    const listFields = normalizeArray(relatedList.fields);
    fields.push(...listFields);
  }

  // From mini layout
  if (metadata.miniLayout) {
    const miniFields = normalizeArray(metadata.miniLayout.fields);
    fields.push(...miniFields);
  }

  // From summary layout
  if (metadata.summaryLayout) {
    const summaryItems = normalizeArray(metadata.summaryLayout.summaryLayoutItems);
    for (const item of summaryItems) {
      if (item.field) {
        fields.push(item.field);
      }
    }
  }

  // Extract related list names
  const relatedListNames = relatedLists.map((list) => list.relatedList);

  // Extract quick actions
  const quickActions: string[] = [];
  
  if (metadata.quickActionList) {
    const quickActionItems = normalizeArray(metadata.quickActionList.quickActionListItems);
    quickActions.push(...quickActionItems.map((item) => item.quickActionName));
  }

  if (metadata.platformActionList) {
    const actionItems = normalizeArray(metadata.platformActionList.platformActionListItems);
    for (const item of actionItems) {
      if (item.actionType === 'QuickAction') {
        quickActions.push(item.actionName);
      }
    }
  }

  // Extract canvas apps
  const canvasApps: string[] = [];
  
  for (const section of layoutSections) {
    const columns = normalizeArray(section.layoutColumns);
    for (const column of columns) {
      const items = normalizeArray(column.layoutItems);
      for (const item of items) {
        if (item.canvas) {
          canvasApps.push(item.canvas);
        }
      }
    }
  }

  // Extract custom links
  const customLinks: string[] = [];
  
  for (const section of layoutSections) {
    const columns = normalizeArray(section.layoutColumns);
    for (const column of columns) {
      const items = normalizeArray(column.layoutItems);
      for (const item of items) {
        if (item.customLink) {
          customLinks.push(item.customLink);
        }
      }
    }
  }

  if (metadata.summaryLayout) {
    const summaryItems = normalizeArray(metadata.summaryLayout.summaryLayoutItems);
    for (const item of summaryItems) {
      if (item.customLink) {
        customLinks.push(item.customLink);
      }
    }
  }

  // Build result
  return {
    name: layoutName,
    object: objectName,
    customButtons: [...new Set(allCustomButtons)],
    visualforcePages: [...new Set(visualforcePages)],
    fields: [...new Set(fields)],
    relatedLists: [...new Set(relatedListNames)],
    quickActions: [...new Set(quickActions)],
    canvasApps: [...new Set(canvasApps)],
    customLinks: [...new Set(customLinks)],
    dependencies: {
      object: objectName,
      customButtons: [...new Set(allCustomButtons)],
      visualforcePages: [...new Set(visualforcePages)],
      fields: [...new Set(fields)],
      relatedLists: [...new Set(relatedListNames)],
      quickActions: [...new Set(quickActions)],
      canvasApps: [...new Set(canvasApps)],
      customLinks: [...new Set(customLinks)],
    },
  };
}

