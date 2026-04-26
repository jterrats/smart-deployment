import { expect } from 'chai';
import { describe, it } from 'mocha';
import { StartCommandPresenter } from '../../../src/presentation/start-command-presenter.js';
describe('StartCommandPresenter', () => {
  it('reports analysis and deployment summaries', () => {
    const presenter = new StartCommandPresenter();
    const logs: string[] = [];

    presenter.reportAnalysisSummary(
      {
        log: (message) => logs.push(message),
      },
      {
        metadataCount: 4,
        waves: 2,
        aiEnabled: true,
      }
    );
    presenter.reportDeploymentReport(
      {
        log: (message) => logs.push(message),
      },
      2
    );

    expect(logs).to.include.members([
      '✅ Found 4 metadata components',
      '🌊 Generating deployment waves...',
      '✅ Generated 2 waves',
      '🤖 AI-enhanced prioritization enabled',
      '\n📊 Deployment Report:',
      '   - Waves: 2',
      '   - Status: Success',
    ]);
  });
});
