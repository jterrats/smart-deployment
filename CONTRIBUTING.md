# Contributing

Contributions should align with the current product surface, not archived planning docs.

## Architecture Rules

Read [AGENTS.md](/Users/polux/dev/smart-deployment/AGENTS.md:1) before making non-trivial code changes.

That file is the local architecture contract for this repo and defines:

- Clean Architecture expectations
- SOLID guardrails
- separation of concerns by layer
- complexity/refactor triggers for hotspot files
- delegation and handoff rules for parallel agent work
- definition of ready / done for non-trivial delivery

## Before Opening A PR

- run `yarn test`
- update documentation when command behavior or config changes
- prefer real command-level coverage for CLI behavior
- avoid introducing docs for flags or workflows that are not implemented

## Documentation Rules

- active docs belong in `docs/`
- historical or superseded docs belong in `docs/archive/`
- the command implementations in `src/commands/` are the source of truth for supported flags

## Scope Guidance

Good contribution targets:

- command behavior
- deployment orchestration
- report generation
- AI provider adapters
- dependency analysis
- parser improvements
- tests that replace weak or historical coverage

## Notes

If a change expands the command contract, update:

- `README.md`
- `docs/README.md`
- `docs/cli-reference.md`
- any relevant focused guide such as `docs/ai-configuration.md` or `docs/known-limitations.md`
