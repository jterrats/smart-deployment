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

import * as path from 'node:path';
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
import { CODE_DIRECTORY_SCANNERS, CODE_FILE_SCANNERS } from './scanners/code-metadata-scanner.js';
import { parseCustomMetadataComponents, parseCustomObjectComponent } from './scanners/data-metadata-scanner.js';
import {
  parseEmailTemplateComponent,
  parseFlexiPageComponent,
  parseLayoutComponent,
  parseVisualforceComponent,
} from './scanners/experience-metadata-scanner.js';
import {
  fileExists,
  scanMetadataDirectories,
  scanMetadataFiles,
  scanRegisteredDirectoryMetadata,
  scanRegisteredFileMetadata,
} from './scanners/scanner-runtime.js';
import { parsePermissionSetComponent, parseProfileComponent } from './scanners/security-metadata-scanner.js';

const logger = getLogger('MetadataScannerService');

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
  private readonly shouldIgnorePath = (filePath: string): boolean => this.shouldIgnore(filePath);

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
    if (await fileExists(forceIgnorePath)) {
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
        if (!(await fileExists(packagePath))) {
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
    return scanMetadataFiles(
      packagePath,
      '**/flows/**/*.flow-meta.xml',
      errors,
      'Flow',
      this.shouldIgnorePath,
      parseFlowComponent
    );
  }

  private async scanDataMetadata(packagePath: string, errors: string[]): Promise<MetadataComponent[]> {
    const objectComponents = await scanMetadataDirectories(
      packagePath,
      '**/objects/*',
      errors,
      'Custom Object',
      this.shouldIgnorePath,
      parseCustomObjectComponent
    );

    const customMetadataComponents = await scanMetadataDirectories(
      packagePath,
      '**/customMetadata/*',
      errors,
      'Custom Metadata Type',
      this.shouldIgnorePath,
      async (cmtDir) => {
        const typeName = path.basename(cmtDir);
        const typeFile = path.join(cmtDir, `${typeName}.md-meta.xml`);
        if (!(await fileExists(typeFile))) {
          return [];
        }

        return parseCustomMetadataComponents(cmtDir);
      },
      (directoryPath) => path.basename(directoryPath)
    );

    return [...objectComponents, ...customMetadataComponents];
  }

  private async scanSecurityMetadata(packagePath: string, errors: string[]): Promise<MetadataComponent[]> {
    const profileComponents = await scanMetadataFiles(
      packagePath,
      '**/profiles/**/*.profile-meta.xml',
      errors,
      'Profile',
      this.shouldIgnorePath,
      parseProfileComponent
    );

    const permissionSetComponents = await scanMetadataFiles(
      packagePath,
      '**/permissionsets/**/*.permissionset-meta.xml',
      errors,
      'Permission Set',
      this.shouldIgnorePath,
      parsePermissionSetComponent
    );

    return [...profileComponents, ...permissionSetComponents];
  }

  private async scanExperienceMetadata(packagePath: string, errors: string[]): Promise<MetadataComponent[]> {
    const flexipageComponents = await scanMetadataFiles(
      packagePath,
      '**/flexipages/**/*.flexipage-meta.xml',
      errors,
      'FlexiPage',
      this.shouldIgnorePath,
      parseFlexiPageComponent
    );

    const layoutComponents = await scanMetadataFiles(
      packagePath,
      '**/layouts/**/*.layout-meta.xml',
      errors,
      'Layout',
      this.shouldIgnorePath,
      parseLayoutComponent
    );

    const emailTemplateComponents = await scanMetadataFiles(
      packagePath,
      '**/email/**/*.email-meta.xml',
      errors,
      'Email Template',
      this.shouldIgnorePath,
      (filePath) => parseEmailTemplateComponent(filePath, fileExists)
    );

    const visualforceComponents = await Promise.all([
      scanMetadataFiles(
        packagePath,
        '**/pages/**/*.page',
        errors,
        'Visualforce',
        this.shouldIgnorePath,
        parseVisualforceComponent
      ),
      scanMetadataFiles(
        packagePath,
        '**/components/**/*.component',
        errors,
        'Visualforce',
        this.shouldIgnorePath,
        parseVisualforceComponent
      ),
    ]);

    return [...flexipageComponents, ...layoutComponents, ...emailTemplateComponents, ...visualforceComponents.flat()];
  }

  private async scanAIMetadata(packagePath: string, errors: string[]): Promise<MetadataComponent[]> {
    const botComponents = await scanMetadataFiles(
      packagePath,
      '**/bots/**/*.bot-meta.xml',
      errors,
      'Bot',
      this.shouldIgnorePath,
      parseBotComponent
    );

    const genAiPromptComponents = await scanMetadataFiles(
      packagePath,
      '**/genaiPromptTemplates/**/*.genAiPromptTemplate-meta.xml',
      errors,
      'GenAI Prompt',
      this.shouldIgnorePath,
      parseGenAiPromptComponent
    );

    return [...botComponents, ...genAiPromptComponents];
  }

  private async scanRegisteredFileMetadata(packagePath: string, errors: string[]): Promise<MetadataComponent[]> {
    return scanRegisteredFileMetadata(packagePath, errors, this.shouldIgnorePath, CODE_FILE_SCANNERS);
  }

  private async scanRegisteredDirectoryMetadata(packagePath: string, errors: string[]): Promise<MetadataComponent[]> {
    return scanRegisteredDirectoryMetadata(packagePath, errors, this.shouldIgnorePath, CODE_DIRECTORY_SCANNERS);
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
}
