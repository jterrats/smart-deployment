import { loadRepoConfigSync } from '../config/repo-config.js';
import { AgentforceService, type AgentforceFetch } from './agentforce-service.js';
import { OpenAIService } from './openai-service.js';
import type { LLMProvider, LLMProviderName } from './llm-provider.js';

export type LLMProviderFactoryConfig = {
  baseDir?: string;
  provider?: LLMProviderName;
  endpoint?: string;
  apiKey?: string;
  model?: string;
  timeout?: number;
  enabled?: boolean;
  rateLimit?: number;
  maxRetries?: number;
  fetchFn?: AgentforceFetch;
};

export function createLLMProvider(config: LLMProviderFactoryConfig = {}): LLMProvider {
  const repoConfig = loadRepoConfigSync(config.baseDir).llm ?? {};
  const resolvedConfig: LLMProviderFactoryConfig = {
    ...config,
    provider: config.provider ?? repoConfig.provider ?? 'agentforce',
    endpoint: config.endpoint ?? repoConfig.endpoint,
    model: config.model ?? repoConfig.model,
    timeout: config.timeout ?? repoConfig.timeout,
    rateLimit: config.rateLimit ?? repoConfig.rateLimit,
  };
  const provider = resolvedConfig.provider ?? 'agentforce';

  switch (provider) {
    case 'agentforce': {
      return new AgentforceService({
        ...resolvedConfig,
        provider: 'agentforce',
      });
    }
    case 'openai': {
      return new OpenAIService({
        ...resolvedConfig,
        provider: 'openai',
      });
    }
    default: {
      return new AgentforceService({
        ...resolvedConfig,
        provider: 'agentforce',
      });
    }
  }
}
