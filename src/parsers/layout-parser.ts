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
import type { FeedLayout, LayoutMetadata, LayoutSection } from '../types/salesforce/layout.js';

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
 * 'Account-Account Layout' -> 'Account'
 * 'CustomObject__c-Custom Layout' -> 'CustomObject__c'
 */
function extractObjectFromLayoutName(layoutName: string): string {
  const parts = layoutName.split('-');
  return parts[0] || layoutName;
}

/**
 * Extract custom buttons from layout and related lists
 */
function extractCustomButtons(metadata: LayoutMetadata): string[] {
  const layoutCustomButtons = normalizeArray(metadata.customButtons);
  const relatedListCustomButtons: string[] = [];

  const relatedLists = normalizeArray(metadata.relatedLists);
  for (const relatedList of relatedLists) {
    const buttons = normalizeArray(relatedList.customButtons);
    relatedListCustomButtons.push(...buttons);
  }

  return [...new Set([...layoutCustomButtons, ...relatedListCustomButtons])];
}

/**
 * Extract Visualforce pages from layout sections
 */
function extractVFPagesFromSections(sections: LayoutSection[]): string[] {
  const pages: string[] = [];

  for (const section of sections) {
    const columns = normalizeArray(section.layoutColumns);
    for (const column of columns) {
      const items = normalizeArray(column.layoutItems);
      for (const item of items) {
        if (item.page) {
          pages.push(item.page);
        }
      }
    }
  }

  return pages;
}

/**
 * Extract Visualforce pages from feed layout
 */
function extractVFPagesFromFeedLayout(feedLayout?: FeedLayout): string[] {
  if (!feedLayout) return [];

  const pages: string[] = [];
  const leftComponents = normalizeArray(feedLayout.leftComponents);
  const rightComponents = normalizeArray(feedLayout.rightComponents);

  for (const component of [...leftComponents, ...rightComponents]) {
    if (component.componentType === 'Visualforce' && component.page) {
      pages.push(component.page);
    }
  }

  return pages;
}

/**
 * Extract fields from layout sections
 */
function extractFieldsFromSections(sections: LayoutSection[]): string[] {
  const fields: string[] = [];

  for (const section of sections) {
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

  return fields;
}

/**
 * Extract fields from various layout components
 */
function extractFields(metadata: LayoutMetadata, layoutSections: LayoutSection[]): string[] {
  const fields: string[] = [];

  // From sections
  fields.push(...extractFieldsFromSections(layoutSections));

  // From related lists
  const relatedLists = normalizeArray(metadata.relatedLists);
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

  return [...new Set(fields)];
}

/**
 * Extract quick actions from layout
 */
function extractQuickActions(metadata: LayoutMetadata): string[] {
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

  return [...new Set(quickActions)];
}

/**
 * Extract canvas apps from layout sections
 */
function extractCanvasApps(sections: LayoutSection[]): string[] {
  const apps: string[] = [];

  for (const section of sections) {
    const columns = normalizeArray(section.layoutColumns);
    for (const column of columns) {
      const items = normalizeArray(column.layoutItems);
      for (const item of items) {
        if (item.canvas) {
          apps.push(item.canvas);
        }
      }
    }
  }

  return [...new Set(apps)];
}

/**
 * Extract custom links from layout
 */
function extractCustomLinks(metadata: LayoutMetadata, layoutSections: LayoutSection[]): string[] {
  const links: string[] = [];

  // From layout sections
  for (const section of layoutSections) {
    const columns = normalizeArray(section.layoutColumns);
    for (const column of columns) {
      const items = normalizeArray(column.layoutItems);
      for (const item of items) {
        if (item.customLink) {
          links.push(item.customLink);
        }
      }
    }
  }

  // From summary layout
  if (metadata.summaryLayout) {
    const summaryItems = normalizeArray(metadata.summaryLayout.summaryLayoutItems);
    for (const item of summaryItems) {
      if (item.customLink) {
        links.push(item.customLink);
      }
    }
  }

  return [...new Set(links)];
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

  // Extract dependencies using helper functions
  const layoutSections = normalizeArray(metadata.layoutSections);
  const relatedLists = normalizeArray(metadata.relatedLists);

  const customButtons = extractCustomButtons(metadata);
  const vfPagesFromSections = extractVFPagesFromSections(layoutSections);
  const vfPagesFromFeed = extractVFPagesFromFeedLayout(metadata.feedLayout);
  const visualforcePages = [...new Set([...vfPagesFromSections, ...vfPagesFromFeed])];
  const fields = extractFields(metadata, layoutSections);
  const relatedListNames = relatedLists.map((list) => list.relatedList);
  const quickActions = extractQuickActions(metadata);
  const canvasApps = extractCanvasApps(layoutSections);
  const customLinks = extractCustomLinks(metadata, layoutSections);

  // Build result
  return {
    name: layoutName,
    object: objectName,
    customButtons,
    visualforcePages,
    fields,
    relatedLists: [...new Set(relatedListNames)],
    quickActions,
    canvasApps,
    customLinks,
    dependencies: {
      object: objectName,
      customButtons,
      visualforcePages,
      fields,
      relatedLists: [...new Set(relatedListNames)],
      quickActions,
      canvasApps,
      customLinks,
    },
  };
}

