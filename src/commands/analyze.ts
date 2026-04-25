/**
 * smart-deployment:analyze command - US-047
 *
 * @ac US-047-AC-1: Scans project metadata
 * @ac US-047-AC-2: Generates dependency graph
 * @ac US-047-AC-3: Generates deployment waves
 * @ac US-047-AC-4: Outputs analysis report (JSON/HTML)
 * @ac US-047-AC-5: Supports --output flag
 * @ac US-047-AC-6: Supports --format flag
 * @ac US-047-AC-7: Shows statistics
 * @ac US-047-AC-8: Highlights issues (cycles, etc.)
 * @ac US-047-AC-9: No deployment execution
 * @issue #47
 */

import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { getLogger } from '../utils/logger.js';
import { AnalysisReporter } from '../analysis/analysis-reporter.js';
import { DependencyInferenceService } from '../ai/dependency-inference-service.js';
import { DeploymentPlanManager } from '../utils/deployment-plan-manager.js';
import { MetadataScannerService } from '../services/metadata-scanner-service.js';
import { WaveBuilder } from '../waves/wave-builder.js';
import { AIEnhancedPriorityWaveGenerator } from '../waves/priority-wave-generator-ai.js';
import { AgentforcePriorityService } from '../ai/agentforce-priority-service.js';
import { DependencyGraphBuilder } from '../dependencies/dependency-graph-builder.js';
import type { PriorityOverride } from '../types/deployment-plan.js';
import type { ScanResult } from '../services/metadata-scanner-service.js';
import type { WaveResult } from '../waves/wave-builder.js';
import type { MetadataComponent } from '../types/metadata.js';
import type { NodeId } from '../types/dependency.js';

const logger = getLogger('AnalyzeCommand');
Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@jterrats/smart-deployment', 'analyze');

type AnalyzeResult = {
  success: boolean;
  components: number;
  dependencies: number;
  planSaved?: boolean;
  ai?: {
    enabled: boolean;
    provider?: string;
    model?: string;
    aiAdjustments?: number;
    unknownTypes?: string[];
    inferredDependencies?: number;
    inferenceFallback?: boolean;
  };
};

