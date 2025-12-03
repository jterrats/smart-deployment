# CLI Architecture: Validate & Deploy

This document outlines the command-line interface (CLI) architecture for the `smart-deployment` plugin, focusing on the two primary workflows: **validation** (local, predictive) and **deployment** (remote, execution).

## 🎯 Design Philosophy

1. **Validate Locally, Deploy Remotely**: Catch errors before they hit Salesforce APIs
2. **AI-Powered Prediction**: Use Agentforce to predict deployment failures before they happen
3. **Fail Fast**: Block deployments that are likely to fail based on static analysis and AI inference
4. **Transparent**: Show users exactly what will be deployed and why

---

## 📋 Command Structure

### Primary Commands

```bash
sf smart deploy validate [path]  # Local validation + AI prediction (NO Salesforce API calls)
sf smart deploy start [path]     # Full deployment (validate → analyze → deploy)
```

---

## 🔍 Command 1: `sf smart deploy validate`

**Purpose**: Local, predictive validation that **never touches Salesforce**. Catches errors before deployment.

### What it Does

```bash
sf smart deploy validate [path] [flags]
```

#### Phase 1: XML Schema Validation (Deterministic)

- ✅ Parse all XML files
- ✅ Verify XML declaration (`<?xml version="1.0" encoding="UTF-8"?>`)
- ✅ Check required namespaces:
  - `xmlns="http://soap.sforce.com/2006/04/metadata"`
  - `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`
  - `xmlns:xsd="http://www.w3.org/2001/XMLSchema"` (for CustomMetadata)
- ✅ Validate field types (`xsi:type="xsd:boolean"`, `xsd:string`, etc.)
- ✅ Check label lengths (<40 characters for CustomMetadata)
- ✅ Verify boolean values are `true`/`false`

**Auto-Fix**: With `--fix` flag, automatically corrects common issues:

- Missing namespaces
- Incorrect XML declarations
- Malformed boolean values

#### Phase 2: Dependency Analysis (Local Graph)

- ✅ Scan all metadata files
- ✅ Extract dependencies (Apex → Apex, Flow → ApexClass, Profile → CustomObject, etc.)
- ✅ Build dependency graph
- ✅ Detect circular dependencies
- ✅ Generate tentative deployment waves

#### Phase 3: AI Predictive Analysis (Agentforce)

