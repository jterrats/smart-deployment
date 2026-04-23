import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import Resume from '../../../src/commands/resume.js';
import { StateManager } from '../../../src/deployment/state-manager.js';
import type { DeploymentState } from '../../../src/deployment/state-manager.js';

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

type ResumeCommandTestDouble = {
  parse: () => Promise<ParseResult>;
  log: (message?: string) => void;
  error: (message: string) => never;
};

describe('ResumeCommand', () => {
  const originalLoadState = Object.getOwnPropertyDescriptor(StateManager.prototype, 'loadState')?.value as
    | typeof StateManager.prototype.loadState
    | undefined;
  const originalSaveState = Object.getOwnPropertyDescriptor(StateManager.prototype, 'saveState')?.value as
    | typeof StateManager.prototype.saveState
    | undefined;

  afterEach(() => {
    Object.defineProperty(StateManager.prototype, 'loadState', { value: originalLoadState, writable: true });
    Object.defineProperty(StateManager.prototype, 'saveState', { value: originalSaveState, writable: true });
  });

  it('US-049: resumes from the failed wave and updates persisted state', async () => {
    const savedStates: DeploymentState[] = [];

    StateManager.prototype.loadState = async function loadStateMock() {
      return {
        deploymentId: 'deploy-123',
        targetOrg: 'test-org',
        timestamp: '2026-04-20T00:00:00.000Z',
        totalWaves: 4,
        completedWaves: [1],
        currentWave: 2,
        failedWave: {
          waveNumber: 2,
          error: 'UNABLE_TO_LOCK_ROW',
          timestamp: '2026-04-20T00:01:00.000Z',
        },
        metadata: {
          testStatus: 'Blocked by previous failure',
        },
      };
    };
    StateManager.prototype.saveState = async function saveStateMock(state: DeploymentState) {
      savedStates.push(state);
    };

    const command = new Resume([], {} as never);
    const logs: string[] = [];

    (command as unknown as ResumeCommandTestDouble).parse = async () => ({
      flags: { 'target-org': 'test-org', 'retry-strategy': 'quick' },
      args: {},
      argv: [],
      raw: [],
      metadata: { flags: {}, args: {} },
      nonExistentFlags: [],
      _runtime: {},
    });
    (command as unknown as ResumeCommandTestDouble).log = (message?: string) => {
      if (message) logs.push(message);
    };

    const result = await command.run();

    expect(result.success).to.be.true;
    expect(result.resumedFromWave).to.equal(2);
    expect(result.remainingWaves).to.equal(3);
    expect(savedStates).to.have.length(1);
    expect(savedStates[0].failedWave).to.equal(undefined);
    expect(savedStates[0].metadata).to.deep.include({
      retryStrategy: 'quick',
      resumedFromWave: 2,
      lastKnownStatus: 'Resumed',
    });
    expect(logs.some((message) => message.includes('Resuming from wave 2/4'))).to.be.true;
  });

  it('US-049: fails when there is no failed deployment to resume', async () => {
    StateManager.prototype.loadState = async function loadStateMock() {
      return null;
    };

    const command = new Resume([], {} as never);

    (command as unknown as ResumeCommandTestDouble).parse = async () => ({
      flags: { 'target-org': 'test-org', 'retry-strategy': 'standard' },
      args: {},
      argv: [],
      raw: [],
      metadata: { flags: {}, args: {} },
      nonExistentFlags: [],
      _runtime: {},
    });
    (command as unknown as ResumeCommandTestDouble).error = (message: string) => {
      throw new Error(message);
    };

    let thrownError: Error | undefined;

    try {
      await command.run();
    } catch (error) {
      thrownError = error as Error;
    }

    expect(thrownError).to.be.instanceOf(Error);
    expect(thrownError?.message).to.include('No failed deployment state found to resume');
  });
});
