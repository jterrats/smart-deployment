import { expect } from 'chai';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import { afterEach, describe, it } from 'mocha';
import {
  cleanupNutWorkspace,
  createNutWorkspace,
  createStandardProject,
  writeDeploymentState,
} from './nut/command-fixtures.js';

describe('NUT: status command', () => {
  const tempDirs: string[] = [];
  const repoRoot = process.cwd();

  afterEach(async () => {
    await Promise.all(tempDirs.map(async (dir) => cleanupNutWorkspace(dir)));
    tempDirs.length = 0;
  });

  it('reports not-started status when no deployment state exists for the source path', async () => {
    const workspace = await createNutWorkspace('smart-deployment-status-nut-');
    tempDirs.push(workspace.tempDir);
    const projectRoot = await createStandardProject(workspace.tempDir);

    const result = execCmd<{ status: string; currentWave: number; canResume: boolean }>(
      `status --source-path ${projectRoot} --json`,
      {
        cwd: repoRoot,
        ensureExitCode: 0,
        cli: 'dev',
        env: { ...process.env, HOME: workspace.homeDir, TESTKIT_HOMEDIR: workspace.homeDir },
      }
    );

    expect(result.shellOutput.stdout).to.include('"status": "Not Started"');
    expect(result.shellOutput.stdout).to.include('"currentWave": 0');
    expect(result.shellOutput.stdout).to.include('"canResume": false');
  });

  it('renders failed deployment details and cycle remediation status from persisted state', async () => {
    const workspace = await createNutWorkspace('smart-deployment-status-nut-');
    tempDirs.push(workspace.tempDir);
    const projectRoot = await createStandardProject(workspace.tempDir);

    await writeDeploymentState(projectRoot, {
      deploymentId: 'deploy-status-nut',
      targetOrg: 'status@example.com',
      timestamp: '2026-04-22T12:00:00.000Z',
      totalWaves: 4,
      completedWaves: [1],
      currentWave: 2,
      failedWave: {
        waveNumber: 2,
        error: 'UNABLE_TO_LOCK_ROW',
        timestamp: '2026-04-22T12:01:00.000Z',
      },
      cycleRemediation: {
        cycleId: 'cycle-ApexClass-Alpha-Beta',
        strategy: 'comment-reference',
        activePhase: 2,
        startedAt: '2026-04-22T12:00:30.000Z',
        completedPhases: [1],
        editRecords: [],
      },
      metadata: {
        testsRun: 4,
        testFailures: 1,
      },
    });

    const result = execCmd(`status --source-path ${projectRoot}`, {
      cwd: repoRoot,
      ensureExitCode: 0,
      cli: 'dev',
      env: { ...process.env, HOME: workspace.homeDir, TESTKIT_HOMEDIR: workspace.homeDir },
    });

    expect(result.shellOutput.stdout).to.include('Status: Failed');
    expect(result.shellOutput.stdout).to.include('Current Wave: 2/4');
    expect(result.shellOutput.stdout).to.include('Failure: Wave 2 - UNABLE_TO_LOCK_ROW');
    expect(result.shellOutput.stdout).to.include('Cycle Remediation: Phase 2 of 2');
    expect(result.shellOutput.stdout).to.include('Remediation Strategy: comment-reference');
  });
});
