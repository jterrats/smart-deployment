/**
 * XML Metadata Validator - US-091
 * Pre-deployment XML validation with detailed error reporting
 *
 * @ac US-091-AC-1: Validate XML syntax
 * @ac US-091-AC-2: Validate against Salesforce schema
 * @ac US-091-AC-3: Check API version compatibility
 * @ac US-091-AC-4: Validate field references
 * @ac US-091-AC-5: Report validation errors with line numbers
 * @ac US-091-AC-6: Suggest auto-fixes
 * @issue #91
 */

import { promises as fs } from 'node:fs';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('XmlMetadataValidator');

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
  filePath: string;
}

export interface ValidationError {
  type: 'syntax' | 'schema' | 'reference' | 'version';
  message: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  message: string;
  line?: number;
  suggestion?: string;
}

export interface ValidationSuggestion {
  issue: string;
  fix: string;
  autoFixable: boolean;
}

/**
 * @ac US-091-AC-1: Validate XML syntax
 */
export class XmlMetadataValidator {
  private readonly minApiVersion = 40.0;
  private readonly maxApiVersion = 61.0;

  /**
   * @ac US-091-AC-1: Validate XML syntax
   * @ac US-091-AC-5: Report validation errors with line numbers
   * Validate XML file
   */
  public async validateFile(filePath: string): Promise<ValidationResult> {
    logger.info('Validating XML file', { filePath });

    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      filePath,
    };

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // 1. Validate XML syntax
      await this.validateXmlSyntax(content, result);

      // 2. Validate against Salesforce schema
      await this.validateSchema(content, filePath, result);

      // 3. Check API version
      await this.validateApiVersion(content, result);

      // 4. Validate field references
      await this.validateReferences(content, filePath, result);

      // 5. Generate suggestions
      this.generateSuggestions(result);

      result.isValid = result.errors.filter((e) => e.severity === 'error').length === 0;

      logger.info('Validation complete', {
        filePath,
        isValid: result.isValid,
        errors: result.errors.length,
        warnings: result.warnings.length,
      });

