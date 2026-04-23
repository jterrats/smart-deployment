/**
 * smart-deployment:resume command - US-049
 * @ac US-049-AC-1: Detects previous failed deployment
 * @ac US-049-AC-2: Loads deployment state
 * @ac US-049-AC-3: Resumes from failed wave
 * @ac US-049-AC-4: Supports retry strategies
 * @ac US-049-AC-5: Updates deployment report
 * @ac US-049-AC-6: Handles multiple failures
 * @issue #49
 */

import { Flags } from '@oclif/core';
import { SfCommand, optionalOrgFlagWithDeprecations } from '@salesforce/sf-plugins-core';
import { getLogger } from '../utils/logger.js';
import { StateManager } from '../deployment/state-manager.js';
import { createResumedState, summarizeDeploymentState } from '../deployment/deployment-state-summary.js';

const logger = getLogger('ResumeCommand');

interface ResumeResult {
  success: boolean;
  resumedFromWave: number;
  remainingWaves: number;
  deploymentId: string;
}

export default class Resume extends SfCommand<ResumeResult> {
  public static readonly summary = 'Resume failed deployment';
  public static readonly flags = {
    'target-org': optionalOrgFlagWithDeprecations,
    'source-path': Flags.directory({
      summary: 'Path to the Salesforce project containing deployment state',
      exists: true,
    }),
    'retry-strategy': Flags.string({
      summary: 'Retry strategy to use when resuming the deployment',
      options: ['standard', 'quick', 'validate-only'],
      default: 'standard',
    }),
  };

  public async run(): Promise<ResumeResult> {
    const { flags } = await this.parse(Resume);

    try {
      logger.info('Resuming deployment', { flags });

      const stateManager = new StateManager({ baseDir: flags['source-path'] });
      const state = await stateManager.loadState();

      if (!state?.failedWave) {
        this.error('No failed deployment state found to resume');
      }

      const summary = summarizeDeploymentState(state);
      const retryStrategy = flags['retry-strategy'] as 'standard' | 'quick' | 'validate-only';
      const resumedState = createResumedState(state, retryStrategy);

      await stateManager.saveState(resumedState);

      this.log(`🔄 Resume prepared for deployment ${summary.deploymentId}`);
      this.log(`Retry strategy: ${retryStrategy}`);
      this.log(`Resuming from wave ${summary.currentWave}/${summary.totalWaves}`);
      this.log(`Remaining waves: ${summary.remainingWaves}`);
      if (summary.failureReason) {
        this.log(`Previous failure: ${summary.failureReason}`);
      }

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
