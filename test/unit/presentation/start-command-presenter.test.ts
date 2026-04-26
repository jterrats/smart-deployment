import { expect } from 'chai';
import { describe, it } from 'mocha';
import { StartCommandPresenter } from '../../../src/presentation/start-command-presenter.js';
describe('StartCommandPresenter', () => {
  it('reports analysis and deployment summaries', () => {
    const presenter = new StartCommandPresenter();
    const logs: string[] = [];

    presenter.reportExecutionStart({
      log: (message) => logs.push(message),
    });
    presenter.reportExecutionSkipped(
      {
        log: (message) => logs.push(message),
      },
      'dry-run'
    );
    presenter.reportExecutionSkipped(
      {
        log: (message) => logs.push(message),
      },
      'validate-only'
    );
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
    presenter.reportReportGenerationStart({
      log: (message) => logs.push(message),
    });

    expect(logs).to.include.members([
      '🚀 Executing deployment...',
      '🔍 Dry-run mode: skipping actual deployment',
      '🔍 Validate-only mode: skipping actual deployment',
      '✅ Found 4 metadata components',
      '🌊 Generating deployment waves...',
      '✅ Generated 2 waves',
      '🤖 AI-enhanced prioritization enabled',
      '📄 Generating deployment report...',
      '\n📊 Deployment Report:',
      '   - Waves: 2',
      '   - Status: Success',
    ]);
  });
});
