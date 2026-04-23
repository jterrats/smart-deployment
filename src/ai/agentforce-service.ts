/**
 * Agentforce Service - US-054
 * Base service for connecting to Agentforce API
 *
 * @ac US-054-AC-1: Configure API endpoint
 * @ac US-054-AC-2: Handle authentication
 * @ac US-054-AC-3: Support multiple models
 * @ac US-054-AC-4: Implement retry logic
 * @ac US-054-AC-5: Handle rate limiting
 * @ac US-054-AC-6: Monitor API usage
 * @issue #54
 */

import { getLogger } from '../utils/logger.js';
import { getErrorAggregator } from '../utils/error-aggregator.js';
import type { LLMProvider, LLMProviderConfig, LLMRequest, LLMResponse } from './llm-provider.js';

const logger = getLogger('AgentforceService');
const errorAggregator = getErrorAggregator();

export type AgentforceFetch = typeof fetch;

export type AgentforceConfig = LLMProviderConfig & {
  provider: 'agentforce';
  endpoint: string;
  /** API endpoint URL */
  /** API key or named credential */
  apiKey?: string;
  model: string;
  timeout: number;
  enabled: boolean;
  rateLimit: number;
  /** Max retry attempts */
  maxRetries: number;
  /** Injectable fetch implementation for tests or alternate runtimes */
  fetchFn?: AgentforceFetch;
};

export type AgentforceRequest = LLMRequest;
export type AgentforceResponse = LLMResponse;

export type ApiUsageStats = {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokensUsed: number;
  averageResponseTime: number;
  rateLimitHits: number;
  lastRequestTime?: Date;
};

/**
 * @ac US-054-AC-1: Configure API endpoint
 * @ac US-054-AC-2: Handle authentication
 */
