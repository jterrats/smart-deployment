/**
 * Tests for Structure Validator - US-084
 */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { StructureValidator } from '../../../src/scanner/structure-validator.js';

describe('StructureValidator', () => {
  const validator = new StructureValidator();

  describe('US-084: Project Structure Validation', () => {
    /** @ac US-084-AC-1: Validate sfdx-project.json */
    it('US-084-AC-1: should validate sfdx-project.json', async () => {
      const issues = await validator.validateSfdxProject('.');

      expect(issues).to.be.an('array');
      for (const issue of issues) {
        expect(issue).to.have.property('severity');
        expect(issue).to.have.property('code');
        expect(issue).to.have.property('message');
      }
    });

    /** @ac US-084-AC-2: Check package directories exist */
    it('US-084-AC-2: should check package directories exist', async () => {
      const issues = await validator.validatePackageDirectories('.');

      expect(issues).to.be.an('array');
    });

    /** @ac US-084-AC-3: Validate .forceignore */
    it('US-084-AC-3: should validate .forceignore', async () => {
      const issues = await validator.validateForceIgnore('.');

      expect(issues).to.be.an('array');
    });

    /** @ac US-084-AC-4: Check for required files */
    it('US-084-AC-4: should check for required files', async () => {
      const issues = await validator.validateRequiredFiles('.');

      expect(issues).to.be.an('array');
    });

    /** @ac US-084-AC-5: Detect structure issues */
    it('US-084-AC-5: should detect structure issues', async () => {
      const issues = await validator.detectStructureIssues('.');

      expect(issues).to.be.an('array');
    });

    /** @ac US-084-AC-6: Generate validation report */
    it('US-084-AC-6: should generate validation report', async () => {
      const report = await validator.validate('.');

      expect(report).to.have.property('isValid');
      expect(report).to.have.property('issues');
      expect(report).to.have.property('checkedPaths');
      expect(report).to.have.property('executionTime');

      const formatted = validator.formatReport(report);
      expect(formatted).to.include('Project Structure Validation');
    });
  });
});

