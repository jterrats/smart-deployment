import { SmartDeploymentError } from './base-error.js';

/**
 * Error thrown when parsing metadata or project files fails
 *
 * @example
 * ```typescript
 * throw new ParsingError('Failed to parse package.xml', {
 *   filePath: '/path/to/package.xml',
 *   line: 42,
 *   column: 15,
 *   parseError: 'Unexpected token <'
 * });
 * ```
 */
export class ParsingError extends SmartDeploymentError {
  public constructor(
    message: string,
    context: {
      [key: string]: unknown;
      filePath?: string;
      line?: number;
      column?: number;
      parseError?: string;
    } = {}
  ) {
    const suggestions: string[] = [];

    // Add context-specific suggestions
    if (context.filePath?.endsWith('.xml')) {
      suggestions.push('Validate XML syntax using an XML validator');
      suggestions.push('Check for unclosed tags or invalid characters');
    }

    if (context.filePath?.endsWith('.json')) {
      suggestions.push('Validate JSON syntax using a JSON validator');
      suggestions.push('Check for trailing commas or unquoted keys');
    }

    if (context.line && context.column) {
      suggestions.push(`Check line ${context.line}, column ${context.column} in the file`);
    }

    if (context.filePath) {
      suggestions.push(`Review file: ${context.filePath}`);
    }

    super(message, 'PARSING_ERROR', context, suggestions);
  }
}

/**
 * Error thrown when XML parsing fails specifically
 */
export class XmlParsingError extends ParsingError {
  public constructor(message: string, context: Record<string, unknown> = {}) {
    super(`XML parsing failed: ${message}`, {
      ...context,
      xmlError: true,
    });
  }
}

/**
 * Error thrown when JSON parsing fails specifically
 */
export class JsonParsingError extends ParsingError {
  public constructor(message: string, context: Record<string, unknown> = {}) {
    super(`JSON parsing failed: ${message}`, {
      ...context,
      jsonError: true,
    });
  }
}

/**
 * Error thrown when SFDX project structure is invalid
 */
export class ProjectStructureError extends ParsingError {
  public constructor(message: string, context: Record<string, unknown> = {}) {
    super(`Invalid project structure: ${message}`, context);

    this.suggestions.push('Ensure sfdx-project.json exists and is valid');
    this.suggestions.push('Check packageDirectories configuration');
    this.suggestions.push('Run: sf project validate');
  }
}
