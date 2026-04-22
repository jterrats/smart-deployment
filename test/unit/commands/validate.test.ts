import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import Validate from '../../../src/commands/validate.js';
import { MetadataScannerService } from '../../../src/services/metadata-scanner-service.js';
import { StateManager } from '../../../src/deployment/state-manager.js';
import type { ScanResult } from '../../../src/services/metadata-scanner-service.js';
import type { DependencyAnalysisResult } from '../../../src/types/dependency.js';

function createScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  const dependencyResult: DependencyAnalysisResult = {
    components: new Map(),
    graph: new Map([
      ['ApexClass:Base', new Set<string>()],
      ['ApexClass:Service', new Set<string>(['ApexClass:Base'])],
    ]),
    reverseGraph: new Map(),
    circularDependencies: [],
    isolatedComponents: [],
    stats: {
      totalComponents: 2,
      totalDependencies: 1,
      componentsByType: { ApexClass: 2 },
      maxDepth: 1,
      mostDepended: { nodeId: 'ApexClass:Base', count: 1 },
      mostDependencies: { nodeId: 'ApexClass:Service', count: 1 },
    },
  };

  return {
    components: [
      {
        name: 'Base',
        type: 'ApexClass',
        filePath: 'force-app/main/default/classes/Base.cls',
        dependencies: new Set(),
        dependents: new Set(['ApexClass:Service']),
        priorityBoost: 0,
      },
      {
        name: 'Service',
        type: 'ApexClass',
        filePath: 'force-app/main/default/classes/Service.cls',
        dependencies: new Set(['ApexClass:Base']),
        dependents: new Set(),
        priorityBoost: 0,
      },
    ],
    dependencyResult,
    projectRoot: process.cwd(),
    executionTime: 25,
    errors: [],
    warnings: [],
    ...overrides,
  };
}

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

type ValidateCommandTestDouble = {
  parse: () => Promise<ParseResult>;
  log: (message?: string) => void;
  warn: (message?: string | Error) => void;
  error: (message: string) => never;
};

describe('ValidateCommand', () => {
  const originalScan = MetadataScannerService.prototype.scan;
  const originalLoadState = StateManager.prototype.loadState;

  afterEach(() => {
    MetadataScannerService.prototype.scan = originalScan;
    StateManager.prototype.loadState = originalLoadState;
  });

  it('US-048: validates waves without deploying', async () => {
    MetadataScannerService.prototype.scan = async function scanMock() {
      return createScanResult();
    };
    StateManager.prototype.loadState = async function loadStateMock() {
      return null;
    };

    const command = new Validate([], {} as never);
    const logs: string[] = [];

    (command as unknown as ValidateCommandTestDouble).parse = async () => ({
      flags: { 'target-org': 'test-org' },
      args: {},
      argv: [],
      raw: [],
      metadata: { flags: {}, args: {} },
      nonExistentFlags: [],
      _runtime: {},
    });
    (command as unknown as ValidateCommandTestDouble).log = (message?: string) => {
      if (message) logs.push(message);
    };
    (command as unknown as ValidateCommandTestDouble).warn = (message?: string | Error) => {
      logs.push(String(message));
    };

    const result = await command.run();

    expect(result.success).to.be.true;
    expect(result.components).to.equal(2);
    expect(result.waves).to.equal(2);
    expect(result.issueCount).to.equal(0);
    expect(logs.some((message) => message.includes('No deployment was executed'))).to.be.true;
  });

  it('US-048: fails when validation issues are detected', async () => {
    MetadataScannerService.prototype.scan = async function scanMock() {
      return createScanResult({
        errors: ['Broken metadata file'],
      });
    };
    StateManager.prototype.loadState = async function loadStateMock() {
      return null;
    };

    const command = new Validate([], {} as never);
    const logs: string[] = [];
    const warnings: string[] = [];

    (command as unknown as ValidateCommandTestDouble).parse = async () => ({
      flags: { 'target-org': 'test-org' },
      args: {},
      argv: [],
      raw: [],
      metadata: { flags: {}, args: {} },
      nonExistentFlags: [],
      _runtime: {},
    });
    (command as unknown as ValidateCommandTestDouble).log = (message?: string) => {
      if (message) logs.push(message);
    };
    (command as unknown as ValidateCommandTestDouble).warn = (message?: string | Error) => {
      warnings.push(String(message));
    };

    const result = await command.run();

    expect(result.success).to.be.false;
    expect(result.issueCount).to.equal(1);
    expect(logs.some((message) => message.includes('Broken metadata file'))).to.be.true;
    expect(warnings.some((message) => message.includes('Validation found 1 issue'))).to.be.true;
  });
});
