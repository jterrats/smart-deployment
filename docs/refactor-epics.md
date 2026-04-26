# Refactor Epics

This document groups the technical refactor backlog into epics and execution-ready user stories.

## Proposed Execution Order

1. Dependency Analysis Core
2. Parser Reliability and Maintainability
3. Wave Planning and Validation
4. Platform Utilities and Cache Boundaries

## Delegation Model

- assign one integration owner per epic
- split subagent work by stable file boundaries
- merge stories in dependency order, not in parallel if they touch the same root module

## Epic 1: Dependency Analysis Core

- Squad: `Dependency Squad`
- Objective:
  - separate graph building, resolution, impact analysis, and cycle detection into explicit stages with stable typed dependency semantics
- Value:
  - lowers blast radius for dependency logic changes
  - makes `hard / soft / inferred` a consistent cross-module contract
- Scope:
  - `dependency-graph-builder`
  - `dependency-resolver`
  - `dependency-impact-analyzer`
  - `circular-dependency-detector`
- Exclusions:
  - no report contract changes
  - no product-facing behavior change unless explicitly documented

### Stories

#### US-RF-DEP-01

- Title:
  - Refactor graph builder into explicit assembly, classification, and stats stages
- Files:
  - [src/dependencies/dependency-graph-builder.ts](/Users/polux/dev/smart-deployment/src/dependencies/dependency-graph-builder.ts:1)
- Scope:
  - extract node intake, edge normalization, typed dependency expansion, dangling edge analysis, and stats/report helpers
- Risks:
  - edge drift between `dependencyDetails` and legacy sets
  - regression in `edges`, `graph`, or `reverseGraph`
- Acceptance Criteria:
  - builder root becomes orchestration-oriented
  - typed edge expansion is isolated in testable helpers
  - current graph builder tests remain green

#### US-RF-DEP-02

- Title:
  - Modularize dependency resolver into classification and ordering stages
- Files:
  - [src/dependencies/dependency-resolver.ts](/Users/polux/dev/smart-deployment/src/dependencies/dependency-resolver.ts:1)
- Scope:
  - split filtering/classification, optional dependency handling, managed package handling, and topological ordering
- Risks:
  - accidental change in ordering semantics
  - drift between resolver semantics and graph builder semantics
- Acceptance Criteria:
  - resolver reads as staged pipeline
  - `includeOptional` and `skipManaged` behavior stays stable
  - output contract remains unchanged

#### US-RF-DEP-03

- Title:
  - Separate dependency impact traversal from scoring policy
- Files:
  - [src/dependencies/dependency-impact-analyzer.ts](/Users/polux/dev/smart-deployment/src/dependencies/dependency-impact-analyzer.ts:1)
- Scope:
  - isolate BFS/transitive traversal from risk/impact/test-scope scoring
- Risks:
  - changed traversal depth semantics
  - changed impact scoring aggregation
- Acceptance Criteria:
  - traversal can be tested separately from scoring
  - `ComponentImpact` and `ImpactAnalysisResult` contracts stay stable

#### US-RF-DEP-04

- Title:
  - Split cycle detection from remediation suggestion generation
- Files:
  - [src/dependencies/circular-dependency-detector.ts](/Users/polux/dev/smart-deployment/src/dependencies/circular-dependency-detector.ts:1)
- Scope:
  - isolate SCC/cycle discovery, deduplication, and severity from break suggestions and priority reasoning
- Risks:
  - changed cycle IDs
  - changed suggestion ordering
- Acceptance Criteria:
  - cycle discovery is pure
  - suggestion generation consumes a stable cycle model
  - current detector tests remain green

#### US-RF-DEP-05

- Title:
  - Establish a single semantic source for `hard / soft / inferred`
- Files:
  - [src/dependencies/dependency-graph-builder.ts](/Users/polux/dev/smart-deployment/src/dependencies/dependency-graph-builder.ts:1)
  - [src/dependencies/dependency-resolver.ts](/Users/polux/dev/smart-deployment/src/dependencies/dependency-resolver.ts:1)
  - [src/dependencies/dependency-impact-analyzer.ts](/Users/polux/dev/smart-deployment/src/dependencies/dependency-impact-analyzer.ts:1)
  - [src/dependencies/circular-dependency-detector.ts](/Users/polux/dev/smart-deployment/src/dependencies/circular-dependency-detector.ts:1)
