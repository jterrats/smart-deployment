import { expect } from 'chai';
import {
  SmartDeploymentError,
  ParsingError,
  XmlParsingError,
  JsonParsingError,
  ProjectStructureError,
  DependencyError,
  CircularDependencyError,
  MissingDependencyError,
  DependencyComplexityError,
  DeploymentError,
  TestFailureError,
  DeploymentTimeoutError,
  DeploymentLimitError,
  SalesforceApiError,
  ValidationError,
  ApiVersionError,
  FileNotFoundError,
  PermissionError,
  isSmartDeploymentError,
  getErrorMessage,
  getErrorContext,
  getErrorSuggestions,
} from '../../../src/errors/index.js';

describe('Error Types', () => {
  describe('SmartDeploymentError (Base)', () => {
    /**
     * @ac US-008-AC-1: All errors include context
     */
    it('should include context information', () => {
      const context = { filePath: '/path/to/file.xml', line: 42 };
      const error = new ParsingError('Test error', context);

      expect(error.context).to.deep.equal(context);
      expect(error.context.filePath).to.equal('/path/to/file.xml');
      expect(error.context.line).to.equal(42);
    });

    /**
     * @ac US-008-AC-2: All errors include suggestions
     */
    it('should include actionable suggestions', () => {
      const error = new ParsingError('XML parsing failed', {
        filePath: 'test.xml',
        line: 10,
      });

      expect(error.suggestions).to.be.an('array');
      expect(error.suggestions.length).to.be.greaterThan(0);
      expect(error.suggestions[0]).to.be.a('string');
    });

    /**
     * @ac US-008-AC-6: Errors are serializable
     */
    it('should be JSON serializable', () => {
      const error = new ParsingError('Test error', { key: 'value' });
      const json = error.toJSON();

      expect(json).to.have.property('name');
      expect(json).to.have.property('code');
      expect(json).to.have.property('message');
      expect(json).to.have.property('context');
      expect(json).to.have.property('suggestions');
      expect(json).to.have.property('timestamp');
      expect(json).to.have.property('stack');

      // Verify JSON.stringify works
      const jsonString = JSON.stringify(error);
      expect(jsonString).to.be.a('string');
      expect(jsonString).to.include('Test error');
    });

    it('should preserve stack trace', () => {
      const error = new ParsingError('Test error');

      expect(error.stack).to.exist;
      expect(error.stack).to.include('ParsingError');
      expect(error.stack).to.include('Test error');
    });

    it('should have correct error name', () => {
      const error = new ParsingError('Test');
      expect(error.name).to.equal('ParsingError');
    });

    it('should maintain instanceof check', () => {
      const error = new ParsingError('Test');

      expect(error instanceof ParsingError).to.be.true;
      expect(error instanceof SmartDeploymentError).to.be.true;
      expect(error instanceof Error).to.be.true;
    });

    it('should format error message with toString()', () => {
      const error = new ParsingError('Test error', { filePath: 'test.xml' });
      const formatted = error.toString();

      expect(formatted).to.include('ParsingError');
      expect(formatted).to.include('Test error');
      expect(formatted).to.include('Context:');
      // ParsingError with XML file generates suggestions
      expect(error.suggestions.length).to.be.greaterThan(0);
      expect(formatted).to.include('Suggestions:');
    });

    it('should have timestamp', () => {
      const before = new Date();
      const error = new ParsingError('Test');
      const after = new Date();

      expect(error.timestamp).to.be.instanceOf(Date);
      expect(error.timestamp.getTime()).to.be.at.least(before.getTime());
      expect(error.timestamp.getTime()).to.be.at.most(after.getTime());
    });
  });

  describe('ParsingError', () => {
    /**
     * @ac US-008-AC-3: ParsingError for parsing failures
     */
    it('should create ParsingError with file context', () => {
      const error = new ParsingError('Failed to parse', {
        filePath: '/path/to/file.xml',
        line: 42,
        column: 15,
      });

      expect(error.code).to.equal('PARSING_ERROR');
      expect(error.message).to.include('Failed to parse');
      expect(error.context.filePath).to.equal('/path/to/file.xml');
    });

    it('should provide XML-specific suggestions for XML files', () => {
      const error = new XmlParsingError('Invalid XML', { filePath: 'test.xml' });

      expect(error.suggestions).to.exist;
      const suggestionsText = error.suggestions.join(' ');
      expect(suggestionsText).to.include('XML');
    });

    it('should provide JSON-specific suggestions for JSON files', () => {
      const error = new JsonParsingError('Invalid JSON', { filePath: 'test.json' });

      expect(error.suggestions).to.exist;
      const suggestionsText = error.suggestions.join(' ');
      expect(suggestionsText).to.include('JSON');
    });

    it('should provide line/column suggestions when available', () => {
      const error = new ParsingError('Parse error', {
        filePath: 'test.xml',
        line: 42,
        column: 15,
      });

      const suggestionsText = error.suggestions.join(' ');
      expect(suggestionsText).to.include('line 42');
      expect(suggestionsText).to.include('column 15');
    });
  });

  describe('ProjectStructureError', () => {
    it('should provide project-specific suggestions', () => {
      const error = new ProjectStructureError('Invalid sfdx-project.json');

      expect(error.suggestions).to.exist;
      const suggestionsText = error.suggestions.join(' ');
      expect(suggestionsText).to.include('sfdx-project.json');
      expect(suggestionsText).to.include('packageDirectories');
    });
  });

  describe('DependencyError', () => {
    /**
     * @ac US-008-AC-4: DependencyError for dependency issues
     */
    it('should create DependencyError with cycle context', () => {
      const cycle = ['A', 'B', 'C', 'A'];
      const error = new DependencyError('Circular dependency', {
        cycle,
      });

      expect(error.code).to.equal('DEPENDENCY_ERROR');
      expect(error.context.cycle).to.deep.equal(cycle);
    });

    it('should suggest breaking circular dependencies', () => {
      const error = new CircularDependencyError(['A', 'B', 'A']);

      const suggestionsText = error.suggestions.join(' ');
      expect(suggestionsText).to.include('circular');
      expect(suggestionsText).to.include('cycle');
    });
  });

  describe('CircularDependencyError', () => {
    it('should format cycle in message', () => {
      const cycle = ['ApexClass:A', 'ApexClass:B', 'ApexClass:C', 'ApexClass:A'];
      const error = new CircularDependencyError(cycle);

      expect(error.message).to.include('ApexClass:A → ApexClass:B → ApexClass:C → ApexClass:A');
      expect(error.context.cycle).to.deep.equal(cycle);
      expect(error.context.cycleLength).to.equal(4);
    });
  });

  describe('MissingDependencyError', () => {
    it('should provide specific missing dependency info', () => {
      const error = new MissingDependencyError('ApexClass:MyClass', 'ApexClass:DependencyClass');

      expect(error.message).to.include('MyClass');
      expect(error.message).to.include('DependencyClass');
      expect(error.context.component).to.equal('ApexClass:MyClass');
      expect(error.context.missingDependency).to.equal('ApexClass:DependencyClass');

      const suggestionsText = error.suggestions.join(' ');
      expect(suggestionsText).to.include('DependencyClass');
    });
  });

  describe('DependencyComplexityError', () => {
    it('should warn about deep dependency chains', () => {
      const error = new DependencyComplexityError('Dependency depth too high', {
        maxDepth: 75,
      });

      const suggestionsText = error.suggestions.join(' ');
      expect(suggestionsText).to.include('depth');
      expect(suggestionsText).to.include('50');
    });

    it('should suggest splitting for large component counts', () => {
      const error = new DependencyComplexityError('Too many components', {
        totalComponents: 15_000,
      });

      const suggestionsText = error.suggestions.join(' ');
      expect(suggestionsText).to.include('splitting');
    });
  });

  describe('DeploymentError', () => {
    /**
     * @ac US-008-AC-5: DeploymentError for deployment failures
     */
    it('should create DeploymentError with deployment context', () => {
      const error = new DeploymentError('Deployment failed', {
        deploymentId: '0Af123456789012',
        failedTests: ['TestClass.testMethod'],
      });

      expect(error.code).to.equal('DEPLOYMENT_ERROR');
      expect(error.context.deploymentId).to.equal('0Af123456789012');
    });

    it('should suggest checking deployment report', () => {
      const error = new DeploymentError('Failed', {
        deploymentId: '0Af123',
      });

      const suggestionsText = error.suggestions.join(' ');
      expect(suggestionsText).to.include('0Af123');
      expect(suggestionsText).to.include('deploy report');
    });

    it('should suggest fixing test coverage when low', () => {
      const error = new DeploymentError('Low coverage', {
        testCoverage: 65,
      });

      const suggestionsText = error.suggestions.join(' ');
      expect(suggestionsText).to.include('75%');
      expect(suggestionsText).to.include('coverage');
    });
  });

  describe('TestFailureError', () => {
    it('should list failed tests', () => {
      const failedTests = ['Test1.method1', 'Test2.method2', 'Test3.method3'];
      const error = new TestFailureError(failedTests);

      expect(error.message).to.include('3 test(s) failed');
      expect(error.context.failedTests).to.deep.equal(failedTests);

      const suggestionsText = error.suggestions.join(' ');
      expect(suggestionsText).to.include('Test1.method1');
    });

    it('should truncate long test lists', () => {
      const failedTests = Array.from({ length: 10 }, (_, i) => `Test${i}.method`);
      const error = new TestFailureError(failedTests);

      const suggestionsText = error.suggestions.join(' ');
      expect(suggestionsText).to.include('5 more'); // Shows "... and 5 more"
    });
  });

  describe('DeploymentTimeoutError', () => {
    it('should include timeout duration', () => {
      const error = new DeploymentTimeoutError(600_000); // 10 minutes

      expect(error.message).to.include('600000ms');
      expect(error.context.timeoutMs).to.equal(600_000);
    });
  });

  describe('DeploymentLimitError', () => {
    it('should specify limit type and values', () => {
      const error = new DeploymentLimitError('files', 10_000, 15_000);

      expect(error.message).to.include('files');
      expect(error.message).to.include('10000');
      expect(error.message).to.include('15000');
      expect(error.context.limitType).to.equal('files');
      expect(error.context.limit).to.equal(10_000);
      expect(error.context.actual).to.equal(15_000);
    });

    it('should provide specific suggestions for file limits', () => {
      const error = new DeploymentLimitError('files', 10_000, 12_000);

      const suggestionsText = error.suggestions.join(' ');
      expect(suggestionsText).to.include('10,000');
    });

    it('should provide suggestions for size limits', () => {
      const error = new DeploymentLimitError('size', 39_000_000, 50_000_000);

      const suggestionsText = error.suggestions.join(' ');
      expect(suggestionsText).to.include('39MB');
    });
  });

  describe('SalesforceApiError', () => {
    it('should handle authentication errors (401)', () => {
      const error = new SalesforceApiError('Unauthorized', { statusCode: 401 });

      const suggestionsText = error.suggestions.join(' ');
      expect(suggestionsText).to.include('Authentication');
      expect(suggestionsText).to.include('login');
    });

    it('should handle permission errors (403)', () => {
      const error = new SalesforceApiError('Forbidden', { statusCode: 403 });

      const suggestionsText = error.suggestions.join(' ');
      expect(suggestionsText).to.include('permissions');
    });

    it('should handle rate limit errors (429)', () => {
      const error = new SalesforceApiError('Too Many Requests', { statusCode: 429 });

      const suggestionsText = error.suggestions.join(' ');
      expect(suggestionsText).to.include('rate limit');
    });

    it('should handle server errors (5xx)', () => {
      const error = new SalesforceApiError('Internal Server Error', { statusCode: 500 });

      const suggestionsText = error.suggestions.join(' ');
      expect(suggestionsText).to.include('server error');
      expect(suggestionsText).to.include('status.salesforce.com');
    });
  });

  describe('ValidationError', () => {
    /**
     * @ac US-008-AC-6: ValidationError for validation issues
     */
    it('should create ValidationError with field context', () => {
      const error = new ValidationError('Invalid value', {
        field: 'sourceApiVersion',
        value: '30.0',
      });

      expect(error.code).to.equal('VALIDATION_ERROR');
      expect(error.context.field).to.equal('sourceApiVersion');
    });

    it('should suggest checking specific field', () => {
      const error = new ValidationError('Invalid', { field: 'testField' });

      const suggestionsText = error.suggestions.join(' ');
      expect(suggestionsText).to.include('testField');
    });
  });

  describe('ApiVersionError', () => {
    it('should provide version upgrade suggestions', () => {
      const error = new ApiVersionError('30.0', '40.0');

      expect(error.message).to.include('30.0');
      expect(error.message).to.include('40.0');
      expect(error.context.currentVersion).to.equal('30.0');
      expect(error.context.minimumVersion).to.equal('40.0');

      const suggestionsText = error.suggestions.join(' ');
      expect(suggestionsText).to.include('40.0');
      expect(suggestionsText).to.include('sfdx-project.json');
    });
  });

  describe('FileNotFoundError', () => {
    it('should provide path verification suggestions', () => {
      const error = new FileNotFoundError('/path/to/missing/file.xml');

      expect(error.message).to.include('/path/to/missing/file.xml');
      const suggestionsText = error.suggestions.join(' ');
      expect(suggestionsText).to.include('path');
      expect(suggestionsText).to.include('typos');
    });
  });

  describe('PermissionError', () => {
    it('should provide permission fix suggestions', () => {
      const error = new PermissionError('/restricted/file.txt', 'read');

      expect(error.message).to.include('read');
      expect(error.message).to.include('/restricted/file.txt');

      const suggestionsText = error.suggestions.join(' ');
      expect(suggestionsText).to.include('chmod');
      expect(suggestionsText).to.include('permissions');
    });
  });

  describe('Helper Functions', () => {
    it('isSmartDeploymentError should identify custom errors', () => {
      const customError = new ParsingError('Test');
      const stdError = new Error('Standard error');

      expect(isSmartDeploymentError(customError)).to.be.true;
      expect(isSmartDeploymentError(stdError)).to.be.false;
      expect(isSmartDeploymentError('string')).to.be.false;
      expect(isSmartDeploymentError(null)).to.be.false;
    });

    it('getErrorMessage should extract message safely', () => {
      const customError = new ParsingError('Custom message');
      const stdError = new Error('Standard message');
      const stringError = 'String error';
      const unknownError = { foo: 'bar' };

      expect(getErrorMessage(customError)).to.equal('Custom message');
      expect(getErrorMessage(stdError)).to.equal('Standard message');
      expect(getErrorMessage(stringError)).to.equal('String error');
      expect(getErrorMessage(unknownError)).to.equal('Unknown error occurred');
    });

    it('getErrorContext should extract context safely', () => {
      const customError = new ParsingError('Test', { key: 'value' });
      const stdError = new Error('Standard');

      const context1 = getErrorContext(customError);
      expect(context1).to.deep.equal({ key: 'value' });

      const context2 = getErrorContext(stdError);
      expect(context2).to.deep.equal({});
    });

    it('getErrorSuggestions should extract suggestions safely', () => {
      const customError = new ParsingError('Test', { filePath: 'test.xml' });
      const stdError = new Error('Standard');

      const suggestions1 = getErrorSuggestions(customError);
      expect(suggestions1).to.be.an('array');
      expect(suggestions1.length).to.be.greaterThan(0);

      const suggestions2 = getErrorSuggestions(stdError);
      expect(suggestions2).to.deep.equal([]);
    });
  });
});
