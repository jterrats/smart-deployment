# 🤖 AI Auto-Apply Mode

## Overview

The `--ai-auto` flag controls whether AI recommendations are automatically applied during deployment.

---

## 🎯 Behavior Modes

### **Mode 1: Manual Review (default)**

```bash
sf smart-deployment start --use-ai --target-org prod
```

**Behavior:**

- ✅ AI analyzes and generates recommendations
- ⚠️ Recommendations are **NOT** applied automatically
- 💡 Use for: Development, first-time analysis
- 📊 Review recommendations in logs

### **Mode 2: Auto-Apply**

```bash
sf smart-deployment start --use-ai --ai-auto --target-org prod
```

**Behavior:**

- ✅ AI analyzes and generates recommendations
- ✅ Recommendations with **confidence > 80%** are applied automatically
- ⏭️ Low confidence recommendations are skipped
- 💡 Use for: CI/CD with confidence in AI

### **Mode 3: Custom Threshold**

```bash
sf smart-deployment start \
  --use-ai \
  --ai-auto \
  --ai-confidence-threshold 0.9 \
  --target-org prod
```

**Behavior:**

- ✅ Only applies recommendations with confidence > 90%
- 🔐 More conservative for production
- 💡 Use for: High-stakes production deployments

---

## 📊 Confidence Threshold

| Threshold      | Behavior           | Use Case            |
| -------------- | ------------------ | ------------------- |
| **0.7 (70%)**  | Aggressive         | Development/testing |
| **0.8 (80%)**  | Balanced (default) | Staging, QA         |
| **0.9 (90%)**  | Conservative       | Production          |
| **0.95 (95%)** | Very conservative  | Critical systems    |

---

## 🎭 Real-World Examples

### Example 1: Development (Manual Review)

```bash
# Developer wants to see AI suggestions first
$ sf smart-deployment start --use-ai --target-org dev

🤖 AI-enhanced prioritization enabled (mode: manual-review, threshold: 80%)
💡 Tip: Use --ai-auto to automatically apply high-confidence recommendations

🤖 AI Priority Analysis Report
═══════════════════════════════════════
Mode: Manual Review
Total Components: 150
AI Adjustments: 0  # ← Not applied automatically

Priority Recommendations:
✅ Would Apply (confidence > 80%):
  95 | PaymentHandler                | CRITICAL (92%)
      Critical payment processing
  75 | CacheManager                  | HIGH (85%)
      Performance optimization

⏭️  Skipped (confidence ≤ 80%):
  45 | TestUtil                      | MEDIUM (78%)
      Utility class

💡 Use --ai-auto to automatically apply high-confidence recommendations
```

### Example 2: CI/CD (Auto-Apply)

```bash
# Production CI/CD with auto-apply
$ sf smart-deployment start --use-ai --ai-auto --target-org prod

🤖 AI-enhanced prioritization enabled (mode: auto, threshold: 80%)

🤖 AI Priority Analysis Report
═══════════════════════════════════════
Mode: Auto-Apply
Confidence Threshold: 80%
Total Components: 150
AI Adjustments: 5  # ← Applied automatically!

✅ Auto-Applied (confidence > 80%):
  95 | PaymentHandler                | CRITICAL (92%)
      Critical payment processing
  75 | CacheManager                  | HIGH (85%)
      Performance optimization
  20 | LogService                    | LOW (88%)
      Non-critical utility

⏭️  Skipped (confidence ≤ 80%):
  45 | TestUtil                      | MEDIUM (78%)
      Low confidence recommendation

💡 All high-confidence recommendations were applied automatically

🌊 Generated 8 waves (AI-optimized)
```

### Example 3: Production (Conservative)

```bash
# Production with higher threshold
$ sf smart-deployment start \
  --use-ai \
  --ai-auto \
  --ai-confidence-threshold 0.95 \
  --target-org prod

🤖 AI-enhanced prioritization enabled (mode: auto, threshold: 95%)

✅ Auto-Applied (confidence > 95%):
  95 | PaymentHandler                | CRITICAL (97%)
      Critical payment processing

⏭️  Skipped (confidence ≤ 95%):
  75 | CacheManager                  | HIGH (85%)  # ← Skipped!
  20 | LogService                    | LOW (88%)   # ← Skipped!

💡 Only 1 recommendation met the 95% threshold
```

---

## 🔐 CI/CD Best Practices

### **Strategy 1: Pre-Approved Plan (Recommended)**

```bash
# Development: Generate plan with AI
sf smart-deployment analyze --save-plan --use-ai --ai-auto

# CI/CD: Use approved plan (deterministic)
sf smart-deployment start --use-plan deployment-plan.json --strict
```

✅ **Best for:** Production deployments  
✅ **Pros:** Deterministic, auditable, fast  
✅ **Cons:** Requires plan generation step

### **Strategy 2: Auto-Apply in CI/CD**