- Scope:
  - centralize interpretation of typed dependency semantics
- Risks:
  - touching too many dependent flows at once
- Acceptance Criteria:
  - one source of truth for semantic interpretation
  - no duplicated ad hoc rules across those modules

## Epic 2: Parser Reliability and Maintainability

- Squad: `Parser Squad`
- Objective:
  - split large metadata parsers into explicit phases and helpers without widening product behavior
- Value:
  - safer parser evolution
  - lower regression risk in dependency extraction and test discovery
- Scope:
  - `apex-class-parser`
  - `custom-object-parser`
  - `lwc-parser`
  - `layout-parser`
- Exclusions:
  - no expansion of metadata coverage unless required by extraction

### Stories

#### US-RF-PAR-01

- Title:
  - Refactor Apex class parser into lexical cleanup, symbol extraction, and dependency phases
- Files:
  - [src/parsers/apex-class-parser.ts](/Users/polux/dev/smart-deployment/src/parsers/apex-class-parser.ts:1)
- Scope:
  - isolate comment stripping, signature parsing, dependency extraction, and test metadata detection
- Risks:
  - regex regressions for Apex syntax
  - side effects on downstream test discovery
- Acceptance Criteria:
  - parser root is phase-based
  - `ApexParseResult` contract stays stable
  - parser tests stay green

#### US-RF-PAR-02

- Title:
  - Split custom object parser by schema sections and reference helpers
- Files:
  - [src/parsers/custom-object-parser.ts](/Users/polux/dev/smart-deployment/src/parsers/custom-object-parser.ts:1)
- Scope:
  - separate object-level parsing from fields, relationships, validation rules, and record-type helpers
- Risks:
  - losing indirect references
  - duplicating dependency extraction rules
- Acceptance Criteria:
  - major sections use dedicated helpers
  - current parser coverage remains green

#### US-RF-PAR-03

- Title:
  - Refactor LWC parser into JS/TS, metadata XML, and assembly phases
- Files:
  - [src/parsers/lwc-parser.ts](/Users/polux/dev/smart-deployment/src/parsers/lwc-parser.ts:1)
- Scope:
  - separate import extraction, `js-meta.xml` parsing, and result assembly
- Risks:
  - false positives in JS/TS regex handling
  - accidental expansion of HTML/template responsibility
- Acceptance Criteria:
  - each input source has a dedicated helper
  - current parser contract stays stable

#### US-RF-PAR-04

- Title:
  - Modularize layout parser by sections, actions, and optional references
- Files:
  - [src/parsers/layout-parser.ts](/Users/polux/dev/smart-deployment/src/parsers/layout-parser.ts:1)
- Scope:
  - isolate field extraction, action extraction, related-object mapping, and optional dependency assembly
- Risks:
  - duplicated references across sections
  - optional dependency drift
- Acceptance Criteria:
  - layout parsing is split by metadata section
  - dependency and optional dependency outputs remain stable

#### US-RF-PAR-05

- Title:
  - Introduce minimal shared parser utilities where duplication is real
- Files:
  - [src/parsers/apex-class-parser.ts](/Users/polux/dev/smart-deployment/src/parsers/apex-class-parser.ts:1)
  - [src/parsers/custom-object-parser.ts](/Users/polux/dev/smart-deployment/src/parsers/custom-object-parser.ts:1)
  - [src/parsers/lwc-parser.ts](/Users/polux/dev/smart-deployment/src/parsers/lwc-parser.ts:1)
  - [src/parsers/layout-parser.ts](/Users/polux/dev/smart-deployment/src/parsers/layout-parser.ts:1)
- Scope:
  - consolidate only low-risk repeated normalization helpers
- Risks:
  - over-abstraction
- Acceptance Criteria:
  - no parser is forced into an unnatural shared framework
  - root files shrink without losing clarity

