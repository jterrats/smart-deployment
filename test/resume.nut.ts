import { expect } from 'chai';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import { afterEach, describe, it } from 'mocha';
import {
  cleanupNutWorkspace,
  createNutWorkspace,
  createStandardProject,
  readDeploymentState,
  writeDeploymentState,
} from './nut/command-fixtures.js';

describe('NUT: resume command', () => {
  const tempDirs: string[] = [];
  const repoRoot = process.cwd();

  afterEach(async () => {
    await Promise.all(tempDirs.map(async (dir) => cleanupNutWorkspace(dir)));
    tempDirs.length = 0;
  });

  it('updates persisted state and reports the resume point for a failed deployment', async () => {
    const workspace = await createNutWorkspace('smart-deployment-resume-nut-');
    tempDirs.push(workspace.tempDir);
    const projectRoot = await createStandardProject(workspace.tempDir);

    await writeDeploymentState(projectRoot, {
      deploymentId: 'deploy-resume-nut',
      targetOrg: 'resume@example.com',
      timestamp: '2026-04-22T12:00:00.000Z',
      totalWaves: 5,
      completedWaves: [1, 2],
      currentWave: 3,
      failedWave: {
        waveNumber: 3,
        error: 'REQUEST_LIMIT_EXCEEDED',
        timestamp: '2026-04-22T12:01:00.000Z',
      },
      metadata: {
        testStatus: 'Blocked by previous failure',
      },
    });

    const result = execCmd<{ success: boolean; resumedFromWave: number; remainingWaves: number }>(
      `resume --source-path ${projectRoot} --retry-strategy quick --json`,
      {
        cwd: repoRoot,
        ensureExitCode: 0,
        cli: 'dev',
        env: { ...process.env, HOME: workspace.homeDir, TESTKIT_HOMEDIR: workspace.homeDir },
      }
    );

    const savedState = await readDeploymentState(projectRoot);

    expect(result.shellOutput.stdout).to.include('"success": true');
    expect(result.shellOutput.stdout).to.include('"resumedFromWave": 3');
    expect(result.shellOutput.stdout).to.include('"remainingWaves": 3');
    expect(savedState.failedWave).to.equal(undefined);
    expect(savedState.metadata).to.deep.include({
      retryStrategy: 'quick',
      resumedFromWave: 3,
      lastKnownStatus: 'Resumed',
    });
  });

  it('fails with a command error when there is no failed deployment to resume', async () => {
    const workspace = await createNutWorkspace('smart-deployment-resume-nut-');
    tempDirs.push(workspace.tempDir);
    const projectRoot = await createStandardProject(workspace.tempDir);

    const result = execCmd(`resume --source-path ${projectRoot}`, {
      cwd: repoRoot,
      ensureExitCode: 'nonZero',
      cli: 'dev',
      env: { ...process.env, HOME: workspace.homeDir, TESTKIT_HOMEDIR: workspace.homeDir },
    });

    expect(result.shellOutput.stderr).to.include('Resume failed');
    expect(result.shellOutput.stderr).to.include('No failed deployment state found to resume');
  });
});
