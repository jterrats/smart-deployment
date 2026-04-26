import type { MetadataComponent } from '../types/metadata.js';
import type { NodeId } from '../types/dependency.js';
import type { ConfidenceLevel, InferredDependency } from './heuristic-inference.js';

type HeuristicPatternScore = {
  confidence: ConfidenceLevel;
  score: number;
};

export function calculateConfidence(
  pattern: string,
  existingDeps: number,
  nameSimilarity: number
): HeuristicPatternScore {
  let score = 50;

  const patternScores: Record<string, number> = {
    'test-suffix': 45,
    'test-prefix': 45,
    'trigger-handler': 40,
    'handler-service': 35,
    'controller-service': 35,
    'batch-service': 25,
    'queueable-service': 25,
    'selector-service': 20,
    'integration-service': 15,
  };

  score += patternScores[pattern] ?? 0;
  score += Math.floor(nameSimilarity * 10);
  score -= Math.min(existingDeps * 2, 10);
  score = Math.max(0, Math.min(100, score));

  if (score >= 80) {
    return { confidence: 'high', score };
  }
  if (score >= 65) {
    return { confidence: 'medium', score };
  }

  return { confidence: 'low', score };
}

export function inferTestClassDependencies(
  component: MetadataComponent,
  components: Map<NodeId, MetadataComponent>
): InferredDependency[] {
  if (component.type !== 'ApexClass') {
    return [];
  }

  const inferred: InferredDependency[] = [];
  const className = component.name;

  if (className.endsWith('Test')) {
    const productionClassName = className.slice(0, -4);
    const prodNodeId = `ApexClass:${productionClassName}`;

    if (components.has(prodNodeId)) {
      inferred.push({
        from: `ApexClass:${className}`,
        to: prodNodeId,
        reason: 'Test class typically tests production class',
        confidence: 'high',
        pattern: 'test-suffix',
        score: 95,
      });
    }
  }

  if (className.startsWith('Test_')) {
    const productionClassName = className.slice(5);
    const prodNodeId = `ApexClass:${productionClassName}`;

    if (components.has(prodNodeId)) {
      inferred.push({
        from: `ApexClass:${className}`,
        to: prodNodeId,
        reason: 'Test class typically tests production class',
        confidence: 'high',
        pattern: 'test-prefix',
        score: 95,
      });
    }
  }

  if (className.endsWith('_Test')) {
    const productionClassName = className.slice(0, -5);
    const prodNodeId = `ApexClass:${productionClassName}`;

    if (components.has(prodNodeId)) {
      inferred.push({
        from: `ApexClass:${className}`,
        to: prodNodeId,
        reason: 'Test class typically tests production class',
        confidence: 'high',
        pattern: 'test-suffix-underscore',
        score: 95,
      });
    }
  }

  return inferred;
}

export function inferHandlerServicePattern(
  component: MetadataComponent,
  components: Map<NodeId, MetadataComponent>
): InferredDependency[] {
  if (component.type !== 'ApexClass') {
    return [];
  }

  const inferred: InferredDependency[] = [];
  const className = component.name;

  if (className.endsWith('Handler')) {
    const baseName = className.slice(0, -7);
    const serviceNames = [`${baseName}Service`, `${baseName}_Service`, `${baseName}Svc`];

    for (const serviceName of serviceNames) {
      const serviceNodeId = `ApexClass:${serviceName}`;
      if (components.has(serviceNodeId)) {
        inferred.push({
          from: `ApexClass:${className}`,
          to: serviceNodeId,
          reason: 'Handler typically calls service layer',
          confidence: 'high',
          pattern: 'handler-service',
          score: 85,
        });
      }
    }
  }

  if (className.includes('Handler')) {
    const baseName = className.replace(/Handler$/, '').replace(/_Handler$/, '');
    const serviceNames = [`${baseName}Service`, `${baseName}_Service`];

    for (const serviceName of serviceNames) {
      const serviceNodeId = `ApexClass:${serviceName}`;
      if (components.has(serviceNodeId) && !inferred.some((dependency) => dependency.to === serviceNodeId)) {
        inferred.push({
          from: `ApexClass:${className}`,
          to: serviceNodeId,
          reason: 'Handler typically calls service layer',
          confidence: 'medium',
          pattern: 'handler-service-variant',
          score: 75,
        });
      }
    }
  }

  return inferred;
}

