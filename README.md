# Smart Deployment

[![CI](https://img.shields.io/github/actions/workflow/status/jterrats/smart-deployment/test.yml?branch=main&label=CI&logo=github)](https://github.com/jterrats/smart-deployment/actions/workflows/test.yml)
[![License](https://img.shields.io/github/license/jterrats/smart-deployment)](https://github.com/jterrats/smart-deployment/blob/main/LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/jterrats/smart-deployment?display_name=tag&label=latest%20release)](https://github.com/jterrats/smart-deployment/releases)
[![Node Version](https://img.shields.io/node/v/@jterrats/smart-deployment?logo=node.js)](https://www.npmjs.com/package/@jterrats/smart-deployment)
[![npm](https://img.shields.io/npm/v/@jterrats/smart-deployment?logo=npm&label=npm)](https://www.npmjs.com/package/@jterrats/smart-deployment)

Smart Deployment is a Salesforce CLI plugin that analyzes metadata, builds deployment waves, validates project state, and executes staged deployments with optional AI assistance.

The current codebase supports:

- metadata scanning and dependency graph generation
- wave generation with circular dependency detection
- conservative circular dependency remediation for supported `ApexClass` cycles
- real CLI flows for `start`, `analyze`, `validate`, `status`, `resume`, and `config`
- AI-assisted dependency inference, priority weighting, and validation
- multiple LLM providers through a shared provider abstraction

## Current Status

This repository is in active development, but the command surface is now usable as a first working version.

What is working today:

- `sf smart-deployment analyze`
- `sf smart-deployment start`
- `sf smart-deployment validate`
- `sf smart-deployment status`
- `sf smart-deployment resume`
- `sf smart-deployment config`
- JSON and HTML analysis reports
- repo-level AI configuration via `.smart-deployment.json`

What is still partial:

- full live deployment validation against real Salesforce orgs across all flows
- broader automatic circular dependency remediation beyond simple supported cases
- richer deployment resume/polling semantics against remote deployment backends
- broader provider ecosystem beyond the currently implemented adapters

## Installation

```bash
sf plugins install @jterrats/smart-deployment
```

For local development:

```bash
yarn install
yarn build
sf plugins link .
```

## Quick Start

Analyze a project:

```bash
sf smart-deployment analyze --source-path force-app
```

Generate a saved plan and JSON report:

```bash
sf smart-deployment analyze \
  --source-path force-app \
  --use-ai \
  --save-plan \
  --output analysis.json \
  --format json
```

Run a dry deployment:

```bash
sf smart-deployment start \
  --source-path force-app \
  --dry-run
```

Run with AI and allow conservative cycle remediation:

```bash
sf smart-deployment start \
  --source-path force-app \
  --target-org myorg \
  --use-ai \
  --allow-cycle-remediation
```

Validate without executing deployment:

```bash
sf smart-deployment validate \
  --source-path force-app \
  --use-ai
```

When to use each:

- use `validate` for a readiness and risk check
- use `start --dry-run` to rehearse the real deployment command flow without executing the deploy

Show persisted deployment state:

```bash
sf smart-deployment status --source-path force-app
```

Resume a failed deployment from local state:

```bash
sf smart-deployment resume \
  --source-path force-app \
  --retry-strategy standard
```

Configure the default AI provider for a repo:

```bash
sf smart-deployment config \
  --source-path . \
  --set-llm-provider openai \
  --set-llm-model gpt-4o-mini
```

## Commands

See:

- [CLI reference](docs/cli-reference.md)
- [AI configuration](docs/ai-configuration.md)
- [Known limitations](docs/known-limitations.md)
- [Release candidate checklist](docs/release-candidate-checklist.md)
- [Documentation index](docs/README.md)

## AI Providers

The AI layer is no longer Agentforce-only.

Current provider model:

- shared provider abstraction in `src/ai/llm-provider.ts`
- provider factory in `src/ai/llm-provider-factory.ts`
- concrete adapters currently implemented for:
  - `agentforce`
  - `openai`

AI is optional. When unavailable, supported flows fall back to deterministic heuristics where possible.

## Repo Configuration

Repo-scoped configuration is stored in:

```text
.smart-deployment.json
```

Example:

```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "endpoint": "https://api.openai.com/v1/chat/completions",
    "timeout": 30000
  },
  "priorities": {
    "ApexClass:CriticalService": 100
  }
}
```

Deployment runtime state is stored separately under `.smart-deployment/` and should not be committed.

## Testing

Main commands:

```bash
yarn test
yarn test:compile
yarn test:only
yarn lint
```

The suite currently includes unit, integration-style, and NUT coverage for the main CLI flows.

## Documentation Policy

The repository contains both active documentation and historical design/planning material.

- active docs live in `docs/`
- archived historical docs live in `docs/archive/`

If a document describes flags or workflows that do not exist in the current command layer, treat the archived version as historical only.
