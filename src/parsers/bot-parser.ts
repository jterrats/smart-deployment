/**
 * Bot Parser
 * Parses Salesforce Einstein Bot metadata files (.bot-meta.xml)
 * 
 * @ac US-024-AC-1: Extract dialog references
 * @ac US-024-AC-2: Extract GenAI prompt references
 * @ac US-024-AC-3: Extract Flow references
 * @ac US-024-AC-4: Extract Apex action references
 * @ac US-024-AC-5: Extract menu item references
 * @ac US-024-AC-6: Link to all dependencies
 * 
 * @issue #24
 */

import { readFile } from 'node:fs/promises';
import { XMLParser } from 'fast-xml-parser';
import type {
  BotMetadata,
  BotDialog,
  BotStep,
} from '../types/salesforce/bot.js';

/**
 * Result of parsing a Bot file
 */
export type BotParseResult = {
  /** Name of the bot (from filename) */
  name: string;
  /** Label */
  label: string;
  /** Description */
  description?: string;
  /** Dialog references */
  dialogs: string[];
  /** GenAI prompt references */
  genAiPrompts: string[];
  /** Flow references */
  flows: string[];
  /** Apex action references */
  apexActions: string[];
  /** Menu items (dialogs in footer menu) */
  menuItems: string[];
  /** ML Intents */
  mlIntents: string[];
  /** SObjects referenced */
  sobjects: string[];
  /** All dependencies extracted from this bot */
  dependencies: {
    dialogs: string[];
    genAiPrompts: string[];
    flows: string[];
    apexActions: string[];
    menuItems: string[];
    mlIntents: string[];
    sobjects: string[];
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
 * Extract invocations from bot steps recursively
 */
function extractInvocationsFromSteps(steps: BotStep[]): {
  flows: string[];
  apexActions: string[];
  genAiPrompts: string[];
} {
  const flows: string[] = [];
  const apexActions: string[] = [];
  const genAiPrompts: string[] = [];

  for (const step of steps) {
    // Extract from botInvocation
    if (step.botInvocation) {
      const invocation = step.botInvocation;
      if (invocation.invocationActionName) {
        switch (invocation.invocationActionType) {
          case 'flow':
            flows.push(invocation.invocationActionName);
            break;
          case 'apex':
            apexActions.push(invocation.invocationActionName);
            break;
          case 'prompt':
            genAiPrompts.push(invocation.invocationActionName);
            break;
          case 'externalService':
          case 'standardInvocableAction':
          case undefined:
            // These types don't need specific tracking
            break;
        }
      }
    }

    // Extract from botVariableOperation.botInvocation
    if (step.botVariableOperation?.botInvocation) {
      const invocation = step.botVariableOperation.botInvocation;
      if (invocation.invocationActionName) {
        switch (invocation.invocationActionType) {
          case 'flow':
            flows.push(invocation.invocationActionName);
            break;
          case 'apex':
            apexActions.push(invocation.invocationActionName);
            break;
          case 'prompt':
            genAiPrompts.push(invocation.invocationActionName);
            break;
          case 'externalService':
          case 'standardInvocableAction':
          case undefined:
            // These types don't need specific tracking
            break;
        }
      }
    }

    // Recursively extract from nested steps
    if (step.botSteps) {
      const nested = extractInvocationsFromSteps(normalizeArray(step.botSteps));
      flows.push(...nested.flows);
      apexActions.push(...nested.apexActions);
      genAiPrompts.push(...nested.genAiPrompts);
    }
  }

  return { flows, apexActions, genAiPrompts };
}

/**
 * Extract SObjects from conversation record lookups in bot steps
 */
function extractSObjectsFromSteps(steps: BotStep[]): string[] {
  const sobjects: string[] = [];

  for (const step of steps) {
    // Extract from conversationRecordLookup
    if (step.conversationRecordLookup) {
      sobjects.push(step.conversationRecordLookup.SObjectType);
    }

    // Recursively extract from nested steps
    if (step.botSteps) {
      sobjects.push(...extractSObjectsFromSteps(normalizeArray(step.botSteps)));
    }
  }

  return sobjects;
}

/**
 * Extract all references from bot dialogs
 */
function extractReferencesFromDialogs(dialogs: BotDialog[]): {
  flows: string[];
  apexActions: string[];
  genAiPrompts: string[];
  sobjects: string[];
} {
  const allFlows: string[] = [];
  const allApexActions: string[] = [];
  const allGenAiPrompts: string[] = [];
  const allSObjects: string[] = [];

  for (const dialog of dialogs) {
    const steps = normalizeArray(dialog.botSteps);
    
    // Extract invocations
    const { flows, apexActions, genAiPrompts } = extractInvocationsFromSteps(steps);
    allFlows.push(...flows);
    allApexActions.push(...apexActions);
    allGenAiPrompts.push(...genAiPrompts);

    // Extract SObjects
    const sobjects = extractSObjectsFromSteps(steps);
    allSObjects.push(...sobjects);
  }

  return {
    flows: [...new Set(allFlows)],
    apexActions: [...new Set(allApexActions)],
    genAiPrompts: [...new Set(allGenAiPrompts)],
    sobjects: [...new Set(allSObjects)],
  };
}

/**
 * Parse a Bot metadata XML file
 * 
 * @param filePath - Path to the .bot-meta.xml file
 * @param botName - Name of the bot (typically from filename)
 * @returns Parsed bot metadata with dependencies
 * 
 * @example
 * const result = await parseBot(
 *   'force-app/main/default/bots/Support_Bot.bot-meta.xml',
 *   'Support_Bot'
 * );
 * console.log(result.dialogs); // ['Greeting', 'CaseCreation', 'FAQ']
 * console.log(result.flows); // ['Case_Assignment_Flow']
 * console.log(result.genAiPrompts); // ['SummarizeCase']
 */
export async function parseBot(
  filePath: string,
  botName: string
): Promise<BotParseResult> {
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
      `Failed to parse Bot XML at ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Type assertion with validation
  const root = parsed as { Bot?: BotMetadata };
  if (!root.Bot) {
    throw new Error(`Invalid Bot XML structure at ${filePath}: missing Bot root element`);
  }

  const metadata = root.Bot;

  // Extract bot versions and dialogs
  const botVersions = normalizeArray(metadata.botVersions);
  const allDialogs: BotDialog[] = [];
  
  for (const version of botVersions) {
    const versionDialogs = normalizeArray(version.botDialogs);
    allDialogs.push(...versionDialogs);
  }

  // Extract dialog names
  const dialogNames = allDialogs.map((dialog) => dialog.developerName);

  // Extract menu items (dialogs shown in footer menu)
  const menuItems = allDialogs
    .filter((dialog) => dialog.showInFooterMenu === true)
    .map((dialog) => dialog.developerName);

  // Extract ML Intents
  const mlIntents = normalizeArray(metadata.mlIntents).map((intent) => intent.developerName);

  // Extract invocations and SObjects from all dialogs
  const { flows, apexActions, genAiPrompts, sobjects } = extractReferencesFromDialogs(allDialogs);

  // Extract SObjects from conversation variables
  const variableSObjects: string[] = [];
  for (const version of botVersions) {
    const variables = normalizeArray(version.conversationVariables);
    for (const variable of variables) {
      if (variable.SObjectType) {
        variableSObjects.push(variable.SObjectType);
      }
    }
  }

  // Extract SObjects from context variables
  const contextVariables = normalizeArray(metadata.contextVariables);
  for (const variable of contextVariables) {
    if (variable.SObjectType) {
      variableSObjects.push(variable.SObjectType);
    }
  }

  // Combine and deduplicate SObjects
  const allSObjects = [...new Set([...sobjects, ...variableSObjects])];

  // Build result
  return {
    name: botName,
    label: metadata.label,
    description: metadata.description,
    dialogs: dialogNames,
    genAiPrompts,
    flows,
    apexActions,
    menuItems,
    mlIntents,
    sobjects: allSObjects,
    dependencies: {
      dialogs: dialogNames,
      genAiPrompts,
      flows,
      apexActions,
      menuItems,
      mlIntents,
      sobjects: allSObjects,
    },
  };
}

