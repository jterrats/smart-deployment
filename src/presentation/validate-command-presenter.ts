import type { DeploymentValidationSummary } from '../deployment/deployment-validation-service.js';

export type ValidatePresenterIO = {
  log: (message: string) => void;
  warn: (message: string) => void;
};

export class ValidateCommandPresenter {
  public reportValidationResult(io: ValidatePresenterIO, summary: DeploymentValidationSummary): void {
    io.log(this.formatSummary(summary));

    if (!summary.valid) {
      io.warn(`Validation found ${summary.issues.length} issue(s). No deployment was executed.`);
      return;
    }

    io.log('Validation completed successfully. No deployment was executed.');
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
}