export default class Analyze extends SfCommand<AnalyzeResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {
    'source-path': Flags.string({ summary: messages.getMessage('flags.source-path.summary') }),
    'save-plan': Flags.boolean({
      summary: messages.getMessage('flags.save-plan.summary'),
      default: false,
    }),
    'plan-path': Flags.string({ summary: messages.getMessage('flags.plan-path.summary') }),
    'use-ai': Flags.boolean({
      summary: messages.getMessage('flags.use-ai.summary'),
      default: false,
    }),
    'org-type': Flags.string({
      summary: messages.getMessage('flags.org-type.summary'),
      options: ['Production', 'Sandbox', 'Developer'],
    }),
    industry: Flags.string({ summary: messages.getMessage('flags.industry.summary') }),
    output: Flags.string({ summary: messages.getMessage('flags.output.summary'), char: 'r' }),
    format: Flags.string({ summary: messages.getMessage('flags.format.summary'), char: 'f', default: 'json' }),
  };

  public async run(): Promise<AnalyzeResult> {
    const { flags } = await this.parse(Analyze);
    const sourcePath = typeof flags['source-path'] === 'string' ? flags['source-path'] : undefined;

    try {
      logger.info('Analyzing metadata', {
        sourcePath,
        savePlan: flags['save-plan'],
        useAI: flags['use-ai'],
      });

      this.log('📊 Analyzing metadata...');

      const analysisContext = await this.buildAnalysisContext(flags, sourcePath);
      const { scanResult, waveResult, priorityOverrides, aiContext } = analysisContext;

      const components = scanResult.components.length;
      const dependencies = scanResult.dependencyResult.stats.totalDependencies;
      const cycles = scanResult.dependencyResult.circularDependencies.length;

      this.log(`✅ Found ${components} components with ${dependencies} dependencies`);

      if (cycles > 0) {
        this.log(`⚠️  Warning: ${cycles} circular dependency cycle(s) detected`);
      }

      // Generate waves
      this.log('');
      this.log('🌊 Generating deployment waves...');

      this.log(`✅ Generated ${waveResult.waves.length} deployment wave(s)`);
      this.log(`   Total components: ${waveResult.totalComponents}`);
      if (waveResult.unplacedComponents.length > 0) {
        this.log(`   ⚠️  ${waveResult.unplacedComponents.length} component(s) couldn't be placed (circular deps)`);
      }

      let planSaved = false;

      // Generate and save plan if requested
      if (flags['save-plan']) {
        this.log('');
        this.log('📋 Generating deployment plan...');

        // Convert waves to plan format
        const planWaves = waveResult.waves.map((wave) => ({
          number: wave.number,
          components: wave.components,
          metadata: {
            componentCount: wave.metadata.componentCount,
            types: wave.metadata.types,
            maxDepth: wave.metadata.maxDepth,
            hasCircularDeps: wave.metadata.hasCircularDeps,
            estimatedTime: wave.metadata.estimatedTime,
          },
        }));

        // Extract priorities from components (if any)
        const priorities: Record<string, PriorityOverride> = { ...priorityOverrides };
        for (const component of scanResult.components) {
          if (component.priorityBoost > 0) {
            const nodeId = `${component.type}:${component.name}`;
            priorities[nodeId] = {
              priority: component.priorityBoost,
              source: 'static',
              appliedAt: new Date().toISOString(),
            };
          }
        }

        const plan = DeploymentPlanManager.createPlan(planWaves, priorities, {
          aiEnabled: flags['use-ai'],
          aiModel: aiContext?.model,
          orgType: flags['org-type'],
          industry: flags.industry,
          generatedBy: 'smart-deployment CLI',
        });

        await DeploymentPlanManager.savePlan(plan, flags['plan-path']);

        const planPath = flags['plan-path'] ?? '.smart-deployment/deployment-plan.json';
        this.log(`✅ Deployment plan saved to: ${planPath}`);
        planSaved = true;
        this.log('');
        this.log('💡 Next steps:');
        this.log('   1. Review the plan in your PR');
        this.log('   2. Commit the plan to your repo');
        this.log(`   3. Use ${planPath} as a reviewed deployment artifact in CI/CD`);
      }

      // Output report if requested
      if (flags.output) {
        const format = flags.format === 'html' ? 'html' : 'json';
        const reporter = new AnalysisReporter();
        const report = reporter.createReport(scanResult, waveResult, aiContext);

        await reporter.saveReport(report, flags.output, format);
        this.log(`📄 Report saved to: ${flags.output} (format: ${format})`);
      }

      return { success: true, components, dependencies, planSaved, ai: aiContext };
    } catch (error) {
      logger.error('Analysis failed', { error });
      this.error(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async buildAnalysisContext(
    flags: Record<string, unknown>,
    sourcePath?: string
  ): Promise<{
    scanResult: ScanResult;
    waveResult: WaveResult;
    priorityOverrides: Record<string, PriorityOverride>;
    aiContext?: {
      enabled: boolean;
      provider?: string;
      model?: string;
      aiAdjustments?: number;
      unknownTypes?: string[];
      inferredDependencies?: number;
      inferenceFallback?: boolean;
    };
  }> {
    const scanner = new MetadataScannerService();
    const scanResult = await scanner.scan({ sourcePath });
    const waveBuilder = new WaveBuilder({
      maxComponentsPerWave: 10_000,
      respectTypeOrder: true,
      handleCircularDeps: true,
      dependencyEdges: scanResult.dependencyResult.edges,
    });
    let waveResult = waveBuilder.generateWaves(scanResult.dependencyResult.graph);
    let priorityOverrides: Record<string, PriorityOverride> = {};
    let aiContext:
      | {
          enabled: boolean;
          provider?: string;
          model?: string;
          aiAdjustments?: number;
          unknownTypes?: string[];
          inferredDependencies?: number;
          inferenceFallback?: boolean;
        }
      | undefined;

    if (flags['use-ai']) {
      const inferenceService = new DependencyInferenceService({
        baseDir: sourcePath ?? process.cwd(),
      });
      const inferenceResult = await inferenceService.inferDependencies(
        scanResult.components,
        scanResult.dependencyResult.graph
      );

      if (inferenceResult.dependencies.length > 0) {
        const enrichedComponents = this.applyInferredDependencies(scanResult.components, inferenceResult.dependencies);
        const graphBuilder = new DependencyGraphBuilder();
        graphBuilder.addComponents(enrichedComponents);

        scanResult.components = enrichedComponents;
        scanResult.dependencyResult = graphBuilder.build();
      }

      this.log('  🤖 Using AI priority weighting for analysis output...');
      const priorityService = new AgentforcePriorityService({
        baseDir: sourcePath ?? process.cwd(),
      });
      const aiWaveGenerator = new AIEnhancedPriorityWaveGenerator({
        agentforceService: priorityService,
        orgType: typeof flags['org-type'] === 'string' ? flags['org-type'] : undefined,
        industry: typeof flags.industry === 'string' ? flags.industry : undefined,
      });
      const prioritizedWaves = await aiWaveGenerator.applyPriorityWavesAsync(
        waveResult.waves,
        scanResult.dependencyResult.components
      );

      waveResult = {
        ...waveResult,
        waves: prioritizedWaves,
      };

      priorityOverrides = aiWaveGenerator.getAIPriorityOverrides(scanResult.dependencyResult.components);

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
        inferredDependencies: inferenceResult.highConfidenceCount,
        inferenceFallback: inferenceResult.fallbackToStatic,
      };
    }

    return {
      scanResult,
      waveResult,
      priorityOverrides,
      aiContext,
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
      dependencyDetails: [...(component.dependencyDetails ?? [])],
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

      const sourceComponent = componentsByNodeId.get(fromNodeId);
      sourceComponent?.dependencies.add(toNodeId);
      if (sourceComponent && !sourceComponent.dependencyDetails?.some((dependency) => dependency.nodeId === toNodeId)) {
        sourceComponent.dependencyDetails ??= [];
        sourceComponent.dependencyDetails.push({
          nodeId: toNodeId,
          kind: 'inferred',
          source: 'ai',
          reason: 'AI-inferred dependency',
        });
      }
      componentsByNodeId.get(toNodeId)?.dependents.add(fromNodeId);
    }

    return clonedComponents;
  }
}
