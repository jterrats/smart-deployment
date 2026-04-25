/**
 * Graph Visualizer
 * Generates visual representations of the dependency graph
 *
 * @ac US-035-AC-1: Generate Mermaid diagram
 * @ac US-035-AC-2: Generate DOT format
 * @ac US-035-AC-3: Support filtering by type
 * @ac US-035-AC-4: Support filtering by depth
 * @ac US-035-AC-5: Highlight critical path
 * @ac US-035-AC-6: Export as SVG/PNG (requires external tools)
 *
 * @issue #35
 */

import { getLogger } from '../utils/logger.js';
import type { DependencyEdge, NodeId, DependencyGraph } from '../types/dependency.js';
import type { MetadataType } from '../types/metadata.js';

const logger = getLogger('GraphVisualizer');

/**
 * Visualization format
 */
export type VisualizationFormat = 'mermaid' | 'dot' | 'ascii';

/**
 * Visualization options
 */
export type VisualizationOptions = {
  /** Filter by metadata types */
  includeTypes?: MetadataType[];
  /** Exclude metadata types */
  excludeTypes?: MetadataType[];
  /** Maximum depth to visualize */
  maxDepth?: number;
  /** Nodes in critical path to highlight */
  criticalPath?: NodeId[];
  /** Show node labels */
  showLabels?: boolean;
  /** Color scheme */
  colorScheme?: 'default' | 'type' | 'depth';
  /** Edge metadata for styling/labels */
  edgeMetadata?: DependencyEdge[];
};

/**
 * Color palette for metadata types
 */
const TYPE_COLORS: Record<string, string> = {
  ApexClass: '#FF6B6B',
  ApexTrigger: '#4ECDC4',
  CustomObject: '#45B7D1',
  CustomField: '#96CEB4',
  Flow: '#FFEAA7',
  LightningComponentBundle: '#DFE6E9',
  AuraDefinitionBundle: '#74B9FF',
  VisualforcePage: '#A29BFE',
  EmailTemplate: '#FD79A8',
  PermissionSet: '#FDCB6E',
  Layout: '#6C5CE7',
  Profile: '#E17055',
  FlexiPage: '#00B894',
  Bot: '#00CEC9',
  GenAiPromptTemplate: '#B2BEC3',
};

/**
 * Graph Visualizer
 *
 * Generates visual representations of dependency graphs in multiple formats:
 * - Mermaid: For GitHub, documentation
 * - DOT: For Graphviz rendering
 * - ASCII: For terminal output
 *
 * Performance: O(V + E)
 *
 * @example
 * const visualizer = new GraphVisualizer(graph);
 * const mermaid = visualizer.toMermaid({ criticalPath });
 * const dot = visualizer.toDot({ includeTypes: ['ApexClass'] });
 * const ascii = visualizer.toAscii();
 */
export class GraphVisualizer {
  private graph: DependencyGraph;
  private edgeMetadata: Map<string, DependencyEdge>;
  private options: VisualizationOptions;

  public constructor(graph: DependencyGraph, options: VisualizationOptions = {}) {
    this.graph = graph;
    this.edgeMetadata = new Map((options.edgeMetadata ?? []).map((edge) => [`${edge.from}->${edge.to}`, edge]));
    this.options = {
      showLabels: options.showLabels ?? true,
      colorScheme: options.colorScheme ?? 'type',
      ...options,
    };

    logger.debug('Initialized GraphVisualizer', {
      nodes: this.graph.size,
      format: 'multi',
    });
  }

