/**
 * AI Circuit Breaker - US-060
 * Circuit breaker pattern for AI calls to handle service failures
 *
 * @ac US-060-AC-1: Track failure rate
 * @ac US-060-AC-2: Open circuit after N failures
 * @ac US-060-AC-3: Automatic fallback to static analysis
 * @ac US-060-AC-4: Reset after timeout
 * @ac US-060-AC-5: Monitor circuit state
 * @ac US-060-AC-6: Alert on circuit open
 * @issue #60
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('CircuitBreaker');

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes to close from half-open
  timeout: number; // Milliseconds to wait before half-open
  monitoringWindow: number; // Milliseconds to track failure rate
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  consecutiveFailures: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  tripCount: number; // How many times circuit has opened
}

/**
 * @ac US-060-AC-1: Track failure rate
 * @ac US-060-AC-2: Open circuit after N failures
 * @ac US-060-AC-5: Monitor circuit state
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private consecutiveFailures = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private tripCount = 0;
  private readonly options: CircuitBreakerOptions;

  public constructor(options?: Partial<CircuitBreakerOptions>) {
    this.options = {
      failureThreshold: options?.failureThreshold ?? 5,
      successThreshold: options?.successThreshold ?? 2,
      timeout: options?.timeout ?? 60000, // 1 minute
      monitoringWindow: options?.monitoringWindow ?? 300000, // 5 minutes
    };

    logger.info('Circuit breaker initialized', {
      failureThreshold: this.options.failureThreshold,
      timeout: this.options.timeout,
    });
  }

  /**
   * @ac US-060-AC-2: Open circuit after N failures
   * @ac US-060-AC-3: Automatic fallback to static analysis
   * Execute function with circuit breaker protection
   */
  public async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    // Check if circuit should transition states
    this.checkStateTransition();

    if (this.state === 'open') {
      logger.warn('Circuit breaker is OPEN, using fallback');
      
      if (fallback) {
        return Promise.resolve(fallback());
      }
      
      throw new Error('Circuit breaker is OPEN and no fallback provided');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      
      // If circuit just opened, use fallback
      // Re-check state after onFailure() which may have changed it
      if (this.getState() === 'open' && fallback) {
        logger.info('Circuit opened, using fallback');
        return Promise.resolve(fallback());
      }
      
      throw error;
    }
  }

  /**
   * @ac US-060-AC-1: Track failure rate
   * Record successful execution
   */
  private onSuccess(): void {
    this.successes++;
    this.consecutiveFailures = 0;
    this.lastSuccessTime = new Date();

    logger.debug('Circuit breaker: success recorded', {
      state: this.state,
      successes: this.successes,
    });

    // If half-open and enough successes, close circuit
    if (this.state === 'half-open' && this.successes >= this.options.successThreshold) {
      this.closeCircuit();
    }
  }

  /**
   * @ac US-060-AC-1: Track failure rate
   * @ac US-060-AC-2: Open circuit after N failures
   * Record failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.consecutiveFailures++;
    this.lastFailureTime = new Date();

    logger.warn('Circuit breaker: failure recorded', {
      state: this.state,
      failures: this.failures,
      consecutiveFailures: this.consecutiveFailures,
    });

    // Open circuit if threshold reached
    if (this.consecutiveFailures >= this.options.failureThreshold) {
      this.openCircuit();
    }
  }

  /**
   * @ac US-060-AC-2: Open circuit after N failures
   * @ac US-060-AC-6: Alert on circuit open
   * Open the circuit
   */
  private openCircuit(): void {
    if (this.state === 'open') return;

    this.state = 'open';
    this.tripCount++;
    
    logger.error('🔴 CIRCUIT BREAKER OPENED', {
      tripCount: this.tripCount,
      consecutiveFailures: this.consecutiveFailures,
      timeout: this.options.timeout,
    });

    // Alert (in production, this would send to monitoring system)
    this.sendAlert('Circuit breaker opened due to repeated failures');
  }

  /**
   * Close the circuit
   */
  private closeCircuit(): void {
    this.state = 'closed';
    this.consecutiveFailures = 0;
    this.successes = 0;

    logger.info('🟢 Circuit breaker CLOSED', {
      tripCount: this.tripCount,
    });
  }

  /**
   * @ac US-060-AC-4: Reset after timeout
   * Check if circuit should transition to half-open
   */
  private checkStateTransition(): void {
    if (this.state !== 'open') return;

    if (!this.lastFailureTime) return;

    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();

    if (timeSinceLastFailure >= this.options.timeout) {
      this.state = 'half-open';
      this.successes = 0; // Reset success counter for half-open test

      logger.info('🟡 Circuit breaker HALF-OPEN (testing)', {
        timeout: this.options.timeout,
        timeSinceLastFailure,
      });
    }
  }

  /**
   * @ac US-060-AC-5: Monitor circuit state
   * Get current statistics
   */
  public getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      consecutiveFailures: this.consecutiveFailures,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      tripCount: this.tripCount,
    };
  }

  /**
   * @ac US-060-AC-1: Track failure rate
   * Get failure rate within monitoring window
   */
  public getFailureRate(): number {
    if (!this.lastFailureTime) return 0;

    const windowStart = Date.now() - this.options.monitoringWindow;
    const lastFailureTime = this.lastFailureTime.getTime();

    if (lastFailureTime < windowStart) {
      return 0; // Failures outside window
    }

    const total = this.failures + this.successes;
    return total > 0 ? this.failures / total : 0;
  }

  /**
   * Get current state
   */
  public getState(): CircuitState {
    this.checkStateTransition();
    return this.state;
  }

  /**
   * Check if circuit is allowing requests
   */
  public isOpen(): boolean {
    this.checkStateTransition();
    return this.state === 'open';
  }

  /**
   * Manual reset (for testing or manual intervention)
   */
  public reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.consecutiveFailures = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;

    logger.info('Circuit breaker manually reset');
  }

  /**
   * @ac US-060-AC-6: Alert on circuit open
   * Send alert (integration point for monitoring)
   */
  private sendAlert(message: string): void {
    // In production, this would integrate with:
    // - PagerDuty
    // - Slack
    // - CloudWatch Alarms
    // - Datadog
    // etc.

    logger.error('🚨 ALERT:', { message, stats: this.getStats() });

    // For now, just log. In production, implement actual alerting.
  }

  /**
   * Format monitoring report
   */
  public formatReport(): string {
    const stats = this.getStats();
    const failureRate = (this.getFailureRate() * 100).toFixed(1);

    const lines: string[] = [];

    lines.push('⚡ Circuit Breaker Status');
    lines.push('═══════════════════════════════════════');
    lines.push(`State: ${this.getStateIcon()} ${stats.state.toUpperCase()}`);
    lines.push(`Failure Rate: ${failureRate}%`);
    lines.push(`Consecutive Failures: ${stats.consecutiveFailures}/${this.options.failureThreshold}`);
    lines.push(`Trip Count: ${stats.tripCount}`);
    lines.push('');
    lines.push(`Total Successes: ${stats.successes}`);
    lines.push(`Total Failures: ${stats.failures}`);

    if (stats.lastFailureTime) {
      const timeSince = Date.now() - stats.lastFailureTime.getTime();
      lines.push(`Last Failure: ${Math.floor(timeSince / 1000)}s ago`);
    }

    if (this.state === 'open') {
      lines.push('');
      lines.push(`⏰ Reset in: ${this.getTimeUntilHalfOpen()}ms`);
    }

    return lines.join('\n');
  }

  /**
   * Get state icon
   */
  private getStateIcon(): string {
    switch (this.state) {
      case 'closed':
        return '🟢';
      case 'open':
        return '🔴';
      case 'half-open':
        return '🟡';
      default:
        return '⚪';
    }
  }

  /**
   * Get time until half-open state
   */
  private getTimeUntilHalfOpen(): number {
    if (this.state !== 'open' || !this.lastFailureTime) return 0;

    const timeSinceFailure = Date.now() - this.lastFailureTime.getTime();
    return Math.max(0, this.options.timeout - timeSinceFailure);
  }
}
