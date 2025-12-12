/**
 * Agentforce Error Handler - US-073
 * Graceful AI failure handling with fallback
 *
 * @ac US-073-AC-1: Detect AI failures
 * @ac US-073-AC-2: Fallback to static analysis
 * @ac US-073-AC-3: Log AI errors
 * @ac US-073-AC-4: Warn user about fallback
 * @ac US-073-AC-5: Continue deployment
 * @ac US-073-AC-6: Report AI usage statistics
 * @issue #73
 */

import { getLogger } from '../utils/logger.js';

const logger = getLogger('AgentforceErrorHandler');

export interface AIUsageStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  fallbackCount: number;
  averageResponseTime: number;
  errorsByType: Record<string, number>;
  lastFailure?: Date;
  lastSuccess?: Date;
}

/**
 * @ac US-073-AC-1: Detect AI failures
 * @ac US-073-AC-2: Fallback to static analysis
 */
export class AgentforceErrorHandler {
  private readonly stats: AIUsageStats;
  private consecutiveFailures = 0;
  private readonly failureThreshold = 5;

  public constructor() {
    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      fallbackCount: 0,
      averageResponseTime: 0,
      errorsByType: {},
    };

    logger.info('Agentforce error handler initialized');
  }

  /**
   * @ac US-073-AC-2: Fallback to static analysis
   * @ac US-073-AC-3: Log AI errors
   * @ac US-073-AC-4: Warn user about fallback
   * @ac US-073-AC-5: Continue deployment
   * Execute AI call with error handling and fallback
   */
  public async executeWithFallback<T>(
    aiCall: () => Promise<T>,
    fallback: () => T | Promise<T>,
    context: string
  ): Promise<{ result: T; usedFallback: boolean }> {
    const startTime = Date.now();
    this.stats.totalCalls++;

    try {
      const result = await aiCall();
      this.recordSuccess(Date.now() - startTime);

      return {
        result,
        usedFallback: false,
      };
    } catch (error) {
      this.recordFailure(error, context);

      // Use fallback
      logger.warn('AI call failed, using fallback', {
        context,
        error: error instanceof Error ? error.message : String(error),
      });

      this.stats.fallbackCount++;
      this.warnUserAboutFallback(context);

      const fallbackResult = await fallback();

      return {
        result: fallbackResult,
        usedFallback: true,
      };
    }
  }

  /**
   * @ac US-073-AC-1: Detect AI failures
   * Record successful AI call
   */
  private recordSuccess(responseTime: number): void {
    this.stats.successfulCalls++;
    this.stats.lastSuccess = new Date();
    this.consecutiveFailures = 0; // Reset on success

    // Update average response time
    const total = this.stats.successfulCalls;
    this.stats.averageResponseTime = (this.stats.averageResponseTime * (total - 1) + responseTime) / total;

    logger.debug('AI call successful', {
      responseTime,
      averageResponseTime: this.stats.averageResponseTime,
    });
  }

  /**
   * @ac US-073-AC-1: Detect AI failures
   * @ac US-073-AC-3: Log AI errors
   * Record failed AI call
   */
  private recordFailure(error: unknown, context: string): void {
    this.stats.failedCalls++;
    this.stats.lastFailure = new Date();
    this.consecutiveFailures++;

    // Categorize error
    const errorType = this.categorizeError(error);
    this.stats.errorsByType[errorType] = (this.stats.errorsByType[errorType] || 0) + 1;

    logger.error('AI call failed', {
      context,
      errorType,
      error: error instanceof Error ? error.message : String(error),
      totalFailures: this.stats.failedCalls,
    });
  }

  /**
   * Categorize AI error
   */
  private categorizeError(error: unknown): string {
    if (error instanceof Error) {
      if (error.message.includes('timeout')) return 'timeout';
      if (error.message.includes('rate limit')) return 'rate-limit';
      if (error.message.includes('unauthorized')) return 'auth';
      if (error.message.includes('network')) return 'network';
      if (error.message.includes('model')) return 'model-error';
    }

    return 'unknown';
  }

  /**
   * @ac US-073-AC-4: Warn user about fallback
   * Warn user that AI is unavailable
   */
  private warnUserAboutFallback(context: string): void {
    logger.warn('⚠️  AI service unavailable - using static analysis fallback', {
      context,
      consecutiveFailures: this.consecutiveFailures,
      failureRate: this.getFailureRate(),
    });

    // Log warning (console.warn would be used in CLI context)
    logger.warn(`AI unavailable for ${context} - using static analysis`);
  }

  /**
   * @ac US-073-AC-6: Report AI usage statistics
   * Get usage statistics
   */
  public getStats(): AIUsageStats {
    return { ...this.stats };
  }

  /**
   * Get failure rate
   */
  private getFailureRate(): number {
    if (this.stats.totalCalls === 0) return 0;
    return this.stats.failedCalls / this.stats.totalCalls;
  }

  /**
   * @ac US-073-AC-6: Report AI usage statistics
   * Format usage report
   */
  public formatReport(): string {
    const lines: string[] = [];
    const failureRate = (this.getFailureRate() * 100).toFixed(1);
    const fallbackRate =
      this.stats.totalCalls > 0 ? ((this.stats.fallbackCount / this.stats.totalCalls) * 100).toFixed(1) : '0.0';

    lines.push('🤖 AI Usage Statistics');
    lines.push('═══════════════════════════════════════');
    lines.push(`Total AI Calls: ${this.stats.totalCalls}`);
    lines.push(`Successful: ${this.stats.successfulCalls}`);
    lines.push(`Failed: ${this.stats.failedCalls}`);
    lines.push(`Fallback Used: ${this.stats.fallbackCount} (${fallbackRate}%)`);
    lines.push(`Failure Rate: ${failureRate}%`);
    lines.push(`Avg Response Time: ${Math.round(this.stats.averageResponseTime)}ms`);
    lines.push('');

    if (Object.keys(this.stats.errorsByType).length > 0) {
      lines.push('Errors by Type:');
      for (const [type, count] of Object.entries(this.stats.errorsByType)) {
        lines.push(`  ${type}: ${count}`);
      }
      lines.push('');
    }

    if (this.stats.lastFailure) {
      const timeSince = Date.now() - this.stats.lastFailure.getTime();
      lines.push(`Last Failure: ${Math.floor(timeSince / 1000)}s ago`);
    }

    lines.push('');
    lines.push(`Consecutive Failures: ${this.consecutiveFailures}/${this.failureThreshold}`);

    return lines.join('\n');
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats.totalCalls = 0;
    this.stats.successfulCalls = 0;
    this.stats.failedCalls = 0;
    this.stats.fallbackCount = 0;
    this.stats.averageResponseTime = 0;
    this.stats.errorsByType = {};
    this.stats.lastFailure = undefined;
    this.stats.lastSuccess = undefined;

    logger.info('AI usage stats reset');
  }
}
