import { getLogger } from '../utils/logger.js';
import { ParsingError } from '../errors/parsing-error.js';
import type { ApexClassMetadata } from '../types/salesforce/apex.js';

const logger = getLogger('ApexClassParser');

/**
 * Apex class dependency types
 */
export type ApexDependencyType =
  | 'extends'
  | 'implements'
  | 'static_method'
  | 'instantiation'
  | 'variable_declaration'
  | 'inner_class'
  | 'dynamic_instantiation';

/**
 * Represents a dependency found in an Apex class
 */
export type ApexDependency = {
  type: ApexDependencyType;
  className: string;
  lineNumber?: number;
  isStandard: boolean;
  isManagedPackage: boolean;
  namespace?: string;
};

/**
 * Result of parsing an Apex class
 * Optionally includes metadata from .cls-meta.xml
 */
export type ApexParseResult = {
  className: string;
  namespace?: string;
  extends?: string;
  implements: string[];
  dependencies: ApexDependency[];
  innerClasses: string[];
  metadata?: ApexClassMetadata;
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
  'Limits',
  'ApexPages',
  'PageReference',
  'Trigger',
  'UserInfo',
  'Math',
  'Messaging',
  'Http',
  'HttpRequest',
  'HttpResponse',
  'JsonParser',
  'JsonGenerator',
  'JSON',
  'Pattern',
  'Matcher',
  'Exception',
  'DmlException',
  'QueryException',
  'NullPointerException',
  'TypeException',
  'CalloutException',
  'LimitException',
]);

/**
 * Remove comments from Apex code
 *
 * @ac US-013-AC-9: Remove comments before parsing
 */
function removeComments(code: string): string {
  let result = '';
  let inSingleLineComment = false;
  let inMultiLineComment = false;
  let stringDelimiter: "'" | '"' | null = null;
  let escapeNext = false;

  for (let index = 0; index < code.length; index++) {
    const current = code[index];
    const next = code[index + 1];

    if (inSingleLineComment) {
      if (current === '\n') {
        inSingleLineComment = false;
        result += current;
      }

      continue;
    }

    if (inMultiLineComment) {
      if (current === '*' && next === '/') {
        inMultiLineComment = false;
        index += 1;
      } else if (current === '\n') {
        result += '\n';
      }

      continue;
    }

    if (stringDelimiter) {
      result += current;

      if (escapeNext) {
        escapeNext = false;
      } else if (current === '\\') {
        escapeNext = true;
      } else if (current === stringDelimiter) {
        stringDelimiter = null;
      }

      continue;
    }

    if (current === '"' || current === "'") {
      stringDelimiter = current;
      result += current;
      continue;
    }

    if (current === '/' && next === '/') {
      inSingleLineComment = true;
      index += 1;
      continue;
    }

    if (current === '/' && next === '*') {
      inMultiLineComment = true;
      index += 1;
      continue;
    }

    result += current;
  }

  return result;
}

/**
 * Check if a class is a standard Apex class
 *
 * @ac US-013-AC-7: Ignore standard classes (System.*, etc.)
 */
function isStandardClass(className: string): boolean {
  // Remove namespace if present
  const cleanName = className.includes('.') ? className.split('.').pop()! : className;

  // Check if it's in the standard classes set
  if (STANDARD_APEX_CLASSES.has(cleanName)) {
    return true;
  }

  // Check if it starts with a standard prefix
  if (
    cleanName.startsWith('System.') ||
    cleanName.startsWith('Database.') ||
    cleanName.startsWith('Schema.') ||
    cleanName.startsWith('Test.') ||
    cleanName.startsWith('ApexPages.')
  ) {
    return true;
  }

  return false;
}

/**
 * Extract namespace from a fully qualified class name
 *
 * @ac US-013-AC-8: Handle managed packages
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
 * Extract extends relationship
 *
 * @ac US-013-AC-1: Extract extends relationships
 */
function extractExtends(code: string): string | undefined {
  const extendsPattern = /class\s+\w+\s+extends\s+([a-zA-Z][a-zA-Z0-9_<>.,\s]*?)(?:\s+implements|\s*\{)/i;
  const match = code.match(extendsPattern);

  if (match) {
    // Clean up generic types and whitespace
    return match[1].replace(/<.*?>/g, '').trim();
  }

  return undefined;
}

/**
 * Extract implements relationships
 *
 * @ac US-013-AC-2: Extract implements relationships
 */
function extractImplements(code: string): string[] {
  const implementsPattern = /implements\s+([a-zA-Z][a-zA-Z0-9_<>.,\s]+?)(?:\s*\{)/gi;
  const matches = code.matchAll(implementsPattern);
  const interfaces: string[] = [];

  for (const match of matches) {
    // Split by comma to handle multiple interfaces
    const interfaceList = match[1].split(',');
    for (const iface of interfaceList) {
      // Clean up generic types and whitespace
      const cleanInterface = iface.replace(/<.*?>/g, '').trim();
      if (cleanInterface && !interfaces.includes(cleanInterface)) {
        interfaces.push(cleanInterface);
      }
    }
  }

  return interfaces;
}

/**
 * Extract static method calls
 *
 * @ac US-013-AC-3: Extract static method calls
 */
function extractStaticMethodCalls(code: string): ApexDependency[] {
  const staticCallPattern = /([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)*)\s*\.\s*[a-zA-Z][a-zA-Z0-9_]*\s*\(/g;
  const matches = code.matchAll(staticCallPattern);
  const dependencies: ApexDependency[] = [];
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
      type: 'static_method',
      className: cleanName,
      namespace,
      isStandard: false,
      isManagedPackage,
    });
  }

  return dependencies;
}

