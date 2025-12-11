/**
 * Metadata API Format Scanner - US-080
 * Supports legacy Metadata API format (package.xml + src/)
 *
 * @ac US-080-AC-1: Detect package.xml
 * @ac US-080-AC-2: Scan src/ directory
 * @ac US-080-AC-3: Parse metadata format files
 * @ac US-080-AC-4: Convert to source format internally
 * @ac US-080-AC-5: Handle Documents folder structure
 * @ac US-080-AC-6: Handle DigitalExperience bundles
 * @issue #80
 */

import * as fs from 'fs';
import * as path from 'path';
import { getLogger } from '../utils/logger.js';
import { ErrorAggregator } from '../utils/error-aggregator.js';
import type { MetadataComponent, MetadataType } from '../types/metadata.js';

const logger = getLogger('MetadataFormatScanner');

export interface MetadataFormatScanResult {
  format: 'metadata-api' | 'source-format' | 'mixed';
  packageXmlPath?: string;
  srcDirectory?: string;
  components: MetadataComponent[];
  warnings: string[];
  executionTime: number;
}

export interface PackageXmlEntry {
  name: string;
  type: string;
}

/**
 * @ac US-080-AC-1: Detect package.xml
 * @ac US-080-AC-2: Scan src/ directory
 */
export class MetadataFormatScanner {
  private readonly errorAggregator = new ErrorAggregator();

  /**
   * @ac US-080-AC-1: Detect package.xml
   * Check if project uses Metadata API format
   */
  public detectFormat(projectRoot: string): 'metadata-api' | 'source-format' | 'mixed' {
    const hasPackageXml = fs.existsSync(path.join(projectRoot, 'package.xml'));
    const hasSrcDir = fs.existsSync(path.join(projectRoot, 'src'));
    const hasSfdxProject = fs.existsSync(path.join(projectRoot, 'sfdx-project.json'));

    logger.info('Detecting project format', {
      hasPackageXml,
      hasSrcDir,
      hasSfdxProject,
    });

    if (hasPackageXml && hasSrcDir && !hasSfdxProject) {
      return 'metadata-api';
    }

    if (hasSfdxProject && !hasPackageXml) {
      return 'source-format';
    }

    if (hasPackageXml && hasSfdxProject) {
      return 'mixed';
    }

    return 'source-format'; // Default
  }

