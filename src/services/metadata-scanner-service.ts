/**
 * Metadata Scanner Service
 * Orchestrates project scanning, parsing, and dependency analysis
 *
 * Integrates:
 * - SfdxProjectDetector
 * - ForceIgnoreParser
 * - Metadata parsers (all types)
 * - DependencyGraphBuilder
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { glob as globAsync } from 'glob';
import { DependencyGraphBuilder } from '../dependencies/dependency-graph-builder.js';
import { parseAura } from '../parsers/aura-parser.js';
import { parseApexClass } from '../parsers/apex-class-parser.js';
import { parseApexTrigger } from '../parsers/apex-trigger-parser.js';
import { parseBot } from '../parsers/bot-parser.js';
import {
  groupCustomMetadataWithRecords,
  parseCustomMetadataRecord,
  parseCustomMetadataType,
} from '../parsers/custom-metadata-parser.js';
import { parseCustomObject } from '../parsers/custom-object-parser.js';
import { parseEmailTemplate } from '../parsers/email-template-parser.js';
import { parseFlexiPage } from '../parsers/flexipage-parser.js';
import { parseFlow } from '../parsers/flow-parser.js';
import { parseGenAiPrompt } from '../parsers/genai-prompt-parser.js';
import { parseLayout } from '../parsers/layout-parser.js';
import { parseLWC } from '../parsers/lwc-parser.js';
import { parsePermissionSet } from '../parsers/permission-set-parser.js';
import { parseProfile } from '../parsers/profile-parser.js';
import { parseVisualforce } from '../parsers/visualforce-parser.js';
import { ForceIgnoreParser } from '../scanner/forceignore-parser.js';
import { SfdxProjectDetector } from '../scanner/sfdx-project-detector.js';
import type { MetadataComponent } from '../types/metadata.js';
import type { DependencyAnalysisResult } from '../types/dependency.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('MetadataScannerService');

type ScannerContext = {
  fileExists: (filePath: string) => Promise<boolean>;
  shouldIgnore: (filePath: string) => boolean;
  readFile: typeof fs.readFile;
  errors: string[];
};

type ApexMetadataComponent = MetadataComponent & {
  isTest?: boolean;
};

type FileScanner = {
  pattern: string;
  shouldInclude?: (filePath: string) => boolean;
  parse: (filePath: string, context: ScannerContext) => Promise<MetadataComponent | undefined>;
};

type DirectoryScanner = {
  pattern: string;
  parse: (directoryPath: string, context: ScannerContext) => Promise<MetadataComponent | undefined>;
};

function toNodeIds(dependencies: Iterable<string>, defaultType: string): Set<string> {
  return new Set(
    [...dependencies].map((dependency) => (dependency.includes(':') ? dependency : `${defaultType}:${dependency}`))
  );
}

function addAll(target: Set<string>, values: Iterable<string>, defaultType?: string): void {
  for (const value of values) {
    target.add(defaultType && !value.includes(':') ? `${defaultType}:${value}` : value);
  }
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function isApexTestClassContent(content: string, className: string): boolean {
  if (/@isTest\b/i.test(content) || /\btestMethod\b/i.test(content)) {
    return true;
  }

  const normalizedName = className.toLowerCase();
  return normalizedName.includes('test') || normalizedName.endsWith('_test');
}

async function parseProfileComponent(filePath: string): Promise<MetadataComponent | undefined> {
  const profileName = path.basename(filePath, '.profile-meta.xml');
  const parsed = await parseProfile(filePath, profileName);

  const deps = new Set<string>();
  const optionalDependencies = new Set<string>();
  addAll(deps, parsed.dependencies.objects);
  addAll(deps, parsed.dependencies.fields);
  addAll(deps, parsed.dependencies.apexClasses, 'ApexClass');
  addAll(deps, parsed.dependencies.layouts, 'Layout');
  addAll(deps, parsed.dependencies.visualforcePages, 'VisualforcePage');
  addAll(deps, parsed.dependencies.recordTypes, 'RecordType');
  addAll(deps, parsed.dependencies.applications, 'LightningApp');
  addAll(deps, parsed.dependencies.tabs);
  addAll(deps, parsed.dependencies.customPermissions, 'CustomPermission');
  addAll(deps, parsed.dependencies.customMetadataTypes, 'CustomMetadata');
  addAll(deps, parsed.dependencies.flows, 'Flow');
  addAll(deps, parsed.dependencies.externalDataSources);
  addAll(deps, parsed.dependencies.customSettings);
  addAll(optionalDependencies, parsed.optionalDependencies.layouts, 'Layout');
  addAll(optionalDependencies, parsed.optionalDependencies.visualforcePages, 'VisualforcePage');
  addAll(optionalDependencies, parsed.optionalDependencies.applications, 'LightningApp');
  addAll(optionalDependencies, parsed.optionalDependencies.tabs);

  return {
    name: profileName,
    type: 'Profile' as const,
    filePath,
    dependencies: deps,
    optionalDependencies,
    dependents: new Set<string>(),
    priorityBoost: 0,
  };
}

async function parsePermissionSetComponent(filePath: string): Promise<MetadataComponent | undefined> {
  const permSetName = path.basename(filePath, '.permissionset-meta.xml');
  const parsed = await parsePermissionSet(filePath, permSetName);

  const deps = new Set<string>();
  const optionalDependencies = new Set<string>();
  addAll(deps, parsed.dependencies.objects);
  addAll(deps, parsed.dependencies.fields);
  addAll(deps, parsed.dependencies.apexClasses, 'ApexClass');
  addAll(deps, parsed.dependencies.visualforcePages, 'VisualforcePage');
  addAll(deps, parsed.dependencies.customPermissions, 'CustomPermission');
  addAll(deps, parsed.dependencies.applications, 'LightningApp');
  addAll(deps, parsed.dependencies.tabs);
  addAll(deps, parsed.dependencies.customMetadataTypes, 'CustomMetadata');
  addAll(deps, parsed.dependencies.flows, 'Flow');
  addAll(deps, parsed.dependencies.externalDataSources);
  addAll(deps, parsed.dependencies.customSettings);
  addAll(deps, parsed.dependencies.recordTypes, 'RecordType');
  addAll(optionalDependencies, parsed.optionalDependencies.visualforcePages, 'VisualforcePage');
  addAll(optionalDependencies, parsed.optionalDependencies.applications, 'LightningApp');
  addAll(optionalDependencies, parsed.optionalDependencies.tabs);

  return {
    name: permSetName,
    type: 'PermissionSet' as const,
    filePath,
    dependencies: deps,
    optionalDependencies,
    dependents: new Set<string>(),
    priorityBoost: 0,
  };
}

async function parseLayoutComponent(filePath: string): Promise<MetadataComponent | undefined> {
  const layoutName = path.basename(filePath, '.layout-meta.xml');
  const parsed = await parseLayout(filePath, layoutName);

  const deps = new Set<string>();
  const optionalDependencies = new Set<string>();
  deps.add(parsed.object);
  addAll(deps, parsed.relatedObjects);
  addAll(deps, parsed.fields);
  addAll(deps, parsed.relatedLists);
  addAll(deps, parsed.customButtons);
  addAll(deps, parsed.visualforcePages, 'VisualforcePage');
  addAll(deps, parsed.quickActions, 'QuickAction');
  addAll(deps, parsed.canvasApps);
  addAll(deps, parsed.customLinks, 'WebLink');
  addAll(optionalDependencies, parsed.optionalDependencies.customButtons);
  addAll(optionalDependencies, parsed.optionalDependencies.visualforcePages, 'VisualforcePage');
  addAll(optionalDependencies, parsed.optionalDependencies.quickActions, 'QuickAction');
  addAll(optionalDependencies, parsed.optionalDependencies.canvasApps);
  addAll(optionalDependencies, parsed.optionalDependencies.customLinks, 'WebLink');

  return {
    name: layoutName,
    type: 'Layout' as const,
    filePath,
    dependencies: deps,
    optionalDependencies,
    dependents: new Set<string>(),
    priorityBoost: 0,
  };
}

async function parseCustomMetadataComponents(cmtDir: string): Promise<MetadataComponent[]> {
  const typeName = path.basename(cmtDir);
  const typeFile = path.join(cmtDir, `${typeName}.md-meta.xml`);

  const content = await fs.readFile(typeFile, 'utf-8');
  const parsedType = await parseCustomMetadataType(typeName, content);
  const recordFiles = (
    await globAsync(path.join(cmtDir, '*.md'), {
      absolute: true,
    })
  ).filter((recordFile) => path.basename(recordFile) !== path.basename(typeFile));
  const records = await Promise.all(
    recordFiles.map(async (recordFile) => {
      const recordContent = await fs.readFile(recordFile, 'utf-8');
      const recordName = path.basename(recordFile, '.md');
      return parseCustomMetadataRecord(recordName, recordContent);
    })
  );
  const grouped = groupCustomMetadataWithRecords(parsedType, records);

  const deps = new Set<string>();
  for (const dependency of grouped.dependencies) {
    switch (dependency.type) {
      case 'relationship_field':
      case 'lookup_reference':
        if (dependency.referencedObject) {
          deps.add(dependency.referencedObject);
        }
        break;
      case 'record':
        deps.add(`CustomMetadataRecord:${dependency.name}`);
        break;
      default:
        break;
    }
  }

  return [
    {
      name: typeName,
      type: 'CustomMetadata' as const,
      filePath: typeFile,
      dependencies: deps,
      dependents: new Set<string>(),
      priorityBoost: 0,
    },
    ...grouped.records.map((record) => ({
      name: record.fullName,
      type: 'CustomMetadataRecord' as const,
      filePath: path.join(cmtDir, `${record.fullName}.md`),
      dependencies: new Set<string>([`CustomMetadata:${typeName}`]),
      dependents: new Set<string>(),
      priorityBoost: 0,
    })),
  ];
}

async function parseFlexiPageComponent(filePath: string): Promise<MetadataComponent | undefined> {
  const flexipageName = path.basename(filePath, '.flexipage-meta.xml');
  const parsed = await parseFlexiPage(filePath, flexipageName);

  const deps = new Set<string>();
  addAll(deps, parsed.lwcComponents);
  addAll(deps, parsed.auraComponents);
  addAll(deps, parsed.objects);
  addAll(deps, parsed.recordTypeFilters, 'RecordType');
  addAll(deps, parsed.quickActions, 'QuickAction');

  return {
    name: flexipageName,
    type: 'FlexiPage' as const,
    filePath,
    dependencies: deps,
    dependents: new Set<string>(),
    priorityBoost: 0,
  };
}

async function parseEmailTemplateComponent(
  filePath: string,
  fileExists: (filePath: string) => Promise<boolean>
): Promise<MetadataComponent | undefined> {
  const templateName = path.basename(filePath, '.email-meta.xml');
  const metadataContent = await fs.readFile(filePath, 'utf-8');
  const bodyPath = filePath.replace(/\.email-meta\.xml$/, '');
  const templateContent = (await fileExists(bodyPath)) ? await fs.readFile(bodyPath, 'utf-8') : metadataContent;
  const parsed = await parseEmailTemplate(templateName, templateContent, metadataContent);

  const deps = new Set<string>();
  parsed.dependencies.forEach((dependency) => {
    switch (dependency.type) {
      case 'visualforce_page':
        deps.add(`VisualforcePage:${dependency.name}`);
        break;
      case 'related_entity':
        deps.add(dependency.name);
        break;
      case 'merge_field':
        if (dependency.objectName) {
          deps.add(dependency.objectName);
        }
        break;
      default:
        break;
    }
  });

  return {
    name: templateName,
    type: 'EmailTemplate' as const,
    filePath,
    dependencies: deps,
    dependents: new Set<string>(),
    priorityBoost: 0,
  };
}

async function parseBotComponent(filePath: string): Promise<MetadataComponent | undefined> {
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

async function parseVisualforceComponent(filePath: string): Promise<MetadataComponent | undefined> {
  const content = await fs.readFile(filePath, 'utf-8');
  const fileName = path.basename(filePath);
  const parsed = parseVisualforce(fileName, content);

  const deps = new Set<string>();
  parsed.dependencies.forEach((dependency) => {
    switch (dependency.type) {
      case 'apex_controller':
      case 'apex_extension':
        deps.add(`ApexClass:${dependency.name}`);
        break;
      case 'standard_controller':
        deps.add(dependency.name);
        break;
      case 'vf_component':
        deps.add(`VisualforceComponent:${dependency.name}`);
        break;
      default:
        break;
    }
  });

  const componentType: 'VisualforcePage' | 'VisualforceComponent' =
    parsed.type === 'page' ? 'VisualforcePage' : 'VisualforceComponent';

  return {
    name: parsed.name,
    type: componentType,
    filePath,
    dependencies: deps,
    dependents: new Set<string>(),
    priorityBoost: 0,
  };
}

async function parseApexClassComponent(
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

async function parseApexTriggerComponent(
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

async function parseLwcComponent(
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

async function parseAuraComponent(
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

const FILE_SCANNERS: FileScanner[] = [
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

const DIRECTORY_SCANNERS: DirectoryScanner[] = [
  {
    pattern: '**/lwc/*',
    parse: parseLwcComponent,
  },
  {
    pattern: '**/aura/*',
    parse: parseAuraComponent,
  },
];

export type ScanOptions = {
  sourcePath?: string;
  includeIgnored?: boolean;
  maxDepth?: number;
};

export type ScanResult = {
  components: MetadataComponent[];
  dependencyResult: DependencyAnalysisResult;
  projectRoot: string;
  executionTime: number;
  errors: string[];
  warnings: string[];
};

/**
 * Metadata file pattern matcher
 * TODO: Use when implementing pattern-based metadata detection
 */
