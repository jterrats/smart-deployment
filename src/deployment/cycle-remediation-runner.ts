import { readFile } from 'node:fs/promises';
import type { CycleRemediationPlanner, CycleRemediationSourceEdit } from '../dependencies/cycle-remediation-planner.js';
import type { NodeId } from '../types/dependency.js';
import type { MetadataComponent, MetadataType } from '../types/metadata.js';
import type { Wave } from '../waves/wave-builder.js';
import { CycleSourceEditor, type CycleSourceEditRequest, type CycleSourceEditRecord } from './cycle-source-editor.js';
import { StateManager } from './state-manager.js';
import { DeploymentTracker } from './deployment-tracker.js';
import { SfCliIntegration } from './sf-cli-integration.js';
import { TestPlanService } from './test-plan-service.js';
import { WaveManifestService } from './wave-manifest-service.js';

export type CycleRemediationRunnerParams = {
  deploymentId: string;
  targetOrg: string;
  sourcePath?: string;
  stateManager: StateManager;
  tracker: DeploymentTracker;
  plan: ReturnType<CycleRemediationPlanner['createPlan']>;
  sfCli: SfCliIntegration;
  skipTests: boolean;
  componentMap: ReadonlyMap<NodeId, MetadataComponent>;
  log: (message: string) => void;
};

type CycleRemediationRunnerDependencies = {
  testPlanService?: TestPlanService;
  waveManifestService?: WaveManifestService;
};

export class CycleRemediationRunner {
  private readonly testPlanService: TestPlanService;
  private readonly waveManifestService: WaveManifestService;

  public constructor(dependencies: CycleRemediationRunnerDependencies = {}) {
    this.testPlanService = dependencies.testPlanService ?? new TestPlanService();
    this.waveManifestService = dependencies.waveManifestService ?? new WaveManifestService();
  }

  public async execute(params: CycleRemediationRunnerParams): Promise<void> {
    const { deploymentId, targetOrg, sourcePath, stateManager, tracker, plan, sfCli, skipTests, componentMap, log } =
      params;
    const editor = new CycleSourceEditor();
    const startedAt = new Date().toISOString();
    const editRecords: CycleSourceEditRecord[] = [];
    const testExecutor = this.testPlanService.createExecutor([...componentMap.values()]);
    const cycleId = plan.cycles.map((cycle) => cycle.id).join('||');
    const phaseOneComponents = [
      ...new Set(
        plan.cycles.flatMap((cycle) => cycle.deployPhases.find((phase) => phase.phase === 1)?.components ?? [])
      ),
    ];
    const phaseTwoComponents = [
      ...new Set(
        plan.cycles.flatMap((cycle) => cycle.deployPhases.find((phase) => phase.phase === 2)?.components ?? [])
      ),
    ];
    let editsRestored = false;
    let failureStateSaved = false;

    try {
      log('🩹 Applying conservative cycle remediation edits...');
      await this.forEachSequentially(plan.cycles, async (cycle) => {
        await this.forEachSequentially(cycle.edits, async (edit) => {
          const request = await this.createCycleEditRequest(edit);
          editRecords.push(await editor.applyEdit(request));
        });
      });

      await stateManager.saveState({
        deploymentId,
        targetOrg,
        timestamp: startedAt,
        totalWaves: 2,
        completedWaves: [],
        currentWave: 1,
        cycleRemediation: {
          cycleId,
          strategy: 'comment-reference',
          activePhase: 1,
          startedAt,
          completedPhases: [],
          editRecords,
        },
      });

      tracker.startTracking(deploymentId, 1, 2);
      log('♻️ Phase 1/2: deploying temporarily cycle-broken metadata...');
      const phaseOneManifestPath = await this.waveManifestService.generateManifest({
        baseDir: sourcePath ?? process.cwd(),
        waveNumber: 1,
        components: phaseOneComponents,
        componentMap,
      });
      const phaseOneTestPlan = this.testPlanService.resolveTestPlan(
        this.buildSyntheticWave(1, phaseOneComponents, componentMap),
        skipTests,
        testExecutor
      );
      const phaseOneResult = await sfCli.deploy({
        manifestPath: phaseOneManifestPath,
        targetOrg,
        testLevel: phaseOneTestPlan.testLevel,
        tests: phaseOneTestPlan.testLevel === 'RunSpecifiedTests' ? phaseOneTestPlan.tests : undefined,
      });

      if (!phaseOneResult.success) {
        await stateManager.saveState({
          deploymentId,
          targetOrg,
          timestamp: new Date().toISOString(),
          totalWaves: 2,
          completedWaves: [],
          currentWave: 1,
          failedWave: {
            waveNumber: 1,
            error: phaseOneResult.output,
            timestamp: new Date().toISOString(),
          },
          cycleRemediation: {
            cycleId,
            strategy: 'comment-reference',
            activePhase: 1,
            startedAt,
            completedPhases: [],
            editRecords,
          },
          metadata: {
            lastKnownStatus: phaseOneResult.status,
            testsRun: phaseOneResult.testsRun,
            testFailures: phaseOneResult.testFailures,
            testLevel: phaseOneTestPlan.testLevel,
          },
        });
        failureStateSaved = true;
        throw new Error(`Cycle remediation phase 1 failed: ${phaseOneResult.output}`);
      }

      await stateManager.saveState({
        deploymentId,
        targetOrg,
        timestamp: new Date().toISOString(),
        totalWaves: 2,
        completedWaves: [1],
        currentWave: 2,
        cycleRemediation: {
          cycleId,
          strategy: 'comment-reference',
          activePhase: 2,
          startedAt,
          completedPhases: [1],
          editRecords,
        },
        metadata: {
          lastKnownStatus: phaseOneResult.status,
          testsRun: phaseOneResult.testsRun,
          testFailures: phaseOneResult.testFailures,
          testLevel: phaseOneTestPlan.testLevel,
        },
      });

      log('♻️ Restoring original references before phase 2...');
      await this.restoreCycleEdits(editor, editRecords);
      editsRestored = true;

      tracker.startTracking(deploymentId, 2, 2);
      log('♻️ Phase 2/2: redeploying restored metadata...');
      const phaseTwoManifestPath = await this.waveManifestService.generateManifest({
        baseDir: sourcePath ?? process.cwd(),
        waveNumber: 2,
        components: phaseTwoComponents,
        componentMap,
      });
      const phaseTwoTestPlan = this.testPlanService.resolveTestPlan(
        this.buildSyntheticWave(2, phaseTwoComponents, componentMap),
        skipTests,
        testExecutor
      );
      const phaseTwoResult = await sfCli.deploy({
        manifestPath: phaseTwoManifestPath,
        targetOrg,
        testLevel: phaseTwoTestPlan.testLevel,
        tests: phaseTwoTestPlan.testLevel === 'RunSpecifiedTests' ? phaseTwoTestPlan.tests : undefined,
      });

      if (!phaseTwoResult.success) {
        await stateManager.saveState({
          deploymentId,
          targetOrg,
          timestamp: new Date().toISOString(),
          totalWaves: 2,
          completedWaves: [1],
          currentWave: 2,
          failedWave: {
            waveNumber: 2,
            error: phaseTwoResult.output,
            timestamp: new Date().toISOString(),
          },
          cycleRemediation: {
            cycleId,
            strategy: 'comment-reference',
            activePhase: 2,
            startedAt,
            completedPhases: [1],
            editRecords,
          },
          metadata: {
            lastKnownStatus: phaseTwoResult.status,
            testsRun: phaseTwoResult.testsRun,
            testFailures: phaseTwoResult.testFailures,
            testLevel: phaseTwoTestPlan.testLevel,
          },
        });
        failureStateSaved = true;
        throw new Error(`Cycle remediation phase 2 failed: ${phaseTwoResult.output}`);
      }

      await stateManager.clearState();
      log('\n✅ Cycle remediation deployment completed successfully!');
    } catch (error) {
      if (!editsRestored) {
        await this.restoreCycleEdits(editor, editRecords, true);
      }

      if (!failureStateSaved) {
        await stateManager.saveState({
          deploymentId,
          targetOrg,
          timestamp: new Date().toISOString(),
          totalWaves: 2,
          completedWaves: [],
          currentWave: 1,
          failedWave: {
            waveNumber: 1,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          },
          cycleRemediation: {
            cycleId,
            strategy: 'comment-reference',
            activePhase: 1,
            startedAt,
            completedPhases: [],
            editRecords,
          },
        });
      }

      throw error;
    }
  }

