/**
 * SFDX Project Detector - US-079
 * Detects and validates Salesforce DX project structure
 *
 * @ac US-079-AC-1: Detect sfdx-project.json
 * @ac US-079-AC-2: Parse project configuration
 * @ac US-079-AC-3: Validate project structure
 * @ac US-079-AC-4: Detect package directories
 * @ac US-079-AC-5: Support multi-package projects
 * @ac US-079-AC-6: Report project metadata
 * @issue #79
 */

import { readFile, access } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('SfdxProjectDetector');

export interface SfdxProjectJson {
  packageDirectories: PackageDirectory[];
  namespace?: string;
  sourceApiVersion: string;
  sfdcLoginUrl?: string;
  plugins?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PackageDirectory {
  path: string;
  default?: boolean;
  package?: string;
  versionName?: string;
  versionNumber?: string;
  dependencies?: PackageDependency[];
}

export interface PackageDependency {
  package: string;
  versionNumber: string;
}

export interface ProjectDetectionResult {
  detected: boolean;
  projectRoot: string;
  projectFile: string;
  projectConfig?: SfdxProjectJson;
  packageDirectories: string[];
  defaultPackageDirectory?: string;
  isMultiPackage: boolean;
  apiVersion: string;
  namespace?: string;
  errors: string[];
  warnings: string[];
}

/**
 * @ac US-079-AC-1: Detect sfdx-project.json
 * @ac US-079-AC-2: Parse project configuration
 */
export class SfdxProjectDetector {
  private static readonly PROJECT_FILE_NAME = 'sfdx-project.json';
  private static readonly MAX_SEARCH_DEPTH = 5;

  /**
   * Detect SFDX project starting from a given directory
   * Searches up the directory tree until finding sfdx-project.json
   */
  public static async detect(startPath: string): Promise<ProjectDetectionResult> {
    logger.info('Detecting SFDX project', { startPath });

    const result: ProjectDetectionResult = {
      detected: false,
      projectRoot: '',
      projectFile: '',
      packageDirectories: [],
      isMultiPackage: false,
      apiVersion: '',
      errors: [],
      warnings: [],
    };

    try {
      // Search for sfdx-project.json
      const projectFile = await this.findProjectFile(startPath);

      if (!projectFile) {
        result.errors.push('sfdx-project.json not found');
        logger.warn('SFDX project not detected', { startPath });
        return result;
      }

      result.detected = true;
      result.projectFile = projectFile;
      result.projectRoot = dirname(projectFile);

      // Parse and validate project configuration
      const projectConfig = await this.parseProjectFile(projectFile);
      result.projectConfig = projectConfig;
      result.apiVersion = projectConfig.sourceApiVersion;
      result.namespace = projectConfig.namespace;

      // Extract package directories
      const validation = this.validateProjectStructure(projectConfig, result.projectRoot);
      result.packageDirectories = validation.packagePaths;
      result.defaultPackageDirectory = validation.defaultPath;
      result.isMultiPackage = validation.isMultiPackage;
      result.errors.push(...validation.errors);
      result.warnings.push(...validation.warnings);

      logger.info('SFDX project detected', {
        projectRoot: result.projectRoot,
        packages: result.packageDirectories.length,
        apiVersion: result.apiVersion,
      });

      return result;
    } catch (error) {
      result.errors.push(`Detection failed: ${error instanceof Error ? error.message : String(error)}`);
      logger.error('Project detection failed', { error, startPath });
      return result;
    }
  }

  /**
   * @ac US-079-AC-1: Detect sfdx-project.json
   * Search up the directory tree for sfdx-project.json
   */
  private static async findProjectFile(startPath: string): Promise<string | null> {
    let currentPath = resolve(startPath);
    let depth = 0;

    while (depth < this.MAX_SEARCH_DEPTH) {
      const projectFilePath = join(currentPath, this.PROJECT_FILE_NAME);

      try {
        await access(projectFilePath);
        logger.debug('Found sfdx-project.json', { path: projectFilePath });
        return projectFilePath;
      } catch {
        // File doesn't exist, continue searching
      }

      const parentPath = dirname(currentPath);
      if (parentPath === currentPath) {
        // Reached filesystem root
        break;
      }

      currentPath = parentPath;
      depth++;
    }

    return null;
  }

