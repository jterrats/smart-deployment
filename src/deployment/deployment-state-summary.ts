import type { DeploymentState } from './state-manager.js';

export type CycleRemediationStatusSummary = {
  cycleId: string;
  strategy: 'comment-reference' | 'manual';
  activePhase: 1 | 2;
  completedPhases: Array<1 | 2>;
  startedAt: string;
  editCount: number;
  statusText: string;
};

export type DeploymentStatusSummary = {
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
  cycleRemediation?: CycleRemediationStatusSummary;
  ai?: {
    provider?: string;
    model?: string;
    fallback?: boolean;
    aiAdjustments?: number;
    unknownTypes?: string[];
    inferenceFallback?: boolean;
    inferredDependencies?: number;
  };
};

function getMetadataNumber(metadata: Record<string, unknown>, key: string): number | undefined {
  const value = metadata[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getMetadataString(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === 'string' ? value : undefined;
}

function getMetadataBoolean(metadata: Record<string, unknown>, key: string): boolean | undefined {
  const value = metadata[key];
  return typeof value === 'boolean' ? value : undefined;
}

function getMetadataStringArray(metadata: Record<string, unknown>, key: string): string[] | undefined {
  const value = metadata[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;
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

  const failedWaveNumber = state.failedWave.waveNumber;

  return [...new Set([...rawCompleted.filter((wave) => wave < failedWaveNumber), ...inferredCompleted])].sort(
    (a, b) => a - b
  );
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

function describeCycleRemediationStatus(state: DeploymentState): CycleRemediationStatusSummary | undefined {
  if (state.cycleRemediation === undefined) {
    return undefined;
  }

  const { cycleId, strategy, activePhase, completedPhases, startedAt, editRecords } = state.cycleRemediation;
  const normalizedCompletedPhases = [...new Set(completedPhases)].sort((a, b) => a - b);
  let statusText: string;

  if (strategy === 'manual') {
    statusText = 'Manual remediation required before deployment can continue.';
  } else if (activePhase === 1) {
    statusText = 'Phase 1 of 2: Deploy temporarily cycle-broken metadata.';
  } else {
    statusText = 'Phase 2 of 2: Restore original references and redeploy the same components.';
  }

  return {
    cycleId,
    strategy,
    activePhase,
    completedPhases: normalizedCompletedPhases,
    startedAt,
    editCount: editRecords.length,
    statusText,
  };
}

function calculateEtaSeconds(
  metadata: Record<string, unknown>,
  state: DeploymentState,
  remainingWaves: number,
  completedWaves: number[],
  nowTimestamp: number
): number {
  const explicitEta = getMetadataNumber(metadata, 'estimatedTimeRemainingSeconds');
  const totalEstimatedTime = getMetadataNumber(metadata, 'totalEstimatedTimeSeconds');
  const averageWaveDuration = getMetadataNumber(metadata, 'averageWaveDurationSeconds');
  const startedAt = Date.parse(state.timestamp);

  if (explicitEta !== undefined) {
    return explicitEta;
  }

  if (remainingWaves === 0) {
    return 0;
  }

  if (totalEstimatedTime !== undefined && state.totalWaves > 0) {
    return Math.round((totalEstimatedTime / state.totalWaves) * remainingWaves);
  }

  if (!Number.isNaN(startedAt) && completedWaves.length > 0) {
    const elapsedSeconds = Math.max(1, Math.round((nowTimestamp - startedAt) / 1000));
    return Math.round((elapsedSeconds / completedWaves.length) * remainingWaves);
  }

  return Math.round((averageWaveDuration ?? 60) * remainingWaves);
}

function buildTestStatus(metadata: Record<string, unknown>): string {
  const testsRun = getMetadataNumber(metadata, 'testsRun');
  const testFailures = getMetadataNumber(metadata, 'testFailures');
  const configuredTestLevel = getMetadataString(metadata, 'testLevel');
  const skipTests = metadata.skipTests === true || configuredTestLevel === 'NoTestRun';

  return (
    getMetadataString(metadata, 'testStatus') ??
    (skipTests
      ? 'No tests run'
      : testsRun !== undefined
      ? `Tests run: ${testsRun}${testFailures !== undefined ? ` (${testFailures} failures)` : ''}`
      : configuredTestLevel
      ? `Pending (${configuredTestLevel})`
      : 'Not started')
  );
}

function buildAIStatus(metadata: Record<string, unknown>): DeploymentStatusSummary['ai'] {
  return {
    provider: getMetadataString(metadata, 'aiProvider'),
    model: getMetadataString(metadata, 'aiModel'),
    fallback: getMetadataBoolean(metadata, 'aiFallback'),
    aiAdjustments: getMetadataNumber(metadata, 'aiAdjustments'),
    unknownTypes: getMetadataStringArray(metadata, 'aiUnknownTypes'),
    inferenceFallback: getMetadataBoolean(metadata, 'aiInferenceFallback'),
    inferredDependencies: getMetadataNumber(metadata, 'aiInferredDependencies'),
  };
}

export function summarizeDeploymentState(state: DeploymentState, nowTimestamp = Date.now()): DeploymentStatusSummary {
  const metadata = state.metadata ?? {};
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
  const etaSeconds = calculateEtaSeconds(metadata, state, remainingWaves, completedWaves, nowTimestamp);
  const testStatus = buildTestStatus(metadata);
  const cycleRemediation = describeCycleRemediationStatus(state);
  const ai = buildAIStatus(metadata);
  const hasAIContext = ai !== undefined && Object.values(ai).some((value) => value !== undefined);

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
    cycleRemediation,
    ai: hasAIContext ? ai : undefined,
  };
}

export function createResumedState(
  state: DeploymentState,
  retryStrategy: 'standard' | 'quick' | 'validate-only',
  resumedAt = new Date().toISOString()
): DeploymentState {
  const metadata = { ...(state.metadata ?? {}) };
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

  if (summary.cycleRemediation !== undefined) {
    lines.push(`Cycle Remediation: ${summary.cycleRemediation.statusText}`);
    lines.push(`Remediation Cycle: ${summary.cycleRemediation.cycleId}`);
    lines.push(`Remediation Strategy: ${summary.cycleRemediation.strategy}`);
    lines.push(
      `Remediation Completed Phases: ${
        summary.cycleRemediation.completedPhases.length > 0
          ? summary.cycleRemediation.completedPhases.join(', ')
          : 'none'
      }`
    );
  }

  if (summary.ai !== undefined) {
    lines.push(`AI Provider: ${summary.ai.provider ?? 'unknown'}`);
    lines.push(`AI Model: ${summary.ai.model ?? 'default'}`);
    if (summary.ai.fallback !== undefined) {
      lines.push(`AI Fallback: ${summary.ai.fallback ? 'YES' : 'NO'}`);
    }
    if (summary.ai.aiAdjustments !== undefined) {
      lines.push(`AI Adjustments: ${summary.ai.aiAdjustments}`);
    }
    if (summary.ai.inferredDependencies !== undefined) {
      lines.push(`AI Inferred Dependencies: ${summary.ai.inferredDependencies}`);
    }
    if (summary.ai.inferenceFallback !== undefined) {
      lines.push(`AI Inference Fallback: ${summary.ai.inferenceFallback ? 'YES' : 'NO'}`);
    }
  }

  return lines;
}
