/**
 * Tests for Error-Resilient Parser - US-071
 */
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { ErrorResilientParser } from '../../../src/parsers/error-resilient-parser.js';
import { resetErrorAggregator } from '../../../src/utils/error-aggregator.js';

describe('ErrorResilientParser', () => {
  let parser: ErrorResilientParser;

  beforeEach(() => {
    parser = new ErrorResilientParser();
    parser.clearErrors();
    resetErrorAggregator();
  });

  // Mock parser functions
  const failingParser = async (filePath: string) => {
    throw new Error(`Syntax error in ${filePath}:42:15: Unexpected token`);
  };

  const mixedParser = async (filePath: string) => {
    if (filePath.includes('bad')) {
      throw new Error(`Parse error in ${filePath}`);
    }
    return { name: filePath, content: 'ok' };
  };

  describe('US-071: Parse Error Handling', () => {
    /** @ac US-071-AC-1: Catch and log parse errors */
    it('US-071-AC-1: should catch and log parse errors', async () => {
      const result = await parser.parseFile('test-file.cls', failingParser);

      expect(result.success).to.be.false;
      expect(result.error).to.exist;
      expect(result.error?.message).to.include('Syntax error');

      // Should be logged
      expect(parser.getErrorCount()).to.equal(1);
    });

    /** @ac US-071-AC-2: Continue with other files */
    it('US-071-AC-2: should continue parsing other files after error', async () => {
      const files = ['good1.cls', 'bad.cls', 'good2.cls'];

      const results = await parser.parseFiles(files, mixedParser);

      expect(results).to.have.lengthOf(3);
      expect(ErrorResilientParser.getSuccessCount(results)).to.equal(2);
      expect(ErrorResilientParser.getFailureCount(results)).to.equal(1);
    });

    /** @ac US-071-AC-3: Report errors with file paths */
    it('US-071-AC-3: should report errors with file paths', async () => {
      await parser.parseFile('path/to/MyClass.cls', failingParser);

      const errors = parser.getErrors();
      expect(errors).to.have.lengthOf(1);
      expect(errors[0].filePath).to.equal('path/to/MyClass.cls');
    });

    /** @ac US-071-AC-4: Suggest fixes when possible */
    it('US-071-AC-4: should suggest fixes for known error types', async () => {
      await parser.parseFile('test.cls', failingParser);

      const errors = parser.getErrors();
      expect(errors[0].suggestedFix).to.exist;
      expect(errors[0].suggestedFix).to.be.a('string');
      expect(errors[0].suggestedFix).to.not.be.empty;
    });

    /** @ac US-071-AC-5: Aggregate error report */
    it('US-071-AC-5: should generate aggregate error report', async () => {
      const files = ['file1.cls', 'file2.cls', 'file3.cls'];
      await parser.parseFiles(files, failingParser);

      const report = parser.generateErrorReport();

      expect(report).to.include('Parse Error Report');
      expect(report).to.include('Total Errors: 3');
      expect(report).to.include('Errors by Type');
      expect(report).to.include('Error Details');
    });

    /** @ac US-071-AC-6: Option to fail-fast */
    it('US-071-AC-6: should stop on first error with fail-fast', async () => {
      const failFastParser = new ErrorResilientParser({ failFast: true });
      const files = ['file1.cls', 'file2.cls', 'file3.cls'];

      const results = await failFastParser.parseFiles(files, failingParser);

      // Should stop after first error
      expect(results).to.have.lengthOf(1);
      expect(results[0].success).to.be.false;
    });
  });

  describe('Error Categorization', () => {
    it('should categorize syntax errors', async () => {
      const syntaxError = async () => {
        throw new Error('Syntax error: Unexpected token');
      };

      await parser.parseFile('test.cls', syntaxError);
      const errors = parser.getErrors();

      expect(errors[0].errorType).to.equal('SyntaxError');
    });

    it('should categorize file not found errors', async () => {
      const fileNotFound = async () => {
        const error = new Error('ENOENT: no such file or directory');
        error.name = 'FileNotFoundError';
        throw error;
      };

      await parser.parseFile('test.cls', fileNotFound);
      const errors = parser.getErrors();

      expect(errors[0].errorType).to.equal('FileNotFoundError');
    });

    it('should extract line and column numbers', async () => {
      const errorWithLocation = async () => {
        throw new Error('Parse error at test.cls:123:45');
      };

      await parser.parseFile('test.cls', errorWithLocation);
      const errors = parser.getErrors();

      expect(errors[0].lineNumber).to.equal(123);
      expect(errors[0].columnNumber).to.equal(45);
    });
  });

  describe('Parser Options', () => {
    it('should support disabling error logging', async () => {
      const quietParser = new ErrorResilientParser({ logErrors: false });

      await quietParser.parseFile('test.cls', failingParser);

      // Error should still be tracked locally
      expect(quietParser.getErrorCount()).to.equal(1);
    });

    it('should support disabling fix suggestions', async () => {
      const noSuggestionsParser = new ErrorResilientParser({ suggestFixes: false });

      await noSuggestionsParser.parseFile('test.cls', failingParser);
      const errors = noSuggestionsParser.getErrors();

      expect(errors[0].suggestedFix).to.be.undefined;
    });
  });

  describe('Utility Methods', () => {
    it('should extract successful data', async () => {
      const files = ['good1.cls', 'bad.cls', 'good2.cls'];
      const results = await parser.parseFiles(files, mixedParser);

      const data = ErrorResilientParser.getSuccessfulData(results);

      expect(data).to.have.lengthOf(2);
      expect(data[0].name).to.equal('good1.cls');
      expect(data[1].name).to.equal('good2.cls');
    });

    it('should extract errors', async () => {
      const files = ['good.cls', 'bad1.cls', 'bad2.cls'];
      const results = await parser.parseFiles(files, mixedParser);

      const errors = ErrorResilientParser.getErrors(results);

      expect(errors).to.have.lengthOf(2);
    });

    it('should check if errors occurred', async () => {
      expect(parser.hasErrors()).to.be.false;

      await parser.parseFile('test.cls', failingParser);

      expect(parser.hasErrors()).to.be.true;
    });

    it('should clear errors', async () => {
      await parser.parseFile('test.cls', failingParser);
      expect(parser.hasErrors()).to.be.true;

      parser.clearErrors();
      expect(parser.hasErrors()).to.be.false;
      expect(parser.getErrorCount()).to.equal(0);
    });
  });

  describe('Error Report Generation', () => {
    it('should generate report when no errors', () => {
      const report = parser.generateErrorReport();

      expect(report).to.include('No parse errors encountered');
    });

    it('should group errors by type', async () => {
      const syntaxError = async () => {
        throw new Error('Syntax error');
      };
      const referenceError = async () => {
        throw new Error('Cannot find module');
      };

      await parser.parseFile('file1.cls', syntaxError);
      await parser.parseFile('file2.cls', syntaxError);
      await parser.parseFile('file3.cls', referenceError);

      const report = parser.generateErrorReport();

      expect(report).to.include('SyntaxError: 2');
      expect(report).to.include('ReferenceError: 1');
    });

    it('should limit error details to 20', async () => {
      const files = Array.from({ length: 25 }, (_, i) => `file${i}.cls`);
      await parser.parseFiles(files, failingParser);

      const report = parser.generateErrorReport();

      expect(report).to.include('and 5 more errors');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle mixed success/failure in batch', async () => {
      const files = ['good1.cls', 'bad1.cls', 'good2.cls', 'bad2.cls', 'good3.cls'];

      const results = await parser.parseFiles(files, mixedParser);

      expect(results).to.have.lengthOf(5);
      expect(ErrorResilientParser.getSuccessCount(results)).to.equal(3);
      expect(ErrorResilientParser.getFailureCount(results)).to.equal(2);
    });

    it('should provide detailed error information', async () => {
      await parser.parseFile('MyClass.cls', failingParser);

      const errors = parser.getErrors();
      const error = errors[0];

      expect(error.filePath).to.equal('MyClass.cls');
      expect(error.errorType).to.be.a('string');
      expect(error.message).to.be.a('string');
      expect(error.suggestedFix).to.be.a('string');
    });
  });
});
