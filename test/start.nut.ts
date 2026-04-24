import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import {
  cleanupNutContexts,
  createNutContext,
  createSalesforceProject,
  execNutCommand,
  parseJsonStdout,
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

    const output = parseJsonStdout<{ success: boolean; waves: number }>(result.shellOutput.stdout);

    expect(output.success).to.equal(true);
    expect(output.waves).to.equal(1);
  });

  it('runs successfully in dry-run mode with AI prioritization enabled', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createStandardProject(tempDir);

    const result = execNutCommand<{ success: boolean; waves: number }>(
      `start --source-path ${projectRoot} --dry-run --use-ai --json`,
      homeDir
    );

    const output = parseJsonStdout<{
      success: boolean;
      waves: number;
      ai?: {
        enabled?: boolean;
        provider?: string;
        fallback?: boolean;
        inferredDependencies?: number;
        inferenceFallback?: boolean;
      };
    }>(result.shellOutput.stdout);

    expect(output.success).to.equal(true);
    expect(output.waves).to.equal(1);
    expect(output.ai?.enabled).to.equal(true);
    expect(output.ai?.provider).to.be.a('string');
    expect(output.ai?.fallback).to.be.a('boolean');
    expect(output.ai?.inferredDependencies).to.be.a('number');
    expect(output.ai?.inferenceFallback).to.be.a('boolean');
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

    expect(result.shellOutput.stderr).to.include('Circular dependencies detected.');
    expect(result.shellOutput.stderr).to.include('--allow-cycle-remediation');
  });

  it('requires a target org before attempting a real cycle remediation deployment', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createCircularProject(tempDir);
    const alphaPath = path.join(projectRoot, 'force-app/main/default/classes/Alpha.cls');
    const originalAlpha = await readFile(alphaPath, 'utf8');

    const result = execNutCommand(`start --source-path ${projectRoot} --allow-cycle-remediation`, homeDir, 'nonZero');

    expect(result.shellOutput.stderr).to.include('--target-org');
    expect(result.shellOutput.stderr).to.include('cycle remediation deployments');
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
