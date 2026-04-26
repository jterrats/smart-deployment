import type { ScanResult } from '../services/metadata-scanner-service.js';
import type { PriorityOverride } from '../types/deployment-plan.js';
import type { WaveResult } from '../waves/wave-builder.js';
import {
  ProjectAnalysisService,
  type ProjectAnalysisAIContext,
  type ProjectAnalysisMessages,
} from './project-analysis-service.js';

export type AnalyzeAIContext = Pick<
  ProjectAnalysisAIContext,
  'enabled' | 'provider' | 'model' | 'aiAdjustments' | 'unknownTypes' | 'inferredDependencies' | 'inferenceFallback'
>;

export type AnalyzeContext = {
  scanResult: ScanResult;
  waveResult: WaveResult;
  priorityOverrides: Record<string, PriorityOverride>;
  aiContext?: AnalyzeAIContext;
  messages: ProjectAnalysisMessages;
};

export type AnalyzeContextBuildOptions = {
  sourcePath?: string;
  useAI?: boolean;
  orgType?: string;
  industry?: string;
};

type AnalyzeContextServiceDependencies = ConstructorParameters<typeof ProjectAnalysisService>[0];

export class AnalyzeContextService {
  private readonly projectAnalysisService: ProjectAnalysisService;

  public constructor(dependencies: AnalyzeContextServiceDependencies = {}) {
    this.projectAnalysisService = new ProjectAnalysisService(dependencies);
  }

  public async buildContext(options: AnalyzeContextBuildOptions = {}): Promise<AnalyzeContext> {
    const analysis = await this.projectAnalysisService.buildAnalysis(options);

    return {
      scanResult: analysis.scanResult,
      waveResult: analysis.waveResult,
      priorityOverrides: analysis.priorityOverrides,
      aiContext: analysis.aiContext
        ? {
            enabled: analysis.aiContext.enabled,
            provider: analysis.aiContext.provider,
            model: analysis.aiContext.model,
            aiAdjustments: analysis.aiContext.aiAdjustments,
            unknownTypes: analysis.aiContext.unknownTypes,
            inferredDependencies: analysis.aiContext.inferredDependencies,
            inferenceFallback: analysis.aiContext.inferenceFallback,
          }
        : undefined,
      messages: analysis.messages,
    };
  }
}
