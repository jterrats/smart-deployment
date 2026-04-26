import type { ResumePreparation, ResumeRetryStrategy } from '../deployment/resume-deployment-service.js';

export type ResumePresenterIO = {
  log: (message: string) => void;
};

export class ResumeCommandPresenter {
  public reportResumePreparation(
    io: ResumePresenterIO,
    summary: ResumePreparation,
    retryStrategy: ResumeRetryStrategy
  ): void {
    io.log(`🔄 Resume prepared for deployment ${summary.deploymentId}`);
    io.log(`Retry strategy: ${retryStrategy}`);
    io.log(`Resuming from wave ${summary.currentWave}/${summary.totalWaves}`);
    io.log(`Remaining waves: ${summary.remainingWaves}`);
    if (summary.failureReason) {
      io.log(`Previous failure: ${summary.failureReason}`);
    }
  }
}
