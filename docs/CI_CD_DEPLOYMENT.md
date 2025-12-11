# 🚀 CI/CD Deployment Guide

## Overview

Smart Deployment supports deterministic, reproducible deployments in CI/CD pipelines using **pre-approved deployment plans**.

---

## 🎯 Strategy: Plan-Based Deployment

```
Development → Generate Plan → Review Plan → Commit Plan → CI/CD Deploy
   (with AI)      (.json)       (Human)      (Git)      (deterministic)
```

### Why Pre-Approved Plans?

| Without Plan | With Plan |
|--------------|-----------|
| ❌ Non-deterministic | ✅ Deterministic |
| ❌ AI can change priorities | ✅ Fixed priorities |
| ❌ No audit trail | ✅ Git history |
| ❌ No human review | ✅ PR review process |
| ❌ Rollback complex | ✅ Easy rollback |

---

## 📋 Workflow

### Step 1: Generate Plan (Development)

```bash
# Analyze with AI and save plan
sf smart-deployment analyze \
  --use-ai \
  --org-type Production \
  --industry Fintech \
  --save-plan

# Output:
# 📊 Analyzing metadata...
# ✅ Found 2,382 components
# 🤖 AI analysis complete (5 priorities adjusted)
# 📋 Generating deployment plan...
# ✅ Plan saved to: .smart-deployment/deployment-plan.json
```

**Generated file: `.smart-deployment/deployment-plan.json`**

```json
{
  "metadata": {
    "version": "1.0",
    "generatedAt": "2024-12-11T10:00:00Z",
    "aiEnabled": true,
    "orgType": "Production",
    "totalComponents": 2382,
    "totalWaves": 12,
    "estimatedTime": 1800
  },
  "priorityOverrides": {
    "ApexClass:PaymentHandler": {
      "priority": 95,
      "source": "ai",
      "confidence": 0.92,
      "reason": "Critical payment processing"
    }
  },
  "waves": [ /* ... */ ]
}
```

### Step 2: Review Plan (PR Review)

```bash
# Review the plan
cat .smart-deployment/deployment-plan.json

# Commit to repo
git add .smart-deployment/deployment-plan.json
git commit -m "chore: add deployment plan for release v2.3.0"
git push origin feature/my-changes

# Create PR → reviewers approve the plan
```

### Step 3: Deploy with Plan (CI/CD)

```yaml
# .github/workflows/deploy-prod.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Salesforce CLI
        run: npm install -g @salesforce/cli

      - name: Authenticate to Salesforce
        run: |
          echo "${{ secrets.SF_AUTH_URL }}" > auth.txt
          sf org login sfdx-url --sfdx-url-file auth.txt --alias prod

      - name: Deploy with approved plan
        run: |
          sf smart-deployment start \
            --target-org prod \
            --use-plan .smart-deployment/deployment-plan.json \
            --strict
```

---

## 🔐 Modes of Operation

### Mode 1: Strict (Recommended for Production)

```bash
# Requires pre-approved plan
sf smart-deployment start \
  --target-org prod \
  --use-plan deployment-plan.json \
  --strict

# ✅ Deterministic
# ✅ No AI calls
# ✅ Fast deployment
```

**Behavior:**
- ✅ Loads plan from file
- ✅ Fails if plan not found
- ✅ Uses exact priorities from plan
- ✅ No AI in runtime

### Mode 2: AI with Verification

```bash
# Uses AI but verifies against plan
sf smart-deployment start \
  --target-org prod \
  --use-ai \
  --verify-against-plan deployment-plan.json \
  --max-diff 10%

# 🤖 Uses AI
# ✅ Validates against plan
# ⚠️ Warns if diff > 10%
```

**Behavior:**
1. Runs AI analysis
2. Compares with approved plan
3. If diff > threshold → fails with report
4. If diff < threshold → proceeds

### Mode 3: Fallback (AI with Safety Net)

```bash
# Try AI, fallback to plan on error
sf smart-deployment start \
  --target-org prod \
  --use-ai \
  --use-plan deployment-plan.json \
  --ai-timeout 10s

# 🤖 Tries AI (10s timeout)
# 🛡️ Fallbacks to plan on error
```

**Behavior:**
- Attempts AI analysis (with timeout)
- Falls back to plan if:
  - AI timeout
  - AI service unavailable
  - AI returns error

---

## ⚙️ Configuration

### Config File: `.smart-deployment.json`

```json
{
  "cicd": {
    "requireApprovedPlan": true,
    "planPath": ".smart-deployment/deployment-plan.json",
    "strictMode": true,
    "maxDiffPercentage": 20,
    "validateBeforeDeploy": true
  },
  "ai": {
    "enabled": false,
    "confidenceThreshold": 0.9,
    "timeout": 10000
  }
}
```

