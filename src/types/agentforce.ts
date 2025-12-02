/**
 * Agentforce AI Integration Type Definitions
 * Integración con el LLM de Salesforce para análisis inteligente
 */

import { type MetadataComponent, type MetadataType } from './metadata.js';
import { type DeploymentWave } from './deployment.js';
import { type NodeId } from './dependency.js';

/**
 * Contexto de análisis para Agentforce
 */
export interface AnalysisContext {
  /** Componentes a analizar */
  components: MetadataComponent[];
  /** Dependencias detectadas por parsers estáticos */
  staticDependencies: Map<NodeId, Set<NodeId>>;
  /** Tipo de org (sandbox, production, scratch) */
  orgType: 'sandbox' | 'production' | 'scratch';
  /** Historial de deployments previos (si existe) */
  deploymentHistory?: DeploymentHistoryEntry[];
}

/**
 * Historial de deployments previos
 */
export interface DeploymentHistoryEntry {
  timestamp: string;
  componentsDeployed: string[];
  success: boolean;
  errors?: string[];
  duration: number;
}

/**
 * Resultado del análisis de Agentforce
 */
export interface AgentforceAnalysisResult {
  /** Dependencias adicionales inferidas por IA */
  inferredDependencies: InferredDependency[];
  /** Ajustes de prioridad sugeridos */
  priorityAdjustments: PriorityAdjustment[];
  /** Warnings sobre potenciales problemas */
  warnings: AIWarning[];
  /** Optimizaciones sugeridas */
  optimizations: AIOptimization[];
  /** Nivel de confianza del análisis (0-1) */
  confidenceScore: number;
  /** Tiempo de análisis (ms) */
  analysisTime: number;
}

/**
 * Dependencia inferida por IA
 */
export interface InferredDependency {
  /** Componente origen */
  from: NodeId;
  /** Componente destino */
  to: NodeId;
  /** Tipo de metadata (usado para filtrado y priorización) */
  metadataType?: MetadataType;
  /** Razón de la inferencia */
  reason: string;
  /** Nivel de confianza (0-1) */
  confidence: number;
  /** Tipo de inferencia */
  inferenceType: InferenceType;
}

/**
 * Tipos de inferencia de dependencias
 */
export type InferenceType =
  | 'semantic-analysis' // Análisis semántico del código
  | 'naming-convention' // Convenciones de nombres
  | 'business-logic' // Lógica de negocio
  | 'historical-pattern' // Patrones históricos
  | 'api-usage' // Uso de APIs
  | 'complex-relationship'; // Relaciones complejas no obvias

/**
 * Ajuste de prioridad sugerido por IA
 */
export interface PriorityAdjustment {
  /** Componente a ajustar */
  component: NodeId;
  /** Prioridad actual */
  currentPriority: number;
  /** Prioridad sugerida */
  suggestedPriority: number;
  /** Razón del ajuste */
  reason: string;
  /** Impacto estimado (bajo, medio, alto) */
  impact: 'low' | 'medium' | 'high';
}

/**
 * Warning generado por IA
 */
export interface AIWarning {
  /** Tipo de warning */
  type: AIWarningType;
  /** Mensaje descriptivo */
  message: string;
  /** Componentes afectados */
  affectedComponents: NodeId[];
  /** Severidad */
  severity: 'info' | 'warning' | 'error';
  /** Sugerencia de resolución */
  suggestion?: string;
}

/**
 * Tipos de warnings de IA
 */
export type AIWarningType =
  | 'potential-circular-dependency' // Posible dependencia circular
  | 'missing-dependency' // Dependencia potencialmente faltante
  | 'suboptimal-order' // Orden subóptimo
  | 'performance-impact' // Impacto en performance
  | 'test-coverage-gap' // Gap en cobertura de tests
  | 'breaking-change-risk'; // Riesgo de breaking change

/**
 * Optimización sugerida por IA
 */
export interface AIOptimization {
  /** Tipo de optimización */
  type: AIOptimizationType;
  /** Descripción de la optimización */
  description: string;
  /** Beneficio estimado (tiempo ahorrado en segundos) */
  estimatedBenefit: number;
  /** Cómo aplicar la optimización */
  howToApply: string;
  /** Componentes afectados */
  affectedComponents: NodeId[];
}

/**
 * Tipos de optimización
 */
export type AIOptimizationType =
  | 'wave-consolidation' // Consolidar waves
  | 'test-parallelization' // Paralelizar tests
  | 'dependency-reduction' // Reducir dependencias innecesarias
  | 'batch-optimization' // Optimizar tamaño de batches
  | 'test-selection'; // Selección inteligente de tests

