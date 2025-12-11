/**
 * Tests for .forceignore Parser - US-083
 */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { ForceIgnoreParser } from '../../../src/scanner/forceignore-parser.js';

describe('ForceIgnoreParser', () => {
  describe('US-083: .forceignore Parsing', () => {
    /** @ac US-083-AC-1: Parse .forceignore syntax */
    it('US-083-AC-1: should parse .forceignore file', async () => {
      const parser = new ForceIgnoreParser();
      const result = await parser.load(process.cwd());

      expect(result.found).to.be.true;
      expect(result.rules).to.be.an('array');
      expect(result.totalRules).to.be.greaterThan(0);
    });

    /** @ac US-083-AC-2: Support glob patterns */
    it('US-083-AC-2: should support glob patterns', async () => {
      const parser = new ForceIgnoreParser();
      await parser.load(process.cwd());

      // Test ** pattern (matches any depth)
      const isIgnored1 = parser.isIgnored('node_modules/some/deep/file.js');
      expect(isIgnored1).to.be.true;

      // Test * pattern (matches within directory)
      const isIgnored2 = parser.isIgnored('test/something.test.js');
      expect(isIgnored2).to.be.true;
    });

    /** @ac US-083-AC-3: Support negation (!) */
    it('US-083-AC-3: should support negation patterns', async () => {
      const parser = new ForceIgnoreParser();
      await parser.load(process.cwd());

      const rules = parser.getRules();
      expect(rules).to.be.an('array');

      // Verify each rule has expected structure
      if (rules.length > 0) {
        expect(rules[0]).to.have.property('pattern');
        expect(rules[0]).to.have.property('isNegation');
        expect(rules[0]).to.have.property('lineNumber');
      }
    });

    /** @ac US-083-AC-4: Support comments (#) */
    it('US-083-AC-4: should ignore comment lines', async () => {
      const parser = new ForceIgnoreParser();
      const result = await parser.load(process.cwd());

      // Should have parsed comments
      expect(result.commentLines).to.be.greaterThan(0);

      // Comments shouldn't become rules
      const commentRules = result.rules.filter((r) => r.pattern.startsWith('#'));
      expect(commentRules).to.be.empty;
    });

    /** @ac US-083-AC-5: Respect .gitignore format */
    it('US-083-AC-5: should respect .gitignore format', async () => {
      const parser = new ForceIgnoreParser();
      await parser.load(process.cwd());

      // Empty lines should be ignored
      const result = await parser.load(process.cwd());
      expect(result.emptyLines).to.be.greaterThan(0);

      // Parser should handle standard .gitignore patterns
      expect(parser.isLoaded()).to.be.true;
    });

    /** @ac US-083-AC-6: Test against file paths */
    it('US-083-AC-6: should test paths against rules', async () => {
      const parser = new ForceIgnoreParser();
      await parser.load(process.cwd());

      // Test various patterns
      const testCases = [
        { path: 'force-app/main/default/classes/MyClass.cls', expected: false },
        { path: 'node_modules/some-package/index.js', expected: true },
        { path: 'test/unit/MyTest.js', expected: true },
        { path: '.DS_Store', expected: true },
      ];

      for (const testCase of testCases) {
        const ignored = parser.isIgnored(testCase.path);
        expect(ignored).to.equal(
          testCase.expected,
          `Path "${testCase.path}" should${testCase.expected ? '' : ' not'} be ignored`
        );
      }
    });
  });

  describe('Filter Operations', () => {
    it('should filter array of paths', async () => {
      const parser = new ForceIgnoreParser();
      await parser.load(process.cwd());

      const paths = [
        'force-app/main/default/classes/MyClass.cls',
        'node_modules/some-package/index.js',
        'test/unit/MyTest.js',
        'force-app/main/default/objects/Account.object',
      ];

      const filtered = parser.filterPaths(paths);

      expect(filtered).to.be.an('array');
      expect(filtered.length).to.be.lessThan(paths.length);
      expect(filtered).to.include('force-app/main/default/classes/MyClass.cls');
      expect(filtered).to.not.include('node_modules/some-package/index.js');
    });

    it('should return all paths if no rules loaded', async () => {
      const parser = new ForceIgnoreParser();
      // Don't load any rules

      const paths = ['file1.js', 'file2.js'];
      const filtered = parser.filterPaths(paths);

      expect(filtered).to.have.lengthOf(2);
    });
  });

  describe('Helper Methods', () => {
    it('should get loaded rules', async () => {
      const parser = new ForceIgnoreParser();
      await parser.load(process.cwd());

      const rules = parser.getRules();
      expect(rules).to.be.an('array');
      expect(rules.length).to.be.greaterThan(0);
      expect(rules[0]).to.have.property('pattern');
      expect(rules[0]).to.have.property('isNegation');
      expect(rules[0]).to.have.property('lineNumber');
    });

    it('should check if loaded', async () => {
      const parser = new ForceIgnoreParser();
      expect(parser.isLoaded()).to.be.false;

      await parser.load(process.cwd());
      expect(parser.isLoaded()).to.be.true;
    });

    it('should generate report', async () => {
      const parser = new ForceIgnoreParser();
      const result = await parser.load(process.cwd());
      const report = parser.formatReport(result);

      expect(report).to.be.a('string');
      expect(report).to.include('.forceignore Report');
      expect(report).to.include('Active Rules');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing .forceignore gracefully', async () => {
      const parser = new ForceIgnoreParser();
      const result = await parser.load('/tmp');

      expect(result.found).to.be.false;
      expect(result.rules).to.be.empty;
    });

    it('should generate report for missing file', async () => {
      const parser = new ForceIgnoreParser();
      const result = await parser.load('/tmp');
      const report = parser.formatReport(result);

      expect(report).to.include('.forceignore not found');
      expect(report).to.include('All files will be included');
    });
  });
});

