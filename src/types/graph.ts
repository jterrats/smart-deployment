/**
 * Graph Algorithm Type Definitions
 */

/**
 * Generic graph node
 */
export type GraphNode<T> = {
  id: string;
  data: T;
  edges: Set<string>;
};

/**
 * Generic directed graph
 */
export type DirectedGraph<T> = Map<string, GraphNode<T>>;

/**
 * Resultado de topological sort
 */
export type TopologicalSortResult<T> = {
  /** Niveles ordenados (cada nivel puede ejecutarse en paralelo) */
  levels: T[][];
  /** Nodos con ciclos (no pudieron ser ordenados) */
  cyclic: T[];
  /** ¿El grafo tiene ciclos? */
  hasCycles: boolean;
};

/**
 * Opciones para algoritmos de grafo
 */
export type GraphAlgorithmOptions = {
  /** Función de comparación para ordenar nodos en el mismo nivel */
  compareFn?: <T>(a: T, b: T) => number;
  /** Detectar ciclos */
  detectCycles?: boolean;
};
