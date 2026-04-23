/**
 * smart-deployment:status command - US-050
 *
 * @ac US-050-AC-1: Shows current wave number
 * @ac US-050-AC-2: Shows completed waves
 * @ac US-050-AC-3: Shows remaining waves
 * @ac US-050-AC-4: Shows estimated time remaining
 * @ac US-050-AC-5: Shows test execution status
 * @ac US-050-AC-6: Refreshes automatically
 * @issue #50
 */

import { type Interfaces } from '@oclif/core';
import { Messages } from '@salesforce/core';
import { Flags, SfCommand, optionalOrgFlagWithDeprecations } from '@salesforce/sf-plugins-core';
import { getLogger } from '../utils/logger.js';
import { StateManager } from '../deployment/state-manager.js';
import { formatDeploymentStatus, summarizeDeploymentState } from '../deployment/deployment-state-summary.js';

const logger = getLogger('StatusCommand');
Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('smart-deployment', 'status');

type StatusResult = {
  currentWave: number;
  totalWaves: number;
  completedWaves: number[];
  remainingWaves: number;
  status: string;
  canResume: boolean;
  ai?: {
    provider?: string;
    model?: string;
    fallback?: boolean;
    aiAdjustments?: number;
    unknownTypes?: string[];
    inferenceFallback?: boolean;
    inferredDependencies?: number;
  };
};

export default class Status extends SfCommand<StatusResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly examples = messages.getMessages('examples');
  public static readonly flags: Interfaces.FlagInput = {
    'target-org': optionalOrgFlagWithDeprecations,
    'source-path': Flags.directory({
      summary: messages.getMessage('flags.source-path.summary'),
      exists: true,
    }),
  };

  public async run(): Promise<StatusResult> {
    const { flags } = await this.parse(Status);
    const sourcePath = typeof flags['source-path'] === 'string' ? flags['source-path'] : undefined;

    try {
      logger.info('Getting status', { flags });

      const stateManager = new StateManager({ baseDir: sourcePath });
      const state = await stateManager.loadState();

      if (!state) {
        this.log('ℹ️ No deployment state found.');
        return {
          currentWave: 0,
          totalWaves: 0,
          completedWaves: [],
          remainingWaves: 0,
          status: 'Not Started',
          canResume: false,
        };
      }

      const summary = summarizeDeploymentState(state);
      formatDeploymentStatus(summary).forEach((line) => this.log(line));

      const result: StatusResult = {
        currentWave: summary.currentWave,
        totalWaves: summary.totalWaves,
        completedWaves: summary.completedWaves,
        remainingWaves: summary.remainingWaves,
        status: summary.status,
        canResume: summary.canResume,
      };

      if (summary.ai !== undefined) {
        result.ai = summary.ai;
      }

      return result;
    } catch (error) {
      logger.error('Status failed', { error });
      this.error(`Status failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
