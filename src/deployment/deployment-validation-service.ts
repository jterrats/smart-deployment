import * as path from 'node:path';
import { glob as globAsync } from 'glob';
import { ProjectAnalysisService } from '../analysis/project-analysis-service.js';
import { getLogger } from '../utils/logger.js';
import { XmlMetadataValidator } from '../validators/xml-metadata-validator.js';
import { WaveValidationService } from '../ai/wave-validation-service.js';
import { validateWaveOrder } from '../waves/wave-executor.js';
import type { MetadataDependencyKind } from '../types/metadata.js';

const logger = getLogger('DeploymentValidationService');

export type DeploymentValidationIssue = {
  severity: 'error' | 'warning';
  message: string;
  filePath?: string;
  waveNumber?: number;
};

export type DeploymentValidationSummary = {
  valid: boolean;
  components: number;
  dependencies: number;
  dependencyBreakdown: Record<MetadataDependencyKind, number>;
  totalWaves: number;
  estimatedTime: number;
  xmlFilesValidated: number;
  issues: DeploymentValidationIssue[];
  aiAnalyzed?: boolean;
  overallRisk?: 'low' | 'medium' | 'high' | 'critical';
  aiProvider?: string;
  aiModel?: string;
  aiFallback?: boolean;
};

export class DeploymentValidationService {
  private readonly projectAnalysisService = new ProjectAnalysisService();
  private readonly xmlValidator = new XmlMetadataValidator();

  public async validateProject(
    sourcePath?: string,
    options: { useAI?: boolean } = {}
  ): Promise<DeploymentValidationSummary> {
    const analysis = await this.projectAnalysisService.buildAnalysis({ sourcePath });
    const { scanResult, waveResult } = analysis;
    const issues: DeploymentValidationIssue[] = [];
    const dependencyBreakdown = scanResult.dependencyResult.edges.reduce<Record<MetadataDependencyKind, number>>(
      (accumulator, edge) => ({
        ...accumulator,
        [edge.type]: accumulator[edge.type] + 1,
      }),
      {
        hard: 0,
        soft: 0,
        inferred: 0,
      }
    );

    issues.push(
      ...scanResult.errors.map((message) => ({ severity: 'error' as const, message })),
      ...scanResult.warnings.map((message) => ({ severity: 'warning' as const, message }))
    );

    if (!validateWaveOrder(waveResult.waves)) {
      issues.push({
        severity: 'error',
        message: 'Generated waves are not in strict numerical order.',
      });
    }

    if (waveResult.circularDependencies.length > 0) {
      issues.push({
        severity: 'error',
        message: `${waveResult.circularDependencies.length} circular dependency cycle(s) detected.`,
      });
    }

    if (waveResult.unplacedComponents.length > 0) {
      issues.push({
        severity: 'warning',
        message: `${waveResult.unplacedComponents.length} component(s) required manual placement.`,
      });
    }

    issues.push(...this.createWaveDependencyRiskIssues(scanResult.dependencyResult.edges, waveResult.waves));

    const xmlFiles = await this.findXmlMetadataFiles(scanResult.projectRoot);
    const xmlResults = await this.xmlValidator.validateFiles(xmlFiles);
    for (const result of xmlResults) {
      for (const error of result.errors) {
        issues.push({
          severity: error.severity,
          message: error.message,
          filePath: result.filePath,
        });
      }

      for (const warning of result.warnings) {
        issues.push({
          severity: 'warning',
          message: warning.message,
          filePath: result.filePath,
        });
      }
    }

    let aiAnalyzed = false;
    let overallRisk: DeploymentValidationSummary['overallRisk'];
    let aiProvider: string | undefined;
    let aiModel: string | undefined;
    let aiFallback: boolean | undefined;

    if (options.useAI) {
      const aiValidationService = new WaveValidationService({ baseDir: scanResult.projectRoot });
      const aiValidation = await aiValidationService.validateWaves(waveResult.waves);
      const providerConfig = aiValidationService.getProviderConfig();

      aiAnalyzed = aiValidation.aiAnalyzed;
      overallRisk = aiValidation.overallRisk;
      aiProvider = providerConfig.provider;
      aiModel = providerConfig.model;
      aiFallback = !aiValidation.aiAnalyzed;

      for (const issue of aiValidation.issues) {
        issues.push({
          severity: issue.severity === 'high' || issue.severity === 'critical' ? 'error' : 'warning',
          message: `[AI ${issue.category}] ${issue.message}`,
          waveNumber: issue.waveNumber,
        });
      }

      for (const assessment of aiValidation.riskAssessments) {
        if (assessment.riskLevel === 'high' || assessment.riskLevel === 'critical') {
          issues.push({
            severity: assessment.riskLevel === 'critical' ? 'error' : 'warning',
            message: `[AI risk] Wave ${assessment.waveNumber} assessed as ${assessment.riskLevel}. ${
              assessment.riskFactors.join(', ') || 'No specific factors reported.'
            }`,
            waveNumber: assessment.waveNumber,
          });
        }
      }
    }

    const valid = issues.every((issue) => issue.severity !== 'error');

    logger.info('Deployment validation completed', {
      components: scanResult.components.length,
      totalWaves: waveResult.waves.length,
      xmlFilesValidated: xmlFiles.length,
      valid,
      issues: issues.length,
    });

    return {
      valid,
      components: scanResult.components.length,
      dependencies: scanResult.dependencyResult.stats.totalDependencies,
      dependencyBreakdown,
      totalWaves: waveResult.waves.length,
      estimatedTime: waveResult.stats.totalEstimatedTime,
      xmlFilesValidated: xmlFiles.length,
      issues,
      aiAnalyzed,
      overallRisk,
      aiProvider,
      aiModel,
      aiFallback,
    };
  }

