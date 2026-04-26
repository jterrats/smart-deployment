# Technical Refactor Backlog

This backlog captures the highest-value refactor slices for maintainability and delegation.
Each item is sized to become a GitHub issue or a focused subagent assignment.

## Selection Criteria

- runtime or analysis hotspot
- file size and responsibility concentration
- extension pressure from recent features
- likelihood of causing cross-cutting edits

## Priority Order

1. `dependency-graph-builder`
2. `apex-class-parser`
3. `custom-object-parser`
4. `wave-builder`
5. `dependency-resolver`
6. `lwc-parser`
7. `wave-validation-service`
8. `layout-parser`
9. `dependency-impact-analyzer`
10. `circular-dependency-detector`
11. `test-optimizer`
12. `cache-manager`

## Squad Split

### Parser Squad

- `apex-class-parser`
- `custom-object-parser`
- `lwc-parser`
- `layout-parser`

### Dependency Squad

- `dependency-graph-builder`
- `dependency-resolver`
- `dependency-impact-analyzer`
- `circular-dependency-detector`

### Wave / AI Squad

- `wave-builder`
- `test-optimizer`
- `wave-validation-service`

### Platform Squad

- `cache-manager`

## Issue Drafts

### 1. Refactor dependency graph builder into explicit graph stages

- File: [src/dependencies/dependency-graph-builder.ts](/Users/polux/dev/smart-deployment/src/dependencies/dependency-graph-builder.ts:1)
- Problem:
  - mixes component intake, edge normalization, typed dependency handling, stats, and dangling edge analysis
  - high blast radius for any graph-rule change
- Goal:
  - split into graph assembly, edge classification, graph validation, and stats/report helpers
- Non-goals:
  - no behavior change in dependency semantics
  - no report format changes
- Done when:
  - root builder is mostly orchestration
  - staged helpers are independently testable
  - existing graph builder tests still pass

### 2. Refactor Apex class parser into extraction stages

- File: [src/parsers/apex-class-parser.ts](/Users/polux/dev/smart-deployment/src/parsers/apex-class-parser.ts:1)
- Problem:
  - central parser for dependency analysis, test discovery, and heuristics
  - likely mixes comment stripping, signature scanning, import/reference extraction, and test detection
- Goal:
  - isolate lexical cleanup, symbol extraction, dependency extraction, and test metadata detection
- Non-goals:
  - no expansion of Apex language support
- Done when:
  - parser logic is phase-based
  - `isTest` and dependency extraction remain behaviorally stable

### 3. Refactor custom object parser into schema-domain helpers

- File: [src/parsers/custom-object-parser.ts](/Users/polux/dev/smart-deployment/src/parsers/custom-object-parser.ts:1)
- Problem:
  - large XML/domain parser with likely mixed concerns across fields, relationships, validation rules, layouts, and record types
- Goal:
  - separate object-level parsing from field/reference sub-parsers
- Non-goals:
  - no new metadata coverage unless required by the extraction
- Done when:
  - major metadata sections parse through focused helpers
  - parser tests remain green

### 4. Extract wave builder placement and prioritization policies

- File: [src/waves/wave-builder.ts](/Users/polux/dev/smart-deployment/src/waves/wave-builder.ts:1)
- Problem:
  - mixes topological placement, cycle fallback, and typed dependency prioritization
- Goal:
  - separate placement engine from tie-break policies and risk ordering
- Non-goals:
  - no change in wave numbering contract
- Done when:
  - placement policies are swappable/testable
  - typed dependency ordering logic is not embedded in one large method

### 5. Modularize dependency resolver decision flow

- File: [src/dependencies/dependency-resolver.ts](/Users/polux/dev/smart-deployment/src/dependencies/dependency-resolver.ts:1)
- Problem:
  - resolves hard, soft, inferred, and optional paths in one flow
- Goal:
  - split resolution, optional dependency handling, and validation/classification
- Non-goals:
  - no graph format changes
- Done when:
  - resolver reads as staged pipeline
  - optional dependency semantics are easier to extend

### 6. Refactor LWC parser into import, metadata, and template phases

- File: [src/parsers/lwc-parser.ts](/Users/polux/dev/smart-deployment/src/parsers/lwc-parser.ts:1)
- Problem:
  - large parser spanning JS, metadata XML, and component conventions
- Goal:
  - separate JS import parsing, `js-meta.xml` parsing, and component metadata assembly
- Non-goals:
  - no template HTML dependency model expansion unless already present
- Done when:
  - each input source has a dedicated parsing helper
  - parser stays backwards compatible for current tests

### 7. Split wave validation service into AI orchestration and rule evaluation

- File: [src/ai/wave-validation-service.ts](/Users/polux/dev/smart-deployment/src/ai/wave-validation-service.ts:1)
- Problem:
  - combines provider access, prompting, fallback, risk synthesis, and issue shaping
- Goal:
  - isolate provider orchestration from result interpretation
- Non-goals:
  - no provider API change
- Done when:
  - risk synthesis logic can be tested without transport concerns

### 8. Refactor layout parser into sections, actions, and reference helpers

- File: [src/parsers/layout-parser.ts](/Users/polux/dev/smart-deployment/src/parsers/layout-parser.ts:1)
- Problem:
  - mixes structural XML traversal with dependency mapping
- Goal:
  - separate field/section extraction from action/reference inference
- Non-goals:
  - no new optional dependency categories unless extraction requires it
- Done when:
  - layout parsing is split by metadata section

### 9. Split dependency impact analyzer into traversal and scoring

- File: [src/dependencies/dependency-impact-analyzer.ts](/Users/polux/dev/smart-deployment/src/dependencies/dependency-impact-analyzer.ts:1)
- Problem:
  - graph traversal and impact/risk scoring likely live together
- Goal:
  - separate traversal primitives from impact scoring/report shaping
- Done when:
  - traversal can be reused without impact policy

### 10. Refactor circular dependency detector into SCC analysis and suggestion layers

- File: [src/dependencies/circular-dependency-detector.ts](/Users/polux/dev/smart-deployment/src/dependencies/circular-dependency-detector.ts:1)
- Problem:
  - detection and remediation/suggestion logic likely co-located
- Goal:
  - isolate SCC detection from suggestion generation
- Done when:
  - cycle finding is pure and independent
  - remediation suggestions consume a stable cycle model

### 11. Refactor test optimizer into planning and scoring stages

- File: [src/waves/test-optimizer.ts](/Users/polux/dev/smart-deployment/src/waves/test-optimizer.ts:1)
- Problem:
  - likely mixes candidate discovery, scoring, and plan shaping
- Goal:
  - separate candidate collection from optimization policy
- Done when:
  - test plan scoring becomes independently testable

### 12. Refactor cache manager into storage and policy layers

- File: [src/utils/cache-manager.ts](/Users/polux/dev/smart-deployment/src/utils/cache-manager.ts:1)
- Problem:
  - large utility file with likely mixed concerns across serialization, persistence, expiry, and cleanup
- Goal:
  - separate cache storage from TTL/eviction policy
- Done when:
  - storage adapter and cache policy can evolve independently

## Delegation Template

Use this template when assigning a refactor item to a subagent:

- Goal
- Owning files
- Non-goals
- Required tests
- Expected commit title
- Known risks

## Quality Gates

- keep the public contract stable unless the issue explicitly says otherwise
- no `eslint-disable` to hide complexity
- touched tests must pass
- root module should shrink and become more orchestration-oriented
