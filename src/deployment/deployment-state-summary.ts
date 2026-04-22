import type { DeploymentState } from './state-manager.js';

export interface DeploymentStatusSummary {
  deploymentId: string;
  targetOrg: string;
  status: 'Not Started' | 'In Progress' | 'Failed' | 'Completed';
  currentWave: number;
  totalWaves: number;
  completedWaves: number[];
  remainingWaves: number;
  canResume: boolean;
  etaSeconds: number;
  testStatus: string;
  lastUpdated: string;
  failedWaveNumber?: number;
  failureReason?: string;
}

function getMetadataNumber(metadata: Record<string, unknown>, key: string): number | undefined {
  const value = metadata[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getMetadataString(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === 'string' ? value : undefined;
}

function normalizeCompletedWaves(state: DeploymentState): number[] {
  const rawCompleted = [...new Set(state.completedWaves)]
    .filter((wave) => Number.isInteger(wave) && wave > 0 && wave <= state.totalWaves)
    .sort((a, b) => a - b);

  if (!state.failedWave) {
    return rawCompleted;
  }

  const inferredCompleted = Array.from(
    { length: Math.max(0, state.failedWave.waveNumber - 1) },
    (_, index) => index + 1
  );

  return [...new Set([...rawCompleted.filter((wave) => wave < state.failedWave!.waveNumber), ...inferredCompleted])]
    .sort((a, b) => a - b);
}

function inferCurrentWave(state: DeploymentState, completedWaves: number[]): number {
  if (state.failedWave) {
    return state.failedWave.waveNumber;
  }

  if (state.currentWave && state.currentWave > 0) {
    return state.currentWave;
  }

  const lastCompleted = completedWaves.at(-1) ?? 0;
  return Math.min(lastCompleted + 1, Math.max(state.totalWaves, 1));
}

export function summarizeDeploymentState(
  state: DeploymentState,
  nowTimestamp = Date.now()
): DeploymentStatusSummary {
  const metadata = (state.metadata ?? {}) as Record<string, unknown>;
  const completedWaves = normalizeCompletedWaves(state);
  const currentWave = inferCurrentWave(state, completedWaves);
  const canResume = state.failedWave !== undefined;

  let status: DeploymentStatusSummary['status'] = 'In Progress';
  if (canResume) {
    status = 'Failed';
  } else if (state.totalWaves > 0 && completedWaves.length >= state.totalWaves) {
    status = 'Completed';
  }

  const remainingWaves = canResume
    ? Math.max(0, state.totalWaves - currentWave + 1)
    : Math.max(0, state.totalWaves - completedWaves.length);

  const explicitEta = getMetadataNumber(metadata, 'estimatedTimeRemainingSeconds');
  const totalEstimatedTime = getMetadataNumber(metadata, 'totalEstimatedTimeSeconds');
  const averageWaveDuration = getMetadataNumber(metadata, 'averageWaveDurationSeconds');
  const startedAt = Date.parse(state.timestamp);

  let etaSeconds = 0;
  if (explicitEta !== undefined) {
    etaSeconds = explicitEta;
  } else if (remainingWaves === 0) {
    etaSeconds = 0;
  } else if (totalEstimatedTime !== undefined && state.totalWaves > 0) {
    etaSeconds = Math.round((totalEstimatedTime / state.totalWaves) * remainingWaves);
  } else if (!Number.isNaN(startedAt) && completedWaves.length > 0) {
    const elapsedSeconds = Math.max(1, Math.round((nowTimestamp - startedAt) / 1000));
    etaSeconds = Math.round((elapsedSeconds / completedWaves.length) * remainingWaves);
  } else {
    etaSeconds = Math.round((averageWaveDuration ?? 60) * remainingWaves);
  }

  const testsRun = getMetadataNumber(metadata, 'testsRun');
  const testFailures = getMetadataNumber(metadata, 'testFailures');
  const configuredTestLevel = getMetadataString(metadata, 'testLevel');
  const skipTests = metadata.skipTests === true || configuredTestLevel === 'NoTestRun';
  const testStatus = getMetadataString(metadata, 'testStatus')
    ?? (skipTests
      ? 'No tests run'
      : testsRun !== undefined
        ? `Tests run: ${testsRun}${testFailures !== undefined ? ` (${testFailures} failures)` : ''}`
        : configuredTestLevel
          ? `Pending (${configuredTestLevel})`
          : 'Not started');

  return {
    deploymentId: state.deploymentId,
    targetOrg: state.targetOrg,
    status,
    currentWave,
    totalWaves: state.totalWaves,
    completedWaves,
    remainingWaves,
    canResume,
    etaSeconds,
    testStatus,
    lastUpdated: state.failedWave?.timestamp ?? state.timestamp,
    failedWaveNumber: state.failedWave?.waveNumber,
    failureReason: state.failedWave?.error,
  };
}

export function createResumedState(
  state: DeploymentState,
  retryStrategy: 'standard' | 'quick' | 'validate-only',
  resumedAt = new Date().toISOString()
): DeploymentState {
  const metadata = { ...(state.metadata ?? {}) } as Record<string, unknown>;
  const completedWaves = normalizeCompletedWaves(state);
  const resumeWave = state.failedWave?.waveNumber ?? inferCurrentWave(state, completedWaves);
  const previousResumeCount = typeof metadata.resumeCount === 'number' ? metadata.resumeCount : 0;

  return {
    ...state,
    timestamp: resumedAt,
    currentWave: resumeWave,
    completedWaves: completedWaves.filter((wave) => wave < resumeWave),
    failedWave: undefined,
    metadata: {
      ...metadata,
      lastKnownStatus: 'Resumed',
      resumedAt,
      retryStrategy,
      resumeCount: previousResumeCount + 1,
      resumedFromWave: resumeWave,
    },
  };
}

export function formatDeploymentStatus(summary: DeploymentStatusSummary): string[] {
  const lines = [
    `Deployment ID: ${summary.deploymentId}`,
    `Target Org: ${summary.targetOrg}`,
    `Status: ${summary.status}`,
    `Current Wave: ${summary.currentWave}/${summary.totalWaves}`,
    `Completed Waves: ${summary.completedWaves.length > 0 ? summary.completedWaves.join(', ') : 'none'}`,
    `Remaining Waves: ${summary.remainingWaves}`,
    `Estimated Time Remaining: ${summary.etaSeconds}s`,
    `Test Status: ${summary.testStatus}`,
    `Last Updated: ${summary.lastUpdated}`,
  ];

  if (summary.failedWaveNumber !== undefined && summary.failureReason) {
    lines.push(`Failure: Wave ${summary.failedWaveNumber} - ${summary.failureReason}`);
  }

  return lines;
}
