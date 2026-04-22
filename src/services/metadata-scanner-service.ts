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

import { getLogger } from '../utils/logger.js';
import { SfdxProjectDetector } from '../scanner/sfdx-project-detector.js';
import { ForceIgnoreParser } from '../scanner/forceignore-parser.js';
import { DependencyGraphBuilder } from '../dependencies/dependency-graph-builder.js';
import { parseApexClass } from '../parsers/apex-class-parser.js';
import { parseApexTrigger } from '../parsers/apex-trigger-parser.js';
import { parseLWC } from '../parsers/lwc-parser.js';
import { parseAura } from '../parsers/aura-parser.js';
import { parseFlow } from '../parsers/flow-parser.js';
import { parseCustomObject } from '../parsers/custom-object-parser.js';
import { parseCustomMetadataType } from '../parsers/custom-metadata-parser.js';
// import { parseCustomMetadataRecord } from '../parsers/custom-metadata-parser.js'; // TODO: Use when implementing CMT record parsing
import { parseEmailTemplate } from '../parsers/email-template-parser.js';
import { parseFlexiPage } from '../parsers/flexipage-parser.js';
import { parseLayout } from '../parsers/layout-parser.js';
import { parseProfile } from '../parsers/profile-parser.js';
import { parsePermissionSet } from '../parsers/permission-set-parser.js';
import { parseBot } from '../parsers/bot-parser.js';
import { parseGenAiPrompt } from '../parsers/genai-prompt-parser.js';
import { parseVisualforce } from '../parsers/visualforce-parser.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { glob as globAsync } from 'glob';
import type { MetadataComponent } from '../types/metadata.js';
import type { DependencyAnalysisResult } from '../types/dependency.js';

const logger = getLogger('MetadataScannerService');

export interface ScanOptions {
  sourcePath?: string;
  includeIgnored?: boolean;
  maxDepth?: number;
}

