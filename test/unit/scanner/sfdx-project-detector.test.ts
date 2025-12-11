/**
 * Tests for SFDX Project Detector - US-079
 */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { SfdxProjectDetector } from '../../../src/scanner/sfdx-project-detector.js';

describe('SfdxProjectDetector', () => {
  describe('US-079: SFDX Project Detection', () => {
    /** @ac US-079-AC-1: Detect sfdx-project.json */
    it('US-079-AC-1: should detect sfdx-project.json', async () => {
      // Using current project as test subject
      const result = await SfdxProjectDetector.detect(process.cwd());

      expect(result.detected).to.be.true;
      expect(result.projectFile).to.include('sfdx-project.json');
    });

    /** @ac US-079-AC-2: Parse project configuration */
    it('US-079-AC-2: should parse project configuration', async () => {
      const result = await SfdxProjectDetector.detect(process.cwd());

      expect(result.projectConfig).to.exist;
      expect(result.projectConfig?.packageDirectories).to.be.an('array');
      expect(result.projectConfig?.sourceApiVersion).to.be.a('string');
    });

    /** @ac US-079-AC-3: Validate project structure */
    it('US-079-AC-3: should validate project structure', async () => {
      const result = await SfdxProjectDetector.detect(process.cwd());

      expect(result.errors).to.be.an('array');
      expect(result.warnings).to.be.an('array');
      // Should have no critical errors for valid project
      const criticalErrors = result.errors.filter((e) => !e.includes('warning'));
      expect(criticalErrors).to.be.empty;
    });

    /** @ac US-079-AC-4: Detect package directories */
    it('US-079-AC-4: should detect package directories', async () => {
      const result = await SfdxProjectDetector.detect(process.cwd());

      expect(result.packageDirectories).to.be.an('array');
      expect(result.packageDirectories.length).to.be.greaterThan(0);
    });

    /** @ac US-079-AC-5: Support multi-package projects */
    it('US-079-AC-5: should detect multi-package projects', async () => {
      const result = await SfdxProjectDetector.detect(process.cwd());

      expect(result.isMultiPackage).to.be.a('boolean');
      // Test handles both single and multi-package projects
    });

    /** @ac US-079-AC-6: Report project metadata */
    it('US-079-AC-6: should generate project report', async () => {
      const result = await SfdxProjectDetector.detect(process.cwd());
      const report = SfdxProjectDetector.formatDetectionReport(result);

      expect(report).to.be.a('string');
      expect(report).to.include('SFDX Project Detection Report');
      expect(report).to.include('API Version');
    });
  });

  describe('Helper Methods', () => {
    it('should check if path is in project', async () => {
      const isInProject = await SfdxProjectDetector.isInProject(process.cwd());
      expect(isInProject).to.be.true;
    });

    it('should get project root', async () => {
      const projectRoot = await SfdxProjectDetector.getProjectRoot(process.cwd());
      expect(projectRoot).to.be.a('string');
      expect(projectRoot).to.not.be.null;
    });

    it('should handle non-project paths', async () => {
      const result = await SfdxProjectDetector.detect('/tmp');
      expect(result.detected).to.be.false;
      expect(result.errors).to.not.be.empty;
    });
  });

  describe('Error Handling', () => {
    it('should handle missing project file', async () => {
      const result = await SfdxProjectDetector.detect('/nonexistent/path');
      expect(result.detected).to.be.false;
      expect(result.errors).to.include('sfdx-project.json not found');
    });

    it('should generate report for non-detected project', async () => {
      const result = await SfdxProjectDetector.detect('/tmp');
      const report = SfdxProjectDetector.formatDetectionReport(result);

      expect(report).to.include('No SFDX project detected');
    });
  });
});

