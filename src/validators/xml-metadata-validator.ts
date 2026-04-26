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
import { generateSuggestions, validateReferences } from './xml/xml-reference-rules.js';
import { formatValidationReport } from './xml/xml-report-formatter.js';
import { validateSchema } from './xml/xml-schema-rules.js';
export type {
  ValidationError,
  ValidationResult,
  ValidationSuggestion,
  ValidationWarning,
} from './xml/xml-validation-types.js';
import type { ValidationResult } from './xml/xml-validation-types.js';

const logger = getLogger('XmlMetadataValidator');

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
      this.validateXmlSyntax(content, result);

      // 2. Validate against Salesforce schema
      validateSchema(content, filePath, result);

      // 3. Check API version
      this.validateApiVersion(content, result);

      // 4. Validate field references
      validateReferences(content, result);

      // 5. Generate suggestions
      generateSuggestions(result, this.maxApiVersion);

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
  private validateXmlSyntax(content: string, result: ValidationResult): void {
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
   * @ac US-091-AC-3: Check API version compatibility
   * Validate API version
   */
  private validateApiVersion(content: string, result: ValidationResult): void {
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
   * Format validation report
   */
  public formatReport(result: ValidationResult): string {
    return formatValidationReport(result);
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
