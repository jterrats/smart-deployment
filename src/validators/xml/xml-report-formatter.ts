import type { ValidationResult } from './xml-validation-types.js';

export function formatValidationReport(result: ValidationResult): string {
  const lines: string[] = [];

  lines.push('🔍 XML Validation Report');
  lines.push('═══════════════════════════════════════');
  lines.push(`File: ${result.filePath}`);
  lines.push(`Status: ${result.isValid ? '✅ VALID' : '❌ INVALID'}`);
  lines.push('');

  if (result.errors.length > 0) {
    const errors = result.errors.filter((error) => error.severity === 'error');
    if (errors.length > 0) {
      lines.push(`🔴 Errors (${errors.length}):`);
      for (const error of errors) {
        const location = error.line ? ` [Line ${error.line}]` : '';
        lines.push(`  ${error.type.toUpperCase()}${location}: ${error.message}`);
      }
      lines.push('');
    }

    const warnings = result.errors.filter((error) => error.severity === 'warning');
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
