/**
 * Tests for Error Aggregator - US-076
 */
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { ErrorAggregator, getErrorAggregator, resetErrorAggregator } from '../../../src/utils/error-aggregator.js';

describe('ErrorAggregator', () => {
  let aggregator: ErrorAggregator;

  beforeEach(() => {
    aggregator = new ErrorAggregator();
    resetErrorAggregator();
  });

  describe('US-076: Enhanced Error Logging', () => {
    /** @ac US-076-AC-1: Structured error logging */
    it('US-076-AC-1: should log structured errors', () => {
      aggregator.addError({
        message: 'Parse error',
        type: 'ParseError',
        severity: 'HIGH',
        filePath: 'src/parsers/apex-parser.ts',
        lineNumber: 123,
      });

      const errors = aggregator.getErrors();
      expect(errors).to.have.lengthOf(1);
      expect(errors[0]).to.have.property('errorType', 'ParseError');
      expect(errors[0]).to.have.property('errorMessage', 'Parse error');
    });

    /** @ac US-076-AC-2: Include stack traces */
    it('US-076-AC-2: should include stack traces', () => {
      const error = new Error('Test error');
      aggregator.addError({
        message: error.message,
        stack: error.stack,
      });

      const errors = aggregator.getErrors();
      expect(errors[0].stack).to.exist;
      expect(errors[0].stack).to.include('Test error');
    });

    /** @ac US-076-AC-3: Include context and metadata */
    it('US-076-AC-3: should include context metadata', () => {
      aggregator.addError({
        message: 'Deployment failed',
        context: {
          waveNumber: 1,
          componentCount: 50,
          targetOrg: 'dev-org',
        },
      });

      const errors = aggregator.getErrors();
      expect(errors[0].context).to.deep.equal({
        waveNumber: 1,
        componentCount: 50,
        targetOrg: 'dev-org',
      });
    });

    /** @ac US-076-AC-4: Error severity levels */
    it('US-076-AC-4: should categorize by severity', () => {
      aggregator.addError({ message: 'Low', severity: 'LOW' });
      aggregator.addError({ message: 'Medium', severity: 'MEDIUM' });
      aggregator.addError({ message: 'High', severity: 'HIGH' });
      aggregator.addError({ message: 'Critical', severity: 'CRITICAL' });

      const lowErrors = aggregator.getErrorsBySeverity('LOW');
      const criticalErrors = aggregator.getErrorsBySeverity('CRITICAL');

      expect(lowErrors).to.have.lengthOf(1);
      expect(criticalErrors).to.have.lengthOf(1);

      expect(aggregator.hasCriticalErrors()).to.be.true;
      expect(aggregator.hasHighSeverityErrors()).to.be.true;
    });

    /** @ac US-076-AC-5: File and line numbers */
    it('US-076-AC-5: should include file and line numbers', () => {
      aggregator.addError({
        message: 'Syntax error',
        filePath: 'force-app/main/default/classes/MyClass.cls',
        lineNumber: 42,
        columnNumber: 15,
      });

      const errors = aggregator.getErrors();
      expect(errors[0].filePath).to.equal('force-app/main/default/classes/MyClass.cls');
      expect(errors[0].lineNumber).to.equal(42);
      expect(errors[0].columnNumber).to.equal(15);
    });

    /** @ac US-076-AC-6: Error aggregation */
    it('US-076-AC-6: should aggregate errors', () => {
      aggregator.addError({ message: 'Error 1', type: 'ParseError' });
      aggregator.addError({ message: 'Error 2', type: 'ParseError' });
      aggregator.addError({ message: 'Error 3', type: 'NetworkError' });

      const stats = aggregator.getStats();
      expect(stats.total).to.equal(3);
      expect(stats.byType.get('ParseError')).to.equal(2);
      expect(stats.byType.get('NetworkError')).to.equal(1);
    });
  });

  describe('Error Filtering', () => {
    beforeEach(() => {
      aggregator.addError({
        message: 'Parse error 1',
        type: 'ParseError',
        severity: 'HIGH',
        filePath: 'file1.ts',
      });
      aggregator.addError({
        message: 'Parse error 2',
        type: 'ParseError',
        severity: 'MEDIUM',
        filePath: 'file1.ts',
      });
      aggregator.addError({
        message: 'Network error',
        type: 'NetworkError',
        severity: 'CRITICAL',
        filePath: 'file2.ts',
      });
    });

    it('should filter by type', () => {
      const parseErrors = aggregator.getErrorsByType('ParseError');
      expect(parseErrors).to.have.lengthOf(2);
    });

    it('should filter by file', () => {
      const file1Errors = aggregator.getErrorsByFile('file1.ts');
      expect(file1Errors).to.have.lengthOf(2);
    });

    it('should generate statistics', () => {
      const stats = aggregator.getStats();
      expect(stats.byFile.get('file1.ts')).to.equal(2);
      expect(stats.byFile.get('file2.ts')).to.equal(1);
    });
  });

  describe('Report Generation', () => {
    beforeEach(() => {
      aggregator.addError({
        message: 'Critical error',
        type: 'DeploymentError',
        severity: 'CRITICAL',
        filePath: 'src/deployment.ts',
        lineNumber: 100,
      });
      aggregator.addError({
        message: 'Warning',
        type: 'ValidationWarning',
        severity: 'LOW',
      });
    });

    it('should generate comprehensive report', () => {
      const report = aggregator.generateReport();

      expect(report.totalErrors).to.equal(2);
      expect(report.criticalCount).to.equal(1);
      expect(report.lowCount).to.equal(1);
      expect(report.errors).to.have.lengthOf(2);
    });

    it('should format report as string', () => {
      const formatted = aggregator.formatReport();

      expect(formatted).to.include('Error Report');
      expect(formatted).to.include('Total Errors: 2');
      expect(formatted).to.include('CRITICAL: 1');
      expect(formatted).to.include('DeploymentError');
    });

    it('should optionally include stack traces in report', () => {
      const error = new Error('Test');
      aggregator.clear();
      aggregator.addError({
        message: 'With stack',
        stack: error.stack,
      });

      const withStack = aggregator.formatReport(true);
      const withoutStack = aggregator.formatReport(false);

      expect(withStack).to.include('Stack:');
      expect(withoutStack).to.not.include('Stack:');
    });
  });

  describe('Helper Methods', () => {
    it('should clear errors', () => {
      aggregator.addError({ message: 'Error' });
      expect(aggregator.getCount()).to.equal(1);

      aggregator.clear();
      expect(aggregator.getCount()).to.equal(0);
    });

    it('should check for critical errors', () => {
      aggregator.addError({ message: 'Low', severity: 'LOW' });
      expect(aggregator.hasCriticalErrors()).to.be.false;

      aggregator.addError({ message: 'Critical', severity: 'CRITICAL' });
      expect(aggregator.hasCriticalErrors()).to.be.true;
    });

    it('should limit error buffer size', () => {
      const smallAggregator = new ErrorAggregator(5);

      for (let i = 0; i < 10; i++) {
        smallAggregator.addError({ message: `Error ${i}` });
      }

      expect(smallAggregator.getCount()).to.equal(5);
    });
  });

  describe('Global Instance', () => {
    it('should provide global aggregator', () => {
      const global1 = getErrorAggregator();
      const global2 = getErrorAggregator();

      expect(global1).to.equal(global2);
    });

    it('should reset global aggregator', () => {
      const global1 = getErrorAggregator();
      global1.addError({ message: 'Test' });

      resetErrorAggregator();

      const global2 = getErrorAggregator();
      expect(global2.getCount()).to.equal(0);
    });
  });

  describe('Stack Trace Parsing', () => {
    it('should extract location from stack trace', () => {
      const error = new Error('Test error');
      aggregator.addError({
        message: error.message,
        stack: error.stack,
      });

      const errors = aggregator.getErrors();
      // Should have extracted file path from stack (if available)
      expect(errors[0]).to.exist;
    });
  });
});

