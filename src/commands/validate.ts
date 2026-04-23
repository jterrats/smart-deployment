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

import { type Interfaces } from '@oclif/core';
import { Messages } from '@salesforce/core';
import { Flags, SfCommand, optionalOrgFlagWithDeprecations } from '@salesforce/sf-plugins-core';
import { DeploymentValidationService } from '../deployment/deployment-validation-service.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('ValidateCommand');
Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('smart-deployment', 'validate');

type ValidateResult = {
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
};

export default class Validate extends SfCommand<ValidateResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly examples = messages.getMessages('examples');
  public static readonly flags: Interfaces.FlagInput = {
    'target-org': optionalOrgFlagWithDeprecations,
    'source-path': Flags.directory({
      summary: messages.getMessage('flags.source-path.summary'),
      exists: true,
    }),
    'use-ai': Flags.boolean({
      summary: messages.getMessage('flags.use-ai.summary'),
      default: false,
    }),
  };

  public async run(): Promise<ValidateResult> {
    const { flags } = await this.parse(Validate);
    const validationService = new DeploymentValidationService();
    const sourcePath = typeof flags['source-path'] === 'string' ? flags['source-path'] : undefined;
    const useAI = flags['use-ai'] === true;

    logger.info('Validating deployment', { flags });

    const summary = await validationService.validateProject(sourcePath, {
      useAI,
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
      ai: useAI
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
