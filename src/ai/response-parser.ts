/**
 * AI Response Parser - US-059
 * Parse AI responses reliably and extract actionable information
 *
 * @ac US-059-AC-1: Parse JSON responses
 * @ac US-059-AC-2: Handle malformed responses
 * @ac US-059-AC-3: Extract structured data
 * @ac US-059-AC-4: Validate response schema
 * @ac US-059-AC-5: Handle AI hallucinations
 * @ac US-059-AC-6: Confidence scoring
 * @issue #59
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('ResponseParser');

export interface ParsedResponse<T> {
  success: boolean;
  data?: T;
  confidence: number;
  warnings: string[];
  errors: string[];
  rawContent: string;
  hallucinationDetected: boolean;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
  missingFields: string[];
  invalidTypes: string[];
}

/**
 * @ac US-059-AC-1: Parse JSON responses
 * @ac US-059-AC-2: Handle malformed responses
 */
export class ResponseParser {
  /**
   * @ac US-059-AC-1: Parse JSON responses
   * Parse AI response into structured data
   */
  public parse<T>(content: string, schema?: Record<string, unknown>): ParsedResponse<T> {
    const result: ParsedResponse<T> = {
      success: false,
      confidence: 0,
      warnings: [],
      errors: [],
      rawContent: content,
      hallucinationDetected: false,
    };

    try {
      // Extract JSON from response
      const json = this.extractJSON(content);
      if (!json) {
        result.errors.push('No JSON found in response');
        return result;
      }

      // Parse JSON
      const parsed = JSON.parse(json) as T;

      // Validate schema if provided
      if (schema) {
        const validation = this.validateSchema(parsed, schema);
        if (!validation.valid) {
          result.errors.push(...validation.errors);
          result.warnings.push(...validation.missingFields.map((f) => `Missing field: ${f}`));
          result.success = false; // Mark as failed if schema validation fails
          return result;
        }
      }

      // Check for hallucinations
      const hallucinationCheck = this.detectHallucinations(content, parsed);
      if (hallucinationCheck.detected) {
        result.hallucinationDetected = true;
        result.warnings.push(...hallucinationCheck.warnings);
      }

      // Calculate confidence
      result.confidence = this.calculateConfidence(parsed, schema, result.warnings.length);

      result.data = parsed;
      result.success = true;

      logger.debug('Response parsed successfully', {
        confidence: result.confidence,
        warnings: result.warnings.length,
      });

      return result;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
      logger.error('Failed to parse response', {
        error: error instanceof Error ? error.message : String(error),
      });
      return result;
    }
  }

  /**
   * @ac US-059-AC-2: Handle malformed responses
   * Extract JSON from potentially malformed response
   */
  private extractJSON(content: string): string | null {
    // Try to find JSON block with code fences
    const codeBlockMatch = /```json\s*([\s\S]*?)\s*```/.exec(content);
    if (codeBlockMatch) {
      return codeBlockMatch[1];
    }

    // Try to find JSON array first (before objects, as arrays can contain objects)
    const arrayMatch = /\[[\s\S]*\]/.exec(content);
    if (arrayMatch) {
      return arrayMatch[0];
    }

    // Try to find raw JSON object
    const jsonMatch = /\{[\s\S]*\}/.exec(content);
    if (jsonMatch) {
      return jsonMatch[0];
    }

    return null;
  }

  /**
   * @ac US-059-AC-4: Validate response schema
   * Validate parsed data against schema
   */
  private validateSchema(data: unknown, schema: Record<string, unknown>): SchemaValidationResult {
    const result: SchemaValidationResult = {
      valid: true,
      errors: [],
      missingFields: [],
      invalidTypes: [],
    };

    if (typeof data !== 'object' || data === null) {
      result.valid = false;
      result.errors.push('Data is not an object');
      return result;
    }

    const dataObj = data as Record<string, unknown>;

    // Check required fields
    for (const [field, expectedType] of Object.entries(schema)) {
      if (!(field in dataObj)) {
        result.missingFields.push(field);
        result.valid = false;
        continue;
      }

      // Basic type checking
      const actualType = Array.isArray(dataObj[field]) ? 'array' : typeof dataObj[field];
      if (expectedType !== actualType && expectedType !== 'any') {
        result.invalidTypes.push(`${field}: expected ${String(expectedType)}, got ${actualType}`);
        result.valid = false;
      }
    }

    return result;
  }

