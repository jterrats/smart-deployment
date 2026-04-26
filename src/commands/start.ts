/**
 * smart-deployment:start command
 * Main deployment command that orchestrates the entire workflow
 *
 * @ac US-046-AC-1: Analyzes metadata automatically
 * @ac US-046-AC-2: Generates deployment waves
 * @ac US-046-AC-3: Executes deployment sequentially
 * @ac US-046-AC-4: Supports --target-org flag
 * @ac US-046-AC-5: Supports --dry-run flag
 * @ac US-046-AC-6: Supports --validate-only flag
 * @ac US-046-AC-7: Supports --skip-tests flag
 * @ac US-046-AC-8: Shows progress bar
 * @ac US-046-AC-9: Generates deployment report
 * @ac US-046-AC-10: Handles failures gracefully
 *
 * @issue #46
 */

import { type Interfaces } from '@oclif/core';
import { Messages } from '@salesforce/core';
import { Flags, SfCommand, optionalOrgFlagWithDeprecations } from '@salesforce/sf-plugins-core';
import { getLogger } from '../utils/logger.js';
import { CycleRemediationPlanner } from '../dependencies/cycle-remediation-planner.js';
import { SfCliIntegration } from '../deployment/sf-cli-integration.js';
import { TestPlanService } from '../deployment/test-plan-service.js';
import { CycleRemediationRunner } from '../deployment/cycle-remediation-runner.js';
import { DeploymentRunner } from '../deployment/deployment-runner.js';
import {
  DeploymentContextService,
  type DeploymentContext,
  type DeploymentContextMessages,
} from '../deployment/deployment-context-service.js';
import { StateManager } from '../deployment/state-manager.js';
import { DeploymentTracker } from '../deployment/deployment-tracker.js';
import type { ScanResult } from '../services/metadata-scanner-service.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@jterrats/smart-deployment', 'start');
const logger = getLogger('StartCommand');
const cycleRemediationRunner = new CycleRemediationRunner();
const deploymentRunner = new DeploymentRunner();
const deploymentContextService = new DeploymentContextService();
const testPlanService = new TestPlanService();

/**
 * @ac US-046-AC-1: Analyzes metadata automatically
 * @ac US-046-AC-2: Generates deployment waves
 * @ac US-046-AC-3: Executes deployment sequentially
 */
type StartResult = {
  success: boolean;
  waves: number;
  ai?: {
    enabled: boolean;
    provider?: string;
    model?: string;
    aiAdjustments?: number;
    unknownTypes?: string[];
    fallback?: boolean;
    inferredDependencies?: number;
    inferenceFallback?: boolean;
  };
};

