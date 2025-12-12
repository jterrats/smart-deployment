/**
 * Start Command Step Definitions - US-067
 * Step definitions for start command scenarios
 *
 * @ac US-067-AC-1: 10 scenarios for start command
 * @issue #67
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import type { SmartDeploymentWorld } from '../support/world.js';

Given('I have a valid Salesforce project', function (this: SmartDeploymentWorld) {
  // Setup: project is ready
  this.components = [
    {
      name: 'TestClass',
      type: 'ApexClass',
      filePath: 'TestClass.cls',
      dependencies: new Set<string>(),
      dependents: new Set<string>(),
      priorityBoost: 0,
    },
  ];
});

Given('I have {int} components to deploy', function (this: SmartDeploymentWorld, count: number) {
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

When('I run the start command', async function (this: SmartDeploymentWorld) {
  try {
    await this.graphBuilder.addComponent(this.components[0] as never);
    this.graphResult = this.graphBuilder.build();
    this.waveResult = this.waveBuilder.generateWaves(this.graphResult.graph);
  } catch (error) {
    this.error = error instanceof Error ? error : new Error(String(error));
  }
});

When('I run the start command with {string} flag', async function (
  this: SmartDeploymentWorld,
  flag: string
) {
  // Simulate flag behavior
  if (flag === '--dry-run') {
    this.log('Dry-run mode enabled');
  }
  await this.run();
});

Then('deployment should start', function (this: SmartDeploymentWorld) {
  expect(this.waveResult).to.exist;
  expect(this.waveResult?.waves.length).to.be.greaterThan(0);
});

Then('waves should be generated', function (this: SmartDeploymentWorld) {
  expect(this.waveResult).to.exist;
  expect(this.waveResult?.waves.length).to.be.greaterThan(0);
});

Then('deployment should complete successfully', function (this: SmartDeploymentWorld) {
  expect(this.error).to.be.undefined;
  expect(this.waveResult).to.exist;
});

