import type { LLMProviderName } from '../ai/llm-provider.js';
import type { DeploymentConfig, RepoLLMConfig } from './repo-config.js';

export type LlmConfigUpdates = {
  provider?: LLMProviderName;
  model?: string;
  endpoint?: string;
  timeout?: number;
};

export class ConfigMutationService {
  public updateLlmConfig(config: DeploymentConfig, updates: LlmConfigUpdates): DeploymentConfig {
    const nextLlmConfig: RepoLLMConfig = {
      ...(config.llm ?? {}),
    };

    if (updates.provider) {
      nextLlmConfig.provider = updates.provider;
    }

    if (updates.model) {
      nextLlmConfig.model = updates.model;
    }

    if (updates.endpoint) {
      nextLlmConfig.endpoint = updates.endpoint;
    }

    if (updates.timeout !== undefined) {
      if (updates.timeout < 1) {
        throw new Error('LLM timeout must be greater than 0');
      }

      nextLlmConfig.timeout = updates.timeout;
    }

    return {
      ...config,
      llm: nextLlmConfig,
    };
  }

  public setPriority(
    config: DeploymentConfig,
    rawValue: string
  ): { nextConfig: DeploymentConfig; metadataId: string; priority: number } {
    const match = rawValue.match(/^(.+)=(\d+)$/);
    if (!match) {
      throw new Error('Invalid format. Use: MetadataType:Name=priority (e.g., ApexClass:MyClass=100)');
    }

    const [, metadataId, priorityStr] = match;
    const priority = parseInt(priorityStr, 10);

    return {
      nextConfig: {
        ...config,
        priorities: {
          ...(config.priorities ?? {}),
          [metadataId]: priority,
        },
      },
      metadataId,
      priority,
    };
  }

  public setConfigValue(
    config: DeploymentConfig,
    rawValue: string
  ): { nextConfig: DeploymentConfig; key: string; value: string } {
    const match = rawValue.match(/^([^=]+)=(.+)$/);
    if (!match) {
      throw new Error('Invalid format. Use: key=value');
    }

    const [, key, value] = match;
    return {
      nextConfig: {
        ...(config as Record<string, unknown>),
        [key]: value,
      } as DeploymentConfig,
      key,
      value,
    };
  }
}
