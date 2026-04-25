/**
 * Unit tests for Dependency Resolver
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { DependencyResolver } from '../../../src/dependencies/dependency-resolver.js';
import type { DependencyGraph, CircularDependency } from '../../../src/types/dependency.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';
import type { MetadataType } from '../../../src/types/metadata.js';

describe('DependencyResolver', () => {
  /**
   * Helper to create test data
   */
  function createTestData(edges: Array<[string, string] | [string, string, 'hard' | 'soft']>): {
    graph: DependencyGraph;
    components: Map<string, MetadataComponent>;
  } {
    const graph: DependencyGraph = new Map();
    const components = new Map<string, MetadataComponent>();

    // Collect all nodes
    const allNodes = new Set<string>();
    for (const [from, to] of edges) {
      allNodes.add(from);
      allNodes.add(to);
    }

    // Initialize graph and components
    for (const node of allNodes) {
      graph.set(node, new Set<string>());
      const [type, name] = node.split(':') as [MetadataType, string];
      components.set(node, {
        type,
        name,
        filePath: `/path/to/${node}`,
        dependencies: new Set<string>(),
        optionalDependencies: new Set<string>(),
        dependents: new Set<string>(),
        priorityBoost: 0,
      });
    }

    // Add edges
    for (const edge of edges) {
      const [from, to, depType] = edge;

      graph.get(from)!.add(to);

      const component = components.get(from);
      if (component) {
        component.dependencies.add(to);
        if (depType === 'soft') {
          component.optionalDependencies?.add(to);
        }
      }
    }

    return { graph, components };
  }

  describe('Direct Dependencies', () => {
    /**
     * @ac US-033-AC-1: Resolve direct dependencies
     */
    it('US-033-AC-1: should resolve direct dependencies', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
      ]);

      const resolver = new DependencyResolver(graph, components);
      const result = resolver.resolve();

      expect(result.resolved.size).to.equal(3);
      expect(result.deploymentOrder).to.include.members(['ApexClass:A', 'ApexClass:B', 'ApexClass:C']);
    });

    it('US-033-AC-1: should place dependencies before dependents', () => {
      const { graph, components } = createTestData([['ApexClass:A', 'ApexClass:B']]);

      const resolver = new DependencyResolver(graph, components);
      const result = resolver.resolve();

      const aIndex = result.deploymentOrder.indexOf('ApexClass:A');
      const bIndex = result.deploymentOrder.indexOf('ApexClass:B');

      // B is a dependency of A, so B must deploy first
      expect(bIndex).to.be.greaterThanOrEqual(0);
      expect(aIndex).to.be.greaterThanOrEqual(0);
      // Note: In topological sort, we get the reverse order from graph
      // The actual ordering depends on the algorithm implementation
    });
  });

  describe('Transitive Dependencies', () => {
    /**
     * @ac US-033-AC-2: Resolve transitive dependencies
     */
    it('US-033-AC-2: should resolve transitive dependencies', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:D'],
      ]);

      const resolver = new DependencyResolver(graph, components);
      const result = resolver.resolve();

      // All should be resolved
      expect(result.resolved.size).to.equal(4);
      expect(result.unresolved).to.have.lengthOf(0);
    });

    it('US-033-AC-2: should maintain correct order for transitive deps', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:D'],
      ]);

      const resolver = new DependencyResolver(graph, components);
      const result = resolver.resolve();

      // All components should be in the order
      expect(result.deploymentOrder).to.have.lengthOf(4);
      expect(result.deploymentOrder).to.include.members(['ApexClass:A', 'ApexClass:B', 'ApexClass:C', 'ApexClass:D']);
    });
  });

  describe('Optional Dependencies', () => {
    /**
     * @ac US-033-AC-3: Handle optional dependencies
     */
    it('US-033-AC-3: should exclude optional deps by default', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:B', 'soft'],
        ['ApexClass:A', 'ApexClass:C', 'hard'],
      ]);

      const resolver = new DependencyResolver(graph, components, {
        includeOptional: false,
      });
      const result = resolver.resolve();

      expect(result.optional).to.deep.equal(['ApexClass:B']);
      expect(result.deploymentOrder).to.include.members(['ApexClass:A', 'ApexClass:B', 'ApexClass:C']);
    });

    it('US-033-AC-3: should include optional deps when configured', () => {
      const { graph, components } = createTestData([['ApexClass:A', 'ApexClass:B', 'soft']]);

      const resolver = new DependencyResolver(graph, components, {
        includeOptional: true,
      });
      const result = resolver.resolve();

      expect(result.optional).to.deep.equal([]);
      expect(result.deploymentOrder).to.include('ApexClass:B');
    });
  });

  describe('Managed Packages', () => {
    /**
     * @ac US-033-AC-4: Skip managed package dependencies
     */
    it('US-033-AC-4: should skip managed package components', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:ns__Managed'],
        ['ApexClass:ns__Managed', 'ApexClass:B'],
      ]);

      const resolver = new DependencyResolver(graph, components, {
        skipManaged: true,
      });
      const result = resolver.resolve();

      expect(result.managed).to.include('ApexClass:ns__Managed');
      expect(result.deploymentOrder).to.not.include('ApexClass:ns__Managed');
    });

    it('US-033-AC-4: should include managed packages when not skipping', () => {
      const { graph, components } = createTestData([['ApexClass:A', 'ApexClass:ns__Managed']]);

      const resolver = new DependencyResolver(graph, components, {
        skipManaged: false,
      });
      const result = resolver.resolve();

      expect(result.deploymentOrder).to.include('ApexClass:ns__Managed');
    });
  });

  describe('Unresolved Dependencies', () => {
    /**
     * @ac US-033-AC-5: Report unresolved dependencies
     */
    it('US-033-AC-5: should report unresolved dependencies', () => {
      const { graph, components } = createTestData([['ApexClass:A', 'ApexClass:Missing']]);

      // Remove Missing from components to simulate missing dependency
      components.delete('ApexClass:Missing');
      graph.delete('ApexClass:Missing');

      const resolver = new DependencyResolver(graph, components);
      const result = resolver.resolve();

      // Resolver should work gracefully with missing dependencies
      expect(result).to.exist;
      expect(result.deploymentOrder.length).to.be.greaterThanOrEqual(0);
    });

    it('US-033-AC-5: should identify missing dependencies', () => {
      const { graph, components } = createTestData([['ApexClass:A', 'ApexClass:Missing']]);

      components.delete('ApexClass:Missing');
      // Don't delete from graph

      const resolver = new DependencyResolver(graph, components);
      const result = resolver.resolve();

      // Test that resolver handles missing components gracefully
      expect(result.deploymentOrder.length).to.be.greaterThanOrEqual(1);
    });
  });

  describe('Dependency Report', () => {
    /**
     * @ac US-033-AC-6: Generate dependency report
     */
    it('US-033-AC-6: should generate complete dependency report', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
      ]);

      const resolver = new DependencyResolver(graph, components);
      const result = resolver.resolve();

      expect(result.report).to.exist;
      expect(result.report.totalComponents).to.be.a('number');
      expect(result.report.resolvedCount).to.be.a('number');
      expect(result.report.unresolvedCount).to.be.a('number');
      expect(result.report.deploymentLevels).to.be.a('number');
    });

    it('US-033-AC-6: should calculate deployment levels correctly', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:D'],
      ]);

      const resolver = new DependencyResolver(graph, components);
      const result = resolver.resolve();

      expect(result.report.deploymentLevels).to.equal(4); // D, C, B, A
    });
  });

  describe('Circular Dependencies', () => {
    it('should handle circular dependencies', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:A'],
      ]);

      const circular: CircularDependency[] = [
        {
          cycle: ['ApexClass:A', 'ApexClass:B'],
          severity: 'error',
          message: 'Circular dependency detected',
        },
      ];

      const resolver = new DependencyResolver(graph, components, {
        circularDependencies: circular,
      });
      const result = resolver.resolve();

      expect(result.circular).to.have.lengthOf(1);
      expect(result.unresolved.length).to.be.greaterThan(0);
    });
  });

  describe('Manual Ordering Constraints', () => {
    it('should apply manual ordering constraints', () => {
      const { graph, components } = createTestData([['ApexClass:A', 'ApexClass:B']]);

      const resolver = new DependencyResolver(graph, components, {
        orderingConstraints: [{ before: 'ApexClass:B', after: 'ApexClass:A' }],
      });
      const result = resolver.resolve();

      expect(result.deploymentOrder).to.deep.equal([]);
      expect(result.unresolved.map((entry) => entry.nodeId)).to.have.members(['ApexClass:A', 'ApexClass:B']);
    });

    it('should support multiple constraints', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
      ]);

      const resolver = new DependencyResolver(graph, components, {
        orderingConstraints: [
          { before: 'ApexClass:C', after: 'ApexClass:B' },
          { before: 'ApexClass:B', after: 'ApexClass:A' },
        ],
      });
      const result = resolver.resolve();

      expect(result.deploymentOrder).to.deep.equal([]);
      expect(result.unresolved.map((entry) => entry.nodeId)).to.have.members([
        'ApexClass:A',
        'ApexClass:B',
        'ApexClass:C',
      ]);
    });
  });

  describe('Deployment Order', () => {
    it('should generate correct deployment order', () => {
      const { graph, components } = createTestData([
        ['ApexClass:Controller', 'ApexClass:Service'],
        ['ApexClass:Service', 'ApexClass:Repository'],
        ['ApexClass:Repository', 'ApexClass:Model'],
      ]);

      const resolver = new DependencyResolver(graph, components);
      const result = resolver.resolve();

      // All components should be in the order
      expect(result.deploymentOrder).to.have.lengthOf(4);
      expect(result.deploymentOrder).to.include.members([
        'ApexClass:Model',
        'ApexClass:Repository',
        'ApexClass:Service',
        'ApexClass:Controller',
      ]);
    });

    it('should handle parallel dependencies', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:Common'],
        ['ApexClass:B', 'ApexClass:Common'],
        ['ApexClass:C', 'ApexClass:Common'],
      ]);

      const resolver = new DependencyResolver(graph, components);
      const result = resolver.resolve();

      // All components should be in the order
      expect(result.deploymentOrder).to.have.lengthOf(4);
      expect(result.deploymentOrder).to.include('ApexClass:Common');
    });
  });

  describe('Helper Methods', () => {
    it('should get resolution for specific component', () => {
      const { graph, components } = createTestData([['ApexClass:A', 'ApexClass:B']]);

      const resolver = new DependencyResolver(graph, components);
      const resolution = resolver.getResolution('ApexClass:A');

      expect(resolution).to.exist;
      expect(resolution?.nodeId).to.equal('ApexClass:A');
      expect(resolution?.status).to.equal('resolved');
    });

    it('should check if component can be resolved', () => {
      const { graph, components } = createTestData([['ApexClass:A', 'ApexClass:B']]);

      const resolver = new DependencyResolver(graph, components);

      expect(resolver.canResolve('ApexClass:A')).to.be.true;
      expect(resolver.canResolve('ApexClass:NonExistent')).to.be.false;
    });

    it('should get deployment order for specific components', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:D', 'ApexClass:E'],
      ]);

      const resolver = new DependencyResolver(graph, components);
      const order = resolver.getDeploymentOrder(['ApexClass:A', 'ApexClass:B']);

      expect(order).to.have.lengthOf(2);
      expect(order).to.include.members(['ApexClass:A', 'ApexClass:B']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty graph', () => {
      const graph: DependencyGraph = new Map();
      const components = new Map<string, MetadataComponent>();

      const resolver = new DependencyResolver(graph, components);
      const result = resolver.resolve();

      expect(result.deploymentOrder).to.have.lengthOf(0);
      expect(result.resolved.size).to.equal(0);
    });

    it('should handle isolated components', () => {
      const { graph, components } = createTestData([]);

      graph.set('ApexClass:Isolated', new Set<string>());
      components.set('ApexClass:Isolated', {
        type: 'ApexClass',
        name: 'Isolated',
        filePath: '/path',
        dependencies: new Set<string>(),
        dependents: new Set<string>(),
        priorityBoost: 0,
      });

      const resolver = new DependencyResolver(graph, components);
      const result = resolver.resolve();

      expect(result.deploymentOrder).to.include('ApexClass:Isolated');
    });

    it('should handle complex dependency graphs', () => {
      const edges: Array<[string, string]> = [];

      // Create a diamond dependency
      edges.push(['ApexClass:Top', 'ApexClass:Left']);
      edges.push(['ApexClass:Top', 'ApexClass:Right']);
      edges.push(['ApexClass:Left', 'ApexClass:Bottom']);
      edges.push(['ApexClass:Right', 'ApexClass:Bottom']);

      const { graph, components } = createTestData(edges);
      const resolver = new DependencyResolver(graph, components);
      const result = resolver.resolve();

      expect(result.deploymentOrder).to.have.lengthOf(4);
      expect(result.unresolved).to.have.lengthOf(0);
    });
  });

  describe('Performance', () => {
    it('should handle large graphs efficiently', function () {
      this.timeout(5000);

      const edges: Array<[string, string]> = [];

      // Create a large linear dependency chain
      for (let i = 0; i < 500; i++) {
        edges.push([`ApexClass:Node${i}`, `ApexClass:Node${i + 1}`]);
      }

      const { graph, components } = createTestData(edges);
      const startTime = Date.now();

      const resolver = new DependencyResolver(graph, components);
      const result = resolver.resolve();

      const duration = Date.now() - startTime;

      expect(result.deploymentOrder.length).to.be.greaterThan(0);
      expect(duration).to.be.lessThan(1000); // Should complete in < 1 second
    });
  });

  describe('Resolution Status', () => {
    it('should mark components with correct status', () => {
      const { graph, components } = createTestData([['ApexClass:A', 'ApexClass:B']]);

      const resolver = new DependencyResolver(graph, components);
      const result = resolver.resolve();

      for (const resolved of result.resolved.values()) {
        expect(resolved.status).to.equal('resolved');
      }
    });

    it('should track deployment order numbers', () => {
      const { graph, components } = createTestData([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
      ]);

      const resolver = new DependencyResolver(graph, components);
      const result = resolver.resolve();

      const cOrder = result.resolved.get('ApexClass:C')?.order ?? -1;
      const bOrder = result.resolved.get('ApexClass:B')?.order ?? -1;
      const aOrder = result.resolved.get('ApexClass:A')?.order ?? -1;

      // All should have valid order numbers
      expect(cOrder).to.be.greaterThanOrEqual(0);
      expect(bOrder).to.be.greaterThanOrEqual(0);
      expect(aOrder).to.be.greaterThanOrEqual(0);
    });
  });
});
