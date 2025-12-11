/**
 * Error-Resilient Parser Wrapper - US-071
 * Gracefully handles parse errors without breaking analysis
 *
 * @ac US-071-AC-1: Catch and log parse errors
 * @ac US-071-AC-2: Continue with other files
 * @ac US-071-AC-3: Report errors with file paths
 * @ac US-071-AC-4: Suggest fixes when possible
 * @ac US-071-AC-5: Aggregate error report
 * @ac US-071-AC-6: Option to fail-fast
 * @issue #71
 */

import { getLogger } from '../utils/logger.js';
import { getErrorAggregator } from '../utils/error-aggregator.js';
import type { MetadataComponent } from '../types/metadata.js';

const logger = getLogger('ErrorResilientParser');
const errorAggregator = getErrorAggregator();

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: ParseError;
  filePath: string;
}

export interface ParseError {
  filePath: string;
  errorType: string;
  message: string;
  lineNumber?: number;
  columnNumber?: number;
  suggestedFix?: string;
  stack?: string;
}

export interface ParserOptions {
  /** Stop on first error */
  failFast: boolean;
  /** Log errors to aggregator */
  logErrors: boolean;
  /** Attempt to suggest fixes */
  suggestFixes: boolean;
}

type ParserFunction<T> = (filePath: string) => Promise<T> | T;

/**
 * @ac US-071-AC-1: Catch and log parse errors
 * @ac US-071-AC-2: Continue with other files
 */
export class ErrorResilientParser {
  private readonly options: ParserOptions;
  private readonly errors: ParseError[] = [];

  public constructor(options: Partial<ParserOptions> = {}) {
    this.options = {
      failFast: options.failFast ?? false,
      logErrors: options.logErrors ?? true,
      suggestFixes: options.suggestFixes ?? true,
    };

    logger.debug('Error-resilient parser initialized', { options: this.options });
  }

  /**
   * @ac US-071-AC-1: Catch and log parse errors
   * @ac US-071-AC-2: Continue with other files
   * Parse multiple files with error resilience
   */
  public async parseFiles<T>(filePaths: string[], parser: ParserFunction<T>): Promise<ParseResult<T>[]> {
    const results: ParseResult<T>[] = [];

    logger.info('Starting resilient parse', {
      fileCount: filePaths.length,
      failFast: this.options.failFast,
    });

    for (const filePath of filePaths) {
      const result = await this.parseFile(filePath, parser);
      results.push(result);

      // Stop if fail-fast is enabled and we hit an error
      if (this.options.failFast && !result.success) {
        logger.warn('Fail-fast enabled, stopping parse', {
          filePath,
          totalProcessed: results.length,
          totalFiles: filePaths.length,
        });
        break;
      }
    }

    logger.info('Resilient parse completed', {
      totalFiles: filePaths.length,
      successCount: results.filter((r) => r.success).length,
      errorCount: results.filter((r) => !r.success).length,
    });

    return results;
  }

  /**
   * @ac US-071-AC-1: Catch and log parse errors
   * Parse single file with error handling
   */
  public async parseFile<T>(filePath: string, parser: ParserFunction<T>): Promise<ParseResult<T>> {
    try {
      const data = await parser(filePath);

      return {
        success: true,
        data,
        filePath,
      };
    } catch (error) {
      const parseError = this.createParseError(filePath, error);

      // Log to aggregator
      if (this.options.logErrors) {
        errorAggregator.addError({
          message: parseError.message,
          type: parseError.errorType,
          severity: 'MEDIUM',
          filePath: parseError.filePath,
          lineNumber: parseError.lineNumber,
          columnNumber: parseError.columnNumber,
          context: {
            suggestedFix: parseError.suggestedFix,
          },
        });
      }

      // Track locally
      this.errors.push(parseError);

      logger.warn('Parse error caught', {
        filePath,
        errorType: parseError.errorType,
        message: parseError.message,
      });

      return {
        success: false,
        error: parseError,
        filePath,
      };
    }
  }

  /**
   * @ac US-071-AC-3: Report errors with file paths
   * @ac US-071-AC-4: Suggest fixes when possible
   * Create structured parse error
   */
  private createParseError(filePath: string, error: unknown): ParseError {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Extract line/column from error message if available
    const locationMatch = /:(\d+):(\d+)/.exec(errorMessage);
    const lineNumber = locationMatch ? Number.parseInt(locationMatch[1], 10) : undefined;
    const columnNumber = locationMatch ? Number.parseInt(locationMatch[2], 10) : undefined;

    // Determine error type
    const errorType = this.categorizeError(errorMessage);

    // Suggest fix if enabled
    const suggestedFix = this.options.suggestFixes ? this.suggestFix(errorType, errorMessage) : undefined;

    return {
      filePath,
      errorType,
      message: errorMessage,
      lineNumber,
      columnNumber,
      suggestedFix,
      stack: errorStack,
    };
  }

