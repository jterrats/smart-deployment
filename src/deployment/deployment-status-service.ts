import { getLogger } from '../utils/logger.js';
import { summarizeDeploymentState } from './deployment-state-summary.js';
import { StateManager } from './state-manager.js';

const logger = getLogger('DeploymentStatusService');

export type DeploymentStatusSummary = {
  hasState: boolean;
  status: 'not-started' | 'in-progress' | 'failed' | 'completed';
  deploymentId?: string;
  targetOrg?: string;
  currentWave: number;
  totalWaves: number;
  completedWaves: number[];
  remainingWaves: number[];
  failedWaveNumber?: number;
  failedWaveError?: string;
  resumable: boolean;
  testStatus: 'unknown' | 'pending' | 'not-run';
  testStatusText: string;
  timestamp?: string;
  stateFilePath: string;
};

export type ResumeSummary = {
  success: boolean;
  reason?: string;
  resumeWave?: number;
  completedWaves: number[];
  remainingWaves: number[];
  targetOrg?: string;
  deploymentId?: string;
};

export class DeploymentStatusService {
  public constructor(private readonly stateManager: StateManager = new StateManager()) {}

  public async getStatus(): Promise<DeploymentStatusSummary> {
    const state = await this.stateManager.loadState();

    if (!state) {
      return {
        hasState: false,
        status: 'not-started',
        currentWave: 0,
        totalWaves: 0,
        completedWaves: [],
        remainingWaves: [],
        resumable: false,
        testStatus: 'unknown',
        testStatusText: 'Not started',
        stateFilePath: this.stateManager.getStateFilePath(),
      };
    }

    const summary = summarizeDeploymentState(state);
    logger.info('Deployment status loaded', {
      deploymentId: summary.deploymentId,
      status: summary.status,
      currentWave: summary.currentWave,
      totalWaves: summary.totalWaves,
    });

    return {
      hasState: true,
      status: this.normalizeStatus(summary.status),
      deploymentId: summary.deploymentId,
      targetOrg: summary.targetOrg,
      currentWave: summary.currentWave,
      totalWaves: summary.totalWaves,
      completedWaves: summary.completedWaves,
      remainingWaves: this.expandRemainingWaves(summary.currentWave, summary.remainingWaves, summary.totalWaves),
      failedWaveNumber: summary.failedWaveNumber,
      failedWaveError: summary.failureReason,
      resumable: summary.canResume,
      testStatus: this.normalizeTestStatus(summary.testStatus),
      testStatusText: summary.testStatus,
      timestamp: summary.lastUpdated,
      stateFilePath: this.stateManager.getStateFilePath(),
    };
  }

  public async getResumeSummary(): Promise<ResumeSummary> {
    const summary = await this.getStatus();

    if (!summary.hasState) {
      return {
        success: false,
        reason: 'No previous deployment state found.',
        completedWaves: [],
        remainingWaves: [],
      };
    }

    if (!summary.resumable || summary.failedWaveNumber === undefined) {
      return {
        success: false,
        reason: 'No failed deployment was found to resume.',
        completedWaves: summary.completedWaves,
        remainingWaves: summary.remainingWaves,
        targetOrg: summary.targetOrg,
        deploymentId: summary.deploymentId,
      };
    }

    return {
      success: true,
      resumeWave: summary.failedWaveNumber,
      completedWaves: summary.completedWaves,
      remainingWaves: summary.remainingWaves,
      targetOrg: summary.targetOrg,
      deploymentId: summary.deploymentId,
    };
  }

  public formatStatus(summary: DeploymentStatusSummary): string {
    if (!summary.hasState) {
      return ['No deployment state found.', `Expected state file: ${summary.stateFilePath}`].join('\n');
    }

    const lines = [
      `Status: ${summary.status}`,
      `Deployment ID: ${summary.deploymentId ?? 'unknown'}`,
      `Target Org: ${summary.targetOrg ?? 'unknown'}`,
      `Current Wave: ${summary.currentWave}/${summary.totalWaves}`,
      `Completed Waves: ${summary.completedWaves.length > 0 ? summary.completedWaves.join(', ') : 'none'}`,
      `Remaining Waves: ${summary.remainingWaves.length > 0 ? summary.remainingWaves.join(', ') : 'none'}`,
      `Estimated Time Remaining: ${summary.timestamp !== undefined ? this.estimateTimeRemaining(summary) : 'unknown'}`,
      `Test Status: ${summary.testStatusText}`,
      `Updated: ${summary.timestamp ?? 'unknown'}`,
    ];

    if (summary.failedWaveNumber !== undefined) {
      lines.push(`Failed Wave: ${summary.failedWaveNumber}`);
    }

    if (summary.failedWaveError) {
      lines.push(`Failure: ${summary.failedWaveError}`);
    }

    return lines.join('\n');
  }

  private expandRemainingWaves(currentWave: number, remainingCount: number, totalWaves: number): number[] {
    return Array.from({ length: remainingCount }, (_, index) => currentWave + index).filter(
      (wave) => wave <= totalWaves
    );
  }

  private normalizeStatus(
    status: 'Not Started' | 'In Progress' | 'Failed' | 'Completed'
  ): DeploymentStatusSummary['status'] {
    switch (status) {
      case 'Not Started':
        return 'not-started';
      case 'In Progress':
        return 'in-progress';
      case 'Failed':
        return 'failed';
      default:
        return 'completed';
    }
  }

  private normalizeTestStatus(testStatus: string): DeploymentStatusSummary['testStatus'] {
    if (testStatus === 'Not started') {
      return 'unknown';
    }

    if (testStatus.toLowerCase().includes('no') && testStatus.toLowerCase().includes('test')) {
      return 'not-run';
    }

    if (testStatus.toLowerCase().includes('pending') || testStatus.toLowerCase().includes('tests run')) {
      return 'pending';
    }

    return 'pending';
  }

  private estimateTimeRemaining(summary: DeploymentStatusSummary): string {
    const remainingCount = summary.remainingWaves.length;
    if (remainingCount === 0) {
      return '0s';
    }

    if (summary.failedWaveNumber !== undefined) {
      return `${remainingCount * 60}s`;
    }

    return `${remainingCount * 60}s`;
  }
}
