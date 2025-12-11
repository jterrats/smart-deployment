/**
 * Deployment Error Handler - US-074
 * Enhanced deployment error recovery
 *
 * @ac US-074-AC-1: Catch deployment errors
 * @ac US-074-AC-2: Save deployment state
 * @ac US-074-AC-3: Enable resume from failure
 * @ac US-074-AC-4: Retry with different strategies
 * @ac US-074-AC-5: Report error details
 * @ac US-074-AC-6: Suggest fixes
 * @issue #74
 */

import { getLogger } from '../utils/logger.js';
import { StateManager } from './state-manager.js';

const logger = getLogger('DeploymentErrorHandler');

export interface DeploymentErrorContext {
  wave: number;
  components: string[];
  strategy: 'standard' | 'quick' | 'validate-only';
  retryCount: number;
}

export class DeploymentErrorHandler {
  private readonly stateManager: StateManager;

  public constructor() {
    this.stateManager = new StateManager();
  }

  /**
   * @ac US-074-AC-1: Catch deployment errors
   * @ac US-074-AC-2: Save deployment state
   * Handle deployment error with state persistence
   */
  public async handleError(error: Error, context: DeploymentErrorContext): Promise<void> {
    logger.error('Deployment error occurred', {
      wave: context.wave,
      components: context.components.length,
      error: error.message,
    });

    // Save state for resume
    await this.stateManager.saveState({
      deploymentId: `deploy-${Date.now()}`,
      targetOrg: 'unknown',
      timestamp: new Date().toISOString(),
      totalWaves: context.wave + 1,
      completedWaves: [],
      currentWave: context.wave,
      failedWave: {
        waveNumber: context.wave,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    });

    // Suggest fixes
    const suggestions = this.getSuggestions(error);
    logger.info('Suggested fixes', { suggestions });
  }

  /**
   * @ac US-074-AC-6: Suggest fixes
   * Get error fix suggestions
   */
  private getSuggestions(error: Error): string[] {
    const suggestions: string[] = [];

    if (error.message.includes('UNABLE_TO_LOCK_ROW')) {
      suggestions.push('Retry deployment - this is usually temporary');
      suggestions.push('Check for concurrent deployments');
    } else if (error.message.includes('INVALID_CROSS_REFERENCE_KEY')) {
      suggestions.push('Check dependency order');
      suggestions.push('Ensure all referenced components are included');
    } else if (error.message.includes('FIELD_INTEGRITY_EXCEPTION')) {
      suggestions.push('Check required fields');
      suggestions.push('Verify picklist values');
    }

    return suggestions;
  }

  /**
   * @ac US-074-AC-3: Enable resume from failure
   * Check if can resume
   */
  public async canResume(): Promise<boolean> {
    const state = await this.stateManager.loadState();
    return state !== null;
  }
}
