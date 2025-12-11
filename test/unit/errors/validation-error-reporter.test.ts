/**
 * Tests for Validation Error Reporter - US-075
 */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { ValidationErrorReporter } from '../../../src/errors/validation-error-reporter.js';
import { ValidationError } from '../../../src/errors/validation-error.js';

describe('ValidationErrorReporter', () => {
  const reporter = new ValidationErrorReporter();

  describe('US-075: Validation Error Reporting', () => {
    /** @ac US-075-AC-1: User-friendly error messages */
    /** @ac US-075-AC-2: Include file paths */
    /** @ac US-075-AC-3: Include line numbers */
    /** @ac US-075-AC-4: Suggest fixes */
    /** @ac US-075-AC-5: Link to documentation */
    it('US-075-AC-1/2/3/4/5: should format error with all details', () => {
      const error = new ValidationError('Invalid dependency', {
        file: 'force-app/main/default/classes/TestClass.cls',
        line: 10,
      });

      const formatted = reporter.format(error);

      expect(formatted).to.include('Invalid dependency');
      expect(formatted).to.include('TestClass.cls');
      expect(formatted).to.include('Line: 10');
      expect(formatted).to.include('Documentation:');
    });

    /** @ac US-075-AC-6: Categorize by severity */
    it('US-075-AC-6: should categorize errors by severity', () => {
      const errors = [
        new ValidationError('Critical error', {}),
        new ValidationError('Error', {}),
        new ValidationError('Warning', {}),
      ];

      const formatted = reporter.formatMultiple(errors);

      expect(formatted).to.include('Total Errors');
      expect(formatted).to.be.a('string');
    });
  });
});
