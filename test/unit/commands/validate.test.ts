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
    edges: [
      {
        from: 'ApexClass:Service',
        to: 'ApexClass:Base',
        type: 'hard',
        source: 'parser',
      },
    ],
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
  const originalScan = Object.getOwnPropertyDescriptor(MetadataScannerService.prototype, 'scan')?.value as
    | typeof MetadataScannerService.prototype.scan
    | undefined;
  const originalLoadState = Object.getOwnPropertyDescriptor(StateManager.prototype, 'loadState')?.value as
    | typeof StateManager.prototype.loadState
    | undefined;

  afterEach(() => {
    Object.defineProperty(MetadataScannerService.prototype, 'scan', { value: originalScan, writable: true });
    Object.defineProperty(StateManager.prototype, 'loadState', { value: originalLoadState, writable: true });
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
    expect(result.dependencies).to.equal(1);
    expect(result.dependencyBreakdown).to.deep.equal({
      hard: 1,
      soft: 0,
      inferred: 0,
    });
    expect(result.waves).to.equal(2);
    expect(result.issueCount).to.equal(0);
    expect(logs.some((message) => message.includes('Hard / Soft / Inferred: 1 / 0 / 0'))).to.be.true;
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
    expect(result.dependencies).to.equal(1);
    expect(result.issueCount).to.equal(1);
    expect(logs.some((message) => message.includes('Broken metadata file'))).to.be.true;
    expect(warnings.some((message) => message.includes('Validation found 1 issue'))).to.be.true;
  });

  it('reports wave risk warnings for soft and inferred dependencies', async () => {
    MetadataScannerService.prototype.scan = async function scanMock() {
      return createScanResult({
        components: [
          {
            name: 'Base',
            type: 'ApexClass',
            filePath: 'force-app/main/default/classes/Base.cls',
            dependencies: new Set(),
            dependents: new Set(['ApexClass:Service', 'ApexClass:ServiceTest']),
            priorityBoost: 0,
          },
          {
            name: 'Service',
            type: 'ApexClass',
            filePath: 'force-app/main/default/classes/Service.cls',
            dependencies: new Set(['ApexClass:Base', 'ApexClass:Helper']),
            dependents: new Set(),
            priorityBoost: 0,
          },
          {
            name: 'Helper',
            type: 'ApexClass',
            filePath: 'force-app/main/default/classes/Helper.cls',
            dependencies: new Set(),
            dependents: new Set(['ApexClass:Service']),
            priorityBoost: 0,
          },
        ],
        dependencyResult: {
          components: new Map(),
          graph: new Map([
            ['ApexClass:Base', new Set<string>()],
            ['ApexClass:Helper', new Set<string>()],
            ['ApexClass:Service', new Set<string>(['ApexClass:Base', 'ApexClass:Helper'])],
          ]),
          reverseGraph: new Map(),
          edges: [
            {
              from: 'ApexClass:Service',
              to: 'ApexClass:Base',
              type: 'soft',
              source: 'parser',
            },
            {
              from: 'ApexClass:Service',
              to: 'ApexClass:Helper',
              type: 'inferred',
              source: 'ai',
            },
          ],
          circularDependencies: [],
          isolatedComponents: [],
          stats: {
            totalComponents: 3,
            totalDependencies: 2,
            componentsByType: { ApexClass: 3 },
            maxDepth: 1,
            mostDepended: { nodeId: 'ApexClass:Base', count: 1 },
            mostDependencies: { nodeId: 'ApexClass:Service', count: 2 },
          },
        },
      });
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
    (command as unknown as ValidateCommandTestDouble).warn = () => undefined;

    const result = await command.run();

    expect(result.success).to.equal(true);
    expect(result.issueCount).to.equal(1);
    expect(logs.some((message) => message.includes('soft dependency'))).to.equal(true);
    expect(logs.some((message) => message.includes('inferred dependency'))).to.equal(true);
  });
});
