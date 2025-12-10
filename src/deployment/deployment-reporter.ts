/**
 * Deployment Reporting - US-090
 * Generates comprehensive deployment reports
 *
 * @ac US-090-AC-1: Generate deployment summary
 * @ac US-090-AC-2: Include wave-by-wave breakdown
 * @ac US-090-AC-3: Include test results
 * @ac US-090-AC-4: Include timing information
 * @ac US-090-AC-5: Include error details
 * @ac US-090-AC-6: Export as JSON
 * @ac US-090-AC-7: Export as HTML
 * @ac US-090-AC-8: Save to file
 * @issue #90
 */

import * as fs from 'node:fs/promises';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('DeploymentReporter');

export interface WaveReport {
  waveNumber: number;
  components: number;
  startTime: string;
  endTime: string;
  duration: number;
  success: boolean;
  testsRun?: number;
  testFailures?: number;
  error?: string;
}

export interface DeploymentReport {
  deploymentId: string;
  targetOrg: string;
  startTime: string;
  endTime: string;
  totalDuration: number;
  success: boolean;
  totalWaves: number;
  completedWaves: number;
  totalComponents: number;
  totalTests: number;
  waves: WaveReport[];
  errors: string[];
}

/**
 * @ac US-090-AC-1: Generate deployment summary
 * @ac US-090-AC-2: Include wave-by-wave breakdown
 */
export class DeploymentReporter {
  /**
   * @ac US-090-AC-3: Include test results
   * @ac US-090-AC-4: Include timing information
   * @ac US-090-AC-5: Include error details
   */
  public generateReport(report: DeploymentReport): string {
    const lines = [
      '═'.repeat(60),
      '📊 DEPLOYMENT REPORT',
      '═'.repeat(60),
      '',
      `Deployment ID: ${report.deploymentId}`,
      `Target Org: ${report.targetOrg}`,
      `Status: ${report.success ? '✅ SUCCESS' : '❌ FAILED'}`,
      `Duration: ${report.totalDuration}s`,
      '',
      `Waves: ${report.completedWaves}/${report.totalWaves}`,
      `Components: ${report.totalComponents}`,
      `Tests: ${report.totalTests}`,
      '',
      '─'.repeat(60),
      'Wave Breakdown:',
      '─'.repeat(60),
    ];

    for (const wave of report.waves) {
      lines.push('');
      lines.push(`Wave ${wave.waveNumber}:`);
      lines.push(`  Components: ${wave.components}`);
      lines.push(`  Duration: ${wave.duration}s`);
      lines.push(`  Status: ${wave.success ? '✅' : '❌'}`);

      if (wave.testsRun !== undefined) {
        lines.push(`  Tests: ${wave.testsRun} (${wave.testFailures ?? 0} failures)`);
      }

      if (wave.error) {
        lines.push(`  Error: ${wave.error}`);
      }
    }

    if (report.errors.length > 0) {
      lines.push('');
      lines.push('─'.repeat(60));
      lines.push('Errors:');
      lines.push('─'.repeat(60));
      for (const error of report.errors) {
        lines.push(`  • ${error}`);
      }
    }

    lines.push('');
    lines.push('═'.repeat(60));

    return lines.join('\n');
  }

  /**
   * @ac US-090-AC-6: Export as JSON
   */
  public toJSON(report: DeploymentReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * @ac US-090-AC-7: Export as HTML
   */
  public toHTML(report: DeploymentReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Deployment Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .success { color: green; }
    .failure { color: red; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
  </style>
</head>
<body>
  <h1>Deployment Report</h1>
  <p><strong>Status:</strong> <span class="${report.success ? 'success' : 'failure'}">${report.success ? 'SUCCESS' : 'FAILED'}</span></p>
  <p><strong>Target:</strong> ${report.targetOrg}</p>
  <p><strong>Duration:</strong> ${report.totalDuration}s</p>

  <h2>Wave Breakdown</h2>
  <table>
    <tr>
      <th>Wave</th>
      <th>Components</th>
      <th>Duration</th>
      <th>Tests</th>
      <th>Status</th>
    </tr>
    ${report.waves.map(w => `
    <tr>
      <td>${w.waveNumber}</td>
      <td>${w.components}</td>
      <td>${w.duration}s</td>
      <td>${w.testsRun ?? 0}</td>
      <td class="${w.success ? 'success' : 'failure'}">${w.success ? '✅' : '❌'}</td>
    </tr>
    `).join('')}
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * @ac US-090-AC-8: Save to file
   */
  public async saveReport(report: DeploymentReport, format: 'json' | 'html' | 'text'): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `deployment-report-${timestamp}.${format}`;

    let content: string;
    switch (format) {
      case 'json':
        content = this.toJSON(report);
        break;
      case 'html':
        content = this.toHTML(report);
        break;
      default:
        content = this.generateReport(report);
    }

    await fs.writeFile(filename, content, 'utf-8');
    logger.info('Report saved', { filename });

    return filename;
  }
}

