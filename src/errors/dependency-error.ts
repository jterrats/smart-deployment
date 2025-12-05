import { SmartDeploymentError } from './base-error.js';

/**
 * Error thrown when dependency analysis or resolution fails
 *
 * @example
 * ```typescript
 * throw new DependencyError('Circular dependency detected', {
 *   cycle: ['ApexClass:A', 'ApexClass:B', 'ApexClass:C', 'ApexClass:A'],
 *   affectedComponents: 3
 * });
 * ```
 */
export class DependencyError extends SmartDeploymentError {
  public constructor(message: string, context: Record<string, unknown> = {}) {
    const suggestions: string[] = [];

    // Add context-specific suggestions
    if (context.cycle) {
      suggestions.push('Break the circular dependency by refactoring shared logic');
      suggestions.push('Consider using dependency injection or interfaces');
    }

    if (context.missingDependency) {
      suggestions.push(`Add missing dependency: ${String(context.missingDependency)}`);
      suggestions.push('Check if the component exists in your project');
    }

    if (context.affectedComponents) {
      suggestions.push(`Review ${String(context.affectedComponents)} affected components`);
    }

    super(message, 'DEPENDENCY_ERROR', context, suggestions);
  }
}

/**
 * Error thrown when circular dependencies are detected
 */
export class CircularDependencyError extends DependencyError {
  public constructor(cycle: string[], context: Record<string, unknown> = {}) {
    super(`Circular dependency detected: ${cycle.join(' → ')}`, {
      ...context,
      cycle,
      cycleLength: cycle.length,
    });

    this.suggestions.push('Visualize the dependency graph to identify the cycle');
    this.suggestions.push('Extract shared code into a common utility');
  }
}

/**
 * Error thrown when a required dependency is missing
 */
export class MissingDependencyError extends DependencyError {
  public constructor(component: string, missingDependency: string, context: Record<string, unknown> = {}) {
    super(`Component '${component}' depends on missing '${missingDependency}'`, {
      ...context,
      component,
      missingDependency,
    });

    this.suggestions.push(`Include '${missingDependency}' in your deployment`);
    this.suggestions.push('Check if the dependency was deleted or renamed');
    this.suggestions.push('Verify metadata type spelling and casing');
  }
}

/**
 * Error thrown when dependency graph is too complex
 */
export class DependencyComplexityError extends DependencyError {
  public constructor(
    message: string,
    context: {
      [key: string]: unknown;
      totalComponents?: number;
      maxDepth?: number;
    } = {}
  ) {
    super(message, context);

    if (context.maxDepth && context.maxDepth > 50) {
      this.suggestions.push('Dependency depth > 50 indicates over-coupling');
      this.suggestions.push('Refactor to reduce dependency chains');
    }

    if (context.totalComponents && context.totalComponents > 10_000) {
      this.suggestions.push('Consider splitting into multiple deployments');
      this.suggestions.push('Use selective deployment for changed components only');
    }
  }
}
