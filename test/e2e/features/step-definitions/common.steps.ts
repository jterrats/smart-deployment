/**
 * Common Step Definitions - US-066
 * Reusable step definitions for BDD scenarios
 *
 * @ac US-066-AC-3: Step definition helpers
 * @issue #66
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import type { SmartDeploymentWorld } from '../support/world.js';

Given('I have {int} components', function (this: SmartDeploymentWorld, count: number) {
  this.components = [];
  for (let i = 0; i < count; i++) {
    this.components.push({
      name: `Component${i}`,
      type: 'ApexClass',
      filePath: `Component${i}.cls`,
      dependencies: new Set<string>(),
      dependents: new Set<string>(),
      priorityBoost: 0,
    });
  }
});

Given('component {string} depends on {string}', function (
  this: SmartDeploymentWorld,
  componentName: string,
  dependencyName: string
) {
  const component = this.components.find((c) => c.name === componentName);
  if (component) {
    component.dependencies.add(dependencyName);
  }
});

When('I build the dependency graph', function (this: SmartDeploymentWorld) {
  try {
    for (const component of this.components) {
      this.graphBuilder.addComponent(component as never);
    }
    this.graphResult = this.graphBuilder.build();
  } catch (error) {
    this.error = error instanceof Error ? error : new Error(String(error));
  }
});

When('I generate deployment waves', function (this: SmartDeploymentWorld) {
  try {
    if (this.graphResult) {
      this.waveResult = this.waveBuilder.generateWaves(this.graphResult.graph);
    }
  } catch (error) {
    this.error = error instanceof Error ? error : new Error(String(error));
  }
});

Then('I should have {int} waves', function (this: SmartDeploymentWorld, expectedWaves: number) {
  expect(this.waveResult).to.exist;
  expect(this.waveResult?.waves.length).to.equal(expectedWaves);
});

Then('wave {int} should contain {int} components', function (
  this: SmartDeploymentWorld,
  waveNumber: number,
  expectedCount: number
) {
  expect(this.waveResult).to.exist;
  const wave = this.waveResult?.waves[waveNumber - 1];
  expect(wave).to.exist;
  expect(wave?.components.length).to.equal(expectedCount);
});

Then('the operation should succeed', function (this: SmartDeploymentWorld) {
  expect(this.error).to.be.undefined;
});

Then('the operation should fail', function (this: SmartDeploymentWorld) {
  expect(this.error).to.exist;
});

