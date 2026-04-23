# CLI Reference

This reference describes the commands and flags currently implemented in the repository.

## `sf smart-deployment analyze`

Analyze metadata without deploying.

Supported flags:

- `--source-path <path>`
- `--save-plan`
- `--plan-path <path>`
- `--use-ai`
- `--org-type <Production|Sandbox|Developer>`
- `--industry <value>`
- `--output <path>`
- `--format <json|html>`

Behavior:

- scans metadata and dependencies
- generates deployment waves
- can save a deployment plan to `.smart-deployment/deployment-plan.json`
- can write analysis reports in JSON or HTML
- when `--use-ai` is enabled, can apply inferred dependencies and AI priority weighting

## `sf smart-deployment start`

Analyze, build waves, and execute deployment.

Supported flags:

- `--target-org <org>`
- `--dry-run`
- `--validate-only`
- `--skip-tests`
- `--source-path <path>`
- `--allow-cycle-remediation`
- `--use-ai`
- `--org-type <Production|Sandbox|Developer>`
- `--industry <value>`

Behavior:

- scans metadata
- generates waves
- can execute real deployment through `SfCliIntegration`
- persists deployment state for `status` and `resume`
- can attempt conservative cycle remediation for supported `ApexClass` cycles only

Important:

- `--allow-cycle-remediation` does not enable arbitrary source rewriting
- unsupported cycles still fail closed and require manual resolution

## `sf smart-deployment validate`

Validate deployment without executing it.

Supported flags:

- `--target-org <org>`
- `--source-path <path>`
- `--use-ai`

Behavior:

- validates the scanned project structure and generated waves
- reports issues and summary data
- can enrich validation with AI wave analysis
- does not execute deployment

## `sf smart-deployment status`

Show persisted deployment status.

Supported flags:

- `--target-org <org>`
- `--source-path <path>`

Behavior:

- reads local deployment state
- reports current wave, completed waves, remaining waves, and resumability
- includes AI metadata when present in state

## `sf smart-deployment resume`

Resume a failed deployment from persisted local state.

Supported flags:

- `--target-org <org>`
- `--source-path <path>`
- `--retry-strategy <standard|quick|validate-only>`

Behavior:

- loads failed deployment state
- rewrites state into a resumed form
- prepares the deployment to continue from the failed wave

## `sf smart-deployment config`

Manage repo-level Smart Deployment configuration.

Supported flags:

- `--source-path <path>`
- `--set <key=value>`
- `--get <key>`
- `--get-priority <MetadataType:Name>`
- `--set-priority <MetadataType:Name=priority>`
- `--set-llm-provider <agentforce|openai>`
- `--set-llm-model <name>`
- `--set-llm-endpoint <url>`
- `--set-llm-timeout <ms>`
- `--get-llm`
- `--list`

Behavior:

- reads and writes `.smart-deployment.json`
- stores metadata priority overrides
- stores default provider, model, endpoint, and timeout for AI services

## Files Written By The CLI

- repo config: `.smart-deployment.json`
- saved plan: `.smart-deployment/deployment-plan.json`
- deployment runtime state: `.smart-deployment/deployment-state.json`

The runtime state file is operational state, not source-of-truth configuration.
