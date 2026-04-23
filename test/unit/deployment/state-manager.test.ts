import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
import {
  StateManager,
  type CycleRemediationState,
  type DeploymentState,
} from '../../../src/deployment/state-manager.js';

describe('StateManager', () => {
  let testDir: string;
  let stateManager: StateManager;

  beforeEach(async () => {
    testDir = await mkdtemp(path.join(os.tmpdir(), 'state-manager-'));
    stateManager = new StateManager({ baseDir: testDir });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('saves and loads deployment state with an active cycle remediation phase', async () => {
    const cycleRemediation: CycleRemediationState = {
      cycleId: 'ApexClass:Alpha|ApexClass:Beta',
      strategy: 'comment-reference',
      activePhase: 1,
      startedAt: '2026-04-22T00:00:00.000Z',
      completedPhases: [],
      editRecords: [],
    };
    const state: DeploymentState = {
      deploymentId: 'deploy-remediation-1',
      targetOrg: 'test@example.com',
      timestamp: '2026-04-22T00:00:00.000Z',
      totalWaves: 3,
      completedWaves: [1],
      currentWave: 2,
      cycleRemediation,
    };

    await stateManager.saveState(state);

    const loaded = await stateManager.loadState();

    expect(loaded).to.deep.equal(state);
  });

  it('preserves cycle remediation edit records across save and load', async () => {
    const state: DeploymentState = {
      deploymentId: 'deploy-remediation-2',
      targetOrg: 'test@example.com',
      timestamp: '2026-04-22T00:00:00.000Z',
      totalWaves: 2,
      completedWaves: [],
      currentWave: 1,
      cycleRemediation: {
        cycleId: 'ApexClass:Alpha|ApexClass:Beta',
        strategy: 'comment-reference',
        activePhase: 2,
        startedAt: '2026-04-22T00:00:00.000Z',
        completedPhases: [1],
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

    await stateManager.saveState(state);

    const rawState = JSON.parse(await readFile(stateManager.getStateFilePath(), 'utf8')) as DeploymentState;
    const loaded = await stateManager.loadState();

    expect(rawState.cycleRemediation?.editRecords).to.deep.equal(state.cycleRemediation?.editRecords);
    expect(loaded?.cycleRemediation?.editRecords).to.deep.equal(state.cycleRemediation?.editRecords);
  });

  it('loads older deployment state files without remediation fields', async () => {
    const legacyState = {
      deploymentId: 'deploy-legacy-1',
      targetOrg: 'legacy@example.com',
      timestamp: '2026-04-22T00:00:00.000Z',
      totalWaves: 4,
      completedWaves: [1, 2],
      currentWave: 3,
      metadata: {
        retryStrategy: 'quick',
      },
    };

    await mkdir(path.dirname(stateManager.getStateFilePath()), { recursive: true });
    await writeFile(stateManager.getStateFilePath(), JSON.stringify(legacyState, null, 2), 'utf8');

    const loaded = await stateManager.loadState();

    expect(loaded).to.deep.equal(legacyState);
    expect(loaded?.cycleRemediation).to.equal(undefined);
  });

  it('preserves AI metadata fields across save and load', async () => {
    const state: DeploymentState = {
      deploymentId: 'deploy-ai-1',
      targetOrg: 'ai@example.com',
      timestamp: '2026-04-23T00:00:00.000Z',
      totalWaves: 2,
      completedWaves: [1],
      currentWave: 2,
      metadata: {
        aiProvider: 'openai',
        aiModel: 'gpt-4o-mini',
        aiFallback: true,
        aiAdjustments: 3,
        aiUnknownTypes: ['BotVersion'],
        aiInferenceFallback: false,
        aiInferredDependencies: 2,
      },
    };

    await stateManager.saveState(state);

    const loaded = await stateManager.loadState();

    expect(loaded).to.deep.equal(state);
  });
});
