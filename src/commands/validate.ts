/**
 * smart-deployment:validate command - US-048
 *
 * @ac US-048-AC-1: Performs check-only deployment
 * @ac US-048-AC-2: Validates each wave
 * @ac US-048-AC-3: Reports validation errors
 * @ac US-048-AC-4: Supports --target-org flag
 * @ac US-048-AC-5: Shows estimated deployment time
 * @ac US-048-AC-6: No actual deployment
 * @issue #48
 */

import { SfCommand, optionalOrgFlagWithDeprecations } from '@salesforce/sf-plugins-core';
import { Flags } from '@oclif/core';
import { DeploymentValidationService } from '../deployment/deployment-validation-service.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('ValidateCommand');

interface ValidateResult {
  success: boolean;
  components: number;
  waves: number;
  issueCount: number;
  ai?: {
    analyzed: boolean;
    provider?: string;
    model?: string;
    fallback?: boolean;
    overallRisk?: 'low' | 'medium' | 'high' | 'critical';
  };
}

export default class Validate extends SfCommand<ValidateResult> {
  public static readonly summary = 'Validate deployment without executing';
  public static readonly flags = {
    'target-org': optionalOrgFlagWithDeprecations,
    'source-path': Flags.directory({
      summary: 'Path to the Salesforce project to validate',
      exists: true,
    }),
    'use-ai': Flags.boolean({
      summary: 'Use AI wave validation with the configured provider when available',
      default: false,
    }),
  };

  public async run(): Promise<ValidateResult> {
    const { flags } = await this.parse(Validate);
    const validationService = new DeploymentValidationService();

    logger.info('Validating deployment', { flags });

    const summary = await validationService.validateProject(flags['source-path'], {
      useAI: flags['use-ai'],
    });
    this.log(validationService.formatSummary(summary));

    if (!summary.valid) {
      this.warn(`Validation found ${summary.issues.length} issue(s). No deployment was executed.`);
    } else {
      this.log('Validation completed successfully. No deployment was executed.');
    }

    return {
      success: summary.valid,
      components: summary.components,
      waves: summary.totalWaves,
      issueCount: summary.issues.length,
      ai: flags['use-ai']
        ? {
            analyzed: summary.aiAnalyzed ?? false,
            provider: summary.aiProvider,
            model: summary.aiModel,
            fallback: summary.aiFallback,
            overallRisk: summary.overallRisk,
          }
        : undefined,
    };
  }
}
