import { SmartDeploymentError } from './base-error.js';

/**
 * Error thrown when metadata or configuration validation fails
 *
 * @example
 * ```typescript
 * throw new ValidationError('Invalid API version', {
 *   currentVersion: '30.0',
 *   minimumVersion: '40.0',
 *   field: 'sourceApiVersion'
 * });
 * ```
 */
export class ValidationError extends SmartDeploymentError {
  public constructor(message: string, context: Record<string, unknown> = {}) {
    const suggestions: string[] = [];

    // Add context-specific suggestions
    if (context.field) {
      suggestions.push(`Check field: ${String(context.field)}`);
    }

    if (context.minimumVersion) {
      suggestions.push(`Update to minimum version: ${String(context.minimumVersion)}`);
    }

    if (context.allowedValues) {
      suggestions.push(`Allowed values: ${JSON.stringify(context.allowedValues)}`);
    }

    super(message, 'VALIDATION_ERROR', context, suggestions);
  }
}

/**
 * Error thrown when required configuration is missing
 */
export class ConfigurationError extends ValidationError {
  public constructor(missingConfig: string, context: Record<string, unknown> = {}) {
    super(`Missing required configuration: ${missingConfig}`, {
      ...context,
      missingConfig,
    });

    this.suggestions.push(`Add '${missingConfig}' to your configuration`);
    this.suggestions.push('Check .sfsmartdeploy.json or CLI flags');
  }
}

/**
 * Error thrown when API version is invalid or outdated
 */
export class ApiVersionError extends ValidationError {
  public constructor(currentVersion: string, minimumVersion: string, context: Record<string, unknown> = {}) {
    super(`API version ${currentVersion} is below minimum ${minimumVersion}`, {
      ...context,
      currentVersion,
      minimumVersion,
    });

    this.suggestions.push(`Update sourceApiVersion in sfdx-project.json to ${minimumVersion} or higher`);
    this.suggestions.push('Salesforce deprecates API versions older than 3 years');
    this.suggestions.push('Consider using the latest API version for new features');
  }
}

/**
 * Error thrown when metadata type is unknown or unsupported
 */
export class UnknownMetadataTypeError extends ValidationError {
  public constructor(metadataType: string, context: Record<string, unknown> = {}) {
    super(`Unknown metadata type: ${metadataType}`, {
      ...context,
      metadataType,
    });

    this.suggestions.push('Check metadata type spelling and casing');
    this.suggestions.push('Verify the type exists in Salesforce documentation');
    this.suggestions.push('Type may be new - update plugin to latest version');
  }
}

/**
 * Error thrown when component count exceeds limits
 */
export class ComponentCountError extends ValidationError {
  public constructor(count: number, limit: number, componentType?: string, context: Record<string, unknown> = {}) {
    const typeStr = componentType ? ` ${componentType}` : '';
    super(`Too many${typeStr} components: ${count} exceeds limit of ${limit}`, {
      ...context,
      count,
      limit,
      componentType,
    });

    this.suggestions.push('Split deployment into multiple waves');
    this.suggestions.push('Use selective deployment for changed components only');
  }
}

/**
 * Error thrown when required metadata is missing
 */
export class MissingMetadataError extends ValidationError {
  public constructor(metadataType: string, metadataName: string, context: Record<string, unknown> = {}) {
    super(`Missing required ${metadataType}: ${metadataName}`, {
      ...context,
      metadataType,
      metadataName,
    });

    this.suggestions.push(`Add ${metadataType} '${metadataName}' to your deployment`);
    this.suggestions.push('Check if the component was deleted or renamed');
  }
}

/**
 * Error thrown when file or directory does not exist
 */
export class FileNotFoundError extends ValidationError {
  public constructor(filePath: string, context: Record<string, unknown> = {}) {
    super(`File or directory not found: ${filePath}`, {
      ...context,
      filePath,
    });

    this.suggestions.push(`Verify path exists: ${filePath}`);
    this.suggestions.push('Check for typos in file path');
    this.suggestions.push('Ensure you are in the correct directory');
  }
}

/**
 * Error thrown when file permissions are insufficient
 */
export class PermissionError extends ValidationError {
  public constructor(filePath: string, operation: string, context: Record<string, unknown> = {}) {
    super(`Permission denied: cannot ${operation} ${filePath}`, {
      ...context,
      filePath,
      operation,
    });

    this.suggestions.push(`Check file permissions: ls -la ${filePath}`);
    this.suggestions.push(`Grant ${operation} permission: chmod +r ${filePath}`);
    this.suggestions.push('Run command with appropriate user privileges');
  }
}
