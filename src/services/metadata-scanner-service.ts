/**
 * Metadata Scanner Service
 * Orchestrates project scanning, parsing, and dependency analysis
 *
 * Integrates:
 * - SfdxProjectDetector
 * - ForceIgnoreParser
 * - Metadata parsers
 * - DependencyGraphBuilder
 */

import { getLogger } from '../utils/logger.js';
import { SfdxProjectDetector } from '../scanner/sfdx-project-detector.js';
import { ForceIgnoreParser } from '../scanner/forceignore-parser.js';
import { MetadataFormatScanner } from '../scanner/metadata-format-scanner.js';
import { DependencyGraphBuilder } from '../dependencies/dependency-graph-builder.js';
import { parseApexClass } from '../parsers/apex-class-parser.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { glob } from 'glob';
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
}

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
      await this.forceIgnoreParser.load(forceIgnorePath);
      logger.info('Loaded .forceignore', {
        rules: this.forceIgnoreParser.getRuleCount(),
      });
    }

    // Scan and parse metadata
    const components = await this.scanMetadata(projectInfo.projectRoot, projectInfo.packageDirectories);

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
    });

    return {
      components,
      dependencyResult,
      projectRoot: projectInfo.projectRoot,
      executionTime,
    };
  }

  /**
   * Scan metadata files from package directories
   */
  private async scanMetadata(projectRoot: string, packageDirs: string[]): Promise<MetadataComponent[]> {
    const components: MetadataComponent[] = [];

    for (const packageDir of packageDirs) {
      const packagePath = path.join(projectRoot, packageDir);
      if (!(await this.fileExists(packagePath))) {
        logger.warn('Package directory not found', { packagePath });
        continue;
      }

      // Scan for Apex classes (example - expand to other types)
      const apexFiles = await this.findApexFiles(packagePath);

      for (const filePath of apexFiles) {
        // Check .forceignore
        if (this.forceIgnoreParser && this.forceIgnoreParser.shouldIgnore(filePath)) {
          continue;
        }

        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const parsed = parseApexClass(filePath, content);

          const component: MetadataComponent = {
            name: parsed.className,
            type: 'ApexClass',
            filePath,
            dependencies: new Set<string>(parsed.dependencies.map((d) => d.className)),
            dependents: new Set<string>(),
            priorityBoost: 0,
          };

          components.push(component);
        } catch (error) {
          logger.warn('Failed to parse file', {
            filePath,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return components;
  }

  /**
   * Find Apex class files
   */
  private async findApexFiles(rootPath: string): Promise<string[]> {
    const pattern = path.join(rootPath, '**/*.cls');
    const files = await glob(pattern, {
      ignore: ['**/node_modules/**', '**/.git/**'],
    });

    // Filter out .cls-meta.xml files
    return files.filter((f) => !f.endsWith('.cls-meta.xml'));
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

