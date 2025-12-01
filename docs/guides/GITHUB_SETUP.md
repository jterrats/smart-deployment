# ⚙️ GitHub Repository Setup

Complete guide to configure GitHub repository settings for the Smart Deployment Plugin.

---

## 🔒 Branch Protection Rules

### Main Branch Protection

Navigate to: `Settings` → `Branches` → `Branch protection rules` → `Add rule`

**Branch name pattern**: `main`

#### Protection Settings

**✅ Require a pull request before merging**
- Require approvals: `1`
- Dismiss stale pull request approvals when new commits are pushed
- Require review from Code Owners
- Require approval of the most recent reviewable push

**✅ Require status checks to pass before merging**
- Require branches to be up to date before merging

**Required status checks**:
- `tests / unit-tests`
- `tests / nuts`
- `validate-acceptance-criteria / validate-acceptance-criteria`
- `validate-acceptance-criteria / Check if AC are complete (required for merge)`

**✅ Require conversation resolution before merging**

**✅ Require signed commits**

**✅ Require linear history**

**✅ Do not allow bypassing the above settings**
- Administrators included

**✅ Restrict pushes that create matching branches**
- Only allow specified actors:
  - Repository maintainers
  - GitHub Actions (for automated releases)

---

## 🏷️ Labels Configuration

### Create Required Labels

```bash
# Epic labels
gh label create "epic:core-infrastructure" --color 8B4513 --description "Epic 1: Core Infrastructure"
gh label create "epic:metadata-parsers" --color 8B4513 --description "Epic 2: Metadata Parsers"
gh label create "epic:dependency-analysis" --color 8B4513 --description "Epic 3: Dependency Analysis"
gh label create "epic:wave-generation" --color 8B4513 --description "Epic 4: Wave Generation"
gh label create "epic:cli-commands" --color 8B4513 --description "Epic 5: CLI Commands"
gh label create "epic:agentforce" --color 8B4513 --description "Epic 6: Agentforce Integration"
gh label create "epic:testing" --color 8B4513 --description "Epic 7: Testing Infrastructure"
gh label create "epic:error-handling" --color 8B4513 --description "Epic 8: Error Handling"
gh label create "epic:project-scanner" --color 8B4513 --description "Epic 9: Project Scanner"
gh label create "epic:deployment" --color 8B4513 --description "Epic 10: Deployment Execution"

# Priority labels
gh label create "priority:must-have" --color d73a4a --description "Must Have - P0"
gh label create "priority:should-have" --color fbca04 --description "Should Have - P1"
gh label create "priority:could-have" --color 0e8a16 --description "Could Have - P2"
gh label create "priority:wont-have" --color d4c5f9 --description "Won't Have this iteration"

# Type labels
gh label create "user-story" --color 1d76db --description "User Story"
gh label create "bug" --color d73a4a --description "Bug Report"
gh label create "enhancement" --color a2eeef --description "Feature Request"
gh label create "needs-triage" --color fef2c0 --description "Needs Triage"
gh label create "needs-ac-coverage" --color f9d0c4 --description "Acceptance Criteria not covered"

# Story points labels
for i in {1..13}; do
  gh label create "points:$i" --color c5def5 --description "Story Points: $i"
done
```

---

## 🤖 GitHub Actions Secrets

### Required Secrets

Navigate to: `Settings` → `Secrets and variables` → `Actions` → `New repository secret`

**Required secrets**:

| Secret Name | Description | Used For |
|-------------|-------------|----------|
| `GITHUB_TOKEN` | Automatically provided by GitHub | Updating issues, posting comments |
| `NPM_TOKEN` | npm authentication token | Publishing to npm registry |
| `SVC_CLI_BOT_GITHUB_TOKEN` | Bot account token for releases | Automated releases |

**Note**: `GITHUB_TOKEN` is automatically available in workflows. You may need to add `NPM_TOKEN` and `SVC_CLI_BOT_GITHUB_TOKEN` manually.

---

## 📋 Rulesets (Alternative to Branch Protection)

GitHub Rulesets provide more flexibility than branch protection rules.

### Create Ruleset

Navigate to: `Settings` → `Rules` → `Rulesets` → `New ruleset`

**Ruleset name**: `Main Branch Protection`

**Enforcement status**: `Active`

**Target branches**: `Include by pattern` → `main`

#### Rules

**1. Restrict creations**
- Nobody can create branches matching `main`

**2. Restrict deletions**
- Nobody can delete `main` branch

**3. Require a pull request before merging**
- Required approving review count: `1`
- Dismiss stale reviews
- Require review from Code Owners

