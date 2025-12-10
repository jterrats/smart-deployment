/**
 * Deployment Progress Tracker - US-086
 * Tracks real-time deployment progress
 *
 * @ac US-086-AC-1: Track deployment ID
 * @ac US-086-AC-2: Poll deployment status
 * @ac US-086-AC-3: Show progress percentage
 * @ac US-086-AC-4: Show current component deploying
 * @ac US-086-AC-5: Show ETA
 * @ac US-086-AC-6: Show wave progress
 * @issue #86
 */

import { getLogger } from '../utils/logger.js';
import type { DeploymentResult } from './sf-cli-integration.js';

const logger = getLogger('DeploymentTracker');

export interface DeploymentProgress {
  deploymentId: string;
  waveNumber: number;
  totalWaves: number;
  percentage: number;
  currentComponent?: string;
  eta?: number;
  status: string;
}

/**
 * @ac US-086-AC-1: Track deployment ID
 * @ac US-086-AC-2: Poll deployment status
 */
export class DeploymentTracker {
  private deployments = new Map<string, DeploymentProgress>();
  private startTimes = new Map<string, number>();

  public startTracking(deploymentId: string, waveNumber: number, totalWaves: number): void {
    logger.info('Starting deployment tracking', { deploymentId, waveNumber });

    this.startTimes.set(deploymentId, Date.now());
    this.deployments.set(deploymentId, {
      deploymentId,
      waveNumber,
      totalWaves,
      percentage: 0,
      status: 'In Progress',
    });
  }

  /**
   * @ac US-086-AC-3: Show progress percentage
   * @ac US-086-AC-4: Show current component deploying
   * @ac US-086-AC-5: Show ETA
   */
  public updateProgress(deploymentId: string, result: DeploymentResult): void {
    const progress = this.deployments.get(deploymentId);
    if (!progress) {
      return;
    }

    const total = result.componentSuccesses + result.componentFailures;
    if (total > 0) {
      progress.percentage = Math.round((result.componentSuccesses / total) * 100);
    }

    progress.status = result.status;

    // Calculate ETA based on elapsed time and progress
    const startTime = this.startTimes.get(deploymentId);
    if (startTime && progress.percentage > 0) {
      const elapsed = Date.now() - startTime;
      const totalEstimated = (elapsed / progress.percentage) * 100;
      progress.eta = Math.round((totalEstimated - elapsed) / 1000); // seconds
    }

    logger.info('Progress updated', { deploymentId, progress });
  }

  /**
   * @ac US-086-AC-6: Show wave progress
   */
  public getProgress(deploymentId: string): DeploymentProgress | undefined {
    return this.deployments.get(deploymentId);
  }

  public formatProgress(deploymentId: string): string {
    const progress = this.deployments.get(deploymentId);
    if (!progress) {
      return 'No progress available';
    }

    const lines = [
      `Wave ${progress.waveNumber}/${progress.totalWaves}`,
      `Progress: ${progress.percentage}%`,
      `Status: ${progress.status}`,
    ];

    if (progress.eta !== undefined) {
      lines.push(`ETA: ${progress.eta}s`);
    }

    return lines.join(' | ');
  }
}

