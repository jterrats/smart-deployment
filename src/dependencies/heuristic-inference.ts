/**
 * Heuristic Dependency Inference
 * Infers non-obvious dependencies using intelligent heuristics
 *
 * @ac US-029-AC-1: Test class → Production class inference
 * @ac US-029-AC-2: Handler → Service pattern detection
 * @ac US-029-AC-3: Trigger → Handler pattern detection
 * @ac US-029-AC-4: Controller → Service pattern detection
 * @ac US-029-AC-5: Naming convention analysis
 * @ac US-029-AC-6: Confidence scoring for inferences
 *
 * @issue #29
 */

import { getLogger } from '../utils/logger.js';
import type { MetadataComponent } from '../types/metadata.js';
import type { NodeId } from '../types/dependency.js';
import {
  calculateConfidence,
  inferControllerServicePattern,
  inferFromNamingConventions,
  inferHandlerServicePattern,
  inferTestClassDependencies,
  inferTriggerHandlerPattern,
} from './heuristic-patterns.js';

const logger = getLogger('HeuristicInference');

/**
 * Confidence level for inferred dependencies
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Inferred dependency with confidence score
 */
export type InferredDependency = {
  from: NodeId;
  to: NodeId;
  reason: string;
  confidence: ConfidenceLevel;
  pattern: string;
  score: number; // 0-100
};

/**
 * Heuristic pattern configuration
 */
type HeuristicPattern = {
  name: string;
  test: (component: MetadataComponent, components: Map<NodeId, MetadataComponent>) => InferredDependency[];
  enabled: boolean;
};

/**
 * Options for heuristic inference
 */
export type HeuristicInferenceOptions = {
  /** Minimum confidence score (0-100) */
  minConfidence?: number;
  /** Enable test class inference */
  enableTestInference?: boolean;
  /** Enable handler pattern detection */
  enableHandlerPattern?: boolean;
  /** Enable trigger pattern detection */
  enableTriggerPattern?: boolean;
  /** Enable controller pattern detection */
  enableControllerPattern?: boolean;
  /** Enable naming convention analysis */
  enableNamingConventions?: boolean;
};

/**
 * Heuristic Dependency Inference
 *
 * Uses intelligent heuristics to infer dependencies that are not explicit in code:
 * - Test classes typically depend on the production class they test
 * - Handlers typically call service classes
 * - Triggers typically call handler classes
 * - Controllers typically call service classes
 * - Naming conventions reveal architectural patterns
 *
 * @example
 * const inferencer = new HeuristicInference();
 * const inferred = inferencer.inferDependencies(components);
 * console.log(`Found ${inferred.length} inferred dependencies`);
 */
export class HeuristicInference {
  private options: Required<HeuristicInferenceOptions>;
  private patterns: HeuristicPattern[];

  public constructor(options: HeuristicInferenceOptions = {}) {
    this.options = {
      minConfidence: options.minConfidence ?? 60,
      enableTestInference: options.enableTestInference ?? true,
      enableHandlerPattern: options.enableHandlerPattern ?? true,
      enableTriggerPattern: options.enableTriggerPattern ?? true,
      enableControllerPattern: options.enableControllerPattern ?? true,
      enableNamingConventions: options.enableNamingConventions ?? true,
    };

    this.patterns = this.initializePatterns();

    logger.debug('Initialized HeuristicInference', {
      options: this.options,
      patterns: this.patterns.filter((p) => p.enabled).map((p) => p.name),
    });
  }

  public static calculateConfidence(
    pattern: string,
    existingDeps: number,
    nameSimilarity: number
  ): { confidence: ConfidenceLevel; score: number } {
    return calculateConfidence(pattern, existingDeps, nameSimilarity);
  }

  /**
   * Infer dependencies for all components
   */
  public inferDependencies(components: Map<NodeId, MetadataComponent>): InferredDependency[] {
    const startTime = Date.now();
    const allInferred: InferredDependency[] = [];

    for (const component of components.values()) {
      const inferred = this.inferForComponent(component, components);
      allInferred.push(...inferred);
    }

    // Filter by confidence threshold
    const filtered = allInferred.filter((dep) => dep.score >= this.options.minConfidence);

    const duration = Date.now() - startTime;
    logger.info('Inferred dependencies completed', {
      total: allInferred.length,
      filtered: filtered.length,
      minConfidence: this.options.minConfidence,
      durationMs: duration,
    });

    return filtered;
  }

  /**
   * Infer dependencies for a single component
   */
  public inferForComponent(
    component: MetadataComponent,
    allComponents: Map<NodeId, MetadataComponent>
  ): InferredDependency[] {
    const inferred: InferredDependency[] = [];

    for (const pattern of this.patterns) {
      if (pattern.enabled) {
        const results = pattern.test(component, allComponents);
        inferred.push(...results);
      }
    }

    return inferred;
  }

  /**
   * Initialize heuristic patterns
   */
  private initializePatterns(): HeuristicPattern[] {
    return [
      {
        name: 'test-class-inference',
        enabled: this.options.enableTestInference,
        test: inferTestClassDependencies,
      },
      {
        name: 'handler-service-pattern',
        enabled: this.options.enableHandlerPattern,
        test: inferHandlerServicePattern,
      },
      {
        name: 'trigger-handler-pattern',
        enabled: this.options.enableTriggerPattern,
        test: inferTriggerHandlerPattern,
      },
      {
        name: 'controller-service-pattern',
        enabled: this.options.enableControllerPattern,
        test: inferControllerServicePattern,
      },
      {
        name: 'naming-conventions',
        enabled: this.options.enableNamingConventions,
        test: inferFromNamingConventions,
      },
    ];
  }
}

export { calculateConfidence };
