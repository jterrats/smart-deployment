import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parseBot } from '../../parsers/bot-parser.js';
import { parseFlow } from '../../parsers/flow-parser.js';
import { parseGenAiPrompt } from '../../parsers/genai-prompt-parser.js';
import type { MetadataComponent } from '../../types/metadata.js';

function addAll(target: Set<string>, values: Iterable<string>, defaultType?: string): void {
  for (const value of values) {
    target.add(defaultType && !value.includes(':') ? `${defaultType}:${value}` : value);
  }
}

export async function parseFlowComponent(filePath: string): Promise<MetadataComponent | undefined> {
  const content = await fs.readFile(filePath, 'utf-8');
  const parsed = parseFlow(filePath, content);

  const deps = new Set<string>();
  parsed.dependencies.forEach((dependency) => {
    if (dependency.type === 'apex_action' || dependency.type === 'subflow') {
      deps.add(dependency.name);
    }
  });

  return {
    name: parsed.flowName,
    type: 'Flow' as const,
    filePath,
    dependencies: deps,
    dependents: new Set<string>(),
    priorityBoost: 0,
  };
}

export async function parseBotComponent(filePath: string): Promise<MetadataComponent | undefined> {
  const botName = path.basename(filePath, '.bot-meta.xml');
  const parsed = await parseBot(filePath, botName);

  const deps = new Set<string>();
  addAll(deps, parsed.flows, 'Flow');
  addAll(deps, parsed.apexActions, 'ApexClass');
  addAll(deps, parsed.genAiPrompts, 'GenAiPromptTemplate');
  addAll(deps, parsed.sobjects);

  return {
    name: botName,
    type: 'Bot' as const,
    filePath,
    dependencies: deps,
    dependents: new Set<string>(),
    priorityBoost: 0,
  };
}

export async function parseGenAiPromptComponent(filePath: string): Promise<MetadataComponent | undefined> {
  const promptName = path.basename(filePath, '.genAiPromptTemplate-meta.xml');
  const parsed = await parseGenAiPrompt(filePath, promptName);

  const deps = new Set<string>();
  parsed.sobjects.forEach((sObjectName: string) => deps.add(sObjectName));
  parsed.dependencies.sobjects.forEach((sObjectName: string) => deps.add(sObjectName));

  return {
    name: promptName,
    type: 'GenAiPromptTemplate' as const,
    filePath,
    dependencies: deps,
    dependents: new Set<string>(),
    priorityBoost: 0,
  };
}
