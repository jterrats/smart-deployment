# Development Guide

This project is currently developed as a TypeScript Salesforce CLI plugin with a trunk-oriented workflow.

## Setup

```bash
yarn install
yarn build
sf plugins link .
```

## Main Validation Commands

```bash
yarn test
yarn test:compile
yarn test:only
yarn lint
```

## Working Rules

- prefer updating the real command surface over adding planning-only artifacts
- keep runtime state out of git
- treat `docs/archive/` as historical context only
- prefer NUT coverage for end-user CLI behavior
- prefer unit tests for isolated planners, editors, and provider adapters

## Repo Conventions

- repo-level Smart Deployment config lives in `.smart-deployment.json`
- runtime deployment state lives under `.smart-deployment/`
- current AI-enabled flows are `start`, `analyze`, and `validate`

## Notes

Older development workflow docs were replaced because they described an earlier planning stage that no longer matches the repository.
