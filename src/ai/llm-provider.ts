export type LLMProviderName = 'agentforce' | 'openai';

export type LLMRequest = {
  model: string;
  prompt: string;
  context?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
};

export type LLMResponse = {
  content: string;
  tokensUsed: number;
  model: string;
  executionTime: number;
};

export type LLMProviderConfig = {
  provider: LLMProviderName;
  endpoint: string;
  model: string;
  timeout: number;
  enabled: boolean;
  rateLimit?: number;
};

export type LLMProvider = {
  sendRequest(request: LLMRequest): Promise<LLMResponse>;
  getConfig(): Readonly<LLMProviderConfig>;
  isEnabled(): boolean;
};
