/**
 * Dependency Graph Type Definitions
 */

import { type MetadataComponent } from './metadata.js';

/**
 * Nodo en el grafo de dependencias
 */
export type NodeId = string; // Format: "Type:Name"

/**
 * Dependency node in the graph (alias for MetadataComponent)
 * Each node represents a metadata component with its dependencies
 */
export type { MetadataComponent as DependencyNode } from './metadata.js';

/**
 * Grafo de dependencias
 * Map<from, Set<to>>
 */
export type DependencyGraph = Map<NodeId, Set<NodeId>>;

/**
 * Grafo inverso (dependientes)
 * Map<to, Set<from>>
 */
export type ReverseGraph = Map<NodeId, Set<NodeId>>;

/**
 * Resultado del análisis de dependencias
 */
export interface DependencyAnalysisResult {
  /** Mapa de todos los componentes por ID */
  components: Map<NodeId, MetadataComponent>;
  /** Grafo de dependencias (A → B significa "A depende de B") */
  graph: DependencyGraph;
  /** Grafo inverso (B ← A significa "B es dependido por A") */
  reverseGraph: ReverseGraph;
  /** Componentes con dependencias circulares */
  circularDependencies: CircularDependency[];
  /** Componentes aislados (sin dependencias ni dependientes) */
  isolatedComponents: NodeId[];
  /** Estadísticas */
  stats: DependencyStats;
}

/**
 * Dependencia circular detectada
 */
export interface CircularDependency {
  /** Nodos involucrados en el ciclo */
  cycle: NodeId[];
  /** Severidad del ciclo */
  severity: 'warning' | 'error';
  /** Mensaje descriptivo */
  message: string;
}

/**
 * Dependencia inferida (heurística o AI)
 */
export interface InferredDependency {
  /** Nodo origen */
  from: NodeId;
  /** Nodo destino */
  to: NodeId;
  /** Nivel de confianza (0-1) */
  confidence: number;
  /** Razón de la inferencia */
  reason: string;
}

/**
 * Estadísticas de dependencias
 */
export interface DependencyStats {
  /** Total de componentes analizados */
  totalComponents: number;
  /** Total de dependencias encontradas */
  totalDependencies: number;
  /** Componentes por tipo */
  componentsByType: Record<string, number>;
  /** Profundidad máxima del grafo */
  maxDepth: number;
  /** Nodo más dependido */
  mostDepended: { nodeId: NodeId; count: number };
  /** Nodo con más dependencias */
  mostDependencies: { nodeId: NodeId; count: number };
}

/**
 * Opciones para resolución de dependencias
 */
export interface DependencyResolutionOptions {
  /** Aplicar heurísticas inteligentes */
  applyHeuristics: boolean;
  /** Detectar y reportar dependencias circulares */
  detectCircularDeps: boolean;
  /** Seguir .forceignore */
  respectForceignore: boolean;
}