  public formatSummary(summary: DeploymentValidationSummary): string {
    const lines = [
      `Validation: ${summary.valid ? 'PASSED' : 'FAILED'}`,
      `Components: ${summary.components}`,
      `Dependencies: ${summary.dependencies}`,
      `Hard / Soft / Inferred: ${summary.dependencyBreakdown.hard} / ${summary.dependencyBreakdown.soft} / ${summary.dependencyBreakdown.inferred}`,
      `Waves: ${summary.totalWaves}`,
      `Estimated Time: ${summary.estimatedTime}s`,
      `XML Files Validated: ${summary.xmlFilesValidated}`,
    ];

    if (summary.aiAnalyzed !== undefined) {
      lines.push(`AI Validation: ${summary.aiAnalyzed ? 'ENABLED' : 'UNAVAILABLE'}`);
    }
    if (summary.aiProvider) {
      lines.push(`AI Provider: ${summary.aiProvider}`);
    }
    if (summary.aiModel) {
      lines.push(`AI Model: ${summary.aiModel}`);
    }
    if (summary.aiFallback !== undefined) {
      lines.push(`AI Fallback: ${summary.aiFallback ? 'YES' : 'NO'}`);
    }

    if (summary.overallRisk) {
      lines.push(`AI Overall Risk: ${summary.overallRisk.toUpperCase()}`);
    }

    if (summary.issues.length > 0) {
      lines.push('');
      lines.push('Issues:');
      for (const issue of summary.issues) {
        const location = issue.filePath
          ? ` (${issue.filePath})`
          : issue.waveNumber !== undefined
          ? ` (wave ${issue.waveNumber})`
          : '';
        lines.push(`- [${issue.severity}] ${issue.message}${location}`);
      }
    }

    return lines.join('\n');
  }

  private createWaveDependencyRiskIssues(
    edges: Array<{ from: string; type: 'hard' | 'soft' | 'inferred' }>,
    waves: Array<{ number: number; components: string[] }>
  ): DeploymentValidationIssue[] {
    return waves.flatMap((wave) => {
      const waveComponents = new Set(wave.components);
      let softCount = 0;
      let inferredCount = 0;

      for (const edge of edges) {
        if (!waveComponents.has(edge.from)) {
          continue;
        }

        if (edge.type === 'soft') {
          softCount += 1;
        } else if (edge.type === 'inferred') {
          inferredCount += 1;
        }
      }

      if (softCount === 0 && inferredCount === 0) {
        return [];
      }

      const parts: string[] = [];
      if (softCount > 0) {
        parts.push(`${softCount} soft dependenc${softCount === 1 ? 'y' : 'ies'}`);
      }
      if (inferredCount > 0) {
        parts.push(`${inferredCount} inferred dependenc${inferredCount === 1 ? 'y' : 'ies'}`);
      }

      return [
        {
          severity: 'warning' as const,
          waveNumber: wave.number,
          message: `Wave ${wave.number} contains ${parts.join(' and ')} that should be reviewed before deployment.`,
        },
      ];
    });
  }

  private async findXmlMetadataFiles(projectRoot: string): Promise<string[]> {
    const files = await globAsync('**/*-meta.xml', {
      cwd: projectRoot,
      absolute: true,
      ignore: ['**/node_modules/**', '**/.git/**'],
    });

    return files.filter((filePath) => {
      const normalized = filePath.split(path.sep).join('/');
      return !normalized.includes('/node_modules/') && !normalized.includes('/.git/');
    });
  }
}
