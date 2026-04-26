import type { ProjectAnalysisMessages } from '../analysis/project-analysis-service.js';
import type { ScanResult } from '../services/metadata-scanner-service.js';

export type ProjectAnalysisPresenterIO = {
  log: (message: string) => void;
  warn: (message: string) => void;
};

export class ProjectAnalysisPresenter {
  public reportDiagnostics(
    io: ProjectAnalysisPresenterIO,
    scanResult: Pick<ScanResult, 'errors' | 'warnings'>,
    messages: ProjectAnalysisMessages
  ): void {
    scanResult.errors.forEach((message) => io.warn(message));
    scanResult.warnings.forEach((message) => io.warn(message));
    messages.warnings.forEach((warning) => io.warn(warning));
    messages.logs.forEach((entry) => io.log(entry));
  }
}
