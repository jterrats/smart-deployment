/**
 * Deployment State Persistence - US-089
 * Saves deployment state for resume capability
 *
 * @ac US-089-AC-1: Save state after each wave
 * @ac US-089-AC-2: Include completed waves
 * @ac US-089-AC-3: Include failed wave details
 * @ac US-089-AC-4: Support resume from failure
 * @ac US-089-AC-5: Clean up state on success
 * @ac US-089-AC-6: Include deployment metadata
 * @issue #89
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { CycleSourceEditRecord } from './cycle-source-editor.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('StateManager');

export interface CycleRemediationState {
  cycleId: string;
  strategy: 'comment-reference' | 'manual';
  activePhase: 1 | 2;
  startedAt: string;
  completedPhases: Array<1 | 2>;
  editRecords: CycleSourceEditRecord[];
}

export interface DeploymentState {
  deploymentId: string;
  targetOrg: string;
  timestamp: string;
  totalWaves: number;
  completedWaves: number[];
  currentWave?: number;
  failedWave?: {
    waveNumber: number;
    error: string;
    timestamp: string;
  };
  cycleRemediation?: CycleRemediationState;
  metadata?: Record<string, unknown>;
}

export interface StateManagerOptions {
  baseDir?: string;
}

/**
 * @ac US-089-AC-1: Save state after each wave
 * @ac US-089-AC-2: Include completed waves
 * @ac US-089-AC-3: Include failed wave details
 */
export class StateManager {
  private readonly stateDir: string;
  private readonly stateFile: string;

  public constructor(options: StateManagerOptions = {}) {
    const baseDir = options.baseDir ?? process.cwd();
    this.stateDir = path.join(baseDir, '.smart-deployment');
    this.stateFile = path.join(this.stateDir, 'deployment-state.json');
  }

  public async saveState(state: DeploymentState): Promise<void> {
    logger.info('Saving deployment state', { state });

    await fs.mkdir(this.stateDir, { recursive: true });
    await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2), 'utf-8');
  }

  /**
   * @ac US-089-AC-4: Support resume from failure
   */
  public async loadState(): Promise<DeploymentState | null> {
    try {
      const content = await fs.readFile(this.stateFile, 'utf-8');
      const state = JSON.parse(content) as DeploymentState;
      logger.info('Loaded deployment state', { state });
      return this.normalizeState(state);
    } catch {
      logger.info('No previous deployment state found');
      return null;
    }
  }

  /**
   * @ac US-089-AC-5: Clean up state on success
   */
  public async clearState(): Promise<void> {
    try {
      await fs.unlink(this.stateFile);
      logger.info('Cleared deployment state');
    } catch {
      // File doesn't exist, nothing to clear
    }
  }

  public async hasFailedDeployment(): Promise<boolean> {
    const state = await this.loadState();
    return state?.failedWave !== undefined;
  }

  public getStateFilePath(): string {
    return this.stateFile;
  }

  private normalizeState(state: DeploymentState): DeploymentState {
    if (state.cycleRemediation === undefined) {
      return state;
    }

    return {
      ...state,
      cycleRemediation: {
        ...state.cycleRemediation,
        completedPhases: [...state.cycleRemediation.completedPhases],
        editRecords: [...state.cycleRemediation.editRecords],
      },
    };
  }
}
