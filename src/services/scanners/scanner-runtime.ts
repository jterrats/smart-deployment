import * as fs from 'node:fs/promises';
import { glob as globAsync } from 'glob';
import type { MetadataComponent } from '../../types/metadata.js';
import { getLogger } from '../../utils/logger.js';
import type { DirectoryScanner, FileScanner, ScannerContext } from './code-metadata-scanner.js';

const logger = getLogger('ScannerRuntime');

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function findFiles(rootPath: string, pattern: string): Promise<string[]> {
  return globAsync(pattern, {
    cwd: rootPath,
    absolute: true,
    posix: false,
    windowsPathsNoEscape: true,
    ignore: ['**/node_modules/**', '**/.git/**'],
  });
}

export async function findDirectories(rootPath: string, pattern: string): Promise<string[]> {
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

  return directoryMatches.filter(isDefined);
}

export function buildScannerError(entityLabel: string, location: string, error: unknown): string {
  return `Failed to parse ${entityLabel} ${location}: ${error instanceof Error ? error.message : String(error)}`;
}

export function createScannerContext(errors: string[], shouldIgnore: (filePath: string) => boolean): ScannerContext {
  return {
    fileExists,
    shouldIgnore,
    readFile: fs.readFile,
    errors,
  };
}

export async function scanMetadataFiles(
  packagePath: string,
  pattern: string,
  errors: string[],
  entityLabel: string,
  shouldIgnore: (filePath: string) => boolean,
  parser: (filePath: string) => Promise<MetadataComponent | undefined>
): Promise<MetadataComponent[]> {
  const files = await findFiles(packagePath, pattern);
  const components = await Promise.all(
    files
      .filter((filePath) => !shouldIgnore(filePath))
      .map(async (filePath) => {
        try {
          return await parser(filePath);
        } catch (error) {
          const errorMsg = buildScannerError(entityLabel, filePath, error);
          logger.warn(errorMsg);
          errors.push(errorMsg);
          return undefined;
        }
      })
  );

  return components.filter(isDefined);
}

export async function scanMetadataDirectories(
  packagePath: string,
  pattern: string,
  errors: string[],
  entityLabel: string,
  shouldIgnore: (directoryPath: string) => boolean,
  parser: (directoryPath: string) => Promise<MetadataComponent | MetadataComponent[] | undefined>,
  formatPathForError: (directoryPath: string) => string = (directoryPath): string => directoryPath
): Promise<MetadataComponent[]> {
  const directories = await findDirectories(packagePath, pattern);
  const components = await Promise.all(
    directories
      .filter((directoryPath) => !shouldIgnore(directoryPath))
      .map(async (directoryPath) => {
        try {
          const parsed = await parser(directoryPath);
          if (parsed === undefined) {
            return [];
          }

          return Array.isArray(parsed) ? parsed : [parsed];
        } catch (error) {
          const errorMsg = buildScannerError(entityLabel, formatPathForError(directoryPath), error);
          logger.warn(errorMsg);
          errors.push(errorMsg);
          return [];
        }
      })
  );

  return components.flat();
}

export async function scanRegisteredFileMetadata(
  packagePath: string,
  errors: string[],
  shouldIgnore: (filePath: string) => boolean,
  scanners: FileScanner[]
): Promise<MetadataComponent[]> {
  const context = createScannerContext(errors, shouldIgnore);
  const components = await Promise.all(
    scanners.flatMap(async (scanner) => {
      const files = await findFiles(packagePath, scanner.pattern);
      return Promise.all(
        files
          .filter((filePath) => !shouldIgnore(filePath))
          .filter((filePath) => scanner.shouldInclude?.(filePath) ?? true)
          .map((filePath) => scanner.parse(filePath, context))
      );
    })
  );

  return components.flat().filter(isDefined);
}

export async function scanRegisteredDirectoryMetadata(
  packagePath: string,
  errors: string[],
  shouldIgnore: (directoryPath: string) => boolean,
  scanners: DirectoryScanner[]
): Promise<MetadataComponent[]> {
  const context = createScannerContext(errors, shouldIgnore);
  const components = await Promise.all(
    scanners.flatMap(async (scanner) => {
      const directories = await findDirectories(packagePath, scanner.pattern);
      return Promise.all(
        directories
          .filter((directoryPath) => !shouldIgnore(directoryPath))
          .map((directoryPath) => scanner.parse(directoryPath, context))
      );
    })
  );

  return components.flat().filter(isDefined);
}
