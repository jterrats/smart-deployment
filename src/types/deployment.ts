/**
 * Deployment Type Definitions
 */

import { type MetadataComponent, type MetadataType } from './metadata.js';
import { type NodeId } from './dependency.js';

/** Set of components deployed together */
export interface DeploymentWave {
  number: number; // 1-based
  components: NodeId[];
  metadataTypes: Set<MetadataType>;
  requiresTests: boolean;
  testClasses: string[];
  description: string;
  size: number;
}

export interface WaveGenerationResult {
  waves: DeploymentWave[]; // Ordered by dependencies
  stats: WaveStats;
  warnings: string[];
}

export interface WaveStats {
  totalWaves: number;
  totalComponents: number;
  wavesWithTests: number;
  wavesWithoutTests: number;
  largestWave: { number: number; size: number };
  smallestWave: { number: number; size: number };
  estimatedTime: number; // minutes
}

export interface DeploymentOptions {
  targetOrg: string;
  testLevel: TestLevel;
  failFast: boolean;
  ignoreWarnings: boolean;
  purgeOnDelete: boolean;
  dryRun: boolean; // Validate without deploying
  verbose: boolean;
}

export type TestLevel = 'NoTestRun' | 'RunSpecifiedTests' | 'RunLocalTests' | 'RunAllTestsInOrg';

export interface DeploymentResult {
  status: DeploymentStatus;
  waves: WaveResult[];
  totalTime: number; // ms
  successCount: number;
  failureCount: number;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  deployIds: string[]; // Salesforce deploy IDs
  errors: DeploymentError[];
}

export type DeploymentStatus = 'Success' | 'PartialSuccess' | 'Failed' | 'Cancelled' | 'InProgress';

export interface WaveResult {
  waveNumber: number;
  status: DeploymentStatus;
  deployId?: string;
  componentsDeployed: number;
  deployTime: number; // ms
  testsRun: number;
  errors: DeploymentError[];
}

export interface DeploymentError {
  component: string;
  componentDetails?: MetadataComponent; // For AI analysis
  type: MetadataType;
  message: string;
  line?: number;
  severity: 'warning' | 'error';
  stackTrace?: string;
}

/** Salesforce package.xml manifest */
export interface Manifest {
  fileName: string;
  content: string; // XML
  components: Record<MetadataType, string[]>; // Grouped by type
  apiVersion: string;
}

export interface ManifestGenerationOptions {
  apiVersion: string;
  includeManagedPackages: boolean;
  prettyPrint: boolean;
}
