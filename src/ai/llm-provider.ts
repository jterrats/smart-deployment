export type LLMProviderName = 'agentforce' | 'openai';

export interface LLMRequest {
  model: string;
  prompt: string;
  context?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  tokensUsed: number;
  model: string;
  executionTime: number;
}

export interface LLMProviderConfig {
  provider: LLMProviderName;
  endpoint: string;
  model: string;
  timeout: number;
  enabled: boolean;
  rateLimit?: number;
}

export interface LLMProvider {
  sendRequest(request: LLMRequest): Promise<LLMResponse>;
  getConfig(): Readonly<LLMProviderConfig>;
  isEnabled(): boolean;
}
