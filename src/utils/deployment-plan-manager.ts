/**
 * Deployment Plan Manager
 * Handles loading, saving, and validating deployment plans for CI/CD
 */

import { readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  DeploymentPlan,
  PlanValidationResult,
  PlanComparison,
  PriorityOverride,
} from '../types/deployment-plan.js';
import type { Wave } from '../waves/wave-builder.js';
import { getLogger } from './logger.js';

const logger = getLogger('DeploymentPlanManager');

export class DeploymentPlanManager {
  private static readonly DEFAULT_PLAN_PATH = '.smart-deployment/deployment-plan.json';
  private static readonly PLAN_VERSION = '1.0';

  /**
   * Save deployment plan to file
   */
  public static async savePlan(plan: DeploymentPlan, filePath?: string): Promise<void> {
    const path = resolve(filePath ?? this.DEFAULT_PLAN_PATH);

    logger.info('Saving deployment plan', { path });

    try {
      const json = JSON.stringify(plan, null, 2);
      await writeFile(path, json, 'utf-8');

      logger.info('Deployment plan saved successfully', {
        path,
        components: plan.metadata.totalComponents,
        waves: plan.metadata.totalWaves,
      });
    } catch (error) {
      logger.error('Failed to save deployment plan', { error, path });
      throw new Error(`Failed to save deployment plan: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load deployment plan from file
   */
  public static async loadPlan(filePath?: string): Promise<DeploymentPlan> {
    const path = resolve(filePath ?? this.DEFAULT_PLAN_PATH);

    logger.info('Loading deployment plan', { path });

    try {
      await access(path);
      const content = await readFile(path, 'utf-8');
      const plan = JSON.parse(content) as DeploymentPlan;

      logger.info('Deployment plan loaded successfully', {
        path,
        version: plan.metadata.version,
        components: plan.metadata.totalComponents,
        waves: plan.metadata.totalWaves,
      });

      return plan;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Deployment plan not found: ${path}\n💡 Run 'sf smart-deployment analyze --save-plan' first`);
      }
      throw new Error(`Failed to load deployment plan: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate plan exists and is readable
   */
  public static async planExists(filePath?: string): Promise<boolean> {
    const path = resolve(filePath ?? this.DEFAULT_PLAN_PATH);
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create deployment plan from waves and priorities
   */
  public static createPlan(
    waves: Wave[],
    priorityOverrides: Record<string, PriorityOverride>,
    options: {
      aiEnabled?: boolean;
      aiModel?: string;
      orgType?: string;
      industry?: string;
      generatedBy?: string;
    } = {}
  ): DeploymentPlan {
    const totalComponents = waves.reduce((sum, wave) => sum + wave.components.length, 0);
    const estimatedTime = waves.reduce((sum, wave) => sum + wave.metadata.estimatedTime, 0);

    // Group components by type
    const componentsByType: Record<string, string[]> = {};
    for (const wave of waves) {
      for (const component of wave.components) {
        const type = component.split(':')[0];
        if (!componentsByType[type]) {
          componentsByType[type] = [];
        }
        componentsByType[type].push(component);
      }
    }

    return {
      metadata: {
        version: this.PLAN_VERSION,
        generatedAt: new Date().toISOString(),
        generatedBy: options.generatedBy,
        aiEnabled: options.aiEnabled ?? false,
        aiModel: options.aiModel,
        orgType: options.orgType,
        industry: options.industry,
        totalComponents,
        totalWaves: waves.length,
        estimatedTime,
      },
      priorityOverrides,
      waves,
      componentsByType,
    };
  }

  /**
   * Compare current state with saved plan
   */
  public static comparePlans(plan: DeploymentPlan, currentWaves: Wave[]): PlanComparison {
    const planComponents = new Set(plan.waves.flatMap((w) => w.components));
    const currentComponents = new Set(currentWaves.flatMap((w) => w.components));

    const added = [...currentComponents].filter((c) => !planComponents.has(c));
    const removed = [...planComponents].filter((c) => !currentComponents.has(c));
    const unchanged = [...planComponents].filter((c) => currentComponents.has(c));

    // Calculate diff percentage
    const totalUnique = new Set([...planComponents, ...currentComponents]).size;
    const diffCount = added.length + removed.length;
    const diffPercentage = totalUnique > 0 ? (diffCount / totalUnique) * 100 : 0;

    // Priority differences
    const priorityChanges = 0;
    return {
      identical: added.length === 0 && removed.length === 0,
      diffPercentage,
      componentDiff: {
        added,
        removed,
        unchanged,
      },
      priorityDiff: {
        changed: priorityChanges,
        maxDiffPercentage: 0,
        avgDiffPercentage: 0,
      },
      waveDiff: {
        planWaves: plan.waves.length,
        currentWaves: currentWaves.length,
        difference: Math.abs(plan.waves.length - currentWaves.length),
      },
    };
  }

  /**
   * Validate plan against current state
   */
  public static validatePlan(plan: DeploymentPlan, currentWaves: Wave[]): PlanValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Version check
    if (plan.metadata.version !== this.PLAN_VERSION) {
      warnings.push(`Plan version mismatch: ${plan.metadata.version} (current: ${this.PLAN_VERSION})`);
    }

    // Age check (warn if older than 7 days)
    const planAge = Date.now() - new Date(plan.metadata.generatedAt).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (planAge > sevenDays) {
      warnings.push(`Plan is ${Math.floor(planAge / (24 * 60 * 60 * 1000))} days old. Consider regenerating.`);
    }

    // Compare with current state
    const comparison = this.comparePlans(plan, currentWaves);

    if (!comparison.identical) {
      if (comparison.componentDiff.added.length > 0) {
        warnings.push(`${comparison.componentDiff.added.length} new components not in plan`);
      }
      if (comparison.componentDiff.removed.length > 0) {
        warnings.push(`${comparison.componentDiff.removed.length} components removed since plan`);
      }
    }

    if (comparison.diffPercentage > 20) {
      errors.push(`Component diff too high: ${comparison.diffPercentage.toFixed(1)}% (max: 20%)`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      diff: comparison.identical
        ? undefined
        : {
            addedComponents: comparison.componentDiff.added,
            removedComponents: comparison.componentDiff.removed,
            priorityChanges: [],
          },
    };
  }

  /**
   * Calculate file checksum (for future use in plan verification)
   */
  // private static _calculateChecksum(content: string): string {
  //   return createHash('sha256').update(content).digest('hex');
  // }
}
