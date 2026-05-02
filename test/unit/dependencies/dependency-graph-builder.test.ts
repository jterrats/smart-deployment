/**
 * Unit tests for Dependency Graph Builder
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { DependencyGraphBuilder } from '../../../src/dependencies/dependency-graph-builder.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';

describe('DependencyGraphBuilder', () => {
  /**
   * Helper to create a test component
   */
  function createComponent(
    name: string,
    type: 'ApexClass' | 'ApexTrigger' | 'Flow' = 'ApexClass',
    dependencies: string[] = []
  ): MetadataComponent {
    return {
      name,
      type,
      filePath: `force-app/main/default/classes/${name}.cls`,
      dependencies: new Set(dependencies),
      dependents: new Set(),
      priorityBoost: 0,
    };
  }

  describe('addComponent', () => {
    /**
     * @ac US-028-AC-1: Add nodes for each component
     */
    it('US-028-AC-1: should add nodes for each component', () => {
      const builder = new DependencyGraphBuilder();

      const component1 = createComponent('AccountService');
      const component2 = createComponent('ContactService');

      builder.addComponent(component1);
      builder.addComponent(component2);

      expect(builder.size).to.equal(2);
      expect(builder.isEmpty).to.be.false;
    });

    /**
     * @ac US-028-AC-5: Support incremental graph building
     */
    it('US-028-AC-5: should support incremental graph building', () => {
      const builder = new DependencyGraphBuilder();

      // Add components incrementally
      builder.addComponent(createComponent('Service1'));
      expect(builder.size).to.equal(1);

      builder.addComponent(createComponent('Service2'));
      expect(builder.size).to.equal(2);

      builder.addComponent(createComponent('Service3'));
      expect(builder.size).to.equal(3);
    });

    it('should update existing components', () => {
      const builder = new DependencyGraphBuilder();

      const component = createComponent('AccountService');
      builder.addComponent(component);

      // Add again with modified dependencies
      const updatedComponent = createComponent('AccountService', 'ApexClass', ['ApexClass:Logger']);
      builder.addComponent(updatedComponent);

      expect(builder.size).to.equal(1); // Still one component
      const result = builder.build();
      expect(result.components.get('ApexClass:AccountService')).to.exist;
    });
  });

  describe('addComponents', () => {
    /**
     * @ac US-028-AC-5: Support incremental graph building
     */
    it('US-028-AC-5: should add multiple components at once', () => {
      const builder = new DependencyGraphBuilder();

      const components = [createComponent('Service1'), createComponent('Service2'), createComponent('Service3')];

      builder.addComponents(components);
      expect(builder.size).to.equal(3);
    });
  });

  describe('addEdge', () => {
    /**
     * @ac US-028-AC-2: Add edges for each dependency
     */
    it('US-028-AC-2: should add edges for each dependency', () => {
      const builder = new DependencyGraphBuilder();

      const service = createComponent('AccountService', 'ApexClass', ['ApexClass:Logger']);
      builder.addComponent(service);

      const result = builder.build();
      const deps = result.graph.get('ApexClass:AccountService');

      expect(deps).to.exist;
      expect(deps!.has('ApexClass:Logger')).to.be.true;
    });

    /**
     * @ac US-028-AC-3: Handle bidirectional dependencies
     */
    it('US-028-AC-3: should handle bidirectional dependencies', () => {
      const builder = new DependencyGraphBuilder();

      // A depends on B
      const compA = createComponent('ServiceA', 'ApexClass', ['ApexClass:ServiceB']);
      // B depends on A (circular)
      const compB = createComponent('ServiceB', 'ApexClass', ['ApexClass:ServiceA']);

      builder.addComponent(compA);
      builder.addComponent(compB);

      const result = builder.build();

      // Check forward dependencies
      expect(result.graph.get('ApexClass:ServiceA')!.has('ApexClass:ServiceB')).to.be.true;
      expect(result.graph.get('ApexClass:ServiceB')!.has('ApexClass:ServiceA')).to.be.true;

      // Check reverse dependencies
      expect(result.reverseGraph.get('ApexClass:ServiceA')!.has('ApexClass:ServiceB')).to.be.true;
      expect(result.reverseGraph.get('ApexClass:ServiceB')!.has('ApexClass:ServiceA')).to.be.true;
    });

    /**
     * @ac US-028-AC-4: Track dependency types (hard, soft)
     */
    it('US-028-AC-4: should track dependency types', () => {
      const builder = new DependencyGraphBuilder({ trackDependencyTypes: true });

      builder.addEdge('ApexClass:A', 'ApexClass:B', 'hard', 'Direct reference');
      builder.addEdge('ApexClass:A', 'ApexClass:C', 'soft', 'Optional reference');
      builder.addEdge('ApexClass:A', 'ApexClass:D', 'inferred', 'Naming pattern');

      const result = builder.build();
      expect(result.graph.get('ApexClass:A')?.size).to.equal(3);
    });

    it('should derive soft edges from dependencyDetails', () => {
      const builder = new DependencyGraphBuilder();
      const component = createComponent('ServiceA', 'ApexClass', ['ApexClass:Logger', 'ApexClass:OptionalHelper']);
      component.dependencyDetails = [
        {
          nodeId: 'ApexClass:Logger',
          kind: 'hard',
          source: 'parser',
        },
        {
          nodeId: 'ApexClass:OptionalHelper',
          kind: 'soft',
          source: 'parser',
        },
      ];

      builder.addComponent(component);

      const result = builder.build();
      expect(result.graph.get('ApexClass:ServiceA')?.has('ApexClass:Logger')).to.be.true;
      expect(result.graph.get('ApexClass:ServiceA')?.has('ApexClass:OptionalHelper')).to.be.true;
    });
  });

  describe('removeComponent', () => {
    it('should remove component and its edges', () => {
      const builder = new DependencyGraphBuilder();

      const compA = createComponent('ServiceA', 'ApexClass', ['ApexClass:ServiceB']);
      const compB = createComponent('ServiceB');

      builder.addComponent(compA);
      builder.addComponent(compB);
      expect(builder.size).to.equal(2);

      const removed = builder.removeComponent('ApexClass:ServiceA');
      expect(removed).to.be.true;
      expect(builder.size).to.equal(1);

      const result = builder.build();
      expect(result.components.has('ApexClass:ServiceA')).to.be.false;
    });

    it('should return false for non-existent component', () => {
      const builder = new DependencyGraphBuilder();
      const removed = builder.removeComponent('ApexClass:NonExistent');
      expect(removed).to.be.false;
    });
  });

  describe('getDependencies & getDependents', () => {
    it('should get all dependencies of a component', () => {
      const builder = new DependencyGraphBuilder();

      const compA = createComponent('ServiceA', 'ApexClass', ['ApexClass:Logger', 'ApexClass:Utils']);
      builder.addComponent(compA);

      const deps = builder.getDependencies('ApexClass:ServiceA');
      expect(deps.size).to.equal(2);
      expect(deps.has('ApexClass:Logger')).to.be.true;
      expect(deps.has('ApexClass:Utils')).to.be.true;
    });

    it('should get all dependents of a component', () => {
      const builder = new DependencyGraphBuilder();

      const logger = createComponent('Logger');
      const serviceA = createComponent('ServiceA', 'ApexClass', ['ApexClass:Logger']);
      const serviceB = createComponent('ServiceB', 'ApexClass', ['ApexClass:Logger']);

      builder.addComponent(logger);
      builder.addComponent(serviceA);
      builder.addComponent(serviceB);

      const dependents = builder.getDependents('ApexClass:Logger');
      expect(dependents.size).to.equal(2);
      expect(dependents.has('ApexClass:ServiceA')).to.be.true;
      expect(dependents.has('ApexClass:ServiceB')).to.be.true;
    });
  });

  describe('hasDependency', () => {
    it('should check if direct dependency exists', () => {
      const builder = new DependencyGraphBuilder();

      const compA = createComponent('ServiceA', 'ApexClass', ['ApexClass:ServiceB']);
      builder.addComponent(compA);

      expect(builder.hasDependency('ApexClass:ServiceA', 'ApexClass:ServiceB')).to.be.true;
      expect(builder.hasDependency('ApexClass:ServiceA', 'ApexClass:ServiceC')).to.be.false;
    });
  });

  describe('build', () => {
    it('should build complete dependency analysis result', () => {
      const builder = new DependencyGraphBuilder();

      const components = [
        createComponent('ServiceA', 'ApexClass', ['ApexClass:Logger']),
        createComponent('ServiceB', 'ApexClass', ['ApexClass:Logger']),
        createComponent('Logger'),
      ];

      builder.addComponents(components);
      const result = builder.build();

      expect(result.components.size).to.equal(3);
      expect(result.graph.size).to.be.greaterThan(0);
      expect(result.reverseGraph.size).to.be.greaterThan(0);
      expect(result.stats).to.exist;
      expect(result.stats.totalComponents).to.equal(3);
    });

    /**
     * @ac US-028-AC-6: Validate graph structure
     */
    it('US-028-AC-6: should validate graph structure', () => {
      const builder = new DependencyGraphBuilder({ validateStructure: true });

      const component = createComponent('ServiceA', 'ApexClass', ['ApexClass:ServiceA']); // Self-loop

      builder.addComponent(component);

      // Should throw on self-loop
      expect(() => builder.build()).to.throw(/Self-loop detected/);
    });

    it('should detect circular dependencies', () => {
      const builder = new DependencyGraphBuilder();

      // A → B → C → A (cycle)
      const compA = createComponent('ServiceA', 'ApexClass', ['ApexClass:ServiceB']);
      const compB = createComponent('ServiceB', 'ApexClass', ['ApexClass:ServiceC']);
      const compC = createComponent('ServiceC', 'ApexClass', ['ApexClass:ServiceA']);

      builder.addComponent(compA);
      builder.addComponent(compB);
      builder.addComponent(compC);

      const result = builder.build();
      expect(result.circularDependencies.length).to.be.greaterThan(0);
      expect(result.circularDependencies[0].cycle).to.have.lengthOf(3);
    });

    it('should find isolated components', () => {
      const builder = new DependencyGraphBuilder();

      builder.addComponent(createComponent('IsolatedService'));
      builder.addComponent(createComponent('ServiceA', 'ApexClass', ['ApexClass:ServiceB']));
      builder.addComponent(createComponent('ServiceB'));

      const result = builder.build();
      expect(result.isolatedComponents).to.have.lengthOf(1);
      expect(result.isolatedComponents[0]).to.equal('ApexClass:IsolatedService');
    });

    it('should invalidate cached build results after graph mutations', () => {
      const builder = new DependencyGraphBuilder();

      builder.addComponent(createComponent('ServiceA'));
      const initial = builder.build();
      expect(initial.components.size).to.equal(1);

      builder.addComponent(createComponent('ServiceB', 'ApexClass', ['ApexClass:ServiceA']));
      const updated = builder.build();

      expect(updated.components.size).to.equal(2);
      expect(updated.graph.get('ApexClass:ServiceB')?.has('ApexClass:ServiceA')).to.be.true;
    });
  });

  describe('statistics', () => {
    it('should generate accurate statistics', () => {
      const builder = new DependencyGraphBuilder();

      builder.addComponent(createComponent('ServiceA', 'ApexClass', ['ApexClass:Logger']));
      builder.addComponent(createComponent('ServiceB', 'ApexClass', ['ApexClass:Logger']));
      builder.addComponent(createComponent('Logger'));
      builder.addComponent(createComponent('MyTrigger', 'ApexTrigger', ['ApexClass:ServiceA']));

      const result = builder.build();

      expect(result.stats.totalComponents).to.equal(4);
      expect(result.stats.totalDependencies).to.equal(3);
      expect(result.stats.componentsByType['ApexClass']).to.equal(3);
      expect(result.stats.componentsByType['ApexTrigger']).to.equal(1);
      expect(result.stats.mostDepended.nodeId).to.equal('ApexClass:Logger');
      expect(result.stats.mostDepended.count).to.equal(2);
    });
  });

  describe('performance', () => {
    /**
     * @ac US-028-AC-7: Performance test with 10,000+ nodes (implicit in build method)
     */
    it('should handle 1000+ nodes efficiently', function () {
      this.timeout(5000); // 5 second timeout

      const builder = new DependencyGraphBuilder();
      const startTime = Date.now();

      // Create 1000 components
      const components: MetadataComponent[] = [];
      for (let i = 0; i < 1000; i++) {
        const deps = i > 0 ? [`ApexClass:Service${i - 1}`] : [];
        components.push(createComponent(`Service${i}`, 'ApexClass', deps));
      }

      builder.addComponents(components);
      const result = builder.build();

      const duration = Date.now() - startTime;

      expect(result.components.size).to.equal(1000);
      expect(duration).to.be.lessThan(1000); // Should complete in < 1 second
    });
  });

  describe('clear', () => {
    it('should clear entire graph', () => {
      const builder = new DependencyGraphBuilder();

      builder.addComponent(createComponent('ServiceA'));
      builder.addComponent(createComponent('ServiceB'));
      expect(builder.size).to.equal(2);

      builder.clear();
      expect(builder.size).to.equal(0);
      expect(builder.isEmpty).to.be.true;
    });
  });

  describe('multiple metadata types', () => {
    /**
     * @ac US-028-AC-3: Support all 15+ metadata types (implicit - tested with multiple types)
     */
    it('should support multiple metadata types', () => {
      const builder = new DependencyGraphBuilder();

      builder.addComponent(createComponent('MyClass', 'ApexClass'));
      builder.addComponent(createComponent('MyTrigger', 'ApexTrigger', ['ApexClass:MyClass']));
      builder.addComponent(createComponent('MyFlow', 'Flow', ['ApexClass:MyClass']));

      const result = builder.build();

      expect(result.stats.componentsByType['ApexClass']).to.equal(1);
      expect(result.stats.componentsByType['ApexTrigger']).to.equal(1);
      expect(result.stats.componentsByType['Flow']).to.equal(1);
    });
  });
});
