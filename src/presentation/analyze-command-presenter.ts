import type { ScanResult } from '../services/metadata-scanner-service.js';
import type { WaveResult } from '../waves/wave-builder.js';

export type AnalyzePresenterIO = {
  log: (message: string) => void;
};

export class AnalyzeCommandPresenter {
  public reportAnalysisSummary(io: AnalyzePresenterIO, scanResult: ScanResult, waveResult: WaveResult): void {
    const components = scanResult.components.length;
    const dependencies = scanResult.dependencyResult.stats.totalDependencies;
    const cycles = scanResult.dependencyResult.circularDependencies.length;

    io.log(`✅ Found ${components} components with ${dependencies} dependencies`);

    if (cycles > 0) {
      io.log(`⚠️  Warning: ${cycles} circular dependency cycle(s) detected`);
    }

    io.log('');
    io.log('🌊 Generating deployment waves...');
    io.log(`✅ Generated ${waveResult.waves.length} deployment wave(s)`);
    io.log(`   Total components: ${waveResult.totalComponents}`);
    if (waveResult.unplacedComponents.length > 0) {
      io.log(`   ⚠️  ${waveResult.unplacedComponents.length} component(s) couldn't be placed (circular deps)`);
    }
  }

  public reportPlanSaved(io: AnalyzePresenterIO, planPath: string): void {
    io.log(`✅ Deployment plan saved to: ${planPath}`);
    io.log('');
    io.log('💡 Next steps:');
    io.log('   1. Review the plan in your PR');
    io.log('   2. Commit the plan to your repo');
    io.log(`   3. Use ${planPath} as a reviewed deployment artifact in CI/CD`);
  }

  public reportReportSaved(io: AnalyzePresenterIO, outputPath: string, format: 'json' | 'html'): void {
    io.log(`📄 Report saved to: ${outputPath} (format: ${format})`);
  }
}
