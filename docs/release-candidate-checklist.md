# Release Candidate Checklist

This checklist defines the minimum bar for cutting a release candidate of `@jterrats/smart-deployment`.

## Entry Criteria

- `main` is green in GitHub Actions
- `yarn test` passes locally
- `yarn lint` passes locally
- `tsc -p ./test --pretty false` passes locally
- no known failing NUTs on Linux or Windows

## Functional Smoke

Run and verify at least these flows against a fixture Salesforce project:

- `sf smart-deployment analyze --source-path <path>`
- `sf smart-deployment analyze --source-path <path> --save-plan --output analysis.json --format json`
- `sf smart-deployment validate --source-path <path> --json`
- `sf smart-deployment start --source-path <path> --dry-run`
- `sf smart-deployment status --source-path <path>`
- `sf smart-deployment resume --source-path <path> --retry-strategy standard --json`

## Packaging

- `npm pack --dry-run` succeeds
- tarball contains `lib/**`
- tarball contains `messages/**`
- tarball contains `oclif.manifest.json`
- tarball contains `oclif.lock`
- package metadata matches the public repo:
  - `name`
  - `version`
  - `repository`
  - `homepage`
  - `bugs`
  - `license`

## Release Readiness

- `README.md` reflects the current command surface
- `docs/cli-reference.md` reflects the current flags
- `docs/known-limitations.md` reflects real remaining gaps
- release notes summarize:
  - supported commands
  - AI support status
  - circular remediation scope
  - known limitations

## NPM Publication Readiness

- target version does not already exist on npm
- `NPM_TOKEN` has publish permission for `@jterrats/smart-deployment`
- `auto-release` and `publish-npm` workflows are enabled and green on `main`

## Known Non-Blockers For RC

These do not need to be fully solved before an RC if the rest of the checklist is green:

- deeper refactors of remaining large core files
- richer non-heuristic test selection
- broader AI provider ecosystem
- broader real-org deployment coverage beyond current smoke scope

## Current Focus After RC

After the first RC, focus should move to:

- real-org validation depth
- broader remediation support
- stronger remote deployment lifecycle semantics
- final stabilization of JSON/report contracts
