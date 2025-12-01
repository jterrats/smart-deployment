# 🛠️ Development Guide

Complete guide for developers working on the Smart Deployment Plugin.

---

## 🚀 Quick Start

```bash
# Clone and setup
git clone git@github.com:jterrats/smart-deployment.git
cd smart-deployment
yarn install
yarn build

# Link to SF CLI
sf plugins link .

# Run tests
yarn test
```

---

## 📝 Semantic Commits (ENFORCED)

This project **enforces** semantic commits using Commitizen and Commitlint.

### Using Commitizen (Recommended)

```bash
# Stage your changes
git add .

# Use commitizen for guided commit
yarn commit
```

This will launch an interactive prompt:

```
? Select the type of change that you're committing: (Use arrow keys)
❯ feat:     A new feature
  fix:      A bug fix
  docs:     Documentation only changes
  style:    Changes that do not affect the meaning of the code
  refactor: A code change that neither fixes a bug nor adds a feature
  perf:     A code change that improves performance
  test:     Adding missing tests or correcting existing tests
  chore:    Changes to the build process or auxiliary tools
```

### Commit Types

| Type | Description | Release |
|------|-------------|---------|
| `feat` | New feature | Minor version bump |
| `fix` | Bug fix | Patch version bump |
| `perf` | Performance improvement | Patch version bump |
| `docs` | Documentation only | Patch version bump |
| `refactor` | Code refactoring | Patch version bump |
| `style` | Code formatting | No release |
| `test` | Adding/updating tests | No release |
| `chore` | Maintenance tasks | No release |
| `ci` | CI/CD changes | No release |
| `build` | Build system changes | Patch version bump |
| `revert` | Revert previous commit | Patch version bump |

### Breaking Changes

Add `!` after type for breaking changes, or add `BREAKING CHANGE:` in footer:

```bash
feat(parsers)!: change Apex parser API

BREAKING CHANGE: parseApexClass now returns Promise<Result> instead of ApexClass
```

This will trigger a **major** version bump.

### Commit Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Example**:

```
feat(utils): implement pipe and compose functions

- Added pipe() for left-to-right composition
- Added compose() for right-to-left composition
- Includes async support
- 100% test coverage

Closes #123
```

### Scopes

Available scopes:
- `commands` - CLI commands
- `core` - Core business logic
- `services` - Service layer
- `parsers` - Metadata parsers
- `utils` - Utility functions
- `types` - Type definitions
- `constants` - Constants
- `generators` - Output generators
- `tests` - Testing infrastructure
- `ci` - CI/CD
- `deps` - Dependencies
- `config` - Configuration

### Validation

Commits are automatically validated on commit using Husky + Commitlint:

```bash
# This will FAIL validation:
git commit -m "updated stuff"
git commit -m "Fix bug"  # Missing scope and lowercase subject

# This will PASS validation:
git commit -m "fix(parsers): handle null input in Apex parser"
git commit -m "feat(commands): add analyze command"
```

---

## 🔄 Semantic Versioning (Automated)

This project uses **semantic-release** for automated versioning and releases.

### How It Works

1. You make commits following semantic commit conventions
2. Push to `main` branch
3. Semantic-release analyzes commits since last release
4. Automatically bumps version based on commit types
5. Generates CHANGELOG.md
6. Creates GitHub release
7. Publishes to npm (if configured)

### Version Bumps

| Commits | Version Bump | Example |
|---------|--------------|---------|
| `fix:` only | Patch | 1.0.0 → 1.0.1 |
| `feat:` | Minor | 1.0.0 → 1.1.0 |
| `BREAKING CHANGE:` | Major | 1.0.0 → 2.0.0 |

### Manual Release

```bash
# This will be automated in CI/CD, but can run manually:
yarn release
```

---

## 📋 Code Standards

All code must follow strict standards. See [CODE_STANDARDS.md](./CODE_STANDARDS.md) for details.

### Key Rules

1. **TypeScript Strict Mode**: No `any`, explicit types everywhere
2. **Functional Programming**: Pure functions, immutability, composition
3. **Layered Architecture**: Respect layer boundaries
4. **Test Coverage**: >90% for all code
5. **Error Handling**: Robust error handling with fallbacks

### Quick Check

```bash
# Lint
yarn lint

# Format
yarn format

# Build
yarn build

# Test
yarn test
```

---

## 🧪 Testing Requirements

### TDD (Test-Driven Development)

**Always write tests BEFORE implementation:**

```bash
# 1. Create test file
touch test/unit/utils/pipe.test.ts

# 2. Write failing test
# 3. Run in watch mode
yarn test:watch

# 4. Implement feature until test passes
# 5. Refactor
```

### BDD (Behavior-Driven Development)

For user-facing features, write Gherkin scenarios:

```gherkin
# test/e2e/features/deployment.feature
Feature: Smart Deployment
  Scenario: Deploy with dependency analysis
    Given a Salesforce project
    When I run "sf smart-deployment start"
    Then deployment should succeed
    And waves should be generated
```

### EDD (Error-Driven Development)

Write negative scenarios for error handling:

```typescript
describe('parseApexClass()', () => {
  // Positive test
  it('should parse valid class', () => {});
  
  // Negative tests (EDD)
  it('should throw on null input', () => {});
  it('should throw on corrupted file', () => {});
  it('should throw on invalid syntax', () => {});
});
```

