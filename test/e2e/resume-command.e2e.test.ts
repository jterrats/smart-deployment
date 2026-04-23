/**
 * E2E-style Tests for Resume Command - US-067
 *
 * @ac US-067-AC-4: 4 scenarios for resume command
 * @issue #67
 */

import { mkdtemp, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import { DeploymentStatusService } from '../../src/deployment/deployment-status-service.js';
import { StateManager } from '../../src/deployment/state-manager.js';

describe('E2E: Resume Command - US-067', () => {
  let testDir: string;
  let stateManager: StateManager;
  let service: DeploymentStatusService;

  beforeEach(async () => {
    testDir = await mkdtemp(path.join(os.tmpdir(), 'resume-e2e-'));
    stateManager = new StateManager({ baseDir: testDir });
    service = new DeploymentStatusService(stateManager);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('resumes from the failed wave', async () => {
    await stateManager.saveState({
      deploymentId: 'deploy-e2e-1',
      targetOrg: 'resume@example.com',
      timestamp: '2026-04-20T00:00:00.000Z',
      totalWaves: 5,
      completedWaves: [1, 2],
      currentWave: 3,
      failedWave: {
        waveNumber: 3,
        error: 'UNABLE_TO_LOCK_ROW',
        timestamp: '2026-04-20T00:00:15.000Z',
      },
    });

    const resume = await service.getResumeSummary();

    expect(resume.success).to.equal(true);
    expect(resume.resumeWave).to.equal(3);
  });

  it('loads deployment state and remaining waves', async () => {
    await stateManager.saveState({
      deploymentId: 'deploy-e2e-2',
      targetOrg: 'resume@example.com',
      timestamp: '2026-04-20T00:00:00.000Z',
      totalWaves: 4,
      completedWaves: [1],
      currentWave: 2,
      failedWave: {
        waveNumber: 2,
        error: 'REQUEST_LIMIT_EXCEEDED',
        timestamp: '2026-04-20T00:00:15.000Z',
      },
    });

    const resume = await service.getResumeSummary();

    expect(resume.completedWaves).to.deep.equal([1]);
    expect(resume.remainingWaves).to.deep.equal([2, 3, 4]);
  });

  it('returns a failure result when there is nothing to resume', async () => {
    const resume = await service.getResumeSummary();

    expect(resume.success).to.equal(false);
    expect(resume.reason).to.include('No previous deployment state found');
  });
});
