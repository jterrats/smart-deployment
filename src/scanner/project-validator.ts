/**
 * Project Structure Validator - US-084
 * Validates SFDX project structure
 *
 * @ac US-084-AC-1: Validate sfdx-project.json schema
 * @ac US-084-AC-2: Validate package directories exist
 * @ac US-084-AC-3: Validate metadata structure
 * @ac US-084-AC-4: Check for required files
 * @ac US-084-AC-5: Generate validation report
 * @ac US-084-AC-6: Suggest fixes for issues
 * @issue #84
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getLogger } from '../utils/logger.js';
import { SfdxProjectDetector } from './sfdx-project-detector.js';

const logger = getLogger('ProjectValidator');

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  path?: string;
  suggestion?: string;
}

export interface ValidationReport {
  isValid: boolean;
  issues: ValidationIssue[];
  checkedItems: string[];
  executionTime: number;
}

/**
 * @ac US-084-AC-1: Validate sfdx-project.json schema
 */
export class ProjectValidator {

  /**
   * Validate project structure
   */
  public async validate(projectRoot: string): Promise<ValidationReport> {
    const startTime = Date.now();

    const report: ValidationReport = {
      isValid: true,
      issues: [],
      checkedItems: [],
      executionTime: 0,
    };

    try {
      // Check 1: sfdx-project.json exists
      await this.validateSfdxProjectJson(projectRoot, report);

      // Check 2: Package directories exist
      await this.validatePackageDirectories(projectRoot, report);

      // Check 3: Metadata structure
      await this.validateMetadataStructure(projectRoot, report);

      // Check 4: Required files
      await this.validateRequiredFiles(projectRoot, report);

      // Determine overall validity
      report.isValid = !report.issues.some((i) => i.severity === 'error');

      report.executionTime = Date.now() - startTime;

      logger.info('Project validation complete', {
        isValid: report.isValid,
        issues: report.issues.length,
        executionTime: report.executionTime,
      });

      return report;
    } catch (error) {
      report.isValid = false;
      report.issues.push({
        severity: 'error',
        message: 'Validation failed: ' + (error instanceof Error ? error.message : String(error)),
      });

      report.executionTime = Date.now() - startTime;
      return report;
    }
  }

  /**
   * @ac US-084-AC-1: Validate sfdx-project.json schema
   */
  private async validateSfdxProjectJson(projectRoot: string, report: ValidationReport): Promise<void> {
    report.checkedItems.push('sfdx-project.json existence');

    const sfdxProjectPath = path.join(projectRoot, 'sfdx-project.json');

    if (!fs.existsSync(sfdxProjectPath)) {
      report.issues.push({
        severity: 'error',
        message: 'sfdx-project.json not found',
        path: sfdxProjectPath,
        suggestion: 'Run: sfdx force:project:create to initialize a new project',
      });
      return;
    }

    // Validate JSON structure
    try {
      const content = fs.readFileSync(sfdxProjectPath, 'utf-8');
      const config = JSON.parse(content);

      report.checkedItems.push('sfdx-project.json valid JSON');

      // Check required fields
      if (!config.packageDirectories) {
        report.issues.push({
          severity: 'error',
          message: 'packageDirectories field missing in sfdx-project.json',
          path: sfdxProjectPath,
          suggestion: 'Add packageDirectories array to sfdx-project.json',
        });
      }

      if (!config.namespace && !config.sfdcLoginUrl) {
        report.issues.push({
          severity: 'warning',
          message: 'Neither namespace nor sfdcLoginUrl defined',
          path: sfdxProjectPath,
          suggestion: 'Consider adding sfdcLoginUrl for proper authentication',
        });
      }

      report.checkedItems.push('sfdx-project.json schema');
    } catch (error) {
      report.issues.push({
        severity: 'error',
        message: 'Invalid JSON in sfdx-project.json',
        path: sfdxProjectPath,
        suggestion: 'Fix JSON syntax errors',
      });
    }
  }

