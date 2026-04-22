import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  createResumedState,
  formatDeploymentStatus,
  summarizeDeploymentState,
} from '../../../src/deployment/deployment-state-summary.js';
import type { DeploymentState } from '../../../src/deployment/state-manager.js';

describe('deployment-state-summary', () => {
  it('summarizes failed deployment state with resumable information', () => {
    const state: DeploymentState = {
      deploymentId: 'deploy-summary-1',
      targetOrg: 'summary@example.com',
      timestamp: '2026-04-20T00:00:00.000Z',
      totalWaves: 5,
      completedWaves: [1, 2],
      currentWave: 3,
      failedWave: {
        waveNumber: 3,
        error: 'UNABLE_TO_LOCK_ROW',
        timestamp: '2026-04-20T00:00:05.000Z',
      },
    };

    const summary = summarizeDeploymentState(state);

    expect(summary.status).to.equal('Failed');
    expect(summary.currentWave).to.equal(3);
    expect(summary.completedWaves).to.deep.equal([1, 2]);
    expect(summary.remainingWaves).to.equal(3);
    expect(summary.canResume).to.equal(true);
  });

  it('creates resumed state from failed deployment', () => {
    const state: DeploymentState = {
      deploymentId: 'deploy-summary-2',
      targetOrg: 'summary@example.com',
      timestamp: '2026-04-20T00:00:00.000Z',
      totalWaves: 4,
      completedWaves: [1],
      currentWave: 2,
      failedWave: {
        waveNumber: 2,
        error: 'REQUEST_LIMIT_EXCEEDED',
        timestamp: '2026-04-20T00:00:05.000Z',
      },
      metadata: {
        resumeCount: 1,
      },
    };

    const resumed = createResumedState(state, 'quick', '2026-04-20T00:00:10.000Z');

    expect(resumed.failedWave).to.equal(undefined);
    expect(resumed.currentWave).to.equal(2);
    expect(resumed.completedWaves).to.deep.equal([1]);
    expect(resumed.metadata?.retryStrategy).to.equal('quick');
    expect(resumed.metadata?.resumeCount).to.equal(2);
  });

  it('formats deployment status lines for CLI output', () => {
    const lines = formatDeploymentStatus({
      deploymentId: 'deploy-summary-3',
      targetOrg: 'summary@example.com',
      status: 'In Progress',
      currentWave: 2,
      totalWaves: 4,
      completedWaves: [1],
      remainingWaves: 3,
      canResume: false,
      etaSeconds: 180,
      testStatus: 'Tests run: 3 (0 failures)',
      lastUpdated: '2026-04-20T00:00:10.000Z',
    });

    expect(lines.join('\n')).to.include('Deployment ID: deploy-summary-3');
    expect(lines.join('\n')).to.include('Current Wave: 2/4');
    expect(lines.join('\n')).to.include('Estimated Time Remaining: 180s');
  });
});
