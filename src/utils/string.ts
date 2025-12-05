/**
 * String Utilities
 *
 * Provides string manipulation functions for metadata processing
 */

import { getLogger } from './logger.js';

const logger = getLogger('StringUtils');

/**
 * Convert string to camelCase
 *
 * @ac US-011-AC-1: Case conversions (camelCase, PascalCase, snake_case)
 * @example
 * toCamelCase('hello_world') // 'helloWorld'
 * toCamelCase('HelloWorld') // 'helloWorld'
 */
export function toCamelCase(str: string): string {
  // Convert to words array by splitting on separators and camel case boundaries
  const words = str
    // Insert space before uppercase letters that follow lowercase
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Split on separators
    .split(/[-_\s]+/)
    .filter(Boolean);

  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

/**
 * Convert string to PascalCase
 *
 * @ac US-011-AC-1: Case conversions (camelCase, PascalCase, snake_case)
 * @example
 * toPascalCase('hello_world') // 'HelloWorld'
 * toPascalCase('helloWorld') // 'HelloWorld'
 */
export function toPascalCase(str: string): string {
  // Similar to camelCase but capitalize first word too
  const words = str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[-_\s]+/)
    .filter(Boolean);

  return words
    .map((word) => {
      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

/**
 * Convert string to snake_case
 *
 * @ac US-011-AC-1: Case conversions (camelCase, PascalCase, snake_case)
 * @example
 * toSnakeCase('helloWorld') // 'hello_world'
 * toSnakeCase('HelloWorld') // 'hello_world'
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .replace(/[-\s]+/g, '_')
    .replace(/^_/, '')
    .toLowerCase();
}

/**
 * Convert string to kebab-case
 *
 * @ac US-011-AC-1: Case conversions (camelCase, PascalCase, snake_case)
 * @example
 * toKebabCase('helloWorld') // 'hello-world'
 * toKebabCase('hello_world') // 'hello-world'
 */
export function toKebabCase(str: string): string {
  return toSnakeCase(str).replace(/_/g, '-');
}

/**
 * Extract comments from Apex code
 *
 * @ac US-011-AC-2: Extract comments from Apex/JavaScript
 * @example
 * extractApexComments('// comment\ncode') // ['// comment']
 */
export function extractApexComments(code: string): string[] {
  const comments: string[] = [];

  // Single-line comments
  const singleLinePattern = /\/\/.*/g;
  let match;
  while ((match = singleLinePattern.exec(code)) !== null) {
    comments.push(match[0]);
  }

  // Multi-line comments
  const multiLinePattern = /\/\*[\s\S]*?\*\//g;
  while ((match = multiLinePattern.exec(code)) !== null) {
    comments.push(match[0]);
  }

  return comments;
}

/**
 * Extract comments from JavaScript code
 *
 * @ac US-011-AC-2: Extract comments from Apex/JavaScript
 * @example
 * extractJavaScriptComments('/* comment *\/\ncode') // ['/* comment *\/']
 */
export function extractJavaScriptComments(code: string): string[] {
  // JavaScript comments follow same pattern as Apex
  return extractApexComments(code);
}

/**
 * Escape XML special characters
 *
 * @ac US-011-AC-3: Escape/unescape XML special characters
 * @example
 * escapeXml('<tag>value & "quoted"</tag>') // '&lt;tag&gt;value &amp; &quot;quoted&quot;&lt;/tag&gt;'
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Unescape XML special characters
 *
 * @ac US-011-AC-3: Escape/unescape XML special characters
 * @example
 * unescapeXml('&lt;tag&gt;value &amp; &quot;quoted&quot;&lt;/tag&gt;') // '<tag>value & "quoted"</tag>'
 */
export function unescapeXml(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&'); // Must be last to avoid double-unescaping
}

/**
 * Common regex patterns for Salesforce
 *
 * @ac US-011-AC-4: Regex utilities for common patterns
 */
export const REGEX_PATTERNS = {
  /** Salesforce API name (letters, numbers, underscores, starts with letter) */
  SALESFORCE_API_NAME: /^[a-zA-Z][a-zA-Z0-9_]*$/,

  /** Salesforce Email (standard email pattern) */
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  /** Salesforce 15/18 character ID */
  SALESFORCE_ID: /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/,

  /** Salesforce namespace prefix */
  NAMESPACE_PREFIX: /^[a-zA-Z][a-zA-Z0-9_]*__$/,

  /** Custom field suffix */
  CUSTOM_FIELD_SUFFIX: /__c$/,

  /** Custom object suffix */
  CUSTOM_OBJECT_SUFFIX: /__c$/,

  /** Metadata file extension */
  METADATA_FILE: /\.[\w-]+meta\.xml$/,

  /** Version number (semantic versioning) */
  VERSION: /^\d+\.\d+(\.\d+)?$/,
} as const;

/**
 * Validate Salesforce API name
 *
 * @ac US-011-AC-4: Regex utilities for common patterns
 * @example
 * isValidSalesforceApiName('MyField__c') // true
 * isValidSalesforceApiName('123Invalid') // false
 */
export function isValidSalesforceApiName(name: string): boolean {
  return REGEX_PATTERNS.SALESFORCE_API_NAME.test(name);
}

/**
 * Validate email address
 *
 * @ac US-011-AC-4: Regex utilities for common patterns
 * @example
 * isValidEmail('user@example.com') // true
 * isValidEmail('invalid-email') // false
 */
export function isValidEmail(email: string): boolean {
  return REGEX_PATTERNS.EMAIL.test(email);
}

/**
 * Normalize Unicode string (NFC normalization)
 *
 * @ac US-011-AC-5: Unicode handling
 * @example
 * normalizeUnicode('café') // Normalized form
 */
export function normalizeUnicode(str: string): string {
  return str.normalize('NFC');
}

/**
 * Strip accents from Unicode string
 *
 * @ac US-011-AC-5: Unicode handling
 * @example
 * stripAccents('café') // 'cafe'
 * stripAccents('naïve') // 'naive'
 */
export function stripAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC');
}

/**
 * Truncate string with ellipsis
 *
 * @example
 * truncate('Hello World', 8) // 'Hello...'
 * truncate('Short', 10) // 'Short'
 */
export function truncate(str: string, maxLength: number, ellipsis = '...'): string {
  if (str.length <= maxLength) {
    return str;
  }

  const truncated = str.slice(0, maxLength - ellipsis.length);
  return truncated + ellipsis;
}

/**
 * Pluralize word (simple English rules)
 *
 * @example
 * pluralize('field') // 'fields'
 * pluralize('class') // 'classes'
 * pluralize('entry') // 'entries'
 */
export function pluralize(word: string): string {
  if (word.endsWith('s') || word.endsWith('x') || word.endsWith('z') || word.endsWith('ch') || word.endsWith('sh')) {
    return word + 'es';
  }

  if (word.endsWith('y') && !/[aeiou]y$/i.test(word)) {
    return word.slice(0, -1) + 'ies';
  }

  return word + 's';
}

/**
 * Singularize word (simple English rules)
 *
 * @example
 * singularize('fields') // 'field'
 * singularize('classes') // 'class'
 * singularize('entries') // 'entry'
 */
export function singularize(word: string): string {
  if (word.endsWith('ies')) {
    return word.slice(0, -3) + 'y';
  }

  if (word.endsWith('es')) {
    // Check if it's a word that adds 'es' (classes, boxes, etc.)
    const stem = word.slice(0, -2);
    if (stem.endsWith('s') || stem.endsWith('x') || stem.endsWith('z') || stem.endsWith('ch') || stem.endsWith('sh')) {
      return stem;
    }
    // Otherwise just remove 's'
    return word.slice(0, -1);
  }

  if (word.endsWith('s') && !word.endsWith('ss')) {
    return word.slice(0, -1);
  }

  return word;
}

/**
 * Convert string to title case
 *
 * @example
 * toTitleCase('hello world') // 'Hello World'
 * toTitleCase('HELLO WORLD') // 'Hello World'
 */
export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Remove multiple consecutive spaces
 *
 * @example
 * normalizeWhitespace('hello    world') // 'hello world'
 * normalizeWhitespace('  spaces  ') // 'spaces'
 */
export function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Extract namespace from Salesforce API name
 *
 * @example
 * extractNamespace('MyNamespace__CustomObject__c') // 'MyNamespace'
 * extractNamespace('StandardObject') // null
 */
export function extractNamespace(apiName: string): string | null {
  // Match namespace pattern: letters/numbers/underscores followed by double underscore
  // But NOT ending with __c (that's the custom suffix, not namespace)
  const match = apiName.match(/^([a-zA-Z][a-zA-Z0-9_]*?)__(?!c$)/);
  return match ? match[1] : null;
}

/**
 * Check if API name is custom (ends with __c)
 *
 * @example
 * isCustom('MyField__c') // true
 * isCustom('Name') // false
 */
export function isCustom(apiName: string): boolean {
  return apiName.endsWith('__c');
}

/**
 * Format bytes to human-readable string
 *
 * @example
 * formatBytes(1024) // '1.00 KB'
 * formatBytes(1048576) // '1.00 MB'
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(dm)} ${sizes[i]}`;
}

logger.debug('String utilities loaded');
