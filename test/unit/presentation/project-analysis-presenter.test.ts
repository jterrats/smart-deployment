import { expect } from 'chai';
import { describe, it } from 'mocha';
import { ProjectAnalysisPresenter } from '../../../src/presentation/project-analysis-presenter.js';

describe('ProjectAnalysisPresenter', () => {
  it('reports scan diagnostics and shared pipeline messages', () => {
    const presenter = new ProjectAnalysisPresenter();
    const logs: string[] = [];
    const warnings: string[] = [];

    presenter.reportDiagnostics(
      {
        log: (message) => logs.push(message),
        warn: (message) => warnings.push(message),
      },
      {
        errors: ['scan error'],
        warnings: ['scan warning'],
      },
      {
        logs: ['analysis log'],
        warnings: ['analysis warning'],
      }
    );

    expect(logs).to.deep.equal(['analysis log']);
    expect(warnings).to.deep.equal(['scan error', 'scan warning', 'analysis warning']);
  });
});
