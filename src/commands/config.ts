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
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const logger = getLogger('ConfigCommand');

interface UserPriorities {
  [metadataId: string]: number;
}

interface DeploymentConfig {
  priorities?: UserPriorities;
  testLevel?: string;
  timeout?: number;
  retryStrategy?: string;
}

export default class Config extends SfCommand<{ success: boolean }> {
  public static readonly summary = 'Manage deployment configuration';
  public static readonly description = 'Configure deployment settings, including metadata priorities for wave generation';
  
  public static readonly flags = {
    set: Flags.string({ 
      summary: 'Set config key=value', 
      char: 's',
      description: 'Set a configuration value (e.g., testLevel=RunLocalTests)'
    }),
    get: Flags.string({ 
      summary: 'Get config key', 
      char: 'g',
      description: 'Get a configuration value'
    }),
    'get-priority': Flags.string({
      summary: 'Get priority for specific metadata',
      description: 'Get deployment priority for a metadata component (e.g., ApexClass:MyClass)',
    }),
    'set-priority': Flags.string({
      summary: 'Set priority for specific metadata',
      description: 'Set deployment priority (format: MetadataType:Name=priority, e.g., ApexClass:Critical=100)',
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
    '<%= config.bin %> <%= command.id %> --list',
  ];

  private configPath = path.join(process.cwd(), '.smart-deployment.json');

  public async run(): Promise<{ success: boolean }> {
    const { flags } = await this.parse(Config);
    
    try {
      const config = await this.loadConfig();

      // Handle --list flag
      if (flags.list) {
        this.displayConfig(config);
        return { success: true };
      }

      // Handle --get-priority
      if (flags['get-priority']) {
        const priority = config.priorities?.[flags['get-priority']] ?? 0;
        this.log(`Priority for ${flags['get-priority']}: ${priority}`);
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
        
        await this.saveConfig(config);
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
        
        await this.saveConfig(config);
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

  private async loadConfig(): Promise<DeploymentConfig> {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(content) as DeploymentConfig;
    } catch {
      // Config file doesn't exist yet
      return {};
    }
  }

  private async saveConfig(config: DeploymentConfig): Promise<void> {
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
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
    if (Object.keys(otherConfig).length > 0) {
      this.log('  Other Settings:');
      for (const [key, value] of Object.entries(otherConfig)) {
        this.log(`    ${key}: ${value}`);
      }
    }
  }
}
