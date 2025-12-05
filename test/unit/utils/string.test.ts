import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  REGEX_PATTERNS,
  escapeXml,
  extractApexComments,
  extractJavaScriptComments,
  extractNamespace,
  formatBytes,
  isCustom,
  isValidEmail,
  isValidSalesforceApiName,
  normalizeUnicode,
  normalizeWhitespace,
  pluralize,
  singularize,
  stripAccents,
  toCamelCase,
  toKebabCase,
  toPascalCase,
  toSnakeCase,
  toTitleCase,
  truncate,
  unescapeXml,
} from '../../../src/utils/string.js';

describe('String Utilities', () => {
  describe('Case Conversions', () => {
    /**
     * @ac US-011-AC-1: Case conversions (camelCase, PascalCase, snake_case)
     */
    it('should convert to camelCase', () => {
      expect(toCamelCase('hello_world')).to.equal('helloWorld');
      expect(toCamelCase('HelloWorld')).to.equal('helloWorld');
      expect(toCamelCase('hello-world')).to.equal('helloWorld');
      expect(toCamelCase('hello world')).to.equal('helloWorld');
      expect(toCamelCase('HELLO_WORLD')).to.equal('helloWorld');
    });

    /**
     * @ac US-011-AC-1: Case conversions (camelCase, PascalCase, snake_case)
     */
    it('should convert to PascalCase', () => {
      expect(toPascalCase('hello_world')).to.equal('HelloWorld');
      expect(toPascalCase('helloWorld')).to.equal('HelloWorld');
      expect(toPascalCase('hello-world')).to.equal('HelloWorld');
      expect(toPascalCase('hello world')).to.equal('HelloWorld');
    });

    /**
     * @ac US-011-AC-1: Case conversions (camelCase, PascalCase, snake_case)
     */
    it('should convert to snake_case', () => {
      expect(toSnakeCase('helloWorld')).to.equal('hello_world');
      expect(toSnakeCase('HelloWorld')).to.equal('hello_world');
      expect(toSnakeCase('hello-world')).to.equal('hello_world');
      expect(toSnakeCase('hello world')).to.equal('hello_world');
    });

    /**
     * @ac US-011-AC-1: Case conversions (camelCase, PascalCase, snake_case)
     */
    it('should convert to kebab-case', () => {
      expect(toKebabCase('helloWorld')).to.equal('hello-world');
      expect(toKebabCase('HelloWorld')).to.equal('hello-world');
      expect(toKebabCase('hello_world')).to.equal('hello-world');
    });

    it('should convert to TitleCase', () => {
      expect(toTitleCase('hello world')).to.equal('Hello World');
      expect(toTitleCase('HELLO WORLD')).to.equal('Hello World');
      expect(toTitleCase('hello')).to.equal('Hello');
    });
  });

  describe('Comment Extraction', () => {
    /**
     * @ac US-011-AC-2: Extract comments from Apex/JavaScript
     */
    it('should extract single-line comments from Apex', () => {
      const code = `
public class MyClass {
  // This is a comment
  public void method() {
    // Another comment
    System.debug('test');
  }
}`;

      const comments = extractApexComments(code);
      expect(comments).to.have.lengthOf(2);
      expect(comments[0]).to.include('This is a comment');
      expect(comments[1]).to.include('Another comment');
    });

    /**
     * @ac US-011-AC-2: Extract comments from Apex/JavaScript
     */
    it('should extract multi-line comments from Apex', () => {
      const code = `
/**
 * Class documentation
 */
public class MyClass {
  /* Block comment */
  public void method() {}
}`;

      const comments = extractApexComments(code);
      expect(comments).to.have.lengthOf(2);
      expect(comments[0]).to.include('Class documentation');
      expect(comments[1]).to.include('Block comment');
    });

    /**
     * @ac US-011-AC-2: Extract comments from Apex/JavaScript
     */
    it('should extract comments from JavaScript', () => {
      const code = `
// Function comment
function test() {
  /* Multi-line
     comment */
  return true;
}`;

      const comments = extractJavaScriptComments(code);
      expect(comments).to.have.lengthOf(2);
      expect(comments[0]).to.include('Function comment');
      expect(comments[1]).to.include('Multi-line');
    });
  });

  describe('XML Escaping', () => {
    /**
     * @ac US-011-AC-3: Escape/unescape XML special characters
     */
    it('should escape XML special characters', () => {
      expect(escapeXml('<tag>value & "quoted"</tag>')).to.equal(
        '&lt;tag&gt;value &amp; &quot;quoted&quot;&lt;/tag&gt;'
      );
      expect(escapeXml("value's")).to.equal('value&apos;s');
    });

    /**
     * @ac US-011-AC-3: Escape/unescape XML special characters
     */
    it('should unescape XML special characters', () => {
      expect(unescapeXml('&lt;tag&gt;value &amp; &quot;quoted&quot;&lt;/tag&gt;')).to.equal(
        '<tag>value & "quoted"</tag>'
      );
      expect(unescapeXml('value&apos;s')).to.equal("value's");
    });

    /**
     * @ac US-011-AC-3: Escape/unescape XML special characters
     */
    it('should handle round-trip escape/unescape', () => {
      const original = '<tag attr="value">content & more</tag>';
      const escaped = escapeXml(original);
      const unescaped = unescapeXml(escaped);
      expect(unescaped).to.equal(original);
    });
  });

  describe('Regex Utilities', () => {
    /**
     * @ac US-011-AC-4: Regex utilities for common patterns
     */
    it('should validate Salesforce API names', () => {
      expect(isValidSalesforceApiName('MyField__c')).to.be.true;
      expect(isValidSalesforceApiName('CustomObject__c')).to.be.true;
      expect(isValidSalesforceApiName('Account')).to.be.true;
      expect(isValidSalesforceApiName('Field_Name__c')).to.be.true;

      expect(isValidSalesforceApiName('123Invalid')).to.be.false;
      expect(isValidSalesforceApiName('Invalid-Name')).to.be.false;
      expect(isValidSalesforceApiName('')).to.be.false;
    });

    /**
     * @ac US-011-AC-4: Regex utilities for common patterns
     */
    it('should validate email addresses', () => {
      expect(isValidEmail('user@example.com')).to.be.true;
      expect(isValidEmail('test.user+tag@example.co.uk')).to.be.true;

      expect(isValidEmail('invalid-email')).to.be.false;
      expect(isValidEmail('@example.com')).to.be.false;
      expect(isValidEmail('user@')).to.be.false;
    });

    /**
     * @ac US-011-AC-4: Regex utilities for common patterns
     */
    it('should match Salesforce IDs', () => {
      expect(REGEX_PATTERNS.SALESFORCE_ID.test('001000000000000AAA')).to.be.true; // 18-char
      expect(REGEX_PATTERNS.SALESFORCE_ID.test('001000000000000')).to.be.true; // 15-char

      expect(REGEX_PATTERNS.SALESFORCE_ID.test('invalid')).to.be.false;
      expect(REGEX_PATTERNS.SALESFORCE_ID.test('001')).to.be.false;
    });

    /**
     * @ac US-011-AC-4: Regex utilities for common patterns
     */
    it('should match custom field suffixes', () => {
      expect(REGEX_PATTERNS.CUSTOM_FIELD_SUFFIX.test('MyField__c')).to.be.true;
      expect(REGEX_PATTERNS.CUSTOM_FIELD_SUFFIX.test('Name')).to.be.false;
    });

    /**
     * @ac US-011-AC-4: Regex utilities for common patterns
     */
    it('should match metadata files', () => {
      expect(REGEX_PATTERNS.METADATA_FILE.test('MyClass.cls-meta.xml')).to.be.true;
      expect(REGEX_PATTERNS.METADATA_FILE.test('MyObject.object-meta.xml')).to.be.true;
      expect(REGEX_PATTERNS.METADATA_FILE.test('MyClass.cls')).to.be.false;
    });
  });

  describe('Unicode Handling', () => {
    /**
     * @ac US-011-AC-5: Unicode handling
     */
    it('should normalize Unicode strings', () => {
      const unnormalized = 'café'; // May be composed differently
      const normalized = normalizeUnicode(unnormalized);
      expect(normalized).to.be.a('string');
      expect(normalized.length).to.be.greaterThan(0);
    });

    /**
     * @ac US-011-AC-5: Unicode handling
     */
    it('should strip accents from Unicode strings', () => {
      expect(stripAccents('café')).to.equal('cafe');
      expect(stripAccents('naïve')).to.equal('naive');
      expect(stripAccents('Zürich')).to.equal('Zurich');
      expect(stripAccents('São Paulo')).to.equal('Sao Paulo');
    });

    /**
     * @ac US-011-AC-5: Unicode handling
     */
    it('should handle ASCII strings without changes', () => {
      const ascii = 'Hello World';
      expect(stripAccents(ascii)).to.equal(ascii);
      expect(normalizeUnicode(ascii)).to.equal(ascii);
    });
  });

  describe('Additional Utilities', () => {
    it('should truncate strings', () => {
      expect(truncate('Hello World', 8)).to.equal('Hello...');
      expect(truncate('Short', 10)).to.equal('Short');
      expect(truncate('Test', 4)).to.equal('Test');
      expect(truncate('LongString', 6, '…')).to.equal('LongS…');
    });

    it('should pluralize words', () => {
      expect(pluralize('field')).to.equal('fields');
      expect(pluralize('class')).to.equal('classes');
      expect(pluralize('entry')).to.equal('entries');
      expect(pluralize('box')).to.equal('boxes');
      expect(pluralize('buzz')).to.equal('buzzes');
    });

    it('should singularize words', () => {
      expect(singularize('fields')).to.equal('field');
      expect(singularize('classes')).to.equal('class');
      expect(singularize('entries')).to.equal('entry');
      expect(singularize('boxes')).to.equal('box');
    });

    it('should normalize whitespace', () => {
      expect(normalizeWhitespace('hello    world')).to.equal('hello world');
      expect(normalizeWhitespace('  spaces  ')).to.equal('spaces');
      expect(normalizeWhitespace('single')).to.equal('single');
    });

    it('should extract namespace from Salesforce API names', () => {
      expect(extractNamespace('MyNamespace__CustomObject__c')).to.equal('MyNamespace');
      expect(extractNamespace('ns__CustomField__c')).to.equal('ns');
      expect(extractNamespace('StandardObject')).to.be.null;
      expect(extractNamespace('Account')).to.be.null;
    });

    it('should identify custom fields and objects', () => {
      expect(isCustom('MyField__c')).to.be.true;
      expect(isCustom('CustomObject__c')).to.be.true;
      expect(isCustom('Name')).to.be.false;
      expect(isCustom('Account')).to.be.false;
    });

    it('should format bytes to human-readable strings', () => {
      expect(formatBytes(0)).to.equal('0 Bytes');
      expect(formatBytes(1024)).to.equal('1.00 KB');
      expect(formatBytes(1048576)).to.equal('1.00 MB');
      expect(formatBytes(1073741824)).to.equal('1.00 GB');
      expect(formatBytes(1536, 0)).to.equal('2 KB');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      expect(toCamelCase('')).to.equal('');
      expect(toPascalCase('')).to.equal('');
      expect(toSnakeCase('')).to.equal('');
      expect(escapeXml('')).to.equal('');
      expect(unescapeXml('')).to.equal('');
    });

    it('should handle strings with special characters', () => {
      expect(normalizeWhitespace('\t\n\r')).to.equal('');
      expect(truncate('', 5)).to.equal('');
    });

    it('should handle non-standard input gracefully', () => {
      expect(extractApexComments('')).to.deep.equal([]);
      expect(extractJavaScriptComments('no comments here')).to.deep.equal([]);
      expect(extractNamespace('')).to.be.null;
    });
  });
});
