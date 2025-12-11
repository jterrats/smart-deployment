/**
 * Tests for Response Parser - US-059
 */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { ResponseParser } from '../../../src/ai/response-parser.js';

describe('ResponseParser', () => {
  const parser = new ResponseParser();

  describe('US-059: AI Response Parser', () => {
    /** @ac US-059-AC-1: Parse JSON responses */
    it('US-059-AC-1: should parse JSON responses', () => {
      const content = '```json\n{"name": "TestClass", "type": "ApexClass"}\n```';

      const result = parser.parse(content);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal({ name: 'TestClass', type: 'ApexClass' });
    });

    /** @ac US-059-AC-2: Handle malformed responses */
    it('US-059-AC-2: should handle malformed responses', () => {
      const content = 'Here is some text {"name": "TestClass"} more text';

      const result = parser.parse(content);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal({ name: 'TestClass' });
    });

    it('US-059-AC-2: should handle completely invalid responses', () => {
      const content = 'This is not JSON at all!';

      const result = parser.parse(content);

      expect(result.success).to.be.false;
      expect(result.errors).to.have.lengthOf.at.least(1);
    });

    /** @ac US-059-AC-3: Extract structured data */
    it('US-059-AC-3: should extract structured arrays', () => {
      const content = '[{"id": 1}, {"id": 2}, {"id": 3}]';

      const result = parser.parseArray<{ id: number }>(content);

      expect(result.success).to.be.true;
      expect(result.data).to.be.an('array');
      expect(result.data).to.have.lengthOf(3);
    });

    it('US-059-AC-3: should detect non-array responses', () => {
      const content = '{"notAnArray": true}';

      const result = parser.parseArray(content);

      expect(result.success).to.be.false;
      expect(result.errors).to.include('Response is not an array');
    });

    /** @ac US-059-AC-4: Validate response schema */
    it('US-059-AC-4: should validate response schema', () => {
      const content = '{"name": "Test", "age": 25}';
      const schema = { name: 'string', age: 'number' };

      const result = parser.parse(content, schema);

      expect(result.success).to.be.true;
      expect(result.confidence).to.be.greaterThan(0.8);
    });

    it('US-059-AC-4: should detect schema violations', () => {
      const content = '{"name": "Test"}';
      const schema = { name: 'string', age: 'number', email: 'string' };

      const result = parser.parse(content, schema);

      expect(result.success).to.be.false;
      expect(result.warnings).to.have.lengthOf.at.least(2);
    });

    /** @ac US-059-AC-5: Handle AI hallucinations */
    it('US-059-AC-5: should detect AI hallucinations', () => {
      const content = '{"name": "I apologize, but this is an example", "type": "placeholder"}';

      const result = parser.parse(content);

      expect(result.hallucinationDetected).to.be.true;
      expect(result.warnings).to.have.lengthOf.at.least(1);
    });

    it('US-059-AC-5: should detect suspicious generic values', () => {
      const content = '{"description": "This is a TODO item", "name": "Example Component"}';

      const result = parser.parse(content);

      expect(result.hallucinationDetected).to.be.true;
      expect(result.warnings.some((w) => w.includes('generic'))).to.be.true;
    });

    /** @ac US-059-AC-6: Confidence scoring */
    it('US-059-AC-6: should calculate confidence scores', () => {
      const perfectContent = '{"name": "Test", "type": "ApexClass"}';
      const schema = { name: 'string', type: 'string' };

      const result = parser.parse(perfectContent, schema);

      expect(result.confidence).to.be.greaterThan(0.9);
    });

    it('US-059-AC-6: should reduce confidence for issues', () => {
      const problematicContent = '{"name": "", "type": "example"}';
      const schema = { name: 'string', type: 'string' };

      const result = parser.parse(problematicContent, schema);

      expect(result.confidence).to.be.lessThan(0.9);
    });
  });

  describe('JSON Extraction', () => {
    it('should extract JSON from code blocks', () => {
      const content = '```json\n{"key": "value"}\n```';

      const result = parser.parse(content);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal({ key: 'value' });
    });

    it('should extract raw JSON objects', () => {
      const content = 'Text before {"key": "value"} text after';

      const result = parser.parse(content);

      expect(result.success).to.be.true;
    });

    it('should extract JSON arrays', () => {
      const content = 'Here is the data: [1, 2, 3]';

      const result = parser.parse(content);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal([1, 2, 3]);
    });
  });

  describe('Report Formatting', () => {
    it('should format success report', () => {
      const content = '{"success": true}';
      const result = parser.parse(content);
      const report = parser.formatReport(result);

      expect(report).to.include('Success');
      expect(report).to.include('Confidence');
    });

    it('should format failure report', () => {
      const content = 'invalid json';
      const result = parser.parse(content);
      const report = parser.formatReport(result);

      expect(report).to.include('Failed');
      expect(report).to.include('Errors');
    });

    it('should show hallucination warning', () => {
      const content = '{"message": "I apologize"}';
      const result = parser.parse(content);
      const report = parser.formatReport(result);

      expect(report).to.include('Hallucination');
    });
  });
});