**4. Require status checks to pass**
- Require branches to be up to date
- Status checks:
  - `validate-acceptance-criteria / validate-acceptance-criteria`
  - `validate-acceptance-criteria / Check if AC are complete`
  - `tests / unit-tests`
  - `tests / nuts`

**5. Block force pushes**

**6. Require signed commits**

**7. Require linear history**

---

## 🔍 Code Scanning

### CodeQL Analysis

Navigate to: `Security` → `Code scanning` → `Set up CodeQL`

Or create `.github/workflows/codeql.yml`:

```yaml
name: "CodeQL"

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 0 * * 1'

jobs:
  analyze:
    name: Analyze
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write

    strategy:
      fail-fast: false
      matrix:
        language: [ 'javascript' ]

    steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Initialize CodeQL
      uses: github/codeql-action/init@v3
      with:
        languages: ${{ matrix.language }}

    - name: Autobuild
      uses: github/codeql-action/autobuild@v3

    - name: Perform CodeQL Analysis
      uses: github/codeql-action/analyze@v3
```

---

## 📊 Insights Configuration

### Enable Insights

Navigate to: `Insights` → `Community Standards`

Ensure you have:
- ✅ README
- ✅ Code of conduct
- ✅ Contributing guidelines
- ✅ License
- ✅ Issue templates
- ✅ Pull request template

---

## 🔔 Notifications

### Team Mentions

Create teams for notifications:

```bash
# Create teams
gh api /orgs/YOUR_ORG/teams -f name="smart-deployment-reviewers" -f privacy="closed"
gh api /orgs/YOUR_ORG/teams -f name="smart-deployment-maintainers" -f privacy="closed"

# Add members
gh api /orgs/YOUR_ORG/teams/smart-deployment-reviewers/memberships/USERNAME -X PUT
```

### CODEOWNERS File

Create `.github/CODEOWNERS`:

```
# Default owners for everything
* @jterrats

# Documentation
/docs/ @jterrats @smart-deployment-reviewers

# Critical files
/src/core/ @smart-deployment-maintainers
/src/parsers/ @smart-deployment-maintainers

# Tests require review
/test/ @smart-deployment-reviewers

# CI/CD changes require maintainer approval
/.github/workflows/ @smart-deployment-maintainers
```

---

## 🚀 Automated Releases

### Semantic Release Setup

The repository is configured for automated releases using semantic-release.

**Prerequisites**:
1. `NPM_TOKEN` secret configured
2. `SVC_CLI_BOT_GITHUB_TOKEN` secret configured (optional, for changelog commits)

**How it works**:
1. Merge PR to `main`
2. Semantic release analyzes commits
3. Bumps version in `package.json`
4. Generates `CHANGELOG.md`
5. Creates GitHub release
6. Publishes to npm

---

## 📝 Issue Templates Configuration

Already configured in `.github/ISSUE_TEMPLATE/`:

- `bug_report.md` - Bug reports
- `feature_request.md` - Feature requests
- `config.yml` - Template configuration

---

## ✅ Setup Checklist

After creating the repository:

- [ ] Configure branch protection rules for `main`
- [ ] Create required labels
- [ ] Add repository secrets (if publishing to npm)
- [ ] Enable CodeQL scanning
- [ ] Create CODEOWNERS file
- [ ] Configure team permissions
- [ ] Enable Discussions
- [ ] Add repository description and topics
- [ ] Configure social preview image
- [ ] Enable vulnerability alerts
- [ ] Enable Dependabot
- [ ] Configure GitHub Pages (for documentation)

---

## 🔧 Repository Settings

### General

Navigate to: `Settings` → `General`

**Features**:
- ✅ Issues
- ✅ Projects
- ✅ Discussions
- ❌ Wikis (use docs/ instead)
- ❌ Sponsorships

**Pull Requests**:
- ✅ Allow squash merging (default)
- ❌ Allow merge commits
- ❌ Allow rebase merging
- ✅ Always suggest updating pull request branches
- ✅ Automatically delete head branches

**Archives**:
- ❌ Do not archive this repository

---

## 📱 GitHub Mobile Notifications

Configure notifications for:
- Pull request reviews required
- Acceptance Criteria validation failures
- Failed CI/CD runs
- Security alerts

---

## 🎯 Branch Naming Convention Enforcement

While not directly enforceable, document the convention:

**Format**: `<type>/<issue-number>-<short-description>`

**Examples**:
- `feat/123-implement-pipe-function`
- `fix/456-handle-null-input`
- `docs/789-update-readme`
- `test/101-add-apex-parser-tests`

**Benefits**:
- Automatic issue linking
- AC validation works automatically
- Clear PR history

---

**Last Updated**: December 1, 2025  
**Version**: 1.0.0

