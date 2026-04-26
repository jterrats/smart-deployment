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
import type { LLMProviderName } from '../ai/llm-provider.js';
import { loadRepoConfig, saveRepoConfig, type DeploymentConfig } from '../config/repo-config.js';
import { ConfigMutationService } from '../config/config-mutation-service.js';
import { ConfigCommandPresenter } from '../presentation/config-command-presenter.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('ConfigCommand');
Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@jterrats/smart-deployment', 'config');
const configMutationService = new ConfigMutationService();
const presenter = new ConfigCommandPresenter();

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
        presenter.reportCurrentConfig(this, config);
        return { success: true };
      }

      if (flags['get-llm']) {
        presenter.reportLlmConfig(this, config);
        return { success: true };
      }

      if (flags['get-priority']) {
        const priority = config.priorities?.[flags['get-priority']] ?? 0;
        presenter.reportPriority(this, flags['get-priority'], priority);
        return { success: true };
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
        presenter.reportConfigValue(this, flags.get, (config as Record<string, unknown>)[flags.get]);
        return { success: true };
      }

      if (flags.set) {
        return await this.setConfigValue(config, flags.set, baseDir);
      }

      // No flags - show help
      presenter.reportUsageHint(this);
      return { success: true };
    } catch (error) {
      logger.error('Config management failed', { error });
      this.error(`Configuration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async updateLlmConfig(
    config: DeploymentConfig,
    flags: Awaited<ReturnType<Config['parse']>>['flags'],
    baseDir: string
  ): Promise<{ success: boolean }> {
    const llmProvider =
      typeof flags['set-llm-provider'] === 'string' ? (flags['set-llm-provider'] as LLMProviderName) : undefined;
    const llmModel = typeof flags['set-llm-model'] === 'string' ? flags['set-llm-model'] : undefined;
    const llmEndpoint = typeof flags['set-llm-endpoint'] === 'string' ? flags['set-llm-endpoint'] : undefined;
    const llmTimeout = typeof flags['set-llm-timeout'] === 'number' ? flags['set-llm-timeout'] : undefined;
    const nextConfig = configMutationService.updateLlmConfig(config, {
      provider: llmProvider,
      model: llmModel,
      endpoint: llmEndpoint,
      timeout: llmTimeout,
    });

    await saveRepoConfig(nextConfig, baseDir);
    presenter.reportLlmUpdated(this, nextConfig);
    logger.info('LLM config updated', { llm: nextConfig.llm });
    return { success: true };
  }

  private async setPriority(
    config: DeploymentConfig,
    rawValue: string,
    baseDir: string
  ): Promise<{ success: boolean }> {
    const { nextConfig, metadataId, priority } = configMutationService.setPriority(config, rawValue);

    await saveRepoConfig(nextConfig, baseDir);
    presenter.reportPriorityUpdated(this, metadataId, priority);
    logger.info('Priority updated', { metadataId, priority });
    return { success: true };
  }

  private async setConfigValue(
    config: DeploymentConfig,
    rawValue: string,
    baseDir: string
  ): Promise<{ success: boolean }> {
    const { nextConfig, key, value } = configMutationService.setConfigValue(config, rawValue);

    await saveRepoConfig(nextConfig, baseDir);
    presenter.reportConfigValueUpdated(this, key, value);
    logger.info('Config updated', { key, value });
    return { success: true };
  }
}
