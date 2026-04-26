import { createResumedState, summarizeDeploymentState } from './deployment-state-summary.js';
import { StateManager } from './state-manager.js';

export type ResumeRetryStrategy = 'standard' | 'quick' | 'validate-only';

export type ResumePreparation = {
  deploymentId: string;
  currentWave: number;
  totalWaves: number;
  remainingWaves: number;
  failureReason?: string;
};

export class ResumeDeploymentService {
  public constructor(private readonly stateManager: StateManager = new StateManager()) {}

  public async prepareResume(retryStrategy: ResumeRetryStrategy): Promise<ResumePreparation> {
    const state = await this.stateManager.loadState();

    if (!state?.failedWave) {
      throw new Error('No failed deployment state found to resume');
    }

    const summary = summarizeDeploymentState(state);
    const resumedState = createResumedState(state, retryStrategy);

    await this.stateManager.saveState(resumedState);

    return {
      deploymentId: summary.deploymentId,
      currentWave: summary.currentWave,
      totalWaves: summary.totalWaves,
      remainingWaves: summary.remainingWaves,
      failureReason: summary.failureReason,
    };
  }
}
