import { getLogger } from '../utils/logger.js';
import { ParsingError } from '../errors/parsing-error.js';
import { parseXml } from '../utils/xml.js';
import type {
  LWCMetadata,
  LWCCapability,
  LWCFormFactor,
  LWCPropertyRole,
  LWCPropertyType,
  LWCTarget,
} from '../types/salesforce/lwc.js';

const logger = getLogger('LWCParser');

/**
 * LWC dependency types
 */
export type LWCDependencyType = 'apex_import' | 'lwc_import' | 'wire_adapter' | 'api_property' | 'navigation';

/**
 * Represents a dependency found in an LWC
 */
export type LWCDependency = {
  type: LWCDependencyType;
  name: string;
  source?: string;
  isTypeScript?: boolean;
};

/**
 * Result of parsing an LWC
 * Includes metadata from js-meta.xml
 */
export type LWCParseResult = {
  componentName: string;
  isTypeScript: boolean;
  apexImports: string[];
  lwcImports: string[];
  wireAdapters: string[];
  apiProperties: string[];
  navigationRefs: string[];
  dependencies: LWCDependency[];
  hasMetadataXml: boolean;
  metadata?: LWCMetadata;
};

/**
 * Remove comments from JavaScript/TypeScript code
 */
function removeComments(code: string): string {
  let result = '';
  let inSingleLineComment = false;
  let inMultiLineComment = false;
  let stringDelimiter: "'" | '"' | '`' | null = null;
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

    if (current === '"' || current === "'" || current === '`') {
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
 * Extract Apex imports
 *
 * @ac US-016-AC-1: Extract Apex imports (@salesforce/apex)
 */
function extractApexImports(code: string): string[] {
  // Pattern: import methodName from '@salesforce/apex/ClassName.methodName'
  const apexImportPattern = /import\s+(?:\{[^}]+\}|\w+)\s+from\s+['"]@salesforce\/apex\/([a-zA-Z][a-zA-Z0-9_.]+)['"]/g;
  const matches = code.matchAll(apexImportPattern);
  const imports: string[] = [];

  for (const match of matches) {
    const apexRef = match[1]; // ClassName.methodName or ClassName
    if (!imports.includes(apexRef)) {
      imports.push(apexRef);
    }
  }

  return imports;
}

/**
 * Extract LWC imports
 *
 * @ac US-016-AC-2: Extract LWC imports (c/componentName)
 */
function extractLWCImports(code: string): string[] {
  // Pattern: import ComponentName from 'c/componentName'
  const lwcImportPattern = /import\s+(?:\{[^}]+\}|\w+)\s+from\s+['"]c\/([a-zA-Z][a-zA-Z0-9_]+)['"]/g;
  const matches = code.matchAll(lwcImportPattern);
  const imports: string[] = [];

  for (const match of matches) {
    const componentName = match[1];
    if (!imports.includes(componentName)) {
      imports.push(componentName);
    }
  }

  return imports;
}

/**
 * Extract wire adapter usage
 *
 * @ac US-016-AC-3: Extract wire adapter usage
 */
function extractWireAdapters(code: string): string[] {
  // Pattern: @wire(adapterName, { ... })
  const wirePattern = /@wire\s*\(\s*([a-zA-Z][a-zA-Z0-9_]*)/g;
  const matches = code.matchAll(wirePattern);
  const adapters: string[] = [];

  for (const match of matches) {
    const adapterName = match[1];
    if (!adapters.includes(adapterName)) {
      adapters.push(adapterName);
    }
  }

  return adapters;
}

/**
 * Extract @api property dependencies
 *
 * @ac US-016-AC-4: Extract @api property dependencies
 */
function extractApiProperties(code: string): string[] {
  const apiPattern = /@api\s+(?:(?:get|set)\s+)?([a-zA-Z][a-zA-Z0-9_]*)/g;
  const matches = code.matchAll(apiPattern);
  const properties: string[] = [];

  for (const match of matches) {
    const propertyName = match[1];
    if (!properties.includes(propertyName)) {
      properties.push(propertyName);
    }
  }

  return properties;
}

/**
 * Extract navigation references
 *
 * @ac US-016-AC-5: Extract navigation references
 */
function extractNavigationRefs(code: string): string[] {
  const refs: string[] = [];

  // Pattern: NavigationMixin
  if (code.includes('NavigationMixin')) {
    refs.push('NavigationMixin');
  }

  // Pattern: this[NavigationMixin.Navigate]
  if (code.includes('NavigationMixin.Navigate')) {
    refs.push('NavigationMixin.Navigate');
  }

  // Pattern: import { NavigationMixin } from 'lightning/navigation'
  const navImportPattern = /import\s+\{[^}]*NavigationMixin[^}]*\}\s+from\s+['"]lightning\/navigation['"]/;
  if (navImportPattern.test(code)) {
    refs.push('lightning/navigation');
  }

  return refs;
}

/**
 * Detect if the component is TypeScript
 *
 * @ac US-016-AC-6: Handle TypeScript components
 */
function isTypeScriptComponent(jsCode: string): boolean {
  // Check for TypeScript-specific syntax
  const tsPatterns = [
    /:\s*(?:string|number|boolean|any|void|unknown|never)\s*[=;,)]/,
    /interface\s+[A-Z][a-zA-Z0-9_]*\s*\{/,
    /type\s+[A-Z][a-zA-Z0-9_]*\s*=/,
    /<[A-Z][a-zA-Z0-9_<>,\s]*>/,
    /as\s+(?:string|number|boolean|const)/,
  ];

  return tsPatterns.some((pattern) => pattern.test(jsCode));
}

type ParsedLwcMetadataXml = {
  LightningComponentBundle?: {
    apiVersion?: string | number;
    description?: string;
    isExposed?: boolean | string;
    masterLabel?: string;
    targets?: {
      target?: string | string[];
    };
    targetConfigs?: {
      targetConfig?: ParsedLwcTargetConfig | ParsedLwcTargetConfig[];
    };
    capabilities?: {
      capability?: string | string[];
    };
  };
};

type ParsedLwcTargetConfig = {
  '@_targets'?: string;
  configurationEditor?: string;
  objects?: {
    object?: string | string[];
  };
  property?: ParsedLwcProperty | ParsedLwcProperty[];
  supportedFormFactors?: {
    supportedFormFactor?: ParsedLwcSupportedFormFactor | ParsedLwcSupportedFormFactor[];
  };
};

type ParsedLwcProperty = {
  '@_name'?: string;
  '@_type'?: string;
  '@_default'?: string;
  '@_required'?: boolean | string;
  '@_label'?: string;
  '@_description'?: string;
  '@_placeholder'?: string;
  '@_role'?: string;
  '@_datasource'?: string;
  '@_min'?: string | number;
  '@_max'?: string | number;
};

type ParsedLwcSupportedFormFactor = {
  '@_type'?: string;
};

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function parseBoolean(value: boolean | string | undefined): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true';
  }

  return undefined;
}

