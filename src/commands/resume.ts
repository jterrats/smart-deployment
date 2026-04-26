/**
 * smart-deployment:resume command - US-049
 *
 * @ac US-049-AC-1: Detects previous failed deployment
 * @ac US-049-AC-2: Loads deployment state
 * @ac US-049-AC-3: Resumes from failed wave
 * @ac US-049-AC-4: Supports retry strategies
 * @ac US-049-AC-5: Updates deployment report
 * @ac US-049-AC-6: Handles multiple failures
 * @issue #49
 */

import { type Interfaces } from '@oclif/core';
import { Messages } from '@salesforce/core';
import { Flags, SfCommand, optionalOrgFlagWithDeprecations } from '@salesforce/sf-plugins-core';
import { ResumeDeploymentService, type ResumeRetryStrategy } from '../deployment/resume-deployment-service.js';
import { ResumeCommandPresenter } from '../presentation/resume-command-presenter.js';
import { getLogger } from '../utils/logger.js';
import { StateManager } from '../deployment/state-manager.js';

const logger = getLogger('ResumeCommand');
Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@jterrats/smart-deployment', 'resume');
const presenter = new ResumeCommandPresenter();

type ResumeResult = {
  success: boolean;
  resumedFromWave: number;
  remainingWaves: number;
  deploymentId: string;
};

export default class Resume extends SfCommand<ResumeResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly examples = messages.getMessages('examples');
  public static readonly flags: Interfaces.FlagInput = {
    'target-org': optionalOrgFlagWithDeprecations,
    'source-path': Flags.directory({
      summary: messages.getMessage('flags.source-path.summary'),
      exists: true,
    }),
    'retry-strategy': Flags.string({
      summary: messages.getMessage('flags.retry-strategy.summary'),
      options: ['standard', 'quick', 'validate-only'],
      default: 'standard',
    }),
  };

  public async run(): Promise<ResumeResult> {
    const { flags } = await this.parse(Resume);
    const sourcePath = typeof flags['source-path'] === 'string' ? flags['source-path'] : undefined;

    try {
      logger.info('Resuming deployment', { flags });

      const retryStrategy = flags['retry-strategy'] as ResumeRetryStrategy;
      const resumeService = new ResumeDeploymentService(new StateManager({ baseDir: sourcePath }));
      const summary = await resumeService.prepareResume(retryStrategy);
      presenter.reportResumePreparation(this, summary, retryStrategy);

      return {
        success: true,
        resumedFromWave: summary.currentWave,
        remainingWaves: summary.remainingWaves,
        deploymentId: summary.deploymentId,
      };
    } catch (error) {
      logger.error('Resume failed', { error });
      this.error(`Resume failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