// interface MetadataPattern {
//   type: MetadataType;
//   patterns: string[];
//   isContainer?: boolean; // For LWC, Aura, CustomObject bundles
//   parser?: (filePath: string, content: string, metadataXml?: string) => Promise<MetadataComponent> | MetadataComponent;
// }

/**
 * Metadata Scanner Service
 * Scans project, parses metadata, and builds dependency graph
 */
export class MetadataScannerService {
  private forceIgnoreParser?: ForceIgnoreParser;

  /**
   * Scan project and analyze dependencies
   */
  public async scan(options: ScanOptions = {}): Promise<ScanResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    // Detect project
    const sourcePath = options.sourcePath ?? process.cwd();
    const projectInfo = await SfdxProjectDetector.detect(sourcePath);

    if (!projectInfo.detected) {
      throw new Error(`SFDX project not found in ${sourcePath}`);
    }

    logger.info('Project detected', {
      root: projectInfo.projectRoot,
      packageDirs: projectInfo.packageDirectories.length,
    });

    // Parse .forceignore
    const forceIgnorePath = path.join(projectInfo.projectRoot, '.forceignore');
    if (await this.fileExists(forceIgnorePath)) {
      this.forceIgnoreParser = new ForceIgnoreParser();
      const loadResult = await this.forceIgnoreParser.load(projectInfo.projectRoot);
      logger.info('Loaded .forceignore', {
        rules: loadResult.totalRules,
      });
    }

