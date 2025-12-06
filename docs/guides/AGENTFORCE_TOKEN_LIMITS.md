# Agentforce Token Limits & Batching Strategy

## 🚨 The Token Limit Problem

**Reality Check:** Most LLMs have context windows of 32K-200K tokens.

**Your org:** 5,000 Salesforce components = **~1M tokens** of metadata JSON

❌ **This won't fit in a single API call**

---

## 📊 Token Economics

### Token Estimates per Component Type

| Component Type    | Avg Tokens | Example                        |
| ----------------- | ---------- | ------------------------------ |
| CustomLabel       | 50         | Simple key-value pair          |
| CustomField       | 100        | Field definition with metadata |
| ApexClass (small) | 200        | 50 lines of code               |
| ApexClass (large) | 2,000      | 500 lines of code              |
| Flow              | 500        | Visual workflow JSON           |
| CustomObject      | 1,500      | Object with 50 fields          |
| Profile           | 3,000      | Permissions for 100+ objects   |
| Permission Set    | 2,500      | Complex permission matrix      |

### Real Org Examples

**Small Org (500 components):**

```
150 CustomLabels     × 50   =    7,500 tokens
200 CustomFields     × 100  =   20,000 tokens
100 ApexClasses      × 200  =   20,000 tokens
50  Other            × 200  =   10,000 tokens
                          ────────────────────
TOTAL:                         57,500 tokens ✅ Fits in single request
```

**Medium Org (2,000 components):**

```
400 CustomLabels     × 50   =   20,000 tokens
800 CustomFields     × 100  =   80,000 tokens
500 ApexClasses      × 200  =  100,000 tokens
300 Other            × 300  =   90,000 tokens
                          ────────────────────
TOTAL:                        290,000 tokens ❌ EXCEEDS 200K limit
```

**Large Org (8,000 components):**

```
Total estimated:            1,200,000 tokens ❌❌❌ Way over limit
```

---

## 🎯 Batching Strategies

### Strategy 1: Single Batch (Small Orgs)

**When:** <500 components, <60K tokens

```typescript
// Simple - send everything at once
const result = await agentforce.analyzeDependencies({
  components: allComponents,
  orgType: 'production',
});
```

**Pros:**

- ✅ Simple implementation
- ✅ Fast (one API call)
- ✅ AI sees full context

**Cons:**

- ❌ Only works for small orgs

---

### Strategy 2: Metadata-Type Batching (Medium Orgs)

**When:** 500-2,000 components

Group by metadata type, process in batches:

```typescript
// Group by metadata type
const batches = [
  { type: 'ApexClass', components: apexClasses },
  { type: 'Flow', components: flows },
  { type: 'CustomObject', components: objects },
  // ... more batches
];

// Process each batch
for (const batch of batches) {
  const result = await agentforce.analyzeDependencies({
    components: batch.components,
    context: {
      batchType: batch.type,
      totalBatches: batches.length,
    },
  });

  mergeDependencyResults(result);
}
```

**Pros:**

- ✅ Respects token limits
- ✅ Logical grouping
- ✅ Can parallelize batches

**Cons:**

- ❌ AI doesn't see cross-type dependencies
- ❌ Multiple API calls (higher cost)

---

### Strategy 3: Selective AI Analysis (Large Orgs)

**When:** 2,000-5,000 components

Only send complex/ambiguous components to AI:

```typescript
// Step 1: Static analysis (fast, free)
const staticDeps = analyzeStaticDependencies(allComponents);

// Step 2: Identify ambiguous cases
const ambiguousComponents = identifyAmbiguousDependencies(allComponents, staticDeps);

// Step 3: AI analysis only for ambiguous (< 500 components)
if (ambiguousComponents.length > 0) {
  const aiResult = await agentforce.analyzeDependencies({
    components: ambiguousComponents,
    staticDependencies: staticDeps,
  });

  mergeResults(staticDeps, aiResult);
}
```

**Pros:**

- ✅ Minimal token usage
- ✅ Low cost
- ✅ Fast (mostly static analysis)

**Cons:**

- ❌ May miss subtle dependencies
- ❌ Requires good heuristics

**Recommended for:** Production orgs with budget constraints

---

### Strategy 4: Hybrid Approach (Very Large Orgs)

**When:** >5,000 components

Combine all strategies:

```typescript
// 1. Static analysis for obvious dependencies
const staticDeps = analyzeStaticDependencies(allComponents);

// 2. Identify critical path components
const criticalPath = identifyCriticalPath(allComponents);

// 3. AI analysis for critical path only
const criticalBatches = chunkByTokenLimit(criticalPath, {
  maxTokens: 180_000,
  estimatedTokensPerComponent: 300,
});

for (const batch of criticalBatches) {
  const result = await agentforce.analyzeDependencies({
    components: batch,
    staticDependencies: staticDeps,
    focusArea: 'critical-path',
  });

  mergeResults(staticDeps, result);
}

// 4. Use heuristics for non-critical components
applyHeuristicDependencies(nonCriticalComponents);
```

**Pros:**

- ✅ Scalable to any org size
- ✅ Cost-effective
- ✅ Best accuracy/cost ratio

**Cons:**

