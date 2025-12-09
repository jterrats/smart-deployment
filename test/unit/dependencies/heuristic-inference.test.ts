/**
 * Unit tests for Heuristic Dependency Inference
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { HeuristicInference } from '../../../src/dependencies/heuristic-inference.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';
import type { NodeId } from '../../../src/types/dependency.js';

describe('HeuristicInference', () => {
  /**
   * Helper to create a test component
   */
  function createComponent(
    name: string,
    type: 'ApexClass' | 'ApexTrigger' | 'Flow' = 'ApexClass'
  ): MetadataComponent {
    return {
      name,
      type,
      filePath: `force-app/main/default/classes/${name}.cls`,
      dependencies: new Set(),
      dependents: new Set(),
      priorityBoost: 0,
    };
  }

  /**
   * Helper to create a component map
   */
  function createComponentMap(components: MetadataComponent[]): Map<NodeId, MetadataComponent> {
    const map = new Map<NodeId, MetadataComponent>();
    for (const component of components) {
      const nodeId = `${component.type}:${component.name}`;
      map.set(nodeId, component);
    }
    return map;
  }

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const inferencer = new HeuristicInference();
      expect(inferencer).to.exist;
    });

    it('should initialize with custom options', () => {
      const inferencer = new HeuristicInference({
        minConfidence: 80,
        enableTestInference: false,
      });
      expect(inferencer).to.exist;
    });
  });

  describe('Test Class Inference', () => {
    /**
     * @ac US-029-AC-1: Test class → Production class inference
     */
    it('US-029-AC-1: should infer AccountServiceTest → AccountService', () => {
      const components = createComponentMap([
        createComponent('AccountService'),
        createComponent('AccountServiceTest'),
      ]);

      const inferencer = new HeuristicInference();
      const inferred = inferencer.inferDependencies(components);

      expect(inferred).to.have.lengthOf(1);
      expect(inferred[0].from).to.equal('ApexClass:AccountServiceTest');
      expect(inferred[0].to).to.equal('ApexClass:AccountService');
      expect(inferred[0].confidence).to.equal('high');
      expect(inferred[0].pattern).to.equal('test-suffix');
    });

    it('US-029-AC-1: should infer Test_AccountService → AccountService', () => {
      const components = createComponentMap([
        createComponent('AccountService'),
        createComponent('Test_AccountService'),
      ]);

      const inferencer = new HeuristicInference();
      const inferred = inferencer.inferDependencies(components);

      expect(inferred).to.have.lengthOf(1);
      expect(inferred[0].from).to.equal('ApexClass:Test_AccountService');
      expect(inferred[0].to).to.equal('ApexClass:AccountService');
      expect(inferred[0].confidence).to.equal('high');
      expect(inferred[0].pattern).to.equal('test-prefix');
    });

    it('US-029-AC-1: should infer AccountService_Test → AccountService', () => {
      const components = createComponentMap([
        createComponent('AccountService'),
        createComponent('AccountService_Test'),
      ]);

      const inferencer = new HeuristicInference();
      const inferred = inferencer.inferDependencies(components);

      expect(inferred).to.have.lengthOf(1);
      expect(inferred[0].from).to.equal('ApexClass:AccountService_Test');
      expect(inferred[0].to).to.equal('ApexClass:AccountService');
      expect(inferred[0].confidence).to.equal('high');
      expect(inferred[0].pattern).to.equal('test-suffix-underscore');
    });

    it('should not infer if production class does not exist', () => {
      const components = createComponentMap([
        createComponent('AccountServiceTest'),
      ]);

      const inferencer = new HeuristicInference();
      const inferred = inferencer.inferDependencies(components);

      expect(inferred).to.have.lengthOf(0);
    });
  });

  describe('Handler → Service Pattern', () => {
    /**
     * @ac US-029-AC-2: Handler → Service pattern detection
     */
    it('US-029-AC-2: should infer AccountHandler → AccountService', () => {
      const components = createComponentMap([
        createComponent('AccountHandler'),
        createComponent('AccountService'),
      ]);

      const inferencer = new HeuristicInference();
      const inferred = inferencer.inferDependencies(components);

      expect(inferred).to.have.lengthOf(1);
      expect(inferred[0].from).to.equal('ApexClass:AccountHandler');
      expect(inferred[0].to).to.equal('ApexClass:AccountService');
      expect(inferred[0].confidence).to.equal('high');
      expect(inferred[0].pattern).to.equal('handler-service');
    });

    it('US-029-AC-2: should infer Account_Handler → Account_Service', () => {
      const components = createComponentMap([
        createComponent('Account_Handler'),
        createComponent('Account_Service'),
      ]);

      const inferencer = new HeuristicInference();
      const inferred = inferencer.inferDependencies(components);

      expect(inferred).to.have.lengthOf(1);
      expect(inferred[0].from).to.equal('ApexClass:Account_Handler');
      expect(inferred[0].to).to.equal('ApexClass:Account_Service');
    });

    it('should prefer exact service name match', () => {
      const components = createComponentMap([
        createComponent('AccountHandler'),
        createComponent('AccountService'),
        createComponent('AccountSvc'),
      ]);

      const inferencer = new HeuristicInference();
      const inferred = inferencer.inferDependencies(components);

      // Should find AccountService first (exact match)
      expect(inferred[0].to).to.equal('ApexClass:AccountService');
    });
  });

  describe('Trigger → Handler Pattern', () => {
    /**
     * @ac US-029-AC-3: Trigger → Handler pattern detection
     */
    it('US-029-AC-3: should infer AccountTrigger → AccountTriggerHandler', () => {
      const components = createComponentMap([
        createComponent('AccountTrigger', 'ApexTrigger'),
        createComponent('AccountTriggerHandler'),
      ]);

      const inferencer = new HeuristicInference();
      const inferred = inferencer.inferDependencies(components);

      expect(inferred).to.have.lengthOf(1);
      expect(inferred[0].from).to.equal('ApexTrigger:AccountTrigger');
      expect(inferred[0].to).to.equal('ApexClass:AccountTriggerHandler');
      expect(inferred[0].confidence).to.equal('high');
      expect(inferred[0].pattern).to.equal('trigger-handler');
    });

    it('US-029-AC-3: should infer AccountTrigger → AccountHandler', () => {
      const components = createComponentMap([
        createComponent('AccountTrigger', 'ApexTrigger'),
        createComponent('AccountHandler'),
      ]);

      const inferencer = new HeuristicInference();
      const inferred = inferencer.inferDependencies(components);

      expect(inferred).to.have.lengthOf(1);
      expect(inferred[0].from).to.equal('ApexTrigger:AccountTrigger');
      expect(inferred[0].to).to.equal('ApexClass:AccountHandler');
    });

    it('should prefer TriggerHandler suffix over Handler', () => {
      const components = createComponentMap([
        createComponent('AccountTrigger', 'ApexTrigger'),
        createComponent('AccountTriggerHandler'),
        createComponent('AccountHandler'),
      ]);

      const inferencer = new HeuristicInference();
      const inferred = inferencer.inferDependencies(components);

      // Should prefer AccountTriggerHandler
      expect(inferred).to.have.lengthOf(1);
      expect(inferred[0].to).to.equal('ApexClass:AccountTriggerHandler');
    });
  });

  describe('Controller → Service Pattern', () => {
    /**
     * @ac US-029-AC-4: Controller → Service pattern detection
     */
    it('US-029-AC-4: should infer AccountController → AccountService', () => {
      const components = createComponentMap([
        createComponent('AccountController'),
        createComponent('AccountService'),
      ]);

      const inferencer = new HeuristicInference();
      const inferred = inferencer.inferDependencies(components);

      expect(inferred).to.have.lengthOf(1);
      expect(inferred[0].from).to.equal('ApexClass:AccountController');
      expect(inferred[0].to).to.equal('ApexClass:AccountService');
      expect(inferred[0].confidence).to.equal('high');
      expect(inferred[0].pattern).to.equal('controller-service');
    });

    it('US-029-AC-4: should infer LWC_AccountController → AccountService', () => {
      const components = createComponentMap([
        createComponent('LWC_AccountController'),
        createComponent('AccountService'),
      ]);

      const inferencer = new HeuristicInference();
      const inferred = inferencer.inferDependencies(components);

      expect(inferred).to.have.lengthOf(1);
      expect(inferred[0].from).to.equal('ApexClass:LWC_AccountController');
      expect(inferred[0].to).to.equal('ApexClass:AccountService');
    });

    it('US-029-AC-4: should infer VF_AccountController → AccountService', () => {
      const components = createComponentMap([
        createComponent('VF_AccountController'),
        createComponent('AccountService'),
      ]);

      const inferencer = new HeuristicInference();
      const inferred = inferencer.inferDependencies(components);

      expect(inferred).to.have.lengthOf(1);
      expect(inferred[0].from).to.equal('ApexClass:VF_AccountController');
      expect(inferred[0].to).to.equal('ApexClass:AccountService');
    });
  });

  describe('Naming Convention Analysis', () => {
    /**
     * @ac US-029-AC-5: Naming convention analysis
     */
    it('US-029-AC-5: should infer AccountSelector → AccountService', () => {
      const components = createComponentMap([
        createComponent('AccountSelector'),
        createComponent('AccountService'),
      ]);

      const inferencer = new HeuristicInference();
      const inferred = inferencer.inferDependencies(components);

      expect(inferred).to.have.lengthOf(1);
      expect(inferred[0].from).to.equal('ApexClass:AccountSelector');
      expect(inferred[0].to).to.equal('ApexClass:AccountService');
      expect(inferred[0].confidence).to.equal('medium');
      expect(inferred[0].pattern).to.equal('selector-service');
    });

    it('US-029-AC-5: should infer AccountBatch → AccountService', () => {
      const components = createComponentMap([
        createComponent('AccountBatch'),
        createComponent('AccountService'),
      ]);

      const inferencer = new HeuristicInference();
      const inferred = inferencer.inferDependencies(components);

      expect(inferred).to.have.lengthOf(1);
      expect(inferred[0].from).to.equal('ApexClass:AccountBatch');
      expect(inferred[0].to).to.equal('ApexClass:AccountService');
      expect(inferred[0].confidence).to.equal('medium');
      expect(inferred[0].pattern).to.equal('batch-service');
    });

    it('US-029-AC-5: should infer AccountQueueable → AccountService', () => {
      const components = createComponentMap([
        createComponent('AccountQueueable'),
        createComponent('AccountService'),
      ]);

      const inferencer = new HeuristicInference();
      const inferred = inferencer.inferDependencies(components);

      expect(inferred).to.have.lengthOf(1);
      expect(inferred[0].from).to.equal('ApexClass:AccountQueueable');
      expect(inferred[0].to).to.equal('ApexClass:AccountService');
      expect(inferred[0].confidence).to.equal('medium');
      expect(inferred[0].pattern).to.equal('queueable-service');
    });

    it('US-029-AC-5: should infer AccountIntegration → AccountService', () => {
      const components = createComponentMap([
        createComponent('AccountIntegration'),
        createComponent('AccountService'),
      ]);

      const inferencer = new HeuristicInference();
      const inferred = inferencer.inferDependencies(components);

      expect(inferred).to.have.lengthOf(1);
      expect(inferred[0].from).to.equal('ApexClass:AccountIntegration');
      expect(inferred[0].to).to.equal('ApexClass:AccountService');
      expect(inferred[0].confidence).to.equal('low');
      expect(inferred[0].pattern).to.equal('integration-service');
    });
  });

  describe('Confidence Scoring', () => {
    /**
     * @ac US-029-AC-6: Confidence scoring for inferences
     */
    it('US-029-AC-6: should calculate high confidence for test patterns', () => {
      const result = HeuristicInference.calculateConfidence('test-suffix', 0, 1.0);
      expect(result.confidence).to.equal('high');
      expect(result.score).to.be.greaterThan(80);
    });

    it('US-029-AC-6: should calculate medium confidence for handler patterns', () => {
      const result = HeuristicInference.calculateConfidence('handler-service', 2, 0.8);
      expect(result.confidence).to.be.oneOf(['high', 'medium']);
      expect(result.score).to.be.greaterThan(65);
    });

    it('US-029-AC-6: should calculate low confidence for integration patterns', () => {
      const result = HeuristicInference.calculateConfidence('integration-service', 5, 0.5);
      expect(result.confidence).to.be.oneOf(['medium', 'low']);
      expect(result.score).to.be.lessThan(80);
    });

    it('US-029-AC-6: should penalize many existing dependencies', () => {
      const withFewDeps = HeuristicInference.calculateConfidence('handler-service', 1, 0.8);
      const withManyDeps = HeuristicInference.calculateConfidence('handler-service', 10, 0.8);

      expect(withFewDeps.score).to.be.greaterThan(withManyDeps.score);
    });

    it('US-029-AC-6: should boost score with name similarity', () => {
      const lowSimilarity = HeuristicInference.calculateConfidence('handler-service', 0, 0.3);
      const highSimilarity = HeuristicInference.calculateConfidence('handler-service', 0, 0.9);

      expect(highSimilarity.score).to.be.greaterThan(lowSimilarity.score);
    });
  });

  describe('Confidence Filtering', () => {
    it('should filter by minimum confidence threshold', () => {
      const components = createComponentMap([
        createComponent('AccountIntegration'),
        createComponent('AccountService'),
        createComponent('ContactServiceTest'),
        createComponent('ContactService'),
      ]);

      const inferencer = new HeuristicInference({ minConfidence: 80 });
      const inferred = inferencer.inferDependencies(components);

      // Only high-confidence test inference should pass
      expect(inferred).to.have.lengthOf(1);
      expect(inferred[0].pattern).to.equal('test-suffix');
    });

    it('should allow all when minConfidence is low', () => {
      const components = createComponentMap([
        createComponent('AccountIntegration'),
        createComponent('AccountService'),
        createComponent('ContactServiceTest'),
        createComponent('ContactService'),
      ]);

      const inferencer = new HeuristicInference({ minConfidence: 0 });
      const inferred = inferencer.inferDependencies(components);

      expect(inferred.length).to.be.greaterThan(1);
    });
  });

  describe('Pattern Enable/Disable', () => {
    it('should respect enableTestInference option', () => {
      const components = createComponentMap([
        createComponent('AccountServiceTest'),
        createComponent('AccountService'),
      ]);

      const inferencer = new HeuristicInference({ enableTestInference: false });
      const inferred = inferencer.inferDependencies(components);

      expect(inferred).to.have.lengthOf(0);
    });

    it('should respect enableHandlerPattern option', () => {
      const components = createComponentMap([
        createComponent('AccountHandler'),
        createComponent('AccountService'),
      ]);

      const inferencer = new HeuristicInference({ enableHandlerPattern: false });
      const inferred = inferencer.inferDependencies(components);

      expect(inferred).to.have.lengthOf(0);
    });

    it('should respect enableTriggerPattern option', () => {
      const components = createComponentMap([
        createComponent('AccountTrigger', 'ApexTrigger'),
        createComponent('AccountTriggerHandler'),
      ]);

      const inferencer = new HeuristicInference({ enableTriggerPattern: false });
      const inferred = inferencer.inferDependencies(components);

      expect(inferred).to.have.lengthOf(0);
    });
  });

  describe('inferForComponent', () => {
    it('should infer dependencies for a single component', () => {
      const components = createComponentMap([
        createComponent('AccountServiceTest'),
        createComponent('AccountService'),
      ]);

      const testComponent = components.get('ApexClass:AccountServiceTest')!;

      const inferencer = new HeuristicInference();
      const inferred = inferencer.inferForComponent(testComponent, components);

      expect(inferred).to.have.lengthOf(1);
      expect(inferred[0].to).to.equal('ApexClass:AccountService');
    });
  });

  describe('Complex Scenarios', () => {
    it('should infer multiple dependencies for a single component', () => {
      const components = createComponentMap([
        createComponent('AccountHandler'),
        createComponent('AccountService'),
        createComponent('Account_Service'),
      ]);

      const inferencer = new HeuristicInference({ minConfidence: 0 });
      const inferred = inferencer.inferDependencies(components);

      // May find multiple matches (AccountService and Account_Service)
      expect(inferred.length).to.be.greaterThanOrEqual(1);
    });

    it('should handle large component sets efficiently', function () {
      this.timeout(5000);

      // Create 100 components with various patterns
      const componentArray: MetadataComponent[] = [];
      for (let i = 0; i < 50; i++) {
        componentArray.push(createComponent(`Service${i}`));
        componentArray.push(createComponent(`Service${i}Test`));
      }

      const components = createComponentMap(componentArray);

      const startTime = Date.now();
      const inferencer = new HeuristicInference();
      const inferred = inferencer.inferDependencies(components);
      const duration = Date.now() - startTime;

      expect(inferred.length).to.be.greaterThan(0);
      expect(duration).to.be.lessThan(1000); // Should complete in < 1 second
    });

    it('should not duplicate inferences', () => {
      const components = createComponentMap([
        createComponent('AccountHandler'),
        createComponent('AccountService'),
      ]);

      const inferencer = new HeuristicInference();
      const inferred = inferencer.inferDependencies(components);

      // Check for duplicates
      const uniqueKeys = new Set(inferred.map((i) => `${i.from}->${i.to}`));
      expect(uniqueKeys.size).to.equal(inferred.length);
    });
  });
});

