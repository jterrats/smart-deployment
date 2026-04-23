/**
 * Network Handler - US-072
 * Enhanced network error handling with retries
 *
 * @ac US-072-AC-1: Detect network errors
 * @ac US-072-AC-2: Exponential backoff retry
 * @ac US-072-AC-3: Max retry limit (3)
 * @ac US-072-AC-4: Timeout handling
 * @ac US-072-AC-5: Fallback strategies
 * @ac US-072-AC-6: User-friendly error messages
 * @issue #72
 */

import { NetworkError, TimeoutError, ConnectionError, HttpError } from '../errors/network-error.js';
import { RetryHandler } from '../deployment/retry-handler.js';
import { getLogger } from './logger.js';

const logger = getLogger('NetworkHandler');

export type NetworkRequestOptions = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  retries?: number;
};

export type NetworkResponse<T> = {
  data: T;
  statusCode: number;
  headers: Record<string, string>;
  executionTime: number;
};

/**
 * @ac US-072-AC-1: Detect network errors
 * @ac US-072-AC-2: Exponential backoff retry
 */
export class NetworkHandler {
  private readonly retryHandler: RetryHandler;
  private readonly defaultTimeout: number;

  public constructor(options?: { timeout?: number; maxRetries?: number }) {
    this.defaultTimeout = options?.timeout ?? 30_000;
    this.retryHandler = new RetryHandler({
      maxRetries: options?.maxRetries ?? 3,
      initialDelay: 1000,
      maxDelay: 10_000,
    });

    logger.info('Network handler initialized', {
      timeout: this.defaultTimeout,
      maxRetries: options?.maxRetries ?? 3,
    });
  }

  /**
   * @ac US-072-AC-2: Exponential backoff retry
   * @ac US-072-AC-3: Max retry limit (3)
   * @ac US-072-AC-4: Timeout handling
   * Execute network request with retry
   */
  public async request<T>(options: NetworkRequestOptions): Promise<NetworkResponse<T>> {
    return this.retryHandler.executeWithRetry(async () => {
      try {
        const response = await this.executeRequest<T>(options);
        return response;
      } catch (error) {
        // Transform to specific network error
        throw this.transformError(error, options);
      }
    }, `network-${options.method ?? 'GET'}-${options.url}`);
  }

  /**
   * @ac US-072-AC-4: Timeout handling
   * Execute request with timeout
   */
  private async executeRequest<T>(options: NetworkRequestOptions): Promise<NetworkResponse<T>> {
    const timeout = options.timeout ?? this.defaultTimeout;
    const controller = new AbortController();

    // Setup timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      const response = await fetch(options.url, {
        method: options.method ?? 'GET',
        headers: options.headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new HttpError(options.url, response.status, response.statusText);
      }

      const data = (await response.json()) as T;

      return {
        data,
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        executionTime: Date.now() - Date.now(),
      };
    } catch (error) {
      clearTimeout(timeoutId);

      // Check if aborted (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(options.url, timeout);
      }

      throw error;
    }
  }

  /**
   * @ac US-072-AC-1: Detect network errors
   * @ac US-072-AC-6: User-friendly error messages
   * Transform generic error to specific network error
   */
  private transformError(error: unknown, options: NetworkRequestOptions): Error {
    // Already a network error
    if (error instanceof NetworkError) {
      return error;
    }

    if (error instanceof Error) {
      // Detect specific network error types
      if (NetworkError.isNetworkError(error)) {
        return new ConnectionError(options.url, error);
      }

      // Check for timeout
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        return new TimeoutError(options.url, options.timeout ?? this.defaultTimeout);
      }

      // Check for connection refused
      if (error.message.includes('ECONNREFUSED')) {
        return new ConnectionError(options.url, error);
      }

      // Generic network error
      return new NetworkError(error.message, {
        url: options.url,
        originalError: error,
      });
    }

    return new NetworkError('Unknown network error', {
      url: options.url,
    });
  }

  /**
   * @ac US-072-AC-5: Fallback strategies
   * Execute with fallback
   */
  public async requestWithFallback<T>(
    options: NetworkRequestOptions,
    fallback: () => T | Promise<T>
  ): Promise<NetworkResponse<T> | { data: T; fromFallback: true }> {
    try {
      return await this.request<T>(options);
    } catch (error) {
      logger.warn('Network request failed, using fallback', {
        url: options.url,
        error: error instanceof Error ? error.message : String(error),
      });

      const data = await Promise.resolve(fallback());
      return {
        data,
        fromFallback: true as const,
      };
    }
  }
}