/**
 * Extract object instantiations (new ClassName())
 *
 * @ac US-013-AC-4: Extract object instantiations
 */
function extractInstantiations(code: string): ApexDependency[] {
  const newPattern = /new\s+([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)*)\s*(?:<[^>]+>)?\s*\(/g;
  const matches = code.matchAll(newPattern);
  const dependencies: ApexDependency[] = [];
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
      type: 'instantiation',
      className: cleanName,
      namespace,
      isStandard: false,
      isManagedPackage,
    });
  }

  return dependencies;
}

/**
 * Extract variable declarations
 *
 * @ac US-013-AC-5: Extract variable declarations
 */
function extractVariableDeclarations(code: string): ApexDependency[] {
  // Pattern: ClassName variableName = ...
  const varPattern = /(?:^|[;\s{])\s*([A-Z][a-zA-Z0-9_]*(?:\.[A-Z][a-zA-Z0-9_]*)*)\s+[a-z][a-zA-Z0-9_]*\s*[=;]/gm;
  const matches = code.matchAll(varPattern);
  const dependencies: ApexDependency[] = [];
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
      isStandard: false,
      isManagedPackage,
    });
  }

  return dependencies;
}

/**
 * Extract inner classes
 *
 * @ac US-013-AC-6: Handle inner classes
 */
function extractInnerClasses(code: string, outerClassName: string): string[] {
  // Pattern: class InnerClassName { ... }
  // More permissive: allows any combination of modifiers and keywords
  const innerClassPattern = /\bclass\s+([a-zA-Z][a-zA-Z0-9_]*)\s*(?:extends|implements|\{)/g;
  const matches = code.matchAll(innerClassPattern);
  const innerClasses: string[] = [];

  for (const match of matches) {
    const className = match[1];

    // Skip the outer class itself
    if (className !== outerClassName && !innerClasses.includes(className)) {
      innerClasses.push(className);
    }
  }

  return innerClasses;
}

/**
 * Extract Type.forName() dynamic instantiation
 *
 * @ac US-013-AC-10: Handle Type.forName() dynamic instantiation
 */
function extractDynamicInstantiations(code: string): ApexDependency[] {
  // Pattern: Type.forName('ClassName') or Type.forName("ClassName")
  const typeForNamePattern = /Type\.forName\s*\(\s*['"]([a-zA-Z][a-zA-Z0-9_.]*)['"][\s)]/g;
  const matches = code.matchAll(typeForNamePattern);
  const dependencies: ApexDependency[] = [];
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
      type: 'dynamic_instantiation',
      className: cleanName,
      namespace,
      isStandard: false,
      isManagedPackage,
    });
  }

  return dependencies;
}

/**
 * Parse an Apex class file and extract dependencies
 *
 * @param filePath - Path to the Apex class file
 * @param content - Content of the Apex class file
 * @returns ApexParseResult with all extracted dependencies
 *
 * @throws {ParsingError} If the file cannot be parsed
 *
 * @example
 * ```typescript
 * const result = parseApexClass('MyController.cls', apexCode);
 * console.log(result.extends); // 'BaseController'
 * console.log(result.implements); // ['IController', 'ICallable']
 * console.log(result.dependencies.length); // 5
 * ```
 */
export function parseApexClass(filePath: string, content: string): ApexParseResult {
  try {
    logger.debug(`Parsing Apex class: ${filePath}`);

    // Extract class name from file path
    const classNameMatch = filePath.match(/([a-zA-Z][a-zA-Z0-9_]*)\.cls$/);
    if (!classNameMatch) {
      throw new ParsingError(`Invalid Apex class file name: ${filePath}`, {
        filePath,
        suggestion: 'Apex class files must end with .cls',
      });
    }

    const className = classNameMatch[1];

    // Remove comments
    const cleanCode = removeComments(content);

    // Extract namespace from class definition
    const { namespace } = extractNamespace(className);

    // Extract extends relationship
    const extendsClass = extractExtends(cleanCode);

    // Extract implements relationships
    const implementsList = extractImplements(cleanCode);

    // Extract all dependencies
    const dependencies: ApexDependency[] = [];

    // Add extends as a dependency
    if (extendsClass && !isStandardClass(extendsClass)) {
      const { namespace: extNamespace, cleanName, isManagedPackage } = extractNamespace(extendsClass);
      dependencies.push({
        type: 'extends',
        className: cleanName,
        namespace: extNamespace,
        isStandard: false,
        isManagedPackage,
      });
    }

    // Add implements as dependencies
    for (const iface of implementsList) {
      if (!isStandardClass(iface)) {
        const { namespace: ifaceNamespace, cleanName, isManagedPackage } = extractNamespace(iface);
        dependencies.push({
          type: 'implements',
          className: cleanName,
          namespace: ifaceNamespace,
          isStandard: false,
          isManagedPackage,
        });
      }
    }

    // Extract and add other dependencies
    dependencies.push(...extractStaticMethodCalls(cleanCode));
    dependencies.push(...extractInstantiations(cleanCode));
    dependencies.push(...extractVariableDeclarations(cleanCode));
    dependencies.push(...extractDynamicInstantiations(cleanCode));

    // Extract inner classes
    const innerClasses = extractInnerClasses(cleanCode, className);

    const result: ApexParseResult = {
      className,
      namespace,
      extends: extendsClass,
      implements: implementsList,
      dependencies,
      innerClasses,
    };

    logger.debug(`Parsed Apex class: ${className}`, {
      dependencies: dependencies.length,
      innerClasses: innerClasses.length,
    });

    return result;
  } catch (error) {
    if (error instanceof ParsingError) {
      throw error;
    }

    throw new ParsingError(`Failed to parse Apex class: ${filePath}`, {
      filePath,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}