### Environment Variables

```bash
# CI/CD environment
export SF_TARGET_ORG=prod
export SF_DEPLOYMENT_PLAN=.smart-deployment/deployment-plan.json
export SF_STRICT_MODE=true
export SF_MAX_DIFF=10%
```

---

## 📊 Examples

### Example 1: First-Time Setup

```bash
# Developer machine
$ sf smart-deployment analyze --save-plan --use-ai
✅ Plan saved

# Commit and push
$ git add .smart-deployment/deployment-plan.json
$ git commit -m "feat: deployment plan for v2.0"
$ git push

# CI/CD (first deploy)
$ sf smart-deployment start --use-plan deployment-plan.json
✅ Deployed successfully
```

### Example 2: Update Existing Plan

```bash
# Developer made changes
$ sf smart-deployment analyze --save-plan --use-ai
⚠️  Plan changed: 5 new components, 2 removed
✅ New plan saved

# Review diff
$ git diff .smart-deployment/deployment-plan.json

# Commit updated plan
$ git add .smart-deployment/deployment-plan.json
$ git commit -m "chore: update deployment plan (added GenAI features)"
```

### Example 3: CI/CD Validation Error

```bash
# CI/CD detects drift
$ sf smart-deployment start --use-plan plan.json --strict

❌ Error: Current state differs from plan by 25% (max: 20%)
   Added components: 15
   Removed components: 5

💡 Plan is outdated. Run 'sf smart-deployment analyze --save-plan' to regenerate
```

---

## 🛡️ Safety Features

### 1. Plan Validation

Before deploy, validates:
- ✅ Plan version matches
- ✅ Components match current state
- ✅ Diff within acceptable range
- ✅ Plan not too old (warns if > 7 days)

### 2. Strict Mode

```bash
--strict
```
- Requires `--use-plan`
- Fails if plan not found
- No AI calls
- Deterministic behavior

### 3. Max Diff Threshold

```bash
--max-diff 10%
```
- Validates current state vs plan
- Fails if diff > threshold
- Prevents deploying stale plans

### 4. Rollback Support

```bash
# Rollback to previous plan
git checkout HEAD~1 .smart-deployment/deployment-plan.json
sf smart-deployment start --use-plan deployment-plan.json
```

---

## 🎭 Real-World Scenarios

### Scenario 1: Hotfix Deploy

```bash
# Generate emergency plan
sf smart-deployment analyze --save-plan

# Skip PR review (approved by manager)
git commit -m "hotfix: payment processor fix"
git push origin hotfix/payment-fix

# Deploy immediately
sf smart-deployment start --use-plan deployment-plan.json
```

### Scenario 2: Scheduled Release

```bash
# Week before release
sf smart-deployment analyze --save-plan --use-ai

# Review in PR (3 approvals required)
# Merge to main

# Release day (deterministic)
sf smart-deployment start \
  --use-plan deployment-plan.json \
  --strict \
  --validate-only  # Dry run first

# If dry run OK
sf smart-deployment start --use-plan deployment-plan.json
```

### Scenario 3: Multi-Org Deploy

```bash
# Same plan, multiple orgs
for org in dev qa staging prod; do
  sf smart-deployment start \
    --target-org $org \
    --use-plan deployment-plan.json
done
```

---

## 📈 Best Practices

1. ✅ **Always commit plans to git**
   - Version controlled
   - Reviewable in PRs
   - Easy rollback

2. ✅ **Use AI in development, not production**
   - Generate plan with AI locally
   - Review and approve
   - Deploy deterministically

3. ✅ **Set strict mode in production**
   - Prevents accidental AI usage
   - Requires approved plan
   - Predictable behavior

4. ✅ **Validate before deploy**
   - Use `--validate-only` first
   - Check plan age
   - Review diff if any

5. ✅ **Monitor plan drift**
   - Alert if diff > 10%
   - Regenerate plans regularly
   - Keep plans up to date

---

## 🚨 Troubleshooting

### Error: "Deployment plan not found"

```bash
❌ Error: Deployment plan not found: .smart-deployment/deployment-plan.json
💡 Run 'sf smart-deployment analyze --save-plan' first
```

**Solution:** Generate plan before deploying

### Error: "Plan diff too high"

```bash
❌ Error: Component diff too high: 25% (max: 20%)
```

**Solution:** Regenerate plan or increase `--max-diff`

### Warning: "Plan is outdated"

```bash
⚠️  Warning: Plan is 15 days old. Consider regenerating.
```

**Solution:** Run `analyze --save-plan` to update

---

## 📚 Related Documentation

- [AI Priority Weighting](./AGENTFORCE_INTEGRATION.md)
- [Wave Generation](./ARCHITECTURE.md#wave-generation)
- [Error Handling](./ERROR_HANDLING.md)

