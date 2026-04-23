/**
 * Cucumber World - US-066
 * Step definition helpers and context
 *
 * @ac US-066-AC-3: Step definition helpers
 * @issue #66
 */

import { setWorldConstructor, World } from '@cucumber/cucumber';
import type { IWorldOptions } from '@cucumber/cucumber';
import { DependencyGraphBuilder } from '../../../../src/dependencies/dependency-graph-builder.js';
import { WaveBuilder } from '../../../../src/waves/wave-builder.js';
import type { WaveResult } from '../../../../src/waves/wave-builder.js';
import type { DependencyAnalysisResult } from '../../../../src/types/dependency.js';

export class SmartDeploymentWorld extends World {
  public graphBuilder: DependencyGraphBuilder;
  public waveBuilder: WaveBuilder;
  public graphResult?: DependencyAnalysisResult;
  public waveResult?: WaveResult;
  public error?: Error;
  public components: Array<{
    name: string;
    type: string;
    filePath: string;
    dependencies: Set<string>;
    dependents: Set<string>;
    priorityBoost: number;
  }> = [];

  public constructor(options: IWorldOptions) {
    super(options);
    this.graphBuilder = new DependencyGraphBuilder();
    this.waveBuilder = new WaveBuilder();
  }

  public reset(): void {
    this.graphBuilder = new DependencyGraphBuilder();
    this.waveBuilder = new WaveBuilder();
    this.graphResult = undefined;
    this.waveResult = undefined;
    this.error = undefined;
    this.components = [];
  }

  public async run(): Promise<void> {
    try {
      for (const component of this.components) {
        this.graphBuilder.addComponent(component as never);
      }
      this.graphResult = this.graphBuilder.build();
      if (this.graphResult) {
        this.waveResult = this.waveBuilder.generateWaves(this.graphResult.graph);
      }
    } catch (error) {
      this.error = error instanceof Error ? error : new Error(String(error));
    }
  }
}

setWorldConstructor(SmartDeploymentWorld);