export default class Start extends SfCommand<StartResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  /**
   * @ac US-046-AC-4: Supports --target-org flag
   * @ac US-046-AC-5: Supports --dry-run flag
   * @ac US-046-AC-6: Supports --validate-only flag
   * @ac US-046-AC-7: Supports --skip-tests flag
   * @ac US-057-AC-1: Send component list to Agentforce
   */
  public static readonly flags: Interfaces.FlagInput = {
    'target-org': optionalOrgFlagWithDeprecations,
    'dry-run': Flags.boolean({
      summary: messages.getMessage('flags.dry-run.summary'),
      char: 'd',
      default: false,
    }),
    'validate-only': Flags.boolean({
      summary: messages.getMessage('flags.validate-only.summary'),
      char: 'v',
      default: false,
    }),
    'skip-tests': Flags.boolean({
      summary: messages.getMessage('flags.skip-tests.summary'),
      char: 's',
      default: false,
    }),
    'source-path': Flags.string({
      summary: messages.getMessage('flags.source-path.summary'),
      description: messages.getMessage('flags.source-path.description'),
    }),
    'allow-cycle-remediation': Flags.boolean({
      summary: messages.getMessage('flags.allow-cycle-remediation.summary'),
      description: messages.getMessage('flags.allow-cycle-remediation.description'),
      default: false,
    }),
    'use-ai': Flags.boolean({
      summary: messages.getMessage('flags.use-ai.summary'),
      description: messages.getMessage('flags.use-ai.description'),
      default: false,
    }),
    'org-type': Flags.string({
      summary: messages.getMessage('flags.org-type.summary'),
      description: messages.getMessage('flags.org-type.description'),
      options: ['Production', 'Sandbox', 'Developer'],
    }),
    industry: Flags.string({
      summary: messages.getMessage('flags.industry.summary'),
      description: messages.getMessage('flags.industry.description'),
    }),
  };

  /**
   * @ac US-046-AC-8: Shows progress bar
   * @ac US-046-AC-9: Generates deployment report
   * @ac US-046-AC-10: Handles failures gracefully
   */
  public async run(): Promise<StartResult> {
    const { flags } = await this.parse(Start);
    const sourcePath = typeof flags['source-path'] === 'string' ? flags['source-path'] : undefined;

    try {
      logger.info('Starting smart deployment', { flags });

      this.log('📊 Analyzing metadata...');
      const deploymentContext = await deploymentContextService.buildContext({
        sourcePath,
        useAI: Boolean(flags['use-ai']),
        orgType: typeof flags['org-type'] === 'string' ? flags['org-type'] : undefined,
        industry: typeof flags.industry === 'string' ? flags.industry : undefined,
      });
      this.reportScanDiagnostics(deploymentContext.scanResult);
      this.reportDeploymentContextMessages(deploymentContext.messages);
      const metadataCount = deploymentContext.scanResult.components.length;
      this.log(`✅ Found ${metadataCount} metadata components`);

      this.log('🌊 Generating deployment waves...');
      const waves = deploymentContext.orderedWaves.length;
      this.log(`✅ Generated ${waves} waves`);

      // AC US-057-AC-6: Report AI decisions
      if (flags['use-ai']) {
        this.log('🤖 AI-enhanced prioritization enabled');
      }

      // AC-3: Execute deployment
      if (!flags['dry-run']) {
        this.log('🚀 Executing deployment...');
        await this.executeDeployment(flags, deploymentContext, sourcePath);
      } else {
        this.log('🔍 Dry-run mode: skipping actual deployment');
      }

      // AC-9: Generate report
      this.log('📄 Generating deployment report...');
      this.generateReport(waves);

      return { success: true, waves, ai: deploymentContext.aiContext };
    } catch (error) {
      // AC-10: Handle failures gracefully
      logger.error('Deployment failed', { error });
      this.error(`Deployment failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async executeDeployment(
    flags: Record<string, unknown>,
    deploymentContext: DeploymentContext,
    sourcePath?: string
  ): Promise<void> {
    const dryRun = flags['dry-run'] as boolean;
    const validateOnly = flags['validate-only'] as boolean;
    const allowCycleRemediation = flags['allow-cycle-remediation'] as boolean;
    const skipTests = flags['skip-tests'] as boolean;
    const targetOrg = this.getTargetOrgIdentifier(flags['target-org']);

    if (dryRun || validateOnly) {
      this.log('🔍 Dry-run/Validate mode: skipping actual deployment');
      return;
    }

    const { scanResult, orderedWaves } = deploymentContext;
    const testExecutor = testPlanService.createExecutor(scanResult.components);

    const planner = new CycleRemediationPlanner(scanResult.dependencyResult.graph, {
      components: scanResult.dependencyResult.components,
    });
    const remediationPlan = planner.createPlan();

    if (remediationPlan.cycles.length > 0) {
      this.log(`♻️ Detected ${remediationPlan.cycles.length} circular dependency cycle(s).`);

      if (!allowCycleRemediation) {
        this.error(
          'Circular dependencies detected. Re-run with --allow-cycle-remediation for supported ApexClass cycles or resolve them manually.'
        );
      }

      if (!remediationPlan.supported) {
        this.error(
          [
            'Cycle remediation was requested, but one or more cycles are not safely supported.',
            ...remediationPlan.warnings,
          ].join('\n')
        );
      }
    }

    // Initialize deployment services
    const sfCli = new SfCliIntegration();
    const stateManager = new StateManager({ baseDir: sourcePath ?? process.cwd() });
    const tracker = new DeploymentTracker();
    const deploymentId = `deployment-${Date.now()}`;

    if (remediationPlan.cycles.length > 0) {
      if (!targetOrg) {
        this.error('The --target-org flag is required for cycle remediation deployments.');
      }

      await cycleRemediationRunner.execute({
        deploymentId,
        targetOrg,
        sourcePath,
        stateManager,
        tracker,
        plan: remediationPlan,
        sfCli,
        skipTests,
        componentMap: scanResult.dependencyResult.components,
        log: this.log.bind(this),
      });
      return;
    }

    if (!targetOrg) {
      this.error('The --target-org flag is required for real deployments.');
    }

    try {
      await deploymentRunner.execute({
        deploymentId,
        targetOrg,
        sourcePath,
        orderedWaves,
        componentMap: scanResult.dependencyResult.components,
        skipTests,
        testExecutor,
        tracker,
        stateManager,
        sfCli,
        aiContext: deploymentContext.aiContext,
        log: this.log.bind(this),
      });
    } catch (error) {
      logger.error('Wave deployment failed', { error });
      this.error(error instanceof Error ? error.message : String(error));
    }
  }

  private generateReport(waves: number): void {
    this.log('\n📊 Deployment Report:');
    this.log(`   - Waves: ${waves}`);
    this.log('   - Status: Success');
  }

  private reportScanDiagnostics(scanResult: ScanResult): void {
    if (scanResult.errors.length > 0) {
      logger.error('Metadata scanning completed with errors', { errors: scanResult.errors });
      scanResult.errors.forEach((err) => this.warn(err));
    }
    if (scanResult.warnings.length > 0) {
      logger.warn('Metadata scanning completed with warnings', { warnings: scanResult.warnings });
      scanResult.warnings.forEach((warn) => this.warn(warn));
    }
  }

  private reportDeploymentContextMessages(messagesToReport: DeploymentContextMessages): void {
    messagesToReport.warnings.forEach((warning) => this.warn(warning));
    messagesToReport.logs.forEach((entry) => this.log(entry));
  }

  private getTargetOrgIdentifier(value: unknown): string | undefined {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }

    if (typeof value === 'object' && value !== null && 'getUsername' in value) {
      const getUsername = (value as { getUsername: () => string }).getUsername;
      return typeof getUsername === 'function' ? getUsername.call(value) : undefined;
    }

    return undefined;
  }
}
