/**
 * Deployment Type Definitions
 */

import { type MetadataComponent, type MetadataType } from './metadata.js';
import { type NodeId } from './dependency.js';

/**
 * Wave de deployment (conjunto de componentes que se despliegan juntos)
 */
export interface DeploymentWave {
  /** Número de wave (1-based) */
  number: number;
  /** Componentes en esta wave */
  components: NodeId[];
  /** Tipos de metadata en esta wave */
  metadataTypes: Set<MetadataType>;
  /** Requiere ejecución de tests */
  requiresTests: boolean;
  /** Test classes específicos para esta wave */
  testClasses: string[];
  /** Descripción de la wave */
  description: string;
  /** Tamaño estimado (número de componentes) */
  size: number;
}

/**
 * Resultado de la generación de waves
 */
export interface WaveGenerationResult {
  /** Array de waves ordenadas */
  waves: DeploymentWave[];
  /** Estadísticas de generación */
  stats: WaveStats;
  /** Warnings generados durante la generación */
  warnings: string[];
}

/**
 * Estadísticas de waves
 */
export interface WaveStats {
  /** Total de waves generadas */
  totalWaves: number;
  /** Total de componentes */
  totalComponents: number;
  /** Waves con tests */
  wavesWithTests: number;
  /** Waves sin tests (optimizadas) */
  wavesWithoutTests: number;
  /** Wave más grande */
  largestWave: { number: number; size: number };
  /** Wave más pequeña */
  smallestWave: { number: number; size: number };
  /** Tiempo estimado de deployment (minutos) */
  estimatedTime: number;
}

/**
 * Opciones de deployment
 */
export interface DeploymentOptions {
  /** Org destino */
  targetOrg: string;
  /** Nivel de tests */
  testLevel: TestLevel;
  /** Detener en primer fallo */
  failFast: boolean;
  /** Ignorar warnings */
  ignoreWarnings: boolean;
  /** Purge on delete */
  purgeOnDelete: boolean;
  /** Dry run (validar sin desplegar) */
  dryRun: boolean;
  /** Verbose output */
  verbose: boolean;
}

/**
 * Niveles de test de Salesforce
 */
export type TestLevel = 'NoTestRun' | 'RunSpecifiedTests' | 'RunLocalTests' | 'RunAllTestsInOrg';

/**
 * Resultado del deployment
 */
export interface DeploymentResult {
  /** Status general */
  status: DeploymentStatus;
  /** Waves ejecutadas */
  waves: WaveResult[];
  /** Tiempo total (ms) */
  totalTime: number;
  /** Componentes desplegados exitosamente */
  successCount: number;
  /** Componentes fallidos */
  failureCount: number;
  /** Tests ejecutados */
  testsRun: number;
  /** Tests pasados */
  testsPassed: number;
  /** Tests fallidos */
  testsFailed: number;
  /** Deploy IDs de Salesforce */
  deployIds: string[];
  /** Errores */
  errors: DeploymentError[];
}

/**
 * Status del deployment
 */
export type DeploymentStatus = 'Success' | 'PartialSuccess' | 'Failed' | 'Cancelled' | 'InProgress';

/**
 * Resultado de una wave individual
 */
export interface WaveResult {
  /** Número de wave */
  waveNumber: number;
  /** Status de la wave */
  status: DeploymentStatus;
  /** Deploy ID de Salesforce */
  deployId?: string;
  /** Componentes desplegados */
  componentsDeployed: number;
  /** Tiempo de deployment (ms) */
  deployTime: number;
  /** Tests ejecutados */
  testsRun: number;
  /** Errores */
  errors: DeploymentError[];
}

/**
 * Error de deployment
 */
export interface DeploymentError {
  /** Componente que falló */
  component: string;
  /** Metadata component completo (para contexto adicional) */
  componentDetails?: MetadataComponent;
  /** Tipo de metadata */
  type: MetadataType;
  /** Mensaje de error */
  message: string;
  /** Número de línea (si aplica) */
  line?: number;
  /** Severidad */
  severity: 'warning' | 'error';
  /** Stack trace (si disponible) */
  stackTrace?: string;
}

/**
 * Manifest (package.xml)
 */
export interface Manifest {
  /** Nombre del archivo */
  fileName: string;
  /** Contenido XML */
  content: string;
  /** Componentes incluidos agrupados por tipo */
  components: Record<MetadataType, string[]>;
  /** Versión de API */
  apiVersion: string;
}

/**
 * Opciones para generación de manifests
 */
export interface ManifestGenerationOptions {
  /** Versión de API */
  apiVersion: string;
  /** Incluir managed packages */
  includeManagedPackages: boolean;
  /** Formato XML */
  prettyPrint: boolean;
}

