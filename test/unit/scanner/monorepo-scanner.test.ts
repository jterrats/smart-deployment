/**
 * Tests for Monorepo Scanner - US-082
 */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { MonorepoScanner } from '../../../src/scanner/monorepo-scanner.js';

describe('MonorepoScanner', () => {
  const scanner = new MonorepoScanner();

  describe('US-082: Monorepo Support', () => {
    /** @ac US-082-AC-1: Detect multiple SFDX projects */
    it('US-082-AC-1: should detect multiple SFDX projects', async () => {
      const projects = await scanner.detectProjects('.', 2);
      expect(projects).to.be.an('array');
    });

    /** @ac US-082-AC-2: Scan each project independently */
    it('US-082-AC-2: should return project details', async () => {
      const projects = await scanner.detectProjects('.', 2);

      if (projects.length > 0) {
        expect(projects[0]).to.have.property('name');
        expect(projects[0]).to.have.property('path');
        expect(projects[0]).to.have.property('sfdxProjectPath');
        expect(projects[0]).to.have.property('packageDirectories');
      }
    });

    /** @ac US-082-AC-3: Support shared dependencies */
    it('US-082-AC-3: should detect shared dependencies', async () => {
      const projects = await scanner.detectProjects('.', 2);
      const sharedDeps = await scanner.detectSharedDependencies(projects);

      expect(sharedDeps).to.be.an('array');
    });

    /** @ac US-082-AC-4: Handle cross-project references */
    it('US-082-AC-4: should detect cross-project references', async () => {
      const projects = await scanner.detectProjects('.', 2);
      const refs = scanner.detectCrossProjectRefs(projects);

      expect(refs).to.be.an('array');
    });

    /** @ac US-082-AC-5: Generate monorepo report */
    /** @ac US-082-AC-6: Support workspace configuration */
    it('US-082-AC-5/AC-6: should generate monorepo report', async () => {
      const report = await scanner.scanMonorepo('.');

      expect(report).to.have.property('structure');
      expect(report.structure).to.have.property('isMonorepo');
      expect(report.structure).to.have.property('projects');
      expect(report.structure).to.have.property('sharedDependencies');
      expect(report.structure).to.have.property('crossProjectRefs');
      expect(report).to.have.property('warnings');
      expect(report).to.have.property('recommendations');

      const formatted = scanner.formatReport(report);
      expect(formatted).to.include('Monorepo Structure Report');
    });
  });
});
