/**
 * smart-deployment:analyze command - US-047
 *
 * @ac US-047-AC-1: Scans project metadata
 * @ac US-047-AC-2: Generates dependency graph
 * @ac US-047-AC-3: Generates deployment waves
 * @ac US-047-AC-4: Outputs analysis report (JSON/HTML)
 * @ac US-047-AC-5: Supports --output flag
 * @ac US-047-AC-6: Supports --format flag
 * @ac US-047-AC-7: Shows statistics
 * @ac US-047-AC-8: Highlights issues (cycles, etc.)
 * @ac US-047-AC-9: No deployment execution
 * @issue #47
 */

import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { AnalyzeArtifactService } from '../analysis/analyze-artifact-service.js';
import { AnalyzeContextService } from '../analysis/analyze-context-service.js';
import { AnalyzeCommandPresenter } from '../presentation/analyze-command-presenter.js';
import { ProjectAnalysisPresenter } from '../presentation/project-analysis-presenter.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('AnalyzeCommand');
Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@jterrats/smart-deployment', 'analyze');
const analyzeContextService = new AnalyzeContextService();
const artifactService = new AnalyzeArtifactService();
const projectAnalysisPresenter = new ProjectAnalysisPresenter();
const presenter = new AnalyzeCommandPresenter();

type AnalyzeResult = {
  success: boolean;
  components: number;
  dependencies: number;
  planSaved?: boolean;
  ai?: {
    enabled: boolean;
    provider?: string;
    model?: string;
    aiAdjustments?: number;
    unknownTypes?: string[];
    inferredDependencies?: number;
    inferenceFallback?: boolean;
  };
};

export default class Analyze extends SfCommand<AnalyzeResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {
    'source-path': Flags.string({ summary: messages.getMessage('flags.source-path.summary') }),
    'save-plan': Flags.boolean({
      summary: messages.getMessage('flags.save-plan.summary'),
      default: false,
    }),
    'plan-path': Flags.string({ summary: messages.getMessage('flags.plan-path.summary') }),
    'use-ai': Flags.boolean({
      summary: messages.getMessage('flags.use-ai.summary'),
      default: false,
    }),
    'org-type': Flags.string({
      summary: messages.getMessage('flags.org-type.summary'),
      options: ['Production', 'Sandbox', 'Developer'],
    }),
    industry: Flags.string({ summary: messages.getMessage('flags.industry.summary') }),
    output: Flags.string({ summary: messages.getMessage('flags.output.summary'), char: 'r' }),
    format: Flags.string({ summary: messages.getMessage('flags.format.summary'), char: 'f', default: 'json' }),
  };

  public async run(): Promise<AnalyzeResult> {
    const { flags } = await this.parse(Analyze);
    const sourcePath = typeof flags['source-path'] === 'string' ? flags['source-path'] : undefined;

    try {
      logger.info('Analyzing metadata', {
        sourcePath,
        savePlan: flags['save-plan'],
        useAI: flags['use-ai'],
      });

      this.log('📊 Analyzing metadata...');

      const analysisContext = await analyzeContextService.buildContext({
        sourcePath,
        useAI: Boolean(flags['use-ai']),
        orgType: typeof flags['org-type'] === 'string' ? flags['org-type'] : undefined,
        industry: typeof flags.industry === 'string' ? flags.industry : undefined,
      });
      projectAnalysisPresenter.reportDiagnostics(this, analysisContext.scanResult, analysisContext.messages);
      const { scanResult, waveResult, priorityOverrides, aiContext } = analysisContext;

      const components = scanResult.components.length;
      const dependencies = scanResult.dependencyResult.stats.totalDependencies;
      presenter.reportAnalysisSummary(this, scanResult, waveResult);

      if (flags['save-plan']) {
        this.log('');
        this.log('📋 Generating deployment plan...');
      }

      const artifacts = await artifactService.generateArtifacts(scanResult, waveResult, priorityOverrides, {
        savePlan: flags['save-plan'],
        planPath: typeof flags['plan-path'] === 'string' ? flags['plan-path'] : undefined,
        outputPath: typeof flags.output === 'string' ? flags.output : undefined,
        outputFormat: flags.format === 'html' ? 'html' : 'json',
        aiEnabled: Boolean(flags['use-ai']),
        aiContext,
        orgType: typeof flags['org-type'] === 'string' ? flags['org-type'] : undefined,
        industry: typeof flags.industry === 'string' ? flags.industry : undefined,
      });

      if (artifacts.planSaved && artifacts.planPath) {
        presenter.reportPlanSaved(this, artifacts.planPath);
      }

      if (artifacts.reportSaved && artifacts.reportPath && artifacts.reportFormat) {
        presenter.reportReportSaved(this, artifacts.reportPath, artifacts.reportFormat);
      }

      return { success: true, components, dependencies, planSaved: artifacts.planSaved, ai: aiContext };
    } catch (error) {
      logger.error('Analysis failed', { error });
      this.error(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