  /**
   * @ac US-079-AC-2: Parse project configuration
   */
  private static async parseProjectFile(filePath: string): Promise<SfdxProjectJson> {
    logger.debug('Parsing sfdx-project.json', { filePath });

    try {
      const content = await readFile(filePath, 'utf-8');
      const config = JSON.parse(content) as SfdxProjectJson;

      // Validate required fields
      if (!config.packageDirectories || !Array.isArray(config.packageDirectories)) {
        throw new Error('Missing or invalid packageDirectories');
      }

      if (!config.sourceApiVersion) {
        throw new Error('Missing sourceApiVersion');
      }

      return config;
    } catch (error) {
      throw new Error(`Failed to parse sfdx-project.json: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * @ac US-079-AC-3: Validate project structure
   * @ac US-079-AC-4: Detect package directories
   * @ac US-079-AC-5: Support multi-package projects
   */
  private static validateProjectStructure(
    config: SfdxProjectJson,
    projectRoot: string
  ): {
    packagePaths: string[];
    defaultPath?: string;
    isMultiPackage: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const packagePaths: string[] = [];
    let defaultPath: string | undefined;

    // Validate package directories
    if (config.packageDirectories.length === 0) {
      errors.push('No package directories defined');
    }

    let defaultCount = 0;

    for (const pkgDir of config.packageDirectories) {
      if (!pkgDir.path) {
        errors.push('Package directory missing path');
        continue;
      }

      const fullPath = resolve(projectRoot, pkgDir.path);
      packagePaths.push(fullPath);

      if (pkgDir.default) {
        defaultCount++;
        defaultPath = fullPath;
      }
    }

    // Validate default package
    if (defaultCount === 0) {
      warnings.push('No default package directory specified');
      // Use first package as default
      if (packagePaths.length > 0) {
        defaultPath = packagePaths[0];
      }
    } else if (defaultCount > 1) {
      errors.push('Multiple default package directories found');
    }

    // Check if multi-package
    const isMultiPackage = config.packageDirectories.length > 1;

    if (isMultiPackage) {
      logger.info('Multi-package project detected', {
        packages: config.packageDirectories.length,
      });
    }

    return {
      packagePaths,
      defaultPath,
      isMultiPackage,
      errors,
      warnings,
    };
  }

  /**
   * @ac US-079-AC-6: Report project metadata
   */
  public static formatDetectionReport(result: ProjectDetectionResult): string {
    const lines: string[] = [];

    lines.push('📦 SFDX Project Detection Report');
    lines.push('═══════════════════════════════════════');

    if (!result.detected) {
      lines.push('❌ No SFDX project detected');
      if (result.errors.length > 0) {
        lines.push('\nErrors:');
        for (const error of result.errors) {
          lines.push(`  • ${error}`);
        }
      }
      return lines.join('\n');
    }

    lines.push(`✅ Project detected`);
    lines.push(`   Root: ${result.projectRoot}`);
    lines.push(`   Config: ${result.projectFile}`);
    lines.push('');

    lines.push('📋 Configuration:');
    lines.push(`   API Version: ${result.apiVersion}`);
    if (result.namespace) {
      lines.push(`   Namespace: ${result.namespace}`);
    }
    lines.push(`   Multi-Package: ${result.isMultiPackage ? 'Yes' : 'No'}`);
    lines.push('');

    lines.push(`📂 Package Directories (${result.packageDirectories.length}):`);
    for (let i = 0; i < result.packageDirectories.length; i++) {
      const pkgPath = result.packageDirectories[i];
      const isDefault = pkgPath === result.defaultPackageDirectory;
      lines.push(`   ${i + 1}. ${pkgPath}${isDefault ? ' (default)' : ''}`);
    }

    if (result.warnings.length > 0) {
      lines.push('');
      lines.push('⚠️  Warnings:');
      for (const warning of result.warnings) {
        lines.push(`   • ${warning}`);
      }
    }

    if (result.errors.length > 0) {
      lines.push('');
      lines.push('❌ Errors:');
      for (const error of result.errors) {
        lines.push(`   • ${error}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Check if a path is within an SFDX project
   */
  public static async isInProject(path: string): Promise<boolean> {
    const result = await this.detect(path);
    return result.detected;
  }

  /**
   * Get project root for a given path
   */
  public static async getProjectRoot(path: string): Promise<string | null> {
    const result = await this.detect(path);
    return result.detected ? result.projectRoot : null;
  }
}
