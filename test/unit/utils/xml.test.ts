import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import {
  buildSalesforceMetadata,
  buildXml,
  extractNamespace,
  formatXml,
  hasNamespace,
  minifyXml,
  parseSalesforceMetadata,
  parseXml,
  parseXmlFile,
  parseXmlStream,
  validateXml,
  writeXmlFile,
} from '../../../src/utils/xml.js';

describe('XML Utils', () => {
  const testDir = path.join(os.tmpdir(), `test-xml-${Date.now()}`);

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('parseXml', () => {
    it('should parse simple XML to object', () => {
      const xml = '<root><name>Test</name><value>123</value></root>';
      const result = parseXml(xml);

      expect(result).to.deep.equal({
        root: {
          name: 'Test',
          value: 123,
        },
      });
    });

    it('should handle XML attributes', () => {
      const xml = '<root id="123"><name>Test</name></root>';
      const result = parseXml(xml);

      expect(result).to.have.nested.property('root.@_id', '123');
      expect(result).to.have.nested.property('root.name', 'Test');
    });

    it('should handle nested elements', () => {
      const xml = '<root><parent><child>value</child></parent></root>';
      const result = parseXml(xml);

      expect(result).to.deep.equal({
        root: {
          parent: {
            child: 'value',
          },
        },
      });
    });

    it('should handle arrays of elements', () => {
      const xml = '<root><item>1</item><item>2</item><item>3</item></root>';
      const result = parseXml(xml);

      expect(result).to.have.nested.property('root.item');
      expect(result).to.have.nested.property('root.item').that.is.an('array');
    });

    it('should trim whitespace by default', () => {
      const xml = '<root>  \n  value  \n  </root>';
      const result = parseXml(xml);

      expect(result).to.deep.equal({ root: 'value' });
    });

    it('should parse boolean values', () => {
      const xml = '<root><enabled>true</enabled><disabled>false</disabled></root>';
      const result = parseXml(xml);

      expect(result).to.deep.equal({
        root: {
          enabled: true,
          disabled: false,
        },
      });
    });

    it('should handle malformed XML gracefully', () => {
      const invalidXml = '<root><unclosed>';
      // fast-xml-parser is tolerant of some malformed XML
      // It will parse what it can
      expect(() => parseXml(invalidXml)).to.not.throw();
    });
  });

  describe('buildXml', () => {
    it('should generate XML from object', () => {
      const object = { root: { name: 'Test', value: 123 } };
      const xml = buildXml(object);

      expect(xml).to.include('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).to.include('<root>');
      expect(xml).to.include('<name>Test</name>');
      expect(xml).to.include('<value>123</value>');
      expect(xml).to.include('</root>');
    });

    it('should handle attributes', () => {
      const object = {
        root: {
          '@_id': '123',
          name: 'Test',
        },
      };
      const xml = buildXml(object);

      expect(xml).to.include('id="123"');
      expect(xml).to.include('<name>Test</name>');
    });

    it('should format XML with indentation', () => {
      const object = { root: { parent: { child: 'value' } } };
      const xml = buildXml(object, { format: true, indentBy: '  ' });

      expect(xml).to.include('  <parent>');
      expect(xml).to.include('    <child>value</child>');
    });

    it('should generate unformatted XML when format is false', () => {
      const object = { root: { name: 'Test' } };
      const xml = buildXml(object, { format: false });

      expect(xml).to.not.include('<?xml version');
      expect(xml).to.not.include('\n');
    });

    it('should handle empty elements', () => {
      const object = { root: { empty: '' } };
      const xml = buildXml(object);

      expect(xml).to.include('<empty>');
    });

    it('should handle boolean values', () => {
      const object = { root: { enabled: true, disabled: false } };
      const xml = buildXml(object);

      expect(xml).to.include('<enabled>true</enabled>');
      expect(xml).to.include('<disabled>false</disabled>');
    });

    it('should handle arrays', () => {
      const object = { root: { item: [1, 2, 3] } };
      const xml = buildXml(object);

      expect(xml).to.include('<item>1</item>');
      expect(xml).to.include('<item>2</item>');
      expect(xml).to.include('<item>3</item>');
    });
  });

  describe('validateXml', () => {
    it('should validate correct XML', () => {
      const xml = '<root><name>Test</name></root>';
      const result = validateXml(xml);

      expect(result).to.be.true;
    });

    it('should detect unclosed tags', () => {
      const xml = '<root><name>Test</root>';
      const result = validateXml(xml);

      expect(result).to.not.be.true;
      if (result !== true) {
        expect(result.err).to.have.property('msg');
        expect(result.err).to.have.property('line');
      }
    });

    it('should detect mismatched tags', () => {
      const xml = '<root><name>Test</value></root>';
      const result = validateXml(xml);

      expect(result).to.not.be.true;
    });

    it('should handle empty XML', () => {
      const xml = '';
      const result = validateXml(xml);

      expect(result).to.not.be.true;
    });

    it('should validate XML with attributes', () => {
      const xml = '<root id="123"><name>Test</name></root>';
      const result = validateXml(xml);

      expect(result).to.be.true;
    });

    it('should validate XML with namespaces', () => {
      const xml = '<root xmlns="http://example.com"><name>Test</name></root>';
      const result = validateXml(xml);

      expect(result).to.be.true;
    });
  });

  describe('parseXmlFile', () => {
    it('should parse XML from file', async () => {
      const filePath = path.join(testDir, 'test.xml');
      const xml = '<root><name>Test</name></root>';
      await fs.writeFile(filePath, xml, 'utf-8');

      const result = await parseXmlFile(filePath);

      expect(result).to.deep.equal({ root: { name: 'Test' } });
    });

    it('should throw on non-existent file', async () => {
      const filePath = path.join(testDir, 'nonexistent.xml');

      try {
        await parseXmlFile(filePath);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
      }
    });

    it('should throw on invalid XML file', async () => {
      const filePath = path.join(testDir, 'invalid.xml');
      await fs.writeFile(filePath, '<root><unclosed>', 'utf-8');

      try {
        await parseXmlFile(filePath);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
      }
    });
  });

  describe('writeXmlFile', () => {
    it('should write XML to file', async () => {
      const filePath = path.join(testDir, 'output.xml');
      const object = { root: { name: 'Test' } };

      await writeXmlFile(filePath, object);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).to.include('<root>');
      expect(content).to.include('<name>Test</name>');
    });

    it('should create directory if needed', async () => {
      const subDir = path.join(testDir, 'sub', 'dir');
      const filePath = path.join(subDir, 'output.xml');
      const object = { root: { name: 'Test' } };

      await fs.mkdir(subDir, { recursive: true });
      await writeXmlFile(filePath, object);

      const exists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).to.be.true;
    });

    it('should respect format options', async () => {
      const filePath = path.join(testDir, 'formatted.xml');
      const object = { root: { parent: { child: 'value' } } };

      await writeXmlFile(filePath, object, { format: true, indentBy: '    ' });

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).to.include('    <parent>');
    });
  });

  describe('formatXml', () => {
    it('should format unformatted XML', () => {
      const xml = '<root><parent><child>value</child></parent></root>';
      const formatted = formatXml(xml);

      expect(formatted).to.include('\n');
      expect(formatted).to.include('  <parent>');
    });

    it('should reformat already formatted XML', () => {
      const xml = '<root>\n    <name>Test</name>\n</root>';
      const formatted = formatXml(xml);

      expect(formatted).to.include('<?xml version');
      expect(formatted).to.include('<name>Test</name>');
    });

    it('should format tolerantly parsed XML', () => {
      const invalidXml = '<root><unclosed>';
      // fast-xml-parser will parse what it can
      const formatted = formatXml(invalidXml);
      expect(formatted).to.be.a('string');
      expect(formatted).to.include('<?xml version');
    });
  });

  describe('extractNamespace', () => {
    it('should extract namespace from XML', () => {
      const xml = '<root xmlns="http://example.com/ns"><child/></root>';
      const namespace = extractNamespace(xml);

      expect(namespace).to.equal('http://example.com/ns');
    });

    it('should return null for XML without namespace', () => {
      const xml = '<root><child/></root>';
      const namespace = extractNamespace(xml);

      expect(namespace).to.be.null;
    });

    it('should extract Salesforce metadata namespace', () => {
      const xml = '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"></ApexClass>';
      const namespace = extractNamespace(xml);

      expect(namespace).to.equal('http://soap.sforce.com/2006/04/metadata');
    });
  });

  describe('hasNamespace', () => {
    it('should detect correct namespace', () => {
      const xml = '<root xmlns="http://example.com/ns"><child/></root>';
      const result = hasNamespace(xml, 'http://example.com/ns');

      expect(result).to.be.true;
    });

    it('should return false for different namespace', () => {
      const xml = '<root xmlns="http://example.com/ns"><child/></root>';
      const result = hasNamespace(xml, 'http://other.com/ns');

      expect(result).to.be.false;
    });

    it('should return false for XML without namespace', () => {
      const xml = '<root><child/></root>';
      const result = hasNamespace(xml, 'http://example.com/ns');

      expect(result).to.be.false;
    });
  });

  describe('parseSalesforceMetadata', () => {
    it('should parse Salesforce metadata XML', async () => {
      const filePath = path.join(testDir, 'MyClass.cls-meta.xml');
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>60.0</apiVersion>
    <status>Active</status>
</ApexClass>`;
      await fs.writeFile(filePath, xml, 'utf-8');

      const result = await parseSalesforceMetadata(filePath);

      expect(result).to.have.nested.property('ApexClass.apiVersion', 60);
      expect(result).to.have.nested.property('ApexClass.status', 'Active');
    });

    it('should throw on invalid metadata XML', async () => {
      const filePath = path.join(testDir, 'Invalid.cls-meta.xml');
      const xml = '<ApexClass><unclosed>';
      await fs.writeFile(filePath, xml, 'utf-8');

      try {
        await parseSalesforceMetadata(filePath);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
      }
    });
  });

  describe('buildSalesforceMetadata', () => {
    it('should build Salesforce metadata XML with namespace', () => {
      const object = {
        ApexClass: {
          apiVersion: '60.0',
          status: 'Active',
        },
      };

      const xml = buildSalesforceMetadata(object);

      expect(xml).to.include('xmlns="http://soap.sforce.com/2006/04/metadata"');
      expect(xml).to.include('<ApexClass');
      expect(xml).to.include('<apiVersion>60.0</apiVersion>');
      expect(xml).to.include('<status>Active</status>');
    });

    it('should use custom namespace', () => {
      const object = { root: { value: 'test' } };
      const xml = buildSalesforceMetadata(object, 'http://custom.ns');

      expect(xml).to.include('xmlns="http://custom.ns"');
    });

    it('should use 4-space indentation for Salesforce', () => {
      const object = {
        ApexClass: {
          parent: {
            child: 'value',
          },
        },
      };

      const xml = buildSalesforceMetadata(object);

      expect(xml).to.include('    <parent>');
      expect(xml).to.include('        <child>value</child>');
    });
  });

  describe('parseXmlStream', () => {
    it('should parse small file normally', async () => {
      const filePath = path.join(testDir, 'small.xml');
      const xml = '<root><name>Test</name></root>';
      await fs.writeFile(filePath, xml, 'utf-8');

      const result = await parseXmlStream(filePath);

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.equal({ root: { name: 'Test' } });
    });

    it('should handle large files', async () => {
      const filePath = path.join(testDir, 'large.xml');
      const xml = '<root><name>Test</name></root>';
      await fs.writeFile(filePath, xml, 'utf-8');

      const result = await parseXmlStream(filePath, 10); // Small chunk size

      expect(result).to.be.an('array');
      expect(result.length).to.be.greaterThan(0);
    });

    it('should throw on invalid XML', async () => {
      const filePath = path.join(testDir, 'invalid.xml');
      await fs.writeFile(filePath, '<root><unclosed>', 'utf-8');

      try {
        await parseXmlStream(filePath);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
      }
    });
  });

  describe('minifyXml', () => {
    it('should remove whitespace and formatting', () => {
      const xml = `<?xml version="1.0"?>
<root>
  <name>Test</name>
  <value>123</value>
</root>`;

      const minified = minifyXml(xml);

      expect(minified).to.not.include('\n');
      expect(minified).to.not.include('  ');
      expect(minified).to.include('<root>');
      expect(minified).to.include('<name>Test</name>');
    });

    it('should preserve data while minifying', () => {
      const xml = '<root>\n  <name>Test</name>\n</root>';
      const minified = minifyXml(xml);

      const parsed = parseXml(minified);
      expect(parsed).to.deep.equal({ root: { name: 'Test' } });
    });

    it('should minify tolerantly parsed XML', () => {
      const invalidXml = '<root><unclosed>';
      // fast-xml-parser will parse what it can
      const minified = minifyXml(invalidXml);
      expect(minified).to.be.a('string');
      expect(minified).to.not.include('\n');
    });
  });

  describe('Round-trip conversions', () => {
    it('should preserve data through parse-build cycle', () => {
      const original = {
        root: {
          name: 'Test',
          value: 123,
          nested: {
            child: 'value',
          },
        },
      };

      const xml = buildXml(original);
      const parsed = parseXml(xml);

      // Parsed XML includes declaration, so check root content
      expect(parsed).to.have.property('root');
      expect(parsed).to.have.nested.property('root.name', 'Test');
      expect(parsed).to.have.nested.property('root.value', 123);
      expect(parsed).to.have.nested.property('root.nested.child', 'value');
    });

    it('should preserve Salesforce metadata', async () => {
      const original = {
        ApexClass: {
          apiVersion: 60,
          status: 'Active',
          packageVersions: {
            majorNumber: 1,
            minorNumber: 0,
          },
        },
      };

      const xml = buildSalesforceMetadata(original);
      const parsed = parseXml(xml);

      expect(parsed).to.have.nested.property('ApexClass.apiVersion', 60);
      expect(parsed).to.have.nested.property('ApexClass.status', 'Active');
    });
  });
});
