/**
 * E2E-style Tests for Status Command - US-067
 * @ac US-067-AC-5: 3 scenarios for status command
 * @issue #67
 */

import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { mkdtemp, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { DeploymentStatusService } from '../../src/deployment/deployment-status-service.js';
import { StateManager } from '../../src/deployment/state-manager.js';

describe('E2E: Status Command - US-067', () => {
  let testDir: string;
  let stateManager: StateManager;
  let service: DeploymentStatusService;

  beforeEach(async () => {
    testDir = await mkdtemp(path.join(os.tmpdir(), 'status-e2e-'));
    stateManager = new StateManager({ baseDir: testDir });
    service = new DeploymentStatusService(stateManager);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('shows current deployment status from state', async () => {
    await stateManager.saveState({
      deploymentId: 'deploy-status-1',
      targetOrg: 'status@example.com',
      timestamp: '2026-04-20T00:00:00.000Z',
      totalWaves: 4,
      completedWaves: [1, 2],
      currentWave: 3,
    });

    const summary = await service.getStatus();

    expect(summary.status).to.equal('in-progress');
    expect(summary.currentWave).to.equal(3);
    expect(summary.totalWaves).to.equal(4);
  });

  it('shows failed deployment progress and resumable state', async () => {
    await stateManager.saveState({
      deploymentId: 'deploy-status-2',
      targetOrg: 'status@example.com',
      timestamp: '2026-04-20T00:00:00.000Z',
      totalWaves: 5,
      completedWaves: [1, 2, 3],
      currentWave: 4,
      failedWave: {
        waveNumber: 4,
        error: 'FIELD_INTEGRITY_EXCEPTION',
        timestamp: '2026-04-20T00:00:15.000Z',
      },
    });

    const summary = await service.getStatus();
    const formatted = service.formatStatus(summary);

    expect(summary.status).to.equal('failed');
    expect(summary.resumable).to.equal(true);
    expect(formatted).to.include('Remaining Waves: 4, 5');
  });

  it('shows no deployment state when none exists', async () => {
    const summary = await service.getStatus();
    const formatted = service.formatStatus(summary);

    expect(summary.hasState).to.equal(false);
    expect(formatted).to.include('No deployment state found');
  });
});
