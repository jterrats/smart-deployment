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

  it('includes active cycle remediation details in the summary and formatted status output', () => {
    const state: DeploymentState = {
      deploymentId: 'deploy-summary-4',
      targetOrg: 'summary@example.com',
      timestamp: '2026-04-22T00:00:00.000Z',
      totalWaves: 3,
      completedWaves: [1],
      currentWave: 2,
      cycleRemediation: {
        cycleId: 'ApexClass:Alpha|ApexClass:Beta',
        strategy: 'comment-reference',
        activePhase: 2,
        startedAt: '2026-04-22T00:00:00.000Z',
        completedPhases: [1, 1],
        editRecords: [
          {
            operation: 'comment-reference',
            filePath: '/tmp/classes/Alpha.cls',
            backupPath: '/tmp/classes/Alpha.cls.cycle-remediation.bak',
            targetDescription: 'Temporarily comment the ApexClass:Alpha reference to ApexClass:Beta during phase 1.',
            targetDependency: 'ApexClass:Beta',
            sourceSnippet: 'Example.run();',
            replacementSnippet:
              '// cycle-remediation: comment-reference ApexClass:Beta | Temporarily comment the ApexClass:Alpha reference to ApexClass:Beta during phase 1.\n// Example.run();\n// cycle-remediation: end',
            originalHash: 'original-hash',
            editedHash: 'edited-hash',
          },
        ],
      },
    };

    const summary = summarizeDeploymentState(state);

    expect(summary.cycleRemediation).to.deep.equal({
      cycleId: 'ApexClass:Alpha|ApexClass:Beta',
      strategy: 'comment-reference',
      activePhase: 2,
      completedPhases: [1],
      startedAt: '2026-04-22T00:00:00.000Z',
      editCount: 1,
      statusText: 'Phase 2 of 2: Restore original references and redeploy the same components.',
    });

    const lines = formatDeploymentStatus(summary).join('\n');
    expect(lines).to.include(
      'Cycle Remediation: Phase 2 of 2: Restore original references and redeploy the same components.'
    );
    expect(lines).to.include('Remediation Cycle: ApexClass:Alpha|ApexClass:Beta');
    expect(lines).to.include('Remediation Completed Phases: 1');
  });

  it('keeps legacy summaries unchanged when cycle remediation is absent', () => {
    const summary = summarizeDeploymentState({
      deploymentId: 'deploy-summary-5',
      targetOrg: 'summary@example.com',
      timestamp: '2026-04-22T00:00:00.000Z',
      totalWaves: 2,
      completedWaves: [],
      currentWave: 1,
    });

    expect(summary.cycleRemediation).to.equal(undefined);
    expect(formatDeploymentStatus(summary).join('\n')).not.to.include('Cycle Remediation:');
  });
});
