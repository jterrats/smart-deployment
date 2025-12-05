import fs from 'node:fs/promises';
import path from 'node:path';
import { expect } from 'chai';
import { readFileWithEncoding, scanDirectory, parseXmlFile } from '../../../src/utils/file-system.js';

describe('File System Utilities', () => {
  const testDataDirectory = path.join(process.cwd(), 'test', 'fixtures', 'file-system');

  before(async () => {
    // Create test fixtures directory
    await fs.mkdir(testDataDirectory, { recursive: true });
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
    });

    it('should detect binary files', async () => {
      const binaryFilePath = path.join(testDataDirectory, 'binary-test.bin');
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff]);
      await fs.writeFile(binaryFilePath, binaryData);

      const fileContent = await readFileWithEncoding(binaryFilePath);

      expect(fileContent.isBinary).to.be.true;
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

      expect(parsedXml.isValid).to.be.true;
      expect(parsedXml.root).to.exist;
      expect(parsedXml.root?.name).to.equal('ApexClass');
    });

    it('should detect invalid XML', async () => {
      const invalidXmlPath = path.join(testDataDirectory, 'invalid.xml');
      const invalidXmlContent = '<ApexClass><unclosed>';

      await fs.writeFile(invalidXmlPath, invalidXmlContent, 'utf-8');

      const parsedXml = await parseXmlFile(invalidXmlPath);

      expect(parsedXml.isValid).to.be.false;
      expect(parsedXml.errors).to.have.lengthOf.at.least(1);
    });

    /**
     * @ac US-003-AC-6: Proper error messages with file paths
     */
    it('should provide detailed error messages for malformed XML', async () => {
      const malformedXmlPath = path.join(testDataDirectory, 'malformed.xml');
      const malformedContent = '<Root><Tag>unclosed</Root>';

      await fs.writeFile(malformedXmlPath, malformedContent, 'utf-8');

      const parsedXml = await parseXmlFile(malformedXmlPath);

      expect(parsedXml.isValid).to.be.false;
      expect(parsedXml.errors[0]).to.include(malformedXmlPath);
    });
  });

  after(async () => {
    // Cleanup test fixtures
    try {
      await fs.rm(testDataDirectory, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });
});
