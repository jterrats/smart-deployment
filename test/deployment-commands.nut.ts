import { expect } from 'chai';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, describe, it } from 'mocha';
import { StateManager } from '../src/deployment/state-manager.js';
import {
  cleanupNutContexts,
  createNutContext,
  createSalesforceProject,
  execNutCommand,
} from './helpers/nut-helpers.js';

describe('NUT: validate, status, and resume commands', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await cleanupNutContexts(tempDirs);
  });

  it('validate succeeds against a standard project without executing deployment', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'validate-project', {
      'force-app/main/default/classes/Healthy.cls': 'public class Healthy {}\n',
      'force-app/main/default/classes/Healthy.cls-meta.xml': [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">',
        '  <apiVersion>61.0</apiVersion>',
        '  <status>Active</status>',
        '</ApexClass>',
        '',
      ].join('\n'),
    });

    const result = execNutCommand<{ success: boolean; components: number; waves: number; issueCount: number }>(
      `validate --source-path ${projectRoot} --json`,
      homeDir
    );

    expect(result.shellOutput.stdout).to.include('"success": true');
    expect(result.shellOutput.stdout).to.include('"components": 1');
    expect(result.shellOutput.stdout).to.include('"issueCount": 0');
  });

  it('validate can run with AI validation enabled and report AI summary fields', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'validate-ai-project', {
      'force-app/main/default/classes/Healthy.cls': 'public class Healthy {}\n',
      'force-app/main/default/classes/Healthy.cls-meta.xml': [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">',
        '  <apiVersion>61.0</apiVersion>',
        '  <status>Active</status>',
        '</ApexClass>',
        '',
      ].join('\n'),
    });

    const result = execNutCommand<{ success: boolean; components: number; waves: number; issueCount: number }>(
      `validate --source-path ${projectRoot} --use-ai --json`,
      homeDir
    );

    expect(result.shellOutput.stdout).to.include('"success": true');
    expect(result.shellOutput.stdout).to.include('"components": 1');
    expect(result.shellOutput.stdout).to.include('"issueCount": 0');
    expect(result.shellOutput.stdout).to.include('"ai"');
    expect(result.shellOutput.stdout).to.include('"analyzed"');
    expect(result.shellOutput.stdout).to.include('"provider"');
    expect(result.shellOutput.stdout).to.include('"fallback"');
  });

  it('validate help exposes AI validation flags clearly', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);

    const result = execNutCommand('validate --help', homeDir);

    expect(result.shellOutput.stdout).to.include('--use-ai');
    expect(result.shellOutput.stdout).to.include('configured provider');
  });

  it('validate reports XML problems as validation issues', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'validate-broken-project', {
      'force-app/main/default/classes/Broken.cls': 'public class Broken {}\n',
      'force-app/main/default/classes/Broken.cls-meta.xml': [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">',
        '  <status>Active',
        '',
      ].join('\n'),
    });

    const result = execNutCommand<{ success: boolean; issueCount: number }>(
      `validate --source-path ${projectRoot} --json`,
      homeDir
    );

    expect(result.shellOutput.stdout).to.include('"success": false');
  });

  it('status reports not-started when no deployment state exists', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'status-empty-project', {
      'force-app/main/default/classes/StatusOnly.cls': 'public class StatusOnly {}\n',
    });

    const result = execNutCommand<{ status: string; canResume: boolean }>(
      `status --source-path ${projectRoot} --json`,
      homeDir
    );

    expect(result.shellOutput.stdout).to.include('"status": "Not Started"');
    expect(result.shellOutput.stdout).to.include('"canResume": false');
  });

  it('status reports resumable failed state for a project', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'status-failed-project', {
      'force-app/main/default/classes/Failed.cls': 'public class Failed {}\n',
    });
    const stateManager = new StateManager({ baseDir: projectRoot });

    await stateManager.saveState({
      deploymentId: 'deploy-status-1',
      targetOrg: 'status@example.com',
      timestamp: '2026-04-22T00:00:00.000Z',
      totalWaves: 4,
      completedWaves: [1],
      currentWave: 2,
      failedWave: {
        waveNumber: 2,
        error: 'UNABLE_TO_LOCK_ROW',
        timestamp: '2026-04-22T00:01:00.000Z',
      },
      metadata: {
        testStatus: 'Blocked by previous failure',
        aiProvider: 'openai',
        aiModel: 'gpt-4o-mini',
        aiFallback: true,
        aiAdjustments: 2,
        aiUnknownTypes: ['BotVersion'],
        aiInferenceFallback: false,
        aiInferredDependencies: 1,
      },
    });

    const result = execNutCommand<{ status: string; canResume: boolean; currentWave: number }>(
      `status --source-path ${projectRoot} --json`,
      homeDir
    );

    expect(result.shellOutput.stdout).to.include('"status": "Failed"');
    expect(result.shellOutput.stdout).to.include('"canResume": true');
    expect(result.shellOutput.stdout).to.include('"currentWave": 2');
    expect(result.shellOutput.stdout).to.include('"ai"');
    expect(result.shellOutput.stdout).to.include('"provider": "openai"');
    expect(result.shellOutput.stdout).to.include('"fallback": true');
  });

  it('resume updates persisted state from the failed wave', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'resume-project', {
      'force-app/main/default/classes/Resume.cls': 'public class Resume {}\n',
    });
    const stateManager = new StateManager({ baseDir: projectRoot });

    await stateManager.saveState({
      deploymentId: 'deploy-resume-1',
      targetOrg: 'resume@example.com',
      timestamp: '2026-04-22T00:00:00.000Z',
      totalWaves: 5,
      completedWaves: [1, 2],
      currentWave: 3,
      failedWave: {
        waveNumber: 3,
        error: 'REQUEST_LIMIT_EXCEEDED',
        timestamp: '2026-04-22T00:01:00.000Z',
      },
      metadata: {
        testStatus: 'Blocked by previous failure',
      },
    });

    const result = execNutCommand<{ success: boolean; resumedFromWave: number; remainingWaves: number }>(
      `resume --source-path ${projectRoot} --retry-strategy quick --json`,
      homeDir
    );

    const persistedState = JSON.parse(
      await readFile(path.join(projectRoot, '.smart-deployment/deployment-state.json'), 'utf8')
    ) as {
      failedWave?: unknown;
      metadata?: Record<string, unknown>;
    };

    expect(result.shellOutput.stdout).to.include('"success": true');
    expect(result.shellOutput.stdout).to.include('"resumedFromWave": 3');
    expect(persistedState.failedWave).to.equal(undefined);
    expect(persistedState.metadata).to.deep.include({
      retryStrategy: 'quick',
      resumedFromWave: 3,
      lastKnownStatus: 'Resumed',
    });
  });

  it('resume fails when there is no failed deployment state to resume', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'resume-empty-project', {
      'force-app/main/default/classes/ResumeOnly.cls': 'public class ResumeOnly {}\n',
    });

    const result = execNutCommand(`resume --source-path ${projectRoot}`, homeDir, 'nonZero');

    expect(result.shellOutput.stderr).to.include('No failed deployment state found to resume');
  });
});