export function inferTriggerHandlerPattern(
  component: MetadataComponent,
  components: Map<NodeId, MetadataComponent>
): InferredDependency[] {
  if (component.type !== 'ApexTrigger') {
    return [];
  }

  const inferred: InferredDependency[] = [];
  const triggerName = component.name;
  const handlerNames = [
    `${triggerName}Handler`,
    triggerName.replace(/Trigger$/, 'TriggerHandler'),
    triggerName.replace(/Trigger$/, 'Handler'),
  ];

  for (const handlerName of handlerNames) {
    const handlerNodeId = `ApexClass:${handlerName}`;
    if (components.has(handlerNodeId)) {
      inferred.push({
        from: `ApexTrigger:${triggerName}`,
        to: handlerNodeId,
        reason: 'Trigger typically delegates to handler class',
        confidence: 'high',
        pattern: 'trigger-handler',
        score: 90,
      });
      break;
    }
  }

  return inferred;
}

export function inferControllerServicePattern(
  component: MetadataComponent,
  components: Map<NodeId, MetadataComponent>
): InferredDependency[] {
  if (component.type !== 'ApexClass') {
    return [];
  }

  const inferred: InferredDependency[] = [];
  const className = component.name;

  if (className.endsWith('Controller') || className.includes('Controller')) {
    const baseName = className
      .replace(/Controller$/, '')
      .replace(/_Controller$/, '')
      .replace(/^LWC_/, '')
      .replace(/^VF_/, '');

    const serviceNames = [`${baseName}Service`, `${baseName}_Service`, `${baseName}Svc`];

    for (const serviceName of serviceNames) {
      const serviceNodeId = `ApexClass:${serviceName}`;
      if (components.has(serviceNodeId)) {
        inferred.push({
          from: `ApexClass:${className}`,
          to: serviceNodeId,
          reason: 'Controller typically calls service layer',
          confidence: 'high',
          pattern: 'controller-service',
          score: 85,
        });
      }
    }
  }

  return inferred;
}

export function inferFromNamingConventions(
  component: MetadataComponent,
  components: Map<NodeId, MetadataComponent>
): InferredDependency[] {
  if (component.type !== 'ApexClass') {
    return [];
  }

  const inferred: InferredDependency[] = [];
  const className = component.name;

  if (className.endsWith('Selector')) {
    const baseName = className.slice(0, -8);
    const serviceNodeId = `ApexClass:${baseName}Service`;

    if (components.has(serviceNodeId)) {
      inferred.push({
        from: `ApexClass:${className}`,
        to: serviceNodeId,
        reason: 'Selector may be used by service layer',
        confidence: 'medium',
        pattern: 'selector-service',
        score: 70,
      });
    }
  }

  if (className.endsWith('Batch')) {
    const baseName = className.slice(0, -5);
    const serviceNames = [`${baseName}Service`, `${baseName}`];

    for (const serviceName of serviceNames) {
      const serviceNodeId = `ApexClass:${serviceName}`;
      if (components.has(serviceNodeId)) {
        inferred.push({
          from: `ApexClass:${className}`,
          to: serviceNodeId,
          reason: 'Batch class typically uses service layer',
          confidence: 'medium',
          pattern: 'batch-service',
          score: 75,
        });
        break;
      }
    }
  }

  if (className.endsWith('Queueable') || className.includes('Queueable')) {
    const baseName = className.replace(/Queueable$/, '').replace(/_Queueable/, '');
    const serviceNodeId = `ApexClass:${baseName}Service`;

    if (components.has(serviceNodeId)) {
      inferred.push({
        from: `ApexClass:${className}`,
        to: serviceNodeId,
        reason: 'Queueable typically uses service layer',
        confidence: 'medium',
        pattern: 'queueable-service',
        score: 75,
      });
    }
  }

  if (className.includes('Integration')) {
    const baseName = className
      .replace(/Integration$/, '')
      .replace(/_Integration/, '')
      .replace(/^Integration/, '');

    if (baseName) {
      const serviceNodeId = `ApexClass:${baseName}Service`;
      if (components.has(serviceNodeId)) {
        inferred.push({
          from: `ApexClass:${className}`,
          to: serviceNodeId,
          reason: 'Integration class may use service layer',
          confidence: 'low',
          pattern: 'integration-service',
          score: 65,
        });
      }
    }
  }

  return inferred;
}
