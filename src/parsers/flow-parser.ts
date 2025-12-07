/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { parseXml } from '../utils/xml.js';
import { getLogger } from '../utils/logger.js';
import { ParsingError } from '../errors/parsing-error.js';
import type { FlowMetadata, FlowProcessType, FlowStatus } from '../types/salesforce/flow.js';

const logger = getLogger('FlowParser');

/**
 * Flow dependency types
 */
export type FlowDependencyType = 'apex_action' | 'subflow' | 'record' | 'genai_prompt' | 'screen_field' | 'decision';

/**
 * Re-export FlowProcessType and FlowStatus from Salesforce types
 */
export type { FlowProcessType, FlowStatus } from '../types/salesforce/flow.js';

/**
 * Represents a dependency found in a Flow
 */
export type FlowDependency = {
  type: FlowDependencyType;
  name: string;
  reference?: string;
};

/**
 * Result of parsing a Flow
 * Optionally includes full metadata from Flow-meta.xml
 */
export type FlowParseResult = {
  flowName: string;
  flowType?: FlowProcessType;
  status?: FlowStatus;
  apexActions: string[];
  subflows: string[];
  recordReferences: string[];
  genaiPrompts: string[];
  dependencies: FlowDependency[];
  metadata?: FlowMetadata;
};

/**
 * Extract Apex action references from Flow XML
 *
 * @ac US-015-AC-1: Extract Apex action references
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractApexActions(flowData: any): string[] {
  const actions: string[] = [];

  // actionCalls can be a single object or array
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const actionCalls = Array.isArray(flowData.actionCalls)
    ? flowData.actionCalls
    : flowData.actionCalls
    ? [flowData.actionCalls]
    : [];

  for (const action of actionCalls) {
    if (action.actionType === 'apex' && action.actionName) {
      actions.push(action.actionName);
    }
  }

  return actions;
}

/**
 * Extract subflow references from Flow XML
 *
 * @ac US-015-AC-2: Extract subflow references
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSubflows(flowData: any): string[] {
  const subflows: string[] = [];

  // subflows can be a single object or array
  const subflowCalls = Array.isArray(flowData.subflows)
    ? flowData.subflows
    : flowData.subflows
    ? [flowData.subflows]
    : [];

  for (const subflow of subflowCalls) {
    if (subflow.flowName) {
      subflows.push(subflow.flowName);
    }
  }

  return subflows;
}

/**
 * Extract record references (SObject types) from Flow XML
 *
 * @ac US-015-AC-3: Extract record references (objects)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any, complexity
function extractRecordReferences(flowData: any): string[] {
  const records = new Set<string>();

  // recordLookups
  const recordLookups = Array.isArray(flowData.recordLookups)
    ? flowData.recordLookups
    : flowData.recordLookups
    ? [flowData.recordLookups]
    : [];

  for (const lookup of recordLookups) {
    if (lookup.object) {
      records.add(lookup.object);
    }
  }

  // recordCreates
  const recordCreates = Array.isArray(flowData.recordCreates)
    ? flowData.recordCreates
    : flowData.recordCreates
    ? [flowData.recordCreates]
    : [];

  for (const create of recordCreates) {
    if (create.object) {
      records.add(create.object);
    }
  }

  // recordUpdates
  const recordUpdates = Array.isArray(flowData.recordUpdates)
    ? flowData.recordUpdates
    : flowData.recordUpdates
    ? [flowData.recordUpdates]
    : [];

  for (const update of recordUpdates) {
    if (update.object) {
      records.add(update.object);
    }
  }

  // recordDeletes
  const recordDeletes = Array.isArray(flowData.recordDeletes)
    ? flowData.recordDeletes
    : flowData.recordDeletes
    ? [flowData.recordDeletes]
    : [];

  for (const deleteOp of recordDeletes) {
    if (deleteOp.object) {
      records.add(deleteOp.object);
    }
  }

  // Start node (for record-triggered flows)
  if (flowData.start?.object) {
    records.add(flowData.start.object);
  }

  // Record variables
  const variables = Array.isArray(flowData.variables)
    ? flowData.variables
    : flowData.variables
    ? [flowData.variables]
    : [];

  for (const variable of variables) {
    if (variable.dataType === 'SObject' && variable.objectType) {
      records.add(variable.objectType);
    }
  }

  return Array.from(records);
}

/**
 * Extract GenAI prompt references from Flow XML
 *
 * @ac US-015-AC-4: Extract GenAI prompt references
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractGenAIPrompts(flowData: any): string[] {
  const prompts: string[] = [];

  const actionCalls = Array.isArray(flowData.actionCalls)
    ? flowData.actionCalls
    : flowData.actionCalls
    ? [flowData.actionCalls]
    : [];

  for (const action of actionCalls) {
    // GenAI actions have specific action types
    const actionType = String(action.actionType || '');
    if (actionType && (actionType.includes('genai') || actionType.includes('GenAi')) && action.actionName) {
      prompts.push(action.actionName);
    }

    // Also check for prompt template references
    if (action.promptTemplateApiName) {
      prompts.push(action.promptTemplateApiName);
    }
  }

  return prompts;
}

/**
 * Extract screen flow fields from Flow XML
 *
 * @ac US-015-AC-5: Extract screen flow fields
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractScreenFields(flowData: any): string[] {
  const fields: string[] = [];

  const screens = Array.isArray(flowData.screens) ? flowData.screens : flowData.screens ? [flowData.screens] : [];

  for (const screen of screens) {
    if (screen.fields) {
      const screenFields = Array.isArray(screen.fields) ? screen.fields : [screen.fields];

      for (const field of screenFields) {
        if (field.name) {
          fields.push(field.name);
        }
      }
    }
  }

  return fields;
}

/**
 * Extract decision logic from Flow XML
 *
 * @ac US-015-AC-6: Extract decision logic
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractDecisions(flowData: any): string[] {
  const decisions: string[] = [];

  const decisionNodes = Array.isArray(flowData.decisions)
    ? flowData.decisions
    : flowData.decisions
    ? [flowData.decisions]
    : [];

  for (const decision of decisionNodes) {
    if (decision.name) {
      decisions.push(decision.name);
    }
  }

  return decisions;
}

/**
 * Parse a Flow file and extract dependencies
 *
 * @param filePath - Path to the Flow file (.flow-meta.xml)
 * @param content - Content of the Flow file
 * @returns FlowParseResult with all extracted dependencies
 *
 * @throws {ParsingError} If the file cannot be parsed
 *
 * @ac US-015-AC-7: Handle all flow types (screen, record-triggered, scheduled)
 * @ac US-015-AC-8: Parse flow metadata XML correctly
 *
 * @example
 * ```typescript
 * const result = parseFlow('MyFlow.flow-meta.xml', flowXmlContent);
 * console.log(result.flowType); // 'Screen'
 * console.log(result.apexActions); // ['MyApexClass.myMethod']
 * console.log(result.subflows); // ['MySubflow']
 * console.log(result.recordReferences); // ['Account', 'Contact']
 * ```
 */