```bash
# CI/CD: Use AI with auto-apply
sf smart-deployment start --use-ai --ai-auto --ai-confidence-threshold 0.9
```

⚠️ **Best for:** Staging, QA environments  
⚠️ **Pros:** No plan generation needed  
⚠️ **Cons:** Non-deterministic, slower

### **Strategy 3: Hybrid (AI + Verification)**

```bash
# CI/CD: AI with plan verification
sf smart-deployment start \
  --use-ai \
  --ai-auto \
  --verify-against-plan deployment-plan.json \
  --max-diff 10%
```

✅ **Best for:** Continuous deployment pipelines  
✅ **Pros:** Catches drift while using AI  
✅ **Cons:** More complex setup

---

## ⚙️ Configuration

### Via Config File (`.smart-deployment.json`)

```json
{
  "ai": {
    "enabled": true,
    "autoApply": false,
    "confidenceThreshold": 0.8,
    "model": "claude-sonnet",
    "timeout": 30000
  }
}
```

### Via Environment Variables

```bash
export SF_AI_AUTO_APPLY=true
export SF_AI_CONFIDENCE_THRESHOLD=0.9
```

### Via CLI Flags (Highest Priority)

```bash
--ai-auto --ai-confidence-threshold 0.9
```

**Priority Order:** CLI Flags > Environment Variables > Config File > Defaults

---

## 📊 Logging & Observability

### Debug Logging

```bash
export LOG_LEVEL=debug
sf smart-deployment start --use-ai --ai-auto
```

**Output:**

```
[DEBUG] Applied AI priority (auto): ApexClass:PaymentHandler
        priority: 95, confidence: 0.92, reason: Critical payment processing
[DEBUG] Skipped AI priority (low confidence): ApexClass:TestUtil
        confidence: 0.78, threshold: 0.8
[INFO]  AI priorities merged: applied=5, skipped=2, threshold=0.8
```

### Audit Trail

```bash
# Save AI decisions to file
sf smart-deployment start --use-ai --ai-auto > deployment.log

# Extract AI decisions
grep "Applied AI priority" deployment.log
```

---

## 🚨 Safety Mechanisms

### 1. Confidence Threshold

```bash
# Only high-confidence recommendations are applied
if (recommendation.confidence > threshold) {
  applyPriority();
} else {
  skip();
}
```

### 2. User Override Protection

```bash
# User priorities always win
if (userPriorities.has(component)) {
  useUserPriority();  // ← AI skipped
} else if (aiRecommendation.confidence > threshold) {
  useAIPriority();
}
```

### 3. Unknown Types Auto-Enable

```bash
# For unknown types, AI is auto-enabled regardless of --ai-auto
if (isUnknownType && agentforceService) {
  analyzeWithAI();  // ← Always happens for unknown types
}
```

### 4. Fallback to Static

```bash
# If AI fails, fall back to static priorities
try {
  aiPriorities = await analyzeWithAI();
} catch (error) {
  logger.warn('AI failed, using static priorities');
  useStaticPriorities();
}
```

---

## 📈 Metrics & Monitoring

Track AI auto-apply effectiveness:

```typescript
{
  "ai_auto_apply_metrics": {
    "enabled": true,
    "threshold": 0.8,
    "total_recommendations": 10,
    "applied": 7,
    "skipped": 3,
    "skip_reasons": {
      "low_confidence": 2,
      "user_override": 1
    },
    "avg_confidence": 0.86,
    "execution_time_ms": 8500
  }
}
```

---

## 🎯 Decision Matrix

| Scenario                     | Flag Combination                                    | Behavior                       |
| ---------------------------- | --------------------------------------------------- | ------------------------------ |
| **Development**              | `--use-ai`                                          | Manual review                  |
| **QA/Staging**               | `--use-ai --ai-auto`                                | Auto-apply (80%)               |
| **Production**               | `--use-plan --strict`                               | No AI (deterministic)          |
| **Production (alternative)** | `--use-ai --ai-auto --ai-confidence-threshold 0.95` | Auto-apply (95%, conservative) |
| **Unknown types**            | `--use-ai` (auto-enabled)                           | Always analyzed                |

---

## 🚀 Quick Reference

```bash
# No AI
sf smart-deployment start

# AI manual review
sf smart-deployment start --use-ai

# AI auto-apply (default 80%)
sf smart-deployment start --use-ai --ai-auto

# AI auto-apply (custom threshold)
sf smart-deployment start --use-ai --ai-auto --ai-confidence-threshold 0.9

# AI + Plan verification
sf smart-deployment start --use-ai --ai-auto --verify-against-plan plan.json

# Production (recommended)
sf smart-deployment start --use-plan plan.json --strict
```

---

## 📚 Related Documentation

- [AI Priority Weighting](./AGENTFORCE_INTEGRATION.md)
- [CI/CD Deployment](./CI_CD_DEPLOYMENT.md)
- [Configuration](./CONFIGURATION.md)
