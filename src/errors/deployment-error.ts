import { SmartDeploymentError } from './base-error.js';

/**
 * Error thrown when Salesforce deployment fails
 *
 * @example
 * ```typescript
 * throw new DeploymentError('Deployment failed due to test failures', {
 *   deploymentId: '0Af...',
 *   failedTests: ['AccountServiceTest.testInsert'],
 *   testCoverage: 68
 * });
 * ```
 */
export class DeploymentError extends SmartDeploymentError {
  public constructor(message: string, context: Record<string, unknown> = {}) {
    const suggestions: string[] = [];

    // Add context-specific suggestions
    if (context.deploymentId) {
      suggestions.push(`Check deployment status: sf project deploy report -i ${String(context.deploymentId)}`);
    }

    if (context.failedTests) {
      suggestions.push('Review and fix failing test classes');
      suggestions.push('Run tests locally: sf apex run test');
    }

    if (context.testCoverage && typeof context.testCoverage === 'number' && context.testCoverage < 75) {
      suggestions.push('Increase test coverage to at least 75%');
      suggestions.push('Add test methods for untested code paths');
    }

    if (context.componentFailures) {
      suggestions.push('Review component-specific errors in the deployment report');
    }

    super(message, 'DEPLOYMENT_ERROR', context, suggestions);
  }
}

/**
 * Error thrown when deployment validation fails
 */
export class DeploymentValidationError extends DeploymentError {
  public constructor(message: string, context: Record<string, unknown> = {}) {
    super(`Deployment validation failed: ${message}`, {
      ...context,
      validationError: true,
    });

    this.suggestions.push('Run validation before deploying: sf project deploy validate');
    this.suggestions.push('Fix validation errors and retry');
  }
}

/**
 * Error thrown when test execution fails during deployment
 */
export class TestFailureError extends DeploymentError {
  public constructor(
    failedTests: string[],
    context: {
      [key: string]: unknown;
      totalTests?: number;
      passedTests?: number;
      testCoverage?: number;
    } = {}
  ) {
    super(`${failedTests.length} test(s) failed`, {
      ...context,
      failedTests,
    });

    this.suggestions.push('Review failed test methods:');
    for (const test of failedTests.slice(0, 5)) {
      // Show max 5
      this.suggestions.push(`  - ${test}`);
    }

    if (failedTests.length > 5) {
      this.suggestions.push(`  ... and ${failedTests.length - 5} more`);
    }

    this.suggestions.push('Run failed tests locally to debug');
  }
}

/**
 * Error thrown when deployment times out
 */
export class DeploymentTimeoutError extends DeploymentError {
  public constructor(timeoutMs: number, context: Record<string, unknown> = {}) {
    super(`Deployment timed out after ${timeoutMs}ms`, {
      ...context,
      timeoutMs,
    });

    this.suggestions.push('Large deployments may exceed timeout limits');
    this.suggestions.push('Consider splitting into smaller waves');
    this.suggestions.push('Increase timeout if appropriate for your org');
  }
}

/**
 * Error thrown when deployment exceeds Salesforce limits
 */
export class DeploymentLimitError extends DeploymentError {
  public constructor(
    limitType: 'files' | 'size' | 'components',
    limit: number,
    actual: number,
    context: Record<string, unknown> = {}
  ) {
    super(`Deployment exceeds ${limitType} limit: ${actual} > ${limit}`, {
      ...context,
      limitType,
      limit,
      actual,
    });

    if (limitType === 'files') {
      this.suggestions.push('Split deployment to stay under 10,000 file limit');
    }

    if (limitType === 'size') {
      this.suggestions.push('Reduce deployment size (max 39MB compressed)');
      this.suggestions.push('Remove unnecessary static resources or large files');
    }

    if (limitType === 'components') {
      this.suggestions.push('Deploy in multiple waves');
      this.suggestions.push('Use smart-deployment wave generation');
    }
  }
}

/**
 * Error thrown when Salesforce API returns an error
 */
export class SalesforceApiError extends DeploymentError {
  public constructor(
    apiError: string,
    context: {
      [key: string]: unknown;
      statusCode?: number;
      errorCode?: string;
    } = {}
  ) {
    super(`Salesforce API error: ${apiError}`, {
      ...context,
      apiError,
    });

    if (context.statusCode === 401) {
      this.suggestions.push('Authentication failed - check your credentials');
      this.suggestions.push('Run: sf org login web');
    }

    if (context.statusCode === 403) {
      this.suggestions.push('Insufficient permissions - check user permissions');
    }

    if (context.statusCode === 429) {
      this.suggestions.push('API rate limit exceeded - wait and retry');
      this.suggestions.push('Reduce concurrent API calls');
    }

    if (context.statusCode && context.statusCode >= 500) {
      this.suggestions.push('Salesforce server error - retry later');
      this.suggestions.push('Check Salesforce status: https://status.salesforce.com');
    }
  }
}
