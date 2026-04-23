# Circular Dependency Remediation

## Goal

Implement an automated workflow to deploy metadata with circular references by:

1. detecting strongly connected components
2. generating a safe break plan
3. deploying a temporary cycle-broken version
4. restoring the original references in a second deploy
5. rolling back safely if restore fails

## Problem Statement

The project currently:

- detects circular dependencies
- groups unresolved cyclic components into a final wave
- reports them as manual-resolution items

The project does not currently:

- rewrite source files to break cycles
- deploy cyclic components in staged phases
- restore original references after initial deploy
- keep backups and rollback plans for temporary edits

## Scope

Initial scope should be limited to metadata types where temporary source rewriting is deterministic and reversible.

Recommended first scope:

- `ApexClass`
- `ApexTrigger` only if parsing/editing is safe

Out of scope for first version:

- arbitrary XML metadata mutation
- LWC/Aura source rewriting
- broad multi-type cycle breaking without type-specific rules

## Proposed Architecture

### 1. Cycle Detection

Add a dedicated service:

- `src/dependencies/cycle-remediation-planner.ts`

Responsibilities:

- receive dependency graph plus component map
- identify strongly connected components with size `> 1` or self-loops
- decide whether each cycle is remediable automatically
- emit a remediation plan

Suggested output:

```ts
interface CycleRemediationPlan {
  cycles: RemediationCycle[];
  supported: boolean;
  warnings: string[];
}

interface RemediationCycle {
  id: string;
  nodes: string[];
  strategy: 'comment-reference' | 'defer-member' | 'manual';
  edits: SourceEdit[];
  deployPhases: DeployPhase[];
}

interface SourceEdit {
  filePath: string;
  originalContentHash: string;
  patchType: 'comment-line' | 'replace-token';
  targetDescription: string;
}

interface DeployPhase {
  phase: 1 | 2;
  description: string;
  components: string[];
  restoreEdits?: boolean;
}
```

### 2. Source Rewriting

Add a dedicated service:

- `src/deployment/cycle-source-editor.ts`

Responsibilities:

- create backups before any mutation
- apply only reversible edits
- write a manifest of edits applied
- restore original files exactly

Rules:

- no regex-only blind rewrites for Apex in production path unless constrained to validated patterns
- prefer parser-aware edits where feasible
- every edit must record:
  - file path
  - before hash
  - after hash
  - exact transformation

Suggested persisted state:

```ts
interface CycleEditRecord {
  filePath: string;
  backupPath: string;
  beforeHash: string;
  afterHash: string;
  operation: 'comment-reference';
  cycleId: string;
}
```

### 3. Deployment Orchestration

Extend `start` flow with a cycle-aware path:

1. analyze graph
2. if no cycles: normal deploy
3. if cycles and remediable:
   - create remediation plan
   - apply temporary edits
   - deploy phase 1
   - restore source
   - deploy phase 2
4. if cycles and not remediable:
   - fail with actionable report

Add state tracking fields:

```ts
interface CycleRemediationState {
  active: boolean;
  cycleId?: string;
  phase?: 1 | 2;
  editsApplied: CycleEditRecord[];
  restorePending: boolean;
}
```

This should be stored in deployment state so `resume` can behave safely.

### 4. Failure and Rollback Semantics

Required behavior:

- if temporary edit application fails: abort before deploy
- if phase 1 deploy fails: restore local files immediately
- if restore fails after phase 1: mark deployment as failed and block resume until manual reconciliation
- if phase 2 deploy fails: preserve restored source and report deployment failure normally

Hard rule:

- local source must never be left silently modified after command exit

## CLI Behavior

Suggested `start` output:

- detect cycles
- report whether cycle remediation is supported
- show which files will be temporarily edited
- show phase progression:
  - `phase 1: deploy cycle-broken metadata`
  - `phase 2: restore references and redeploy`

Suggested flags:

- `--allow-cycle-remediation`
- `--cycle-remediation-mode=manual|safe`
- `--keep-cycle-backups`

Safe default:

- do not rewrite source unless user explicitly enables it

## Testing Strategy

### Unit

- strongly connected component detection
- remediation-plan generation
- unsupported-cycle classification
- reversible source edit application/restoration
- backup manifest generation

### Integration

- fixture with 2-node Apex cycle
- fixture with 3-node Apex cycle
- phase 1 edit + deploy-plan generation
- restore after simulated phase 1 success
- rollback after simulated phase 1 failure

### E2E

- start command with `--allow-cycle-remediation`
- resume behavior when failure occurs during phase 1
- status output while remediation is active

## Recommended Implementation Order

1. planner for strongly connected components
2. source editor with reversible backups
3. deploy-state extensions for remediation tracking
4. `start` integration behind explicit flag
5. `resume`/`status` awareness
6. realistic fixtures and failure-path tests

## Acceptance Criteria

- cyclic components are detected as explicit remediation candidates
- supported cycles produce a deterministic remediation plan
- temporary edits are reversible and backed up
- phase 1 and phase 2 are tracked in deployment state
- local source is restored after success or failure
- unsupported cycles fail fast with actionable guidance
- tests cover both success and rollback paths
