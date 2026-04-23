# Known Limitations

This document tracks important current limitations of the Smart Deployment plugin.

## Deployment Execution

- The command layer is usable, but live deployment coverage against real orgs is still narrower than the local test coverage.
- `status` and `resume` are driven by persisted local state and are not yet a full remote deployment polling system.

## Circular Dependency Remediation

- automatic remediation is intentionally conservative
- supported scope is currently limited to simple, safely rewritable cycles
- unsupported or ambiguous cycles still require manual resolution

See [Circular dependency remediation spec](CIRCULAR_DEPENDENCY_REMEDIATION_SPEC.md) for the intended direction.

## AI Support

- AI support is optional and can fall back to heuristics
- not every product path is equally AI-enriched yet
- provider support is still early-stage despite the shared abstraction

## XML Validation

- the XML metadata validator exists, but it does not yet satisfy the full scope described in the tracked story for richer namespace, fix-up, and integration behavior

## Reporting And Contracts

- command output is becoming more structured, but the JSON contract should still be treated as evolving
- analysis reports are real and written to disk, but broader deployment-reporting semantics are still being hardened

## Historical Docs

Several documents were archived because they described non-existent flags or superseded workflows. If you find references to `--ai-auto`, `--use-plan`, `--strict`, `--verify-against-plan`, or `--max-diff`, treat those as historical material, not current product behavior.