  /**
   * Categorize error by type
   */
  private categorizeError(message: string): string {
    const patterns = [
      { pattern: /syntax error/i, type: 'SyntaxError' },
      { pattern: /unexpected token/i, type: 'SyntaxError' },
      { pattern: /missing/i, type: 'SyntaxError' },
      { pattern: /expected/i, type: 'SyntaxError' },
      { pattern: /cannot find/i, type: 'ReferenceError' },
      { pattern: /not found/i, type: 'ReferenceError' },
      { pattern: /ENOENT/i, type: 'FileNotFoundError' },
      { pattern: /EACCES/i, type: 'PermissionError' },
      { pattern: /encoding/i, type: 'EncodingError' },
      { pattern: /xml/i, type: 'XMLParseError' },
    ];

    for (const { pattern, type } of patterns) {
      if (pattern.test(message)) {
        return type;
      }
    }

    return 'ParseError';
  }

  /**
   * @ac US-071-AC-4: Suggest fixes when possible
   * Suggest fix based on error type
   */
  private suggestFix(errorType: string, message: string): string | undefined {
    const suggestions: Record<string, string> = {
      SyntaxError: 'Check for missing brackets, quotes, or semicolons. Validate XML/JSON structure.',
      ReferenceError: 'Ensure the referenced component exists in the project or check dependencies.',
      FileNotFoundError: 'Verify the file exists at the specified path. Check .forceignore rules.',
      PermissionError: 'Check file permissions. Ensure read access to the file.',
      EncodingError: 'Ensure file is encoded in UTF-8. Check for BOM or special characters.',
      XMLParseError: 'Validate XML syntax. Check for unclosed tags or missing declarations.',
    };

    const baseSuggestion = suggestions[errorType];

    // Add specific suggestions based on message
    if (message.includes('Unexpected token')) {
      return `${baseSuggestion || ''} Check for stray characters or incorrect syntax.`.trim();
    }

    if (message.includes('Expected')) {
      return `${baseSuggestion || ''} Ensure all required elements are present.`.trim();
    }

    return baseSuggestion;
  }

  /**
   * @ac US-071-AC-5: Aggregate error report
   * Generate comprehensive error report
   */
  public generateErrorReport(): string {
    const lines: string[] = [];

    lines.push('🔧 Parse Error Report');
    lines.push('═══════════════════════════════════════');

    if (this.errors.length === 0) {
      lines.push('✅ No parse errors encountered');
      return lines.join('\n');
    }

    lines.push(`❌ Total Errors: ${this.errors.length}`);
    lines.push('');

    // Group by error type
    const byType = new Map<string, ParseError[]>();
    for (const error of this.errors) {
      const errors = byType.get(error.errorType) || [];
      errors.push(error);
      byType.set(error.errorType, errors);
    }

    lines.push('📊 Errors by Type:');
    for (const [type, errors] of byType.entries()) {
      lines.push(`   ${type}: ${errors.length}`);
    }
    lines.push('');

    // List errors (limit to first 20)
    lines.push('📋 Error Details:');
    const errorsToShow = this.errors.slice(0, 20);

    for (const [index, error] of errorsToShow.entries()) {
      lines.push(`\n${index + 1}. ${error.errorType} in ${error.filePath}`);
      lines.push(`   Message: ${error.message}`);

      if (error.lineNumber) {
        lines.push(`   Location: Line ${error.lineNumber}${error.columnNumber ? `:${error.columnNumber}` : ''}`);
      }

      if (error.suggestedFix) {
        lines.push(`   💡 Suggestion: ${error.suggestedFix}`);
      }
    }

    if (this.errors.length > 20) {
      lines.push(`\n... and ${this.errors.length - 20} more errors`);
    }

    return lines.join('\n');
  }

  /**
   * Get all errors
   */
  public getErrors(): ParseError[] {
    return [...this.errors];
  }

  /**
   * Get error count
   */
  public getErrorCount(): number {
    return this.errors.length;
  }

  /**
   * Check if any errors occurred
   */
  public hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Clear errors
   */
  public clearErrors(): void {
    this.errors.length = 0;
  }

  /**
   * Get successful parse count
   */
  public static getSuccessCount(results: ParseResult<unknown>[]): number {
    return results.filter((r) => r.success).length;
  }

  /**
   * Get failed parse count
   */
  public static getFailureCount(results: ParseResult<unknown>[]): number {
    return results.filter((r) => !r.success).length;
  }

  /**
   * Extract only successful results
   */
  public static getSuccessfulData<T>(results: ParseResult<T>[]): T[] {
    return results.filter((r) => r.success && r.data !== undefined).map((r) => r.data!);
  }

  /**
   * Extract only errors
   */
  public static getErrors(results: ParseResult<unknown>[]): ParseError[] {
    return results.filter((r) => !r.success && r.error !== undefined).map((r) => r.error!);
  }
}

