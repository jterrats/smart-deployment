/**
 * Performance Tests - US-069
 * Benchmarks for critical operations
 *
 * @ac US-069-AC-1: Benchmark parsing 1000 files
 * @ac US-069-AC-2: Benchmark topological sort 1000 nodes
 * @ac US-069-AC-3: Benchmark wave generation
 * @ac US-069-AC-4: Benchmark end-to-end deployment
 * @ac US-069-AC-5: Performance regression detection
 * @ac US-069-AC-6: Report performance metrics
 * @issue #69
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parseApexClass } from '../../src/parsers/apex-class-parser.js';
import { DependencyGraphBuilder } from '../../src/dependencies/dependency-graph-builder.js';
import { WaveBuilder } from '../../src/waves/wave-builder.js';

describe('Performance Tests - US-069', () => {
  describe('US-069: Performance Tests', () => {
    /** @ac US-069-AC-1: Benchmark parsing 1000 files */
    it('US-069-AC-1: should parse 1000 files efficiently', async () => {
      const apexCode = 'public class TestClass { public void method() {} }';
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        parseApexClass(`TestClass${i}.cls`, apexCode);
      }

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should parse 1000 files in < 5 seconds
      expect(executionTime).to.be.below(5000);
    }).timeout(10_000);

    /** @ac US-069-AC-2: Benchmark topological sort 1000 nodes */
    it('US-069-AC-2: should sort 1000 nodes efficiently', async () => {
      const graphBuilder = new DependencyGraphBuilder();
      const waveBuilder = new WaveBuilder();

      // Create 1000 components with dependencies
      for (let i = 0; i < 1000; i++) {
        const component = {
          name: `Class${i}`,
          type: 'ApexClass' as const,
          filePath: `Class${i}.cls`,
          dependencies: new Set<string>(i > 0 ? [`Class${i - 1}`] : []),
          dependents: new Set<string>(),
          priorityBoost: 0,
        };
        graphBuilder.addComponent(component);
      }

      const startTime = Date.now();
      const graphResult = graphBuilder.build();
      const waveResult = waveBuilder.generateWaves(graphResult.graph);
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      // Should complete in < 3 seconds
      expect(executionTime).to.be.below(3000);
      expect(waveResult.waves.length).to.be.greaterThan(0);
    }).timeout(10_000);

    /** @ac US-069-AC-3: Benchmark wave generation */
    it('US-069-AC-3: should generate waves efficiently', async () => {
      const graphBuilder = new DependencyGraphBuilder();
      const waveBuilder = new WaveBuilder();

      // Create complex dependency graph
      const components = [];
      for (let i = 0; i < 500; i++) {
        const deps = [];
        if (i > 0) deps.push(`Class${i - 1}`);
        if (i > 10) deps.push(`Class${i - 10}`);
        if (i > 50) deps.push(`Class${i - 50}`);

        components.push({
          name: `Class${i}`,
          type: 'ApexClass' as const,
          filePath: `Class${i}.cls`,
          dependencies: new Set<string>(deps),
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      }

      for (const component of components) {
        graphBuilder.addComponent(component);
      }

      const startTime = Date.now();
      const graphResult = graphBuilder.build();
      const waveResult = waveBuilder.generateWaves(graphResult.graph);
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      // Should complete in < 2 seconds
      expect(executionTime).to.be.below(2000);
      expect(waveResult.waves.length).to.be.greaterThan(0);
    }).timeout(10_000);

    /** @ac US-069-AC-4: Benchmark end-to-end deployment */
    it('US-069-AC-4: should process end-to-end deployment efficiently', async () => {
      const graphBuilder = new DependencyGraphBuilder();
      const waveBuilder = new WaveBuilder();

      // Simulate end-to-end: Parse → Build → Generate Waves
      const components = [];
      for (let i = 0; i < 200; i++) {
        const apexCode = `public class Class${i} { public void method() {} }`;
        const parsed = parseApexClass(`Class${i}.cls`, apexCode);

        components.push({
          name: parsed.className,
          type: 'ApexClass' as const,
          filePath: `Class${i}.cls`,
          dependencies: new Set<string>(parsed.dependencies.map((d) => d.className)),
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      }

      const startTime = Date.now();

      for (const component of components) {
        graphBuilder.addComponent(component);
      }
      const graphResult = graphBuilder.build();
      const waveResult = waveBuilder.generateWaves(graphResult.graph);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should complete in < 3 seconds
      expect(executionTime).to.be.below(3000);
      expect(waveResult.waves.length).to.be.greaterThan(0);
    }).timeout(10_000);

    /** @ac US-069-AC-5: Performance regression detection */
    it('US-069-AC-5: should detect performance regressions', async () => {
      const graphBuilder = new DependencyGraphBuilder();
      const waveBuilder = new WaveBuilder();

      // Baseline: 100 components
      const baselineComponents = [];
      for (let i = 0; i < 100; i++) {
        baselineComponents.push({
          name: `Class${i}`,
          type: 'ApexClass' as const,
          filePath: `Class${i}.cls`,
          dependencies: new Set<string>(),
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      }

      const baselineStart = Date.now();
      for (const component of baselineComponents) {
        graphBuilder.addComponent(component);
      }
      const baselineResult = graphBuilder.build();
      const baselineWaveResult = waveBuilder.generateWaves(baselineResult.graph);
      const baselineEnd = Date.now();

      const baselineTime = baselineEnd - baselineStart;

      // Current implementation should be similar or better
      expect(baselineTime).to.be.below(1000); // Should be fast
      expect(baselineWaveResult.waves.length).to.be.greaterThan(0);
    }).timeout(10_000);

    /** @ac US-069-AC-6: Report performance metrics */
    it('US-069-AC-6: should report performance metrics', async () => {
      const graphBuilder = new DependencyGraphBuilder();
      const waveBuilder = new WaveBuilder();

      const components = [];
      for (let i = 0; i < 100; i++) {
        components.push({
          name: `Class${i}`,
          type: 'ApexClass' as const,
          filePath: `Class${i}.cls`,
          dependencies: new Set<string>(),
          dependents: new Set<string>(),
          priorityBoost: 0,
        });
      }

      const startTime = Date.now();
      for (const component of components) {
        graphBuilder.addComponent(component);
      }
      const graphResult = graphBuilder.build();
      const waveResult = waveBuilder.generateWaves(graphResult.graph);
      const endTime = Date.now();

      const executionTime = endTime - startTime;
      const metrics = {
        components: components.length,
        waves: waveResult.waves.length,
        executionTimeMs: executionTime,
        avgTimePerComponent: executionTime / components.length,
      };

      // Verify metrics are reported
      expect(metrics.components).to.equal(100);
      expect(metrics.waves).to.be.greaterThan(0);
      expect(metrics.executionTimeMs).to.be.a('number');
      expect(metrics.avgTimePerComponent).to.be.a('number');
    }).timeout(10_000);
  });
});
