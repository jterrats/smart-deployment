# AI Configuration

The Smart Deployment plugin supports optional AI assistance for:

- dependency inference
- deployment priority weighting
- wave validation

AI is configured per repository through `.smart-deployment.json`.

## Supported Providers

The current codebase implements adapters for:

- `agentforce`
- `openai`

The provider abstraction is intentionally shared so additional providers can be added later without rewriting each AI-enabled service.

## Configuration File

Path:

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
  }
}
```

Supported keys today:

- `provider`
- `model`
- `endpoint`
- `timeout`

## Configure Through The CLI

Set the provider:

```bash
sf smart-deployment config --source-path . --set-llm-provider openai
```

Set the model:

```bash
sf smart-deployment config --source-path . --set-llm-model gpt-4o-mini
```

Set the endpoint:

```bash
sf smart-deployment config --source-path . --set-llm-endpoint https://api.openai.com/v1/chat/completions
```

Set the timeout:

```bash
sf smart-deployment config --source-path . --set-llm-timeout 30000
```

Show the configured AI settings:

```bash
sf smart-deployment config --source-path . --get-llm
```

## AI-Enabled Command Paths

The following flows currently consume repo-level AI config:

- `analyze --use-ai`
- `start --use-ai`
- `validate --use-ai`

These flows may report:

- provider
- model
- fallback status
- inferred dependency count
- AI priority adjustment count

## Fallback Behavior

AI is optional.

When a provider is unavailable or not configured, supported flows can fall back to deterministic heuristics instead of failing hard. Fallback behavior is surfaced in command output and reports where implemented.

## Notes

- Current docs describe the code as it exists today, not a future provider roadmap.
- Older Agentforce-only design docs were archived because the runtime is no longer single-provider.
