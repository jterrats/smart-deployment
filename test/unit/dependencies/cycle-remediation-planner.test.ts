import { expect } from 'chai';
import { describe, it } from 'mocha';
import { CycleRemediationPlanner } from '../../../src/dependencies/cycle-remediation-planner.js';
import type { DependencyGraph, NodeId } from '../../../src/types/dependency.js';
import type { MetadataComponent, MetadataType } from '../../../src/types/metadata.js';

function createGraph(edges: Array<[NodeId, NodeId]>): DependencyGraph {
  const graph: DependencyGraph = new Map();

  for (const [from, to] of edges) {
    if (!graph.has(from)) {
      graph.set(from, new Set());
    }

    graph.get(from)!.add(to);

    if (!graph.has(to)) {
      graph.set(to, new Set());
    }
  }

  return graph;
}

function createComponent(nodeId: NodeId, filePath?: string): MetadataComponent {
  const [type, name] = nodeId.split(':') as [MetadataType, string];

  return {
    name,
    type,
    filePath: filePath ?? `force-app/main/default/${type}/${name}`,
    dependencies: new Set(),
    dependents: new Set(),
    priorityBoost: 0,
  };
}

function createComponentMap(nodeIds: NodeId[]): Map<NodeId, MetadataComponent> {
  return new Map(
    nodeIds.map((nodeId) => [
      nodeId,
      createComponent(nodeId, `force-app/main/default/classes/${nodeId.replace(':', '/')}.cls`),
    ])
  );
}

describe('CycleRemediationPlanner', () => {
  it('creates a comment-reference plan for a 2-node ApexClass cycle', () => {
    const graph = createGraph([
      ['ApexClass:B', 'ApexClass:A'],
      ['ApexClass:A', 'ApexClass:B'],
    ]);
    const components = createComponentMap(['ApexClass:A', 'ApexClass:B']);

    const planner = new CycleRemediationPlanner(graph, { components });
    const plan = planner.createPlan();

    expect(plan.supported).to.be.true;
    expect(plan.warnings).to.deep.equal([]);
    expect(plan.cycles).to.have.lengthOf(1);
    expect(plan.cycles[0]).to.deep.include({
      id: 'ApexClass:A|ApexClass:B',
      nodes: ['ApexClass:A', 'ApexClass:B'],
      strategy: 'comment-reference',
    });
    expect(plan.cycles[0].edits).to.deep.equal([
      {
        nodeId: 'ApexClass:A',
        targetDependency: 'ApexClass:B',
        operation: 'comment-reference',
        filePath: 'force-app/main/default/classes/ApexClass/A.cls',
        targetDescription: 'Temporarily comment the ApexClass:A reference to ApexClass:B during phase 1.',
      },
    ]);
    expect(plan.cycles[0].deployPhases).to.have.lengthOf(2);
  });

  it('creates a comment-reference plan for a 3-node ApexClass cycle', () => {
    const graph = createGraph([
      ['ApexClass:Gamma', 'ApexClass:Alpha'],
      ['ApexClass:Alpha', 'ApexClass:Beta'],
      ['ApexClass:Beta', 'ApexClass:Gamma'],
    ]);

    const planner = new CycleRemediationPlanner(graph, {
      components: createComponentMap(['ApexClass:Alpha', 'ApexClass:Beta', 'ApexClass:Gamma']),
    });
    const plan = planner.createPlan();

    expect(plan.supported).to.be.true;
    expect(plan.cycles).to.have.lengthOf(1);
    expect(plan.cycles[0].nodes).to.deep.equal(['ApexClass:Alpha', 'ApexClass:Beta', 'ApexClass:Gamma']);
    expect(plan.cycles[0].strategy).to.equal('comment-reference');
    expect(plan.cycles[0].edits[0]).to.include({
      nodeId: 'ApexClass:Alpha',
      targetDependency: 'ApexClass:Beta',
      operation: 'comment-reference',
    });
  });

  it('treats an ApexClass self-loop as a supported cycle', () => {
    const graph = createGraph([['ApexClass:SelfRef', 'ApexClass:SelfRef']]);

    const planner = new CycleRemediationPlanner(graph, {
      components: createComponentMap(['ApexClass:SelfRef']),
    });
    const plan = planner.createPlan();

    expect(plan.supported).to.be.true;
    expect(plan.cycles).to.have.lengthOf(1);
    expect(plan.cycles[0].nodes).to.deep.equal(['ApexClass:SelfRef']);
    expect(plan.cycles[0].strategy).to.equal('comment-reference');
    expect(plan.cycles[0].edits[0]).to.include({
      nodeId: 'ApexClass:SelfRef',
      targetDependency: 'ApexClass:SelfRef',
    });
  });

  it('classifies mixed-type cycles as manual with warnings', () => {
    const graph = createGraph([
      ['Flow:Provisioning', 'ApexClass:Worker'],
      ['ApexClass:Worker', 'Flow:Provisioning'],
    ]);
    const components = new Map<NodeId, MetadataComponent>([
      [
        'Flow:Provisioning',
        createComponent('Flow:Provisioning', 'force-app/main/default/flows/Provisioning.flow-meta.xml'),
      ],
      ['ApexClass:Worker', createComponent('ApexClass:Worker', 'force-app/main/default/classes/Worker.cls')],
    ]);

    const planner = new CycleRemediationPlanner(graph, { components });
    const plan = planner.createPlan();

    expect(plan.supported).to.be.false;
    expect(plan.cycles).to.have.lengthOf(1);
    expect(plan.cycles[0].strategy).to.equal('manual');
    expect(plan.cycles[0].edits).to.deep.equal([]);
    expect(plan.cycles[0].warnings[0]).to.include('ApexClass-only cycles');
    expect(plan.cycles[0].warnings[0]).to.include('ApexClass, Flow');
    expect(plan.warnings).to.deep.equal(plan.cycles[0].warnings);
  });

  it('returns deterministic plans regardless of graph insertion order', () => {
    const graphA = createGraph([
      ['ApexClass:Zulu', 'ApexClass:Yankee'],
      ['ApexClass:Yankee', 'ApexClass:Zulu'],
      ['ApexClass:Bravo', 'ApexClass:Alpha'],
      ['ApexClass:Alpha', 'ApexClass:Bravo'],
    ]);
    const graphB = createGraph([
      ['ApexClass:Alpha', 'ApexClass:Bravo'],
      ['ApexClass:Bravo', 'ApexClass:Alpha'],
      ['ApexClass:Yankee', 'ApexClass:Zulu'],
      ['ApexClass:Zulu', 'ApexClass:Yankee'],
    ]);
    const components = createComponentMap(['ApexClass:Alpha', 'ApexClass:Bravo', 'ApexClass:Yankee', 'ApexClass:Zulu']);

    const planA = new CycleRemediationPlanner(graphA, { components }).createPlan();
    const planB = new CycleRemediationPlanner(graphB, { components }).createPlan();

    expect(planA).to.deep.equal(planB);
    expect(planA.cycles.map((cycle) => cycle.id)).to.deep.equal([
      'ApexClass:Alpha|ApexClass:Bravo',
      'ApexClass:Yankee|ApexClass:Zulu',
    ]);
  });
});
