/**
 * Network Error Classes - US-072
 * Specialized errors for network operations
 *
 * @ac US-072-AC-1: Detect network errors
 * @ac US-072-AC-6: User-friendly error messages
 * @issue #72
 */

import { SmartDeploymentError } from './base-error.js';

export interface NetworkErrorOptions {
  url?: string;
  statusCode?: number;
  timeout?: number;
  retryCount?: number;
  originalError?: Error;
}

/**
 * @ac US-072-AC-1: Detect network errors
 * Base class for network-related errors
 */
export class NetworkError extends SmartDeploymentError {
  public readonly url?: string;
  public readonly statusCode?: number;

  public constructor(message: string, options: NetworkErrorOptions = {}) {
    const context = {
      url: options.url,
      statusCode: options.statusCode,
      timeout: options.timeout,
      retryCount: options.retryCount,
    };

    const suggestions = NetworkError.getSuggestions(options);

    super(message, 'NETWORK_ERROR', context, suggestions);

    this.url = options.url;
    this.statusCode = options.statusCode;
  }

  /**
   * @ac US-072-AC-6: User-friendly error messages
   * Get suggestions based on error type
   */
  private static getSuggestions(options: NetworkErrorOptions): string[] {
    const suggestions: string[] = [];

    if (options.statusCode === 404) {
      suggestions.push('Check if the endpoint URL is correct');
      suggestions.push('Verify the resource exists');
    } else if (options.statusCode === 401 || options.statusCode === 403) {
      suggestions.push('Check your authentication credentials');
      suggestions.push('Verify API permissions');
    } else if (options.statusCode && options.statusCode >= 500) {
      suggestions.push('Server error - retry after a few minutes');
      suggestions.push('Check server status');
    } else if (options.timeout) {
      suggestions.push('Request timed out - check your network connection');
      suggestions.push('Try increasing timeout value');
    } else {
      suggestions.push('Check your internet connection');
      suggestions.push('Verify firewall settings');
      suggestions.push('Try again later');
    }

    return suggestions;
  }

  /**
   * @ac US-072-AC-1: Detect network errors
   * Check if error is a network error
   */
  public static isNetworkError(error: unknown): boolean {
    if (error instanceof NetworkError) return true;

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('network') ||
        message.includes('econnrefused') ||
        message.includes('enotfound') ||
        message.includes('etimedout') ||
        message.includes('fetch') ||
        message.includes('socket') ||
        message.includes('connection')
      );
    }

    return false;
  }
}

/**
 * Timeout-specific error
 */
export class TimeoutError extends NetworkError {
  public constructor(url: string, timeout: number) {
    super(`Request timeout after ${timeout}ms`, {
      url,
      timeout,
    });
    this.code = 'NETWORK_TIMEOUT';
  }
}

/**
 * Connection error
 */
export class ConnectionError extends NetworkError {
  public constructor(url: string, originalError?: Error) {
    super(`Failed to connect to ${url}`, {
      url,
      originalError,
    });
    this.code = 'NETWORK_CONNECTION_FAILED';
  }
}

/**
 * HTTP error
 */
export class HttpError extends NetworkError {
  public constructor(url: string, statusCode: number, statusText?: string) {
    super(`HTTP ${statusCode}${statusText ? ': ' + statusText : ''} at ${url}`, {
      url,
      statusCode,
    });
    this.code = 'NETWORK_HTTP_ERROR';
  }
}
