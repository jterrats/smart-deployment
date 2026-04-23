/**
 * smart-deployment:start command
 * Main deployment command that orchestrates the entire workflow
 *
 * @ac US-046-AC-1: Analyzes metadata automatically
 * @ac US-046-AC-2: Generates deployment waves
 * @ac US-046-AC-3: Executes deployment sequentially
 * @ac US-046-AC-4: Supports --target-org flag
 * @ac US-046-AC-5: Supports --dry-run flag
 * @ac US-046-AC-6: Supports --validate-only flag
 * @ac US-046-AC-7: Supports --skip-tests flag
 * @ac US-046-AC-8: Shows progress bar
 * @ac US-046-AC-9: Generates deployment report
 * @ac US-046-AC-10: Handles failures gracefully
 *
 * @issue #46
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { type Interfaces } from '@oclif/core';
import { Messages } from '@salesforce/core';
import { Flags, SfCommand, optionalOrgFlagWithDeprecations } from '@salesforce/sf-plugins-core';
import { getLogger } from '../utils/logger.js';
import { CycleRemediationPlanner, type CycleRemediationSourceEdit } from '../dependencies/cycle-remediation-planner.js';
import {
  CycleSourceEditor,
  type CycleSourceEditRequest,
  type CycleSourceEditRecord,
} from '../deployment/cycle-source-editor.js';
import { SfCliIntegration, type TestLevel } from '../deployment/sf-cli-integration.js';
import { MetadataScannerService } from '../services/metadata-scanner-service.js';
import { WaveBuilder } from '../waves/wave-builder.js';
import { AIEnhancedPriorityWaveGenerator } from '../waves/priority-wave-generator-ai.js';
import { getWavesInExecutionOrder } from '../waves/wave-executor.js';
import { StateManager } from '../deployment/state-manager.js';
import { DeploymentTracker } from '../deployment/deployment-tracker.js';
import { AgentforcePriorityService } from '../ai/agentforce-priority-service.js';
import { DependencyInferenceService } from '../ai/dependency-inference-service.js';
import { DependencyGraphBuilder } from '../dependencies/dependency-graph-builder.js';
import type { NodeId } from '../types/dependency.js';
import type { MetadataComponent, MetadataType } from '../types/metadata.js';
import type { Wave } from '../waves/wave-builder.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('smart-deployment', 'start');
const logger = getLogger('StartCommand');

/**
 * @ac US-046-AC-1: Analyzes metadata automatically
 * @ac US-046-AC-2: Generates deployment waves
 * @ac US-046-AC-3: Executes deployment sequentially
 */
type StartResult = {
  success: boolean;
  waves: number;
  ai?: {
    enabled: boolean;
    provider?: string;
    model?: string;
    aiAdjustments?: number;
    unknownTypes?: string[];
    fallback?: boolean;
    inferredDependencies?: number;
    inferenceFallback?: boolean;
  };
};

