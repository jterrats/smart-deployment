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
import { AnalysisReporter } from '../analysis/analysis-reporter.js';
import { ProjectAnalysisService } from '../analysis/project-analysis-service.js';
import type { PriorityOverride } from '../types/deployment-plan.js';
import { DeploymentPlanManager } from '../utils/deployment-plan-manager.js';
import { getLogger } from '../utils/logger.js';
import type { ScanResult } from '../services/metadata-scanner-service.js';
import type { WaveResult } from '../waves/wave-builder.js';

const logger = getLogger('AnalyzeCommand');
Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@jterrats/smart-deployment', 'analyze');
const projectAnalysisService = new ProjectAnalysisService();

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

      const analysisContext = await this.buildAnalysisContext(flags, sourcePath);
      const { scanResult, waveResult, priorityOverrides, aiContext } = analysisContext;

      const components = scanResult.components.length;
      const dependencies = scanResult.dependencyResult.stats.totalDependencies;
      const cycles = scanResult.dependencyResult.circularDependencies.length;

      this.log(`✅ Found ${components} components with ${dependencies} dependencies`);

      if (cycles > 0) {
        this.log(`⚠️  Warning: ${cycles} circular dependency cycle(s) detected`);
      }

      this.log('');
      this.log('🌊 Generating deployment waves...');

      this.log(`✅ Generated ${waveResult.waves.length} deployment wave(s)`);
      this.log(`   Total components: ${waveResult.totalComponents}`);
      if (waveResult.unplacedComponents.length > 0) {
        this.log(`   ⚠️  ${waveResult.unplacedComponents.length} component(s) couldn't be placed (circular deps)`);
      }

      let planSaved = false;

      if (flags['save-plan']) {
        this.log('');
        this.log('📋 Generating deployment plan...');

        const planWaves = waveResult.waves.map((wave) => ({
          number: wave.number,
          components: wave.components,
          metadata: {
            componentCount: wave.metadata.componentCount,
            types: wave.metadata.types,
            maxDepth: wave.metadata.maxDepth,
            hasCircularDeps: wave.metadata.hasCircularDeps,
            estimatedTime: wave.metadata.estimatedTime,
          },
        }));

        const priorities: Record<string, PriorityOverride> = { ...priorityOverrides };
        for (const component of scanResult.components) {
          if (component.priorityBoost > 0) {
            const nodeId = `${component.type}:${component.name}`;
            priorities[nodeId] = {
              priority: component.priorityBoost,
              source: 'static',
              appliedAt: new Date().toISOString(),
            };
          }
        }

        const plan = DeploymentPlanManager.createPlan(planWaves, priorities, {
          aiEnabled: flags['use-ai'],
          aiModel: aiContext?.model,
          orgType: flags['org-type'],
          industry: flags.industry,
          generatedBy: 'smart-deployment CLI',
        });

        await DeploymentPlanManager.savePlan(plan, flags['plan-path']);

        const planPath = flags['plan-path'] ?? '.smart-deployment/deployment-plan.json';
        this.log(`✅ Deployment plan saved to: ${planPath}`);
        planSaved = true;
        this.log('');
        this.log('💡 Next steps:');
        this.log('   1. Review the plan in your PR');
        this.log('   2. Commit the plan to your repo');
        this.log(`   3. Use ${planPath} as a reviewed deployment artifact in CI/CD`);
      }

      if (flags.output) {
        const format = flags.format === 'html' ? 'html' : 'json';
        const reporter = new AnalysisReporter();
        const report = reporter.createReport(scanResult, waveResult, aiContext);

        await reporter.saveReport(report, flags.output, format);
        this.log(`📄 Report saved to: ${flags.output} (format: ${format})`);
      }

      return { success: true, components, dependencies, planSaved, ai: aiContext };
    } catch (error) {
      logger.error('Analysis failed', { error });
      this.error(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async buildAnalysisContext(
    flags: Record<string, unknown>,
    sourcePath?: string
  ): Promise<{
    scanResult: ScanResult;
    waveResult: WaveResult;
    priorityOverrides: Record<string, PriorityOverride>;
    aiContext?: {
      enabled: boolean;
      provider?: string;
      model?: string;
      aiAdjustments?: number;
      unknownTypes?: string[];
      inferredDependencies?: number;
      inferenceFallback?: boolean;
    };
  }> {
    const analysis = await projectAnalysisService.buildAnalysis({
      sourcePath,
      useAI: Boolean(flags['use-ai']),
      orgType: typeof flags['org-type'] === 'string' ? flags['org-type'] : undefined,
      industry: typeof flags.industry === 'string' ? flags.industry : undefined,
    });

    analysis.messages.warnings.forEach((warning) => this.warn(warning));
    analysis.messages.logs.forEach((entry) => this.log(entry));

    return {
      scanResult: analysis.scanResult,
      waveResult: analysis.waveResult,
      priorityOverrides: analysis.priorityOverrides,
      aiContext: analysis.aiContext
        ? {
            enabled: analysis.aiContext.enabled,
            provider: analysis.aiContext.provider,
            model: analysis.aiContext.model,
            aiAdjustments: analysis.aiContext.aiAdjustments,
            unknownTypes: analysis.aiContext.unknownTypes,
            inferredDependencies: analysis.aiContext.inferredDependencies,
            inferenceFallback: analysis.aiContext.inferenceFallback,
          }
        : undefined,
    };
  }
}
