/**
 * Project Structure Validator - US-084
 * Validates project structure and configuration
 *
 * @ac US-084-AC-1: Validate sfdx-project.json
 * @ac US-084-AC-2: Check package directories exist
 * @ac US-084-AC-3: Validate .forceignore
 * @ac US-084-AC-4: Check for required files
 * @ac US-084-AC-5: Detect structure issues
 * @ac US-084-AC-6: Generate validation report
 * @issue #84
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { getLogger } from '../utils/logger.js';
import type { SfdxProjectJson } from './sfdx-project-detector.js';

const logger = getLogger('StructureValidator');

export type ValidationIssue = {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  path?: string;
  suggestion?: string;
};

export type ValidationReport = {
  isValid: boolean;
  issues: ValidationIssue[];
  checkedPaths: string[];
  executionTime: number;
};

/**
 * @ac US-084-AC-1: Validate sfdx-project.json
 */
export class StructureValidator {
  /**
   * @ac US-084-AC-1: Validate sfdx-project.json
   * Check sfdx-project.json structure and content
   */
  public async validateSfdxProject(projectRoot: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const sfdxProjectPath = path.join(projectRoot, 'sfdx-project.json');

    try {
      const content = await fs.readFile(sfdxProjectPath, 'utf-8');
      const config = JSON.parse(content) as Partial<SfdxProjectJson>;

      // Check required fields
      if (!config.packageDirectories) {
        issues.push({
          severity: 'error',
          code: 'MISSING_PACKAGE_DIRS',
          message: 'packageDirectories is required in sfdx-project.json',
          path: sfdxProjectPath,
          suggestion: 'Add packageDirectories array to sfdx-project.json',
        });
      }

      if (!config.sfdcLoginUrl && !config.sourceApiVersion) {
        issues.push({
          severity: 'warning',
          code: 'MISSING_API_VERSION',
          message: 'sourceApiVersion is recommended in sfdx-project.json',
          path: sfdxProjectPath,
          suggestion: 'Add sourceApiVersion (e.g., "61.0")',
        });
      }

      if (!config.namespace) {
        issues.push({
          severity: 'info',
          code: 'NO_NAMESPACE',
          message: 'No namespace defined (OK for scratch orgs)',
          path: sfdxProjectPath,
        });
      }

      // Validate package directories structure
      if (config.packageDirectories && Array.isArray(config.packageDirectories)) {
        for (const pkg of config.packageDirectories) {
          if (!pkg.path) {
            issues.push({
              severity: 'error',
              code: 'MISSING_PATH',
              message: 'Package directory missing "path" field',
              path: sfdxProjectPath,
            });
          }
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        issues.push({
          severity: 'error',
          code: 'MISSING_SFDX_PROJECT',
          message: 'sfdx-project.json not found',
          path: projectRoot,
          suggestion: 'Initialize SFDX project: sf project generate',
        });
      } else if (error instanceof SyntaxError) {
        issues.push({
          severity: 'error',
          code: 'INVALID_JSON',
          message: 'sfdx-project.json contains invalid JSON',
          path: sfdxProjectPath,
          suggestion: 'Fix JSON syntax errors',
        });
      }
    }

    return issues;
  }

  /**
   * @ac US-084-AC-2: Check package directories exist
   * Validate package directories exist on filesystem
   */
  public async validatePackageDirectories(projectRoot: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
      const sfdxProjectPath = path.join(projectRoot, 'sfdx-project.json');
      const content = await fs.readFile(sfdxProjectPath, 'utf-8');
      const config = JSON.parse(content) as Partial<SfdxProjectJson>;

      if (config.packageDirectories) {
        const missingPackages = await Promise.all(
          config.packageDirectories.map(async (pkg) => {
            if (!pkg.path) {
              return undefined;
            }

            const fullPath = path.join(projectRoot, pkg.path);
            try {
              await fs.access(fullPath);
              return undefined;
            } catch {
              return {
                severity: 'error' as const,
                code: 'PACKAGE_DIR_NOT_FOUND',
                message: `Package directory not found: ${pkg.path}`,
                path: fullPath,
                suggestion: `Create directory: mkdir -p ${pkg.path}`,
              };
            }
          })
        );

        issues.push(...(missingPackages.filter(Boolean) as ValidationIssue[]));
      }
    } catch {
      // Already handled in validateSfdxProject
    }

    return issues;
  }

  /**
   * @ac US-084-AC-3: Validate .forceignore
   * Check .forceignore file
   */
  public async validateForceIgnore(projectRoot: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const forceIgnorePath = path.join(projectRoot, '.forceignore');

    try {
      await fs.access(forceIgnorePath);

      // Read and check content
      const content = await fs.readFile(forceIgnorePath, 'utf-8');
      if (content.trim().length === 0) {
        issues.push({
          severity: 'warning',
          code: 'EMPTY_FORCEIGNORE',
          message: '.forceignore is empty',
          path: forceIgnorePath,
          suggestion: 'Add common ignore patterns (e.g., **/*.dup, .sfdx/)',
        });
      }
    } catch {
      issues.push({
        severity: 'warning',
        code: 'MISSING_FORCEIGNORE',
        message: '.forceignore not found',
        path: projectRoot,
        suggestion: 'Create .forceignore to exclude unwanted files',
      });
    }

    return issues;
  }

