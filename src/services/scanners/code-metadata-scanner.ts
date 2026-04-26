import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parseAura } from '../../parsers/aura-parser.js';
import { parseApexClass } from '../../parsers/apex-class-parser.js';
import { parseApexTrigger } from '../../parsers/apex-trigger-parser.js';
import { parseLWC } from '../../parsers/lwc-parser.js';
import type { MetadataComponent } from '../../types/metadata.js';
import { getLogger } from '../../utils/logger.js';

const logger = getLogger('CodeMetadataScanner');

export type ScannerContext = {
  fileExists: (filePath: string) => Promise<boolean>;
  shouldIgnore: (filePath: string) => boolean;
  readFile: typeof fs.readFile;
  errors: string[];
};

type ApexMetadataComponent = MetadataComponent & {
  isTest?: boolean;
};

export type FileScanner = {
  pattern: string;
  shouldInclude?: (filePath: string) => boolean;
  parse: (filePath: string, context: ScannerContext) => Promise<MetadataComponent | undefined>;
};

export type DirectoryScanner = {
  pattern: string;
  parse: (directoryPath: string, context: ScannerContext) => Promise<MetadataComponent | undefined>;
};

function toNodeIds(dependencies: Iterable<string>, defaultType: string): Set<string> {
  return new Set(
    [...dependencies].map((dependency) => (dependency.includes(':') ? dependency : `${defaultType}:${dependency}`))
  );
}

function isApexTestClassContent(content: string, className: string): boolean {
  if (/@isTest\b/i.test(content) || /\btestMethod\b/i.test(content)) {
    return true;
  }

  const normalizedName = className.toLowerCase();
  return normalizedName.includes('test') || normalizedName.endsWith('_test');
}

export async function parseApexClassComponent(
  filePath: string,
  context: ScannerContext
): Promise<MetadataComponent | undefined> {
  try {
    const content = await context.readFile(filePath, 'utf-8');
    const parsed = parseApexClass(filePath, content);

    return {
      name: parsed.className,
      type: 'ApexClass' as const,
      filePath,
      dependencies: toNodeIds(
        parsed.dependencies.map((dependency) => dependency.className),
        'ApexClass'
      ),
      dependents: new Set<string>(),
      priorityBoost: 0,
      isTest: isApexTestClassContent(content, parsed.className),
    } as ApexMetadataComponent;
  } catch (error) {
    const errorMsg = `Failed to parse Apex class ${filePath}: ${
      error instanceof Error ? error.message : String(error)
    }`;
    logger.warn(errorMsg);
    context.errors.push(errorMsg);
    return undefined;
  }
}

export async function parseApexTriggerComponent(
  filePath: string,
  context: ScannerContext
): Promise<MetadataComponent | undefined> {
  try {
    const content = await context.readFile(filePath, 'utf-8');
    const parsed = parseApexTrigger(filePath, content);

    return {
      name: parsed.triggerName,
      type: 'ApexTrigger' as const,
      filePath,
      dependencies: toNodeIds(
        parsed.dependencies.map((dependency) => dependency.className),
        'ApexClass'
      ),
      dependents: new Set<string>(),
      priorityBoost: 0,
    };
  } catch (error) {
    const errorMsg = `Failed to parse Apex trigger ${filePath}: ${
      error instanceof Error ? error.message : String(error)
    }`;
    logger.warn(errorMsg);
    context.errors.push(errorMsg);
    return undefined;
  }
}

export async function parseLwcComponent(
  directoryPath: string,
  context: ScannerContext
): Promise<MetadataComponent | undefined> {
  const componentName = path.basename(directoryPath);
  const jsFile = path.join(directoryPath, `${componentName}.js`);
  const tsFile = path.join(directoryPath, `${componentName}.ts`);
  const metaFile = path.join(directoryPath, `${componentName}.js-meta.xml`);

  const jsExists = await context.fileExists(jsFile);
  const tsExists = jsExists ? false : await context.fileExists(tsFile);
  const codeFile = jsExists ? jsFile : tsExists ? tsFile : null;
  if (codeFile === null) {
    return undefined;
  }

  try {
    const jsContent = await context.readFile(codeFile, 'utf-8');
    const metaContent = (await context.fileExists(metaFile)) ? await context.readFile(metaFile, 'utf-8') : undefined;
    const parsed = parseLWC(componentName, jsContent, metaContent);

    return {
      name: componentName,
      type: 'LightningComponentBundle' as const,
      filePath: codeFile,
      dependencies: new Set<string>([
        ...parsed.apexImports,
        ...parsed.lwcImports.map((dependency) => `c:${dependency}`),
      ]),
      dependents: new Set<string>(),
      priorityBoost: 0,
    };
  } catch (error) {
    const errorMsg = `Failed to parse LWC ${componentName}: ${error instanceof Error ? error.message : String(error)}`;
    logger.warn(errorMsg);
    context.errors.push(errorMsg);
    return undefined;
  }
}

export async function parseAuraComponent(
  directoryPath: string,
  context: ScannerContext
): Promise<MetadataComponent | undefined> {
  const componentName = path.basename(directoryPath);
  const cmpFile = path.join(directoryPath, `${componentName}.cmp`);
  if (!(await context.fileExists(cmpFile))) {
    return undefined;
  }

  try {
    const cmpContent = await context.readFile(cmpFile, 'utf-8');
    const parsed = parseAura(componentName, cmpContent);

    const dependencies = new Set<string>();
    if (parsed.apexController) {
      dependencies.add(parsed.apexController);
    }
    if (parsed.extendsComponent) {
      dependencies.add(parsed.extendsComponent);
    }
    parsed.implementsInterfaces.forEach((implementedInterface) => dependencies.add(implementedInterface));
    parsed.childComponents.forEach((childComponent) => dependencies.add(`c:${childComponent}`));

    return {
      name: componentName,
      type: 'AuraDefinitionBundle' as const,
      filePath: cmpFile,
      dependencies,
      dependents: new Set<string>(),
      priorityBoost: 0,
    };
  } catch (error) {
    const errorMsg = `Failed to parse Aura component ${componentName}: ${
      error instanceof Error ? error.message : String(error)
    }`;
    logger.warn(errorMsg);
    context.errors.push(errorMsg);
    return undefined;
  }
}

export const CODE_FILE_SCANNERS: FileScanner[] = [
  {
    pattern: '**/classes/**/*.cls',
    shouldInclude: (filePath) => !filePath.endsWith('.cls-meta.xml'),
    parse: parseApexClassComponent,
  },
  {
    pattern: '**/triggers/**/*.trigger',
    shouldInclude: (filePath) => !filePath.endsWith('.trigger-meta.xml'),
    parse: parseApexTriggerComponent,
  },
];

export const CODE_DIRECTORY_SCANNERS: DirectoryScanner[] = [
  {
    pattern: '**/lwc/*',
    parse: parseLwcComponent,
  },
  {
    pattern: '**/aura/*',
    parse: parseAuraComponent,
  },
];
