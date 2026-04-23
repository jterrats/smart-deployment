/**
 * Error Aggregator - US-076 Enhancement
 * Aggregates and categorizes errors for comprehensive reporting
 *
 * @ac US-076-AC-5: File and line numbers
 * @ac US-076-AC-6: Error aggregation
 * @issue #76
 */

import { getLogger } from './logger.js';

const logger = getLogger('ErrorAggregator');

export type AggregatedError = {
  filePath?: string;
  lineNumber?: number;
  columnNumber?: number;
  errorType: string;
  errorMessage: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: Date;
  stack?: string;
  context?: Record<string, unknown>;
};

export type ErrorStats = {
  total: number;
  byType: Map<string, number>;
  bySeverity: Map<string, number>;
  byFile: Map<string, number>;
};

export type ErrorReport = {
  totalErrors: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  errors: AggregatedError[];
  stats: ErrorStats;
  timestamp: Date;
};

/**
 * @ac US-076-AC-6: Error aggregation
 */
export class ErrorAggregator {
  private errors: AggregatedError[] = [];
  private readonly maxErrors: number;

  public constructor(maxErrors: number = 1000) {
    this.maxErrors = maxErrors;
  }

  /**
   * @ac US-076-AC-5: File and line numbers
   * Add error with file location
   */
  public addError(error: {
    message: string;
    type?: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    filePath?: string;
    lineNumber?: number;
    columnNumber?: number;
    stack?: string;
    context?: Record<string, unknown>;
  }): void {
    // Extract file/line from stack if not provided
    let { filePath, lineNumber, columnNumber } = error;
    if (!filePath && error.stack) {
      const location = this.extractLocationFromStack(error.stack);
      filePath = filePath ?? location.filePath;
      lineNumber = lineNumber ?? location.lineNumber;
      columnNumber = columnNumber ?? location.columnNumber;
    }

    const aggregatedError: AggregatedError = {
      filePath,
      lineNumber,
      columnNumber,
      errorType: error.type ?? 'UnknownError',
      errorMessage: error.message,
      severity: error.severity ?? 'MEDIUM',
      timestamp: new Date(),
      stack: error.stack,
      context: error.context,
    };

    this.errors.push(aggregatedError);

    // Trim if exceeding max
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
      logger.warn('Error buffer full, dropping oldest error');
    }