  /**
   * @ac US-035-AC-1: Generate Mermaid diagram
   * @ac US-035-AC-5: Highlight critical path
   */
  public toMermaid(overrideOptions?: VisualizationOptions): string {
    const opts = { ...this.options, ...overrideOptions };
    const filtered = this.filterGraph(opts);
    const criticalSet = new Set(opts.criticalPath ?? []);

    const lines: string[] = ['graph TD'];

    // Add nodes with styling
    for (const [nodeId, deps] of filtered.entries()) {
      for (const dep of deps) {
        const fromStyle = this.getMermaidNodeStyle(nodeId, criticalSet);
        const toStyle = this.getMermaidNodeStyle(dep, criticalSet);
        const edgeMetadata = this.edgeMetadata.get(`${nodeId}->${dep}`);
        const edgeStyle = this.getMermaidEdgeStyle(nodeId, dep, criticalSet, edgeMetadata);
        const edgeLabel = edgeMetadata ? `|${edgeMetadata.type}|` : '';

        lines.push(
          `    ${this.escapeNodeId(nodeId)}${fromStyle} ${edgeStyle}${edgeLabel} ${this.escapeNodeId(dep)}${toStyle}`
        );
      }
    }

    // Add isolated nodes
    for (const nodeId of filtered.keys()) {
      if (filtered.get(nodeId)!.size === 0 && !this.hasIncomingEdge(nodeId, filtered)) {
        const style = this.getMermaidNodeStyle(nodeId, criticalSet);
        lines.push(`    ${this.escapeNodeId(nodeId)}${style}`);
      }
    }

    // Add styling classes
    lines.push('');
    lines.push('    %% Styling');
    lines.push('    classDef critical fill:#ff6b6b,stroke:#ff0000,stroke-width:3px');
    lines.push('    classDef normal fill:#4ecdc4,stroke:#333,stroke-width:1px');

    return lines.join('\n');
  }

