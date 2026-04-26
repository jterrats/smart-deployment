import type { NodeId } from '../types/dependency.js';
import type { MetadataComponent } from '../types/metadata.js';
import type { Wave } from '../waves/wave-builder.js';
import { DeploymentTracker } from './deployment-tracker.js';
import { SfCliIntegration } from './sf-cli-integration.js';
import { StateManager } from './state-manager.js';
import { TestPlanService } from './test-plan-service.js';
import { WaveManifestService } from './wave-manifest-service.js';
import type { TestExecutor } from './test-executor.js';
import type { DeploymentAIContext } from './deployment-context-service.js';

export type DeploymentRunnerParams = {
  deploymentId: string;
  targetOrg: string;
  sourcePath?: string;
  orderedWaves: Wave[];
  componentMap: ReadonlyMap<NodeId, MetadataComponent>;
  skipTests: boolean;
  testExecutor: TestExecutor;
  tracker: DeploymentTracker;
  stateManager: StateManager;
  sfCli: SfCliIntegration;
  aiContext?: DeploymentAIContext;
  log: (message: string) => void;
};

type DeploymentRunnerDependencies = {
  testPlanService?: TestPlanService;
  waveManifestService?: WaveManifestService;
};

export class DeploymentRunner {
  private readonly testPlanService: TestPlanService;
  private readonly waveManifestService: WaveManifestService;

  public constructor(dependencies: DeploymentRunnerDependencies = {}) {
    this.testPlanService = dependencies.testPlanService ?? new TestPlanService();
    this.waveManifestService = dependencies.waveManifestService ?? new WaveManifestService();
  }

  public async execute(params: DeploymentRunnerParams): Promise<void> {
    const {
      deploymentId,
      targetOrg,
      sourcePath,
      orderedWaves,
      componentMap,
      skipTests,
      testExecutor,
      tracker,
      stateManager,
      sfCli,
      aiContext,
      log,
    } = params;

    await this.forEachSequentially(orderedWaves, async (wave) => {
      log(`\n🌊 Deploying Wave ${wave.number}/${orderedWaves.length} (${wave.components.length} components)...`);

      const manifestPath = await this.waveManifestService.generateManifest({
        baseDir: sourcePath ?? process.cwd(),
        waveNumber: wave.number,
        components: wave.components,
        componentMap,
      });
      const testPlan = this.testPlanService.resolveTestPlan(wave, skipTests, testExecutor);

      tracker.startTracking(deploymentId, wave.number, orderedWaves.length);
      const result = await sfCli.deploy({
        manifestPath,
        targetOrg,
        testLevel: testPlan.testLevel,
        tests: testPlan.testLevel === 'RunSpecifiedTests' ? testPlan.tests : undefined,
      });
      tracker.updateProgress(deploymentId, result);

      if (!result.success) {
        await stateManager.saveState({
          deploymentId,
          targetOrg,
          timestamp: new Date().toISOString(),
          totalWaves: orderedWaves.length,
          completedWaves: Array.from({ length: Math.max(0, wave.number - 1) }, (_, i) => i + 1),
          currentWave: wave.number,
          failedWave: {
            waveNumber: wave.number,
            error: result.output,
            timestamp: new Date().toISOString(),
          },
          metadata: {
            lastKnownStatus: result.status,
            testsRun: result.testsRun,
            testFailures: result.testFailures,
            testLevel: testPlan.testLevel,
            ...this.buildAIMetadata(aiContext),
          },
        });
        throw new Error(`Wave ${wave.number} failed: ${result.output}`);
      }

      await stateManager.saveState({
        deploymentId,
        targetOrg,
        timestamp: new Date().toISOString(),
        totalWaves: orderedWaves.length,
        completedWaves: Array.from({ length: wave.number }, (_, i) => i + 1),
        currentWave: wave.number,
        metadata: {
          lastKnownStatus: result.status,
          testsRun: result.testsRun,
          testFailures: result.testFailures,
          testLevel: testPlan.testLevel,
          ...this.buildAIMetadata(aiContext),
        },
      });

      log(`✅ Wave ${wave.number} deployed successfully`);
    });

    await stateManager.clearState();
    log('\n✅ All waves deployed successfully!');
  }

  private buildAIMetadata(aiContext?: DeploymentAIContext): Record<string, unknown> {
    if (aiContext === undefined) {
      return {};
    }

    return {
      aiProvider: aiContext.provider,
      aiModel: aiContext.model,
      aiFallback: aiContext.fallback,
      aiAdjustments: aiContext.aiAdjustments,
      aiUnknownTypes: aiContext.unknownTypes,
      aiInferenceFallback: aiContext.inferenceFallback,
      aiInferredDependencies: aiContext.inferredDependencies,
    };
  }

  private async forEachSequentially<T>(
    items: readonly T[],
    callback: (item: T, index: number) => Promise<void>
  ): Promise<void> {
    let chain = Promise.resolve();
    items.forEach((item, index) => {
      chain = chain.then(async () => callback(item, index));
    });
    await chain;
  }
}