  /**
   * @ac US-059-AC-5: Handle AI hallucinations
   * Detect potential hallucinations in AI response
   */
  private detectHallucinations(content: string, parsed: unknown): { detected: boolean; warnings: string[] } {
    const warnings: string[] = [];

    // Check for common hallucination patterns
    const hallucinationPatterns = [
      /I apologize|I'm sorry|I cannot|I don't have/i,
      /As an AI|As a language model/i,
      /hypothetical|example|placeholder/i,
    ];

    for (const pattern of hallucinationPatterns) {
      if (pattern.test(content)) {
        warnings.push(`Possible hallucination detected: ${pattern.source}`);
      }
    }

    // Check for suspiciously generic data
    if (typeof parsed === 'object' && parsed !== null) {
      const dataObj = parsed as Record<string, unknown>;
      for (const [key, value] of Object.entries(dataObj)) {
        if (
          typeof value === 'string' &&
          (value.toLowerCase().includes('example') ||
            value.toLowerCase().includes('placeholder') ||
            value.toLowerCase().includes('todo'))
        ) {
          warnings.push(`Suspicious generic value in field "${key}": ${value}`);
        }
      }
    }

    return {
      detected: warnings.length > 0,
      warnings,
    };
  }

  /**
   * @ac US-059-AC-6: Confidence scoring
   * Calculate confidence score for parsed response
   */
  private calculateConfidence(data: unknown, schema?: Record<string, unknown>, warningCount = 0): number {
    let confidence = 1.0;

    // Reduce confidence for schema validation issues
    if (schema) {
      const validation = this.validateSchema(data, schema);
      confidence -= validation.missingFields.length * 0.1;
      confidence -= validation.invalidTypes.length * 0.15;
    }

    // Reduce confidence for warnings
    confidence -= warningCount * 0.05;

    // Check data completeness
    if (typeof data === 'object' && data !== null) {
      const dataObj = data as Record<string, unknown>;
      const emptyFields = Object.values(dataObj).filter((v) => v === null || v === undefined || v === '').length;
      confidence -= emptyFields * 0.05;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * @ac US-059-AC-3: Extract structured data
   * Parse array of items from response
   */
  public parseArray<T>(content: string): ParsedResponse<T[]> {
    const result = this.parse<T[]>(content);

    if (result.success && result.data && !Array.isArray(result.data)) {
      result.success = false;
      result.errors.push('Response is not an array');
      result.data = undefined;
    }

    return result;
  }

  /**
   * Format parsing report
   */
  public formatReport<T>(result: ParsedResponse<T>): string {
    const lines: string[] = [];

    lines.push('📝 AI Response Parse Report');
    lines.push('═══════════════════════════════════════');

    if (result.success) {
      lines.push(`✅ Success: Confidence ${(result.confidence * 100).toFixed(0)}%`);
    } else {
      lines.push('❌ Failed to parse response');
    }

    if (result.errors.length > 0) {
      lines.push('');
      lines.push('❌ Errors:');
      for (const error of result.errors) {
        lines.push(`   - ${error}`);
      }
    }

    if (result.warnings.length > 0) {
      lines.push('');
      lines.push('⚠️  Warnings:');
      for (const warning of result.warnings) {
        lines.push(`   - ${warning}`);
      }
    }

    if (result.hallucinationDetected) {
      lines.push('');
      lines.push('🔍 Hallucination detected - review data carefully');
    }

    return lines.join('\n');
  }
}
