---
title: AI Configuration
description: AI provider configuration for Smart Deployment.
permalink: /ai/
---

# AI Configuration

Smart Deployment supports a shared LLM provider abstraction with concrete adapters currently implemented for:

- `agentforce`
- `openai`

## Repo-Level Configuration

Configuration is stored in `.smart-deployment.json` at the repository root.

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

## What AI Enhances

- dependency inference during analysis
- priority weighting for deployment planning
- validation summaries and risk hints

## Operational Notes

- AI is optional
- deterministic fallbacks remain in place for supported flows
- provider/model selection can be stored per repo via `config`

## Detailed Reference

- [AI configuration on GitHub](https://github.com/{{ site.repository }}/blob/main/docs/ai-configuration.md)
- [Known limitations](https://github.com/{{ site.repository }}/blob/main/docs/known-limitations.md)
