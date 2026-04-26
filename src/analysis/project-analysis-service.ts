import { AgentforcePriorityService } from '../ai/agentforce-priority-service.js';
import { DependencyInferenceService, type InferredDependency } from '../ai/dependency-inference-service.js';
import { DependencyGraphBuilder } from '../dependencies/dependency-graph-builder.js';
import { MetadataScannerService, type ScanResult } from '../services/metadata-scanner-service.js';
import type { NodeId } from '../types/dependency.js';
import type { PriorityOverride } from '../types/deployment-plan.js';
import type { MetadataComponent } from '../types/metadata.js';
import { AIEnhancedPriorityWaveGenerator } from '../waves/priority-wave-generator-ai.js';
import { getWavesInExecutionOrder } from '../waves/wave-executor.js';
import { WaveBuilder, type Wave, type WaveResult } from '../waves/wave-builder.js';

export type ProjectAnalysisAIContext = {
  enabled: boolean;
  provider?: string;
  model?: string;
  aiAdjustments?: number;
  unknownTypes?: string[];
  fallback?: boolean;
  inferredDependencies?: number;
  inferenceFallback?: boolean;
};

export type ProjectAnalysisMessages = {
  logs: string[];
  warnings: string[];
};

export type ProjectAnalysisResult = {
  scanResult: ScanResult;
  waveResult: WaveResult;
  orderedWaves: Wave[];
  priorityOverrides: Record<string, PriorityOverride>;
  aiContext?: ProjectAnalysisAIContext;
  messages: ProjectAnalysisMessages;
};

export type ProjectAnalysisBuildOptions = {
  sourcePath?: string;
  useAI?: boolean;
  orgType?: string;
  industry?: string;
};

type ProjectAnalysisServiceDependencies = {
  scanner?: MetadataScannerService;
  createInferenceService?: (baseDir: string) => Pick<DependencyInferenceService, 'inferDependencies'>;
  createPriorityService?: (baseDir: string) => AgentforcePriorityService;
};

export class ProjectAnalysisService {
  private readonly scanner: MetadataScannerService;
  private readonly createInferenceService: NonNullable<ProjectAnalysisServiceDependencies['createInferenceService']>;
  private readonly createPriorityService: NonNullable<ProjectAnalysisServiceDependencies['createPriorityService']>;

  public constructor(dependencies: ProjectAnalysisServiceDependencies = {}) {
    this.scanner = dependencies.scanner ?? new MetadataScannerService();
    this.createInferenceService =
      dependencies.createInferenceService ??
      ((baseDir): Pick<DependencyInferenceService, 'inferDependencies'> => new DependencyInferenceService({ baseDir }));
    this.createPriorityService =
      dependencies.createPriorityService ??
      ((baseDir): AgentforcePriorityService => new AgentforcePriorityService({ baseDir }));
  }

  public async buildAnalysis(options: ProjectAnalysisBuildOptions = {}): Promise<ProjectAnalysisResult> {
    const scanResult = await this.scanner.scan({ sourcePath: options.sourcePath });
    const messages: ProjectAnalysisMessages = {
      logs: [],
      warnings: [],
    };

    let dependencyResult = scanResult.dependencyResult;
    let inferredDependencies = 0;
    let inferenceFallback = false;

    if (options.useAI) {
      const inferenceService = this.createInferenceService(options.sourcePath ?? process.cwd());
      const inferenceResult = await inferenceService.inferDependencies(
        scanResult.components,
        scanResult.dependencyResult.graph
      );

      inferredDependencies = inferenceResult.highConfidenceCount;
      inferenceFallback = inferenceResult.fallbackToStatic;

      if (inferenceResult.dependencies.length > 0) {
        const enrichedComponents = ProjectAnalysisService.applyInferredDependencies(
          scanResult.components,
          inferenceResult.dependencies
        );
        const graphBuilder = new DependencyGraphBuilder();
        graphBuilder.addComponents(enrichedComponents);
        scanResult.components = enrichedComponents;
        dependencyResult = graphBuilder.build();
        scanResult.dependencyResult = dependencyResult;
      }
    }

    const waveBuilder = new WaveBuilder({
      dependencyEdges: dependencyResult.edges,
    });
    let waveResult = waveBuilder.generateWaves(dependencyResult.graph);
    let orderedWaves = getWavesInExecutionOrder(waveResult);
    let priorityOverrides: Record<string, PriorityOverride> = {};
    let aiContext: ProjectAnalysisAIContext | undefined;

    if (options.useAI) {
      messages.logs.push('  🤖 Using AI priority weighting for wave ordering...');
      const priorityService = this.createPriorityService(options.sourcePath ?? process.cwd());
      const aiWaveGenerator = new AIEnhancedPriorityWaveGenerator({
        agentforceService: priorityService,
        orgType: options.orgType,
        industry: options.industry,
      });

      const prioritizedWaves = await aiWaveGenerator.applyPriorityWavesAsync(
        waveResult.waves,
        scanResult.dependencyResult.components
      );
      waveResult = {
        ...waveResult,
        waves: prioritizedWaves,
      };
      orderedWaves = getWavesInExecutionOrder(waveResult);
      priorityOverrides = aiWaveGenerator.getAIPriorityOverrides(scanResult.dependencyResult.components);

      const unknownTypesWarning = aiWaveGenerator.getUnknownTypesWarning();
      if (unknownTypesWarning) {
        messages.warnings.push(unknownTypesWarning);
      }

      const aiReport = aiWaveGenerator.getAIReport();
      if (aiReport) {
        messages.logs.push(aiReport);
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

    return {
      scanResult,
      waveResult,
      orderedWaves,
      priorityOverrides,
      aiContext,
      messages,
    };
  }

  public static applyInferredDependencies(
    components: MetadataComponent[],
    inferredDependencies: InferredDependency[]
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