export default class Start extends SfCommand<StartResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  /**
   * @ac US-046-AC-4: Supports --target-org flag
   * @ac US-046-AC-5: Supports --dry-run flag
   * @ac US-046-AC-6: Supports --validate-only flag
   * @ac US-046-AC-7: Supports --skip-tests flag
   * @ac US-057-AC-1: Send component list to Agentforce
   */
  public static readonly flags: Interfaces.FlagInput = {
    'target-org': optionalOrgFlagWithDeprecations,
    'dry-run': Flags.boolean({
      summary: messages.getMessage('flags.dry-run.summary'),
      char: 'd',
      default: false,
    }),
    'validate-only': Flags.boolean({
      summary: messages.getMessage('flags.validate-only.summary'),
      char: 'v',
      default: false,
    }),
    'skip-tests': Flags.boolean({
      summary: messages.getMessage('flags.skip-tests.summary'),
      char: 's',
      default: false,
    }),
    'source-path': Flags.string({
      summary: messages.getMessage('flags.source-path.summary'),
      description: messages.getMessage('flags.source-path.description'),
    }),
    'allow-cycle-remediation': Flags.boolean({
      summary: messages.getMessage('flags.allow-cycle-remediation.summary'),
      description: messages.getMessage('flags.allow-cycle-remediation.description'),
      default: false,
    }),
    'use-ai': Flags.boolean({
      summary: messages.getMessage('flags.use-ai.summary'),
      description: messages.getMessage('flags.use-ai.description'),
      default: false,
    }),
    'org-type': Flags.string({
      summary: messages.getMessage('flags.org-type.summary'),
      description: messages.getMessage('flags.org-type.description'),
      options: ['Production', 'Sandbox', 'Developer'],
    }),
    industry: Flags.string({
      summary: messages.getMessage('flags.industry.summary'),
      description: messages.getMessage('flags.industry.description'),
    }),
  };

  /**
   * @ac US-046-AC-8: Shows progress bar
   * @ac US-046-AC-9: Generates deployment report
   * @ac US-046-AC-10: Handles failures gracefully
   */
  public async run(): Promise<StartResult> {
    const { flags } = await this.parse(Start);
    const sourcePath = typeof flags['source-path'] === 'string' ? flags['source-path'] : undefined;

    try {
      logger.info('Starting smart deployment', { flags });

      // AC-1: Analyze metadata
      this.log('📊 Analyzing metadata...');
      const metadataCount = await this.analyzeMetadata(sourcePath);
      this.log(`✅ Found ${metadataCount} metadata components`);

      // AC-2: Generate waves
      this.log('🌊 Generating deployment waves...');
      const deploymentContext = await this.buildDeploymentContext(flags, sourcePath);
      const waves = deploymentContext.orderedWaves.length;
      this.log(`✅ Generated ${waves} waves`);

      // AC US-057-AC-6: Report AI decisions
      if (flags['use-ai']) {
        this.log('🤖 AI-enhanced prioritization enabled');
      }

      // AC-3: Execute deployment
      if (!flags['dry-run']) {
        this.log('🚀 Executing deployment...');
        await this.executeDeployment(flags, sourcePath);
      } else {
        this.log('🔍 Dry-run mode: skipping actual deployment');
      }

      // AC-9: Generate report
      this.log('📄 Generating deployment report...');
      this.generateReport(waves);

      return { success: true, waves, ai: deploymentContext.aiContext };
    } catch (error) {
      // AC-10: Handle failures gracefully
      logger.error('Deployment failed', { error });
      this.error(`Deployment failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async analyzeMetadata(sourcePath?: string): Promise<number> {
    const scanner = new MetadataScannerService();
    const result = await scanner.scan({ sourcePath });

    if (result.errors.length > 0) {
      logger.error('Metadata scanning completed with errors', { errors: result.errors });
      result.errors.forEach((err) => this.warn(err));
    }
    if (result.warnings.length > 0) {
      logger.warn('Metadata scanning completed with warnings', { warnings: result.warnings });
      result.warnings.forEach((warn) => this.warn(warn));
    }

    return result.components.length;
  }

  private async executeDeployment(flags: Record<string, unknown>, sourcePath?: string): Promise<void> {
    const dryRun = flags['dry-run'] as boolean;
    const validateOnly = flags['validate-only'] as boolean;
    const allowCycleRemediation = flags['allow-cycle-remediation'] as boolean;
    const skipTests = flags['skip-tests'] as boolean;
    const targetOrg = this.getTargetOrgIdentifier(flags['target-org']);

    if (dryRun || validateOnly) {
      this.log('🔍 Dry-run/Validate mode: skipping actual deployment');
      return;
    }

    const deploymentContext = await this.buildDeploymentContext(flags, sourcePath);
    const { scanResult, orderedWaves } = deploymentContext;

    const planner = new CycleRemediationPlanner(scanResult.dependencyResult.graph, {
      components: scanResult.dependencyResult.components,
    });
    const remediationPlan = planner.createPlan();

    if (remediationPlan.cycles.length > 0) {
      this.log(`♻️ Detected ${remediationPlan.cycles.length} circular dependency cycle(s).`);

      if (!allowCycleRemediation) {
        this.error(
          'Circular dependencies detected. Re-run with --allow-cycle-remediation for supported ApexClass cycles or resolve them manually.'
        );
      }

      if (!remediationPlan.supported) {
        this.error(
          [
            'Cycle remediation was requested, but one or more cycles are not safely supported.',
            ...remediationPlan.warnings,
          ].join('\n')
        );
      }
    }

    // Initialize deployment services
    const sfCli = new SfCliIntegration();
    const stateManager = new StateManager({ baseDir: sourcePath ?? process.cwd() });
    const tracker = new DeploymentTracker();
    const deploymentId = `deployment-${Date.now()}`;

    if (remediationPlan.cycles.length > 0) {
      if (!targetOrg) {
        this.error('The --target-org flag is required for cycle remediation deployments.');
      }

      await this.executeCycleRemediationDeployment({
        deploymentId,
        targetOrg,
        sourcePath,
        stateManager,
        tracker,
        plan: remediationPlan,
        sfCli,
        skipTests,
        componentMap: scanResult.dependencyResult.components,
      });
      return;
    }

    if (!targetOrg) {
      this.error('The --target-org flag is required for real deployments.');
    }

    // Execute waves sequentially
    await this.forEachSequentially(orderedWaves, async (wave) => {
      this.log(`\n🌊 Deploying Wave ${wave.number}/${orderedWaves.length} (${wave.components.length} components)...`);

      try {
        // Generate manifest for this wave
        const manifestPath = await this.generateWaveManifest({
          baseDir: sourcePath ?? process.cwd(),
          waveNumber: wave.number,
          components: wave.components,
          componentMap: scanResult.dependencyResult.components,
        });

        // Execute deployment
        tracker.startTracking(deploymentId, wave.number, orderedWaves.length);
        const result = await sfCli.deploy({
          manifestPath,
          targetOrg,
          testLevel: this.resolveTestLevel(skipTests),
        });
        tracker.updateProgress(deploymentId, result);

        if (!result.success) {
          const aiMetadata =
            deploymentContext.aiContext === undefined
              ? {}
              : {
                  aiProvider: deploymentContext.aiContext.provider,
                  aiModel: deploymentContext.aiContext.model,
                  aiFallback: deploymentContext.aiContext.fallback,
                  aiAdjustments: deploymentContext.aiContext.aiAdjustments,
                  aiUnknownTypes: deploymentContext.aiContext.unknownTypes,
                  aiInferenceFallback: deploymentContext.aiContext.inferenceFallback,
                  aiInferredDependencies: deploymentContext.aiContext.inferredDependencies,
                };
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
              testLevel: this.resolveTestLevel(skipTests),
              ...aiMetadata,
            },
          });
          this.error(`Wave ${wave.number} failed: ${result.output}`);
        }

        // Save state after each wave
        const aiMetadata =
          deploymentContext.aiContext === undefined
            ? {}
            : {
                aiProvider: deploymentContext.aiContext.provider,
                aiModel: deploymentContext.aiContext.model,
                aiFallback: deploymentContext.aiContext.fallback,
                aiAdjustments: deploymentContext.aiContext.aiAdjustments,
                aiUnknownTypes: deploymentContext.aiContext.unknownTypes,
                aiInferenceFallback: deploymentContext.aiContext.inferenceFallback,
                aiInferredDependencies: deploymentContext.aiContext.inferredDependencies,
              };
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
            testLevel: this.resolveTestLevel(skipTests),
            ...aiMetadata,
          },
        });

        this.log(`✅ Wave ${wave.number} deployed successfully`);
      } catch (error) {
        logger.error('Wave deployment failed', { wave: wave.number, error });
        this.error(`Wave ${wave.number} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // Clear state on success
    await stateManager.clearState();
    this.log('\n✅ All waves deployed successfully!');
  }

  private async buildDeploymentContext(
    flags: Record<string, unknown>,
    sourcePath?: string
  ): Promise<{
    scanResult: Awaited<ReturnType<MetadataScannerService['scan']>>;
    orderedWaves: Wave[];
    aiContext?: {
      enabled: boolean;
      provider?: string;
      model?: string;
      aiAdjustments?: number;
      unknownTypes?: string[];
      fallback?: boolean;
      inferredDependencies?: number;
      inferenceFallback?: boolean;
    };
  }> {
    const scanner = new MetadataScannerService();
    const scanResult = await scanner.scan({ sourcePath });

    if (scanResult.errors.length > 0) {
      logger.error('Metadata scanning completed with errors', { errors: scanResult.errors });
      scanResult.errors.forEach((err) => this.warn(err));
    }
    if (scanResult.warnings.length > 0) {
      logger.warn('Metadata scanning completed with warnings', { warnings: scanResult.warnings });
      scanResult.warnings.forEach((warn) => this.warn(warn));
    }

    let dependencyResult = scanResult.dependencyResult;
    let inferredDependencies = 0;
    let inferenceFallback = false;

    if (flags['use-ai']) {
      const inferenceService = new DependencyInferenceService({
        baseDir: sourcePath ?? process.cwd(),
      });
      const inferenceResult = await inferenceService.inferDependencies(
        scanResult.components,
        scanResult.dependencyResult.graph
      );

      inferredDependencies = inferenceResult.highConfidenceCount;
      inferenceFallback = inferenceResult.fallbackToStatic;

      if (inferenceResult.dependencies.length > 0) {
        const enrichedComponents = this.applyInferredDependencies(scanResult.components, inferenceResult.dependencies);
        const graphBuilder = new DependencyGraphBuilder();
        graphBuilder.addComponents(enrichedComponents);
        scanResult.components = enrichedComponents;
        dependencyResult = graphBuilder.build();
        scanResult.dependencyResult = dependencyResult;
      }
    }

    const waveBuilder = new WaveBuilder();
    const waveResult = waveBuilder.generateWaves(dependencyResult.graph);
    let orderedWaves = getWavesInExecutionOrder(waveResult);
    let aiContext:
      | {
          enabled: boolean;
          provider?: string;
          model?: string;
          aiAdjustments?: number;
          unknownTypes?: string[];
          fallback?: boolean;
          inferredDependencies?: number;
          inferenceFallback?: boolean;
        }
      | undefined;

    if (flags['use-ai']) {
      this.log('  🤖 Using AI priority weighting for wave ordering...');
      const priorityService = new AgentforcePriorityService({
        baseDir: sourcePath ?? process.cwd(),
      });
      const aiWaveGenerator = new AIEnhancedPriorityWaveGenerator({
        agentforceService: priorityService,
        orgType: typeof flags['org-type'] === 'string' ? flags['org-type'] : undefined,
        industry: typeof flags.industry === 'string' ? flags.industry : undefined,
      });
      orderedWaves = await aiWaveGenerator.applyPriorityWavesAsync(
        orderedWaves,
        scanResult.dependencyResult.components
      );

      const unknownTypesWarning = aiWaveGenerator.getUnknownTypesWarning();
      if (unknownTypesWarning) {
        this.warn(unknownTypesWarning);
      }

      const aiReport = aiWaveGenerator.getAIReport();
      if (aiReport) {
        this.log(aiReport);
      }

      const aiStats = aiWaveGenerator.getAIStats();
      const providerConfig = priorityService.getProviderConfig();
      aiContext = {
        enabled: true,
        provider: providerConfig.provider,
        model: providerConfig.model,
        aiAdjustments: aiStats?.aiAdjustments ?? 0,
        unknownTypes: aiStats?.unknownTypes ?? [],
        fallback: aiStats?.usedFallback ?? false,
        inferredDependencies,
        inferenceFallback,
      };
    }

    return { scanResult, orderedWaves, aiContext };
  }

  private generateReport(waves: number): void {
    this.log('\n📊 Deployment Report:');
    this.log(`   - Waves: ${waves}`);
    this.log('   - Status: Success');
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

  private async executeCycleRemediationDeployment(params: {
    deploymentId: string;
    targetOrg: string;
    sourcePath?: string;
    stateManager: StateManager;
    tracker: DeploymentTracker;
    plan: ReturnType<CycleRemediationPlanner['createPlan']>;
    sfCli: SfCliIntegration;
    skipTests: boolean;
    componentMap: ReadonlyMap<NodeId, MetadataComponent>;
  }): Promise<void> {
    const { deploymentId, targetOrg, sourcePath, stateManager, tracker, plan, sfCli, skipTests, componentMap } = params;
    const editor = new CycleSourceEditor();
    const startedAt = new Date().toISOString();
    const editRecords: CycleSourceEditRecord[] = [];
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
      this.log('🩹 Applying conservative cycle remediation edits...');
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
      this.log('♻️ Phase 1/2: deploying temporarily cycle-broken metadata...');
      const phaseOneManifestPath = await this.generateWaveManifest({
        baseDir: sourcePath ?? process.cwd(),
        waveNumber: 1,
        components: phaseOneComponents,
        componentMap,
      });
      const phaseOneResult = await sfCli.deploy({
        manifestPath: phaseOneManifestPath,
        targetOrg,
        testLevel: this.resolveTestLevel(skipTests),
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
            testLevel: this.resolveTestLevel(skipTests),
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
          testLevel: this.resolveTestLevel(skipTests),
        },
      });

      this.log('♻️ Restoring original references before phase 2...');
      await this.restoreCycleEdits(editor, editRecords);
      editsRestored = true;

      tracker.startTracking(deploymentId, 2, 2);
      this.log('♻️ Phase 2/2: redeploying restored metadata...');
      const phaseTwoManifestPath = await this.generateWaveManifest({
        baseDir: sourcePath ?? process.cwd(),
        waveNumber: 2,
        components: phaseTwoComponents,
        componentMap,
      });
      const phaseTwoResult = await sfCli.deploy({
        manifestPath: phaseTwoManifestPath,
        targetOrg,
        testLevel: this.resolveTestLevel(skipTests),
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
            testLevel: this.resolveTestLevel(skipTests),
          },
        });
        failureStateSaved = true;
        throw new Error(`Cycle remediation phase 2 failed: ${phaseTwoResult.output}`);
      }

      await stateManager.clearState();
      this.log('\n✅ Cycle remediation deployment completed successfully!');
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

  private applyInferredDependencies(
    components: MetadataComponent[],
    inferredDependencies: Array<{
      from: string;
      to: string;
    }>
  ): MetadataComponent[] {
    const clonedComponents = components.map((component) => ({
      ...component,
      dependencies: new Set(component.dependencies),
      dependents: new Set(component.dependents),
    }));
    const nodeIdsByName = new Map<string, NodeId>();

    for (const component of clonedComponents) {
      nodeIdsByName.set(component.name, `${component.type}:${component.name}`);
    }

    const componentsByNodeId = new Map<NodeId, MetadataComponent>();
    for (const component of clonedComponents) {
      const nodeId = `${component.type}:${component.name}`;
      componentsByNodeId.set(nodeId, component);
    }

    for (const inferred of inferredDependencies) {
      const fromNodeId = nodeIdsByName.get(inferred.from);
      const toNodeId = nodeIdsByName.get(inferred.to);

      if (!fromNodeId || !toNodeId) {
        continue;
      }

      componentsByNodeId.get(fromNodeId)?.dependencies.add(toNodeId);
      componentsByNodeId.get(toNodeId)?.dependents.add(fromNodeId);
    }

    return clonedComponents;
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

  private resolveTestLevel(skipTests: boolean): TestLevel {
    return skipTests ? 'NoTestRun' : 'RunLocalTests';
  }

  private getTargetOrgIdentifier(value: unknown): string | undefined {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }

    if (typeof value === 'object' && value !== null && 'getUsername' in value) {
      const getUsername = (value as { getUsername: () => string }).getUsername;
      return typeof getUsername === 'function' ? getUsername.call(value) : undefined;
    }

    return undefined;
  }

  private async generateWaveManifest(params: {
    baseDir: string;
    waveNumber: number;
    components: NodeId[];
    componentMap: ReadonlyMap<NodeId, MetadataComponent>;
  }): Promise<string> {
    const manifestDir = path.join(params.baseDir, '.smart-deployment', 'manifests');
    await mkdir(manifestDir, { recursive: true });

    const grouped = new Map<MetadataType, Set<string>>();
    for (const nodeId of params.components) {
      const component = params.componentMap.get(nodeId);
      if (!component) {
        continue;
      }

      if (!grouped.has(component.type)) {
        grouped.set(component.type, new Set());
      }
      grouped.get(component.type)!.add(component.name);
    }

    const typeBlocks = [...grouped.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([type, members]) => {
        const memberLines = [...members]
          .sort((left, right) => left.localeCompare(right))
          .map((member) => `        <members>${member}</members>`)
          .join('\n');

        return ['    <types>', memberLines, `        <name>${type}</name>`, '    </types>'].join('\n');
      })
      .join('\n');

    const content = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Package xmlns="http://soap.sforce.com/2006/04/metadata">',
      typeBlocks,
      '    <version>61.0</version>',
      '</Package>',
      '',
    ].join('\n');

    const manifestPath = path.join(manifestDir, `wave-${String(params.waveNumber).padStart(3, '0')}.xml`);
    await writeFile(manifestPath, content, 'utf8');
    return manifestPath;
  }
}
