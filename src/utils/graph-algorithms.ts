/**
 * Graph Algorithms for Dependency Analysis
 *
 * Provides efficient algorithms for analyzing metadata dependency graphs:
 * - Topological sorting for deployment ordering
 * - Cycle detection for identifying circular dependencies
 * - Depth calculation for determining deployment waves
 * - Path finding for dependency tracing
 */

export type NodeId = string;

export type GraphNode = {
  nodeId: NodeId;
  dependencies: Set<NodeId>;
};

export type DependencyGraph = Map<NodeId, GraphNode>;

export type CycleDetectionResult = {
  hasCycles: boolean;
  cycles: NodeId[][];
};

/**
 * Performs topological sort using Kahn's algorithm (BFS-based)
 *
 * @ac US-002-AC-1
 * @param dependencyGraph - Graph where edges represent dependencies
 * @returns Array of node IDs in topological order (dependencies first)
 */
export function topologicalSort(dependencyGraph: DependencyGraph): NodeId[] {
  const sortedNodes: NodeId[] = [];
  const remainingDependencies = new Map<NodeId, Set<NodeId>>();
  const readyQueue: NodeId[] = [];

  // Initialize: copy all dependencies
  for (const [nodeId, graphNode] of dependencyGraph) {
    remainingDependencies.set(nodeId, new Set(graphNode.dependencies));
  }

  // Find all nodes with no dependencies (ready to process)
  for (const [nodeId, dependencies] of remainingDependencies) {
    if (dependencies.size === 0) {
      readyQueue.push(nodeId);
    }
  }

  // Process nodes in topological order
  while (readyQueue.length > 0) {
    const currentNodeId = readyQueue.shift()!;
    sortedNodes.push(currentNodeId);

    // Remove this node from all other nodes' dependencies
    for (const [nodeId, dependencies] of remainingDependencies) {
      if (dependencies.has(currentNodeId)) {
        dependencies.delete(currentNodeId);

        // If node now has no dependencies, add to ready queue
        if (dependencies.size === 0 && !sortedNodes.includes(nodeId)) {
          readyQueue.push(nodeId);
        }
      }
    }
  }

  return sortedNodes;
}

/**
 * Detects cycles using Depth-First Search with color marking
 *
 * @ac US-002-AC-2
 * @param dependencyGraph - Graph to analyze for cycles
 * @returns Detection result with all found cycles
 */
export function detectCycles(dependencyGraph: DependencyGraph): CycleDetectionResult {
  const visitedNodes = new Set<NodeId>();
  const recursionStack = new Set<NodeId>();
  const discoveredCycles: NodeId[][] = [];
  const pathToNode: NodeId[] = [];

  function depthFirstSearch(currentNodeId: NodeId): boolean {
    visitedNodes.add(currentNodeId);
    recursionStack.add(currentNodeId);
    pathToNode.push(currentNodeId);

    const currentNode = dependencyGraph.get(currentNodeId);
    if (currentNode) {
      for (const dependencyId of currentNode.dependencies) {
        if (!visitedNodes.has(dependencyId)) {
          if (depthFirstSearch(dependencyId)) {
            return true; // Cycle found in subtree
          }
        } else if (recursionStack.has(dependencyId)) {
          // Found a cycle!
          const cycleStartIndex = pathToNode.indexOf(dependencyId);
          const cycleNodes = pathToNode.slice(cycleStartIndex);
          discoveredCycles.push(cycleNodes);
          return true;
        }
      }
    }

    recursionStack.delete(currentNodeId);
    pathToNode.pop();
    return false;
  }

  for (const [nodeId] of dependencyGraph) {
    if (!visitedNodes.has(nodeId)) {
      depthFirstSearch(nodeId);
      pathToNode.length = 0; // Clear path for next component
    }
  }

  return {
    hasCycles: discoveredCycles.length > 0,
    cycles: discoveredCycles,
  };
}

/**
 * Calculates dependency depth (longest path from root)
 *
 * @ac US-002-AC-3
 * @param dependencyGraph - Graph to analyze
 * @returns Map of node ID to its depth level
 */
export function calculateDepth(dependencyGraph: DependencyGraph): Map<NodeId, number> {
  const depthMap = new Map<NodeId, number>();
  const visitedNodes = new Set<NodeId>();

  function calculateNodeDepth(nodeId: NodeId): number {
    if (depthMap.has(nodeId)) {
      return depthMap.get(nodeId)!;
    }

    if (visitedNodes.has(nodeId)) {
      // Circular dependency, return large number
      return Infinity;
    }

    visitedNodes.add(nodeId);

    const currentNode = dependencyGraph.get(nodeId);
    if (!currentNode || currentNode.dependencies.size === 0) {
      depthMap.set(nodeId, 0);
      visitedNodes.delete(nodeId);
      return 0;
    }

    let maximumDepth = 0;
    for (const dependencyId of currentNode.dependencies) {
      const dependencyDepth = calculateNodeDepth(dependencyId);
      maximumDepth = Math.max(maximumDepth, dependencyDepth + 1);
    }

    depthMap.set(nodeId, maximumDepth);
    visitedNodes.delete(nodeId);
    return maximumDepth;
  }

  for (const [nodeId] of dependencyGraph) {
    if (!depthMap.has(nodeId)) {
      calculateNodeDepth(nodeId);
    }
  }

  return depthMap;
}

/**
 * Finds shortest path between two nodes using BFS
 *
 * @ac US-002-AC-4
 * @param dependencyGraph - Graph to search
 * @param startNodeId - Starting node
 * @param targetNodeId - Target node to find
 * @returns Array representing path from start to target, or null if no path exists
 */
export function findPath(dependencyGraph: DependencyGraph, startNodeId: NodeId, targetNodeId: NodeId): NodeId[] | null {
  if (startNodeId === targetNodeId) {
    return [startNodeId];
  }

  const visitedNodes = new Set<NodeId>();
  const searchQueue: Array<{ currentNodeId: NodeId; pathSoFar: NodeId[] }> = [
    { currentNodeId: startNodeId, pathSoFar: [startNodeId] },
  ];

  while (searchQueue.length > 0) {
    const { currentNodeId, pathSoFar } = searchQueue.shift()!;

    if (visitedNodes.has(currentNodeId)) {
      continue;
    }

    visitedNodes.add(currentNodeId);

    const currentNode = dependencyGraph.get(currentNodeId);
    if (!currentNode) continue;

    for (const dependencyId of currentNode.dependencies) {
      if (dependencyId === targetNodeId) {
        return [...pathSoFar, dependencyId];
      }

      if (!visitedNodes.has(dependencyId)) {
        searchQueue.push({
          currentNodeId: dependencyId,
          pathSoFar: [...pathSoFar, dependencyId],
        });
      }
    }
  }

  return null;
}
