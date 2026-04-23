/**
 * smart-deployment:config command - US-051
 *
 * @ac US-051-AC-1: Set Agentforce configuration
 * @ac US-051-AC-2: Set default test level
 * @ac US-051-AC-3: Set timeout values
 * @ac US-051-AC-4: Set retry strategies
 * @ac US-051-AC-5: Save configuration to file
 * @ac US-051-AC-6: Validate configuration
 * @issue #51
 */

import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { getLogger } from '../utils/logger.js';
import { loadRepoConfig, saveRepoConfig, type DeploymentConfig } from '../config/repo-config.js';
import type { LLMProviderName } from '../ai/llm-provider.js';

const logger = getLogger('ConfigCommand');
Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('smart-deployment', 'config');

export default class Config extends SfCommand<{ success: boolean }> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');

  public static readonly flags = {
    'source-path': Flags.directory({
      summary: messages.getMessage('flags.source-path.summary'),
      exists: true,
    }),
    set: Flags.string({
      summary: messages.getMessage('flags.set.summary'),
      char: 's',
      description: messages.getMessage('flags.set.description'),
    }),
    get: Flags.string({
      summary: messages.getMessage('flags.get.summary'),
      char: 'g',
      description: messages.getMessage('flags.get.description'),
    }),
    'get-priority': Flags.string({
      summary: messages.getMessage('flags.get-priority.summary'),
      description: messages.getMessage('flags.get-priority.description'),
    }),
    'set-priority': Flags.string({
      summary: messages.getMessage('flags.set-priority.summary'),
      description: messages.getMessage('flags.set-priority.description'),
    }),
    'set-llm-provider': Flags.string({
      summary: messages.getMessage('flags.set-llm-provider.summary'),
      options: ['agentforce', 'openai'],
    }),
    'set-llm-model': Flags.string({
      summary: messages.getMessage('flags.set-llm-model.summary'),
    }),
    'set-llm-endpoint': Flags.string({
      summary: messages.getMessage('flags.set-llm-endpoint.summary'),
    }),
    'set-llm-timeout': Flags.integer({
      summary: messages.getMessage('flags.set-llm-timeout.summary'),
    }),
    'get-llm': Flags.boolean({
      summary: messages.getMessage('flags.get-llm.summary'),
      default: false,
    }),
    list: Flags.boolean({
      summary: messages.getMessage('flags.list.summary'),
      char: 'l',
      default: false,
    }),
  };

  public static readonly examples = messages.getMessages('examples');

  public async run(): Promise<{ success: boolean }> {
    const { flags } = await this.parse(Config);
    const baseDir = flags['source-path'] ?? process.cwd();

    try {
      const config = await loadRepoConfig(baseDir);

      // Handle --list flag
      if (flags.list) {
        this.displayConfig(config);
        return { success: true };
      }

      if (flags['get-llm']) {
        return this.showLlmConfig(config);
      }

      if (flags['get-priority']) {
        return this.showPriority(config, flags['get-priority']);
      }

      const hasLlmUpdate =
        flags['set-llm-provider'] !== undefined ||
        flags['set-llm-model'] !== undefined ||
        flags['set-llm-endpoint'] !== undefined ||
        flags['set-llm-timeout'] !== undefined;

      if (hasLlmUpdate) {
        return await this.updateLlmConfig(config, flags, baseDir);
      }

      if (flags['set-priority']) {
        return await this.setPriority(config, flags['set-priority'], baseDir);
      }

      if (flags.get) {
        return this.showConfigValue(config, flags.get);
      }

      if (flags.set) {
        return await this.setConfigValue(config, flags.set, baseDir);
      }

      // No flags - show help
      this.log('Use --help to see available options');
      return { success: true };
    } catch (error) {
      logger.error('Config management failed', { error });
      this.error(`Configuration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private displayConfig(config: DeploymentConfig): void {
    this.log('📋 Current Configuration:');
    this.log('');

    if (Object.keys(config).length === 0) {
      this.log('  (no configuration set)');
      return;
    }

    // Display priorities
    if (config.priorities && Object.keys(config.priorities).length > 0) {
      this.log('  Metadata Priorities:');
      for (const [metadata, priority] of Object.entries(config.priorities)) {
        this.log(`    ${metadata}: ${priority}`);
      }
      this.log('');
    }

    // Display other config
    const { priorities, ...otherConfig } = config;
    void priorities;
    if (Object.keys(otherConfig).length > 0) {
      this.log('  Other Settings:');
      for (const [key, value] of Object.entries(otherConfig)) {
        const displayValue =
          typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value);
        this.log(`    ${key}: ${displayValue}`);
      }
    }
  }

  private showLlmConfig(config: DeploymentConfig): { success: boolean } {
    const llmConfig = config.llm ?? {};
    this.log(`llm: ${JSON.stringify(llmConfig)}`);
    return { success: true };
  }

  private showPriority(config: DeploymentConfig, metadataId: string): { success: boolean } {
    const priority = config.priorities?.[metadataId] ?? 0;
    this.log(`Priority for ${metadataId}: ${priority}`);
    return { success: true };
  }

  private async updateLlmConfig(
    config: DeploymentConfig,
    flags: Awaited<ReturnType<Config['parse']>>['flags'],
    baseDir: string
  ): Promise<{ success: boolean }> {
    const nextLlmConfig = {
      ...(config.llm ?? {}),
    };
    const nextConfig: DeploymentConfig = {
      ...config,
      llm: nextLlmConfig,
    };
    const llmProvider =
      typeof flags['set-llm-provider'] === 'string' ? (flags['set-llm-provider'] as LLMProviderName) : undefined;
    const llmModel = typeof flags['set-llm-model'] === 'string' ? flags['set-llm-model'] : undefined;
    const llmEndpoint = typeof flags['set-llm-endpoint'] === 'string' ? flags['set-llm-endpoint'] : undefined;
    const llmTimeout = typeof flags['set-llm-timeout'] === 'number' ? flags['set-llm-timeout'] : undefined;

    if (llmProvider) {
      nextLlmConfig.provider = llmProvider;
    }

    if (llmModel) {
      nextLlmConfig.model = llmModel;
    }

    if (llmEndpoint) {
      nextLlmConfig.endpoint = llmEndpoint;
    }

    if (llmTimeout !== undefined) {
      if (llmTimeout < 1) {
        this.error(messages.getMessage('errors.invalidLlmTimeout'));
      }

      nextLlmConfig.timeout = llmTimeout;
    }

    await saveRepoConfig(nextConfig, baseDir);
    this.log(`✅ Updated LLM configuration: ${JSON.stringify(nextConfig.llm)}`);
    logger.info('LLM config updated', { llm: nextConfig.llm });
    return { success: true };
  }

  private async setPriority(
    config: DeploymentConfig,
    rawValue: string,
    baseDir: string
  ): Promise<{ success: boolean }> {
    const match = rawValue.match(/^(.+)=(\d+)$/);
    if (!match) {
      this.error('Invalid format. Use: MetadataType:Name=priority (e.g., ApexClass:MyClass=100)');
    }

    const [, metadataId, priorityStr] = match;
    const priority = parseInt(priorityStr, 10);

    const nextConfig: DeploymentConfig = {
      ...config,
      priorities: {
        ...(config.priorities ?? {}),
        [metadataId]: priority,
      },
    };

    await saveRepoConfig(nextConfig, baseDir);
    this.log(`✅ Set priority for ${metadataId} = ${priority}`);
    logger.info('Priority updated', { metadataId, priority });
    return { success: true };
  }

  private showConfigValue(config: DeploymentConfig, key: string): { success: boolean } {
    const value = (config as Record<string, unknown>)[key];
    const displayValue = value === undefined ? 'not set' : typeof value === 'string' ? value : JSON.stringify(value);
    this.log(`${key}: ${displayValue}`);
    return { success: true };
  }

  private async setConfigValue(
    config: DeploymentConfig,
    rawValue: string,
    baseDir: string
  ): Promise<{ success: boolean }> {
    const match = rawValue.match(/^([^=]+)=(.+)$/);
    if (!match) {
      this.error('Invalid format. Use: key=value');
    }

    const [, key, value] = match;
    const nextConfig = {
      ...(config as Record<string, unknown>),
      [key]: value,
    } as DeploymentConfig;

    await saveRepoConfig(nextConfig, baseDir);
    this.log(`✅ Set ${key} = ${value}`);
    logger.info('Config updated', { key, value });
    return { success: true };
  }
}
