import { expect } from 'chai';
import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, it } from 'mocha';
import {
  cleanupNutContexts,
  createNutContext,
  createSalesforceProject,
  execNutCommand,
} from './helpers/nut-helpers.js';

async function createStandardProject(rootDir: string): Promise<string> {
  return createSalesforceProject(rootDir, 'standard-project', {
    'force-app/main/default/classes/TestClass.cls': 'public class TestClass {}\n',
  });
}

async function createCircularProject(rootDir: string): Promise<string> {
  return createSalesforceProject(rootDir, 'circular-project', {
    'force-app/main/default/classes/Alpha.cls': [
      'public class Alpha {',
      '  public static void execute() {}',
      '  public void run() {',
      '    Beta.execute();',
      '  }',
      '}',
      '',
    ].join('\n'),
    'force-app/main/default/classes/Beta.cls': [
      'public class Beta {',
      '  public static void execute() {',
      '    Alpha.execute();',
      '  }',
      '}',
      '',
    ].join('\n'),
  });
}

describe('NUT: start command', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await cleanupNutContexts(tempDirs);
  });

  it('runs successfully in dry-run mode for a standard project', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createStandardProject(tempDir);

    const result = execNutCommand<{ success: boolean; waves: number }>(
      `start --source-path ${projectRoot} --dry-run --json`,
      homeDir
    );

    expect(result.shellOutput.stdout).to.include('"success": true');
    expect(result.shellOutput.stdout).to.include('"waves": 1');
  });

  it('runs successfully in dry-run mode with AI prioritization enabled', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createStandardProject(tempDir);

    const result = execNutCommand<{ success: boolean; waves: number }>(
      `start --source-path ${projectRoot} --dry-run --use-ai --json`,
      homeDir
    );

    expect(result.shellOutput.stdout).to.include('"success": true');
    expect(result.shellOutput.stdout).to.include('"waves": 1');
    expect(result.shellOutput.stdout).to.include('"ai"');
    expect(result.shellOutput.stdout).to.include('"enabled": true');
    expect(result.shellOutput.stdout).to.include('"provider"');
    expect(result.shellOutput.stdout).to.include('"fallback"');
    expect(result.shellOutput.stdout).to.include('"inferredDependencies"');
    expect(result.shellOutput.stdout).to.include('"inferenceFallback"');
  });

  it('start help exposes AI prioritization context flags', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);

    const result = execNutCommand('start --help', homeDir);

    expect(result.shellOutput.stdout).to.include('--use-ai');
    expect(result.shellOutput.stdout).to.include('--org-type');
    expect(result.shellOutput.stdout).to.include('--industry');
  });

  it('fails fast for circular dependencies when remediation is not enabled', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createCircularProject(tempDir);

    const result = execNutCommand(`start --source-path ${projectRoot}`, homeDir, 'nonZero');

    expect(result.shellOutput.stderr).to.include('Circular dependencies detected');
    expect(result.shellOutput.stderr).to.include('--allow-cycle-remediation');
  });

  it('requires a target org before attempting a real cycle remediation deployment', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createCircularProject(tempDir);
    const alphaPath = path.join(projectRoot, 'force-app/main/default/classes/Alpha.cls');
    const originalAlpha = await readFile(alphaPath, 'utf8');

    const result = execNutCommand(`start --source-path ${projectRoot} --allow-cycle-remediation`, homeDir, 'nonZero');

    expect(result.shellOutput.stderr).to.include(
      'The --target-org flag is required for cycle remediation deployments.'
    );
    expect(await readFile(alphaPath, 'utf8')).to.equal(originalAlpha);

    let stateFileExists = true;
    try {
      await access(path.join(projectRoot, '.smart-deployment/deployment-state.json'), fsConstants.F_OK);
    } catch {
      stateFileExists = false;
    }

    expect(stateFileExists).to.equal(false);
  });
});
