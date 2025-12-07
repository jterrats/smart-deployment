# Memory vs API Costs Trade-off

## 🎯 Overview

This plugin must balance **memory efficiency** with **API cost optimization**. Poor cache configuration can lead to:

- 💸 **Excessive API costs**: Re-calling expensive Salesforce/Agentforce APIs
- 💥 **Memory exhaustion**: Unbounded cache growth causing crashes
- 🐌 **Performance degradation**: Repeated expensive computations

---

## 📊 Cache Strategy by Use Case

### 1. Local Computations (Low Cost)

**Examples:** Graph algorithms, dependency sorting, file parsing

```typescript
import { memoize, RECOMMENDED_CACHE_SIZES } from './utils/functional.js';

// Use default (1000) - memory efficient for local ops
const cachedTopologicalSort = memoize(topologicalSort);
// OR explicitly:
const cachedSort = memoize(topologicalSort, {
  maxSize: RECOMMENDED_CACHE_SIZES.LOCAL_COMPUTATION,
});
```

**Trade-off:**

- ✅ Memory: ~1-5 MB for 1000 entries
- ✅ Re-computation cost: <10ms per operation
- ✅ Verdict: **1000 entries is optimal**

---

### 2. Salesforce API Calls (Medium Cost)

**Examples:** Metadata queries, org limits, describe calls

```typescript
import { memoize, RECOMMENDED_CACHE_SIZES } from './utils/functional.js';

// Cache 5000 metadata query results
const cachedDescribe = memoize(connection.metadata.describe, {
  maxSize: RECOMMENDED_CACHE_SIZES.SALESFORCE_API,
});
```

**Cost Analysis:**

| Cache Size | Memory Usage | API Calls (10K components) | Cost Impact |
| ---------- | ------------ | -------------------------- | ----------- |
| 1,000      | ~5 MB        | 9,000 additional           | 💸💸💸 High |
| 5,000      | ~25 MB       | 5,000 additional           | 💸💸 Medium |
| 10,000     | ~50 MB       | 0 additional               | ✅ None     |

**Verdict:** Use `RECOMMENDED_CACHE_SIZES.SALESFORCE_API` (5000)

**Why not 10,000?**

- Most orgs have <5K metadata components
- 25MB is acceptable memory footprint
- Balance between memory and API savings

---

### 3. Agentforce AI Analysis (High Cost)

**Examples:** Dependency inference, risk assessment, optimization suggestions

```typescript
import { memoize, RECOMMENDED_CACHE_SIZES } from './utils/functional.js';

// Agentforce calls are EXPENSIVE - cache aggressively
const cachedAIAnalysis = memoize(agentforce.analyzeDependencies, {
  maxSize: RECOMMENDED_CACHE_SIZES.AGENTFORCE_AI,
});
```

**Cost Comparison:**

| Scenario   | Components | Cache Size | Cache Misses | AI API Cost\* |
| ---------- | ---------- | ---------- | ------------ | ------------- |
| Small Org  | 500        | 1,000      | 0            | $0.50         |
| Medium Org | 3,000      | 1,000      | 2,000        | $30.00        |
| Medium Org | 3,000      | 10,000     | 0            | $3.00         |
| Large Org  | 8,000      | 1,000      | 7,000        | $105.00       |
| Large Org  | 8,000      | 10,000     | 0            | $8.00         |

\* Estimated at $0.015 per analysis (Claude Sonnet pricing)

**Verdict:** Use `RECOMMENDED_CACHE_SIZES.AGENTFORCE_AI` (10,000)

**ROI:**

- Additional memory: 50MB
- Cost savings per deployment: **$20-100**
- **Pays for itself after 1-2 deployments**

---

## 🚨 Warning: Cache Misses Are Expensive

### Example: Large Enterprise Deployment

**Scenario:**

- 15,000 Salesforce components
- Cache size: 1,000 entries
- Agentforce enabled

**Impact:**

```
Cache misses: 14,000 components
AI API calls: 14,000 × $0.015 = $210 per deployment
With proper cache: $15 per deployment
Waste: $195 per deployment
```

**Monthly cost** (4 deployments/month): **$780 wasted**

---

## ⚙️ Configuration Recommendations

### For Small Orgs (<1K components)

