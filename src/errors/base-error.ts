/**
 * Base custom error class with context and suggestions
 *
 * All plugin errors extend this base class to provide:
 * - Structured error context
 * - Actionable suggestions
 * - JSON serialization
 * - Stack trace preservation
 */
export abstract class SmartDeploymentError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;
  public readonly suggestions: string[];
  public readonly timestamp: Date;

  public constructor(message: string, code: string, context: Record<string, unknown> = {}, suggestions: string[] = []) {
    super(message);

    // Maintain proper stack trace (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.suggestions = suggestions;
    this.timestamp = new Date();

    // Ensure instanceof works correctly
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Serialize error to JSON for logging/reporting
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      suggestions: this.suggestions,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }

  /**
   * Format error for display to user
   */
  public toString(): string {
    const lines: string[] = [`${this.name} [${this.code}]: ${this.message}`, ''];

    // Add context if present
    if (Object.keys(this.context).length > 0) {
      lines.push('Context:');
      for (const [key, value] of Object.entries(this.context)) {
        lines.push(`  ${key}: ${JSON.stringify(value)}`);
      }
      lines.push('');
    }

    // Add suggestions if present
    if (this.suggestions.length > 0) {
      lines.push('Suggestions:');
      for (const suggestion of this.suggestions) {
        lines.push(`  • ${suggestion}`);
      }
    }

    return lines.join('\n');
  }
}