### Coverage Requirements

| Layer | Coverage |
|-------|----------|
| Utils | 100% |
| Parsers | 95% |
| Services | 90% |
| Core | 90% |
| Commands | 85% |

---

## 🤝 Contributing Workflow

See [CONTRIBUTING.md](./CONTRIBUTING.md) for complete guide.

### Quick Workflow

1. **Pick an issue** from [GitHub Issues](https://github.com/jterrats/smart-deployment/issues?q=is%3Aissue+is%3Aopen+label%3Auser-story)

2. **Create branch**:
   ```bash
   git checkout -b feat/123-implement-pipe
   ```

3. **Write tests first** (TDD)

4. **Implement feature**

5. **Commit with Commitizen**:
   ```bash
   git add .
   yarn commit
   ```

6. **Push and create PR**:
   ```bash
   git push origin feat/123-implement-pipe
   gh pr create --fill
   ```

7. **Wait for review and CI checks**

8. **Merge** (squash and merge recommended)

---

## 💬 Getting Help

**ALL support is through GitHub. Do not email or contact maintainers directly.**

- 🐛 **Bug Reports**: [Create Bug Report](https://github.com/jterrats/smart-deployment/issues/new?template=bug_report.md)
- ✨ **Feature Requests**: [Create Feature Request](https://github.com/jterrats/smart-deployment/issues/new?template=feature_request.md)
- ❓ **Questions**: [GitHub Discussions](https://github.com/jterrats/smart-deployment/discussions)
- 📚 **Documentation**: [docs/](./docs/)

---

## 🏗️ Project Structure

```
smart-deployment/
├── .github/
│   ├── workflows/          # CI/CD workflows
│   ├── ISSUE_TEMPLATE/     # Issue templates
│   └── PULL_REQUEST_TEMPLATE.md
├── .husky/                 # Git hooks (commitlint)
├── docs/
│   ├── architecture/       # Architecture docs
│   ├── guides/             # Implementation guides
│   ├── methodology/        # TDD/BDD/EDD docs
│   └── proposals/          # Project proposals
├── src/
│   ├── commands/           # CLI commands
│   ├── core/              # Business logic
│   ├── services/          # Operations
│   ├── parsers/           # Metadata parsers
│   ├── generators/        # Output generators
│   ├── utils/             # Utilities
│   ├── types/             # Type definitions
│   └── constants/         # Configuration
├── test/
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── e2e/               # E2E tests (BDD)
├── scripts/               # Automation scripts
├── .commitlintrc.json     # Commit lint config
├── .cz-config.js          # Commitizen config
├── .releaserc.json        # Semantic release config
├── CODE_STANDARDS.md      # Code standards
├── CONTRIBUTING.md        # Contributing guide
└── DEVELOPMENT.md         # This file
```

---

## 🔧 Available Scripts

```bash
# Development
yarn build              # Build the plugin
yarn compile            # TypeScript compilation
yarn lint               # Run ESLint
yarn format             # Format code with Prettier
yarn clean              # Clean build artifacts

# Testing
yarn test               # Run all tests
yarn test:only          # Run tests without compilation
yarn test:watch         # Run tests in watch mode
yarn test:coverage      # Generate coverage report
yarn test:nuts          # Run NUTs (SFDX integration tests)

# Commits & Release
yarn commit             # Interactive commit with Commitizen
yarn release            # Semantic release (automated in CI)

# Plugin Development
sf plugins link .       # Link plugin to SF CLI
sf smart-deployment --help  # Test plugin
```

---

## 🚨 Common Issues

### Commit Hook Fails

**Problem**: Commit is rejected with "subject must not be sentence-case"

**Solution**: Use `yarn commit` for guided commit creation

### Tests Fail on CI but Pass Locally

**Problem**: Tests pass locally but fail in GitHub Actions

**Solution**: 
1. Check for absolute paths (use relative paths)
2. Check for OS-specific code (use cross-platform utilities)
3. Run `yarn clean-all && yarn install && yarn test`

### Husky Hooks Not Running

**Problem**: Git hooks not executing

**Solution**:
```bash
yarn husky install
chmod +x .husky/commit-msg
```

---

## 📊 Metrics and Quality Gates

### CI/CD Requirements

All PRs must pass:

- ✅ Linting (no errors)
- ✅ TypeScript compilation (no errors)
- ✅ Unit tests (all passing)
- ✅ Integration tests (all passing)
- ✅ Coverage >90% for modified code
- ✅ No merge conflicts
- ✅ 1 approval from maintainer

### Quality Metrics

- **Cyclomatic Complexity**: Max 10 per function
- **Function Length**: Max 50 lines
- **File Length**: Max 500 lines
- **Parameters**: Max 3 per function
- **Test Coverage**: Min 90% overall

---

## 📚 Additional Resources

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [Commitizen](https://github.com/commitizen/cz-cli)
- [Commitlint](https://commitlint.js.org/)
- [Semantic Release](https://semantic-release.gitbook.io/)
- [Husky](https://typicode.github.io/husky/)

---

**Last Updated**: December 1, 2025  
**Status**: Active Development

