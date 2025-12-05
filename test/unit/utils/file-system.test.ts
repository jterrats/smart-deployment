import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import {
  getFileSize,
  isAccessible,
  isLargeFile,
  isSymlink,
  parseXmlFile,
  readFileWithEncoding,
  scanDirectory,
} from '../../../src/utils/file-system.js';

describe('File System Utilities', () => {
  const testDataDirectory = path.join(os.tmpdir(), `file-system-test-${Date.now()}`);

  beforeEach(async () => {
    // Create test fixtures directory
    await fs.mkdir(testDataDirectory, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup test fixtures
    await fs.rm(testDataDirectory, { recursive: true, force: true });
  });

  describe('readFileWithEncoding', () => {
    /**
     * @ac US-003-AC-1: readFileWithEncoding() reads files with encoding detection
     */
    it('should read UTF-8 file correctly', async () => {
      const testFilePath = path.join(testDataDirectory, 'utf8-test.txt');
      await fs.writeFile(testFilePath, 'Hello, World! 🌍', 'utf-8');

      const fileContent = await readFileWithEncoding(testFilePath);

      expect(fileContent.content).to.equal('Hello, World! 🌍');
      expect(fileContent.encoding).to.equal('utf-8');
      expect(fileContent.isBinary).to.be.false;
      expect(fileContent.size).to.be.greaterThan(0);
    });

    it('should detect binary files', async () => {
      const binaryFilePath = path.join(testDataDirectory, 'binary-test.bin');
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff]);
      await fs.writeFile(binaryFilePath, binaryData);

      const fileContent = await readFileWithEncoding(binaryFilePath);

      expect(fileContent.isBinary).to.be.true;
      expect(fileContent.encoding).to.equal('binary');
      expect(fileContent.size).to.equal(4);
    });

    /**
     * @ac US-003-AC-4: Handles permission errors gracefully
     */
    it('should handle permission errors gracefully', async () => {
      const restrictedFilePath = '/root/restricted-file.txt';

      try {
        await readFileWithEncoding(restrictedFilePath);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.include(restrictedFilePath);
      }
    });

    /**
     * @ac US-003-AC-6: Proper error messages with file paths
     */
    it('should provide detailed error messages', async () => {
      const nonExistentPath = path.join(testDataDirectory, 'non-existent-file.txt');

      try {
        await readFileWithEncoding(nonExistentPath);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.include(nonExistentPath);
        expect((error as Error).message).to.match(/not found|ENOENT/i);
      }
    });
  });

  describe('scanDirectory', () => {
    /**
     * @ac US-003-AC-2: scanDirectory() recursively scans with glob patterns
     */
    it('should scan directory recursively with glob pattern', async () => {
      const testDirectory = path.join(testDataDirectory, 'scan-test');
      await fs.mkdir(testDirectory, { recursive: true });
      await fs.mkdir(path.join(testDirectory, 'subdirectory'), { recursive: true });

      await fs.writeFile(path.join(testDirectory, 'file1.cls'), 'Apex Class 1');
      await fs.writeFile(path.join(testDirectory, 'file2.cls'), 'Apex Class 2');
      await fs.writeFile(path.join(testDirectory, 'subdirectory', 'file3.cls'), 'Apex Class 3');
      await fs.writeFile(path.join(testDirectory, 'ignore.txt'), 'Ignore this');

      const foundFiles = await scanDirectory(testDirectory, {
        pattern: '**/*.cls',
        recursive: true,
      });

      expect(foundFiles).to.have.lengthOf(3);
      expect(foundFiles.some((filePath) => filePath.endsWith('file1.cls'))).to.be.true;
      expect(foundFiles.some((filePath) => filePath.endsWith('file3.cls'))).to.be.true;
      expect(foundFiles.some((filePath) => filePath.endsWith('ignore.txt'))).to.be.false;
    });

    /**
     * @ac US-003-AC-5: Supports symlinks and large files
     */
    it('should handle symlinks', async () => {
      const symlinkTestDir = path.join(testDataDirectory, 'symlink-test');
      await fs.mkdir(symlinkTestDir, { recursive: true });

      const originalFile = path.join(symlinkTestDir, 'original.txt');
      const symlinkFile = path.join(symlinkTestDir, 'link.txt');

      await fs.writeFile(originalFile, 'Original content');
      await fs.symlink(originalFile, symlinkFile);

      const foundFiles = await scanDirectory(symlinkTestDir, {
        pattern: '**/*.txt',
        followSymlinks: true,
      });

      expect(foundFiles).to.have.lengthOf.at.least(1);
    });

    it('should handle empty directories', async () => {
      const emptyDirectory = path.join(testDataDirectory, 'empty-dir');
      await fs.mkdir(emptyDirectory, { recursive: true });

      const foundFiles = await scanDirectory(emptyDirectory, {
        pattern: '**/*',
      });

      expect(foundFiles).to.be.an('array').that.is.empty;
    });
  });

  describe('parseXmlFile', () => {
    /**
     * @ac US-003-AC-3: parseXmlFile() parses XML with namespace support
     */
    it('should parse XML with namespaces', async () => {
      const xmlFilePath = path.join(testDataDirectory, 'test-metadata.xml');
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>60.0</apiVersion>
    <status>Active</status>
</ApexClass>`;

      await fs.writeFile(xmlFilePath, xmlContent, 'utf-8');

      const parsedXml = await parseXmlFile(xmlFilePath);

      expect(parsedXml).to.be.an('object');
      expect(parsedXml).to.have.property('ApexClass');
      expect(parsedXml).to.have.nested.property('ApexClass.apiVersion', 60);
      expect(parsedXml).to.have.nested.property('ApexClass.status', 'Active');
    });

    it('should throw on invalid XML', async () => {
      const invalidXmlPath = path.join(testDataDirectory, 'invalid.xml');
      const invalidXmlContent = '<ApexClass><unclosed>';

      await fs.writeFile(invalidXmlPath, invalidXmlContent, 'utf-8');

      try {
        await parseXmlFile(invalidXmlPath);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.include('Invalid XML');
      }
    });

    /**
     * @ac US-003-AC-6: Proper error messages with file paths
     */
    it('should provide detailed error messages for malformed XML', async () => {
      const malformedXmlPath = path.join(testDataDirectory, 'malformed.xml');
      const malformedContent = '<Root><Tag>unclosed</Root>';

      await fs.writeFile(malformedXmlPath, malformedContent, 'utf-8');

      try {
        await parseXmlFile(malformedXmlPath);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.include('Invalid XML');
      }
    });
  });

  describe('isAccessible', () => {
    /**
     * @ac US-003-AC-4: Handles permission errors gracefully
     */
    it('should return true for accessible files', async () => {
      const testFile = path.join(testDataDirectory, 'accessible.txt');
      await fs.writeFile(testFile, 'content');

      const accessible = await isAccessible(testFile);
      expect(accessible).to.be.true;
    });

    it('should return false for non-existent files', async () => {
      const nonExistent = path.join(testDataDirectory, 'nonexistent.txt');
      const accessible = await isAccessible(nonExistent);
      expect(accessible).to.be.false;
    });
  });

  describe('isSymlink', () => {
    /**
     * @ac US-003-AC-5: Supports symlinks
     */
    it('should detect symlinks', async () => {
      const originalFile = path.join(testDataDirectory, 'original.txt');
      const symlinkFile = path.join(testDataDirectory, 'link.txt');

      await fs.writeFile(originalFile, 'content');
      await fs.symlink(originalFile, symlinkFile);

      const isLink = await isSymlink(symlinkFile);
      expect(isLink).to.be.true;
    });

    it('should return false for regular files', async () => {
      const regularFile = path.join(testDataDirectory, 'regular.txt');
      await fs.writeFile(regularFile, 'content');

      const isLink = await isSymlink(regularFile);
      expect(isLink).to.be.false;
    });
  });

  describe('getFileSize and isLargeFile', () => {
    /**
     * @ac US-003-AC-5: Supports large files (>10MB)
     */
    it('should get file size', async () => {
      const testFile = path.join(testDataDirectory, 'sized.txt');
      const content = 'x'.repeat(1024); // 1KB
      await fs.writeFile(testFile, content);

      const size = await getFileSize(testFile);
      expect(size).to.equal(1024);
    });

    it('should detect large files', async () => {
      const largeFile = path.join(testDataDirectory, 'large.txt');
      const content = 'x'.repeat(11 * 1024 * 1024); // 11MB
      await fs.writeFile(largeFile, content);

      const isLarge = await isLargeFile(largeFile, 10);
      expect(isLarge).to.be.true;
    });

    it('should detect small files', async () => {
      const smallFile = path.join(testDataDirectory, 'small.txt');
      await fs.writeFile(smallFile, 'small content');

      const isLarge = await isLargeFile(smallFile, 10);
      expect(isLarge).to.be.false;
    });

    it('should support custom threshold', async () => {
      const testFile = path.join(testDataDirectory, 'test.txt');
      const content = 'x'.repeat(2 * 1024 * 1024); // 2MB
      await fs.writeFile(testFile, content);

      const isLarge1MB = await isLargeFile(testFile, 1);
      const isLarge5MB = await isLargeFile(testFile, 5);

      expect(isLarge1MB).to.be.true;
      expect(isLarge5MB).to.be.false;
    });
  });
});