- 🤖 Analyze potential deployment errors using Agentforce:
  - **Missing References**: Field references non-existent object, Lookup to missing object
  - **Permission Issues**: Profile without CustomObject permission, PermissionSet missing field access
  - **Flow Errors**: Flow references non-existent ApexClass or Screen
  - **Trigger Issues**: Trigger handler class not found, Trigger references deleted field
  - **API Version Mismatches**: Components using incompatible API versions
  - **Custom Metadata Issues**: Potential `UNABLE_TO_LOCK_ROW` if >200 records in wave
  - **Test Coverage**: Apex classes without test coverage (warns, doesn't block)

**Batching Strategy for Agentforce**:

- Batch 1: Critical dependencies (Triggers → Handlers)
- Batch 2: Service layer (Services → Tests)
- Batch 3: UI layer (Controllers → Pages, LWC → Apex)
- Batch 4: Configuration (Profiles, Permissions, Flows)
- Merge results into single report

#### Output & Exit Codes

```bash
📋 Validation Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Phase 1: XML Schema Validation
   - 1,234 files parsed
   - 12 issues auto-fixed (--fix applied)
   - 0 schema errors

✅ Phase 2: Dependency Analysis
   - 1,234 components analyzed
   - 3,456 dependencies identified
   - 0 circular dependencies detected
   - 8 deployment waves generated

⚠️  Phase 3: AI Predictive Analysis
   - 🚨 3 CRITICAL ERRORS (will block deployment)
     ❌ MyFlow.flow: References non-existent ApexClass 'DeletedController'
     ❌ Admin.profile: Missing permission for CustomObject 'NewObject__c'
     ❌ AccountTrigger.trigger: Handler class 'AccountTriggerHandler' not found

   - ⚠️  7 WARNINGS (may cause issues)
     ⚠️  MyApexClass.cls: No test coverage found
     ⚠️  CustomMetadata__mdt: 250 records in wave (may hit UNABLE_TO_LOCK_ROW)
     ⚠️  OldController.cls: Uses deprecated API version 30.0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ VALIDATION FAILED: 3 critical errors, 7 warnings

🚫 Deployment BLOCKED. Fix critical errors before deploying.

Exit Code: 2
```

**Exit Codes**:

- `0`: ✅ All validations passed, safe to deploy
- `1`: ⚠️ Warnings present (can deploy with `--force`, but risky)
- `2`: 🚨 Critical errors (deployment will fail, DO NOT deploy)

### Flags

```bash
--fix                    # Auto-fix common XML issues (namespaces, declarations)
--no-ai                  # Skip AI predictive analysis (faster, less thorough)
--output <file>          # Save report to JSON/XML file
--batch-size <number>    # AI batch size (default: auto-calculated based on token limits)
--include-warnings       # Treat warnings as errors (strict mode)
```

### Use Cases

```bash
# Pre-commit hook (fast, auto-fix)
sf smart deploy validate force-app --fix

# CI/CD pipeline (strict, fail on warnings)
sf smart deploy validate force-app --include-warnings

# Quick check without AI (fast)
sf smart deploy validate force-app --no-ai

# Save report for review
sf smart deploy validate force-app --output validation-report.json
```

---

## 🚀 Command 2: `sf smart deploy start`

**Purpose**: Full deployment workflow (validate → analyze → plan → deploy).

### What it Does

```bash
sf smart deploy start [path] --target-org <org> [flags]
```

#### Step 1: Validation (if not skipped)

- Runs `validate` command automatically
- Blocks deployment if critical errors found
- Can be skipped with `--skip-validation` if already validated

#### Step 2: Wave Generation

- Uses dependency graph from validation
- Applies deployment order (CustomObject → ApexClass → Flow → Profile)
- Splits large waves to respect limits:
  - MAX_FILES_PER_DEPLOYMENT: 10,000 files
  - MAX_DEPLOYMENT_SIZE_COMPRESSED_MB: 39 MB
  - MAX_DEPLOYMENT_SIZE_UNCOMPRESSED_MB: 600 MB
  - MAX_CMT_RECORDS_PER_WAVE: 200 records

#### Step 3: Deployment Execution

- Deploys waves sequentially
- Shows progress for each wave
- Handles errors per wave
- Option to continue or stop on first error

#### Output

```bash
📊 Deployment Plan
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Target Org: myorg@company.com
Total Components: 1,234
Total Waves: 8
Estimated Time: 12-15 minutes

Wave 1: Foundation (125 components)
  - 45 CustomObject
  - 80 CustomField

Wave 2: Code Layer (300 components)
  - 150 ApexClass
  - 75 ApexTrigger
  - 75 LightningComponentBundle

Wave 3: Business Logic (200 components)
  - 100 Flow
  - 50 ValidationRule
  - 50 WorkflowRule

... [5 more waves]

❓ Continue with deployment? (y/n): y

🚀 Deploying Wave 1... ✅ SUCCESS (2m 15s)
🚀 Deploying Wave 2... ✅ SUCCESS (3m 45s)
🚀 Deploying Wave 3... ✅ SUCCESS (2m 30s)
...

✅ DEPLOYMENT COMPLETE: 8/8 waves succeeded
Total Time: 14m 23s
```

### Flags

```bash
--target-org <org>           # REQUIRED: Target Salesforce org
--skip-validation            # Skip validation phase (assumes already validated)
--auto-validate              # Run validation before deployment (default: true)
--force                      # Deploy even with warnings from validation
--interactive                # Prompt for confirmation before each wave
--show-plan                  # Show deployment plan + confirm before starting
--dry-run                    # Simulate deployment without executing (shows plan only)
--stop-on-error              # Stop deployment on first wave failure (default: true)
--continue-on-error          # Continue deploying subsequent waves even if one fails
--max-waves <number>         # Limit number of waves (for testing/debugging)
--wait <minutes>             # Wait time between waves (default: 0, no wait)
```

### Use Cases

```bash
# Full deployment with validation
sf smart deploy start force-app --target-org prod

# Skip validation (already ran locally)
sf smart deploy start force-app --target-org uat --skip-validation

# Interactive deployment (confirm each wave)
sf smart deploy start force-app --target-org prod --interactive

# Preview only (no execution)
sf smart deploy start force-app --target-org prod --dry-run

# Force deployment despite warnings
sf smart deploy start force-app --target-org dev --force

# CI/CD: validate in one step, deploy in another
sf smart deploy validate force-app --include-warnings  # Step 1 (in build)
sf smart deploy start force-app --target-org uat --skip-validation  # Step 2 (in deploy)
```

---

## 🧠 AI Integration: Agentforce Token Management

### Challenge

- **10,000 files** × **average 500 tokens/file** = **5M tokens**
- Agentforce limit: **~200K tokens per request**
- Solution: **Intelligent batching**

### Batching Strategy

```typescript
// Batch by dependency criticality, not file count
const batches = [
  {
    name: 'Critical Dependencies',
    types: ['ApexTrigger', 'ApexClass'], // Triggers + Handlers
    priority: 1,
    maxTokens: 200_000,
  },
  {
    name: 'Service Layer',
    types: ['ApexClass'], // Services + Tests (excluding triggers)
    priority: 2,
    maxTokens: 200_000,
  },
  {
    name: 'UI Layer',
    types: ['LightningComponentBundle', 'AuraDefinitionBundle', 'VisualforcePage'],
    priority: 3,
    maxTokens: 200_000,
  },
  {
    name: 'Configuration',
    types: ['Flow', 'Profile', 'PermissionSet'],
    priority: 4,
    maxTokens: 200_000,
  },
];
```

**Token Estimation**:

```typescript
function estimateTokens(component: MetadataComponent): number {
  const fileSize = fs.statSync(component.filePath).size;
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(fileSize / 4);
}

function createBatch(components: MetadataComponent[], maxTokens: number): MetadataComponent[][] {
  const batches: MetadataComponent[][] = [];
  let currentBatch: MetadataComponent[] = [];
  let currentTokens = 0;

  for (const component of components) {
    const tokens = estimateTokens(component);

    if (currentTokens + tokens > maxTokens && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [component];
      currentTokens = tokens;
    } else {
      currentBatch.push(component);
      currentTokens += tokens;
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}
```

---

## 📦 Implementation Roadmap

### Phase 1: XML Validator (No AI)

- [ ] Parse XML files
- [ ] Validate schemas
- [ ] Auto-fix common issues
- [ ] Generate report

### Phase 2: Dependency Analyzer (No AI)

- [ ] Scan metadata files
- [ ] Extract dependencies
- [ ] Build graph
- [ ] Detect circular dependencies

### Phase 3: AI Predictive Validator (Agentforce)

- [ ] Implement batching strategy
- [ ] Integrate Agentforce API
- [ ] Analyze missing references
- [ ] Predict permission issues
- [ ] Generate warnings

### Phase 4: CLI Commands

- [ ] `sf smart deploy validate`
- [ ] `sf smart deploy start`
- [ ] Interactive prompts
- [ ] Progress indicators

### Phase 5: Wave Generation & Deployment

- [ ] Generate waves from graph
- [ ] Respect Salesforce limits
- [ ] Execute deployments
- [ ] Handle errors

---

## 🎯 Success Metrics

- **Validation Speed**: <30 seconds for 1,000 files (without AI), <2 minutes (with AI)
- **Prediction Accuracy**: >90% of predicted errors match actual deployment failures
- **False Positives**: <5% (warnings that don't actually cause failures)
- **Time Savings**: Reduce deployment retry cycles by 70% (catch errors before API calls)

---

## 🔗 Related Documentation

- [Metadata Extensibility](./METADATA_EXTENSIBILITY.md)
- [Agentforce Integration](../guides/AGENTFORCE_INTEGRATION.md)
- [Error-Driven Development](../methodology/ERROR_DRIVEN_DEVELOPMENT.md)
- [Testing Strategy](../methodology/TESTING_STRATEGY.md)
