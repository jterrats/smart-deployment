/**
 * Unit tests for Dependency Merger
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { DependencyMerger } from '../../../src/dependencies/dependency-merger.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';
import type { MetadataType } from '../../../src/types/metadata.js';
import type { InferredDependency } from '../../../src/types/dependency.js';

describe('DependencyMerger', () => {
  /**
   * Helper to create test components
   */
  function createComponent(type: MetadataType, name: string, deps: string[]): [string, MetadataComponent] {
    const nodeId = `${type}:${name}`;
    return [
      nodeId,
      {
        type,
        name,
        filePath: `/path/to/${nodeId}`,
        dependencies: new Set(deps),
        dependents: new Set(),
        priorityBoost: 0,
      },
    ];
  }

  describe('Static Dependencies', () => {
    /**
     * @ac US-037-AC-1: Merge static parser dependencies
     */
    it('US-037-AC-1: should include all static dependencies', () => {
      const components = new Map([
        createComponent('ApexClass', 'A', ['ApexClass:B', 'ApexClass:C']),
        createComponent('ApexClass', 'B', ['ApexClass:D']),
        createComponent('ApexClass', 'C', []),
        createComponent('ApexClass', 'D', []),
      ]);

      const merger = new DependencyMerger();
      const result = merger.merge(components, []);

      expect(result.stats.staticDependencies).to.equal(3);
      expect(result.stats.totalDependencies).to.equal(3);
      expect(result.graph.get('ApexClass:A')?.has('ApexClass:B')).to.be.true;
      expect(result.graph.get('ApexClass:A')?.has('ApexClass:C')).to.be.true;
    });

    it('US-037-AC-1: should mark static dependencies with confidence 1.0', () => {
      const components = new Map([
        createComponent('ApexClass', 'A', ['ApexClass:B']),
        createComponent('ApexClass', 'B', []),
      ]);

      const merger = new DependencyMerger();
      const result = merger.merge(components, []);

      const staticDeps = merger.getDependenciesBySource(result.dependencies, 'static');
      expect(staticDeps).to.have.lengthOf(1);
      expect(staticDeps[0].confidence).to.equal(1.0);
      expect(staticDeps[0].source).to.equal('static');
    });
  });

  describe('Inferred Dependencies', () => {
    /**
     * @ac US-037-AC-2: Merge AI-inferred dependencies
     */
    it('US-037-AC-2: should add inferred dependencies', () => {
      const components = new Map([
        createComponent('ApexClass', 'TestA', []),
        createComponent('ApexClass', 'ServiceA', []),
      ]);

      const inferences: InferredDependency[] = [
        {
          from: 'ApexClass:TestA',
          to: 'ApexClass:ServiceA',
          confidence: 0.9,
          reason: 'test-pattern',
        },
      ];

      const merger = new DependencyMerger();
      const result = merger.merge(components, inferences);

      expect(result.stats.inferredDependencies).to.equal(1);
      expect(result.graph.get('ApexClass:TestA')?.has('ApexClass:ServiceA')).to.be.true;
      expect(result.components.get('ApexClass:TestA')?.dependencyDetails).to.deep.include({
        nodeId: 'ApexClass:ServiceA',
        kind: 'inferred',
        source: 'ai',
        reason: 'test-pattern',
        confidence: 0.9,
      });
    });

    it('US-037-AC-2: should filter low confidence inferences', () => {
      const components = new Map([createComponent('ApexClass', 'A', []), createComponent('ApexClass', 'B', [])]);

      const inferences: InferredDependency[] = [
        {
          from: 'ApexClass:A',
          to: 'ApexClass:B',
          confidence: 0.3, // Below default threshold (0.5)
          reason: 'weak-pattern',
        },
      ];

      const merger = new DependencyMerger({ minConfidence: 0.5 });
      const result = merger.merge(components, inferences);

      expect(result.stats.inferredDependencies).to.equal(0);
    });

    it('US-037-AC-2: should include low confidence if configured', () => {
      const components = new Map([createComponent('ApexClass', 'A', []), createComponent('ApexClass', 'B', [])]);

      const inferences: InferredDependency[] = [
        {
          from: 'ApexClass:A',
          to: 'ApexClass:B',
          confidence: 0.3,
          reason: 'weak-pattern',
        },
      ];

      const merger = new DependencyMerger({
        minConfidence: 0.5,
        includeLowConfidence: true,
      });
      const result = merger.merge(components, inferences);

      expect(result.stats.inferredDependencies).to.equal(1);
    });
  });

  describe('Conflict Resolution', () => {
    /**
     * @ac US-037-AC-3: Resolve conflicts (prefer static)
     */
    it('US-037-AC-3: should prefer static over inferred by default', () => {
      const components = new Map([
        createComponent('ApexClass', 'A', ['ApexClass:B']),
        createComponent('ApexClass', 'B', []),
      ]);

      const inferences: InferredDependency[] = [
        {
          from: 'ApexClass:A',
          to: 'ApexClass:B', // Same as static
          confidence: 0.9,
          reason: 'inferred-pattern',
        },
      ];

      const merger = new DependencyMerger({ preferStatic: true });
      const result = merger.merge(components, inferences);

      const dep = result.dependencies.find((d) => d.from === 'ApexClass:A' && d.to === 'ApexClass:B');

      expect(dep?.source).to.equal('static');
      expect(dep?.confidence).to.equal(1.0);
      expect(result.stats.conflicts).to.equal(1);
    });

    it('US-037-AC-3: should merge sources when preferStatic=false', () => {
      const components = new Map([
        createComponent('ApexClass', 'A', ['ApexClass:B']),
        createComponent('ApexClass', 'B', []),
      ]);

      const inferences: InferredDependency[] = [
        {
          from: 'ApexClass:A',
          to: 'ApexClass:B',
          confidence: 0.9,
          reason: 'inferred-pattern',
        },
      ];

      const merger = new DependencyMerger({ preferStatic: false });
      const result = merger.merge(components, inferences);

      const dep = result.dependencies.find((d) => d.from === 'ApexClass:A' && d.to === 'ApexClass:B');

      expect(dep?.source).to.equal('merged');
      expect(dep?.reasons).to.include('Explicit reference in metadata');
      expect(dep?.reasons).to.include('inferred-pattern');
    });
  });

  describe('Source Tracking', () => {
    /**
     * @ac US-037-AC-4: Track dependency source
     */
    it('US-037-AC-4: should track dependency source', () => {
      const components = new Map([
        createComponent('ApexClass', 'A', ['ApexClass:B']),
        createComponent('ApexClass', 'B', []),
        createComponent('ApexClass', 'C', []),
      ]);

      const inferences: InferredDependency[] = [
        {
          from: 'ApexClass:B',
          to: 'ApexClass:C',
          confidence: 0.8,
          reason: 'naming-convention',
        },
      ];

      const merger = new DependencyMerger();
      const result = merger.merge(components, inferences);

      const staticDep = result.dependencies.find((d) => d.from === 'ApexClass:A' && d.to === 'ApexClass:B');
      const inferredDep = result.dependencies.find((d) => d.from === 'ApexClass:B' && d.to === 'ApexClass:C');

      expect(staticDep?.source).to.equal('static');
      expect(inferredDep?.source).to.equal('inferred');
    });

    it('US-037-AC-4: should track reasons for dependencies', () => {
      const components = new Map([
        createComponent('ApexClass', 'A', ['ApexClass:B']),
        createComponent('ApexClass', 'B', []),
      ]);

      const merger = new DependencyMerger();
      const result = merger.merge(components, []);

      const dep = result.dependencies[0];
      expect(dep.reasons).to.be.an('array');
      expect(dep.reasons.length).to.be.greaterThan(0);
      expect(dep.reasons[0]).to.include('metadata');
    });
  });

  describe('Merge Report', () => {
    /**
     * @ac US-037-AC-5: Report merged dependencies
     */
    it('US-037-AC-5: should generate merge report', () => {
      const components = new Map([
        createComponent('ApexClass', 'A', ['ApexClass:B']),
        createComponent('ApexClass', 'B', []),
        createComponent('ApexClass', 'C', []),
      ]);

      const inferences: InferredDependency[] = [
        {
          from: 'ApexClass:B',
          to: 'ApexClass:C',
          confidence: 0.8,
          reason: 'inferred',
        },
      ];

      const merger = new DependencyMerger();
      const result = merger.merge(components, inferences);
      const report = merger.generateReport(result);

      expect(report).to.include('Dependency Merge Report');
      expect(report).to.include('Statistics');
      expect(report).to.include(`Total Dependencies: ${result.stats.totalDependencies}`);
      expect(report).to.include(`Static Dependencies: ${result.stats.staticDependencies}`);
      expect(report).to.include(`Inferred Dependencies: ${result.stats.inferredDependencies}`);
    });

    it('US-037-AC-5: should include detailed statistics', () => {
      const components = new Map([
        createComponent('ApexClass', 'A', ['ApexClass:B']),
        createComponent('ApexClass', 'B', []),
      ]);

      const merger = new DependencyMerger();
      const result = merger.merge(components, []);

      expect(result.stats.totalDependencies).to.be.a('number');
      expect(result.stats.staticDependencies).to.be.a('number');
      expect(result.stats.inferredDependencies).to.be.a('number');
      expect(result.stats.mergedDependencies).to.be.a('number');
      expect(result.stats.conflicts).to.be.a('number');
      expect(result.stats.avgConfidence).to.be.a('number');
    });
  });

  describe('Confidence Scoring', () => {
    /**
     * @ac US-037-AC-6: Confidence scoring
     */
    it('US-037-AC-6: should calculate overall confidence', () => {
      const components = new Map([
        createComponent('ApexClass', 'A', []),
        createComponent('ApexClass', 'B', []),
        createComponent('ApexClass', 'C', []),
      ]);

      const inferences: InferredDependency[] = [
        {
          from: 'ApexClass:A',
          to: 'ApexClass:B',
          confidence: 0.9,
          reason: 'strong',
        },
        {
          from: 'ApexClass:B',
          to: 'ApexClass:C',
          confidence: 0.7,
          reason: 'medium',
        },
      ];

      const merger = new DependencyMerger();
      const result = merger.merge(components, inferences);

      const confidence = merger.calculateOverallConfidence(result.dependencies);
      expect(confidence).to.be.greaterThan(0);
      expect(confidence).to.be.lessThanOrEqual(1);
    });

    it('US-037-AC-6: should filter by confidence', () => {
      const components = new Map([
        createComponent('ApexClass', 'A', []),
        createComponent('ApexClass', 'B', []),
        createComponent('ApexClass', 'C', []),
      ]);

      const inferences: InferredDependency[] = [
        {
          from: 'ApexClass:A',
          to: 'ApexClass:B',
          confidence: 0.9,
          reason: 'high',
        },
        {
          from: 'ApexClass:B',
          to: 'ApexClass:C',
          confidence: 0.5,
          reason: 'low',
        },
      ];

      const merger = new DependencyMerger({ minConfidence: 0.3 });
      const result = merger.merge(components, inferences);

      const highConf = merger.filterByConfidence(result.dependencies, 0.8);
      expect(highConf.length).to.be.lessThan(result.dependencies.length);
    });

    it('US-037-AC-6: should identify low confidence dependencies', () => {
      const components = new Map([createComponent('ApexClass', 'A', []), createComponent('ApexClass', 'B', [])]);

      const inferences: InferredDependency[] = [
        {
          from: 'ApexClass:A',
          to: 'ApexClass:B',
          confidence: 0.6,
          reason: 'weak',
        },
      ];

      const merger = new DependencyMerger({ minConfidence: 0.3 });
      const result = merger.merge(components, inferences);

      const lowConf = merger.getLowConfidenceDependencies(result.dependencies, 0.7);
      expect(lowConf.length).to.be.greaterThan(0);
    });
  });

  describe('Helper Methods', () => {
    it('should get dependencies by source', () => {
      const components = new Map([
        createComponent('ApexClass', 'A', ['ApexClass:B']),
        createComponent('ApexClass', 'B', []),
        createComponent('ApexClass', 'C', []),
      ]);

      const inferences: InferredDependency[] = [
        {
          from: 'ApexClass:B',
          to: 'ApexClass:C',
          confidence: 0.8,
          reason: 'inferred',
        },
      ];

      const merger = new DependencyMerger();
      const result = merger.merge(components, inferences);

      const staticDeps = merger.getDependenciesBySource(result.dependencies, 'static');
      const inferredDeps = merger.getDependenciesBySource(result.dependencies, 'inferred');

      expect(staticDeps).to.have.lengthOf(1);
      expect(inferredDeps).to.have.lengthOf(1);
    });

    it('should get conflicts', () => {
      const staticDeps = new Set(['ApexClass:A→ApexClass:B']);

      const inferences: InferredDependency[] = [
        {
          from: 'ApexClass:A',
          to: 'ApexClass:B',
          confidence: 0.9,
          reason: 'inferred',
        },
        {
          from: 'ApexClass:B',
          to: 'ApexClass:C',
          confidence: 0.8,
          reason: 'inferred',
        },
      ];

      const merger = new DependencyMerger();
      const conflicts = merger.getConflicts(staticDeps, inferences);

      expect(conflicts).to.have.lengthOf(1);
      expect(conflicts[0].from).to.equal('ApexClass:A');
      expect(conflicts[0].to).to.equal('ApexClass:B');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty components', () => {
      const components = new Map<string, MetadataComponent>();
      const inferences: InferredDependency[] = [];

      const merger = new DependencyMerger();
      const result = merger.merge(components, inferences);

      expect(result.stats.totalDependencies).to.equal(0);
      expect(result.graph.size).to.equal(0);
    });

    it('should handle components with no dependencies', () => {
      const components = new Map([createComponent('ApexClass', 'A', []), createComponent('ApexClass', 'B', [])]);

      const merger = new DependencyMerger();
      const result = merger.merge(components, []);

      expect(result.stats.staticDependencies).to.equal(0);
      expect(result.stats.totalDependencies).to.equal(0);
    });

    it('should handle empty inferences', () => {
      const components = new Map([
        createComponent('ApexClass', 'A', ['ApexClass:B']),
        createComponent('ApexClass', 'B', []),
      ]);

      const merger = new DependencyMerger();
      const result = merger.merge(components, []);

      expect(result.stats.inferredDependencies).to.equal(0);
      expect(result.stats.staticDependencies).to.equal(1);
    });

    it('should handle complex merge scenarios', () => {
      const components = new Map([
        createComponent('ApexClass', 'A', ['ApexClass:B']),
        createComponent('ApexClass', 'B', ['ApexClass:C']),
        createComponent('ApexClass', 'C', []),
        createComponent('ApexClass', 'D', []),
      ]);

      const inferences: InferredDependency[] = [
        {
          from: 'ApexClass:A',
          to: 'ApexClass:B', // Conflict
          confidence: 0.9,
          reason: 'test',
        },
        {
          from: 'ApexClass:C',
          to: 'ApexClass:D', // New
          confidence: 0.8,
          reason: 'test',
        },
        {
          from: 'ApexClass:D',
          to: 'ApexClass:A', // New
          confidence: 0.6,
          reason: 'test',
        },
      ];

      const merger = new DependencyMerger({ minConfidence: 0.5 });
      const result = merger.merge(components, inferences);

      expect(result.stats.staticDependencies).to.equal(2);
      expect(result.stats.inferredDependencies).to.equal(2);
      expect(result.stats.conflicts).to.equal(1);
      expect(result.stats.totalDependencies).to.equal(4);
    });
  });
});