export class AgentforceService implements LLMProvider {
  private readonly config: AgentforceConfig;
  private readonly fetchFn?: AgentforceFetch;
  private readonly usageStats: ApiUsageStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalTokensUsed: 0,
    averageResponseTime: 0,
    rateLimitHits: 0,
  };

  private requestTimestamps: number[] = [];

  public constructor(config: Partial<AgentforceConfig> = {}) {
    this.config = {
      provider: 'agentforce',
      endpoint: config.endpoint ?? process.env.AGENTFORCE_ENDPOINT ?? 'https://api.salesforce.com/ai/v1',
      apiKey: config.apiKey ?? process.env.AGENTFORCE_API_KEY,
      model: config.model ?? 'agentforce-1',
      timeout: config.timeout ?? 30_000, // 30 seconds
      maxRetries: config.maxRetries ?? 3,
      enabled: config.enabled ?? true,
      rateLimit: config.rateLimit ?? 60, // 60 requests per minute
      fetchFn: config.fetchFn ?? globalThis.fetch,
    };
    this.fetchFn = this.config.fetchFn;

    logger.info('Agentforce service initialized', {
      endpoint: this.config.endpoint,
      model: this.config.model,
      enabled: this.config.enabled,
    });
  }

  /**
   * @ac US-054-AC-3: Support multiple models
   * Send request to Agentforce API
   */
  public async sendRequest(request: AgentforceRequest): Promise<AgentforceResponse> {
    if (!this.config.enabled) {
      throw new Error('Agentforce service is disabled');
    }

    if (!this.config.apiKey) {
      throw new Error('Agentforce API key not configured');
    }
    // Rate limiting check
    this.enforceRateLimit();

    const startTime = Date.now();
    this.usageStats.totalRequests++;

    try {
      // Execute with retry logic
      const response = await this.executeWithRetry(request);

      // Track success
      const executionTime = Date.now() - startTime;
      this.usageStats.successfulRequests++;
      this.usageStats.totalTokensUsed += response.tokensUsed;
      this.updateAverageResponseTime(executionTime);
      this.usageStats.lastRequestTime = new Date();

      logger.info('Agentforce request successful', {
        model: response.model,
        tokens: response.tokensUsed,
        executionTime,
      });

      return response;
    } catch (error) {
      // Track failure
      this.usageStats.failedRequests++;

      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Agentforce request failed', { error: errorMessage });

      errorAggregator.addError({
        message: `Agentforce API error: ${errorMessage}`,
        type: 'AgentforceError',
        severity: 'HIGH',
        context: { model: request.model, prompt: request.prompt.slice(0, 100) },
      });

      throw error;
    }
  }

  /**
   * @ac US-054-AC-4: Implement retry logic
   * Execute request with exponential backoff retry
   */
  private async executeWithRetry(request: AgentforceRequest, attempt: number = 1): Promise<AgentforceResponse> {
    try {
      return await this.executeRequest(request);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if we should retry
      if (attempt >= this.config.maxRetries) {
        throw new Error(`Agentforce request failed after ${attempt} attempts: ${errorMessage}`);
      }

      // Check if error is retryable
      if (!this.isRetryableError(error)) {
        throw error;
      }

      // Calculate backoff delay (exponential)
      const delay = Math.min(1e3 * 2 ** (attempt - 1), 1e4); // Max 10s

      logger.warn(`Retrying Agentforce request (attempt ${attempt}/${this.config.maxRetries})`, {
        delay,
        error: errorMessage,
      });

      await this.sleep(delay);
      return this.executeWithRetry(request, attempt + 1);
    }
  }

  private async executeRequest(request: AgentforceRequest): Promise<AgentforceResponse> {
    const startTime = Date.now();
    logger.debug('Executing Agentforce request', {
      model: request.model,
      promptLength: request.prompt.length,
    });

    if (!this.fetchFn) {
      throw new Error('Fetch API is not available in this runtime');
    }
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error('Agentforce API key not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await this.fetchFn(this.config.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          prompt: request.prompt,
          context: request.context,
          temperature: request.temperature ?? 0.2,
          maxTokens: request.maxTokens ?? 2000,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Agentforce API error: ${response.status} ${response.statusText}`);
      }

      const rawPayload: unknown = await response.json();
      if (typeof rawPayload !== 'object' || rawPayload === null) {
        throw new Error('Agentforce response payload was not an object');
      }
      const payload = rawPayload as Record<string, unknown>;
      return {
        content: this.extractContent(payload),
        tokensUsed: this.extractTokensUsed(payload, request.prompt),
        model: this.extractModel(payload, request.model),
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Agentforce request timed out');
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * @ac US-054-AC-5: Handle rate limiting
   * Enforce rate limit (requests per minute)
   */
  private enforceRateLimit(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;

    // Remove timestamps older than 1 minute
    this.requestTimestamps = this.requestTimestamps.filter((ts) => ts > oneMinuteAgo);

    // Check if we exceeded rate limit
    if (this.requestTimestamps.length >= this.config.rateLimit) {
      this.usageStats.rateLimitHits++;
      const oldestTimestamp = this.requestTimestamps[0] ?? now;
      const waitTime = 60_000 - (now - oldestTimestamp);

      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)}s before retrying.`);
    }

    // Add current timestamp
    this.requestTimestamps.push(now);
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Retry on network errors, timeouts, and 5xx errors
    const retryablePatterns = [
      /timeout/i,
      /network/i,
      /ECONNRESET/i,
      /ETIMEDOUT/i,
      /5\d{2}/i, // 5xx HTTP errors
    ];

    return retryablePatterns.some((pattern) => pattern.test(errorMessage));
  }

  /**
   * Sleep utility
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(newTime: number): void {
    const totalRequests = this.usageStats.successfulRequests;
    const currentAvg = this.usageStats.averageResponseTime;

    // Incremental average calculation
    this.usageStats.averageResponseTime = (currentAvg * (totalRequests - 1) + newTime) / totalRequests;
  }

  /**
   * @ac US-054-AC-6: Monitor API usage
   * Get usage statistics
   */
  public getUsageStats(): Readonly<ApiUsageStats> {
    return { ...this.usageStats };
  }

  /**
   * Get configuration
   */
  public getConfig(): Readonly<AgentforceConfig> {
    return { ...this.config };
  }

  /**
   * Check if service is enabled
   */
  public isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Reset usage statistics (for testing)
   */
  public resetStats(): void {
    this.usageStats.totalRequests = 0;
    this.usageStats.successfulRequests = 0;
    this.usageStats.failedRequests = 0;
    this.usageStats.totalTokensUsed = 0;
    this.usageStats.averageResponseTime = 0;
    this.usageStats.rateLimitHits = 0;
    this.requestTimestamps = [];
  }

  private extractContent(payload: Record<string, unknown>): string {
    const content = payload.content;
    if (typeof content === 'string') {
      return content;
    }

    const choices = payload.choices;
    if (Array.isArray(choices) && choices.length > 0) {
      const [firstChoice] = choices as unknown[];
      if (typeof firstChoice === 'object' && firstChoice !== null && 'message' in firstChoice) {
        const message = (firstChoice as Record<string, unknown>).message;
        if (typeof message === 'object' && message !== null && 'content' in message) {
          const messageContent = (message as Record<string, unknown>).content;
          if (typeof messageContent === 'string') {
            return messageContent;
          }
        }
      }
    }

    throw new Error('Agentforce response did not contain content');
  }

  private extractTokensUsed(payload: Record<string, unknown>, prompt: string): number {
    const usage = payload.usage;
    if (typeof usage === 'object' && usage !== null && 'total_tokens' in usage) {
      const totalTokens = (usage as Record<string, unknown>).total_tokens;
      if (typeof totalTokens === 'number' && Number.isFinite(totalTokens)) {
        return totalTokens;
      }
    }

    return Math.max(1, Math.ceil(prompt.length / 4));
  }

  private extractModel(payload: Record<string, unknown>, fallbackModel: string): string {
    if (typeof payload.model === 'string') {
      return payload.model;
    }

    return fallbackModel;
  }
}
