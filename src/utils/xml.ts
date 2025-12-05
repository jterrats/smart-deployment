import fs from 'node:fs/promises';
import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import { getLogger } from './logger.js';

const logger = getLogger('XMLUtils');

/**
 * XML parsing options
 */
export type XmlParseOptions = {
  ignoreAttributes?: boolean;
  preserveOrder?: boolean;
  trimValues?: boolean;
  parseTagValue?: boolean;
};

/**
 * XML generation options
 */
export type XmlBuildOptions = {
  format?: boolean;
  ignoreAttributes?: boolean;
  indentBy?: string;
  suppressEmptyNode?: boolean;
};

/**
 * Default XML parsing configuration for Salesforce metadata
 */
const DEFAULT_PARSE_OPTIONS: XmlParseOptions = {
  ignoreAttributes: false,
  preserveOrder: false,
  trimValues: true,
  parseTagValue: true,
};

/**
 * Default XML generation configuration
 */
const DEFAULT_BUILD_OPTIONS: XmlBuildOptions = {
  format: true,
  ignoreAttributes: false,
  indentBy: '  ',
  suppressEmptyNode: false,
};

/**
 * Parse XML string to JavaScript object
 *
 * @example
 * ```typescript
 * const xml = '<ApexClass><name>MyClass</name></ApexClass>';
 * const obj = parseXml(xml);
 * // { ApexClass: { name: 'MyClass' } }
 * ```
 */
export function parseXml<T = unknown>(xmlString: string, options?: XmlParseOptions): T {
  try {
    const parser = new XMLParser({
      ...DEFAULT_PARSE_OPTIONS,
      ...options,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
    });

    return parser.parse(xmlString) as T;
  } catch (error) {
    logger.error('Failed to parse XML', { error });
    throw new Error(`XML parsing failed: ${(error as Error).message}`);
  }
}

/**
 * Generate XML string from JavaScript object
 *
 * @example
 * ```typescript
 * const obj = { ApexClass: { name: 'MyClass', apiVersion: '60.0' } };
 * const xml = buildXml(obj);
 * // <ApexClass>
 * //   <name>MyClass</name>
 * //   <apiVersion>60.0</apiVersion>
 * // </ApexClass>
 * ```
 */
export function buildXml(object: unknown, options?: XmlBuildOptions): string {
  try {
    const builder = new XMLBuilder({
      ...DEFAULT_BUILD_OPTIONS,
      ...options,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
    });

    const xml = builder.build(object);

    // Add XML declaration if format is enabled
    if (options?.format !== false) {
      return `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
    }

    return xml;
  } catch (error) {
    logger.error('Failed to build XML', { error });
    throw new Error(`XML generation failed: ${(error as Error).message}`);
  }
}

/**
 * Validate XML string
 *
 * @returns True if valid, error object if invalid
 */
export function validateXml(xmlString: string): true | { err: { msg: string; line: number } } {
  const result = XMLValidator.validate(xmlString, {
    allowBooleanAttributes: true,
  });

  if (result === true) {
    return true;
  }

  logger.warn('XML validation failed', { error: result.err });
  return result;
}

/**
 * Parse XML file to JavaScript object
 */
export async function parseXmlFile<T = unknown>(filePath: string, options?: XmlParseOptions): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return parseXml<T>(content, options);
  } catch (error) {
    logger.error('Failed to parse XML file', { error, filePath });
    throw new Error(`Failed to read/parse XML file ${filePath}: ${(error as Error).message}`);
  }
}

/**
 * Write JavaScript object to XML file
 */
export async function writeXmlFile(filePath: string, object: unknown, options?: XmlBuildOptions): Promise<void> {
  try {
    const xml = buildXml(object, options);
    await fs.writeFile(filePath, xml, 'utf-8');
  } catch (error) {
    logger.error('Failed to write XML file', { error, filePath });
    throw new Error(`Failed to write XML file ${filePath}: ${(error as Error).message}`);
  }
}

/**
 * Pretty-print XML string
 */
export function formatXml(xmlString: string): string {
  try {
    // Parse and rebuild with formatting
    const parsed = parseXml(xmlString);
    return buildXml(parsed, { format: true });
  } catch (error) {
    logger.error('Failed to format XML', { error });
    throw new Error(`XML formatting failed: ${(error as Error).message}`);
  }
}

/**
 * Extract namespace from XML string
 */
export function extractNamespace(xmlString: string): string | null {
  const namespaceMatch = /xmlns="([^"]+)"/.exec(xmlString);
  return namespaceMatch ? namespaceMatch[1] : null;
}

/**
 * Check if XML string has specific namespace
 */
export function hasNamespace(xmlString: string, namespace: string): boolean {
  const extractedNamespace = extractNamespace(xmlString);
  return extractedNamespace === namespace;
}

/**
 * Parse Salesforce metadata XML with proper namespace handling
 *
 * @example
 * ```typescript
 * const metadata = await parseSalesforceMetadata('./MyClass.cls-meta.xml');
 * // { ApexClass: { apiVersion: '60.0', status: 'Active' } }
 * ```
 */
export async function parseSalesforceMetadata<T = unknown>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');

  // Validate before parsing
  const validation = validateXml(content);
  if (validation !== true) {
    throw new Error(`Invalid XML in ${filePath}: ${validation.err.msg} at line ${validation.err.line}`);
  }

  return parseXml<T>(content, {
    ignoreAttributes: false,
    trimValues: true,
  });
}

/**
 * Build Salesforce metadata XML with proper formatting
 */
export function buildSalesforceMetadata(
  object: unknown,
  namespace = 'http://soap.sforce.com/2006/04/metadata'
): string {
  const xml = buildXml(object, {
    format: true,
    indentBy: '    ', // Salesforce uses 4 spaces
  });

  // Add namespace to root element
  return xml.replace(/<(\w+)>/, `<$1 xmlns="${namespace}">`);
}

/**
 * Stream-based XML parsing for large files
 * Returns array of parsed chunks
 */
export async function parseXmlStream<T = unknown>(
  filePath: string,
  chunkSize = 1024 * 1024 // 1MB chunks
): Promise<T[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');

    // For files smaller than chunk size, parse normally
    if (content.length < chunkSize) {
      return [parseXml<T>(content)];
    }

    // For large files, split by root elements (simplified approach)
    const chunks: T[] = [];
    const rootTagMatch = /<(\w+)[^>]*>/.exec(content);

    if (!rootTagMatch) {
      throw new Error('Could not determine root element');
    }

    const rootTag = rootTagMatch[1];

    // Find all occurrences of child elements and parse individually
    const childPattern = new RegExp(`<${rootTag}[^>]*>([\\s\\S]*?)</${rootTag}>`, 'g');
    let match;

    while ((match = childPattern.exec(content)) !== null) {
      chunks.push(parseXml<T>(match[0]));
    }

    return chunks.length > 0 ? chunks : [parseXml<T>(content)];
  } catch (error) {
    logger.error('Failed to stream parse XML', { error, filePath });
    throw new Error(`Failed to stream parse XML file ${filePath}: ${(error as Error).message}`);
  }
}

/**
 * Minify XML by removing whitespace
 */
export function minifyXml(xmlString: string): string {
  try {
    const parsed = parseXml(xmlString);
    return buildXml(parsed, { format: false });
  } catch (error) {
    logger.error('Failed to minify XML', { error });
    throw new Error(`XML minification failed: ${(error as Error).message}`);
  }
}
