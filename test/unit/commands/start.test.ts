import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
import Start from '../../../src/commands/start.js';
import { SfCliIntegration } from '../../../src/deployment/sf-cli-integration.js';

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

async function createProjectWithRelatedTest(rootDir: string): Promise<{
  projectRoot: string;
}> {
  const projectRoot = path.join(rootDir, 'project-with-tests');
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

  await writeFile(
    path.join(classesDir, 'AccountService.cls'),
    `public with sharing class AccountService {
  public static void execute() {}
}`
  );
  await writeFile(
    path.join(classesDir, 'AccountServiceTest.cls'),
    `@IsTest
private class AccountServiceTest {
  @IsTest
  static void testExecute() {
    Test.startTest();
    AccountService.execute();
    Test.stopTest();
  }
}`
  );

  return { projectRoot };
}

async function createProjectWithStructuredRelatedTest(rootDir: string): Promise<{
  projectRoot: string;
}> {
  const projectRoot = path.join(rootDir, 'project-with-structured-tests');
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

  await writeFile(
    path.join(classesDir, 'AccountService.cls'),
    `public with sharing class AccountService {
  public static void execute() {}
}`
  );
  await writeFile(
    path.join(classesDir, 'ServiceValidationSpec.cls'),
    `@IsTest
private class ServiceValidationSpec {
  @IsTest
  static void validatesAccountService() {
    Test.startTest();
    AccountService.execute();
    Test.stopTest();
  }
}`
  );

  return { projectRoot };
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
    const originalDeploy = Object.getOwnPropertyDescriptor(SfCliIntegration.prototype, 'deploy')?.value as
      | typeof SfCliIntegration.prototype.deploy
      | undefined;
    const deployCalls: string[] = [];

    SfCliIntegration.prototype.deploy = async function stubDeploy(options) {
      deployCalls.push(options.manifestPath);
      return {
        success: true,
        deploymentId: `deploy-${deployCalls.length}`,
        status: 'Succeeded',
        componentSuccesses: 2,
        componentFailures: 0,
        output: '{"result":{"status":"Succeeded"}}',
      };
    };

    try {
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
      expect(deployCalls).to.have.lengthOf(2);

      let stateFileExists = true;
      try {
        await access(path.join(projectRoot, '.smart-deployment/deployment-state.json'), fsConstants.F_OK);
      } catch {
        stateFileExists = false;
      }

      expect(stateFileExists).to.equal(false);
    } finally {
      Object.defineProperty(SfCliIntegration.prototype, 'deploy', { value: originalDeploy, writable: true });
    }
  });

  it('uses RunSpecifiedTests when related Apex tests are present in the scanned project', async () => {
    const { projectRoot } = await createProjectWithRelatedTest(tempDir);
    const command = new Start([], {} as never);
    const deployCalls: Array<{ testLevel?: string; tests?: string[] }> = [];
    const originalDeploy = Object.getOwnPropertyDescriptor(SfCliIntegration.prototype, 'deploy')?.value as
      | typeof SfCliIntegration.prototype.deploy
      | undefined;

    SfCliIntegration.prototype.deploy = async function stubDeploy(options) {
      deployCalls.push({
        testLevel: options.testLevel,
        tests: options.tests,
      });
      return {
        success: true,
        deploymentId: 'deploy-tests',
        status: 'Succeeded',
        componentSuccesses: 2,
        componentFailures: 0,
        testsRun: 1,
        testFailures: 0,
        output: '{"result":{"status":"Succeeded"}}',
      };
    };

    try {
      (command as unknown as StartCommandTestDouble).parse = async () => ({
        flags: {
          'target-org': 'test-org',
          'dry-run': false,
          'validate-only': false,
          'skip-tests': false,
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

      const result = await command.run();

      expect(result.success).to.equal(true);
      expect(deployCalls.length).to.be.greaterThan(0);
      expect(
        deployCalls.some(
          (deployCall) =>
            deployCall.testLevel === 'RunSpecifiedTests' && (deployCall.tests?.includes('AccountServiceTest') ?? false)
        )
      ).to.equal(true);
    } finally {
      Object.defineProperty(SfCliIntegration.prototype, 'deploy', { value: originalDeploy, writable: true });
    }
  });

  it('uses structured test metadata when the related test name does not follow standard naming conventions', async () => {
    const { projectRoot } = await createProjectWithStructuredRelatedTest(tempDir);
    const command = new Start([], {} as never);
    const deployCalls: Array<{ testLevel?: string; tests?: string[] }> = [];
    const originalDeploy = Object.getOwnPropertyDescriptor(SfCliIntegration.prototype, 'deploy')?.value as
      | typeof SfCliIntegration.prototype.deploy
      | undefined;

    SfCliIntegration.prototype.deploy = async function stubDeploy(options) {
      deployCalls.push({
        testLevel: options.testLevel,
        tests: options.tests,
      });
      return {
        success: true,
        deploymentId: 'deploy-structured-tests',
        status: 'Succeeded',
        componentSuccesses: 2,
        componentFailures: 0,
        testsRun: 1,
        testFailures: 0,
        output: '{"result":{"status":"Succeeded"}}',
      };
    };

    try {
      (command as unknown as StartCommandTestDouble).parse = async () => ({
        flags: {
          'target-org': 'test-org',
          'dry-run': false,
          'validate-only': false,
          'skip-tests': false,
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

      const result = await command.run();

      expect(result.success).to.equal(true);
      expect(
        deployCalls.some(
          (deployCall) =>
            deployCall.testLevel === 'RunSpecifiedTests' &&
            (deployCall.tests?.includes('ServiceValidationSpec') ?? false)
        ),
        JSON.stringify(deployCalls)
      ).to.equal(true);
    } finally {
      Object.defineProperty(SfCliIntegration.prototype, 'deploy', { value: originalDeploy, writable: true });
    }
  });
});
