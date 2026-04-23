---
title: Commands
description: Command surface for Smart Deployment.
permalink: /commands/
---

# CLI Reference

Smart Deployment currently exposes six primary commands:

- `sf smart-deployment analyze`
- `sf smart-deployment start`
- `sf smart-deployment validate`
- `sf smart-deployment status`
- `sf smart-deployment resume`
- `sf smart-deployment config`

## Common Patterns

```bash
sf smart-deployment analyze --source-path force-app
sf smart-deployment start --source-path force-app --target-org myorg
sf smart-deployment validate --source-path force-app --use-ai
sf smart-deployment status --source-path force-app
sf smart-deployment resume --source-path force-app --retry-strategy standard
sf smart-deployment config --source-path . --set-llm-provider openai
```

## Current Flags Worth Knowing

- `--source-path`
- `--use-ai`
- `--target-org`
- `--dry-run`
- `--validate-only`
- `--skip-tests`
- `--allow-cycle-remediation`

## Detailed Reference

The full command detail lives in the repository docs:

- [CLI reference on GitHub](https://github.com/{{ site.repository }}/blob/main/docs/cli-reference.md)
- [README quick start](https://github.com/{{ site.repository }}#quick-start)