export function parseFlow(filePath: string, content: string): FlowParseResult {
  try {
    logger.debug(`Parsing Flow: ${filePath}`);

    // Validate file extension
    if (!filePath.endsWith('.flow-meta.xml')) {
      throw new ParsingError(`Invalid Flow file name: ${filePath}`, {
        filePath,
        suggestion: 'Flow files must end with .flow-meta.xml',
      });
    }

    // Extract flow name from file path
    const flowNameMatch = filePath.match(/([a-zA-Z][a-zA-Z0-9_]*)\.flow-meta\.xml$/);
    if (!flowNameMatch) {
      throw new ParsingError(`Cannot extract flow name from: ${filePath}`, {
        filePath,
        suggestion: 'Flow files must follow naming pattern: FlowName.flow-meta.xml',
      });
    }

    const flowName = flowNameMatch[1];

    // Parse XML
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unnecessary-type-assertion
    const parsed = parseXml(content) as any;

    // The Flow structure is under 'Flow' key
    const flowData = parsed.Flow;

    if (!flowData) {
      throw new ParsingError(`Invalid Flow XML structure: ${filePath}`, {
        filePath,
        suggestion: 'Flow XML must have a Flow root element',
      });
    }

    // Extract flow metadata
    const flowType = flowData.processType as FlowProcessType | undefined;
    const status = flowData.status as FlowStatus | undefined;

    // Extract all dependency types
    const apexActions = extractApexActions(flowData);
    const subflows = extractSubflows(flowData);
    const recordReferences = extractRecordReferences(flowData);
    const genaiPrompts = extractGenAIPrompts(flowData);
    const screenFields = extractScreenFields(flowData);
    const decisions = extractDecisions(flowData);

    // Build dependencies array
    const dependencies: FlowDependency[] = [
      ...apexActions.map((name) => ({ type: 'apex_action' as FlowDependencyType, name })),
      ...subflows.map((name) => ({ type: 'subflow' as FlowDependencyType, name })),
      ...recordReferences.map((name) => ({ type: 'record' as FlowDependencyType, name })),
      ...genaiPrompts.map((name) => ({ type: 'genai_prompt' as FlowDependencyType, name })),
      ...screenFields.map((name) => ({ type: 'screen_field' as FlowDependencyType, name })),
      ...decisions.map((name) => ({ type: 'decision' as FlowDependencyType, name })),
    ];

    const result: FlowParseResult = {
      flowName,
      flowType,
      status,
      apexActions,
      subflows,
      recordReferences,
      genaiPrompts,
      dependencies,
    };

    logger.debug(`Parsed Flow: ${flowName}`, {
      flowType,
      apexActions: apexActions.length,
      subflows: subflows.length,
      recordReferences: recordReferences.length,
      genaiPrompts: genaiPrompts.length,
      dependencies: dependencies.length,
    });

    return result;
  } catch (error) {
    if (error instanceof ParsingError) {
      throw error;
    }

    throw new ParsingError(`Failed to parse Flow: ${filePath}`, {
      filePath,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}
