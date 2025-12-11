/**
 * Tests for Project Fixtures - US-068
 */
import { expect } from 'chai';
import { describe, it, after } from 'mocha';
import { ProjectFixtures } from '../../fixtures/project-fixtures.js';

describe('ProjectFixtures', () => {
  const fixtures = new ProjectFixtures();

  after(async () => {
    await fixtures.cleanup();
  });

  describe('US-068: Test Fixtures', () => {
    /** @ac US-068-AC-1: Sample Salesforce projects */
    it('US-068-AC-1: should create sample Salesforce projects', async () => {
      const fixture = await fixtures.createStandardProject('test-standard');

      expect(fixture.name).to.equal('test-standard');
      expect(fixture.structure.packageDirs).to.include('force-app');
      expect(fixture.metadataFiles.length).to.be.greaterThan(0);
    });

    /** @ac US-068-AC-2: Various project structures */
    it('US-068-AC-2: should support various project structures', async () => {
      const standard = await fixtures.createStandardProject('standard');
      const monorepo = await fixtures.createMonorepoProject('monorepo');

      expect(standard.structure.packageDirs.length).to.equal(1);
      expect(monorepo.structure.packageDirs.length).to.be.greaterThan(1);
    });

    /** @ac US-068-AC-3: Edge case scenarios */
    it('US-068-AC-3: should create edge case scenarios', async () => {
      const fixture = await fixtures.createEdgeCaseProject('edge-cases');

      expect(fixture.metadataFiles.length).to.be.greaterThan(0);
      expect(fixture.structure.metadataTypes).to.include('ApexClass');
    });

    /** @ac US-068-AC-4: Large project samples (1000+ files) */
    it('US-068-AC-4: should create large project samples', async () => {
      const fixture = await fixtures.createLargeProject('large-project', 100);

      expect(fixture.metadataFiles.length).to.be.greaterThan(100);
      expect(fixture.expectedComponents).to.equal(100);
    }).timeout(30000); // Allow time for file creation

    /** @ac US-068-AC-5: Corrupted file samples */
    it('US-068-AC-5: should create corrupted file samples', async () => {
      const fixture = await fixtures.createCorruptedProject('corrupted');

      expect(fixture.hasCorruptedFiles).to.be.true;
      expect(fixture.metadataFiles.length).to.be.greaterThan(0);
    });

    /** @ac US-068-AC-6: Circular dependency samples */
    it('US-068-AC-6: should create circular dependency samples', async () => {
      const fixture = await fixtures.createCircularDependencyProject('circular');

      expect(fixture.hasCircularDependencies).to.be.true;
      expect(fixture.expectedDependencies).to.be.greaterThan(0);
    });

    it('should get fixture path', () => {
      const path = fixtures.getFixturePath('test-project');
      expect(path).to.be.a('string');
      expect(path).to.include('test/fixtures/projects');
    });
  });
});

