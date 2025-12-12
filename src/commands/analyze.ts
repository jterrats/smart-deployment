/**
 * smart-deployment:analyze command - US-047
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

import { Flags } from '@oclif/core';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { getLogger } from '../utils/logger.js';
import { DeploymentPlanManager } from '../utils/deployment-plan-manager.js';
import { MetadataScannerService } from '../services/metadata-scanner-service.js';
import { WaveBuilder } from '../waves/wave-builder.js';

const logger = getLogger('AnalyzeCommand');

export default class Analyze extends SfCommand<{ components: number; dependencies: number; planSaved?: boolean }> {
  public static readonly summary = 'Analyze metadata without deploying';

  public static readonly flags = {
    'source-path': Flags.string({
      summary: 'Path to analyze (defaults to current directory)',
      char: 'p',
      default: '.',
    }),
    'save-plan': Flags.boolean({
      summary: 'Save deployment plan for CI/CD',
      description: 'Generates deployment-plan.json for use in CI/CD pipelines',
      default: false,
    }),
    'plan-path': Flags.string({
      summary: 'Custom path for deployment plan',
      description: 'Override default .smart-deployment/deployment-plan.json',
    }),
    'use-ai': Flags.boolean({
      summary: 'Use Agentforce AI for intelligent analysis',
      default: false,
    }),
    'org-type': Flags.string({
      summary: 'Organization type (Production, Sandbox, Developer)',
      options: ['Production', 'Sandbox', 'Developer'],
    }),
    industry: Flags.string({
      summary: 'Industry context for AI analysis',
    }),
    output: Flags.string({ summary: 'Output file path', char: 'o' }),
    format: Flags.string({ summary: 'Output format (json|html)', char: 'f', default: 'json' }),
  };

  public async run(): Promise<{ components: number; dependencies: number; planSaved?: boolean }> {
    const { flags } = await this.parse(Analyze);

    try {
      logger.info('Analyzing metadata', {
        sourcePath: flags['source-path'],
        savePlan: flags['save-plan'],
        useAI: flags['use-ai'],
      });

      this.log('📊 Analyzing metadata...');

      // Scan project and build dependency graph
      const scanner = new MetadataScannerService();
      const scanResult = await scanner.scan({
        sourcePath: flags['source-path'],
      });

      const components = scanResult.components.length;
      const dependencies = scanResult.dependencyResult.stats.totalDependencies;
      const cycles = scanResult.dependencyResult.circularDependencies.length;

      this.log(`✅ Found ${components} components with ${dependencies} dependencies`);

      if (cycles > 0) {
        this.log(`⚠️  Warning: ${cycles} circular dependency cycle(s) detected`);
      }

      // Generate waves
      this.log('');
      this.log('🌊 Generating deployment waves...');
      const waveBuilder = new WaveBuilder({
        maxComponentsPerWave: 10000,
        respectTypeOrder: true,
        handleCircularDeps: true,
      });

      const waveResult = waveBuilder.generateWaves(scanResult.dependencyResult.graph);

      this.log(`✅ Generated ${waveResult.waves.length} deployment wave(s)`);
      this.log(`   Total components: ${waveResult.totalComponents}`);
      if (waveResult.unplacedComponents.length > 0) {
        this.log(`   ⚠️  ${waveResult.unplacedComponents.length} component(s) couldn't be placed (circular deps)`);
      }

      // Generate and save plan if requested
      if (flags['save-plan']) {
        this.log('');
        this.log('📋 Generating deployment plan...');

        // Convert waves to plan format
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

        // Extract priorities from components (if any)
        const priorities: Record<string, number> = {};
        for (const component of scanResult.components) {
          if (component.priorityBoost > 0) {
            const nodeId = `${component.type}:${component.name}`;
            priorities[nodeId] = component.priorityBoost;
          }
        }

        const plan = DeploymentPlanManager.createPlan(planWaves, priorities, {
          aiEnabled: flags['use-ai'],
          orgType: flags['org-type'],
          industry: flags.industry,
          generatedBy: 'smart-deployment CLI',
        });

        await DeploymentPlanManager.savePlan(plan, flags['plan-path']);

        const planPath = flags['plan-path'] || '.smart-deployment/deployment-plan.json';
        this.log(`✅ Deployment plan saved to: ${planPath}`);
        this.log('');
        this.log('💡 Next steps:');
        this.log('   1. Review the plan in your PR');
        this.log('   2. Commit the plan to your repo');
        this.log(`   3. Use it in CI/CD: sf smart-deployment start --use-plan ${planPath}`);

        return { components, dependencies, planSaved: true };
      }

      // Output report if requested
      if (flags.output) {
        // TODO: Generate JSON/HTML report
        this.log(`📄 Report would be saved to: ${flags.output} (format: ${flags.format})`);
      }

      return { components, dependencies };
    } catch (error) {
      logger.error('Analysis failed', { error });
      this.error(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