    // Scan and parse metadata
    const components = await this.scanMetadata(
      projectInfo.projectRoot,
      projectInfo.packageDirectories,
      errors,
      warnings
    );

    // Build dependency graph
    const graphBuilder = new DependencyGraphBuilder();
    for (const component of components) {
      graphBuilder.addComponent(component);
    }
    const dependencyResult = graphBuilder.build();

    const executionTime = Date.now() - startTime;

    logger.info('Scan complete', {
      components: components.length,
      dependencies: dependencyResult.stats.totalDependencies,
      executionTime,
      errors: errors.length,
      warnings: warnings.length,
    });

    return {
      components,
      dependencyResult,
      projectRoot: projectInfo.projectRoot,
      executionTime,
      errors,
      warnings,
    };
  }

  /**
   * Scan metadata files from package directories
   */
  private async scanMetadata(
    projectRoot: string,
    packageDirs: string[],
    errors: string[],
    warnings: string[]
  ): Promise<MetadataComponent[]> {
    const scannedPackages = await Promise.all(
      packageDirs.map(async (packageDir) => {
        const packagePath = path.isAbsolute(packageDir) ? packageDir : path.join(projectRoot, packageDir);
        if (!(await this.fileExists(packagePath))) {
          logger.warn('Package directory not found', { packagePath });
          warnings.push(`Package directory not found: ${packagePath}`);
          return [];
        }

        return this.scanPackageDirectory(packagePath, errors, warnings);
      })
    );

    return scannedPackages.flat();
  }

  /**
   * Scan a package directory for all metadata types
   */
  private async scanPackageDirectory(
    packagePath: string,
    errors: string[],
    warnings: string[]
  ): Promise<MetadataComponent[]> {
    void warnings;
    const componentGroups = await Promise.all([
      this.scanRegisteredFileMetadata(packagePath, errors),
      this.scanRegisteredDirectoryMetadata(packagePath, errors),
      this.scanAutomationMetadata(packagePath, errors),
      this.scanDataMetadata(packagePath, errors),
      this.scanSecurityMetadata(packagePath, errors),
      this.scanExperienceMetadata(packagePath, errors),
      this.scanAIMetadata(packagePath, errors),
    ]);

    return componentGroups.flat();
  }

  private async scanAutomationMetadata(packagePath: string, errors: string[]): Promise<MetadataComponent[]> {
    return this.scanMetadataFiles(packagePath, '**/flows/**/*.flow-meta.xml', errors, 'Flow', async (filePath) => {
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
    });
  }

  private async scanDataMetadata(packagePath: string, errors: string[]): Promise<MetadataComponent[]> {
    const objectComponents = await this.scanMetadataDirectories(
      packagePath,
      '**/objects/*',
      errors,
      'Custom Object',
      async (objectDir) => {
        const objectName = path.basename(objectDir);
        const objectFile = path.join(objectDir, `${objectName}.object-meta.xml`);
        if (!(await this.fileExists(objectFile))) {
          return undefined;
        }

        const content = await fs.readFile(objectFile, 'utf-8');
        const parsed = await parseCustomObject(objectName, content);

        const deps = new Set<string>();
        parsed.dependencies.forEach((dependency) => {
          if (
            (dependency.type === 'lookup_field' || dependency.type === 'master_detail_field') &&
            dependency.referencedObject
          ) {
            deps.add(dependency.referencedObject);
          }
        });

        return {
          name: objectName,
          type: 'CustomObject' as const,
          filePath: objectFile,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        };
      }
    );

    const customMetadataComponents = await this.scanMetadataDirectories(
      packagePath,
      '**/customMetadata/*',
      errors,
      'Custom Metadata Type',
      async (cmtDir) => {
        const typeName = path.basename(cmtDir);
        const typeFile = path.join(cmtDir, `${typeName}.md-meta.xml`);
        if (!(await this.fileExists(typeFile))) {
          return [];
        }

        return parseCustomMetadataComponents(cmtDir);
      },
      (directoryPath) => path.basename(directoryPath)
    );

    return [...objectComponents, ...customMetadataComponents];
  }

  private async scanSecurityMetadata(packagePath: string, errors: string[]): Promise<MetadataComponent[]> {
    const profileComponents = await this.scanMetadataFiles(
      packagePath,
      '**/profiles/**/*.profile-meta.xml',
      errors,
      'Profile',
      parseProfileComponent
    );

    const permissionSetComponents = await this.scanMetadataFiles(
      packagePath,
      '**/permissionsets/**/*.permissionset-meta.xml',
      errors,
      'Permission Set',
      parsePermissionSetComponent
    );

    return [...profileComponents, ...permissionSetComponents];
  }

  private async scanExperienceMetadata(packagePath: string, errors: string[]): Promise<MetadataComponent[]> {
    const flexipageComponents = await this.scanMetadataFiles(
      packagePath,
      '**/flexipages/**/*.flexipage-meta.xml',
      errors,
      'FlexiPage',
      parseFlexiPageComponent
    );

    const layoutComponents = await this.scanMetadataFiles(
      packagePath,
      '**/layouts/**/*.layout-meta.xml',
      errors,
      'Layout',
      parseLayoutComponent
    );

    const emailTemplateComponents = await this.scanMetadataFiles(
      packagePath,
      '**/email/**/*.email-meta.xml',
      errors,
      'Email Template',
      (filePath) => parseEmailTemplateComponent(filePath, this.fileExists.bind(this))
    );

    const visualforceComponents = await Promise.all([
      this.scanMetadataFiles(packagePath, '**/pages/**/*.page', errors, 'Visualforce', parseVisualforceComponent),
      this.scanMetadataFiles(
        packagePath,
        '**/components/**/*.component',
        errors,
        'Visualforce',
        parseVisualforceComponent
      ),
    ]);

    return [...flexipageComponents, ...layoutComponents, ...emailTemplateComponents, ...visualforceComponents.flat()];
  }

  private async scanAIMetadata(packagePath: string, errors: string[]): Promise<MetadataComponent[]> {
    const botComponents = await this.scanMetadataFiles(
      packagePath,
      '**/bots/**/*.bot-meta.xml',
      errors,
      'Bot',
      parseBotComponent
    );

    const genAiPromptComponents = await this.scanMetadataFiles(
      packagePath,
      '**/genaiPromptTemplates/**/*.genAiPromptTemplate-meta.xml',
      errors,
      'GenAI Prompt',
      async (filePath) => {
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
    );

    return [...botComponents, ...genAiPromptComponents];
  }

  private async scanRegisteredFileMetadata(packagePath: string, errors: string[]): Promise<MetadataComponent[]> {
    const context = this.createScannerContext(errors);
    const components = await Promise.all(
      FILE_SCANNERS.flatMap(async (scanner) => {
        const files = await this.findFiles(packagePath, scanner.pattern);
        return Promise.all(
          files
            .filter((filePath) => !this.shouldIgnore(filePath))
            .filter((filePath) => scanner.shouldInclude?.(filePath) ?? true)
            .map((filePath) => scanner.parse(filePath, context))
        );
      })
    );

    return components.flat().filter(isDefined);
  }

  private async scanRegisteredDirectoryMetadata(packagePath: string, errors: string[]): Promise<MetadataComponent[]> {
    const context = this.createScannerContext(errors);
    const components = await Promise.all(
      DIRECTORY_SCANNERS.flatMap(async (scanner) => {
        const directories = await this.findDirectories(packagePath, scanner.pattern);
        return Promise.all(
          directories
            .filter((directoryPath) => !this.shouldIgnore(directoryPath))
            .map((directoryPath) => scanner.parse(directoryPath, context))
        );
      })
    );

    return components.flat().filter(isDefined);
  }

  private async scanMetadataFiles(
    packagePath: string,
    pattern: string,
    errors: string[],
    entityLabel: string,
    parser: (filePath: string) => Promise<MetadataComponent | undefined>
  ): Promise<MetadataComponent[]> {
    const files = await this.findFiles(packagePath, pattern);
    const components = await Promise.all(
      files
        .filter((filePath) => !this.shouldIgnore(filePath))
        .map(async (filePath) => {
          try {
            return await parser(filePath);
          } catch (error) {
            const errorMsg = this.buildScannerError(entityLabel, filePath, error);
            logger.warn(errorMsg);
            errors.push(errorMsg);
            return undefined;
          }
        })
    );

    return components.filter(isDefined);
  }

  private async scanMetadataDirectories(
    packagePath: string,
    pattern: string,
    errors: string[],
    entityLabel: string,
    parser: (directoryPath: string) => Promise<MetadataComponent | MetadataComponent[] | undefined>,
    formatPathForError: (directoryPath: string) => string = (directoryPath): string => directoryPath
  ): Promise<MetadataComponent[]> {
    const directories = await this.findDirectories(packagePath, pattern);
    const components = await Promise.all(
      directories
        .filter((directoryPath) => !this.shouldIgnore(directoryPath))
        .map(async (directoryPath) => {
          try {
            const parsed = await parser(directoryPath);
            if (parsed === undefined) {
              return [];
            }
            return Array.isArray(parsed) ? parsed : [parsed];
          } catch (error) {
            const errorMsg = this.buildScannerError(entityLabel, formatPathForError(directoryPath), error);
            logger.warn(errorMsg);
            errors.push(errorMsg);
            return [];
          }
        })
    );

    return components.flat();
  }

  private buildScannerError(entityLabel: string, location: string, error: unknown): string {
    return `Failed to parse ${entityLabel} ${location}: ${error instanceof Error ? error.message : String(error)}`;
  }

  private createScannerContext(errors: string[]): ScannerContext {
    return {
      fileExists: (filePath) => this.fileExists(filePath),
      shouldIgnore: (filePath) => this.shouldIgnore(filePath),
      readFile: fs.readFile,
      errors,
    };
  }

  /**
   * Find files matching a glob pattern
   */
  private async findFiles(rootPath: string, pattern: string): Promise<string[]> {
    const files = await globAsync(pattern, {
      cwd: rootPath,
      absolute: true,
      posix: false,
      windowsPathsNoEscape: true,
      ignore: ['**/node_modules/**', '**/.git/**'],
    });
    return files;
  }

  /**
   * Find directories matching a glob pattern
   */
  private async findDirectories(rootPath: string, pattern: string): Promise<string[]> {
    const allMatches = await globAsync(pattern, {
      cwd: rootPath,
      absolute: true,
      posix: false,
      windowsPathsNoEscape: true,
      ignore: ['**/node_modules/**', '**/.git/**'],
    });

    const directoryMatches = await Promise.all(
      allMatches.map(async (match) => {
        try {
          const stat = await fs.stat(match);
          return stat.isDirectory() ? match : undefined;
        } catch {
          return undefined;
        }
      })
    );

    return directoryMatches.filter((match): match is string => match !== undefined);
  }

  /**
   * Check if file should be ignored by .forceignore
   */
  private shouldIgnore(filePath: string): boolean {
    if (!this.forceIgnoreParser) {
      return false;
    }
    return this.forceIgnoreParser.isIgnored(filePath);
  }

  /**
   * Check if file/directory exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