```typescript
const config = {
  localComputation: RECOMMENDED_CACHE_SIZES.LOCAL_COMPUTATION, // 1000
  salesforceAPI: RECOMMENDED_CACHE_SIZES.LOCAL_COMPUTATION, // 1000
  agentforceAI: RECOMMENDED_CACHE_SIZES.SALESFORCE_API, // 5000
};
```

**Memory footprint:** ~30 MB
**API cost:** Minimal

### For Medium Orgs (1K-5K components)

```typescript
const config = {
  localComputation: RECOMMENDED_CACHE_SIZES.LOCAL_COMPUTATION, // 1000
  salesforceAPI: RECOMMENDED_CACHE_SIZES.SALESFORCE_API, // 5000
  agentforceAI: RECOMMENDED_CACHE_SIZES.AGENTFORCE_AI, // 10000
};
```

**Memory footprint:** ~80 MB
**API cost:** Optimized
**Monthly savings:** $200-500

### For Large Orgs (5K-15K components)

```typescript
const config = {
  localComputation: RECOMMENDED_CACHE_SIZES.LOCAL_COMPUTATION, // 1000
  salesforceAPI: RECOMMENDED_CACHE_SIZES.AGENTFORCE_AI, // 10000
  agentforceAI: RECOMMENDED_CACHE_SIZES.UNLIMITED, // Infinity
};
```

**Memory footprint:** ~150 MB
**API cost:** Minimal
**Monthly savings:** $500-2000

⚠️ **Note:** For `UNLIMITED` cache, implement disk-based persistence for long-running processes.

---

## 🔧 Advanced: Custom Cache Strategies

### Size-based Eviction (for large objects)

```typescript
const sizeBasedCache = memoize(expensiveFunction, {
  maxSize: 100, // entries
  keyGenerator: (params) => {
    // Custom key that considers object size
    const size = JSON.stringify(params).length;
    return `${params.id}-${size}`;
  },
});
```

### TTL-based Cache (time-to-live)

```typescript
// Not yet implemented - consider for future versions
const ttlCache = memoizeWithTTL(expensiveFunction, {
  maxSize: 5000,
  ttlMs: 3600000, // 1 hour
});
```

---

## 📈 Monitoring Cache Performance

### Recommended Metrics

Track these in production:

```typescript
interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  memoryUsedMB: number;
  apiCallsSaved: number;
  estimatedCostSavings: number;
}
```

### Alert Thresholds

| Metric    | Warning        | Critical | Action              |
| --------- | -------------- | -------- | ------------------- |
| Hit Rate  | <70%           | <50%     | Increase cache size |
| Memory    | >80% available | >95%     | Decrease cache size |
| API Calls | >100/min       | >500/min | Check cache config  |

---

## 🎓 Decision Matrix

Use this to choose cache size:

```
┌─────────────────────────────────────────────────────────┐
│ Operation Cost?                                         │
├─────────────────────────────────────────────────────────┤
│  Low (<1ms)      → LOCAL_COMPUTATION (1000)             │
│  Medium (API)    → SALESFORCE_API (5000)                │
│  High (AI/LLM)   → AGENTFORCE_AI (10000) or UNLIMITED   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Data Cardinality?                                       │
├─────────────────────────────────────────────────────────┤
│  <1000 unique    → LOCAL_COMPUTATION                    │
│  1K-5K unique    → SALESFORCE_API                       │
│  >5K unique      → AGENTFORCE_AI or UNLIMITED           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Memory Available?                                       │
├─────────────────────────────────────────────────────────┤
│  <256 MB         → LOCAL_COMPUTATION only               │
│  256-512 MB      → LOCAL + SALESFORCE_API               │
│  >512 MB         → All caches + AGENTFORCE_AI           │
│  >1 GB           → Consider UNLIMITED                   │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Best Practices

1. **Start conservative, scale up**: Begin with recommended sizes, monitor, adjust
2. **Profile in production**: Real usage patterns differ from expectations
3. **Document your choices**: Comment why you chose specific cache sizes
4. **Set up alerts**: Monitor cache performance and costs
5. **Review quarterly**: As org grows, cache needs change

---

## 📚 References

- [Salesforce API Limits](https://developer.salesforce.com/docs/atlas.en-us.salesforce_app_limits_cheatsheet.meta/salesforce_app_limits_cheatsheet)
- [Agentforce Pricing](https://www.salesforce.com/products/einstein/pricing/)
- [Memory Management Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
