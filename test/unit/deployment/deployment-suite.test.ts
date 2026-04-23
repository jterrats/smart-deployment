import { mkdtemp, readFile, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { DeploymentReporter, type DeploymentReport } from '../../../src/deployment/deployment-reporter.js';
import { DeploymentTracker } from '../../../src/deployment/deployment-tracker.js';
import { RetryHandler } from '../../../src/deployment/retry-handler.js';
import { SfCliIntegration } from '../../../src/deployment/sf-cli-integration.js';

type SfCliIntegrationPrivate = {
  buildDeployCommand: (options: {
    manifestPath: string;
    targetOrg: string;
    testLevel?: 'NoTestRun' | 'RunSpecifiedTests' | 'RunLocalTests' | 'RunAllTestsInOrg';
    tests?: string[];
    checkOnly?: boolean;
  }) => string;
  parseDeploymentOutput: (
    output: string,
    failed?: boolean
  ) => {
    success: boolean;
    deploymentId?: string;
    status: string;
    componentSuccesses: number;
    componentFailures: number;
    testsRun?: number;
    testFailures?: number;
    output: string;
  };
};

function createDeploymentReport(): DeploymentReport {
  return {
    deploymentId: '0Afxx0000001234',
    targetOrg: 'release@example.com',
    startTime: '2026-04-22T00:00:00.000Z',
    endTime: '2026-04-22T00:03:00.000Z',
    totalDuration: 180,
    success: false,
    totalWaves: 2,
    completedWaves: 1,
    totalComponents: 7,
    totalTests: 12,
    waves: [
      {
        waveNumber: 1,
        components: 4,
        startTime: '2026-04-22T00:00:00.000Z',
        endTime: '2026-04-22T00:01:00.000Z',
        duration: 60,
        success: true,
        testsRun: 6,
        testFailures: 0,
      },
      {
        waveNumber: 2,
        components: 3,
        startTime: '2026-04-22T00:02:00.000Z',
        endTime: '2026-04-22T00:03:00.000Z',
        duration: 60,
        success: false,
        testsRun: 6,
        testFailures: 2,
        error: 'UNABLE_TO_LOCK_ROW',
      },
    ],
    errors: ['UNABLE_TO_LOCK_ROW'],
  };
}

describe('Deployment Engine Suite', () => {
  let tempDir: string | undefined;
  let originalCwd: string | undefined;

  afterEach(async () => {
    if (originalCwd) {
      process.chdir(originalCwd);
      originalCwd = undefined;
    }

    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  describe('SF CLI Integration (US-085)', () => {
    it('builds deploy commands with manifest, target org, test level, and dry-run flags', () => {
      const integration = new SfCliIntegration();
      const internals = integration as unknown as SfCliIntegrationPrivate;

      const command = internals.buildDeployCommand({
        manifestPath: '/tmp/package.xml',
        targetOrg: 'qa@example.com',
        testLevel: 'RunSpecifiedTests',
        tests: ['AlphaTest', 'BetaTest'],
        checkOnly: true,
      });

      expect(command).to.include('sf project deploy start');
      expect(command).to.include('--manifest /tmp/package.xml');
      expect(command).to.include('--target-org qa@example.com');
      expect(command).to.include('--test-level RunSpecifiedTests');
      expect(command).to.include('--tests AlphaTest BetaTest');
      expect(command).to.include('--dry-run');
      expect(command).to.include('--json');
    });

    it('parses successful JSON deployment output into a structured result', () => {
      const integration = new SfCliIntegration();
      const internals = integration as unknown as SfCliIntegrationPrivate;

      const result = internals.parseDeploymentOutput(
        JSON.stringify({
          result: {
            id: '0Afxx0000009999',
            status: 'Succeeded',
            numberComponentsDeployed: 5,
            numberComponentErrors: 0,
            numberTestsTotal: 8,
            numberTestErrors: 1,
          },
        })
      );

      expect(result).to.deep.include({
        success: true,
        deploymentId: '0Afxx0000009999',
        status: 'Succeeded',
        componentSuccesses: 5,
        componentFailures: 0,
        testsRun: 8,
        testFailures: 1,
      });
    });

    it('falls back to a failed result when output cannot be parsed', () => {
      const integration = new SfCliIntegration();
      const internals = integration as unknown as SfCliIntegrationPrivate;

      const result = internals.parseDeploymentOutput('plain text failure', true);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal('Failed');
      expect(result.componentFailures).to.equal(1);
    });
  });

  describe('Deployment Progress Tracking (US-086)', () => {
    it('tracks progress percentage and ETA for a deployment wave', () => {
      const tracker = new DeploymentTracker();

      tracker.startTracking('0Afxx0000001111', 2, 4);

      const internals = tracker as unknown as {
        startTimes: Map<string, number>;
      };
      internals.startTimes.set('0Afxx0000001111', Date.now() - 4000);

      tracker.updateProgress('0Afxx0000001111', {
        success: false,
        deploymentId: '0Afxx0000001111',
        status: 'In Progress',
        componentSuccesses: 3,
        componentFailures: 1,
        output: '',
      });

      const progress = tracker.getProgress('0Afxx0000001111');
      const formatted = tracker.formatProgress('0Afxx0000001111');

      expect(progress).to.deep.include({
        deploymentId: '0Afxx0000001111',
        waveNumber: 2,
        totalWaves: 4,
        percentage: 75,
        status: 'In Progress',
      });
      expect(progress?.eta).to.be.a('number');
      expect(formatted).to.include('Wave 2/4');
      expect(formatted).to.include('Progress: 75%');
      expect(formatted).to.include('ETA:');
    });
  });

  describe('Deployment Retry Logic (US-088)', () => {
    it('detects retryable platform errors', () => {
      const retryHandler = new RetryHandler();

      expect(retryHandler.isRetryable('REQUEST_LIMIT_EXCEEDED: slow down')).to.equal(true);
      expect(retryHandler.isRetryable('FIELD_CUSTOM_VALIDATION_EXCEPTION')).to.equal(false);
    });

    it('retries transient failures and eventually returns the successful result', async () => {
      const retryHandler = new RetryHandler({ maxRetries: 3, initialDelay: 1, maxDelay: 2 });
      let attempts = 0;

      const result = await retryHandler.executeWithRetry(async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error('UNABLE_TO_LOCK_ROW');
        }

        return 'ok';
      }, 'deploy-wave-2');

      expect(result).to.equal('ok');
      expect(attempts).to.equal(3);
    });

    it('fails after the configured retry limit for persistent transient errors', async () => {
      const retryHandler = new RetryHandler({ maxRetries: 2, initialDelay: 1, maxDelay: 2 });
      let thrownError: Error | undefined;

      try {
        await retryHandler.executeWithRetry(async () => {
          throw new Error('TIMEOUT');
        }, 'deploy-wave-3');
      } catch (error) {
        thrownError = error as Error;
      }

      expect(thrownError).to.be.instanceOf(Error);
      expect(thrownError?.message).to.include('Max retries (2) exceeded');
    });
  });

  describe('Deployment Reporting (US-090)', () => {
    it('renders text, JSON, and HTML reports with deployment details', () => {
      const reporter = new DeploymentReporter();
      const report = createDeploymentReport();

      const text = reporter.generateReport(report);
      const json = reporter.toJSON(report);
      const html = reporter.toHTML(report);

      expect(text).to.include('DEPLOYMENT REPORT');
      expect(text).to.include('Wave 2:');
      expect(text).to.include('UNABLE_TO_LOCK_ROW');
      expect(json).to.include('"deploymentId": "0Afxx0000001234"');
      expect(html).to.include('<table>');
      expect(html).to.include('release@example.com');
    });

    it('saves a JSON report to disk', async () => {
      const reporter = new DeploymentReporter();
      const report = createDeploymentReport();

      originalCwd = process.cwd();
      tempDir = await mkdtemp(path.join(os.tmpdir(), 'deployment-report-'));
      process.chdir(tempDir);

      const fileName = await reporter.saveReport(report, 'json');
      const savedContent = await readFile(path.join(tempDir, fileName), 'utf8');

      expect(fileName).to.match(/^deployment-report-.*\.json$/);
      expect(savedContent).to.include('"totalWaves": 2');
      expect(savedContent).to.include('"errors": [');
    });
  });
});
