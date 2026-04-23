import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import Status from '../../../src/commands/status.js';
import { StateManager } from '../../../src/deployment/state-manager.js';

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

type StatusCommandTestDouble = {
  parse: () => Promise<ParseResult>;
  log: (message?: string) => void;
};

describe('StatusCommand', () => {
  const originalLoadState = StateManager.prototype.loadState;

  afterEach(() => {
    StateManager.prototype.loadState = originalLoadState;
  });

  it('US-050: reports current deployment status from persisted state', async () => {
    StateManager.prototype.loadState = async function loadStateMock() {
      return {
        deploymentId: 'deploy-456',
        targetOrg: 'test-org',
        timestamp: '2026-04-20T00:00:00.000Z',
        totalWaves: 5,
        completedWaves: [1, 2],
        currentWave: 3,
        metadata: {
          estimatedTimeRemainingSeconds: 180,
          testsRun: 12,
          testFailures: 1,
        },
      };
    };

    const command = new Status([], {} as never);
    const logs: string[] = [];

    (command as unknown as StatusCommandTestDouble).parse = async () => ({
      flags: { 'target-org': 'test-org' },
      args: {},
      argv: [],
      raw: [],
      metadata: { flags: {}, args: {} },
      nonExistentFlags: [],
      _runtime: {},
    });
    (command as unknown as StatusCommandTestDouble).log = (message?: string) => {
      if (message) logs.push(message);
    };

    const result = await command.run();

    expect(result.currentWave).to.equal(3);
    expect(result.totalWaves).to.equal(5);
    expect(result.completedWaves).to.deep.equal([1, 2]);
    expect(result.remainingWaves).to.equal(3);
    expect(result.status).to.equal('In Progress');
    expect(result.canResume).to.be.false;
    expect(logs.some((message) => message.includes('Estimated Time Remaining: 180s'))).to.be.true;
    expect(logs.some((message) => message.includes('Test Status: Tests run: 12 (1 failures)'))).to.be.true;
  });

  it('US-050: returns a not-started status when no state exists', async () => {
    StateManager.prototype.loadState = async function loadStateMock() {
      return null;
    };

    const command = new Status([], {} as never);
    const logs: string[] = [];

    (command as unknown as StatusCommandTestDouble).parse = async () => ({
      flags: { 'target-org': 'test-org' },
      args: {},
      argv: [],
      raw: [],
      metadata: { flags: {}, args: {} },
      nonExistentFlags: [],
      _runtime: {},
    });
    (command as unknown as StatusCommandTestDouble).log = (message?: string) => {
      if (message) logs.push(message);
    };

    const result = await command.run();

    expect(result).to.deep.equal({
      currentWave: 0,
      totalWaves: 0,
      completedWaves: [],
      remainingWaves: 0,
      status: 'Not Started',
      canResume: false,
    });
    expect(logs).to.deep.equal(['ℹ️ No deployment state found.']);
  });
});