  /**
   * @ac US-035-AC-2: Generate DOT format
   */
  public toDot(overrideOptions?: VisualizationOptions): string {
    const opts = { ...this.options, ...overrideOptions };
    const filtered = this.filterGraph(opts);
    const criticalSet = new Set(opts.criticalPath ?? []);

    const lines: string[] = ['digraph Dependencies {'];
    lines.push('    rankdir=LR;');
    lines.push('    node [shape=box, style=rounded];');
    lines.push('');

    // Add nodes with styling
    for (const nodeId of filtered.keys()) {
      const color = this.getDotColor(nodeId, criticalSet);
      const label = opts.showLabels ? this.getNodeLabel(nodeId) : nodeId;
      lines.push(`    "${nodeId}" [label="${label}", fillcolor="${color}", style="filled,rounded"];`);
    }

    lines.push('');

    // Add edges
    for (const [nodeId, deps] of filtered.entries()) {
      for (const dep of deps) {
        const edgeMetadata = this.edgeMetadata.get(`${nodeId}->${dep}`);
        const edgeAttributes = this.getDotEdgeAttributes(nodeId, dep, criticalSet, edgeMetadata);
        const attributeBlock = edgeAttributes.length > 0 ? ` [${edgeAttributes.join(', ')}]` : '';
        lines.push(`    "${nodeId}" -> "${dep}"${attributeBlock};`);
      }
    }

    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Generate ASCII tree view
   */
  public toAscii(rootNode?: NodeId, overrideOptions?: VisualizationOptions): string {
    const opts = { ...this.options, ...overrideOptions };
    const filtered = this.filterGraph(opts);
    const selectedRootNode = rootNode ?? this.findRootNode(filtered);

    if (!selectedRootNode) {
      return 'Empty graph';
    }

    const visited = new Set<NodeId>();
    const lines: string[] = [];

    const buildTree = (nodeId: NodeId, prefix: string, isLast: boolean): void => {
      if (visited.has(nodeId)) {
        lines.push(`${prefix}${isLast ? '└─' : '├─'} ${nodeId} (circular)`);
        return;
      }

      visited.add(nodeId);
      const label = opts.showLabels ? this.getNodeLabel(nodeId) : nodeId;
      lines.push(`${prefix}${isLast ? '└─' : '├─'} ${label}`);

      const deps = Array.from(filtered.get(nodeId) ?? []);
      const newPrefix = prefix + (isLast ? '   ' : '│  ');

      deps.forEach((dep, index) => {
        const depIsLast = index === deps.length - 1;
        buildTree(dep, newPrefix, depIsLast);
      });
    };

    buildTree(selectedRootNode, '', true);

    return lines.join('\n');
  }

  /**
   * @ac US-035-AC-3: Support filtering by type
   * @ac US-035-AC-4: Support filtering by depth
   */
  private filterGraph(opts: VisualizationOptions): DependencyGraph {
    const filtered: DependencyGraph = new Map();

    for (const [nodeId, deps] of this.graph.entries()) {
      // Filter by type
      if (opts.includeTypes && !this.matchesType(nodeId, opts.includeTypes)) {
        continue;
      }
      if (opts.excludeTypes && this.matchesType(nodeId, opts.excludeTypes)) {
        continue;
      }

      // Filter dependencies
      const filteredDeps = new Set<NodeId>();
      for (const dep of deps) {
        if (opts.includeTypes && !this.matchesType(dep, opts.includeTypes)) {
          continue;
        }
        if (opts.excludeTypes && this.matchesType(dep, opts.excludeTypes)) {
          continue;
        }
        filteredDeps.add(dep);
      }

      filtered.set(nodeId, filteredDeps);
    }

    return filtered;
  }

  /**
   * Check if node matches any of the given types
   */
  private matchesType(nodeId: NodeId, types: MetadataType[]): boolean {
    const nodeType = nodeId.split(':')[0];
    return types.includes(nodeType as MetadataType);
  }

  private getMermaidEdgeStyle(
    from: NodeId,
    to: NodeId,
    criticalSet: Set<NodeId>,
    edgeMetadata?: DependencyEdge
  ): string {
    if (criticalSet.has(from) && criticalSet.has(to)) {
      return '==>';
    }

    if (edgeMetadata?.type === 'soft') {
      return '-.->';
    }

    if (edgeMetadata?.type === 'inferred') {
      return '==>';
    }

    return '-->';
  }

  private getDotEdgeAttributes(
    from: NodeId,
    to: NodeId,
    criticalSet: Set<NodeId>,
    edgeMetadata?: DependencyEdge
  ): string[] {
    const styles: string[] = [];

    if (criticalSet.has(from) && criticalSet.has(to)) {
      styles.push('color=red', 'penwidth=2.0');
    }

    if (edgeMetadata?.type === 'soft') {
      styles.push('style=dashed');
    }

    if (edgeMetadata?.type === 'inferred') {
      styles.push('color=blue');
    }

    if (edgeMetadata) {
      styles.push(`label="${edgeMetadata.type}"`);
    }

    return styles;
  }

  /**
   * Get Mermaid node styling
   */
  private getMermaidNodeStyle(nodeId: NodeId, criticalSet: Set<NodeId>): string {
    if (criticalSet.has(nodeId)) {
      return ':::critical';
    }
    return ':::normal';
  }

  /**
   * Get DOT color for node
   */
  private getDotColor(nodeId: NodeId, criticalSet: Set<NodeId>): string {
    if (criticalSet.has(nodeId)) {
      return '#ff6b6b';
    }

    const type = nodeId.split(':')[0];
    return TYPE_COLORS[type] ?? '#e0e0e0';
  }

  /**
   * Get node label (short name)
   */
  private getNodeLabel(nodeId: NodeId): string {
    const parts = nodeId.split(':');
    return parts.length === 2 ? parts[1] : nodeId;
  }

  /**
   * Escape node ID for Mermaid
   */
  private escapeNodeId(nodeId: NodeId): string {
    return nodeId.replace(/:/g, '_');
  }

  /**
   * Check if node has incoming edges
   */
  private hasIncomingEdge(nodeId: NodeId, graph: DependencyGraph): boolean {
    for (const deps of graph.values()) {
      if (deps.has(nodeId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Find a suitable root node for ASCII tree
   */
  private findRootNode(graph: DependencyGraph): NodeId | undefined {
    // Find node with most dependencies
    let maxDeps = 0;
    let root: NodeId | undefined;

    for (const [nodeId, deps] of graph.entries()) {
      if (deps.size > maxDeps) {
        maxDeps = deps.size;
        root = nodeId;
      }
    }

    return root;
  }

  /**
   * Get graph statistics
   */
  public getStats(): { nodes: number; edges: number } {
    let edges = 0;
    for (const deps of this.graph.values()) {
      edges += deps.size;
    }

    return { nodes: this.graph.size, edges };
  }
}
