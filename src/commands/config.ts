/**
 * smart-deployment:config command - US-051
 * @ac US-051-AC-1: Set Agentforce configuration
 * @ac US-051-AC-2: Set default test level
 * @ac US-051-AC-3: Set timeout values
 * @ac US-051-AC-4: Set retry strategies
 * @ac US-051-AC-5: Save configuration to file
 * @ac US-051-AC-6: Validate configuration
 * @issue #51
 */

import { Flags } from '@oclif/core';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { getLogger } from '../utils/logger.js';
import { loadRepoConfig, saveRepoConfig, type DeploymentConfig } from '../config/repo-config.js';
import type { LLMProviderName } from '../ai/llm-provider.js';

const logger = getLogger('ConfigCommand');

export default class Config extends SfCommand<{ success: boolean }> {
  public static readonly summary = 'Manage deployment configuration';
  public static readonly description =
    'Configure deployment settings, including metadata priorities for wave generation';

  public static readonly flags = {
    'source-path': Flags.directory({
      summary: 'Path to the Salesforce project containing the deployment config',
      exists: true,
    }),
    set: Flags.string({
      summary: 'Set config key=value',
      char: 's',
      description: 'Set a configuration value (e.g., testLevel=RunLocalTests)',
    }),
    get: Flags.string({
      summary: 'Get config key',
      char: 'g',
      description: 'Get a configuration value',
    }),
    'get-priority': Flags.string({
      summary: 'Get priority for specific metadata',
      description: 'Get deployment priority for a metadata component (e.g., ApexClass:MyClass)',
    }),
    'set-priority': Flags.string({
      summary: 'Set priority for specific metadata',
      description: 'Set deployment priority (format: MetadataType:Name=priority, e.g., ApexClass:Critical=100)',
    }),
    'set-llm-provider': Flags.string({
      summary: 'Set the default LLM provider for AI services',
      options: ['agentforce', 'openai'],
    }),
    'set-llm-model': Flags.string({
      summary: 'Set the default LLM model for AI services',
    }),
    'set-llm-endpoint': Flags.string({
      summary: 'Set the default LLM API endpoint',
    }),
    'set-llm-timeout': Flags.integer({
      summary: 'Set the default LLM timeout in milliseconds',
      min: 1,
    }),
    'get-llm': Flags.boolean({
      summary: 'Show the current LLM configuration',
      default: false,
    }),
    list: Flags.boolean({
      summary: 'List all configuration',
      char: 'l',
      default: false,
    }),
  };

  public static readonly examples = [
    '<%= config.bin %> <%= command.id %> --set testLevel=RunLocalTests',
    '<%= config.bin %> <%= command.id %> --get testLevel',
    '<%= config.bin %> <%= command.id %> --set-priority ApexClass:CriticalClass=100',
    '<%= config.bin %> <%= command.id %> --get-priority ApexClass:CriticalClass',
    '<%= config.bin %> <%= command.id %> --set-llm-provider openai',
    '<%= config.bin %> <%= command.id %> --set-llm-model gpt-4o-mini',
    '<%= config.bin %> <%= command.id %> --list',
  ];

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
        const llmConfig = config.llm ?? {};
        this.log(`llm: ${JSON.stringify(llmConfig)}`);
        return { success: true };
      }

      // Handle --get-priority
      if (flags['get-priority']) {
        const priority = config.priorities?.[flags['get-priority']] ?? 0;
        this.log(`Priority for ${flags['get-priority']}: ${priority}`);
        return { success: true };
      }

      if (
        flags['set-llm-provider'] ||
        flags['set-llm-model'] ||
        flags['set-llm-endpoint'] ||
        flags['set-llm-timeout']
      ) {
        config.llm ??= {};

        if (flags['set-llm-provider']) {
          config.llm.provider = flags['set-llm-provider'] as LLMProviderName;
        }

        if (flags['set-llm-model']) {
          config.llm.model = flags['set-llm-model'];
        }

        if (flags['set-llm-endpoint']) {
          config.llm.endpoint = flags['set-llm-endpoint'];
        }

        if (flags['set-llm-timeout']) {
          config.llm.timeout = flags['set-llm-timeout'];
        }

        await saveRepoConfig(config, baseDir);
        this.log(`✅ Updated LLM configuration: ${JSON.stringify(config.llm)}`);
        logger.info('LLM config updated', { llm: config.llm });
        return { success: true };
      }

      // Handle --set-priority
      if (flags['set-priority']) {
        const match = flags['set-priority'].match(/^(.+)=(\d+)$/);
        if (!match) {
          this.error('Invalid format. Use: MetadataType:Name=priority (e.g., ApexClass:MyClass=100)');
        }
        const [, metadataId, priorityStr] = match;
        const priority = parseInt(priorityStr, 10);

        if (!config.priorities) {
          config.priorities = {};
        }
        config.priorities[metadataId] = priority;

        await saveRepoConfig(config, baseDir);
        this.log(`✅ Set priority for ${metadataId} = ${priority}`);
        logger.info('Priority updated', { metadataId, priority });
        return { success: true };
      }

      // Handle --get
      if (flags.get) {
        const value = (config as Record<string, unknown>)[flags.get];
        const displayValue =
          value === undefined ? 'not set' : typeof value === 'string' ? value : JSON.stringify(value);
        this.log(`${flags.get}: ${displayValue}`);
        return { success: true };
      }

      // Handle --set
      if (flags.set) {
        const match = flags.set.match(/^([^=]+)=(.+)$/);
        if (!match) {
          this.error('Invalid format. Use: key=value');
        }
        const [, key, value] = match;
        (config as Record<string, unknown>)[key] = value;

        await saveRepoConfig(config, baseDir);
        this.log(`✅ Set ${key} = ${value}`);
        logger.info('Config updated', { key, value });
        return { success: true };
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
    const { priorities: _priorities, ...otherConfig } = config;
    if (Object.keys(otherConfig).length > 0) {
      this.log('  Other Settings:');
      for (const [key, value] of Object.entries(otherConfig)) {
        const displayValue =
          typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value);
        this.log(`    ${key}: ${displayValue}`);
      }
    }
  }
}