## Epic 3: Wave Planning, Validation, and Cache Boundaries

- Squad: `Wave / AI Squad`
- Objective:
  - separate wave placement policy, test optimization, AI validation orchestration, and cache storage concerns
- Value:
  - better extension seams for wave logic and AI flows
  - lower coupling between planning and transport/storage details
- Scope:
  - `wave-builder`
  - `test-optimizer`
  - `wave-validation-service`
  - `cache-manager`

### Stories

#### US-RF-WAV-01

- Title:
  - Extract placement and prioritization policies from wave builder
- Files:
  - [src/waves/wave-builder.ts](/Users/polux/dev/smart-deployment/src/waves/wave-builder.ts:1)
- Scope:
  - separate candidate selection, tie-breaks, typed dependency ordering, and cycle fallback
- Risks:
  - changed wave numbering or intra-wave order
- Acceptance Criteria:
  - `generateWaves()` contract remains stable
  - placement policies become independently testable

#### US-RF-WAV-02

- Title:
  - Split test optimizer into discovery, matching, and scoring stages
- Files:
  - [src/waves/test-optimizer.ts](/Users/polux/dev/smart-deployment/src/waves/test-optimizer.ts:1)
- Scope:
  - isolate test discovery, mapping against classes/triggers, and savings/coverage scoring
- Risks:
  - degraded test matching quality
- Acceptance Criteria:
  - `TestOptimizationResult` contract remains stable
  - matching and scoring can be tested independently

#### US-RF-WAV-03

- Title:
  - Separate AI transport, prompt building, and result synthesis in wave validation
- Files:
  - [src/ai/wave-validation-service.ts](/Users/polux/dev/smart-deployment/src/ai/wave-validation-service.ts:1)
- Scope:
  - isolate provider orchestration, prompt construction, parsing, and overall risk synthesis
- Risks:
  - fallback regression
  - changed issue/risk interpretation
- Acceptance Criteria:
  - `validateWaves()` contract remains stable
  - risk synthesis is testable without transport concerns

#### US-RF-WAV-04

- Title:
  - Separate storage, expiry policy, and locking in cache manager
- Files:
  - [src/utils/cache-manager.ts](/Users/polux/dev/smart-deployment/src/utils/cache-manager.ts:1)
- Scope:
  - isolate persistence adapter, TTL/eviction policy, and lock lifecycle
- Risks:
  - stale lock regressions
  - changed expiry behavior
- Acceptance Criteria:
  - cache API stays stable
  - storage and policy evolve independently

#### US-RF-WAV-05

- Title:
  - Clarify internal contracts across wave planning, validation, and cache boundaries
- Files:
  - [src/waves/wave-builder.ts](/Users/polux/dev/smart-deployment/src/waves/wave-builder.ts:1)
  - [src/waves/test-optimizer.ts](/Users/polux/dev/smart-deployment/src/waves/test-optimizer.ts:1)
  - [src/ai/wave-validation-service.ts](/Users/polux/dev/smart-deployment/src/ai/wave-validation-service.ts:1)
  - [src/utils/cache-manager.ts](/Users/polux/dev/smart-deployment/src/utils/cache-manager.ts:1)
- Scope:
  - define minimal internal models between planning, scoring, validation, and cache payloads
- Risks:
  - unnecessary abstraction
- Acceptance Criteria:
  - each module depends on smaller explicit internal models
  - cross-module coupling is reduced

## Current Execution Plan

### Wave 1

- `US-RF-DEP-01`
- `US-RF-PAR-01`
- `US-RF-WAV-01`

### Wave 2

- `US-RF-DEP-02`
- `US-RF-PAR-02`
- `US-RF-WAV-02`

### Wave 3

- `US-RF-DEP-03`
- `US-RF-PAR-03`
- `US-RF-WAV-03`

### Wave 4

- `US-RF-DEP-04`
- `US-RF-PAR-04`
- `US-RF-WAV-04`

### Wave 5

- `US-RF-DEP-05`
- `US-RF-PAR-05`
- `US-RF-WAV-05`
