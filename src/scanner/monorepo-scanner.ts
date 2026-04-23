/**
 * Monorepo Scanner - US-082
 * Support monorepo structures with multiple SF projects
 *
 * @ac US-082-AC-1: Detect multiple SFDX projects
 * @ac US-082-AC-2: Scan each project independently
 * @ac US-082-AC-3: Support shared dependencies
 * @ac US-082-AC-4: Handle cross-project references
 * @ac US-082-AC-5: Generate monorepo report
 * @ac US-082-AC-6: Support workspace configuration
 * @issue #82
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { getLogger } from '../utils/logger.js';
import { type SfdxProjectJson } from './sfdx-project-detector.js';

const logger = getLogger('MonorepoScanner');

export interface SfdxProject {
  name: string;
  path: string;
  sfdxProjectPath: string;
  packageDirectories: string[];
}

export interface MonorepoStructure {
  isMonorepo: boolean;
  projects: SfdxProject[];
  sharedDependencies: string[];
  crossProjectRefs: Array<{ from: string; to: string; component: string }>;
}

export interface MonorepoReport {
  structure: MonorepoStructure;
  warnings: string[];
  recommendations: string[];
}

/**
 * @ac US-082-AC-1: Detect multiple SFDX projects
 */
export class MonorepoScanner {
  /**
   * @ac US-082-AC-1: Detect multiple SFDX projects
   * Find all sfdx-project.json files in directory tree
   */
  public async detectProjects(rootDir: string, maxDepth = 3): Promise<SfdxProject[]> {
    logger.info('Detecting SFDX projects', { rootDir, maxDepth });

    const projects: SfdxProject[] = [];
    await this.scanDirectory(rootDir, 0, maxDepth, projects);

    logger.info('Projects detected', { count: projects.length });
    return projects;
  }