export interface ScanResult {
  components: MetadataComponent[];
  dependencyResult: DependencyAnalysisResult;
  projectRoot: string;
  executionTime: number;
  errors: string[];
  warnings: string[];
}

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
    const sourcePath = options.sourcePath || process.cwd();
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
    const components = await this.scanMetadata(projectInfo.projectRoot, projectInfo.packageDirectories, errors, warnings);

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
    const components: MetadataComponent[] = [];

    for (const packageDir of packageDirs) {
      const packagePath = path.isAbsolute(packageDir) ? packageDir : path.join(projectRoot, packageDir);
      if (!(await this.fileExists(packagePath))) {
        logger.warn('Package directory not found', { packagePath });
        warnings.push(`Package directory not found: ${packagePath}`);
        continue;
      }

      // Scan all metadata types
      const scanned = await this.scanPackageDirectory(packagePath, errors, warnings);
      components.push(...scanned);
    }

    return components;
  }

  /**
   * Scan a package directory for all metadata types
   */
  private async scanPackageDirectory(
    packagePath: string,
    errors: string[],
    warnings: string[]
  ): Promise<MetadataComponent[]> {
    const components: MetadataComponent[] = [];

    // Scan Apex Classes
    const apexFiles = await this.findFiles(packagePath, '**/classes/**/*.cls');
    for (const filePath of apexFiles) {
      if (this.shouldIgnore(filePath)) continue;
      if (filePath.endsWith('.cls-meta.xml')) continue;

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = parseApexClass(filePath, content);

        components.push({
          name: parsed.className,
          type: 'ApexClass',
          filePath,
          dependencies: new Set<string>(parsed.dependencies.map((d) => d.className)),
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Apex class ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan Apex Triggers
    const triggerFiles = await this.findFiles(packagePath, '**/triggers/**/*.trigger');
    for (const filePath of triggerFiles) {
      if (this.shouldIgnore(filePath)) continue;
      if (filePath.endsWith('.trigger-meta.xml')) continue;

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = parseApexTrigger(filePath, content);

        components.push({
          name: parsed.triggerName,
          type: 'ApexTrigger',
          filePath,
          dependencies: new Set<string>(parsed.dependencies.map((d) => d.className)),
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Apex trigger ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan LWC Components (container-based)
    const lwcDirs = await this.findDirectories(packagePath, '**/lwc/*');
    for (const lwcDir of lwcDirs) {
      if (this.shouldIgnore(lwcDir)) continue;

      const componentName = path.basename(lwcDir);
      const jsFile = path.join(lwcDir, `${componentName}.js`);
      const tsFile = path.join(lwcDir, `${componentName}.ts`);
      const metaFile = path.join(lwcDir, `${componentName}.js-meta.xml`);

      const codeFile = (await this.fileExists(jsFile)) ? jsFile : (await this.fileExists(tsFile)) ? tsFile : null;
      if (!codeFile) continue;

      try {
        const jsContent = await fs.readFile(codeFile, 'utf-8');
        const metaContent = (await this.fileExists(metaFile)) ? await fs.readFile(metaFile, 'utf-8') : undefined;
        const parsed = parseLWC(componentName, jsContent, metaContent);

        components.push({
          name: componentName,
          type: 'LightningComponentBundle',
          filePath: codeFile,
          dependencies: new Set<string>([
            ...parsed.apexImports,
            ...parsed.lwcImports.map((imp) => `c:${imp}`),
          ]),
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse LWC ${componentName}: ${error instanceof Error ? error.message : String(error)}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan Aura Components (container-based)
    const auraDirs = await this.findDirectories(packagePath, '**/aura/*');
    for (const auraDir of auraDirs) {
      if (this.shouldIgnore(auraDir)) continue;

      const componentName = path.basename(auraDir);
      const cmpFile = path.join(auraDir, `${componentName}.cmp`);
      if (!(await this.fileExists(cmpFile))) continue;

      try {
        const cmpContent = await fs.readFile(cmpFile, 'utf-8');
        const parsed = parseAura(componentName, cmpContent);

        const deps = new Set<string>();
        if (parsed.apexController) deps.add(parsed.apexController);
        if (parsed.extendsComponent) deps.add(parsed.extendsComponent);
        parsed.implementsInterfaces.forEach((i) => deps.add(i));
        parsed.childComponents.forEach((c) => deps.add(`c:${c}`));

        components.push({
          name: componentName,
          type: 'AuraDefinitionBundle',
          filePath: cmpFile,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Aura component ${componentName}: ${error instanceof Error ? error.message : String(error)}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan Flows
    const flowFiles = await this.findFiles(packagePath, '**/flows/**/*.flow-meta.xml');
    for (const filePath of flowFiles) {
      if (this.shouldIgnore(filePath)) continue;

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = parseFlow(filePath, content);

        const deps = new Set<string>();
        parsed.dependencies.forEach((d) => {
          if (d.type === 'apex_action' || d.type === 'subflow') {
            deps.add(d.name);
          }
        });

        components.push({
          name: parsed.flowName,
          type: 'Flow',
          filePath,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Flow ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan Custom Objects
    const objectDirs = await this.findDirectories(packagePath, '**/objects/*');
    for (const objectDir of objectDirs) {
      if (this.shouldIgnore(objectDir)) continue;

      const objectName = path.basename(objectDir);
      const objectFile = path.join(objectDir, `${objectName}.object-meta.xml`);
      if (!(await this.fileExists(objectFile))) continue;

      try {
        const content = await fs.readFile(objectFile, 'utf-8');
        const parsed = await parseCustomObject(objectName, content);

        const deps = new Set<string>();
        parsed.dependencies.forEach((d) => {
          if (d.type === 'lookup_field' || d.type === 'master_detail_field') {
            deps.add(d.referencedObject || '');
          }
        });

        components.push({
          name: objectName,
          type: 'CustomObject',
          filePath: objectFile,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Custom Object ${objectName}: ${error instanceof Error ? error.message : String(error)}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan Custom Metadata Types
    const cmtDirs = await this.findDirectories(packagePath, '**/customMetadata/*');
    for (const cmtDir of cmtDirs) {
      if (this.shouldIgnore(cmtDir)) continue;

      const typeName = path.basename(cmtDir);
      const typeFile = path.join(cmtDir, `${typeName}.md-meta.xml`);
      if (!(await this.fileExists(typeFile))) continue;

      try {
        const content = await fs.readFile(typeFile, 'utf-8');
        await parseCustomMetadataType(typeName, content);

        components.push({
          name: typeName,
          type: 'CustomMetadata',
          filePath: typeFile,
          dependencies: new Set<string>(),
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Custom Metadata Type ${typeName}: ${error instanceof Error ? error.message : String(error)}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan Profiles
    const profileFiles = await this.findFiles(packagePath, '**/profiles/**/*.profile-meta.xml');
    for (const filePath of profileFiles) {
      if (this.shouldIgnore(filePath)) continue;

      try {
        const profileName = path.basename(filePath, '.profile-meta.xml');
        const parsed = await parseProfile(filePath, profileName);

        const deps = new Set<string>();
        parsed.objectPermissions.forEach((op: string) => deps.add(op));
        parsed.apexClassAccesses.forEach((ac: string) => deps.add(ac));
        parsed.layoutAssignments.forEach((pl: string) => deps.add(pl));

        components.push({
          name: profileName,
          type: 'Profile',
          filePath,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Profile ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan Permission Sets
    const permSetFiles = await this.findFiles(packagePath, '**/permissionsets/**/*.permissionset-meta.xml');
    for (const filePath of permSetFiles) {
      if (this.shouldIgnore(filePath)) continue;

      try {
        const permSetName = path.basename(filePath, '.permissionset-meta.xml');
        const parsed = await parsePermissionSet(filePath, permSetName);

        const deps = new Set<string>();
        parsed.objectPermissions.forEach((op: string) => deps.add(op));
        parsed.apexClassAccesses.forEach((ac: string) => deps.add(ac));
        parsed.customPermissions.forEach((cp: string) => deps.add(cp));

        components.push({
          name: permSetName,
          type: 'PermissionSet',
          filePath,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Permission Set ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan FlexiPages
    const flexipageFiles = await this.findFiles(packagePath, '**/flexipages/**/*.flexipage-meta.xml');
    for (const filePath of flexipageFiles) {
      if (this.shouldIgnore(filePath)) continue;

      try {
        const flexipageName = path.basename(filePath, '.flexipage-meta.xml');
        const parsed = await parseFlexiPage(filePath, flexipageName);

        const deps = new Set<string>();
        parsed.lwcComponents.forEach((c) => deps.add(`c:${c}`));
        parsed.auraComponents.forEach((c) => deps.add(`c:${c}`));
        parsed.objects.forEach((o) => deps.add(o));

        components.push({
          name: flexipageName,
          type: 'FlexiPage',
          filePath,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse FlexiPage ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan Layouts
    const layoutFiles = await this.findFiles(packagePath, '**/layouts/**/*.layout-meta.xml');
    for (const filePath of layoutFiles) {
      if (this.shouldIgnore(filePath)) continue;

      try {
        const layoutName = path.basename(filePath, '.layout-meta.xml');
        const parsed = await parseLayout(filePath, layoutName);

        const deps = new Set<string>();
        deps.add(parsed.object);
        parsed.customButtons.forEach((b) => deps.add(b));
        parsed.visualforcePages.forEach((v) => deps.add(v));

        components.push({
          name: layoutName,
          type: 'Layout',
          filePath,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Layout ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan Email Templates
    const emailTemplateFiles = await this.findFiles(packagePath, '**/email/**/*.email-meta.xml');
    for (const filePath of emailTemplateFiles) {
      if (this.shouldIgnore(filePath)) continue;

      try {
        const templateName = path.basename(filePath, '.email-meta.xml');
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = await parseEmailTemplate(templateName, content, content);

        const deps = new Set<string>();
        parsed.dependencies.forEach((d) => {
          if (d.type === 'visualforce_page') {
            deps.add(d.name);
          }
        });

        components.push({
          name: templateName,
          type: 'EmailTemplate',
          filePath,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Email Template ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan Bots
    const botFiles = await this.findFiles(packagePath, '**/bots/**/*.bot-meta.xml');
    for (const filePath of botFiles) {
      if (this.shouldIgnore(filePath)) continue;

      try {
        const botName = path.basename(filePath, '.bot-meta.xml');
        const parsed = await parseBot(filePath, botName);

        const deps = new Set<string>();
        parsed.flows.forEach((f) => deps.add(f));
        parsed.apexActions.forEach((a) => deps.add(a));
        parsed.genAiPrompts.forEach((g) => deps.add(g));

        components.push({
          name: botName,
          type: 'Bot',
          filePath,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Bot ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan GenAI Prompts
    const genaiFiles = await this.findFiles(packagePath, '**/genaiPromptTemplates/**/*.genAiPromptTemplate-meta.xml');
    for (const filePath of genaiFiles) {
      if (this.shouldIgnore(filePath)) continue;

      try {
        const promptName = path.basename(filePath, '.genAiPromptTemplate-meta.xml');
        const parsed = await parseGenAiPrompt(filePath, promptName);

        const deps = new Set<string>();
        parsed.sobjects.forEach((o: string) => deps.add(o));
        parsed.dependencies.sobjects.forEach((o: string) => deps.add(o));

        components.push({
          name: promptName,
          type: 'GenAiPromptTemplate',
          filePath,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse GenAI Prompt ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Scan Visualforce Pages/Components
    const vfPageFiles = await this.findFiles(packagePath, '**/pages/**/*.page');
    const vfComponentFiles = await this.findFiles(packagePath, '**/components/**/*.component');
    for (const filePath of [...vfPageFiles, ...vfComponentFiles]) {
      if (this.shouldIgnore(filePath)) continue;

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const fileName = path.basename(filePath);
        const parsed = parseVisualforce(fileName, content);

        const deps = new Set<string>();
        parsed.dependencies.forEach((d) => {
          if (d.type === 'apex_controller' || d.type === 'apex_extension') {
            deps.add(d.name);
          }
        });

        components.push({
          name: parsed.name,
          type: parsed.type === 'page' ? 'VisualforcePage' : 'VisualforceComponent',
          filePath,
          dependencies: deps,
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      } catch (error) {
        const errorMsg = `Failed to parse Visualforce ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      }
    }

    return components;
  }

  /**
   * Find files matching a glob pattern
   */
  private async findFiles(rootPath: string, pattern: string): Promise<string[]> {
    const fullPattern = path.join(rootPath, pattern);
    const files = await globAsync(fullPattern, {
      ignore: ['**/node_modules/**', '**/.git/**'],
    });
    return files;
  }

  /**
   * Find directories matching a glob pattern
   */
  private async findDirectories(rootPath: string, pattern: string): Promise<string[]> {
    const fullPattern = path.join(rootPath, pattern);
    const allMatches = await globAsync(fullPattern, {
      ignore: ['**/node_modules/**', '**/.git/**'],
    });
    
    // Filter to only directories
    const dirs: string[] = [];
    for (const match of allMatches) {
      try {
        const stat = await fs.stat(match);
        if (stat.isDirectory()) {
          dirs.push(match);
        }
      } catch {
        // Skip if stat fails (file doesn't exist, etc.)
      }
    }
    return dirs;
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