  /**
   * @ac US-080-AC-2: Scan src/ directory
   * Scan Metadata API format project
   */
  public async scan(projectRoot: string): Promise<MetadataFormatScanResult> {
    const startTime = Date.now();

    const result: MetadataFormatScanResult = {
      format: this.detectFormat(projectRoot),
      components: [],
      warnings: [],
      executionTime: 0,
    };

    if (result.format !== 'metadata-api' && result.format !== 'mixed') {
      result.warnings.push('Project is not in Metadata API format');
      result.executionTime = Date.now() - startTime;
      return result;
    }

    try {
      // Find package.xml
      const packageXmlPath = path.join(projectRoot, 'package.xml');
      if (fs.existsSync(packageXmlPath)) {
        result.packageXmlPath = packageXmlPath;
        const packageEntries = await this.parsePackageXml(packageXmlPath);
        logger.info('Parsed package.xml', { entries: packageEntries.length });
      }

      // Scan src/ directory
      const srcDir = path.join(projectRoot, 'src');
      if (fs.existsSync(srcDir)) {
        result.srcDirectory = srcDir;
        const components = await this.scanSrcDirectory(srcDir);
        result.components = components;
        logger.info('Scanned src/ directory', { components: components.length });
      }

      result.executionTime = Date.now() - startTime;

      logger.info('Metadata format scan complete', {
        format: result.format,
        components: result.components.length,
        executionTime: result.executionTime,
      });

      return result;
    } catch (error) {
      this.errorAggregator.addError({
        severity: 'HIGH',
        message: 'Failed to scan Metadata API format',
        context: { error: error instanceof Error ? error.message : String(error) },
      });

      result.warnings.push('Scan failed: ' + (error instanceof Error ? error.message : String(error)));
      result.executionTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * @ac US-080-AC-3: Parse metadata format files
   * Parse package.xml
   */
  private async parsePackageXml(packageXmlPath: string): Promise<PackageXmlEntry[]> {
    try {
      const content = fs.readFileSync(packageXmlPath, 'utf-8');
      const entries: PackageXmlEntry[] = [];

      // Simple XML parsing for <types> elements
      const typeBlocks = content.match(/<types>[\s\S]*?<\/types>/g) || [];

      for (const block of typeBlocks) {
        const typeMatch = /<name>(.*?)<\/name>/.exec(block);
        const memberMatches = block.match(/<members>(.*?)<\/members>/g) || [];

        if (typeMatch) {
          const type = typeMatch[1];
          for (const memberMatch of memberMatches) {
            const nameMatch = /<members>(.*?)<\/members>/.exec(memberMatch);
            if (nameMatch) {
              entries.push({
                type,
                name: nameMatch[1],
              });
            }
          }
        }
      }

      logger.debug('Parsed package.xml', { entries: entries.length });
      return entries;
    } catch (error) {
      logger.error('Failed to parse package.xml', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * @ac US-080-AC-2: Scan src/ directory
   * @ac US-080-AC-4: Convert to source format internally
   * Scan Metadata API src/ directory
   */
  private async scanSrcDirectory(srcDir: string): Promise<MetadataComponent[]> {
    const components: MetadataComponent[] = [];

    try {
      const entries = fs.readdirSync(srcDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const typeDir = path.join(srcDir, entry.name);
        const metadataType = this.mapDirectoryToType(entry.name);

        if (!metadataType) {
          logger.debug('Unknown metadata type directory', { dir: entry.name });
          continue;
        }

        // Scan files in type directory
        const typeComponents = await this.scanTypeDirectory(typeDir, metadataType);
        components.push(...typeComponents);
      }

      return components;
    } catch (error) {
      logger.error('Failed to scan src/ directory', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * @ac US-080-AC-3: Parse metadata format files
   * Scan specific metadata type directory
   */
  private async scanTypeDirectory(
    typeDir: string,
    metadataType: MetadataType
  ): Promise<MetadataComponent[]> {
    const components: MetadataComponent[] = [];

    try {
      const files = fs.readdirSync(typeDir);

      for (const file of files) {
        // Skip meta.xml files
        if (file.endsWith('-meta.xml')) continue;

        const filePath = path.join(typeDir, file);
        const stat = fs.statSync(filePath);

        if (stat.isFile()) {
          const name = this.extractComponentName(file, metadataType);

          components.push({
            name,
            type: metadataType,
            filePath,
            dependencies: new Set(),
            dependents: new Set(),
            priorityBoost: 0,
          });
        } else if (stat.isDirectory()) {
          // Handle bundle types (e.g., Documents, DigitalExperience)
          const bundleComponents = await this.scanBundleDirectory(filePath, metadataType);
          components.push(...bundleComponents);
        }
      }

      return components;
    } catch (error) {
      logger.error('Failed to scan type directory', {
        typeDir,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * @ac US-080-AC-5: Handle Documents folder structure
   * @ac US-080-AC-6: Handle DigitalExperience bundles
   * Scan bundle directory (for Documents, DigitalExperience, etc.)
   */
  private async scanBundleDirectory(
    bundleDir: string,
    metadataType: MetadataType
  ): Promise<MetadataComponent[]> {
    const components: MetadataComponent[] = [];

    try {
      const bundleName = path.basename(bundleDir);

      // For bundles, create a single component representing the bundle
      components.push({
        name: bundleName,
        type: metadataType,
        filePath: bundleDir,
        dependencies: new Set(),
        dependents: new Set(),
        priorityBoost: 0,
      });

      logger.debug('Scanned bundle directory', { bundleName, type: metadataType });
      return components;
    } catch (error) {
      logger.error('Failed to scan bundle directory', {
        bundleDir,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * @ac US-080-AC-4: Convert to source format internally
   * Map Metadata API directory name to MetadataType
   */
  private mapDirectoryToType(dirName: string): MetadataType | null {
    const mappings: Record<string, MetadataType> = {
      classes: 'ApexClass',
      triggers: 'ApexTrigger',
      pages: 'VisualforcePage',
      components: 'VisualforceComponent',
      objects: 'CustomObject',
      layouts: 'Layout',
      profiles: 'Profile',
      permissionsets: 'PermissionSet',
      flows: 'Flow',
      documents: 'Document',
      email: 'EmailTemplate',
      staticresources: 'StaticResource',
      labels: 'CustomLabels',
      quickActions: 'QuickAction',
      flexipages: 'FlexiPage',
      aura: 'AuraDefinitionBundle',
      lwc: 'LightningComponentBundle',
      sites: 'DigitalExperience',
      experiences: 'DigitalExperience',
    };

    return mappings[dirName] || null;
  }

  /**
   * Extract component name from filename
   */
  private extractComponentName(filename: string, metadataType: MetadataType): string {
    // Remove extension
    const withoutExt = filename.replace(/\.[^.]+$/, '');

    // For some types, remove suffix (e.g., .cls, .trigger, .page)
    return withoutExt;
  }

  /**
   * Get error report
   */
  public getErrorReport(): string {
    return this.errorAggregator.generateFormattedReport();
  }
}

