import { mkdtemp, rm } from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { DeploymentStatusService } from '../../../src/deployment/deployment-status-service.js';
import { StateManager } from '../../../src/deployment/state-manager.js';

describe('DeploymentStatusService', () => {
  let testDir: string;
  let stateManager: StateManager;
  let service: DeploymentStatusService;

  beforeEach(async () => {
    testDir = await mkdtemp(path.join(os.tmpdir(), 'deployment-status-service-'));
    stateManager = new StateManager({ baseDir: testDir });
    service = new DeploymentStatusService(stateManager);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('returns not-started when no deployment state exists', async () => {
    const summary = await service.getStatus();

    expect(summary.hasState).to.equal(false);
    expect(summary.status).to.equal('not-started');
    expect(summary.currentWave).to.equal(0);
    expect(summary.totalWaves).to.equal(0);
    expect(summary.remainingWaves).to.deep.equal([]);
  });

  it('returns failed status and resumable details for failed deployments', async () => {
    await stateManager.saveState({
      deploymentId: 'deploy-123',
      targetOrg: 'test@example.com',
      timestamp: '2026-04-20T00:00:00.000Z',
      totalWaves: 4,
      completedWaves: [1, 2],
      currentWave: 3,
      failedWave: {
        waveNumber: 3,
        error: 'UNABLE_TO_LOCK_ROW',
        timestamp: '2026-04-20T00:00:10.000Z',
      },
      metadata: {
        testLevel: 'RunLocalTests',
      },
    });

    const summary = await service.getStatus();

    expect(summary.hasState).to.equal(true);
    expect(summary.status).to.equal('failed');
    expect(summary.currentWave).to.equal(3);
    expect(summary.remainingWaves).to.deep.equal([3, 4]);
    expect(summary.resumable).to.equal(true);
    expect(summary.testStatus).to.equal('pending');
  });

  it('returns a resume summary for failed deployments', async () => {
    await stateManager.saveState({
      deploymentId: 'deploy-456',
      targetOrg: 'test@example.com',
      timestamp: '2026-04-20T00:00:00.000Z',
      totalWaves: 3,
      completedWaves: [1],
      currentWave: 2,
      failedWave: {
        waveNumber: 2,
        error: 'REQUEST_LIMIT_EXCEEDED',
        timestamp: '2026-04-20T00:00:10.000Z',
      },
    });

    const resume = await service.getResumeSummary();

    expect(resume.success).to.equal(true);
    expect(resume.resumeWave).to.equal(2);
    expect(resume.completedWaves).to.deep.equal([1]);
    expect(resume.remainingWaves).to.deep.equal([2, 3]);
  });

  it('formats the status report with failure details', async () => {
    await stateManager.saveState({
      deploymentId: 'deploy-789',
      targetOrg: 'test@example.com',
      timestamp: '2026-04-20T00:00:00.000Z',
      totalWaves: 2,
      completedWaves: [1],
      currentWave: 2,
      failedWave: {
        waveNumber: 2,
        error: 'FIELD_INTEGRITY_EXCEPTION',
        timestamp: '2026-04-20T00:00:10.000Z',
      },
      metadata: {
        skipTests: true,
      },
      cycleRemediation: {
        cycleId: 'ApexClass:Alpha|ApexClass:Beta',
        strategy: 'comment-reference',
        activePhase: 2,
        startedAt: '2026-04-20T00:00:05.000Z',
        completedPhases: [1],
        editRecords: [],
      },
    });

    const summary = await service.getStatus();
    const formatted = service.formatStatus(summary);

    expect(formatted).to.include('Status: Failed');
    expect(formatted).to.include('Current Wave: 2/2');
    expect(formatted).to.include('Failure: Wave 2 - FIELD_INTEGRITY_EXCEPTION');
    expect(formatted).to.include('Cycle Remediation: Phase 2 of 2');
    expect(formatted).to.include('Remediation Strategy: comment-reference');
    expect(formatted).to.include('Test Status: No tests run');
  });
});
