/**
 * File System Utilities
 *
 * Provides safe file system operations with proper error handling
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';
import { parseStringPromise } from 'xml2js';

export type FileReadResult = {
  content: string;
  encoding: string;
  isBinary: boolean;
  filePath: string;
};

export type ScanOptions = {
  pattern: string;
  recursive?: boolean;
  followSymlinks?: boolean;
  ignorePatterns?: string[];
};

export type XmlParseResult = {
  isValid: boolean;
  root?: {
    name: string;
    attributes: Record<string, string>;
    children: unknown[];
  };
  errors: string[];
  filePath: string;
};

/**
 * Reads file with encoding detection
 *
 * @ac US-003-AC-1
 */
export async function readFileWithEncoding(filePath: string): Promise<FileReadResult> {
  try {
    const fileBuffer = await fs.readFile(filePath);

    // Detect if binary by checking for null bytes
    const isBinary = fileBuffer.includes(0x00);

    if (isBinary) {
      return {
        content: '',
        encoding: 'binary',
        isBinary: true,
        filePath,
      };
    }

    // Assume UTF-8 for text files
    const textContent = fileBuffer.toString('utf-8');

    return {
      content: textContent,
      encoding: 'utf-8',
      isBinary: false,
      filePath,
    };
  } catch (error) {
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
    const { pattern, recursive = true, followSymlinks = false, ignorePatterns = [] } = options;

    const globPattern = recursive ? pattern : path.join(directoryPath, pattern);

    const matchedFiles = await glob(globPattern, {
      cwd: directoryPath,
      absolute: true,
      follow: followSymlinks,
      ignore: ignorePatterns,
      nodir: true,
    });

    return matchedFiles;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to scan directory '${directoryPath}': ${errorMessage}`);
  }
}

/**
 * Parses XML file with namespace support
 *
 * @ac US-003-AC-3
 */
export async function parseXmlFile(xmlFilePath: string): Promise<XmlParseResult> {
  try {
    const fileContent = await fs.readFile(xmlFilePath, 'utf-8');

    try {
      const parsedData = (await parseStringPromise(fileContent, {
        explicitArray: false,
        mergeAttrs: false,
        xmlns: true,
        tagNameProcessors: [],
      })) as Record<string, { $?: Record<string, string> }>;

      const rootTagName = Object.keys(parsedData)[0];
      const rootElement = parsedData[rootTagName];

      return {
        isValid: true,
        root: {
          name: rootTagName,
          attributes: (rootElement?.$ as Record<string, string>) || {},
          children: [],
        },
        errors: [],
        filePath: xmlFilePath,
      };
    } catch (parseError) {
      const parseErrorMessage = parseError instanceof Error ? parseError.message : String(parseError);

      return {
        isValid: false,
        errors: [`XML parsing error in '${xmlFilePath}': ${parseErrorMessage}`],
        filePath: xmlFilePath,
      };
    }
  } catch (readError) {
    const readErrorMessage = readError instanceof Error ? readError.message : String(readError);

    return {
      isValid: false,
      errors: [`Failed to read XML file '${xmlFilePath}': ${readErrorMessage}`],
      filePath: xmlFilePath,
    };
  }
}
