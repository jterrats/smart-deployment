/**
 * File System Utilities
 *
 * Provides safe file system operations with proper error handling
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';
import { getLogger } from './logger.js';
import { parseXmlFile as parseXmlWithUtils, validateXml } from './xml.js';

const logger = getLogger('FileSystemUtils');

export type FileReadResult = {
  content: string;
  encoding: string;
  isBinary: boolean;
  filePath: string;
  size: number;
};

export type ScanOptions = {
  pattern: string;
  recursive?: boolean;
  followSymlinks?: boolean;
  ignorePatterns?: string[];
  maxDepth?: number;
};

/**
 * Reads file with encoding detection
 *
 * @ac US-003-AC-1
 */
export async function readFileWithEncoding(filePath: string): Promise<FileReadResult> {
  try {
    const [fileBuffer, stats] = await Promise.all([fs.readFile(filePath), fs.stat(filePath)]);

    // Detect if binary by checking for null bytes
    const isBinary = fileBuffer.includes(0x00);

    if (isBinary) {
      logger.debug('Binary file detected', { filePath, size: stats.size });
      return {
        content: '',
        encoding: 'binary',
        isBinary: true,
        filePath,
        size: stats.size,
      };
    }

    // Assume UTF-8 for text files
    const textContent = fileBuffer.toString('utf-8');

    return {
      content: textContent,
      encoding: 'utf-8',
      isBinary: false,
      filePath,
      size: stats.size,
    };
  } catch (error) {
    logger.error('Failed to read file', { error, filePath });
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read file '${filePath}': ${errorMessage}`);
  }
}

/**
 * Scans directory recursively with glob patterns
 *
 * @ac US-003-AC-2
 */
export async function scanDirectory(directoryPath: string, options: ScanOptions): Promise<string[]> {
  try {
    const { pattern, recursive = true, followSymlinks = false, ignorePatterns = [], maxDepth } = options;

    const globPattern = recursive ? pattern : path.join(directoryPath, pattern);

    const matchedFiles = await glob(globPattern, {
      cwd: directoryPath,
      absolute: true,
      follow: followSymlinks,
      ignore: ignorePatterns,
      nodir: true,
      maxDepth,
      withFileTypes: false, // Ensure we get strings, not Path objects
    });

    logger.debug('Directory scan completed', {
      directoryPath,
      pattern,
      filesFound: matchedFiles.length,
    });

    return matchedFiles;
  } catch (error) {
    logger.error('Failed to scan directory', { error, directoryPath, options });
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to scan directory '${directoryPath}': ${errorMessage}`);
  }
}

/**
 * Parses XML file with namespace support
 * Uses XML Utils (Issue #10) for robust parsing
 *
 * @ac US-003-AC-3
 */
export async function parseXmlFile(xmlFilePath: string): Promise<unknown> {
  try {
    // Validate before parsing
    const content = await fs.readFile(xmlFilePath, 'utf-8');
    const validation = validateXml(content);

    if (validation !== true) {
      logger.warn('XML validation failed', {
        filePath: xmlFilePath,
        error: validation.err,
      });
      throw new Error(`Invalid XML: ${validation.err.msg} at line ${validation.err.line}`);
    }

    // Parse using XML Utils
    const parsed = await parseXmlWithUtils(xmlFilePath);
    logger.debug('XML file parsed successfully', { filePath: xmlFilePath });
    return parsed;
  } catch (error) {
    logger.error('Failed to parse XML file', { error, filePath: xmlFilePath });
    throw error;
  }
}

/**
 * Check if file/directory is accessible
 *
 * @ac US-003-AC-4 (Handles permission errors gracefully)
 */
export async function isAccessible(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fs.constants.R_OK);
    return true;
  } catch {
    logger.warn('File not accessible', { filePath });
    return false;
  }
}

/**
 * Check if path is a symlink
 *
 * @ac US-003-AC-5 (Supports symlinks)
 */
export async function isSymlink(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.lstat(filePath);
    return stats.isSymbolicLink();
  } catch (error) {
    logger.error('Failed to check if symlink', { error, filePath });
    return false;
  }
}

/**
 * Get file size in bytes
 *
 * @ac US-003-AC-5 (Supports large files >10MB)
 */
export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    logger.error('Failed to get file size', { error, filePath });
    throw new Error(`Failed to get file size for '${filePath}': ${(error as Error).message}`);
  }
}

/**
 * Check if file is larger than threshold
 *
 * @ac US-003-AC-5 (Supports large files >10MB)
 */
export async function isLargeFile(filePath: string, thresholdMB = 10): Promise<boolean> {
  try {
    const size = await getFileSize(filePath);
    const sizeMB = size / (1024 * 1024);
    return sizeMB > thresholdMB;
  } catch {
    return false;
  }
}
