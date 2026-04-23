/**
 * Cycle Remediation Planner
 *
 * First-slice planner that identifies strongly connected components, detects
 * self-loops, and classifies cycles for safe remediation planning.
 */

import type { DependencyGraph, NodeId } from '../types/dependency.js';
import type { MetadataComponent } from '../types/metadata.js';

export type CycleRemediationStrategy = 'comment-reference' | 'manual';

export interface CycleRemediationSourceEdit {
  nodeId: NodeId;
  targetDependency: NodeId;
  operation: 'comment-reference';
  filePath?: string;
  targetDescription: string;
}

export interface CycleRemediationDeployPhase {
  phase: 1 | 2;
  description: string;
  components: NodeId[];
  restoreEdits?: boolean;
}

export interface RemediationCycle {
  id: string;
  nodes: NodeId[];
  strategy: CycleRemediationStrategy;
  warnings: string[];
  edits: CycleRemediationSourceEdit[];
  deployPhases: CycleRemediationDeployPhase[];
}

export interface CycleRemediationPlan {
  cycles: RemediationCycle[];
  supported: boolean;
  warnings: string[];
}

export interface CycleRemediationPlannerOptions {
  components?: ReadonlyMap<NodeId, MetadataComponent>;
}

type InternalEdge = {
  from: NodeId;
  to: NodeId;
};

const SUPPORTED_AUTOMATIC_TYPES = new Set(['ApexClass']);

function compareNodeIds(left: NodeId, right: NodeId): number {
  return left.localeCompare(right);
}

function parseTypeFromNodeId(nodeId: NodeId): string {
  const separatorIndex = nodeId.indexOf(':');
  return separatorIndex === -1 ? 'Unknown' : nodeId.slice(0, separatorIndex);
}

function collectGraphNodeIds(graph: DependencyGraph): NodeId[] {
  const nodeIds = new Set<NodeId>();

  for (const [nodeId, dependencies] of graph) {
    nodeIds.add(nodeId);
    for (const dependencyId of dependencies) {
      nodeIds.add(dependencyId);
    }
  }

  return [...nodeIds].sort(compareNodeIds);
}

function getSortedDependencies(graph: DependencyGraph, nodeId: NodeId): NodeId[] {
  return [...(graph.get(nodeId) ?? new Set<NodeId>())].sort(compareNodeIds);
}

function getNodeType(nodeId: NodeId, components?: ReadonlyMap<NodeId, MetadataComponent>): string {
  return components?.get(nodeId)?.type ?? parseTypeFromNodeId(nodeId);
}

function createCycleId(nodes: NodeId[]): string {
  return nodes.join('|');
}

export class CycleRemediationPlanner {
  private readonly graph: DependencyGraph;
  private readonly components?: ReadonlyMap<NodeId, MetadataComponent>;

  public constructor(graph: DependencyGraph, options: CycleRemediationPlannerOptions = {}) {
    this.graph = graph;
    this.components = options.components;
  }

  public createPlan(): CycleRemediationPlan {
    const cycles = this.findCycles().map((cycleNodes) => this.planCycle(cycleNodes));
    const warnings = [...new Set(cycles.flatMap((cycle) => cycle.warnings))].sort();

    return {
      cycles,
      supported: cycles.every((cycle) => cycle.strategy === 'comment-reference'),
      warnings,
    };
  }

  private findCycles(): NodeId[][] {
    const nodeIds = collectGraphNodeIds(this.graph);
    const indexMap = new Map<NodeId, number>();
    const lowLinkMap = new Map<NodeId, number>();
    const activeStack = new Set<NodeId>();
    const stack: NodeId[] = [];
    const stronglyConnectedComponents: NodeId[][] = [];
    let currentIndex = 0;

    const visit = (nodeId: NodeId): void => {
      indexMap.set(nodeId, currentIndex);
      lowLinkMap.set(nodeId, currentIndex);
      currentIndex += 1;
      stack.push(nodeId);
      activeStack.add(nodeId);

      for (const dependencyId of getSortedDependencies(this.graph, nodeId)) {
        if (!indexMap.has(dependencyId)) {
          visit(dependencyId);
          lowLinkMap.set(nodeId, Math.min(lowLinkMap.get(nodeId)!, lowLinkMap.get(dependencyId)!));
        } else if (activeStack.has(dependencyId)) {
          lowLinkMap.set(nodeId, Math.min(lowLinkMap.get(nodeId)!, indexMap.get(dependencyId)!));
        }
      }

      if (lowLinkMap.get(nodeId) !== indexMap.get(nodeId)) {
        return;
      }

      const component: NodeId[] = [];
      while (stack.length > 0) {
        const stackNodeId = stack.pop()!;
        activeStack.delete(stackNodeId);
        component.push(stackNodeId);

        if (stackNodeId === nodeId) {
          break;
        }
      }

      stronglyConnectedComponents.push(component.sort(compareNodeIds));
    };

    for (const nodeId of nodeIds) {
      if (!indexMap.has(nodeId)) {
        visit(nodeId);
      }
    }

    return stronglyConnectedComponents
      .filter((component) => {
        if (component.length > 1) {
          return true;
        }

        const [nodeId] = component;
        return (this.graph.get(nodeId) ?? new Set<NodeId>()).has(nodeId);
      })
      .sort((left, right) => createCycleId(left).localeCompare(createCycleId(right)));
  }

