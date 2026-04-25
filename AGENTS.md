# Architecture Rules

This repository follows pragmatic Clean Architecture, SOLID, and separation-of-concerns rules.
These rules apply to all new code, refactors, and reviews.

## Core Principles

1. Prefer small, composable units over large multi-purpose files.
2. Keep orchestration separate from parsing, domain logic, persistence, and I/O.
3. Make dependencies point inward toward domain logic, not outward toward frameworks or CLI glue.
4. Favor explicit data flow over hidden mutation or implicit side effects.
5. Add behavior in the narrowest layer that can own it correctly.

## Layering

- `commands/` are orchestration adapters.

  - Parse flags
  - call services/pipelines
  - format user-facing output
  - do not embed domain rules, scanning logic, AI heuristics, or persistence-heavy workflows

- `services/`, `deployment/`, `dependencies/`, `waves/` contain application and domain behavior.

  - business rules belong here
  - keep files focused on one capability

- `parsers/` extract structured facts from source artifacts.

  - parsers should parse, normalize, and return structured information
  - parsers should not decide deployment order, state transitions, or CLI behavior

- `types/` define stable contracts.
  - avoid leaking tool-specific or transport-specific shapes into core types unless intentional

## SOLID Rules

### Single Responsibility

- A file should have one clear reason to change.
- If a module both:
  - interprets metadata
  - decides behavior
  - persists state
  - and formats output
    it is too broad and should be split.

### Open / Closed

- Prefer registries, strategy objects, factories, and helper modules over long branching edits.
- New metadata types or providers should usually extend an existing seam instead of modifying unrelated code paths.

### Liskov / Interface Discipline

- Keep subtype-specific behavior behind explicit contracts.
- Do not overload generic types with incompatible assumptions.

### Interface Segregation

- Prefer small option objects and focused interfaces.
- Avoid large “god” service APIs that force callers to depend on methods they do not use.

### Dependency Inversion

- High-level workflows should depend on abstractions or stable collaborators.
- Keep tool integrations such as CLI, filesystem, network, and AI provider access behind dedicated modules.

## Separation of Concerns

- Do not mix these concerns in one module unless the module is explicitly an orchestrator:

  - CLI parsing
  - filesystem access
  - metadata parsing
  - dependency reasoning
  - deployment execution
  - state persistence
  - report rendering

- If orchestration is required, extract sub-steps into named collaborators.

## Complexity Guardrails

- Prefer extraction before adding more branches to already large files.
- Treat these as refactor triggers:

  - file is approaching ~400 lines and still growing
  - method complexity exceeds lint threshold
  - one change requires touching unrelated parts of the same file
  - tests need heavy setup because responsibilities are tangled

- When a file becomes a hotspot:
  - extract pure helpers first
  - then extract focused services
  - then reduce the root orchestrator to composition

## State and Side Effects

- Keep pure calculations pure when possible.
- Isolate side effects:

  - file writes
  - CLI execution
  - network calls
  - deployment state mutation

- Prefer returning structured results over logging-driven control flow.

## Testing Rules

- Test behavior at the correct level:

  - parsers: focused unit tests
  - orchestration: command or integration-style tests
  - domain logic: deterministic unit tests

- Add regression tests for:
  - refactor seams
  - bug fixes
  - non-obvious dependency semantics
  - cross-platform behavior

## Review Checklist

Before merging, ask:

1. Does this change put logic in the right layer?
2. Did this make a hotspot bigger when it should have been split?
3. Are side effects isolated?
4. Is the new behavior expressed through existing abstractions or by adding branching to a god file?
5. Would another engineer know where to extend this next?

## Current Refactor Bias

When in doubt, prefer reducing responsibility in:

- `src/commands/start.ts`
- `src/services/metadata-scanner-service.ts`
- `src/dependencies/dependency-merger.ts`
- `src/parsers/email-template-parser.ts`

New work should avoid making these files broader unless the change is explicitly a cleanup or extraction.
