import { type MetadataComponent, type MetadataType } from './metadata.js';
import { type DeploymentWave } from './deployment.js';
import { type NodeId } from './dependency.js';

export interface AnalysisContext {
  components: MetadataComponent[];
  staticDependencies: Map<NodeId, Set<NodeId>>;
  orgType: 'sandbox' | 'production' | 'scratch';
  deploymentHistory?: DeploymentHistoryEntry[];
}

export interface DeploymentHistoryEntry {
  timestamp: string;
  componentsDeployed: string[];
  success: boolean;
  errors?: string[];
  duration: number; // ms
}

export interface AgentforceAnalysisResult {
  inferredDependencies: InferredDependency[];
  priorityAdjustments: PriorityAdjustment[];
  warnings: AIWarning[];
  optimizations: AIOptimization[];
  confidenceScore: number; // 0-1
  analysisTime: number; // ms
}

export interface InferredDependency {
  from: NodeId;
  to: NodeId;
  metadataType?: MetadataType; // For filtering/prioritization
  reason: string;
  confidence: number; // 0-1
  inferenceType: InferenceType;
}

export type InferenceType =
  | 'semantic-analysis'
  | 'naming-convention'
  | 'business-logic'
  | 'historical-pattern'
  | 'api-usage'
  | 'complex-relationship';

export interface PriorityAdjustment {
  component: NodeId;
  currentPriority: number;
  suggestedPriority: number;
  reason: string;
  impact: 'low' | 'medium' | 'high';
}

export interface AIWarning {
  type: AIWarningType;
  message: string;
  affectedComponents: NodeId[];
  severity: 'info' | 'warning' | 'error';
  suggestion?: string;
}

export type AIWarningType =
  | 'potential-circular-dependency'
  | 'missing-dependency'
  | 'suboptimal-order'
  | 'performance-impact'
  | 'test-coverage-gap'
  | 'breaking-change-risk';

export interface AIOptimization {
  type: AIOptimizationType;
  description: string;
  estimatedBenefit: number; // Saved seconds
  howToApply: string;
  affectedComponents: NodeId[];
}

export type AIOptimizationType =
  | 'wave-consolidation'
  | 'test-parallelization'
  | 'dependency-reduction'
  | 'batch-optimization'
  | 'test-selection';

export interface WaveValidationRequest {
  /** Proposed waves */
  waves: DeploymentWave[];
  /** Deployment context */
  context: AnalysisContext;
  /** Validation level (quick, normal, deep) */
  validationLevel: 'quick' | 'normal' | 'deep';
}

export interface WaveValidationResult {
  /** Are the waves valid? */
  isValid: boolean;
  /** Quality score (0-100) */
  qualityScore: number;
  /** Detected issues */
  issues: ValidationIssue[];
  /** Improvement suggestions */
  improvements: WaveImprovement[];
  /** Optimized waves (if requested) */
  optimizedWaves?: DeploymentWave[];
}

export interface ValidationIssue {
  /** Affected wave */
  waveNumber: number;
  /** Issue type */
  issueType: ValidationIssueType;
  /** Description */
  description: string;
  /** Severity */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** How to resolve it */
  resolution: string;
}

export type ValidationIssueType =
  | 'dependency-violation' // Dependency violation
  | 'order-conflict' // Order conflict
  | 'size-limit-exceeded' // Size limit exceeded
  | 'test-coverage-missing' // Missing test coverage
  | 'circular-reference'; // Circular reference

export interface WaveImprovement {
  /** Wave to improve */
  waveNumber: number;
  /** Improvement type */
  improvementType: ImprovementType;
  /** Description */
  description: string;
  /** Estimated benefit */
  benefit: string;
}

export type ImprovementType =
  | 'reorder-components' // Reorder components
  | 'split-wave' // Split wave
  | 'merge-waves' // Merge waves
  | 'add-test-class' // Add test class
  | 'remove-redundancy'; // Remove redundancy

export interface AgentforcePrompt {
  /** Requested analysis type */
  analysisType: AnalysisType;
  /** Analysis context */
  context: string;
  /** Metadata to analyze (serialized) */
  metadata: string;
  /** Model temperature (0-1) */
  temperature?: number;
  /** Max tokens */
  maxTokens?: number;
}

export type AnalysisType =
  | 'dependency-inference' // Infer dependencies
  | 'priority-weighting' // Weight priorities
  | 'wave-validation' // Validate waves
  | 'optimization-suggestion' // Suggest optimizations
  | 'risk-assessment' // Assess risks
  | 'test-strategy'; // Testing strategy

export interface AgentforceResponse {
  /** Generated analysis */
  analysis: string;
  /** Structured data (if applicable) */
  structuredData?: Record<string, unknown>;
  /** Tokens used */
  tokensUsed: number;
  /** Model used */
  model: string;
  /** Timestamp */
  timestamp: string;
}

export interface AgentforceConfig {
  /** Agentforce endpoint */
  endpoint: string;
  /** Model to use */
  model: 'claude-sonnet' | 'gpt-4' | 'einstein-gpt';
  /** API Key (optional if using Named Credential) */
  apiKey?: string;
  /** Salesforce Named Credential */
  namedCredential?: string;
  /** Timeout in ms */
  timeout: number;
  /** Retries in case of failure */
  retries: number;
  /** Enable response cache */
  enableCache: boolean;
}

export interface AgentforceMetrics {
  /** Total requests */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Total tokens used */
  totalTokens: number;
  /** Average response time (ms) */
  avgResponseTime: number;
  /** Cache hits */
  cacheHits: number;
  /** Cache misses */
  cacheMisses: number;
}
