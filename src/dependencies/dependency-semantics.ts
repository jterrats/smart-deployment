import type { NodeId } from '../types/dependency.js';
import type { MetadataComponent, MetadataDependencyKind, MetadataDependencyReference } from '../types/metadata.js';

export const DEFAULT_GRAPH_DEPENDENCY_KIND: MetadataDependencyKind = 'hard';

export type NormalizedDependencyReference = {
  nodeId: NodeId;
  kind: MetadataDependencyKind;
  source?: MetadataDependencyReference['source'];
  reason?: string;
  confidence?: number;
};

export function getDependencySourceForKind(kind: MetadataDependencyKind): MetadataDependencyReference['source'] {
  return kind === 'inferred' ? 'ai' : 'parser';
}

export function isSoftDependencyKind(kind: MetadataDependencyKind): boolean {
  return kind === 'soft';
}

export function isInferredDependencyKind(kind: MetadataDependencyKind): boolean {
  return kind === 'inferred';
}

export function shouldIncludeDependencyInResolution(kind: MetadataDependencyKind, includeOptional: boolean): boolean {
  return includeOptional || !isSoftDependencyKind(kind);
}

export function shouldTraverseDependencyKind(
  kind: MetadataDependencyKind,
  options: { includeSoft?: boolean; includeInferred?: boolean } = {}
): boolean {
  const includeSoft = options.includeSoft ?? true;
  const includeInferred = options.includeInferred ?? true;

  if (isSoftDependencyKind(kind) && !includeSoft) {
    return false;
  }

  if (isInferredDependencyKind(kind) && !includeInferred) {
    return false;
  }

  return true;
}

export function getComponentDependencyKind(
  component: MetadataComponent | undefined,
  dependencyId: NodeId,
  defaultKind: MetadataDependencyKind = DEFAULT_GRAPH_DEPENDENCY_KIND
): MetadataDependencyKind {
  const explicitDetail = component?.dependencyDetails?.find((dependency) => dependency.nodeId === dependencyId);
  if (explicitDetail) {
    return explicitDetail.kind;
  }

  if (component?.optionalDependencies?.has(dependencyId)) {
    return 'soft';
  }

  return defaultKind;
}

export function expandComponentDependencyReferences(
  component: MetadataComponent,
  defaultKind: MetadataDependencyKind = DEFAULT_GRAPH_DEPENDENCY_KIND
): NormalizedDependencyReference[] {
  if (component.dependencyDetails && component.dependencyDetails.length > 0) {
    return component.dependencyDetails.map((dependency) => ({
      nodeId: dependency.nodeId,
      kind: dependency.kind,
      source: dependency.source,
      reason: dependency.reason,
      confidence: dependency.confidence,
    }));
  }

  return [...component.dependencies].map((dependencyId) => {
    const kind = getComponentDependencyKind(component, dependencyId, defaultKind);

    return {
      nodeId: dependencyId,
      kind,
      source: getDependencySourceForKind(kind),
      reason: isSoftDependencyKind(kind) ? 'Declared optional dependency' : 'Declared dependency',
    };
  });
}
