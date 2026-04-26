import type { DeploymentStatusSummary } from '../deployment/deployment-status-service.js';

export type StatusPresenterIO = {
  log: (message: string) => void;
};

export class StatusCommandPresenter {
  public reportStatus(io: StatusPresenterIO, summary: DeploymentStatusSummary, formattedStatus: string): void {
    if (!summary.hasState) {
      io.log('ℹ️ No deployment state found.');
      return;
    }

    formattedStatus.split('\n').forEach((line) => io.log(line));
  }
}
