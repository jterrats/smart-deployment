/**
 * Validation Error Reporter - US-075
 * Clear validation error messages with documentation links
 *
 * @ac US-075-AC-1: User-friendly error messages
 * @ac US-075-AC-2: Include file paths
 * @ac US-075-AC-3: Include line numbers
 * @ac US-075-AC-4: Suggest fixes
 * @ac US-075-AC-5: Link to documentation
 * @ac US-075-AC-6: Categorize by severity
 * @issue #75
 */

import { ValidationError } from './validation-error.js';

const DOCS_BASE_URL = 'https://github.com/jterrats/smart-deployment/blob/main/docs';

export class ValidationErrorReporter {
  /**
   * @ac US-075-AC-5: Link to documentation
   * Get documentation link for error
   */
  public getDocumentationLink(errorCode: string): string {
    const docMap: Record<string, string> = {
      INVALID_DEPENDENCY: `${DOCS_BASE_URL}/errors/INVALID_DEPENDENCY.md`,
      CIRCULAR_DEPENDENCY: `${DOCS_BASE_URL}/errors/CIRCULAR_DEPENDENCY.md`,
      MISSING_COMPONENT: `${DOCS_BASE_URL}/errors/MISSING_COMPONENT.md`,
      INVALID_METADATA: `${DOCS_BASE_URL}/errors/INVALID_METADATA.md`,
    };

    return docMap[errorCode] || `${DOCS_BASE_URL}/ERROR_CATALOG.md`;
  }

  /**
   * @ac US-075-AC-1: User-friendly error messages
   * @ac US-075-AC-2: Include file paths
   * @ac US-075-AC-3: Include line numbers
   * @ac US-075-AC-4: Suggest fixes
   * @ac US-075-AC-5: Link to documentation
   * Format validation error with all details
   */
  public format(error: ValidationError): string {
    const lines: string[] = [];

    lines.push(`❌ ${error.name} [${error.code}]`);
    lines.push(`   ${error.message}`);
    lines.push('');

    // File and line info
    if (error.context.file) {
      lines.push(`📁 File: ${error.context.file as string}`);
      if (error.context.line) {
        lines.push(`📍 Line: ${error.context.line as string}`);
      }
      lines.push('');
    }

    // Suggestions
    if (error.suggestions.length > 0) {
      lines.push('💡 Suggested Fixes:');
      for (const suggestion of error.suggestions) {
        lines.push(`   • ${suggestion}`);
      }
      lines.push('');
    }

    // Documentation link
    const docLink = this.getDocumentationLink(error.code);
    lines.push(`📖 Documentation: ${docLink}`);

    return lines.join('\n');
  }

  /**
   * @ac US-075-AC-6: Categorize by severity
   * Format multiple validation errors grouped by severity
   */
  public formatMultiple(errors: ValidationError[]): string {
    const lines: string[] = [];

    lines.push('📋 Validation Errors Report');
    lines.push('═══════════════════════════════════════');
    lines.push(`Total Errors: ${errors.length}`);
    lines.push('');

    // Group by severity (based on code)
    const critical = errors.filter((e) => e.code.includes('CRITICAL'));
    const high = errors.filter((e) => e.code.includes('ERROR'));
    const medium = errors.filter((e) => e.code.includes('WARNING'));

    if (critical.length > 0) {
      lines.push(`🔴 Critical (${critical.length}):`);
      for (const error of critical) {
        lines.push(`   ${error.message}`);
      }
      lines.push('');
    }

    if (high.length > 0) {
      lines.push(`🟠 Errors (${high.length}):`);
      for (const error of high) {
        lines.push(`   ${error.message}`);
      }
      lines.push('');
    }

    if (medium.length > 0) {
      lines.push(`🟡 Warnings (${medium.length}):`);
      for (const error of medium) {
        lines.push(`   ${error.message}`);
      }
    }

    return lines.join('\n');
  }
}