      return result;
    } catch (error) {
      result.isValid = false;
      result.errors.push({
        type: 'syntax',
        message: error instanceof Error ? error.message : String(error),
        severity: 'error',
      });

      return result;
    }
  }

  /**
   * @ac US-091-AC-1: Validate XML syntax
   * Validate XML is well-formed
   */
  private async validateXmlSyntax(content: string, result: ValidationResult): Promise<void> {
    // Basic XML validation
    const lines = content.split('\n');
    
    // Check for XML declaration
    if (!content.trim().startsWith('<?xml')) {
      result.errors.push({
        type: 'syntax',
        message: 'Missing XML declaration',
        line: 1,
        severity: 'warning',
      });
    }

    // Check for balanced tags
    const openTags: string[] = [];
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9_-]*)[^>]*>/g;

    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i];
      const tagMatches = [...currentLine.matchAll(tagRegex)];

      for (const tagMatch of tagMatches) {
        const fullTag = tagMatch[0];
        const tagName = tagMatch[1];
        const isClosing = fullTag.startsWith('</');

        if (isClosing) {
          if (openTags.length === 0 || openTags[openTags.length - 1] !== tagName) {
            result.errors.push({
              type: 'syntax',
              message: `Unmatched closing tag: ${tagName}`,
              line: i + 1,
              severity: 'error',
            });
          } else {
            openTags.pop();
          }
        } else if (!fullTag.endsWith('/>')) {
          // Opening tag (not self-closing)
          openTags.push(tagName);
        }
      }
    }

    if (openTags.length > 0) {
      result.errors.push({
        type: 'syntax',
        message: `Unclosed tags: ${openTags.join(', ')}`,
        line: lines.length,
        severity: 'error',
      });
    }
  }

  /**
   * @ac US-091-AC-2: Validate against Salesforce schema
   * Validate metadata structure
   */
  private async validateSchema(
    content: string,
    filePath: string,
    result: ValidationResult
  ): Promise<void> {
    // Get metadata type from file path
    const metadataType = this.getMetadataType(filePath);

    // Validate based on metadata type using regex patterns
    if (metadataType === 'ApexClass' || metadataType === 'ApexTrigger') {
      this.validateApexMetadata(content, result);
    } else if (metadataType === 'CustomObject') {
      this.validateObjectMetadata(content, result);
    } else if (metadataType === 'Profile' || metadataType === 'PermissionSet') {
      this.validateSecurityMetadata(content, result);
    }
  }

  /**
   * @ac US-091-AC-3: Check API version compatibility
   * Validate API version
   */
  private async validateApiVersion(content: string, result: ValidationResult): Promise<void> {
    const versionMatch = content.match(/<apiVersion>(\d+(?:\.\d+)?)<\/apiVersion>/);

    if (!versionMatch) {
      result.warnings.push({
        message: 'No API version specified',
        suggestion: `Add <apiVersion>${this.maxApiVersion}</apiVersion>`,
      });
      return;
    }

    const version = parseFloat(versionMatch[1]);

    if (version < this.minApiVersion) {
      result.errors.push({
        type: 'version',
        message: `API version ${version} is too old (minimum: ${this.minApiVersion})`,
        severity: 'error',
      });
    } else if (version > this.maxApiVersion) {
      result.warnings.push({
        message: `API version ${version} is newer than tested version ${this.maxApiVersion}`,
        suggestion: `Consider using version ${this.maxApiVersion}`,
      });
    } else if (version < this.maxApiVersion - 5) {
      result.warnings.push({
        message: `API version ${version} is outdated`,
        suggestion: `Consider updating to ${this.maxApiVersion}`,
      });
    }
  }

  /**
   * @ac US-091-AC-4: Validate field references
   * Validate field and object references
   */
  private async validateReferences(
    content: string,
    filePath: string,
    result: ValidationResult
  ): Promise<void> {
    // Check for common reference patterns
    const patterns = [
      { regex: /<field>([^<]+)<\/field>/g, type: 'field' },
      { regex: /<object>([^<]+)<\/object>/g, type: 'object' },
      { regex: /<class>([^<]+)<\/class>/g, type: 'class' },
    ];

    for (const pattern of patterns) {
      const matches = [...content.matchAll(pattern.regex)];

      for (const match of matches) {
        const reference = match[1];

        // Check for invalid characters
        if (!/^[a-zA-Z][a-zA-Z0-9_]*(__c)?$/.test(reference)) {
          result.errors.push({
            type: 'reference',
            message: `Invalid ${pattern.type} name: ${reference}`,
            severity: 'warning',
          });
        }

        // Check for reserved keywords
        if (this.isReservedKeyword(reference)) {
          result.errors.push({
            type: 'reference',
            message: `Reserved keyword used as ${pattern.type} name: ${reference}`,
            severity: 'error',
          });
        }
      }
    }
  }

  /**
   * @ac US-091-AC-6: Suggest auto-fixes
   * Generate fix suggestions
   */
  private generateSuggestions(result: ValidationResult): void {
    for (const error of result.errors) {
      if (error.type === 'version' && error.message.includes('too old')) {
        result.suggestions.push({
          issue: error.message,
          fix: `Update API version to ${this.maxApiVersion}`,
          autoFixable: true,
        });
      }

      if (error.type === 'reference' && error.message.includes('Invalid')) {
        const match = error.message.match(/: (.+)$/);
        if (match) {
          const invalidName = match[1];
          const fixedName = this.suggestFixedName(invalidName);
          result.suggestions.push({
            issue: error.message,
            fix: `Rename to: ${fixedName}`,
            autoFixable: false,
          });
        }
      }
    }
  }

  /**
   * Validate Apex metadata
   */
  private validateApexMetadata(content: string, result: ValidationResult): void {
    // Check for root element
    if (!content.includes('<ApexClass') && !content.includes('<ApexTrigger')) {
      result.errors.push({
        type: 'schema',
        message: 'Missing ApexClass or ApexTrigger root element',
        severity: 'error',
      });
      return;
    }

    // Check required fields
    if (!content.includes('<status>')) {
      result.errors.push({
        type: 'schema',
        message: 'Missing required field: status',
        severity: 'error',
      });
    }
  }

  /**
   * Validate Custom Object metadata
   */
  private validateObjectMetadata(content: string, result: ValidationResult): void {
    if (!content.includes('<CustomObject')) {
      result.errors.push({
        type: 'schema',
        message: 'Missing CustomObject root element',
        severity: 'error',
      });
      return;
    }

    // Check label
    if (!content.includes('<label>')) {
      result.errors.push({
        type: 'schema',
        message: 'Missing required field: label',
        severity: 'error',
      });
    }

    // Check plural label
    if (!content.includes('<pluralLabel>')) {
      result.warnings.push({
        message: 'Missing pluralLabel field',
        suggestion: 'Add pluralLabel for better user experience',
      });
    }
  }

  /**
   * Validate security metadata
   */
  private validateSecurityMetadata(content: string, result: ValidationResult): void {
    if (!content.includes('<Profile') && !content.includes('<PermissionSet')) {
      result.errors.push({
        type: 'schema',
        message: 'Missing Profile or PermissionSet root element',
        severity: 'error',
      });
    }
  }

  /**
   * Get metadata type from file path
   */
  private getMetadataType(filePath: string): string {
    if (filePath.includes('/classes/')) return 'ApexClass';
    if (filePath.includes('/triggers/')) return 'ApexTrigger';
    if (filePath.includes('/objects/')) return 'CustomObject';
    if (filePath.includes('/profiles/')) return 'Profile';
    if (filePath.includes('/permissionsets/')) return 'PermissionSet';
    return 'Unknown';
  }

  /**
   * Check if name is reserved keyword
   */
  private isReservedKeyword(name: string): boolean {
    const keywords = [
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
    ];

    return keywords.includes(name.toLowerCase());
  }

  /**
   * Suggest fixed name for invalid reference
   */
  private suggestFixedName(invalidName: string): string {
    // Remove invalid characters
    let fixed = invalidName.replace(/[^a-zA-Z0-9_]/g, '_');

    // Ensure starts with letter
    if (!/^[a-zA-Z]/.test(fixed)) {
      fixed = 'Field_' + fixed;
    }

    return fixed;
  }

  /**
   * Format validation report
   */
  public formatReport(result: ValidationResult): string {
    const lines: string[] = [];

    lines.push('🔍 XML Validation Report');
    lines.push('═══════════════════════════════════════');
    lines.push(`File: ${result.filePath}`);
    lines.push(`Status: ${result.isValid ? '✅ VALID' : '❌ INVALID'}`);
    lines.push('');

    if (result.errors.length > 0) {
      const errors = result.errors.filter((e) => e.severity === 'error');
      if (errors.length > 0) {
        lines.push(`🔴 Errors (${errors.length}):`);
        for (const error of errors) {
          const location = error.line ? ` [Line ${error.line}]` : '';
          lines.push(`  ${error.type.toUpperCase()}${location}: ${error.message}`);
        }
        lines.push('');
      }

      const warnings = result.errors.filter((e) => e.severity === 'warning');
      if (warnings.length > 0) {
        lines.push(`🟡 Warnings (${warnings.length}):`);
        for (const warning of warnings) {
          lines.push(`  ${warning.message}`);
        }
        lines.push('');
      }
    }

    if (result.warnings.length > 0) {
      lines.push(`⚠️  Additional Warnings (${result.warnings.length}):`);
      for (const warning of result.warnings) {
        lines.push(`  ${warning.message}`);
        if (warning.suggestion) {
          lines.push(`    💡 ${warning.suggestion}`);
        }
      }
      lines.push('');
    }

    if (result.suggestions.length > 0) {
      lines.push(`💡 Suggestions (${result.suggestions.length}):`);
      for (const suggestion of result.suggestions) {
        const autofix = suggestion.autoFixable ? ' [Auto-fixable]' : '';
        lines.push(`  ${suggestion.issue}`);
        lines.push(`    → ${suggestion.fix}${autofix}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Validate multiple files
   */
  public async validateFiles(filePaths: string[]): Promise<ValidationResult[]> {
    logger.info('Validating multiple files', { count: filePaths.length });

    const results = await Promise.all(filePaths.map((path) => this.validateFile(path)));

    logger.info('Batch validation complete', {
      total: results.length,
      valid: results.filter((r) => r.isValid).length,
      invalid: results.filter((r) => !r.isValid).length,
    });

    return results;
  }
}

