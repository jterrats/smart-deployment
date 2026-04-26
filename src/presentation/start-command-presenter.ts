export type StartPresenterIO = {
  log: (message: string) => void;
  warn: (message: string) => void;
};

export class StartCommandPresenter {
  public reportExecutionStart(io: Pick<StartPresenterIO, 'log'>): void {
    io.log('🚀 Executing deployment...');
  }

  public reportExecutionSkipped(io: Pick<StartPresenterIO, 'log'>, reason: 'dry-run' | 'validate-only'): void {
    if (reason === 'dry-run') {
      io.log('🔍 Dry-run mode: skipping actual deployment');
      return;
    }

    io.log('🔍 Validate-only mode: skipping actual deployment');
  }

  public reportReportGenerationStart(io: Pick<StartPresenterIO, 'log'>): void {
    io.log('📄 Generating deployment report...');
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
