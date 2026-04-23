import * as fs from 'node:fs/promises';
import * as syncFs from 'node:fs';
import * as path from 'node:path';
import type { LLMProviderName } from '../ai/llm-provider.js';

export type UserPriorities = {
  [metadataId: string]: number;
};

export type RepoLLMConfig = {
  provider?: LLMProviderName;
  model?: string;
  endpoint?: string;
  timeout?: number;
  rateLimit?: number;
};

export type DeploymentConfig = {
  priorities?: UserPriorities;
  testLevel?: string;
  timeout?: number;
  retryStrategy?: string;
  llm?: RepoLLMConfig;
};

export function getRepoConfigPath(baseDir?: string): string {
  return path.join(baseDir ?? process.cwd(), '.smart-deployment.json');
}

export async function loadRepoConfig(baseDir?: string): Promise<DeploymentConfig> {
  const configPath = getRepoConfigPath(baseDir);

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content) as DeploymentConfig;
  } catch {
    return {};
  }
}

export async function saveRepoConfig(config: DeploymentConfig, baseDir?: string): Promise<void> {
  const configPath = getRepoConfigPath(baseDir);
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export function loadRepoConfigSync(baseDir?: string): DeploymentConfig {
  const configPath = getRepoConfigPath(baseDir);

  try {
    const content = syncFs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as DeploymentConfig;
  } catch {
    return {};
  }
}
