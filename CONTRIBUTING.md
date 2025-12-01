# Contributing to Smart Deployment Plugin

Thank you for your interest in contributing! This document provides guidelines and standards for contributing to this project.

---

## 📋 Table of Contents

- [Development Philosophy](#development-philosophy)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing Requirements](#testing-requirements)
- [Documentation Requirements](#documentation-requirements)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Definition of Done](#definition-of-done)

---

## 🎯 Development Philosophy

This project follows strict engineering principles:

### 1. **TDD/BDD/EDD First**
- Write tests BEFORE implementation
- Define behavior with Gherkin scenarios
- Design error handling first

### 2. **Layered Architecture**
- Respect the 7-layer architecture (Commands → Core → Services → Parsers → Utils)
- Each layer has a single responsibility
- No cross-layer dependencies (only downward)

### 3. **Functional Programming**
- Pure functions wherever possible
- Immutability by default
- Composition over inheritance
- Use `pipe` and `compose` for data transformations

### 4. **Type Safety**
- Strict TypeScript mode enabled
- No `any` types (use `unknown` if needed)
- Explicit return types on all functions
- Comprehensive type definitions

### 5. **Error-First Design**
- Handle errors gracefully
- Provide actionable error messages
- Include context in errors
- Implement fallback strategies

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18+ (LTS)
- **Yarn**: v1.22+
- **Git**: v2.30+
- **GitHub CLI**: Latest version (for issues automation)
- **Salesforce CLI**: Latest version (for testing)

### Initial Setup

```bash
# Clone repository
git clone git@github.com:jterrats/smart-deployment.git
cd smart-deployment

# Install dependencies
yarn install

# Build project
yarn build

# Run tests
yarn test

# Link plugin to SF CLI
sf plugins link .
```

---

## 🔄 Development Workflow

### 1. Pick a User Story

Browse [GitHub Issues](https://github.com/jterrats/smart-deployment/issues?q=is%3Aissue+is%3Aopen+label%3Auser-story) and pick one:

```bash
# Find an issue labeled with:
# - user-story
# - priority:must-have or priority:should-have
# - No assignee

# Assign yourself to the issue
gh issue edit <issue-number> --add-assignee @me
```

### 2. Create a Feature Branch

```bash
# Branch naming convention: type/issue-number-short-description
git checkout -b feat/123-functional-utilities
git checkout -b fix/456-parse-error
git checkout -b docs/789-update-readme
git checkout -b test/101-apex-parser-tests
```

Branch types:
- `feat/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `test/` - Adding tests
- `docs/` - Documentation
- `chore/` - Maintenance tasks

### 3. Write Tests First (TDD)

```bash
# Create test file
touch test/unit/utils/functional.test.ts

# Write failing tests
# Run in watch mode
yarn test:watch
```

### 4. Implement Feature

- Follow [Code Standards](#code-standards)
- Keep functions small and focused
- Add JSDoc comments
- Use TypeScript types strictly

### 5. Ensure All Tests Pass

```bash
# Unit tests
yarn test

# Integration tests
yarn test:integration

# E2E tests
yarn test:e2e

# Coverage (must be >90%)
yarn test:coverage
```

### 6. Update Documentation

- Update README if needed
- Add JSDoc to new functions
- Update architecture docs if changed
- Add examples for new features

### 7. Commit Changes

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git add .
git commit -m "feat(utils): implement pipe and compose functions

- Added pipe() for left-to-right composition
- Added compose() for right-to-left composition
- Includes async support
- 100% test coverage

Closes #123"
```

### 8. Push and Create PR

```bash
git push origin feat/123-functional-utilities

# Create PR
gh pr create --fill
```

---

## 💻 Code Standards

### TypeScript Guidelines

#### ✅ DO

```typescript
// Pure functions with explicit types
export const topologicalSort = <T>(
  graph: Map<T, Set<T>>
): T[][] => {
  // Implementation
};

// Functional composition
export const deploymentPipeline = pipe(
  scanMetadata,
  parseComponents,
  resolveDependencies,
  generateWaves
);

// Immutability
const newArray = [...oldArray, newItem];
const newObject = { ...oldObject, newProp: value };

// Descriptive variable names
const totalComponentCount = components.length;
const hasCircularDependency = cycles.length > 0;
```

#### ❌ DON'T

```typescript
// No 'any' types
const data: any = response; // BAD

// No mutations
array.push(item); // BAD - use [...array, item]
object.property = value; // BAD - use { ...object, property: value }

// No abbreviations
const cnt = 0; // BAD - use count
const comp = {}; // BAD - use component

// No side effects in pure functions
const calculate = (x: number) => {
  saveToDatabase(x); // BAD - side effect
  return x * 2;
};
```

### File Organization

```
src/
├── commands/           # CLI commands (OCLIF)
│   └── smart-deployment/
│       ├── start.ts    # One command per file
│       └── analyze.ts
├── core/              # Business logic
│   ├── dependency-engine.ts
│   └── orchestrator.ts
├── services/          # Operations
│   ├── metadata-scanner.ts
│   └── wave-generator.ts
├── parsers/           # Metadata parsers
│   ├── index.ts       # Barrel export + factory
│   ├── apex-parser.ts
│   └── flow-parser.ts
├── utils/             # Utilities
│   ├── functional.ts
│   └── graph-algorithms.ts
├── types/             # Type definitions
│   ├── index.ts       # Export all
│   ├── metadata.ts
│   └── dependency.ts
└── constants/         # Configuration
    ├── salesforce-limits.ts
    └── deployment-order.ts
```

### Naming Conventions

```typescript
// Files: kebab-case
// apex-parser.ts, dependency-engine.ts

// Classes: PascalCase
class DependencyEngine {}
class ApexParser {}

// Functions: camelCase
function parseApexClass() {}
function topologicalSort() {}

// Constants: UPPER_SNAKE_CASE
const MAX_COMPONENTS_PER_WAVE = 300;
const DEFAULT_TIMEOUT = 60000;

// Interfaces: PascalCase with 'I' prefix (optional)
interface MetadataComponent {}
interface IParser {} // If needed for distinction

// Types: PascalCase
type ParseResult<T> = { data: T; errors: Error[] };

// Enums: PascalCase
enum MetadataType {
  ApexClass = 'ApexClass',
  Flow = 'Flow',
}
```

### Function Guidelines

```typescript
// Small, focused functions (max 50 lines)
// Single Responsibility Principle
// Pure when possible

// Good: Pure, composable
export const filterByType = (type: MetadataType) =>
  (components: Component[]): Component[] =>
    components.filter(c => c.type === type);

// Good: Explicit error handling
export const parseFile = async (path: string): Promise<ParseResult> => {
  try {
    const content = await readFile(path);
    return { data: parse(content), errors: [] };
  } catch (error) {
    return {
      data: null,
      errors: [new ParseError({ path, error })]
    };
  }
};

// Good: JSDoc with examples
/**
 * Sorts components in topological order based on dependencies
 *
 * @param graph - Dependency graph (node → dependencies)
 * @returns Array of arrays representing deployment waves
 *
 * @example
 * const graph = new Map([
 *   ['A', new Set(['B'])],
 *   ['B', new Set(['C'])],
 *   ['C', new Set()]
 * ]);
 *
 * const waves = topologicalSort(graph);
 * // Result: [['C'], ['B'], ['A']]
 */
export const topologicalSort = <T>(graph: Map<T, Set<T>>): T[][] => {
  // Implementation
};
```

---

## 🧪 Testing Requirements

### Test Coverage Requirements

| Layer | Unit Coverage | Integration | E2E |
|-------|--------------|-------------|-----|
| Utils | 100% | - | - |
| Parsers | 95% | Required | - |
| Services | 90% | Required | Some |
| Core | 90% | Required | Required |
| Commands | 85% | Required | Required |

### Test Structure

```typescript
// test/unit/utils/functional.test.ts
import { describe, it, expect } from '@jest/globals';
import { pipe, compose } from '../../../src/utils/functional.js';

describe('pipe()', () => {
  it('should execute functions left-to-right', () => {
    const add = (x: number) => x + 1;
    const multiply = (x: number) => x * 2;

    const result = pipe(add, multiply)(5);

    expect(result).toBe(12); // (5 + 1) * 2
  });

  it('should handle async functions', async () => {
    const fetchData = async (id: number) => ({ id, name: 'Test' });
    const extractName = (data: { name: string }) => data.name;

    const result = await pipe(fetchData, extractName)(1);

    expect(result).toBe('Test');
  });

  // Negative scenario (EDD)
  it('should throw on null function', () => {
    expect(() => pipe(null as any)).toThrow(TypeError);
  });
});
```

### BDD Tests (Gherkin)

```gherkin
# test/e2e/features/deployment.feature
Feature: Smart Deployment
  As a Salesforce developer
  I want to deploy metadata intelligently
  So that I avoid deployment failures

  Background:
    Given a Salesforce project at "fixtures/sample-project"
    And a target org "devhub"

  Scenario: Successful deployment with dependency analysis
    Given the project has 50 Apex classes
    And the project has 20 Flows
    When I run "sf smart-deployment start --target-org devhub"
    Then the deployment should succeed
    And the deployment should generate 5 waves
    And wave 1 should contain CustomObjects
    And wave 5 should contain Flows
```

---

## 📚 Documentation Requirements

Every contribution must include:

### 1. Code Comments

```typescript
/**
 * Resolves all dependencies for a set of components
 *
 * Uses static analysis and optional AI inference to build
 * a complete dependency graph.
 *
 * @param components - Array of metadata components to analyze
 * @param options - Resolution options
 * @param options.useAI - Enable Agentforce inference (default: true)
 * @param options.includeTests - Include test dependencies (default: true)
 * @returns Resolved dependency graph
 *
 * @throws {DependencyError} When circular dependencies are detected
 *
 * @example
 * const components = await scanProject('./my-project');
 * const graph = await resolveDependencies(components, { useAI: true });
 */
export async function resolveDependencies(
  components: Component[],
  options: ResolverOptions = {}
): Promise<DependencyGraph> {
  // Implementation
}
```

### 2. README Updates

If adding a new feature, update README with:
- Feature description
- Usage example
- Configuration options

### 3. Architecture Documentation

If changing architecture, update:
- `docs/architecture/ARCHITECTURE.md`
- Add ADR (Architecture Decision Record) in `docs/adr/`

### 4. User Stories

Link implementation to user story in commit message:
```
feat(parsers): implement Apex parser

Implements US-013: Apex Class Parser
- Extracts extends relationships
- Extracts implements relationships
- Handles inner classes

Closes #13
```

---

## 📝 Commit Message Guidelines

Follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Code style (formatting, semicolons, etc.)
- `refactor:` - Code refactoring
- `perf:` - Performance improvement
- `test:` - Adding/updating tests
- `chore:` - Maintenance tasks
- `ci:` - CI/CD changes

### Scopes

- `utils` - Utility functions
- `parsers` - Metadata parsers
- `services` - Service layer
- `core` - Core business logic
- `commands` - CLI commands
- `types` - Type definitions
- `tests` - Test infrastructure

### Examples

```bash
feat(parsers): add Flow parser with GenAI support

- Parses Flow metadata XML
- Extracts Apex action references
- Extracts GenAI prompt references
- Includes 12 unit tests

Closes #15

---

fix(services): handle permission denied error in scanner

Previously, permission denied errors would crash the scanner.
Now they are caught, logged, and skipped gracefully.

Fixes #234

---

test(parsers): add negative scenarios for Apex parser

Added 15 EDD tests for error handling:
- Corrupted files
- Invalid syntax
- Missing classes

Related to #63
```

---

## 🔀 Pull Request Process

### 1. PR Checklist

Before creating a PR, ensure:

- [ ] All tests pass (`yarn test`)
- [ ] Coverage is >90% for modified code
- [ ] No linter errors (`yarn lint`)
- [ ] Documentation is updated
- [ ] Commit messages follow conventions
- [ ] Branch is rebased on main
- [ ] PR description is complete

### 2. PR Template

Use the PR template (`.github/PULL_REQUEST_TEMPLATE.md`):

```markdown
## Description
Brief description of changes

## Related Issues
Closes #123
Related to #456

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added to complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added proving fix/feature works
- [ ] Dependent changes merged
```

### 3. Code Review Requirements

PRs require:
- **1 approval** from maintainer
- **All checks passing** (tests, linter, coverage)
- **No merge conflicts**
- **Up-to-date with main**

### 4. Review Guidelines

Reviewers should check:
- ✅ Follows architecture guidelines
- ✅ Tests are comprehensive
- ✅ Code is readable and maintainable
- ✅ No performance issues
- ✅ Error handling is robust
- ✅ Documentation is clear

---

## ✅ Definition of Done

A user story is considered "done" when:

### Code
- [ ] Implementation complete per acceptance criteria
- [ ] Code reviewed and approved
- [ ] Follows all code standards
- [ ] No code smells or technical debt

### Tests
- [ ] Unit tests written (TDD)
- [ ] Integration tests written
- [ ] E2E tests written (BDD)
- [ ] Negative scenarios covered (EDD)
- [ ] Coverage >90% for the feature
- [ ] All tests passing

### Documentation
- [ ] JSDoc added to all functions
- [ ] README updated if needed
- [ ] Architecture docs updated if needed
- [ ] Examples provided

### Quality
- [ ] No linter errors
- [ ] No TypeScript errors
- [ ] No console.log statements
- [ ] Performance acceptable
- [ ] Memory leaks checked

### Integration
- [ ] Merged to main
- [ ] CI/CD passing
- [ ] No breaking changes (or documented)
- [ ] Version bumped if needed

---

## 🤝 Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all.

### Our Standards

**Positive behavior:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community

**Unacceptable behavior:**
- Trolling, insulting/derogatory comments
- Public or private harassment
- Publishing others' private information
- Other conduct which could reasonably be considered inappropriate

### Enforcement

Violations should be reported to the project maintainers.

---

## 💬 Getting Help

All support is provided through GitHub. Please do not email or contact maintainers directly.

### Where to Get Help

- **🐛 Bug Reports**: [Create an Issue](https://github.com/jterrats/smart-deployment/issues/new?template=bug_report.md)
- **✨ Feature Requests**: [Create an Issue](https://github.com/jterrats/smart-deployment/issues/new?template=feature_request.md)
- **❓ Questions**: [GitHub Discussions](https://github.com/jterrats/smart-deployment/discussions)
- **📚 Documentation**: [docs/](./docs/)
- **💡 User Stories**: [View all user stories](https://github.com/jterrats/smart-deployment/issues?q=is%3Aissue+label%3Auser-story)

### Response Time

- **Critical bugs**: Within 24-48 hours
- **General issues**: Within 1 week
- **Feature requests**: Reviewed in sprint planning
- **Questions**: Community-driven, best effort

### Before Asking for Help

1. **Search existing issues**: Your question may already be answered
2. **Read the documentation**: Check [docs/](./docs/) and README
3. **Review user stories**: Understanding our roadmap may answer your question
4. **Provide context**: Include code samples, error messages, and steps to reproduce

---

## 🎓 Learning Resources

- [Salesforce CLI Plugin Development](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_plugins.meta/sfdx_cli_plugins/)
- [Functional Programming in TypeScript](https://github.com/gcanti/fp-ts)
- [Test-Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

**Thank you for contributing!** 🎉

Your contributions help make Salesforce deployments better for everyone.

