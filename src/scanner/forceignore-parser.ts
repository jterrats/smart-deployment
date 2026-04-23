/**
 * .forceignore Parser - US-083
 * Parses and applies .forceignore rules to filter metadata
 *
 * @ac US-083-AC-1: Parse .forceignore syntax
 * @ac US-083-AC-2: Support glob patterns
 * @ac US-083-AC-3: Support negation (!)
 * @ac US-083-AC-4: Support comments (#)
 * @ac US-083-AC-5: Respect .gitignore format
 * @ac US-083-AC-6: Test against file paths
 * @issue #83
 */

import { readFile, access } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { minimatch } from 'minimatch';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('ForceIgnoreParser');

export type ForceIgnoreRule = {
  pattern: string;
  isNegation: boolean;
  lineNumber: number;
};

export type ForceIgnoreResult = {
  found: boolean;
  filePath: string;
  rules: ForceIgnoreRule[];
  totalRules: number;
  commentLines: number;
  emptyLines: number;
};

/**
 * @ac US-083-AC-1: Parse .forceignore syntax
 * @ac US-083-AC-2: Support glob patterns
 */
export class ForceIgnoreParser {
  private static readonly FORCEIGNORE_FILE = '.forceignore';

  private rules: ForceIgnoreRule[] = [];
  private projectRoot: string = '';

  /**
   * Load and parse .forceignore file
   */
  public async load(projectRoot: string): Promise<ForceIgnoreResult> {
    this.projectRoot = projectRoot;
    const filePath = resolve(projectRoot, ForceIgnoreParser.FORCEIGNORE_FILE);

    const result: ForceIgnoreResult = {
      found: false,
      filePath,
      rules: [],
      totalRules: 0,
      commentLines: 0,
      emptyLines: 0,
    };

    try {
      await access(filePath);
      result.found = true;
    } catch {
      logger.debug('.forceignore not found', { projectRoot });
      return result;
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      const parseResult = this.parseContent(content);

      this.rules = parseResult.rules;
      result.rules = parseResult.rules;
      result.totalRules = parseResult.totalRules;
      result.commentLines = parseResult.commentLines;
      result.emptyLines = parseResult.emptyLines;

      logger.info('.forceignore loaded', {
        rules: result.totalRules,
        comments: result.commentLines,
      });

      return result;
    } catch (error) {
      logger.error('Failed to parse .forceignore', { error });
      throw new Error(`Failed to parse .forceignore: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * @ac US-083-AC-1: Parse .forceignore syntax
   * @ac US-083-AC-3: Support negation (!)
   * @ac US-083-AC-4: Support comments (#)
   */
  private parseContent(content: string): {
    rules: ForceIgnoreRule[];
    totalRules: number;
    commentLines: number;
    emptyLines: number;
  } {
    const lines = content.split('\n');
    const rules: ForceIgnoreRule[] = [];
    let commentLines = 0;
    let emptyLines = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      // Skip empty lines
      if (line.length === 0) {
        emptyLines++;
        continue;
      }

      // Skip comments
      if (line.startsWith('#')) {
        commentLines++;
        continue;
      }

      // Handle negation
      const isNegation = line.startsWith('!');
      const pattern = isNegation ? line.slice(1) : line;

      rules.push({
        pattern,
        isNegation,
        lineNumber,
      });
    }

    return {
      rules,
      totalRules: rules.length,
      commentLines,
      emptyLines,
    };
  }

  /**
   * @ac US-083-AC-6: Test against file paths
   * Check if a file path is ignored using minimatch
   */
  public isIgnored(filePath: string): boolean {
    if (this.rules.length === 0) {
      return false;
    }

    // Get relative path from project root
    const relativePath = this.getRelativePath(filePath);

    let ignored = false;

    // Apply rules in order (later rules override earlier ones)
    for (const rule of this.rules) {
      // Use minimatch for glob matching (industry standard)
      const matches = minimatch(relativePath, rule.pattern, {
        dot: true, // Match dotfiles
        matchBase: true, // Match basename
      });

      if (matches) {
        ignored = !rule.isNegation;
      }
    }

    return ignored;
  }

  /**
   * Filter an array of file paths based on .forceignore rules
   */
  public filterPaths(paths: string[]): string[] {
    if (this.rules.length === 0) {
      return paths;
    }

    return paths.filter((path) => !this.isIgnored(path));
  }

  /**
   * Get relative path from project root
   */
  private getRelativePath(filePath: string): string {
    const absolutePath = resolve(filePath);
    const projectRoot = resolve(this.projectRoot);

    let relativePath = relative(projectRoot, absolutePath);

    // Normalize path separators to forward slashes
    relativePath = relativePath.split(sep).join('/');

    return relativePath;
  }

  /**
   * Get all loaded rules
   */
  public getRules(): ForceIgnoreRule[] {
    return [...this.rules];
  }

  /**
   * Check if .forceignore is loaded
   */
  public isLoaded(): boolean {
    return this.rules.length > 0 || this.projectRoot.length > 0;
  }

  /**
   * Generate report of loaded rules
   */
  public formatReport(result: ForceIgnoreResult): string {
    const lines: string[] = [];

    lines.push('🚫 .forceignore Report');
    lines.push('═══════════════════════════════════════');

    if (!result.found) {
      lines.push('⚠️  .forceignore not found');
      lines.push('💡 All files will be included in deployment');
      return lines.join('\n');
    }

    lines.push(`✅ .forceignore loaded: ${result.filePath}`);
    lines.push('');
    lines.push('📊 Statistics:');
    lines.push(`   Active Rules: ${result.totalRules}`);
    lines.push(`   Comment Lines: ${result.commentLines}`);
    lines.push(`   Empty Lines: ${result.emptyLines}`);
    lines.push('');

    if (result.rules.length > 0) {
      lines.push('📋 Rules:');
      for (const rule of result.rules.slice(0, 20)) {
        // Show first 20
        const prefix = rule.isNegation ? '!' : ' ';
        lines.push(`   ${prefix} ${rule.pattern}`);
      }
      if (result.rules.length > 20) {
        lines.push(`   ... and ${result.rules.length - 20} more`);
      }
    }

    return lines.join('\n');
  }
}
