import { expect } from 'chai';
import { describe, it } from 'mocha';
import { ResumeCommandPresenter } from '../../../src/presentation/resume-command-presenter.js';

describe('ResumeCommandPresenter', () => {
  it('renders resume preparation details', () => {
    const presenter = new ResumeCommandPresenter();
    const logs: string[] = [];

    presenter.reportResumePreparation(
      {
        log: (message) => logs.push(message),
      },
      {
        deploymentId: 'deploy-123',
        currentWave: 2,
        totalWaves: 4,
        remainingWaves: 3,
        failureReason: 'UNABLE_TO_LOCK_ROW',
      },
      'quick'
    );

    expect(logs).to.deep.equal([
      '🔄 Resume prepared for deployment deploy-123',
      'Retry strategy: quick',
      'Resuming from wave 2/4',
      'Remaining waves: 3',
      'Previous failure: UNABLE_TO_LOCK_ROW',
    ]);
  });
});