/**
 * Solicitud de validación a Agentforce
 */
export interface WaveValidationRequest {
  /** Waves propuestas */
  waves: DeploymentWave[];
  /** Contexto de deployment */
  context: AnalysisContext;
  /** Nivel de validación (rápido, normal, profundo) */
  validationLevel: 'quick' | 'normal' | 'deep';
}

/**
 * Resultado de validación de waves
 */
export interface WaveValidationResult {
  /** ¿Las waves son válidas? */
  isValid: boolean;
  /** Score de calidad (0-100) */
  qualityScore: number;
  /** Problemas detectados */
  issues: ValidationIssue[];
  /** Sugerencias de mejora */
  improvements: WaveImprovement[];
  /** Waves optimizadas (si se solicitó) */
  optimizedWaves?: DeploymentWave[];
}

/**
 * Problema de validación
 */
export interface ValidationIssue {
  /** Wave afectada */
  waveNumber: number;
  /** Tipo de problema */
  issueType: ValidationIssueType;
  /** Descripción */
  description: string;
  /** Severidad */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Cómo resolverlo */
  resolution: string;
}

/**
 * Tipos de problemas de validación
 */
export type ValidationIssueType =
  | 'dependency-violation' // Violación de dependencia
  | 'order-conflict' // Conflicto de orden
  | 'size-limit-exceeded' // Límite de tamaño excedido
  | 'test-coverage-missing' // Falta cobertura de tests
  | 'circular-reference'; // Referencia circular

/**
 * Mejora sugerida para waves
 */
export interface WaveImprovement {
  /** Wave a mejorar */
  waveNumber: number;
  /** Tipo de mejora */
  improvementType: ImprovementType;
  /** Descripción */
  description: string;
  /** Beneficio estimado */
  benefit: string;
}

/**
 * Tipos de mejoras
 */
export type ImprovementType =
  | 'reorder-components' // Reordenar componentes
  | 'split-wave' // Dividir wave
  | 'merge-waves' // Fusionar waves
  | 'add-test-class' // Agregar test class
  | 'remove-redundancy'; // Eliminar redundancia

/**
 * Prompt para Agentforce
 */
export interface AgentforcePrompt {
  /** Tipo de análisis solicitado */
  analysisType: AnalysisType;
  /** Contexto del análisis */
  context: string;
  /** Metadata a analizar (serializada) */
  metadata: string;
  /** Temperatura del modelo (0-1) */
  temperature?: number;
  /** Max tokens */
  maxTokens?: number;
}

/**
 * Tipos de análisis que puede realizar Agentforce
 */
export type AnalysisType =
  | 'dependency-inference' // Inferir dependencias
  | 'priority-weighting' // Ponderar prioridades
  | 'wave-validation' // Validar waves
  | 'optimization-suggestion' // Sugerir optimizaciones
  | 'risk-assessment' // Evaluar riesgos
  | 'test-strategy'; // Estrategia de testing

/**
 * Respuesta de Agentforce
 */
export interface AgentforceResponse {
  /** Análisis generado */
  analysis: string;
  /** Structured data (si aplica) */
  structuredData?: Record<string, unknown>;
  /** Tokens usados */
  tokensUsed: number;
  /** Modelo usado */
  model: string;
  /** Timestamp */
  timestamp: string;
}

/**
 * Configuración de Agentforce
 */
export interface AgentforceConfig {
  /** Endpoint de Agentforce */
  endpoint: string;
  /** Modelo a usar */
  model: 'claude-sonnet' | 'gpt-4' | 'einstein-gpt';
  /** API Key (opcional si usa Named Credential) */
  apiKey?: string;
  /** Named Credential de Salesforce */
  namedCredential?: string;
  /** Timeout en ms */
  timeout: number;
  /** Reintentos en caso de fallo */
  retries: number;
  /** Habilitar cache de respuestas */
  enableCache: boolean;
}

/**
 * Métricas de uso de Agentforce
 */
export interface AgentforceMetrics {
  /** Total de solicitudes */
  totalRequests: number;
  /** Solicitudes exitosas */
  successfulRequests: number;
  /** Solicitudes fallidas */
  failedRequests: number;
  /** Tokens totales usados */
  totalTokens: number;
  /** Tiempo promedio de respuesta (ms) */
  avgResponseTime: number;
  /** Cache hits */
  cacheHits: number;
  /** Cache misses */
  cacheMisses: number;
}

