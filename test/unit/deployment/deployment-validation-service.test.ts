import { rm } from 'node:fs/promises';
import { expect } from 'chai';
import { describe, it, afterEach } from 'mocha';
import { ProjectFixtures } from '../../fixtures/project-fixtures.js';
import { DeploymentValidationService } from '../../../src/deployment/deployment-validation-service.js';

describe('DeploymentValidationService', () => {
  const fixtures = new ProjectFixtures();
  const createdRoots = new Set<string>();

  afterEach(async () => {
    await Promise.all(
      Array.from(createdRoots, async (root) => {
        await rm(root, { recursive: true, force: true });
      })
    );
    createdRoots.clear();
  });

  it('validates a healthy project without executing deployment', async () => {
    const fixture = await fixtures.createStandardProject('validation-service-valid');
    createdRoots.add(fixture.structure.root);

    const service = new DeploymentValidationService();
    const summary = await service.validateProject(fixture.structure.root);

    expect(summary.valid).to.equal(true);
    expect(summary.components).to.equal(1);
    expect(summary.dependencies).to.be.greaterThanOrEqual(0);
    expect(summary.dependencyBreakdown).to.deep.equal({
      hard: 0,
      soft: 0,
      inferred: 0,
    });
    expect(summary.totalWaves).to.be.greaterThan(0);
    expect(summary.xmlFilesValidated).to.be.greaterThan(0);
    expect(summary.issues.filter((issue) => issue.severity === 'error')).to.deep.equal([]);
  });

  it('reports XML validation issues for corrupted metadata', async () => {
    const fixture = await fixtures.createCorruptedProject('validation-service-corrupt');
    createdRoots.add(fixture.structure.root);

    const service = new DeploymentValidationService();
    const summary = await service.validateProject(fixture.structure.root);

    expect(summary.valid).to.equal(false);
    expect(summary.xmlFilesValidated).to.be.greaterThan(0);
    expect(summary.issues.some((issue) => issue.severity === 'error')).to.equal(true);
  });

  it('formats a readable validation summary', async () => {
    const fixture = await fixtures.createStandardProject('validation-service-format');
    createdRoots.add(fixture.structure.root);

    const service = new DeploymentValidationService();
    const summary = await service.validateProject(fixture.structure.root);
    const formatted = service.formatSummary(summary);

    expect(formatted).to.include('Validation: PASSED');
    expect(formatted).to.include('Components: 1');
    expect(formatted).to.include('Dependencies:');
    expect(formatted).to.include('Hard / Soft / Inferred:');
    expect(formatted).to.include('Waves:');
    expect(formatted).to.include('XML Files Validated:');
  });
});