  /**
   * Recursively scan directory for sfdx-project.json
   */
  private async scanDirectory(
    dir: string,
    depth: number,
    maxDepth: number,
    projects: SfdxProject[]
  ): Promise<void> {
    if (depth > maxDepth) return;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      // Check for sfdx-project.json
      const hasSfdxProject = entries.some((e) => e.name === 'sfdx-project.json');

      if (hasSfdxProject) {
        const sfdxProjectPath = path.join(dir, 'sfdx-project.json');
        try {
          const content = await fs.readFile(sfdxProjectPath, 'utf-8');
          const config = JSON.parse(content) as SfdxProjectJson & { name?: string };

          const packageDirs = config.packageDirectories
            ? config.packageDirectories.map((p) => p.path)
            : [];

          projects.push({
            name: config.name || path.basename(dir),
            path: dir,
            sfdxProjectPath,
            packageDirectories: packageDirs,
          });
        } catch (error) {
          logger.warn('Failed to parse sfdx-project.json', {
            path: sfdxProjectPath,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Scan subdirectories (skip node_modules, .git, etc.)
      const dirsToScan = entries.filter(
        (e) =>
          e.isDirectory() &&
          !['node_modules', '.git', '.sfdx', 'dist', 'build', 'coverage'].includes(e.name)
      );

      for (const entry of dirsToScan) {
        await this.scanDirectory(path.join(dir, entry.name), depth + 1, maxDepth, projects);
      }
    } catch (error) {
      logger.warn('Failed to scan directory', {
        dir,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * @ac US-082-AC-3: Support shared dependencies
   * Detect shared dependencies between projects
   */
  public async detectSharedDependencies(projects: SfdxProject[]): Promise<string[]> {
    const sharedDeps: Set<string> = new Set();

    for (const project of projects) {
      try {
        const content = await fs.readFile(project.sfdxProjectPath, 'utf-8');
        const config = JSON.parse(content) as SfdxProjectJson & { packageAliases?: Record<string, unknown> };

        if (config.plugins) {
          const plugins = config.plugins as Record<string, unknown>;
          for (const plugin of Object.keys(plugins)) {
            sharedDeps.add(plugin);
          }
        }

        if (config.packageAliases) {
          for (const alias of Object.keys(config.packageAliases)) {
            sharedDeps.add(alias);
          }
        }
      } catch {
        // Skip errors
      }
    }

    return Array.from(sharedDeps);
  }

  /**
   * @ac US-082-AC-4: Handle cross-project references
   * Detect cross-project references (simplified)
   */
  public detectCrossProjectRefs(
    projects: SfdxProject[]
  ): Array<{ from: string; to: string; component: string }> {
    const refs: Array<{ from: string; to: string; component: string }> = [];

    // Simplified: Check if projects reference each other in config
    for (const project of projects) {
      for (const otherProject of projects) {
        if (project !== otherProject) {
          // Check if project path is mentioned in other project's package dirs
          const isReferenced = otherProject.packageDirectories.some((dir) =>
            dir.includes(path.basename(project.path))
          );

          if (isReferenced) {
            refs.push({
              from: project.name,
              to: otherProject.name,
              component: 'package',
            });
          }
        }
      }
    }

    return refs;
  }

  /**
   * @ac US-082-AC-5: Generate monorepo report
   * @ac US-082-AC-6: Support workspace configuration
   * Scan monorepo and generate report
   */
  public async scanMonorepo(rootDir: string): Promise<MonorepoReport> {
    logger.info('Scanning monorepo', { rootDir });

    const projects = await this.detectProjects(rootDir);
    const isMonorepo = projects.length > 1;

    const sharedDependencies = await this.detectSharedDependencies(projects);
    const crossProjectRefs = this.detectCrossProjectRefs(projects);

    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Generate warnings
    if (isMonorepo && crossProjectRefs.length > 0) {
      warnings.push(`Cross-project references detected: ${crossProjectRefs.length}`);
      recommendations.push('Consider consolidating shared code into a shared package');
    }

    if (isMonorepo && projects.length > 10) {
      warnings.push(`Many projects detected: ${projects.length}`);
      recommendations.push('Consider organizing projects into workspaces');
    }

    // Check for workspace configuration
    try {
      const workspaceConfig = path.join(rootDir, 'workspace.json');
      await fs.access(workspaceConfig);
      logger.info('Workspace configuration found');
    } catch {
      if (isMonorepo) {
        recommendations.push('Consider adding workspace.json for better monorepo management');
      }
    }

    const structure: MonorepoStructure = {
      isMonorepo,
      projects,
      sharedDependencies,
      crossProjectRefs,
    };

    logger.info('Monorepo scan complete', {
      isMonorepo,
      projectCount: projects.length,
      sharedDeps: sharedDependencies.length,
      crossRefs: crossProjectRefs.length,
    });

    return {
      structure,
      warnings,
      recommendations,
    };
  }

  /**
   * Format monorepo report
   */
  public formatReport(report: MonorepoReport): string {
    const lines: string[] = [];

    lines.push('📦 Monorepo Structure Report');
    lines.push('═══════════════════════════════════════');
    lines.push(`Is Monorepo: ${report.structure.isMonorepo ? 'Yes' : 'No'}`);
    lines.push(`Projects: ${report.structure.projects.length}`);
    lines.push('');

    if (report.structure.projects.length > 0) {
      lines.push('Projects:');
      for (const project of report.structure.projects) {
        lines.push(`  • ${project.name} (${project.path})`);
        lines.push(`    Package Dirs: ${project.packageDirectories.length}`);
      }
      lines.push('');
    }

    if (report.structure.sharedDependencies.length > 0) {
      lines.push(`Shared Dependencies: ${report.structure.sharedDependencies.length}`);
      for (const dep of report.structure.sharedDependencies.slice(0, 5)) {
        lines.push(`  • ${dep}`);
      }
      if (report.structure.sharedDependencies.length > 5) {
        lines.push(`  ... and ${report.structure.sharedDependencies.length - 5} more`);
      }
      lines.push('');
    }

    if (report.structure.crossProjectRefs.length > 0) {
      lines.push(`Cross-Project References: ${report.structure.crossProjectRefs.length}`);
      for (const ref of report.structure.crossProjectRefs.slice(0, 3)) {
        lines.push(`  • ${ref.from} → ${ref.to} (${ref.component})`);
      }
      if (report.structure.crossProjectRefs.length > 3) {
        lines.push(`  ... and ${report.structure.crossProjectRefs.length - 3} more`);
      }
      lines.push('');
    }

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
