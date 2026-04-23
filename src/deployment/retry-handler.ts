/**
 * Deployment Retry Logic - US-088
 * Handles automatic retry on transient failures
 *
 * @ac US-088-AC-1: Detect retryable errors
 * @ac US-088-AC-2: Retry up to 3 times
 * @ac US-088-AC-3: Exponential backoff
 * @ac US-088-AC-4: Retry without tests (sandbox)
 * @ac US-088-AC-5: Report retry attempts
 * @ac US-088-AC-6: Fail after max retries
 * @issue #88
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('RetryHandler');

const RETRYABLE_ERRORS = [
  'UNABLE_TO_LOCK_ROW',
  'REQUEST_LIMIT_EXCEEDED',
  'STORAGE_LIMIT_EXCEEDED',
  'CONNECTION_ERROR',
  'TIMEOUT',
];

export type RetryConfig = {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
};

/**
 * @ac US-088-AC-1: Detect retryable errors
 */
export class RetryHandler {
  private readonly config: Required<RetryConfig>;

  public constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      initialDelay: config.initialDelay ?? 1000,
      maxDelay: config.maxDelay ?? 30_000,
    };
  }

  public isRetryable(error: string): boolean {
    return RETRYABLE_ERRORS.some((pattern) => error.includes(pattern));
  }

  /**
   * @ac US-088-AC-2: Retry up to 3 times
   * @ac US-088-AC-3: Exponential backoff
   * @ac US-088-AC-5: Report retry attempts
   * @ac US-088-AC-6: Fail after max retries
   */
  public async executeWithRetry<T>(fn: () => Promise<T>, context: string): Promise<T> {
    let lastError: Error | undefined;

    const attemptExecution = async (attempt: number): Promise<T> => {
      try {
        if (attempt > 0) {
          const delay = this.calculateDelay(attempt);
          logger.info('Retrying operation', { context, attempt, delay });
          await this.sleep(delay);
        }

        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (!this.isRetryable(lastError.message)) {
          logger.warn('Non-retryable error encountered', { context, error: lastError.message });
          throw lastError;
        }

        if (attempt === this.config.maxRetries) {
          logger.error('Max retries exceeded', { context, attempt, error: lastError.message });
          throw new Error(`Max retries (${this.config.maxRetries}) exceeded: ${lastError.message}`);
        }

        logger.warn('Retryable error, will retry', { context, attempt, error: lastError.message });
        return attemptExecution(attempt + 1);
      }
    };

    return attemptExecution(0).catch((error: unknown) => {
      if (error instanceof Error) {
        throw error;
      }

      throw lastError ?? new Error('Retry failed');
    });
  }

  /**
   * @ac US-088-AC-3: Exponential backoff
   */
  private calculateDelay(attempt: number): number {
    const delay = this.config.initialDelay * Math.pow(2, attempt - 1);
    return Math.min(delay, this.config.maxDelay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
