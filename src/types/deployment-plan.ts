/**
 * Deployment Plan Types
 * Pre-approved deployment plans for CI/CD pipelines
 */

import type { Wave } from '../waves/wave-builder.js';
import type { MetadataType } from './metadata.js';

/**
 * Priority override from AI or manual configuration
 */
export type PriorityOverride = {
  priority: number;
  source: 'ai' | 'manual' | 'static';
  confidence?: number;
  reason?: string;
  appliedAt?: string;
};

/**
 * Deployment plan metadata
 */
export type DeploymentPlanMetadata = {
  version: string;
  generatedAt: string;
  generatedBy?: string;
  aiEnabled: boolean;
  aiModel?: string;
  orgType?: string;
  industry?: string;
  totalComponents: number;
  totalWaves: number;
  estimatedTime: number;
};

/**
 * Deployment plan - serializable, version-controlled
 */
export type DeploymentPlan = {
  metadata: DeploymentPlanMetadata;
  priorityOverrides: Record<string, PriorityOverride>;
  waves: Wave[];
  componentsByType: Record<MetadataType, string[]>;
  checksums?: Record<string, string>; // File checksums for validation
};

/**
 * Plan validation result
 */
export type PlanValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  diff?: {
    addedComponents: string[];
    removedComponents: string[];
    priorityChanges: Array<{
      component: string;
      planPriority: number;
      currentPriority: number;
      diffPercentage: number;
    }>;
  };
};

/**
 * Plan comparison result
 */
export type PlanComparison = {
  identical: boolean;
  diffPercentage: number;
  componentDiff: {
    added: string[];
    removed: string[];
    unchanged: string[];
  };
  priorityDiff: {
    changed: number;
    maxDiffPercentage: number;
    avgDiffPercentage: number;
  };
  waveDiff: {
    planWaves: number;
    currentWaves: number;
    difference: number;
  };
};
