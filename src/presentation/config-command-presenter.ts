import type { DeploymentConfig } from '../config/repo-config.js';

export type ConfigPresenterIO = {
  log: (message: string) => void;
};

export class ConfigCommandPresenter {
  public reportUsageHint(io: ConfigPresenterIO): void {
    io.log('Use --help to see available options');
  }

  public reportCurrentConfig(io: ConfigPresenterIO, config: DeploymentConfig): void {
    io.log('📋 Current Configuration:');
    io.log('');

    if (Object.keys(config).length === 0) {
      io.log('  (no configuration set)');
      return;
    }

    if (config.priorities && Object.keys(config.priorities).length > 0) {
      io.log('  Metadata Priorities:');
      for (const [metadata, priority] of Object.entries(config.priorities)) {
        io.log(`    ${metadata}: ${priority}`);
      }
      io.log('');
    }

    const { priorities, ...otherConfig } = config;
    void priorities;
    if (Object.keys(otherConfig).length > 0) {
      io.log('  Other Settings:');
      for (const [key, value] of Object.entries(otherConfig)) {
        io.log(`    ${key}: ${this.toDisplayValue(value)}`);
      }
    }
  }

  public reportLlmConfig(io: ConfigPresenterIO, config: DeploymentConfig): void {
    io.log(`llm: ${JSON.stringify(config.llm ?? {})}`);
  }

  public reportPriority(io: ConfigPresenterIO, metadataId: string, priority: number): void {
    io.log(`Priority for ${metadataId}: ${priority}`);
  }

  public reportConfigValue(io: ConfigPresenterIO, key: string, value: unknown): void {
    io.log(`${key}: ${value === undefined ? 'not set' : this.toDisplayValue(value)}`);
  }

  public reportLlmUpdated(io: ConfigPresenterIO, config: DeploymentConfig): void {
    io.log(`✅ Updated LLM configuration: ${JSON.stringify(config.llm)}`);
  }

  public reportPriorityUpdated(io: ConfigPresenterIO, metadataId: string, priority: number): void {
    io.log(`✅ Set priority for ${metadataId} = ${priority}`);
  }

  public reportConfigValueUpdated(io: ConfigPresenterIO, key: string, value: string): void {
    io.log(`✅ Set ${key} = ${value}`);
  }

  private toDisplayValue(value: unknown): string {
    return typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value);
  }
}