function parseOptionalNumber(value: string | number | undefined): number | undefined {
  if (typeof value === 'number') {
    return Number.isNaN(value) ? undefined : value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
}

/**
 * Parse LWC js-meta.xml file
 *
 * @ac US-016-AC-8: Parse js-meta.xml correctly
 */
function parseMetadataXml(metadataContent: string): LWCMetadata | undefined {
  const parsed = parseXml<ParsedLwcMetadataXml>(metadataContent);
  const metadata = parsed.LightningComponentBundle;

  if (!metadata) {
    return undefined;
  }

  const targets = toArray(metadata.targets?.target);
  const targetConfigs = toArray(metadata.targetConfigs?.targetConfig).map((targetConfig) => ({
    targets: targetConfig['@_targets'] ?? '',
    configurationEditor: targetConfig.configurationEditor,
    objects:
      targetConfig.objects === undefined
        ? undefined
        : toArray(targetConfig.objects.object).map((object) => ({ object })),
    property: toArray(targetConfig.property)
      .filter((property) => property['@_name'] !== undefined && property['@_type'] !== undefined)
      .map((property) => ({
        name: property['@_name']!,
        type: property['@_type']! as LWCPropertyType,
        default: property['@_default'],
        required: parseBoolean(property['@_required']),
        label: property['@_label'],
        description: property['@_description'],
        placeholder: property['@_placeholder'],
        role: property['@_role'] as LWCPropertyRole,
        datasource: property['@_datasource'],
        min: parseOptionalNumber(property['@_min']),
        max: parseOptionalNumber(property['@_max']),
      })),
    supportedFormFactors:
      targetConfig.supportedFormFactors === undefined
        ? undefined
        : toArray(targetConfig.supportedFormFactors.supportedFormFactor)
            .filter((formFactor) => formFactor['@_type'] !== undefined)
            .map((formFactor) => ({
              type: formFactor['@_type']! as LWCFormFactor,
            })),
  }));

  const capabilities = toArray(metadata.capabilities?.capability) as LWCCapability[];

  return {
    apiVersion: metadata.apiVersion !== undefined ? String(metadata.apiVersion) : '',
    description: metadata.description,
    isExposed: parseBoolean(metadata.isExposed) ?? false,
    masterLabel: metadata.masterLabel,
    targets: targets.length > 0 ? { target: targets as LWCTarget[] } : undefined,
    targetConfigs: targetConfigs.length > 0 ? targetConfigs : undefined,
    capabilities: capabilities.length > 0 ? capabilities : undefined,
  };
}

/**
 * Parse a Lightning Web Component and extract dependencies
 *
 * @param componentName - Name of the LWC component
 * @param jsCode - JavaScript/TypeScript code of the component
 * @param metadataXml - Optional js-meta.xml content
 * @returns LWCParseResult with all extracted dependencies
 *
 * @throws {ParsingError} If the component cannot be parsed
 *
 * @ac US-016-AC-7: Validate bundle structure (js, html, xml)
 *
 * @example
 * ```typescript
 * const result = parseLWC('myComponent', jsCode, metadataXml);
 * console.log(result.apexImports); // ['AccountController.getAccounts']
 * console.log(result.lwcImports); // ['baseComponent', 'utilComponent']
 * console.log(result.wireAdapters); // ['getRecord', 'getObjectInfo']
 * ```
 */
export function parseLWC(componentName: string, jsCode: string, metadataXml?: string): LWCParseResult {
  try {
    logger.debug(`Parsing LWC: ${componentName}`);

    // Remove comments
    const cleanCode = removeComments(jsCode);

    // Detect TypeScript
    const isTS = isTypeScriptComponent(cleanCode);

    // Extract dependencies
    const apexImports = extractApexImports(cleanCode);
    const lwcImports = extractLWCImports(cleanCode);
    const wireAdapters = extractWireAdapters(cleanCode);
    const apiProperties = extractApiProperties(cleanCode);
    const navigationRefs = extractNavigationRefs(cleanCode);

    // Parse metadata XML if provided
    let metadata: LWCMetadata | undefined;
    let hasMetadataXml = false;

    if (metadataXml) {
      hasMetadataXml = true;
      try {
        metadata = parseMetadataXml(metadataXml);
      } catch (error) {
        logger.warn(`Failed to parse js-meta.xml for ${componentName}`, {
          componentName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Build dependencies array
    const dependencies: LWCDependency[] = [
      ...apexImports.map((name) => ({
        type: 'apex_import' as LWCDependencyType,
        name,
        source: '@salesforce/apex',
        isTypeScript: isTS,
      })),
      ...lwcImports.map((name) => ({
        type: 'lwc_import' as LWCDependencyType,
        name,
        source: 'c',
        isTypeScript: isTS,
      })),
      ...wireAdapters.map((name) => ({
        type: 'wire_adapter' as LWCDependencyType,
        name,
        isTypeScript: isTS,
      })),
      ...apiProperties.map((name) => ({
        type: 'api_property' as LWCDependencyType,
        name,
        isTypeScript: isTS,
      })),
      ...navigationRefs.map((name) => ({
        type: 'navigation' as LWCDependencyType,
        name,
        isTypeScript: isTS,
      })),
    ];

    const result: LWCParseResult = {
      componentName,
      isTypeScript: isTS,
      apexImports,
      lwcImports,
      wireAdapters,
      apiProperties,
      navigationRefs,
      dependencies,
      hasMetadataXml,
      metadata,
    };

    logger.debug(`Parsed LWC: ${componentName}`, {
      isTypeScript: isTS,
      apexImports: apexImports.length,
      lwcImports: lwcImports.length,
      wireAdapters: wireAdapters.length,
      dependencies: dependencies.length,
    });

    return result;
  } catch (error) {
    if (error instanceof ParsingError) {
      throw error;
    }

    throw new ParsingError(`Failed to parse LWC: ${componentName}`, {
      filePath: componentName,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}
