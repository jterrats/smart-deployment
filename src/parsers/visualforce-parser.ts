import { getLogger } from '../utils/logger.js';
import { ParsingError } from '../errors/parsing-error.js';

const logger = getLogger('VisualforceParser');

/**
 * Visualforce dependency types
 */
export type VisualforceDependencyType =
  | 'apex_controller'
  | 'apex_extension'
  | 'vf_component'
  | 'standard_controller'
  | 'custom_component';

/**
 * Represents a dependency found in a Visualforce page/component
 */
export type VisualforceDependency = {
  type: VisualforceDependencyType;
  name: string;
  namespace?: string;
};

/**
 * Result of parsing a Visualforce page/component
 */
export type VisualforceParseResult = {
  name: string;
  type: 'page' | 'component';
  apexController?: string;
  apexExtensions: string[];
  standardController?: string;
  recordSetVar?: string;
  components: string[];
  dependencies: VisualforceDependency[];
};

/**
 * Extract Apex controller from Visualforce markup
 *
 * @ac US-018-AC-1: Extract controller Apex class
 */
function extractApexController(vfContent: string): string | undefined {
  // Pattern: <apex:page controller="MyController">
  const controllerMatch = vfContent.match(
    /<apex:(?:page|component)[^>]*\scontroller\s*=\s*["']([a-zA-Z][a-zA-Z0-9_.]*?)["']/i
  );
  return controllerMatch ? controllerMatch[1] : undefined;
}

/**
 * Extract standard controller from Visualforce markup
 *
 * @ac US-018-AC-2: Extract standardController (SObject reference)
 */
function extractStandardController(vfContent: string): string | undefined {
  // Pattern: <apex:page standardController="Account">
  const stdControllerMatch = vfContent.match(
    /<apex:(?:page|component)[^>]*\sstandardController\s*=\s*["']([a-zA-Z][a-zA-Z0-9_]*?)["']/i
  );
  return stdControllerMatch ? stdControllerMatch[1] : undefined;
}

/**
 * Extract controller extensions from Visualforce markup
 *
 * @ac US-018-AC-3: Extract extensions (controller extensions)
 */
function extractExtensions(vfContent: string): string[] {
  // Pattern: extensions="Extension1,Extension2,Extension3"
  const extensionsMatch = vfContent.match(/<apex:(?:page|component)[^>]*\sextensions\s*=\s*["']([^"']+)["']/i);

  if (!extensionsMatch) {
    return [];
  }

  return extensionsMatch[1]
    .split(',')
    .map((ext) => ext.trim())
    .filter((ext) => ext.length > 0);
}

/**
 * Extract recordSetVar from Visualforce markup
 */
function extractRecordSetVar(vfContent: string): string | undefined {
  // Pattern: recordSetVar="accounts"
  const recordSetVarMatch = vfContent.match(/<apex:page[^>]*\srecordSetVar\s*=\s*["']([a-zA-Z][a-zA-Z0-9_]*?)["']/i);
  return recordSetVarMatch ? recordSetVarMatch[1] : undefined;
}

/**
 * Extract Visualforce component references
 *
 * @ac US-018-AC-4: Extract VF component references
 */
function extractComponents(vfContent: string): string[] {
  const components: string[] = [];

  // Pattern: <c:MyComponent /> or <namespace:ComponentName />
  const componentPattern = /<([a-zA-Z][a-zA-Z0-9_]*):([a-zA-Z][a-zA-Z0-9_]*)[^>]*\/?>/gi;
  const matches = vfContent.matchAll(componentPattern);

  for (const match of matches) {
    const namespace = match[1];
    const componentName = match[2];

    // Exclude apex: namespace (standard components)
    if (namespace.toLowerCase() !== 'apex' && namespace.toLowerCase() !== 'chatter') {
      const fullName = `${namespace}:${componentName}`;
      if (!components.includes(fullName)) {
        components.push(fullName);
      }
    }
  }

  return components;
}

/**
 * Determine if the file is a page or component based on extension
 *
 * @ac US-018-AC-6: Validate file extension (.page or .component)
 */
function getVisualforceType(fileName: string): 'page' | 'component' {
  if (fileName.endsWith('.page')) {
    return 'page';
  }
  if (fileName.endsWith('.component')) {
    return 'component';
  }

  throw new ParsingError(`Invalid Visualforce file extension: ${fileName}`, {
    filePath: fileName,
    expectedExtensions: ['.page', '.component'],
  });
}

/**
 * Parse a Visualforce page or component and extract dependencies
 *
 * @param fileName - Name of the Visualforce file (with extension)
 * @param vfContent - Content of the Visualforce file
 * @returns VisualforceParseResult with all extracted dependencies
 *
 * @throws {ParsingError} If the file cannot be parsed or has invalid extension
 *
 * @ac US-018-AC-5: Parse both pages and components
 * @ac US-018-AC-6: Validate file extension (.page or .component)
 * @ac US-018-AC-7: Handle namespace prefixes in controllers and components
 *
 * @example
 * ```typescript
 * const result = parseVisualforce('MyPage.page', vfContent);
 * console.log(result.apexController); // 'MyController'
 * console.log(result.components); // ['c:MyComponent']
 * console.log(result.standardController); // 'Account'
 * ```
 */
export function parseVisualforce(fileName: string, vfContent: string): VisualforceParseResult {
  try {
    logger.debug(`Parsing Visualforce: ${fileName}`);

    // Validate and determine type
    const type = getVisualforceType(fileName);
    const name = fileName.replace(/\.(page|component)$/, '');

    // Extract dependencies
    const apexController = extractApexController(vfContent);
    const standardController = extractStandardController(vfContent);
    const apexExtensions = extractExtensions(vfContent);
    const recordSetVar = extractRecordSetVar(vfContent);
    const components = extractComponents(vfContent);

    // Build dependencies array
    const dependencies: VisualforceDependency[] = [];

    if (apexController) {
      dependencies.push({
        type: 'apex_controller',
        name: apexController,
        namespace: apexController.includes('__') ? apexController.split('__')[0] : undefined,
      });
    }

    if (standardController) {
      dependencies.push({
        type: 'standard_controller',
        name: standardController,
      });
    }

    for (const extension of apexExtensions) {
      dependencies.push({
        type: 'apex_extension',
        name: extension,
        namespace: extension.includes('__') ? extension.split('__')[0] : undefined,
      });
    }

    for (const component of components) {
      dependencies.push({
        type: 'vf_component',
        name: component,
        namespace: component.includes(':') ? component.split(':')[0] : undefined,
      });
    }

    const result: VisualforceParseResult = {
      name,
      type,
      apexController,
      apexExtensions,
      standardController,
      recordSetVar,
      components,
      dependencies,
    };

    logger.debug(`Parsed Visualforce: ${fileName}`, {
      type,
      apexController: !!apexController,
      standardController: !!standardController,
      extensionsCount: apexExtensions.length,
      componentsCount: components.length,
      dependenciesCount: dependencies.length,
    });

    return result;
  } catch (error) {
    if (error instanceof ParsingError) {
      throw error;
    }

    throw new ParsingError(`Failed to parse Visualforce file: ${fileName}`, {
      filePath: fileName,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}