    logger.debug('Error added to aggregator', {
      type: aggregatedError.errorType,
      severity: aggregatedError.severity,
      file: filePath,
    });
  }

  /**
   * Extract file path and line number from stack trace
   */
  private extractLocationFromStack(stack: string): {
    filePath?: string;
    lineNumber?: number;
    columnNumber?: number;
  } {
    // Match patterns like:
    //   at Object.<anonymous> (/path/to/file.ts:123:45)
    //   at /path/to/file.ts:123:45
    const patterns = [
      /\((.+):(\d+):(\d+)\)/, // (path:line:col)
      /at (.+):(\d+):(\d+)/, // at path:line:col
      /(.+):(\d+):(\d+)$/, // path:line:col at end
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(stack);
      if (match) {
        return {
          filePath: match[1],
          lineNumber: Number.parseInt(match[2], 10),
          columnNumber: Number.parseInt(match[3], 10),
        };
      }
    }

    return {};
  }

  /**
   * Get all aggregated errors
   */
  public getErrors(): AggregatedError[] {
    return [...this.errors];
  }

  /**
   * Get errors filtered by severity
   */
  public getErrorsBySeverity(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): AggregatedError[] {
    return this.errors.filter((e) => e.severity === severity);
  }

  /**
   * Get errors filtered by type
   */
  public getErrorsByType(type: string): AggregatedError[] {
    return this.errors.filter((e) => e.errorType === type);
  }

  /**
   * Get errors filtered by file
   */
  public getErrorsByFile(filePath: string): AggregatedError[] {
    return this.errors.filter((e) => e.filePath === filePath);
  }

  /**
   * Generate statistics
   */
  public getStats(): ErrorStats {
    const stats: ErrorStats = {
      total: this.errors.length,
      byType: new Map(),
      bySeverity: new Map(),
      byFile: new Map(),
    };

    for (const error of this.errors) {
      // Count by type
      stats.byType.set(error.errorType, (stats.byType.get(error.errorType) ?? 0) + 1);

      // Count by severity
      stats.bySeverity.set(error.severity, (stats.bySeverity.get(error.severity) ?? 0) + 1);

      // Count by file
      if (error.filePath) {
        stats.byFile.set(error.filePath, (stats.byFile.get(error.filePath) ?? 0) + 1);
      }
    }

    return stats;
  }

  /**
   * Generate comprehensive error report
   */
  public generateReport(): ErrorReport {
    const stats = this.getStats();

    return {
      totalErrors: this.errors.length,
      criticalCount: stats.bySeverity.get('CRITICAL') ?? 0,
      highCount: stats.bySeverity.get('HIGH') ?? 0,
      mediumCount: stats.bySeverity.get('MEDIUM') ?? 0,
      lowCount: stats.bySeverity.get('LOW') ?? 0,
      errors: this.getErrors(),
      stats,
      timestamp: new Date(),
    };
  }

  /**
   * Format error report as human-readable string
   */
  public formatReport(includeStackTraces: boolean = false): string {
    const report = this.generateReport();
    const lines: string[] = [];

    lines.push('🚨 Error Report');
    lines.push('═══════════════════════════════════════');
    lines.push(`📊 Total Errors: ${report.totalErrors}`);
    lines.push('');

    lines.push('📈 By Severity:');
    lines.push(`   🔴 CRITICAL: ${report.criticalCount}`);
    lines.push(`   🟠 HIGH: ${report.highCount}`);
    lines.push(`   🟡 MEDIUM: ${report.mediumCount}`);
    lines.push(`   🟢 LOW: ${report.lowCount}`);
    lines.push('');

    if (report.stats.byType.size > 0) {
      lines.push('🏷️  By Type:');
      const sortedTypes = Array.from(report.stats.byType.entries()).sort((a, b) => b[1] - a[1]);
      for (const [type, count] of sortedTypes.slice(0, 10)) {
        lines.push(`   ${type}: ${count}`);
      }
      if (sortedTypes.length > 10) {
        lines.push(`   ... and ${sortedTypes.length - 10} more`);
      }
      lines.push('');
    }

    if (report.stats.byFile.size > 0) {
      lines.push('📁 Files with Most Errors:');
      const sortedFiles = Array.from(report.stats.byFile.entries()).sort((a, b) => b[1] - a[1]);
      for (const [file, count] of sortedFiles.slice(0, 10)) {
        lines.push(`   ${file}: ${count} errors`);
      }
      if (sortedFiles.length > 10) {
        lines.push(`   ... and ${sortedFiles.length - 10} more files`);
      }
      lines.push('');
    }

    // List errors (limit to first 20)
    if (report.errors.length > 0) {
      lines.push('📋 Error Details:');
      const errorsToShow = report.errors.slice(0, 20);

      for (const [index, error] of errorsToShow.entries()) {
        const severity = this.getSeverityIcon(error.severity);
        lines.push(`\n${index + 1}. ${severity} ${error.errorType}`);
        lines.push(`   Message: ${error.errorMessage}`);
        if (error.filePath) {
          lines.push(`   Location: ${error.filePath}:${error.lineNumber ?? '?'}:${error.columnNumber ?? '?'}`);
        }
        if (error.context && Object.keys(error.context).length > 0) {
          lines.push(`   Context: ${JSON.stringify(error.context)}`);
        }
        if (includeStackTraces && error.stack) {
          lines.push(`   Stack:\n${error.stack.split('\n').slice(0, 5).join('\n')}`);
        }
      }

      if (report.errors.length > 20) {
        lines.push(`\n... and ${report.errors.length - 20} more errors`);
      }
    }

    lines.push('');
    lines.push(`📅 Generated: ${report.timestamp.toISOString()}`);

    return lines.join('\n');
  }

  /**
   * Get severity icon
   */
  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'CRITICAL':
        return '🔴';
      case 'HIGH':
        return '🟠';
      case 'MEDIUM':
        return '🟡';
      case 'LOW':
        return '🟢';
      default:
        return '⚪';
    }
  }

  /**
   * Check if there are critical errors
   */
  public hasCriticalErrors(): boolean {
    return this.errors.some((e) => e.severity === 'CRITICAL');
  }

  /**
   * Check if there are high or critical errors
   */
  public hasHighSeverityErrors(): boolean {
    return this.errors.some((e) => e.severity === 'CRITICAL' || e.severity === 'HIGH');
  }

  /**
   * Clear all errors
   */
  public clear(): void {
    this.errors = [];
    logger.debug('Error aggregator cleared');
  }

  /**
   * Get error count
   */
  public getCount(): number {
    return this.errors.length;
  }
}

/**
 * Global error aggregator instance
 */
let globalAggregator: ErrorAggregator | null = null;

/**
 * Get global error aggregator instance
 */
export function getErrorAggregator(): ErrorAggregator {
  if (!globalAggregator) {
    globalAggregator = new ErrorAggregator();
  }
  return globalAggregator;
}

/**
 * Reset global error aggregator (for testing)
 */
export function resetErrorAggregator(): void {
  globalAggregator = null;
}
