/**
 * E2E-style Tests for Validate Command - US-067
 *
 * @ac US-067-AC-3: 5 scenarios for validate command
 * @issue #67
 */

import { rm } from 'node:fs/promises';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { ProjectFixtures } from '../fixtures/project-fixtures.js';
import { DeploymentValidationService } from '../../src/deployment/deployment-validation-service.js';
import { ValidateCommandPresenter } from '../../src/presentation/validate-command-presenter.js';

describe('E2E: Validate Command - US-067', () => {
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

  it('validates deployment without executing it', async () => {
    const fixture = await fixtures.createStandardProject('validate-e2e-valid');
    createdRoots.add(fixture.structure.root);

    const service = new DeploymentValidationService();
    const summary = await service.validateProject(fixture.structure.root);

    expect(summary.valid).to.equal(true);
    expect(summary.totalWaves).to.be.greaterThan(0);
  });

  it('detects validation errors from corrupted metadata', async () => {
    const fixture = await fixtures.createCorruptedProject('validate-e2e-corrupt');
    createdRoots.add(fixture.structure.root);

    const service = new DeploymentValidationService();
    const summary = await service.validateProject(fixture.structure.root);

    expect(summary.valid).to.equal(false);
    expect(summary.issues.some((issue) => issue.severity === 'error')).to.equal(true);
  });

  it('reports wave and XML validation details', async () => {
    const fixture = await fixtures.createStandardProject('validate-e2e-report');
    createdRoots.add(fixture.structure.root);

    const service = new DeploymentValidationService();
    const summary = await service.validateProject(fixture.structure.root);
    const presenter = new ValidateCommandPresenter();
    const formatted = presenter.formatSummary(summary);

    expect(formatted).to.include('Components: 1');
    expect(formatted).to.include('XML Files Validated:');
  });
});