  /**
   * @ac US-084-AC-2: Validate package directories exist
   */
  private async validatePackageDirectories(projectRoot: string, report: ValidationReport): Promise<void> {
    report.checkedItems.push('package directories');

    const projectInfo = await SfdxProjectDetector.detect(projectRoot);

    for (const packageDir of projectInfo.packageDirectories) {
      const fullPath = path.join(projectRoot, packageDir);

      if (!fs.existsSync(fullPath)) {
        report.issues.push({
          severity: 'error',
          message: `Package directory does not exist: ${packageDir}`,
          path: fullPath,
          suggestion: `Create directory: mkdir -p ${packageDir}`,
        });
      }
    }
  }

  /**
   * @ac US-084-AC-3: Validate metadata structure
   */
  private async validateMetadataStructure(projectRoot: string, report: ValidationReport): Promise<void> {
    report.checkedItems.push('metadata structure');

    const projectInfo = await SfdxProjectDetector.detect(projectRoot);

    for (const packageDir of projectInfo.packageDirectories) {
      const packagePath = path.join(projectRoot, packageDir);

      if (!fs.existsSync(packagePath)) continue;

      // Check for common metadata folders
      const commonFolders = ['classes', 'triggers', 'objects', 'lwc', 'aura'];
      let hasMetadata = false;

      for (const folder of commonFolders) {
        const folderPath = path.join(packagePath, 'main', 'default', folder);
        if (fs.existsSync(folderPath)) {
          hasMetadata = true;
          break;
        }
      }

      if (!hasMetadata) {
        report.issues.push({
          severity: 'info',
          message: `No metadata found in package: ${packageDir}`,
          path: packagePath,
          suggestion: 'This might be intentional for a new project',
        });
      }
    }
  }

  /**
   * @ac US-084-AC-4: Check for required files
   */
  private async validateRequiredFiles(projectRoot: string, report: ValidationReport): Promise<void> {
    report.checkedItems.push('required files');

    const recommendedFiles = [
      { file: '.gitignore', severity: 'warning' as const, suggestion: 'Add .gitignore to exclude build artifacts' },
      { file: '.forceignore', severity: 'warning' as const, suggestion: 'Add .forceignore to exclude files from deployment' },
      { file: 'README.md', severity: 'info' as const, suggestion: 'Add README.md to document your project' },
    ];

    for (const { file, severity, suggestion } of recommendedFiles) {
      const filePath = path.join(projectRoot, file);

      if (!fs.existsSync(filePath)) {
        report.issues.push({
          severity,
          message: `${file} not found`,
          path: filePath,
          suggestion,
        });
      }
    }
  }

  /**
   * @ac US-084-AC-5: Generate validation report
   * @ac US-084-AC-6: Suggest fixes for issues
   * Format validation report
   */
  public formatReport(report: ValidationReport): string {
    const lines: string[] = [];

    lines.push('✓ Project Validation Report');
    lines.push('═══════════════════════════════════════');
    lines.push(`Status: ${report.isValid ? '✅ VALID' : '❌ INVALID'}`);
    lines.push(`Checks Performed: ${report.checkedItems.length}`);
    lines.push(`Issues Found: ${report.issues.length}`);
    lines.push(`Execution Time: ${report.executionTime}ms`);
    lines.push('');

    if (report.issues.length > 0) {
      const errors = report.issues.filter((i) => i.severity === 'error');
      const warnings = report.issues.filter((i) => i.severity === 'warning');
      const info = report.issues.filter((i) => i.severity === 'info');

      if (errors.length > 0) {
        lines.push(`❌ Errors (${errors.length}):`);
        for (const issue of errors) {
          lines.push(`   ${issue.message}`);
          if (issue.suggestion) {
            lines.push(`   💡 ${issue.suggestion}`);
          }
        }
        lines.push('');
      }

      if (warnings.length > 0) {
        lines.push(`⚠️  Warnings (${warnings.length}):`);
        for (const issue of warnings) {
          lines.push(`   ${issue.message}`);
          if (issue.suggestion) {
            lines.push(`   💡 ${issue.suggestion}`);
          }
        }
        lines.push('');
      }

      if (info.length > 0) {
        lines.push(`ℹ️  Info (${info.length}):`);
        for (const issue of info) {
          lines.push(`   ${issue.message}`);
        }
      }
    } else {
      lines.push('✅ No issues found - project structure is valid!');
    }

    return lines.join('\n');
  }
}

