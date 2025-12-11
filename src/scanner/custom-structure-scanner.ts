/**
 * Custom Structure Scanner - US-081
 * Support non-standard SFDX project structures
 *
 * @ac US-081-AC-1: Detect custom package directories
 * @ac US-081-AC-2: Support custom naming conventions
 * @ac US-081-AC-3: Handle nested structures
 * @ac US-081-AC-4: Support legacy structures
 * @ac US-081-AC-5: Validate custom paths
 * @ac US-081-AC-6: Generate structure report
 * @issue #81
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('CustomStructureScanner');

export interface CustomStructure {
  packageDirs: string[];
  namingConvention: 'standard' | 'custom';
  isNested: boolean;
  isLegacy: boolean;
  customPaths: Record<string, string>;
}

export interface StructureReport {
  structure: CustomStructure;
  warnings: string[];
  recommendations: string[];
}

/**
 * @ac US-081-AC-1: Detect custom package directories
 */
export class CustomStructureScanner {
  /**
   * @ac US-081-AC-1: Detect custom package directories
   * Scan for custom package directories
   */
  public async detectCustomPackageDirs(projectRoot: string): Promise<string[]> {
    logger.info('Detecting custom package directories', { projectRoot });

    const customDirs: string[] = [];

    try {
      // Check sfdx-project.json
      const sfdxProjectPath = path.join(projectRoot, 'sfdx-project.json');
      const content = await fs.readFile(sfdxProjectPath, 'utf-8');
      const config = JSON.parse(content);

      if (config.packageDirectories) {
        for (const pkg of config.packageDirectories) {
          if (pkg.path) {
            customDirs.push(pkg.path);
          }
        }
      }

      // Also scan for common patterns
      const commonDirs = ['force-app', 'src', 'main', 'apps', 'packages'];
      for (const dir of commonDirs) {
        const fullPath = path.join(projectRoot, dir);
        try {
          await fs.access(fullPath);
          if (!customDirs.includes(dir)) {
            customDirs.push(dir);
          }
        } catch {
          // Directory doesn't exist, skip
        }
      }
    } catch (error) {
      logger.warn('Error detecting custom package dirs', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    logger.info('Custom package directories detected', { count: customDirs.length });
    return customDirs;
  }

  /**
   * @ac US-081-AC-2: Support custom naming conventions
   * Detect naming convention
   */
  public detectNamingConvention(directories: string[]): 'standard' | 'custom' {
    const standardPatterns = ['force-app', 'main/default', 'src'];
    const hasStandard = directories.some((dir) =>
      standardPatterns.some((pattern) => dir.includes(pattern))
    );

    return hasStandard ? 'standard' : 'custom';
  }

  /**
   * @ac US-081-AC-3: Handle nested structures
   * Check if structure is nested
   */
  public async isNestedStructure(projectRoot: string, packageDirs: string[]): Promise<boolean> {
    for (const dir of packageDirs) {
      const fullPath = path.join(projectRoot, dir);
      try {
        const entries = await fs.readdir(fullPath, { withFileTypes: true });
        const subDirs = entries.filter((e) => e.isDirectory());

        // Check if has metadata subdirectories
        const hasMetadataSubdirs = subDirs.some((d) =>
          ['classes', 'triggers', 'objects', 'lwc', 'aura'].includes(d.name)
        );

        if (!hasMetadataSubdirs) {
          // Might be nested, check deeper
          for (const subDir of subDirs) {
            const subPath = path.join(fullPath, subDir.name);
            const subEntries = await fs.readdir(subPath, { withFileTypes: true });
            const hasMetadata = subEntries.some((e) =>
              ['classes', 'triggers', 'objects'].includes(e.name)
            );
            if (hasMetadata) {
              return true; // Found nested structure
            }
          }
        }
      } catch {
        // Skip errors
      }
    }

    return false;
  }

  /**
   * @ac US-081-AC-4: Support legacy structures
   * Detect legacy structure (Metadata API format)
   */
  public async isLegacyStructure(projectRoot: string): Promise<boolean> {
    try {
      // Check for package.xml
      await fs.access(path.join(projectRoot, 'package.xml'));
      return true;
    } catch {
      // Check for src/ directory (old format)
      try {
        await fs.access(path.join(projectRoot, 'src'));
        // Check if it's really legacy or just a custom dir name
        const packageXml = path.join(projectRoot, 'src', 'package.xml');
        await fs.access(packageXml);
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * @ac US-081-AC-5: Validate custom paths
   * Validate custom paths exist and are accessible
   */
  public async validateCustomPaths(
    projectRoot: string,
    customPaths: Record<string, string>
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const [key, customPath] of Object.entries(customPaths)) {
      const fullPath = path.join(projectRoot, customPath);
      try {
        await fs.access(fullPath);
      } catch {
        errors.push(`Custom path not found: ${key} -> ${customPath}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * @ac US-081-AC-6: Generate structure report
   * Scan and generate comprehensive structure report
   */
  public async scanStructure(projectRoot: string): Promise<StructureReport> {
    logger.info('Scanning custom structure', { projectRoot });

    const packageDirs = await this.detectCustomPackageDirs(projectRoot);
    const namingConvention = this.detectNamingConvention(packageDirs);
    const isNested = await this.isNestedStructure(projectRoot, packageDirs);
    const isLegacy = await this.isLegacyStructure(projectRoot);

    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Generate warnings
    if (namingConvention === 'custom') {
      warnings.push('Custom naming convention detected - may affect deployment');
    }

    if (isNested) {
      warnings.push('Nested structure detected - ensure proper scanning depth');
    }

    if (isLegacy) {
      warnings.push('Legacy Metadata API format detected');
      recommendations.push('Consider migrating to SFDX source format');
    }

    // Generate recommendations
    if (packageDirs.length === 0) {
      recommendations.push('No package directories found - check sfdx-project.json');
    }

    if (packageDirs.length > 5) {
      recommendations.push('Many package directories - consider consolidating');
    }

    const structure: CustomStructure = {
      packageDirs,
      namingConvention,
      isNested,
      isLegacy,
      customPaths: {},
    };

    logger.info('Structure scan complete', {
      packageDirs: packageDirs.length,
      namingConvention,
      isNested,
      isLegacy,
    });

    return {
      structure,
      warnings,
      recommendations,
    };
  }

  /**
   * Format structure report
   */
  public formatReport(report: StructureReport): string {
    const lines: string[] = [];

    lines.push('📂 Project Structure Report');
    lines.push('═══════════════════════════════════════');
    lines.push(`Package Directories: ${report.structure.packageDirs.length}`);
    for (const dir of report.structure.packageDirs) {
      lines.push(`  • ${dir}`);
    }
    lines.push('');

    lines.push(`Naming Convention: ${report.structure.namingConvention}`);
    lines.push(`Nested Structure: ${report.structure.isNested ? 'Yes' : 'No'}`);
    lines.push(`Legacy Format: ${report.structure.isLegacy ? 'Yes' : 'No'}`);
    lines.push('');

    if (report.warnings.length > 0) {
      lines.push('⚠️  Warnings:');
      for (const warning of report.warnings) {
        lines.push(`  • ${warning}`);
      }
      lines.push('');
    }

    if (report.recommendations.length > 0) {
      lines.push('💡 Recommendations:');
      for (const rec of report.recommendations) {
        lines.push(`  • ${rec}`);
      }
    }

    return lines.join('\n');
  }
}
