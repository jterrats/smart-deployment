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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function deduplicate(values: string[]): string[] {
  return [...new Set(values.filter((value): value is string => value.trim().length > 0))];
}

function extractStringValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  const valueRecord = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;

  if (typeof valueRecord?.stringValue === 'string') {
    return valueRecord.stringValue;
  }

  if (typeof valueRecord?.elementReference === 'string') {
    return valueRecord.elementReference;
  }

  return undefined;
}

/**
 * Extract Apex action references from Flow XML
 *
 * @ac US-015-AC-1: Extract Apex action references
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractApexActions(flowData: any): string[] {
  const actions: string[] = [];

  const actionCalls = normalizeArray(flowData.actionCalls);

  for (const action of actionCalls) {
    if (action.actionType === 'apex' && action.actionName) {
      actions.push(action.actionName);
    }
  }

  const apexPluginCalls = normalizeArray(flowData.apexPluginCalls);
  for (const pluginCall of apexPluginCalls) {
    if (pluginCall.apexClass) {
      actions.push(pluginCall.apexClass);
    }
  }

  const transforms = normalizeArray(flowData.transforms);
  for (const transform of transforms) {
    if (transform.apexClass) {
      actions.push(transform.apexClass);
    }
  }

  return deduplicate(actions);
}

/**
 * Extract subflow references from Flow XML
 *
 * @ac US-015-AC-2: Extract subflow references
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSubflows(flowData: any): string[] {
  const subflows: string[] = [];

  const subflowCalls = normalizeArray(flowData.subflows);

  for (const subflow of subflowCalls) {
    if (subflow.flowName) {
      subflows.push(subflow.flowName);
    }
  }

  return deduplicate(subflows);
}

/**
 * Extract record references (SObject types) from Flow XML
 *
 * @ac US-015-AC-3: Extract record references (objects)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any, complexity
function extractRecordReferences(flowData: any): string[] {
  const records = new Set<string>();

  const recordLookups = normalizeArray(flowData.recordLookups);
  for (const lookup of recordLookups) {
    if (lookup.object) {
      records.add(lookup.object);
    }
  }

  const recordCreates = normalizeArray(flowData.recordCreates);
  for (const create of recordCreates) {
    if (create.object) {
      records.add(create.object);
    }
  }

  const recordUpdates = normalizeArray(flowData.recordUpdates);
  for (const update of recordUpdates) {
    if (update.object) {
      records.add(update.object);
    }
  }

  const recordDeletes = normalizeArray(flowData.recordDeletes);
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
  const variables = normalizeArray(flowData.variables);
  for (const variable of variables) {
    if (variable.dataType === 'SObject' && variable.objectType) {
      records.add(variable.objectType);
    }
  }

  const dynamicChoiceSets = normalizeArray(flowData.dynamicChoiceSets);
  for (const choiceSet of dynamicChoiceSets) {
    if (choiceSet.object) {
      records.add(choiceSet.object);
    }

    if (choiceSet.picklistObject) {
      records.add(choiceSet.picklistObject);
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

  const actionCalls = normalizeArray(flowData.actionCalls);

  for (const action of actionCalls) {
    const actionType = String(action.actionType || '').toLowerCase();
    if (actionType && (actionType.includes('genai') || actionType.includes('prompt')) && action.actionName) {
      prompts.push(action.actionName);
    }

    if (action.promptTemplateApiName) {
      prompts.push(action.promptTemplateApiName);
    }

    const inputParameters = normalizeArray(action.inputParameters);
    for (const parameter of inputParameters) {
      if (
        parameter.name === 'promptTemplateApiName' ||
        parameter.name === 'promptTemplateName' ||
        parameter.name === 'promptTemplateDeveloperName'
      ) {
        const value = extractStringValue(parameter.value);
        if (value) {
          prompts.push(value);
        }
      }
    }
  }

  return deduplicate(prompts);
}

/**
 * Extract screen flow fields from Flow XML
 *
 * @ac US-015-AC-5: Extract screen flow fields
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractScreenFields(flowData: any): string[] {
  const fields: string[] = [];

  const screens = normalizeArray(flowData.screens);

  for (const screen of screens) {
    if (screen.fields) {
      const screenFields = normalizeArray(screen.fields);

      for (const field of screenFields) {
        if (field.name) {
          fields.push(field.name);
        }
      }
    }
  }

  return deduplicate(fields);
}

/**
 * Extract decision logic from Flow XML
 *
 * @ac US-015-AC-6: Extract decision logic
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractDecisions(flowData: any): string[] {
  const decisions: string[] = [];

  const decisionNodes = normalizeArray(flowData.decisions);

  for (const decision of decisionNodes) {
    if (decision.name) {
      decisions.push(decision.name);
    }
  }

  return deduplicate(decisions);
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
