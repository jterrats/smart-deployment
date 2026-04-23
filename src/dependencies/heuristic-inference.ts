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

  /**
   * @ac US-029-AC-6: Confidence scoring
   *
   * Calculate confidence score for an inferred dependency
   */
  public static calculateConfidence(
    pattern: string,
    existingDeps: number,
    nameSimilarity: number
  ): { confidence: ConfidenceLevel; score: number } {
    let score = 50; // Base score

    // Pattern-based boost
    const patternScores: Record<string, number> = {
      'test-suffix': 45,
      'test-prefix': 45,
      'trigger-handler': 40,
      'handler-service': 35,
      'controller-service': 35,
      'batch-service': 25,
      'queueable-service': 25,
      'selector-service': 20,
      'integration-service': 15,
    };

    score += patternScores[pattern] ?? 0;

    // Name similarity boost (0-10 points)
    score += Math.floor(nameSimilarity * 10);

    // Existing dependencies penalty (if already has many deps, less confident)
    score -= Math.min(existingDeps * 2, 10);

    // Clamp to 0-100
    score = Math.max(0, Math.min(100, score));

    // Determine confidence level
    let confidence: ConfidenceLevel;
    if (score >= 80) {
      confidence = 'high';
    } else if (score >= 65) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return { confidence, score };
  }

  /**
   * @ac US-029-AC-1: Test class → Production class inference
   *
   * Infers that test classes depend on the production classes they test.
   * Patterns:
   * - AccountServiceTest → AccountService
   * - Test_AccountService → AccountService
   * - AccountService_Test → AccountService
   */
  private static inferTestClassDependencies(
    component: MetadataComponent,
    components: Map<NodeId, MetadataComponent>
  ): InferredDependency[] {
    if (component.type !== 'ApexClass') {
      return [];
    }

    const inferred: InferredDependency[] = [];
    const className = component.name;

    // Pattern 1: ClassNameTest → ClassName
    if (className.endsWith('Test')) {
      const productionClassName = className.slice(0, -4);
      const prodNodeId = `ApexClass:${productionClassName}`;

      if (components.has(prodNodeId)) {
        inferred.push({
          from: `ApexClass:${className}`,
          to: prodNodeId,
          reason: 'Test class typically tests production class',
          confidence: 'high',
          pattern: 'test-suffix',
          score: 95,
        });
      }
    }

    // Pattern 2: Test_ClassName → ClassName
    if (className.startsWith('Test_')) {
      const productionClassName = className.slice(5);
      const prodNodeId = `ApexClass:${productionClassName}`;

      if (components.has(prodNodeId)) {
        inferred.push({
          from: `ApexClass:${className}`,
          to: prodNodeId,
          reason: 'Test class typically tests production class',
          confidence: 'high',
          pattern: 'test-prefix',
          score: 95,
        });
      }
    }

    // Pattern 3: ClassName_Test → ClassName
    if (className.endsWith('_Test')) {
      const productionClassName = className.slice(0, -5);
      const prodNodeId = `ApexClass:${productionClassName}`;

      if (components.has(prodNodeId)) {
        inferred.push({
          from: `ApexClass:${className}`,
          to: prodNodeId,
          reason: 'Test class typically tests production class',
          confidence: 'high',
          pattern: 'test-suffix-underscore',
          score: 95,
        });
      }
    }

    return inferred;
  }

  /**
   * @ac US-029-AC-2: Handler → Service pattern detection
   *
   * Infers that handler classes depend on service classes.
   * Patterns:
   * - AccountHandler → AccountService
   * - Account_Handler → Account_Service
   */
  private static inferHandlerServicePattern(
    component: MetadataComponent,
    components: Map<NodeId, MetadataComponent>
  ): InferredDependency[] {
    if (component.type !== 'ApexClass') {
      return [];
    }

    const inferred: InferredDependency[] = [];
    const className = component.name;

    // Pattern: AccountHandler → AccountService
    if (className.endsWith('Handler')) {
      const baseName = className.slice(0, -7); // Remove 'Handler'
      const serviceNames = [`${baseName}Service`, `${baseName}_Service`, `${baseName}Svc`];

      for (const serviceName of serviceNames) {
        const serviceNodeId = `ApexClass:${serviceName}`;
        if (components.has(serviceNodeId)) {
          inferred.push({
            from: `ApexClass:${className}`,
            to: serviceNodeId,
            reason: 'Handler typically calls service layer',
            confidence: 'high',
            pattern: 'handler-service',
            score: 85,
          });
        }
      }
    }

    // Pattern: Account_Handler → Account_Service
    if (className.includes('Handler')) {
      const baseName = className.replace(/Handler$/, '').replace(/_Handler$/, '');
      const serviceNames = [`${baseName}Service`, `${baseName}_Service`];

      for (const serviceName of serviceNames) {
        const serviceNodeId = `ApexClass:${serviceName}`;
        if (components.has(serviceNodeId) && !inferred.some((i) => i.to === serviceNodeId)) {
          inferred.push({
            from: `ApexClass:${className}`,
            to: serviceNodeId,
            reason: 'Handler typically calls service layer',
            confidence: 'medium',
            pattern: 'handler-service-variant',
            score: 75,
          });
        }
      }
    }

    return inferred;
  }

  /**
   * @ac US-029-AC-3: Trigger → Handler pattern detection
   *
   * Infers that triggers depend on handler classes.
   * Patterns:
   * - AccountTrigger → AccountTriggerHandler
   * - AccountTrigger → AccountHandler
   */
  private static inferTriggerHandlerPattern(
    component: MetadataComponent,
    components: Map<NodeId, MetadataComponent>
  ): InferredDependency[] {
    if (component.type !== 'ApexTrigger') {
      return [];
    }

    const inferred: InferredDependency[] = [];
    const triggerName = component.name;

    // Pattern 1: AccountTrigger → AccountTriggerHandler
    const handlerNames = [
      `${triggerName}Handler`,
      triggerName.replace(/Trigger$/, 'TriggerHandler'),
      triggerName.replace(/Trigger$/, 'Handler'),
    ];

    for (const handlerName of handlerNames) {
      const handlerNodeId = `ApexClass:${handlerName}`;
      if (components.has(handlerNodeId)) {
        inferred.push({
          from: `ApexTrigger:${triggerName}`,
          to: handlerNodeId,
          reason: 'Trigger typically delegates to handler class',
          confidence: 'high',
          pattern: 'trigger-handler',
          score: 90,
        });
        break; // Only add one handler per trigger
      }
    }

    return inferred;
  }

  /**
   * @ac US-029-AC-4: Controller → Service pattern detection
   *
   * Infers that controller classes depend on service classes.
   * Patterns:
   * - AccountController → AccountService
   * - LWC_AccountController → AccountService
   */
  private static inferControllerServicePattern(
    component: MetadataComponent,
    components: Map<NodeId, MetadataComponent>
  ): InferredDependency[] {
    if (component.type !== 'ApexClass') {
      return [];
    }

    const inferred: InferredDependency[] = [];
    const className = component.name;

    // Pattern: AccountController → AccountService
    if (className.endsWith('Controller') || className.includes('Controller')) {
      const baseName = className
        .replace(/Controller$/, '')
        .replace(/_Controller$/, '')
        .replace(/^LWC_/, '')
        .replace(/^VF_/, '');

      const serviceNames = [`${baseName}Service`, `${baseName}_Service`, `${baseName}Svc`];

      for (const serviceName of serviceNames) {
        const serviceNodeId = `ApexClass:${serviceName}`;
        if (components.has(serviceNodeId)) {
          inferred.push({
            from: `ApexClass:${className}`,
            to: serviceNodeId,
            reason: 'Controller typically calls service layer',
            confidence: 'high',
            pattern: 'controller-service',
            score: 85,
          });
        }
      }
    }

    return inferred;
  }

  /**
   * @ac US-029-AC-5: Naming convention analysis
   *
   * Infers dependencies based on common naming conventions.
   * Patterns:
   * - *Selector → *Service
   * - *Batch → *Service
   * - *Queueable → *Service
   * - *Integration → *Service
   */
  private static inferFromNamingConventions(
    component: MetadataComponent,
    components: Map<NodeId, MetadataComponent>
  ): InferredDependency[] {
    if (component.type !== 'ApexClass') {
      return [];
    }

    const inferred: InferredDependency[] = [];
    const className = component.name;

    // Selector → Service pattern
    if (className.endsWith('Selector')) {
      const baseName = className.slice(0, -8);
      const serviceNodeId = `ApexClass:${baseName}Service`;

      if (components.has(serviceNodeId)) {
        inferred.push({
          from: `ApexClass:${className}`,
          to: serviceNodeId,
          reason: 'Selector may be used by service layer',
          confidence: 'medium',
          pattern: 'selector-service',
          score: 70,
        });
      }
    }

    // Batch → Service pattern
    if (className.endsWith('Batch')) {
      const baseName = className.slice(0, -5);
      const serviceNames = [`${baseName}Service`, `${baseName}`];

      for (const serviceName of serviceNames) {
        const serviceNodeId = `ApexClass:${serviceName}`;
        if (components.has(serviceNodeId)) {
          inferred.push({
            from: `ApexClass:${className}`,
            to: serviceNodeId,
            reason: 'Batch class typically uses service layer',
            confidence: 'medium',
            pattern: 'batch-service',
            score: 75,
          });
          break;
        }
      }
    }

    // Queueable → Service pattern
    if (className.endsWith('Queueable') || className.includes('Queueable')) {
      const baseName = className.replace(/Queueable$/, '').replace(/_Queueable/, '');
      const serviceNodeId = `ApexClass:${baseName}Service`;

      if (components.has(serviceNodeId)) {
        inferred.push({
          from: `ApexClass:${className}`,
          to: serviceNodeId,
          reason: 'Queueable typically uses service layer',
          confidence: 'medium',
          pattern: 'queueable-service',
          score: 75,
        });
      }
    }

    // Integration → Service pattern
    if (className.includes('Integration')) {
      const baseName = className
        .replace(/Integration$/, '')
        .replace(/_Integration/, '')
        .replace(/^Integration/, '');

      if (baseName) {
        const serviceNodeId = `ApexClass:${baseName}Service`;
        if (components.has(serviceNodeId)) {
          inferred.push({
            from: `ApexClass:${className}`,
            to: serviceNodeId,
            reason: 'Integration class may use service layer',
            confidence: 'low',
            pattern: 'integration-service',
            score: 65,
          });
        }
      }
    }

    return inferred;
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
        test: (component, components) => HeuristicInference.inferTestClassDependencies(component, components),
      },
      {
        name: 'handler-service-pattern',
        enabled: this.options.enableHandlerPattern,
        test: (component, components) => HeuristicInference.inferHandlerServicePattern(component, components),
      },
      {
        name: 'trigger-handler-pattern',
        enabled: this.options.enableTriggerPattern,
        test: (component, components) => HeuristicInference.inferTriggerHandlerPattern(component, components),
      },
      {
        name: 'controller-service-pattern',
        enabled: this.options.enableControllerPattern,
        test: (component, components) => HeuristicInference.inferControllerServicePattern(component, components),
      },
      {
        name: 'naming-conventions',
        enabled: this.options.enableNamingConventions,
        test: (component, components) => HeuristicInference.inferFromNamingConventions(component, components),
      },
    ];
  }
}
