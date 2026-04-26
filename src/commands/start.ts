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
import { StartExecutionService } from '../deployment/start-execution-service.js';
import { DeploymentContextService } from '../deployment/deployment-context-service.js';
import { ProjectAnalysisPresenter } from '../presentation/project-analysis-presenter.js';
import { StartCommandPresenter } from '../presentation/start-command-presenter.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@jterrats/smart-deployment', 'start');
const logger = getLogger('StartCommand');
const deploymentContextService = new DeploymentContextService();
const startExecutionService = new StartExecutionService();
const projectAnalysisPresenter = new ProjectAnalysisPresenter();
const presenter = new StartCommandPresenter();

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
      projectAnalysisPresenter.reportDiagnostics(this, deploymentContext.scanResult, deploymentContext.messages);
      const metadataCount = deploymentContext.scanResult.components.length;
      const waves = deploymentContext.orderedWaves.length;
      presenter.reportAnalysisSummary(this, {
        metadataCount,
        waves,
        aiEnabled: Boolean(flags['use-ai']),
      });

      const executionOptions = {
        dryRun: flags['dry-run'] === true,
        validateOnly: flags['validate-only'] === true,
        allowCycleRemediation: flags['allow-cycle-remediation'] === true,
        skipTests: flags['skip-tests'] === true,
        targetOrg: this.getTargetOrgIdentifier(flags['target-org']),
        sourcePath,
        deploymentContext,
        log: this.log.bind(this),
      } as const;

      if (!executionOptions.dryRun && !executionOptions.validateOnly) {
        presenter.reportExecutionStart(this);
      }
      const executionResult = await startExecutionService.execute(executionOptions);
      if (executionResult.kind === 'skipped') {
        presenter.reportExecutionSkipped(this, executionResult.reason);
      }

      presenter.reportReportGenerationStart(this);
      presenter.reportDeploymentReport(this, waves);

      return { success: true, waves, ai: deploymentContext.aiContext };
    } catch (error) {
      // AC-10: Handle failures gracefully
      logger.error('Deployment failed', { error });
      this.error(`Deployment failed: ${error instanceof Error ? error.message : String(error)}`);
    }
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
