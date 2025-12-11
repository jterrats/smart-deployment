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

const logger = getLogger('AgentforceService');
const errorAggregator = getErrorAggregator();

export interface AgentforceConfig {
  /** API endpoint URL */
  endpoint: string;
  /** API key or named credential */
  apiKey?: string;
  /** Model to use (e.g., 'agentforce-1', 'gpt-4-turbo') */
  model: string;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Max retry attempts */
  maxRetries: number;
  /** Enable/disable service */
  enabled: boolean;
  /** Rate limit: requests per minute */
  rateLimit: number;
}

export interface AgentforceRequest {
  model: string;
  prompt: string;
  context?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentforceResponse {
  content: string;
  tokensUsed: number;
  model: string;
  executionTime: number;
}

export interface ApiUsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokensUsed: number;
  averageResponseTime: number;
  rateLimitHits: number;
  lastRequestTime?: Date;
}

/**
 * @ac US-054-AC-1: Configure API endpoint
 * @ac US-054-AC-2: Handle authentication
 */
export class AgentforceService {
  private readonly config: AgentforceConfig;
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
      endpoint: config.endpoint || process.env.AGENTFORCE_ENDPOINT || 'https://api.salesforce.com/ai/v1',
      apiKey: config.apiKey || process.env.AGENTFORCE_API_KEY,
      model: config.model || 'agentforce-1',
      timeout: config.timeout || 30000, // 30 seconds
      maxRetries: config.maxRetries || 3,
      enabled: config.enabled !== undefined ? config.enabled : true,
      rateLimit: config.rateLimit || 60, // 60 requests per minute
    };

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
      const delay = Math.min(1000 * 2 ** (attempt - 1), 10000); // Max 10s

      logger.warn(`Retrying Agentforce request (attempt ${attempt}/${this.config.maxRetries})`, {
        delay,
        error: errorMessage,
      });

      await this.sleep(delay);
      return this.executeWithRetry(request, attempt + 1);
    }
  }

  /**
   * Execute actual API request (mock for now)
   */
  private async executeRequest(request: AgentforceRequest): Promise<AgentforceResponse> {
    const startTime = Date.now();

    // Mock response for now (TODO: Replace with actual API call)
    logger.debug('Executing Agentforce request', {
      model: request.model,
      promptLength: request.prompt.length,
    });

    // Simulate API call
    await this.sleep(500 + Math.random() * 1000);

    // Mock response
    const response: AgentforceResponse = {
      content: this.generateMockResponse(request),
      tokensUsed: Math.floor(request.prompt.length / 4) + 100,
      model: request.model,
      executionTime: Date.now() - startTime,
    };

    return response;
  }

  /**
   * Generate mock response (for testing without real API)
   */
  private generateMockResponse(request: AgentforceRequest): string {
    // Return mock JSON response based on prompt
    if (request.prompt.includes('dependency')) {
      return JSON.stringify({
        dependencies: [
          {
            from: 'ComponentA',
            to: 'ComponentB',
            type: 'implicit',
            confidence: 0.85,
            reason: 'Dynamic reference in method call',
          },
        ],
      });
    }

    return JSON.stringify({
      message: 'Mock response from Agentforce',
      confidence: 0.9,
    });
  }

  /**
   * @ac US-054-AC-5: Handle rate limiting
   * Enforce rate limit (requests per minute)
   */
  private enforceRateLimit(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove timestamps older than 1 minute
    this.requestTimestamps = this.requestTimestamps.filter((ts) => ts > oneMinuteAgo);

    // Check if we exceeded rate limit
    if (this.requestTimestamps.length >= this.config.rateLimit) {
      this.usageStats.rateLimitHits++;
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = 60000 - (now - oldestTimestamp);

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
}

