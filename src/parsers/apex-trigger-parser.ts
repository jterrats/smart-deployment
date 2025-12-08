import { getLogger } from '../utils/logger.js';
import { ParsingError } from '../errors/parsing-error.js';
import type { ApexTriggerMetadata, ApexTriggerEvent } from '../types/salesforce/apex.js';

const logger = getLogger('ApexTriggerParser');

/**
 * Re-export ApexTriggerEvent from Salesforce types for backwards compatibility
 */
export type { ApexTriggerEvent as TriggerEvent } from '../types/salesforce/apex.js';

/**
 * Apex trigger dependency types
 */
export type TriggerDependencyType = 'handler' | 'variable_declaration';

/**
 * Represents a dependency found in an Apex trigger
 */
export type TriggerDependency = {
  type: TriggerDependencyType;
  className: string;
  namespace?: string;
  isManagedPackage: boolean;
};

/**
 * Result of parsing an Apex trigger
 * Optionally includes metadata from .trigger-meta.xml
 */
export type TriggerParseResult = {
  triggerName: string;
  sobjectType: string;
  events: ApexTriggerEvent[];
  handlers: TriggerDependency[];
  dependencies: TriggerDependency[];
  metadata?: ApexTriggerMetadata;
};

/**
 * Standard Apex classes that should be ignored
 */
const STANDARD_APEX_CLASSES = new Set([
  'System',
  'String',
  'Integer',
  'Boolean',
  'Date',
  'Datetime',
  'Time',
  'Decimal',
  'Double',
  'Long',
  'Id',
  'Blob',
  'Object',
  'List',
  'Set',
  'Map',
  'SObject',
  'Database',
  'Schema',
  'Test',
  'Trigger',
]);

/**
 * Remove comments from Apex code
 */
function removeComments(code: string): string {
  // Remove single-line comments (//)
  let cleaned = code.replace(/\/\/.*$/gm, '');

  // Remove multi-line comments (/* ... */)
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

  // Remove JavaDoc comments (/** ... */)
  cleaned = cleaned.replace(/\/\*\*[\s\S]*?\*\//g, '');

  return cleaned;
}

/**
 * Check if a class is a standard Apex class
 */
function isStandardClass(className: string): boolean {
  // Remove namespace if present
  const cleanName = className.includes('.') ? className.split('.').pop()! : className;

  return STANDARD_APEX_CLASSES.has(cleanName);
}

/**
 * Extract namespace from a fully qualified class name
 */
function extractNamespace(className: string): { namespace?: string; cleanName: string; isManagedPackage: boolean } {
  // Pattern: Namespace__ClassName or Namespace.ClassName
  const namespacePattern = /^([a-zA-Z][a-zA-Z0-9_]*(?:__|\.))(.+)$/;
  const match = className.match(namespacePattern);

  if (match) {
    const namespace = match[1].replace(/__|\.$/g, '');
    const cleanName = match[2];
    const isManagedPackage = match[1].includes('__');

    return { namespace, cleanName, isManagedPackage };
  }

  return { cleanName: className, isManagedPackage: false };
}

/**
 * Extract trigger declaration (name, object, events)
 *
 * @ac US-014-AC-1: Extract trigger object (Account, etc.)
 * @ac US-014-AC-3: Detect trigger events (before insert, etc.)
 */
function extractTriggerDeclaration(
  code: string,
  filePath: string
): { triggerName: string; sobjectType: string; events: ApexTriggerEvent[] } {
  // Pattern: trigger TriggerName on SObjectType (event1, event2, ...)
  const triggerPattern = /trigger\s+([a-zA-Z][a-zA-Z0-9_]*)\s+on\s+([a-zA-Z][a-zA-Z0-9_]*)\s*\(\s*([^)]+)\s*\)/i;
  const match = code.match(triggerPattern);

  if (!match) {
    throw new ParsingError(`Invalid trigger declaration: ${filePath}`, {
      filePath,
      suggestion: 'Trigger files must have format: trigger TriggerName on SObjectType (events)',
    });
  }

  const triggerName = match[1];
  const sobjectType = match[2];
  const eventsStr = match[3];

  // Parse events (before insert, after update, etc.)
  const eventsList = eventsStr
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0) as ApexTriggerEvent[];

  return { triggerName, sobjectType, events: eventsList };
}

/**
 * Extract handler class references
 *
 * @ac US-014-AC-2: Extract handler class references
 * @ac US-014-AC-4: Link trigger to handler classes
 * @ac US-014-AC-5: Handle multiple handlers per trigger
 */
