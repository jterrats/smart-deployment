import { expect } from 'chai';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import { afterEach, describe, it } from 'mocha';
import {
  cleanupNutWorkspace,
  createCorruptedProject,
  createNutWorkspace,
  createStandardProject,
  stateFileExists,
} from './nut/command-fixtures.js';

describe('NUT: validate command', () => {
  const tempDirs: string[] = [];
  const repoRoot = process.cwd();

  afterEach(async () => {
    await Promise.all(tempDirs.map(async (dir) => cleanupNutWorkspace(dir)));
    tempDirs.length = 0;
  });

  it('returns a successful validation summary for a valid project without creating deployment state', async () => {
    const workspace = await createNutWorkspace('smart-deployment-validate-nut-');
    tempDirs.push(workspace.tempDir);
    const projectRoot = await createStandardProject(workspace.tempDir);

    const result = execCmd<{ success: boolean; components: number; waves: number; issueCount: number }>(
      `validate --source-path ${projectRoot} --json`,
      {
        cwd: repoRoot,
        ensureExitCode: 0,
        cli: 'dev',
        env: { ...process.env, HOME: workspace.homeDir, TESTKIT_HOMEDIR: workspace.homeDir },
      }
    );

    expect(result.shellOutput.stdout).to.include('"success": true');
    expect(result.shellOutput.stdout).to.include('"components": 1');
    expect(result.shellOutput.stdout).to.include('"issueCount": 0');
    expect(await stateFileExists(projectRoot)).to.equal(false);
  });

  it('returns a failed validation summary for corrupted metadata without attempting deployment', async () => {
    const workspace = await createNutWorkspace('smart-deployment-validate-nut-');
    tempDirs.push(workspace.tempDir);
    const projectRoot = await createCorruptedProject(workspace.tempDir);

    const result = execCmd<{ success: boolean; issueCount: number }>(`validate --source-path ${projectRoot} --json`, {
      cwd: repoRoot,
      ensureExitCode: 0,
      cli: 'dev',
      env: { ...process.env, HOME: workspace.homeDir, TESTKIT_HOMEDIR: workspace.homeDir },
    });

    expect(result.shellOutput.stdout).to.include('"success": false');
    expect(result.shellOutput.stdout).to.match(/"issueCount":\s*[1-9]/);
    expect(await stateFileExists(projectRoot)).to.equal(false);
  });
});
