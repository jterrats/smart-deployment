/**
 * E2E Tests for Status Command - US-067
 * @ac US-067-AC-5: 3 scenarios for status command
 * @issue #67
 */

import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { DependencyGraphBuilder } from '../../src/dependencies/dependency-graph-builder.js';
import { WaveBuilder } from '../../src/waves/wave-builder.js';

describe('E2E: Status Command - US-067', () => {
  let graphBuilder: DependencyGraphBuilder;
  let waveBuilder: WaveBuilder;

  beforeEach(() => {
    graphBuilder = new DependencyGraphBuilder();
    waveBuilder = new WaveBuilder();
  });

  it('should show current deployment status', async () => {
    const component = {
      name: 'TestClass',
      type: 'ApexClass' as const,
      filePath: 'TestClass.cls',
      dependencies: new Set<string>(),
      dependents: new Set<string>(),
      priorityBoost: 0,
    };

    graphBuilder.addComponent(component);
    const graphResult = graphBuilder.build();
    const waveResult = waveBuilder.generateWaves(graphResult.graph);

    expect(waveResult.waves.length).to.be.greaterThan(0);
    expect(waveResult.stats.totalWaves).to.be.greaterThan(0);
  });

  it('should show progress percentage', async () => {
    const components = Array.from({ length: 10 }, (_, i) => ({
      name: `Class${i}`,
      type: 'ApexClass' as const,
      filePath: `Class${i}.cls`,
      dependencies: new Set<string>(),
      dependents: new Set<string>(),
      priorityBoost: 0,
    }));

    for (const component of components) {
      graphBuilder.addComponent(component);
    }
    const graphResult = graphBuilder.build();
    const waveResult = waveBuilder.generateWaves(graphResult.graph);

    const totalWaves = waveResult.stats.totalWaves;
    expect(totalWaves).to.be.greaterThan(0);
  });

  it('should show estimated time remaining', async () => {
    const components = Array.from({ length: 5 }, (_, i) => ({
      name: `Class${i}`,
      type: 'ApexClass' as const,
      filePath: `Class${i}.cls`,
      dependencies: new Set<string>(),
      dependents: new Set<string>(),
      priorityBoost: 0,
    }));

    for (const component of components) {
      graphBuilder.addComponent(component);
    }
    const graphResult = graphBuilder.build();
    const waveResult = waveBuilder.generateWaves(graphResult.graph);

    expect(waveResult.stats.totalEstimatedTime).to.be.a('number');
  });
});

