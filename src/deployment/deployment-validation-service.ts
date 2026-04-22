import { glob as globAsync } from 'glob';
import * as path from 'node:path';
import { MetadataScannerService } from '../services/metadata-scanner-service.js';
import { getLogger } from '../utils/logger.js';
import { XmlMetadataValidator } from '../validators/xml-metadata-validator.js';
import { WaveBuilder } from '../waves/wave-builder.js';
import { validateWaveOrder } from '../waves/wave-executor.js';

const logger = getLogger('DeploymentValidationService');

export interface DeploymentValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  filePath?: string;
  waveNumber?: number;
}

export interface DeploymentValidationSummary {
  valid: boolean;
  components: number;
  totalWaves: number;
  estimatedTime: number;
  xmlFilesValidated: number;
  issues: DeploymentValidationIssue[];
}

export class DeploymentValidationService {
  private readonly scanner = new MetadataScannerService();
  private readonly xmlValidator = new XmlMetadataValidator();

  public async validateProject(sourcePath?: string): Promise<DeploymentValidationSummary> {
    const scanResult = await this.scanner.scan({ sourcePath });
    const waveBuilder = new WaveBuilder({
      maxComponentsPerWave: 10000,
      respectTypeOrder: true,
      handleCircularDeps: true,
    });
    const waveResult = waveBuilder.generateWaves(scanResult.dependencyResult.graph);
    const issues: DeploymentValidationIssue[] = [];

    issues.push(
      ...scanResult.errors.map((message) => ({ severity: 'error' as const, message })),
      ...scanResult.warnings.map((message) => ({ severity: 'warning' as const, message })),
    );

    if (!validateWaveOrder(waveResult.waves)) {
      issues.push({
        severity: 'error',
        message: 'Generated waves are not in strict numerical order.',
      });
    }

    if (waveResult.circularDependencies.length > 0) {
      issues.push({
        severity: 'error',
        message: `${waveResult.circularDependencies.length} circular dependency cycle(s) detected.`,
      });
    }

    if (waveResult.unplacedComponents.length > 0) {
      issues.push({
        severity: 'warning',
        message: `${waveResult.unplacedComponents.length} component(s) required manual placement.`,
      });
    }

    const xmlFiles = await this.findXmlMetadataFiles(scanResult.projectRoot);
    const xmlResults = await this.xmlValidator.validateFiles(xmlFiles);
    for (const result of xmlResults) {
      for (const error of result.errors) {
        issues.push({
          severity: error.severity,
          message: error.message,
          filePath: result.filePath,
        });
      }

      for (const warning of result.warnings) {
        issues.push({
          severity: 'warning',
          message: warning.message,
          filePath: result.filePath,
        });
      }
    }

    const valid = issues.every((issue) => issue.severity !== 'error');

    logger.info('Deployment validation completed', {
      components: scanResult.components.length,
      totalWaves: waveResult.waves.length,
      xmlFilesValidated: xmlFiles.length,
      valid,
      issues: issues.length,
    });

    return {
      valid,
      components: scanResult.components.length,
      totalWaves: waveResult.waves.length,
      estimatedTime: waveResult.stats.totalEstimatedTime,
      xmlFilesValidated: xmlFiles.length,
      issues,
    };
  }

  public formatSummary(summary: DeploymentValidationSummary): string {
    const lines = [
      `Validation: ${summary.valid ? 'PASSED' : 'FAILED'}`,
      `Components: ${summary.components}`,
      `Waves: ${summary.totalWaves}`,
      `Estimated Time: ${summary.estimatedTime}s`,
      `XML Files Validated: ${summary.xmlFilesValidated}`,
    ];

    if (summary.issues.length > 0) {
      lines.push('');
      lines.push('Issues:');
      for (const issue of summary.issues) {
        const location = issue.filePath ? ` (${issue.filePath})` : '';
        lines.push(`- [${issue.severity}] ${issue.message}${location}`);
      }
    }

    return lines.join('\n');
  }

  private async findXmlMetadataFiles(projectRoot: string): Promise<string[]> {
    const files = await globAsync('**/*-meta.xml', {
      cwd: projectRoot,
      absolute: true,
      ignore: ['**/node_modules/**', '**/.git/**'],
    });

    return files.filter((filePath) => {
      const normalized = filePath.split(path.sep).join('/');
      return !normalized.includes('/node_modules/') && !normalized.includes('/.git/');
    });
  }
}
