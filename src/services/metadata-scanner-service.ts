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
import { ForceIgnoreParser } from '../scanner/forceignore-parser.js';
import { SfdxProjectDetector } from '../scanner/sfdx-project-detector.js';
import type { MetadataComponent } from '../types/metadata.js';
import type { DependencyAnalysisResult } from '../types/dependency.js';
import { getLogger } from '../utils/logger.js';
import {
  parseBotComponent,
  parseFlowComponent,
  parseGenAiPromptComponent,
} from './scanners/automation-ai-metadata-scanner.js';
import { CODE_DIRECTORY_SCANNERS, CODE_FILE_SCANNERS, type ScannerContext } from './scanners/code-metadata-scanner.js';
import { parseCustomMetadataComponents, parseCustomObjectComponent } from './scanners/data-metadata-scanner.js';
import {
  parseEmailTemplateComponent,
  parseFlexiPageComponent,
  parseLayoutComponent,
  parseVisualforceComponent,
} from './scanners/experience-metadata-scanner.js';
import { parsePermissionSetComponent, parseProfileComponent } from './scanners/security-metadata-scanner.js';

const logger = getLogger('MetadataScannerService');

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

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
    return this.scanMetadataFiles(packagePath, '**/flows/**/*.flow-meta.xml', errors, 'Flow', parseFlowComponent);
  }

  private async scanDataMetadata(packagePath: string, errors: string[]): Promise<MetadataComponent[]> {
    const objectComponents = await this.scanMetadataDirectories(
      packagePath,
      '**/objects/*',
      errors,
      'Custom Object',
      parseCustomObjectComponent
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
      parseGenAiPromptComponent
    );

    return [...botComponents, ...genAiPromptComponents];
  }

  private async scanRegisteredFileMetadata(packagePath: string, errors: string[]): Promise<MetadataComponent[]> {
    const context = this.createScannerContext(errors);
    const components = await Promise.all(
      CODE_FILE_SCANNERS.flatMap(async (scanner) => {
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
      CODE_DIRECTORY_SCANNERS.flatMap(async (scanner) => {
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
