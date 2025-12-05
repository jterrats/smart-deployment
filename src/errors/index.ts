/**
 * Custom Error Types for Smart Deployment Plugin
 *
 * All errors extend SmartDeploymentError and provide:
 * - Error codes for programmatic handling
 * - Contextual information about the failure
 * - Actionable suggestions for resolution
 * - JSON serialization for logging
 *
 * @example
 * ```typescript
 * import { ParsingError, DeploymentError } from './errors/index.js';
 *
 * try {
 *   await parseXml(file);
 * } catch (error) {
 *   throw new ParsingError('Failed to parse XML', {
 *     filePath: file,
 *     originalError: error.message
 *   });
 * }
 * ```
 */

// Base error
import { SmartDeploymentError as BaseError } from './base-error.js';
export { SmartDeploymentError } from './base-error.js';

// Parsing errors
export { ParsingError, XmlParsingError, JsonParsingError, ProjectStructureError } from './parsing-error.js';

// Dependency errors
export {
  DependencyError,
  CircularDependencyError,
  MissingDependencyError,
  DependencyComplexityError,
} from './dependency-error.js';

// Deployment errors
export {
  DeploymentError,
  DeploymentValidationError,
  TestFailureError,
  DeploymentTimeoutError,
  DeploymentLimitError,
  SalesforceApiError,
} from './deployment-error.js';

// Validation errors
export {
  ValidationError,
  ConfigurationError,
  ApiVersionError,
  UnknownMetadataTypeError,
  ComponentCountError,
  MissingMetadataError,
  FileNotFoundError,
  PermissionError,
} from './validation-error.js';

/**
 * Type guard to check if error is a SmartDeploymentError
 */
export function isSmartDeploymentError(error: unknown): error is BaseError {
  return error instanceof BaseError;
}

/**
 * Extract error message safely from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error occurred';
}

/**
 * Extract error context safely
 */
export function getErrorContext(error: unknown): Record<string, unknown> {
  if (isSmartDeploymentError(error)) {
    return error.context;
  }

  return {};
}

/**
 * Get suggestions from error if available
 */
export function getErrorSuggestions(error: unknown): string[] {
  if (isSmartDeploymentError(error)) {
    return error.suggestions;
  }

  return [];
}
