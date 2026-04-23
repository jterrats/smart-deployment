import { expect } from 'chai';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'mocha';
import Start from '../../../src/commands/start.js';

type ParseResult = {
  flags: Record<string, unknown>;
  args: Record<string, unknown>;
  argv: string[];
  raw: unknown[];
  metadata: {
    flags: Record<string, unknown>;
    args: Record<string, unknown>;
  };
  nonExistentFlags: string[];
  _runtime: unknown;
};

type StartCommandTestDouble = {
  parse: () => Promise<ParseResult>;
  log: (message?: string) => void;
  warn: (message?: string | Error) => void;
  error: (message: string) => never;
};

async function createCircularProject(rootDir: string): Promise<{
  projectRoot: string;
  alphaPath: string;
  betaPath: string;
}> {
  const projectRoot = path.join(rootDir, 'project');
  const classesDir = path.join(projectRoot, 'force-app/main/default/classes');
  await rm(projectRoot, { recursive: true, force: true });
  await mkdir(classesDir, { recursive: true });
  await writeFile(
    path.join(projectRoot, 'sfdx-project.json'),
    JSON.stringify(
      {
        packageDirectories: [{ path: 'force-app', default: true }],
        sourceApiVersion: '61.0',
      },
      null,
      2
    ),
    'utf8'
  );
  await writeFile(path.join(projectRoot, '.forceignore'), '', 'utf8');

  const alphaPath = path.join(classesDir, 'Alpha.cls');
  const betaPath = path.join(classesDir, 'Beta.cls');
  const alphaSource = [
    'public class Alpha {',
    '  public static void execute() {}',
    '  public void run() {',
    '    Beta.execute();',
    '  }',
    '}',
    '',
  ].join('\n');
  const betaSource = [
    'public class Beta {',
    '  public static void execute() {',
    '    Alpha.execute();',
    '  }',
    '}',
    '',
  ].join('\n');

  await writeFile(alphaPath, alphaSource, 'utf8');
  await writeFile(betaPath, betaSource, 'utf8');

  return { projectRoot, alphaPath, betaPath };
}

describe('StartCommand', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'start-command-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('fails fast on circular dependencies unless remediation is explicitly enabled', async () => {
    const { projectRoot } = await createCircularProject(tempDir);
    const command = new Start([], {} as never);

    (command as unknown as StartCommandTestDouble).parse = async () => ({
      flags: {
        'target-org': 'test-org',
        'dry-run': false,
        'validate-only': false,
        'skip-tests': true,
        'use-ai': false,
        'allow-cycle-remediation': false,
        'source-path': projectRoot,
      },
      args: {},
      argv: [],
      raw: [],
      metadata: { flags: {}, args: {} },
      nonExistentFlags: [],
      _runtime: {},
    });
    (command as unknown as StartCommandTestDouble).log = () => undefined;
    (command as unknown as StartCommandTestDouble).warn = () => undefined;
    (command as unknown as StartCommandTestDouble).error = (message: string) => {
      throw new Error(message);
    };

    let thrownError: Error | undefined;

    try {
      await command.run();
    } catch (error) {
      thrownError = error as Error;
    }

    expect(thrownError).to.be.instanceOf(Error);
    expect(thrownError?.message).to.include('Circular dependencies detected');
    expect(thrownError?.message).to.include('--allow-cycle-remediation');
  });

  it('applies and restores conservative remediation edits for a simple ApexClass cycle', async () => {
    const { projectRoot, alphaPath, betaPath } = await createCircularProject(tempDir);
    const originalAlpha = await readFile(alphaPath, 'utf8');
    const originalBeta = await readFile(betaPath, 'utf8');
    const command = new Start([], {} as never);
    const logs: string[] = [];

    (command as unknown as StartCommandTestDouble).parse = async () => ({
      flags: {
        'target-org': 'test-org',
        'dry-run': false,
        'validate-only': false,
        'skip-tests': true,
        'use-ai': false,
        'allow-cycle-remediation': true,
        'source-path': projectRoot,
      },
      args: {},
      argv: [],
      raw: [],
      metadata: { flags: {}, args: {} },
      nonExistentFlags: [],
      _runtime: {},
    });
    (command as unknown as StartCommandTestDouble).log = (message?: string) => {
      if (message) logs.push(message);
    };
    (command as unknown as StartCommandTestDouble).warn = () => undefined;
    (command as unknown as StartCommandTestDouble).error = (message: string) => {
      throw new Error(message);
    };

    const result = await command.run();
    const restoredAlpha = await readFile(alphaPath, 'utf8');
    const restoredBeta = await readFile(betaPath, 'utf8');

    expect(result.success).to.equal(true);
    expect(restoredAlpha).to.equal(originalAlpha);
    expect(restoredBeta).to.equal(originalBeta);
    expect(logs.some((message) => message.includes('Phase 1/2'))).to.equal(true);
    expect(logs.some((message) => message.includes('Phase 2/2'))).to.equal(true);

    let stateFileExists = true;
    try {
      await access(path.join(projectRoot, '.smart-deployment/deployment-state.json'), fsConstants.F_OK);
    } catch {
      stateFileExists = false;
    }

    expect(stateFileExists).to.equal(false);
  });
});