  /**
   * @ac US-084-AC-4: Check for required files
   * Check for other important files
   */
  public async validateRequiredFiles(projectRoot: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    const requiredFiles = [
      { file: '.gitignore', severity: 'warning' as const, suggestion: 'Add .gitignore for version control' },
      { file: 'README.md', severity: 'info' as const, suggestion: 'Add README.md for documentation' },
    ];

    const missingFiles = await Promise.all(
      requiredFiles.map(async ({ file, severity, suggestion }) => {
        const filePath = path.join(projectRoot, file);
        try {
          await fs.access(filePath);
          return undefined;
        } catch {
          return {
            severity,
            code: `MISSING_${file.toUpperCase().replace(/\./g, '_')}`,
            message: `${file} not found`,
            path: projectRoot,
            suggestion,
          };
        }
      })
    );

    issues.push(...(missingFiles.filter(Boolean) as ValidationIssue[]));

    return issues;
  }

  /**
   * @ac US-084-AC-5: Detect structure issues
   * Check for common structure problems
   */
  public async detectStructureIssues(projectRoot: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check for metadata in wrong location
    const commonMetadataDirs = ['classes', 'triggers', 'objects', 'lwc', 'aura'];

    const misplacedDirs = await Promise.all(
      commonMetadataDirs.map(async (dir) => {
        const wrongPath = path.join(projectRoot, dir);
        try {
          await fs.access(wrongPath);
          return {
            severity: 'warning' as const,
            code: 'METADATA_IN_ROOT',
            message: `Metadata directory found in project root: ${dir}`,
            path: wrongPath,
            suggestion: 'Move metadata into package directory (e.g., force-app/main/default/)',
          };
        } catch {
          return undefined;
        }
      })
    );

    issues.push(...(misplacedDirs.filter(Boolean) as ValidationIssue[]));

    return issues;
  }

  /**
   * @ac US-084-AC-6: Generate validation report
   * Validate entire project structure
   */
  public async validate(projectRoot: string): Promise<ValidationReport> {
    const startTime = Date.now();

    logger.info('Validating project structure', { projectRoot });

    const issues: ValidationIssue[] = [];
    const checkedPaths: string[] = [];

    // Run all validations
    issues.push(...(await this.validateSfdxProject(projectRoot)));
    checkedPaths.push(path.join(projectRoot, 'sfdx-project.json'));

    issues.push(...(await this.validatePackageDirectories(projectRoot)));
    issues.push(...(await this.validateForceIgnore(projectRoot)));
    checkedPaths.push(path.join(projectRoot, '.forceignore'));

    issues.push(...(await this.validateRequiredFiles(projectRoot)));
    issues.push(...(await this.detectStructureIssues(projectRoot)));

    const hasErrors = issues.some((i) => i.severity === 'error');

    const executionTime = Date.now() - startTime;

    logger.info('Validation complete', {
      isValid: !hasErrors,
      totalIssues: issues.length,
      errors: issues.filter((i) => i.severity === 'error').length,
      warnings: issues.filter((i) => i.severity === 'warning').length,
      executionTime,
    });

    return {
      isValid: !hasErrors,
      issues,
      checkedPaths,
      executionTime,
    };
  }

  /**
   * Format validation report
   */
  public formatReport(report: ValidationReport): string {
    const lines: string[] = [];

    lines.push('✓ Project Structure Validation');
    lines.push('═══════════════════════════════════════');
    lines.push(`Status: ${report.isValid ? '✅ VALID' : '❌ INVALID'}`);
    lines.push(`Checked Paths: ${report.checkedPaths.length}`);
    lines.push(`Execution Time: ${report.executionTime}ms`);
    lines.push('');

    const errors = report.issues.filter((i) => i.severity === 'error');
    const warnings = report.issues.filter((i) => i.severity === 'warning');
    const infos = report.issues.filter((i) => i.severity === 'info');

    if (errors.length > 0) {
      lines.push(`🔴 Errors (${errors.length}):`);
      for (const issue of errors) {
        lines.push(`  [${issue.code}] ${issue.message}`);
        if (issue.suggestion) {
          lines.push(`    💡 ${issue.suggestion}`);
        }
      }
      lines.push('');
    }

    if (warnings.length > 0) {
      lines.push(`🟡 Warnings (${warnings.length}):`);
      for (const issue of warnings) {
        lines.push(`  [${issue.code}] ${issue.message}`);
        if (issue.suggestion) {
          lines.push(`    💡 ${issue.suggestion}`);
        }
      }
      lines.push('');
    }

    if (infos.length > 0) {
      lines.push(`ℹ️  Info (${infos.length}):`);
      for (const issue of infos) {
        lines.push(`  [${issue.code}] ${issue.message}`);
      }
    }

    return lines.join('\n');
  }
}
