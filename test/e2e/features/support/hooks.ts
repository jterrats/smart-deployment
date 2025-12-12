/**
 * Cucumber Hooks - US-066
 * Setup and teardown hooks
 *
 * @ac US-066-AC-3: Step definition helpers
 * @issue #66
 */

import { Before, After } from '@cucumber/cucumber';
import type { SmartDeploymentWorld } from './world.js';

Before(function (this: SmartDeploymentWorld) {
  this.reset();
});

After(function (this: SmartDeploymentWorld) {
  this.reset();
});