  private async createCycleEditRequest(edit: CycleRemediationSourceEdit): Promise<CycleSourceEditRequest> {
    if (edit.filePath === undefined) {
      throw new Error(`Cycle remediation edit for ${edit.nodeId} is missing a file path.`);
    }

    const content = await readFile(edit.filePath, 'utf8');
    const dependencyName = edit.targetDependency.includes(':')
      ? edit.targetDependency.split(':').pop() ?? edit.targetDependency
      : edit.targetDependency;
    const candidateLines = content.split('\n').filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('//') && line.includes(dependencyName);
    });

    if (candidateLines.length !== 1) {
      throw new Error(
        `Cycle remediation for ${edit.nodeId} requires exactly one candidate source line containing ${dependencyName}; found ${candidateLines.length}.`
      );
    }

    return {
      filePath: edit.filePath,
      targetDescription: edit.targetDescription,
      targetDependency: edit.targetDependency,
      sourceSnippet: candidateLines[0],
    };
  }

  private async restoreCycleEdits(
    editor: CycleSourceEditor,
    editRecords: CycleSourceEditRecord[],
    bestEffort = false
  ): Promise<void> {
    await this.forEachSequentially([...editRecords].reverse(), async (record) => {
      const result = await editor.restoreEdit(record);
      if (!result.restored && result.reason !== 'backup-missing' && !bestEffort) {
        throw new Error(
          `Failed to restore cycle remediation edit for ${record.filePath}: ${result.reason ?? 'unknown'}.`
        );
      }
    });
  }

  private buildSyntheticWave(
    waveNumber: number,
    components: NodeId[],
    componentMap: ReadonlyMap<NodeId, MetadataComponent>
  ): Wave {
    return {
      number: waveNumber,
      components,
      metadata: {
        componentCount: components.length,
        types: this.collectWaveTypes(components, componentMap),
        maxDepth: 0,
        hasCircularDeps: false,
        estimatedTime: 0,
      },
    };
  }

  private collectWaveTypes(components: NodeId[], componentMap: ReadonlyMap<NodeId, MetadataComponent>): MetadataType[] {
    const types = new Set<MetadataType>();

    for (const componentId of components) {
      const component = componentMap.get(componentId);
      if (component) {
        types.add(component.type);
      }
    }

    return Array.from(types);
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
