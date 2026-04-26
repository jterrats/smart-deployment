import type { DeploymentContextMessages } from '../deployment/deployment-context-service.js';
import type { ScanResult } from '../services/metadata-scanner-service.js';

export type StartPresenterIO = {
  log: (message: string) => void;
  warn: (message: string) => void;
};

export class StartCommandPresenter {
  public reportScanDiagnostics(io: StartPresenterIO, scanResult: ScanResult): void {
    scanResult.errors.forEach((message) => io.warn(message));
    scanResult.warnings.forEach((message) => io.warn(message));
  }

  public reportContextMessages(io: StartPresenterIO, messages: DeploymentContextMessages): void {
    messages.warnings.forEach((warning) => io.warn(warning));
    messages.logs.forEach((entry) => io.log(entry));
  }

  public reportAnalysisSummary(
    io: Pick<StartPresenterIO, 'log'>,
    options: {
      metadataCount: number;
      waves: number;
      aiEnabled: boolean;
    }
  ): void {
    io.log(`✅ Found ${options.metadataCount} metadata components`);
    io.log('🌊 Generating deployment waves...');
    io.log(`✅ Generated ${options.waves} waves`);

    if (options.aiEnabled) {
      io.log('🤖 AI-enhanced prioritization enabled');
    }
  }

  public reportDeploymentReport(io: Pick<StartPresenterIO, 'log'>, waves: number): void {
    io.log('\n📊 Deployment Report:');
    io.log(`   - Waves: ${waves}`);
    io.log('   - Status: Success');
  }
}