function extractHandlers(code: string): TriggerDependency[] {
  const handlers: TriggerDependency[] = [];
  const seen = new Set<string>();

  // Pattern 1: ClassName.methodName(...) - Static method calls
  const staticMethodPattern = /([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)*)\s*\.\s*[a-zA-Z][a-zA-Z0-9_]*\s*\(/g;
  const staticMatches = code.matchAll(staticMethodPattern);

  for (const match of staticMatches) {
    const className = match[1];

    // Skip if already seen or is a standard class
    if (seen.has(className) || isStandardClass(className)) {
      continue;
    }

    const { namespace, cleanName, isManagedPackage } = extractNamespace(className);

    seen.add(className);
    handlers.push({
      type: 'handler',
      className: cleanName,
      namespace,
      isManagedPackage,
    });
  }

  // Pattern 2: new ClassName() - Instantiations (for framework patterns)
  const instantiationPattern = /new\s+([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)*)\s*\(/g;
  const instantiationMatches = code.matchAll(instantiationPattern);

  for (const match of instantiationMatches) {
    const className = match[1];

    // Skip if already seen or is a standard class
    if (seen.has(className) || isStandardClass(className)) {
      continue;
    }

    const { namespace, cleanName, isManagedPackage } = extractNamespace(className);

    seen.add(className);
    handlers.push({
      type: 'handler',
      className: cleanName,
      namespace,
      isManagedPackage,
    });
  }

  return handlers;
}

/**
 * Extract variable declarations
 *
 * @ac US-014-AC-6: Extract variable declarations
 */
function extractVariableDeclarations(code: string): TriggerDependency[] {
  // Pattern: ClassName variableName = ...
  const varPattern = /(?:^|[;\s{])\s*([A-Z][a-zA-Z0-9_]*(?:\.[A-Z][a-zA-Z0-9_]*)*)\s+[a-z][a-zA-Z0-9_]*\s*[=;]/gm;
  const matches = code.matchAll(varPattern);
  const dependencies: TriggerDependency[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const className = match[1];

    // Skip if already seen or is a standard class
    if (seen.has(className) || isStandardClass(className)) {
      continue;
    }

    const { namespace, cleanName, isManagedPackage } = extractNamespace(className);

    seen.add(className);
    dependencies.push({
      type: 'variable_declaration',
      className: cleanName,
      namespace,
      isManagedPackage,
    });
  }

  return dependencies;
}

/**
 * Parse an Apex trigger file and extract dependencies
 *
 * @param filePath - Path to the Apex trigger file
 * @param content - Content of the Apex trigger file
 * @returns TriggerParseResult with all extracted dependencies
 *
 * @throws {ParsingError} If the file cannot be parsed
 *
 * @example
 * ```typescript
 * const result = parseApexTrigger('AccountTrigger.trigger', triggerCode);
 * console.log(result.sobjectType); // 'Account'
 * console.log(result.events); // ['before insert', 'after update']
 * console.log(result.handlers); // [{ type: 'handler', className: 'AccountTriggerHandler', ... }]
 * ```
 */
export function parseApexTrigger(filePath: string, content: string): TriggerParseResult {
  try {
    logger.debug(`Parsing Apex trigger: ${filePath}`);

    // Validate file extension
    if (!filePath.endsWith('.trigger')) {
      throw new ParsingError(`Invalid Apex trigger file name: ${filePath}`, {
        filePath,
        suggestion: 'Apex trigger files must end with .trigger',
      });
    }

    // Remove comments
    const cleanCode = removeComments(content);

    // Extract trigger declaration
    const { triggerName, sobjectType, events } = extractTriggerDeclaration(cleanCode, filePath);

    // Extract handler class references
    const handlers = extractHandlers(cleanCode);

    // Extract variable declarations
    const varDecls = extractVariableDeclarations(cleanCode);

    // Combine all dependencies
    const dependencies = [...handlers, ...varDecls];

    const result: TriggerParseResult = {
      triggerName,
      sobjectType,
      events,
      handlers,
      dependencies,
    };

    logger.debug(`Parsed Apex trigger: ${triggerName}`, {
      sobjectType,
      events: events.length,
      handlers: handlers.length,
      dependencies: dependencies.length,
    });

    return result;
  } catch (error) {
    if (error instanceof ParsingError) {
      throw error;
    }

    throw new ParsingError(`Failed to parse Apex trigger: ${filePath}`, {
      filePath,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}