- ❌ Most complex implementation
- ❌ Requires advanced org analysis

---

## 🛡️ Token Limit Protection

### Built-in Validation

```typescript
import { willExceedTokenLimit, calculateOptimalBatchSize } from '../constants/agentforce-limits.js';

// Check before calling API
const check = willExceedTokenLimit(components, 'claude-sonnet');

if (check.exceeds) {
  console.warn(`
    ⚠️  Token limit exceeded!
    Estimated: ${check.estimatedTokens.toLocaleString()} tokens
    Max allowed: ${check.maxAllowed.toLocaleString()} tokens

    Splitting into batches...
  `);

  // Calculate optimal batching
  const strategy = calculateOptimalBatchSize(components.length, 'claude-sonnet', 'STANDARD');

  console.log(`
    Batch size: ${strategy.batchSize} components
    Total batches: ${strategy.totalBatches}
    Estimated cost: $${strategy.totalEstimatedCost.toFixed(2)}
  `);
}
```

---

## 💰 Cost Optimization

### Example: 3,000 Component Org

**Naive Approach (send everything, hope for best):**

```
Attempt 1: 300K tokens → ❌ API Error (token limit exceeded)
Attempt 2: Split in 2 → Still 150K each → ❌ API Error
Attempt 3: Split in 4 → 75K each → ✅ Works
Total API calls: 6 (3 failures + 3 retries)
Wasted cost: ~$15 in failed attempts
```

**Smart Approach (validate first):**

```typescript
const strategy = calculateOptimalBatchSize(3000, 'claude-sonnet');
// → Recommends 250 components per batch (12 batches)

// Process 12 batches
Total API calls: 12
Failed attempts: 0
Cost: ~$18
Time saved: 15 minutes (no retries)
```

**Selective Approach (AI only for ambiguous):**

```typescript
// Static analysis handles 2,700 components (90%)
// AI analyzes 300 ambiguous components (10%)

// AI needed: 2 batches × 150 components
Total API calls: 2
Cost: ~$3
Accuracy: 95% (5% may miss subtle dependencies)
```

---

## ⚙️ Configuration

### Recommended Settings

**Small Org (<500 components):**

```json
{
  "agentforce": {
    "enabled": true,
    "model": "claude-sonnet",
    "batchStrategy": "single",
    "enforceTokenLimits": true,
    "enableCache": true
  }
}
```

**Medium Org (500-2K components):**

```json
{
  "agentforce": {
    "enabled": true,
    "model": "claude-sonnet",
    "batchStrategy": "multi",
    "maxComponentsPerBatch": 250,
    "enforceTokenLimits": true,
    "enableCache": true
  }
}
```

**Large Org (2K-5K components):**

```json
{
  "agentforce": {
    "enabled": true,
    "model": "claude-sonnet",
    "batchStrategy": "selective",
    "enforceTokenLimits": true,
    "enableCache": true,
    "selectiveAnalysisThreshold": 0.1
  }
}
```

**Very Large Org (>5K components):**

```json
{
  "agentforce": {
    "enabled": true,
    "model": "claude-sonnet",
    "batchStrategy": "hybrid",
    "enforceTokenLimits": true,
    "enableCache": true,
    "criticalPathOnly": true,
    "fallbackToHeuristics": true
  }
}
```

---

## 📈 Monitoring & Alerts

### Key Metrics

```typescript
interface TokenUsageMetrics {
  totalTokensUsed: number;
  tokenLimitViolations: number;
  batchesSplit: number;
  avgTokensPerBatch: number;
  costPerDeployment: number;
}
```

### Alert Thresholds

| Metric                 | Warning | Critical |
| ---------------------- | ------- | -------- |
| Cost per deployment    | >$10    | >$50     |
| Token limit violations | >1      | >5       |
| Tokens per batch       | >150K   | >180K    |
| Batches per deployment | >20     | >50      |

---

## 🎓 Decision Tree

```
How many components in your org?

├─ <500 components
│  └─ Use SINGLE_BATCH strategy
│     ✅ Simple, fast, accurate
│
├─ 500-2,000 components
│  └─ Use MULTI_BATCH strategy
│     ✅ Token-safe, parallel processing
│
├─ 2,000-5,000 components
│  └─ Use SELECTIVE strategy
│     ✅ Cost-effective, good accuracy
│
└─ >5,000 components
   └─ Use HYBRID strategy
      ✅ Scalable, optimized cost/accuracy
```

---

## 🚀 Implementation Checklist

- [ ] Add token estimation before API calls
- [ ] Implement automatic batching based on org size
- [ ] Add fallback to heuristics when token limit exceeded
- [ ] Cache AI responses aggressively (expensive)
- [ ] Monitor token usage and costs
- [ ] Set up alerts for token limit violations
- [ ] Document batch strategy in deployment logs
- [ ] Add retry logic with smaller batches on failure

---

## 📚 References

- [Claude API Limits](https://docs.anthropic.com/claude/reference/rate-limits)
- [OpenAI Token Limits](https://platform.openai.com/docs/models)
- [Salesforce Einstein GPT Limits](https://help.salesforce.com/s/articleView?id=sf.einstein_gpt_limits.htm)
