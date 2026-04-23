---
title: Known Limitations
description: Current product boundaries and partial areas in Smart Deployment.
permalink: /limitations/
---

# Known Limitations

The current codebase is usable, but not everything is fully generalized yet.

## Current Boundaries

- live deployment validation across all org/topology combinations still needs broader field validation
- circular dependency remediation is conservative and limited to supported cases
- resume/status semantics are local-state driven and not yet a full remote deployment orchestration layer
- the provider ecosystem is still small even though the abstraction is ready for more adapters

## Practical Recommendation

Treat Smart Deployment as a dependency-aware deployment assistant with a usable first command surface, not as a fully universal Salesforce deployment platform yet.

## Detailed Reference

- [Known limitations on GitHub](https://github.com/{{ site.repository }}/blob/main/docs/known-limitations.md)
- [Issue implementation matrix](https://github.com/{{ site.repository }}/blob/main/docs/ISSUE_IMPLEMENTATION_MATRIX.md)
