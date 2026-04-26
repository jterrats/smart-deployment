import type { ValidationResult } from './xml-validation-types.js';

const RESERVED_KEYWORDS = new Set([
  'abstract',
  'activate',
  'and',
  'any',
  'array',
  'as',
  'asc',
  'autonomous',
  'begin',
  'bigdecimal',
  'blob',
  'break',
  'bulk',
  'by',
  'case',
  'cast',
  'catch',
  'char',
  'class',
  'collect',
  'commit',
  'const',
  'continue',
  'convertcurrency',
  'decimal',
  'default',
  'delete',
  'desc',
  'do',
  'else',
  'end',
  'enum',
  'exception',
  'exit',
  'export',
  'extends',
  'false',
  'final',
  'finally',
  'float',
  'for',
  'from',
  'future',
  'global',
  'goto',
  'group',
  'having',
  'hint',
  'if',
  'implements',
  'import',
  'in',
  'inner',
  'insert',
  'instanceof',
  'int',
  'interface',
  'into',
  'join',
  'like',
  'limit',
  'list',
  'long',
  'loop',
  'map',
  'merge',
  'new',
  'not',
  'null',
  'nulls',
  'number',
  'object',
  'of',
  'on',
  'or',
  'outer',
  'override',
  'package',
  'parallel',
  'pragma',
  'private',
  'protected',
  'public',
  'retrieve',
  'return',
  'rollback',
  'select',
  'set',
  'short',
  'sort',
  'static',
  'super',
  'switch',
  'synchronized',
  'system',
  'testmethod',
  'then',
  'this',
  'throw',
  'transaction',
  'trigger',
  'true',
  'try',
  'type',
  'undelete',
  'update',
  'upsert',
  'using',
  'virtual',
  'void',
  'webservice',
  'when',
  'where',
  'while',
]);

export function validateReferences(content: string, result: ValidationResult): void {
  const patterns = [
    { regex: /<field>([^<]+)<\/field>/g, type: 'field' },
    { regex: /<object>([^<]+)<\/object>/g, type: 'object' },
    { regex: /<class>([^<]+)<\/class>/g, type: 'class' },
  ];

  for (const pattern of patterns) {
    const matches = [...content.matchAll(pattern.regex)];

    for (const match of matches) {
      const reference = match[1];

      if (!/^[a-zA-Z][a-zA-Z0-9_]*(__c)?$/.test(reference)) {
        result.errors.push({
          type: 'reference',
          message: `Invalid ${pattern.type} name: ${reference}`,
          severity: 'warning',
        });
      }

      if (RESERVED_KEYWORDS.has(reference.toLowerCase())) {
        result.errors.push({
          type: 'reference',
          message: `Reserved keyword used as ${pattern.type} name: ${reference}`,
          severity: 'error',
        });
      }
    }
  }
}

export function generateSuggestions(result: ValidationResult, maxApiVersion: number): void {
  for (const error of result.errors) {
    if (error.type === 'version' && error.message.includes('too old')) {
      result.suggestions.push({
        issue: error.message,
        fix: `Update API version to ${maxApiVersion}`,
        autoFixable: true,
      });
    }

    if (error.type === 'reference' && error.message.includes('Invalid')) {
      const match = error.message.match(/: (.+)$/);
      if (!match) {
        continue;
      }

      result.suggestions.push({
        issue: error.message,
        fix: `Rename to: ${suggestFixedName(match[1])}`,
        autoFixable: false,
      });
    }
  }
}

function suggestFixedName(invalidName: string): string {
  let fixed = invalidName.replace(/[^a-zA-Z0-9_]/g, '_');

  if (!/^[a-zA-Z]/.test(fixed)) {
    fixed = `Field_${fixed}`;
  }

  return fixed;
}
