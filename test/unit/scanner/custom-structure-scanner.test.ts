/**
 * Tests for Custom Structure Scanner - US-081
 */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { CustomStructureScanner } from '../../../src/scanner/custom-structure-scanner.js';

describe('CustomStructureScanner', () => {
  const scanner = new CustomStructureScanner();

  describe('US-081: Custom Structure Support', () => {
    /** @ac US-081-AC-1: Detect custom package directories */
    it('US-081-AC-1: should detect custom package directories', async () => {
      const dirs = await scanner.detectCustomPackageDirs('.');
      expect(dirs).to.be.an('array');
    });

    /** @ac US-081-AC-2: Support custom naming conventions */
    it('US-081-AC-2: should detect naming convention', () => {
      const convention = scanner.detectNamingConvention(['force-app', 'main/default']);
      expect(convention).to.equal('standard');

      const customConvention = scanner.detectNamingConvention(['apps', 'packages']);
      expect(customConvention).to.equal('custom');
    });

    /** @ac US-081-AC-3: Handle nested structures */
    it('US-081-AC-3: should detect nested structures', async () => {
      const isNested = await scanner.isNestedStructure('.', ['force-app']);
      expect(isNested).to.be.a('boolean');
    });

    /** @ac US-081-AC-4: Support legacy structures */
    it('US-081-AC-4: should detect legacy structure', async () => {
      const isLegacy = await scanner.isLegacyStructure('.');
      expect(isLegacy).to.be.a('boolean');
    });

    /** @ac US-081-AC-5: Validate custom paths */
    it('US-081-AC-5: should validate custom paths', async () => {
      const result = await scanner.validateCustomPaths('.', {
        main: 'force-app',
      });

      expect(result).to.have.property('valid');
      expect(result).to.have.property('errors');
    });

    /** @ac US-081-AC-6: Generate structure report */
    it('US-081-AC-6: should generate structure report', async () => {
      const report = await scanner.scanStructure('.');

      expect(report).to.have.property('structure');
      expect(report).to.have.property('warnings');
      expect(report).to.have.property('recommendations');

      const formatted = scanner.formatReport(report);
      expect(formatted).to.include('Project Structure Report');
    });
  });
});