  private planCycle(nodes: NodeId[]): RemediationCycle {
    const nodeSet = new Set(nodes);
    const internalEdges = this.getInternalEdges(nodes, nodeSet);
    const nodeTypes = [...new Set(nodes.map((nodeId) => getNodeType(nodeId, this.components)))].sort();
    const warnings: string[] = [];

    let strategy: CycleRemediationStrategy = 'manual';
    let edits: CycleRemediationSourceEdit[] = [];

    if (!nodeTypes.every((type) => SUPPORTED_AUTOMATIC_TYPES.has(type))) {
      warnings.push(
        `Automatic remediation currently supports ApexClass-only cycles; found ${nodeTypes.join(
          ', '
        )} in ${createCycleId(nodes)}.`
      );
    } else if (!this.isSimpleCycle(nodes, internalEdges)) {
      warnings.push(
        `Cycle ${createCycleId(nodes)} requires manual remediation because it is not a simple directed cycle.`
      );
    } else {
      strategy = 'comment-reference';
      edits = [this.createCommentReferenceEdit(internalEdges[0])];

      for (const nodeId of nodes) {
        if (!this.components?.get(nodeId)?.filePath) {
          warnings.push(
            `Missing component file path for ${nodeId}; execution must resolve the source file before applying edits.`
          );
        }
      }
    }

    return {
      id: createCycleId(nodes),
      nodes,
      strategy,
      warnings: warnings.sort(),
      edits,
      deployPhases: this.createDeployPhases(nodes, strategy),
    };
  }

  private getInternalEdges(nodes: NodeId[], nodeSet: ReadonlySet<NodeId>): InternalEdge[] {
    return nodes
      .flatMap((nodeId) =>
        getSortedDependencies(this.graph, nodeId)
          .filter((dependencyId) => nodeSet.has(dependencyId))
          .map((dependencyId) => ({ from: nodeId, to: dependencyId }))
      )
      .sort((left, right) => {
        const fromComparison = compareNodeIds(left.from, right.from);
        return fromComparison !== 0 ? fromComparison : compareNodeIds(left.to, right.to);
      });
  }

  private isSimpleCycle(nodes: NodeId[], internalEdges: InternalEdge[]): boolean {
    if (nodes.length === 1) {
      return internalEdges.length === 1 && internalEdges[0].from === internalEdges[0].to;
    }

    if (internalEdges.length !== nodes.length) {
      return false;
    }

    const outgoingCounts = new Map<NodeId, number>();
    const incomingCounts = new Map<NodeId, number>();

    for (const { from, to } of internalEdges) {
      outgoingCounts.set(from, (outgoingCounts.get(from) ?? 0) + 1);
      incomingCounts.set(to, (incomingCounts.get(to) ?? 0) + 1);
    }

    return nodes.every((nodeId) => outgoingCounts.get(nodeId) === 1 && incomingCounts.get(nodeId) === 1);
  }

  private createCommentReferenceEdit(edge: InternalEdge): CycleRemediationSourceEdit {
    return {
      nodeId: edge.from,
      targetDependency: edge.to,
      operation: 'comment-reference',
      filePath: this.components?.get(edge.from)?.filePath,
      targetDescription: `Temporarily comment the ${edge.from} reference to ${edge.to} during phase 1.`,
    };
  }

  private createDeployPhases(nodes: NodeId[], strategy: CycleRemediationStrategy): CycleRemediationDeployPhase[] {
    if (strategy === 'comment-reference') {
      return [
        {
          phase: 1,
          description: 'Deploy temporarily cycle-broken metadata.',
          components: nodes,
        },
        {
          phase: 2,
          description: 'Restore original references and redeploy the same components.',
          components: nodes,
          restoreEdits: true,
        },
      ];
    }

    return [
      {
        phase: 1,
        description: 'Manual remediation required before deployment can continue.',
        components: nodes,
      },
    ];
  }
}
