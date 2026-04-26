import type { ScanResult } from '../services/metadata-scanner-service.js';
import type { WaveResult } from '../waves/wave-builder.js';
import type { PriorityOverride } from '../types/deployment-plan.js';
import { DeploymentPlanManager } from '../utils/deployment-plan-manager.js';
import { AnalysisReporter, type AnalysisAIContext } from './analysis-reporter.js';

export type AnalyzeArtifactOptions = {
  savePlan: boolean;
  planPath?: string;
  outputPath?: string;
  outputFormat?: 'json' | 'html';
  aiEnabled?: boolean;
  aiContext?: AnalysisAIContext;
  orgType?: string;
  industry?: string;
};

export type AnalyzeArtifactResult = {
  planSaved: boolean;
  planPath?: string;
  reportSaved: boolean;
  reportPath?: string;
  reportFormat?: 'json' | 'html';
};

export class AnalyzeArtifactService {
  public async generateArtifacts(
    scanResult: ScanResult,
    waveResult: WaveResult,
    priorityOverrides: Record<string, PriorityOverride>,
    options: AnalyzeArtifactOptions
  ): Promise<AnalyzeArtifactResult> {
    let planSaved = false;
    let reportSaved = false;

    if (options.savePlan) {
      const priorities = this.createPriorities(scanResult, priorityOverrides);
      const plan = DeploymentPlanManager.createPlan(waveResult.waves, priorities, {
        aiEnabled: options.aiEnabled,
        aiModel: options.aiContext?.model,
        orgType: options.orgType,
        industry: options.industry,
        generatedBy: 'smart-deployment CLI',
      });

      await DeploymentPlanManager.savePlan(plan, options.planPath);
      planSaved = true;
    }

    if (options.outputPath) {
      const reporter = new AnalysisReporter();
      const report = reporter.createReport(scanResult, waveResult, options.aiContext);
      const format = options.outputFormat ?? 'json';
      await reporter.saveReport(report, options.outputPath, format);
      reportSaved = true;
    }

    return {
      planSaved,
      planPath: planSaved ? options.planPath ?? '.smart-deployment/deployment-plan.json' : undefined,
      reportSaved,
      reportPath: reportSaved ? options.outputPath : undefined,
      reportFormat: reportSaved ? options.outputFormat ?? 'json' : undefined,
    };
  }

  private createPriorities(
    scanResult: ScanResult,
    priorityOverrides: Record<string, PriorityOverride>
  ): Record<string, PriorityOverride> {
    const priorities: Record<string, PriorityOverride> = { ...priorityOverrides };

    for (const component of scanResult.components) {
      if (component.priorityBoost <= 0) {
        continue;
      }

      const nodeId = `${component.type}:${component.name}`;
      priorities[nodeId] = {
        priority: component.priorityBoost,
        source: 'static',
        appliedAt: new Date().toISOString(),
      };
    }

    return priorities;
  }
}
