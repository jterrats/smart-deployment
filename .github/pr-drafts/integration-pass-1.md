# PR Draft: integration pass 1

## Summary

This PR consolidates the current integration work that moved Smart Deployment from planning-heavy scaffolding to a usable first working version.

## What changed

- implemented real command flows for `start`, `analyze`, `validate`, `status`, `resume`, and `config`
- added real NUT coverage for the main command surface
- replaced placeholder-heavy deployment command coverage with executable tests
- added repo-level AI configuration and multi-provider support
- integrated AI into `start`, `analyze`, and `validate`
- added conservative circular dependency remediation building blocks
- refreshed active documentation and archived misleading historical docs

## Documentation changes

- rewrote `README.md`
- rewrote `docs/README.md`
- added:
  - `docs/cli-reference.md`
  - `docs/ai-configuration.md`
  - `docs/known-limitations.md`
- archived obsolete planning/workflow docs under `docs/archive/`

## Validation

- `yarn test`

## Reviewer notes

- treat `docs/archive/` as historical context only
- the command contract in `src/commands/` and the new CLI docs should be considered the current source of truth
- AI support is usable but still intentionally documented as partial where the product is not yet fully hardened
