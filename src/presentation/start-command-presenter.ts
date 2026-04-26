export type StartPresenterIO = {
  log: (message: string) => void;
  warn: (message: string) => void;
};

export class StartCommandPresenter {
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
