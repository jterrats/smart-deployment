import { getLogger } from '../utils/logger.js';
import type { LLMProvider, LLMProviderConfig, LLMRequest, LLMResponse } from './llm-provider.js';

const logger = getLogger('OpenAIService');

export type OpenAIFetch = typeof fetch;

export interface OpenAIConfig extends LLMProviderConfig {
  provider: 'openai';
  endpoint: string;
  apiKey?: string;
  model: string;
  timeout: number;
  enabled: boolean;
  rateLimit: number;
  fetchFn?: OpenAIFetch;
}

export class OpenAIService implements LLMProvider {
  private readonly config: OpenAIConfig;
  private readonly fetchFn?: OpenAIFetch;

  public constructor(config: Partial<OpenAIConfig> = {}) {
    this.config = {
      provider: 'openai',
      endpoint: config.endpoint ?? process.env.OPENAI_ENDPOINT ?? 'https://api.openai.com/v1/chat/completions',
      apiKey: config.apiKey ?? process.env.OPENAI_API_KEY,
      model: config.model ?? 'gpt-4o-mini',
      timeout: config.timeout ?? 30_000,
      enabled: config.enabled ?? true,
      rateLimit: config.rateLimit ?? 60,
      fetchFn: config.fetchFn ?? globalThis.fetch,
    };
    this.fetchFn = this.config.fetchFn;

    logger.info('OpenAI service initialized', {
      endpoint: this.config.endpoint,
      model: this.config.model,
      enabled: this.config.enabled,
    });
  }

  public async sendRequest(request: LLMRequest): Promise<LLMResponse> {
    if (!this.config.enabled) {
      throw new Error('OpenAI service is disabled');
    }

    if (!this.config.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    if (!this.fetchFn) {
      throw new Error('Fetch API is not available in this runtime');
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await this.fetchFn(this.config.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          messages: [
            {
              role: 'user',
              content: request.prompt,
            },
          ],
          temperature: request.temperature ?? 0.2,
          max_tokens: request.maxTokens ?? 2000,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const payload = (await response.json()) as {
        model?: string;
        usage?: { total_tokens?: number };
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };

      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('OpenAI response did not contain content');
      }

      return {
        content,
        tokensUsed: payload.usage?.total_tokens ?? Math.max(1, Math.ceil(request.prompt.length / 4)),
        model: payload.model ?? request.model,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('OpenAI request timed out');
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public getConfig(): Readonly<OpenAIConfig> {
    return { ...this.config };
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }
}
