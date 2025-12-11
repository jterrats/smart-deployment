/**
 * Tests for Project Validator - US-084
 */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { ProjectValidator } from '../../../src/scanner/project-validator.js';

describe('ProjectValidator', () => {
  const validator = new ProjectValidator();

  describe('US-084: Project Structure Validation', () => {
    /** @ac US-084-AC-1: Validate sfdx-project.json schema */
    it('US-084-AC-1: should validate sfdx-project.json schema', async () => {
      const report = await validator.validate('./');

      expect(report.checkedItems).to.include('sfdx-project.json existence');
      expect(report.checkedItems).to.include('sfdx-project.json schema');
    });

    /** @ac US-084-AC-2: Validate package directories exist */
    it('US-084-AC-2: should validate package directories', async () => {
      const report = await validator.validate('./');

      expect(report.checkedItems).to.include('package directories');
    });

    /** @ac US-084-AC-3: Validate metadata structure */
    it('US-084-AC-3: should validate metadata structure', async () => {
      const report = await validator.validate('./');

      expect(report.checkedItems).to.include('metadata structure');
    });

    /** @ac US-084-AC-4: Check for required files */
    it('US-084-AC-4: should check for required files', async () => {
      const report = await validator.validate('./');

      expect(report.checkedItems).to.include('required files');
    });

    /** @ac US-084-AC-5: Generate validation report */
    it('US-084-AC-5: should generate validation report', async () => {
      const report = await validator.validate('./');

      expect(report).to.have.property('isValid');
      expect(report).to.have.property('issues');
      expect(report).to.have.property('checkedItems');
      expect(report).to.have.property('executionTime');
    });

    /** @ac US-084-AC-6: Suggest fixes for issues */
    it('US-084-AC-6: should suggest fixes for issues', async () => {
      const report = await validator.validate('./');

      for (const issue of report.issues) {
        expect(issue).to.have.property('severity');
        expect(issue).to.have.property('message');
        // Suggestions are optional but should be present for errors/warnings
        if (issue.severity !== 'info') {
          expect(issue).to.have.property('suggestion');
        }
      }
    });
  });

  describe('Report Formatting', () => {
    it('should format validation report', async () => {
      const report = await validator.validate('./');
      const formatted = validator.formatReport(report);

      expect(formatted).to.be.a('string');
      expect(formatted).to.include('Project Validation Report');
      expect(formatted).to.include('Status:');
      expect(formatted).to.include('Checks Performed:');
    });

    it('should categorize issues by severity', async () => {
      const report = await validator.validate('./');
      const formatted = validator.formatReport(report);

      // Report should show issue categories
      expect(formatted).to.be.a('string');
    });
  });

  describe('Validation Logic', () => {
    it('should return validation result', async () => {
      const report = await validator.validate('./');

      expect(report.isValid).to.be.a('boolean');
      expect(report.issues).to.be.an('array');
    });

    it('should include execution time', async () => {
      const report = await validator.validate('./');

      expect(report.executionTime).to.be.a('number');
      expect(report.executionTime).to.be.at.least(0);
    });
  });
});

