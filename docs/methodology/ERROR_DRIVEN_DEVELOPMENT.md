# ⚠️ Error-Driven Development (EDD)

## 🎯 Definition

**Error-Driven Development (EDD)** is a software development methodology that complements TDD and BDD, focusing on designing and testing **error scenarios, exceptions, and edge cases first** before implementing the happy path.

### EDD Principles

1. **Fail First, Succeed Later**: Design how your system fails before how it succeeds
2. **Graceful Degradation**: The system should degrade gracefully, not explode
3. **Error Recovery**: Every operation should have a recovery plan
4. **User-Friendly Errors**: Errors must be actionable and understandable
5. **Defensive Programming**: Validate everything, assume nothing

---

## 🔥 EDD vs TDD vs BDD

```
TDD (Test-Driven Development)
├─ Focus: Correct functionality
└─ Question: "Does it work as expected?"

BDD (Behavior-Driven Development)  
├─ Focus: User behavior
└─ Question: "Can the user do X?"

EDD (Error-Driven Development) ← NEW
├─ Focus: Error handling and edge cases
└─ Question: "What can go wrong and how do we handle it?"
```

---

## 📊 Negative Scenarios Matrix

### Error Categories

1. **Input Errors**: Invalid, malformed, out-of-range data
2. **State Errors**: Invalid system state
3. **External Failures**: APIs down, timeouts, rate limits
4. **Resource Errors**: Memory, disk, Salesforce limits
5. **Permission Errors**: Missing permissions, invalid credentials
6. **Business Logic Errors**: Business validation failures
7. **Edge Cases**: Extreme values, boundary cases

---

## 🧪 Negative Tests by Layer

### Layer 1: Utils - Error Tests

#### Functional Utils (EDD)

| Function | Error Scenario | Expected Behavior |
|----------|----------------|-------------------|
| `pipe()` | Null function in pipeline | Throw TypeError with clear message |
| `pipe()` | Function returns undefined | Propagate undefined (don't crash) |
| `pipe()` | Async function in sync pipe | Throw error explaining async/sync mismatch |
| `pipe()` | Error in intermediate function | Propagate error with full stack trace |
| `compose()` | Infinite composition (cycle) | Detect and throw StackOverflowError |
| `memoize()` | Impure function (random) | Warning about non-deterministic behavior |
| `memoize()` | Cache overflow (>10MB) | Evict oldest + warning |

**Test Count**: 15 negative tests

#### Graph Algorithms (EDD)

| Function | Error Scenario | Expected Behavior |
|----------|----------------|-------------------|
| `topologicalSort()` | Graph with cycle | Detect cycle + return cyclic nodes |
| `topologicalSort()` | Null/undefined graph | Throw error with helpful message |
| `topologicalSort()` | Empty graph | Return empty array (not error) |
| `topologicalSort()` | Node references non-existent | Warning + continue without edge |
| `detectCycles()` | Extremely large graph | Timeout after 30s + partial result |
| `calculateDepth()` | Depth > 1000 (possible cycle) | Error with cycle message |
| `findShortestPath()` | Start == End | Return empty path (valid) |
| `findShortestPath()` | No path exists | Return null (don't throw) |

**Test Count**: 12 negative tests

#### File System Utils (EDD)

| Function | Error Scenario | Expected Behavior |
|----------|----------------|-------------------|
| `readProjectFile()` | File doesn't exist | Error with full path and suggestion |
| `readProjectFile()` | Permission denied | Error with permission instructions |
| `readProjectFile()` | File > 100MB | Error with size limit |
| `readProjectFile()` | Binary file (not UTF-8) | Error with encoding info |
| `readProjectFile()` | Broken symlink | Error with symlink info |
| `scanDirectory()` | Directory doesn't exist | Error with path and create suggestion |
| `scanDirectory()` | Permission denied in subdirectory | Skip + warning + continue |
| `scanDirectory()` | Infinite symlink loop | Detect + error |
| `parseXml()` | Malformed XML | Error with exact line and column |
| `parseXml()` | Very large XML (>50MB) | Streaming parse or error |
| `parseXml()` | XML with external entities (XXE) | Block + security warning |

**Test Count**: 18 negative tests

**Total Utils Negative Tests**: 45 tests

---

### Layer 2: Parsers - Error Tests

#### Apex Parser (EDD)

| Error Scenario | Input | Expected Behavior |
|----------------|-------|-------------------|
| Invalid syntax | `public class {` | Parse error with exact line |
| Empty class | `public class Empty {}` | Parse OK but warning |
| Invalid encoding | ISO-8859-1 with special chars | Detect encoding + helpful error |
| Unclosed comment | `/* open comment` | Error with location |
| Unclosed string | `String s = "unclosed` | Error with line |
| Direct circular dependency | A extends A | Error + suggestion |
| Extends non-existent class | `extends GhostClass` | Warning (might be managed) |
| Corrupted file | Binary data in .cls | Clear error about corruption |
| Class name differs from file | File: A.cls, Class: B | Warning + use class name |
| Multiple classes in file | 2+ public classes | Error (invalid in Apex) |
| Test class without @isTest | Ends with _Test but no annotation | Warning |
| Trigger without object | `trigger X on () {}` | Parse error with suggestion |
| Inner class reference | Outer.Inner usage | Detect + add dependency |
| Vulnerable SOQL injection | String concat in SOQL | Security warning |
| File > 1MB | Class with 10000+ lines | Performance warning |

**Test Count**: 25 negative tests

#### Flow Parser (EDD)

| Error Scenario | Input | Expected Behavior |
|----------------|-------|-------------------|
| Corrupted XML | Invalid XML structure | Error with exact line |
| Unsupported API version | API version 70.0 | Warning + continue |
| Non-existent Apex reference | actionName: GhostClass.method | Warning + add dependency anyway |
| Loop without exit condition | Loop without break | Infinite loop warning |
| Decision without default | Decision without else | Warning |
| Uninitialized variable | Variable used without value | Warning |
| Screen without fields | Empty screen flow | Warning |
| Non-existent GenAI prompt | Reference to missing template | Warning + continue |
| Circular subflow | FlowA → FlowB → FlowA | Cycle error |
| Flow without start element | No start | Critical error |
| Very complex flow | >200 elements | Performance warning |
| Invalid schedule | Malformed cron expression | Warning |

**Test Count**: 20 negative tests

#### LWC Parser (EDD)

| Error Scenario | Input | Expected Behavior |
|----------------|-------|-------------------|
| Missing .js file | Only .html and .js-meta.xml | Error + instructions |
| Missing .html file | Only .js | Warning (might be TS only) |
| Missing .js-meta.xml | No metadata | Critical error |
| Invalid import path | `import from '@salesforce/apex/Ghos.method'` | Warning |
| Circular LWC imports | LWC1 → LWC2 → LWC1 | Cycle error |
| JS syntax error | Invalid JavaScript | Parse error |
| Uncompiled TypeScript | .ts file without .js | Error with instructions |
| Wire adapter without import | @wire used without import | Error |
| API property without decorator | public property without @api | Warning |
| Event handler typo | onclick instead of onclick | Warning |
| LDS error | recordId undefined | Warning |
| Very large CSS | >100KB CSS | Performance warning |

**Test Count**: 20 negative tests

**Total Parsers Negative Tests**: 65 tests

---

### Layer 3: Services - Error Tests

#### Metadata Scanner (EDD)

| Error Scenario | Condition | Expected Behavior |
|----------------|-----------|-------------------|
| Empty project | No metadata found | Helpful error + guide |
| Invalid sfdx-project.json | Malformed JSON | Error with exact line |
| Missing sfdx-project.json | Doesn't exist | Fallback to src/ + warning |
| Empty packageDirectories | Empty array | Error + suggestion |
| Path doesn't exist | Invalid packageDirectory path | Error with path |
| Permission denied | No read access | Error with permission instructions |
| Symlink loop | Infinite symlink | Detect + error |
| Invalid .forceignore | Incorrect syntax | Warning + ignore bad lines |
| Too many files | >50,000 files | Performance warning + continue |
| Mixed structure | Source + Metadata API mixed | Warning + continue |
| Circular package dependencies | Package A → B → A | Error + graph |
| Unknown metadata type | New unsupported type | Warning + skip |
| Disk full | ENOSPC error | Clear error + space required |

**Test Count**: 20 negative tests

#### Dependency Resolver (EDD)

| Error Scenario | Condition | Expected Behavior |
|----------------|-----------|-------------------|
| Circular dependency | A → B → C → A | Detect + break cycle + warning |
| Managed package dependency | Reference to namespace__Class | Skip (not deployable) |
| Non-existent dependency | Reference to deleted component | Warning + continue |
| Very large graph | >10,000 nodes | Use optimized algorithm |
| Insufficient memory | OOM during analysis | Graceful error + suggestion |
| Contradictory heuristic | Infers A→B and B→A | Warning + use static |
| AI timeout | Agentforce doesn't respond | Fallback to static + warning |
| AI returns garbage | Invalid JSON from AI | Fallback + log error |
| Component without type | Metadata without type mapping | Error + component name |
| Depth > 50 | Very nested dependencies | Complexity warning |

**Test Count**: 15 negative tests

#### Wave Generator (EDD)

| Error Scenario | Condition | Expected Behavior |
|----------------|-----------|-------------------|
| Very large wave | >1000 components | Auto-split + warning |
| CMT exceeds limit | >500 records in wave | Auto-split to 200/wave |
| No test classes found | Apex deployment without tests | Critical warning |
| Missing test dependency | Test without production class | Warning + deploy anyway |
| Empty wave generated | 0 components | Skip wave |
| Contradictory priority | Impossible order | Error + suggestion |
| Deploy order conflict | User override vs dependencies | Warning + use dependencies |
| Unsplittable component | Component > limit | Error + component name |
| AI suggests invalid order | AI breaks dependencies | Ignore suggestion + warning |
| Optimization creates cycle | Merge creates circular dependency | Revert optimization |

**Test Count**: 15 negative tests

#### Agentforce Service (EDD)

| Error Scenario | Condition | Expected Behavior |
|----------------|-----------|-------------------|
| Invalid API key | 401 Unauthorized | Clear error + instructions |
| API timeout | Request > 30s | Retry 3x + fallback |
| Rate limit exceeded | 429 Too Many Requests | Backoff + retry + warning |
| API returns 500 | Server error | Retry + fallback if fails |
| Malformed response | Invalid JSON | Fallback + log error |
| Very large response | >10MB response | Error + limit |
| Missing Named Credential | NC doesn't exist | Error + instructions |
| Low inference confidence | <0.3 confidence | Ignore inference + warning |
| AI hallucination | AI invents dependencies | Validate against real metadata |
| Very long prompt | >100K tokens | Truncate + warning |
| Corrupted cache | Redis/file error | Clear cache + continue |
| Concurrent requests | Race condition | Queue + serialize |

**Test Count**: 18 negative tests

**Total Services Negative Tests**: 68 tests

---

## 🎭 EDD Scenarios (Gherkin)

### Feature: Error Handling and Recovery

```gherkin
Feature: Error Handling and Recovery
  As a developer
  I want errors to be handled gracefully
  So that I can understand and fix issues quickly

  @error-handling @critical
  Scenario: Invalid project structure
    Given the project directory exists
    But no sfdx-project.json file is present
    And no src/ directory exists
    When I run "sf smart-deployment analyze"
    Then I should see error "Unable to detect project structure"
    And I should see suggestion "Create sfdx-project.json or ensure src/ directory exists"
    And the exit code should be 1

  @error-handling @network
  Scenario: Agentforce API is unavailable
    Given Agentforce is configured
    But the API endpoint is unreachable
    When I run "sf smart-deployment start --use-ai"
    Then I should see warning "Agentforce unavailable, falling back to static analysis"
    And the deployment should continue with static analysis only
    And the exit code should be 0
```

---

## 📊 Negative Tests Summary

```
┌────────────────────────────────────────────────┐
│ TOTAL NEGATIVE TESTS: 267                     │
├────────────────────────────────────────────────┤
│ Utils:                    45 tests             │
│ Parsers:                  65 tests             │
│ Services:                 68 tests             │
│ Core:                     28 tests             │
│ Generators:                8 tests             │
│ E2E Error Scenarios:      19 scenarios         │
└────────────────────────────────────────────────┘

Total Tests: 320 (positive) + 267 (negative) = 587 tests
Coverage: 95%+ including error paths
```

---

## 🛡️ Error Handling Patterns

### Pattern 1: Try-Catch with Context

```typescript
try {
  await parseApexClass(filePath, content);
} catch (error) {
  throw new ParseError({
    file: filePath,
    line: extractLine(error),
    message: `Failed to parse Apex class: ${error.message}`,
    suggestion: 'Check for syntax errors or corrupted file',
    originalError: error,
  });
}
```

### Pattern 2: Fallback Chain

```typescript
async function analyzeWithAI(components: Component[]) {
  try {
    return await agentforceService.analyze(components);
  } catch (error) {
    logger.warn('Agentforce unavailable, falling back to static analysis');
    return await staticAnalyze(components);
  }
}
```

### Pattern 3: Graceful Degradation

```typescript
async function generateWaves(components: Component[]) {
  let optimizedWaves = null;
  
  try {
    optimizedWaves = await aiOptimize(components);
  } catch (error) {
    logger.warn('AI optimization failed, using standard generation');
  }
  
  return optimizedWaves || standardWaveGeneration(components);
}
```

### Pattern 4: Retry with Backoff

```typescript
async function deployWave(wave: Wave) {
  const maxRetries = 3;
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await sfDeploy(wave);
    } catch (error) {
      lastError = error;
      if (!isRetryable(error)) throw error;
      await sleep(Math.pow(2, i) * 1000); // Exponential backoff
    }
  }
  
  throw new DeploymentError('Max retries exceeded', { lastError });
}
```

### Pattern 5: Circuit Breaker

```typescript
class AgentforceCircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private readonly threshold = 5;
  private readonly timeout = 60000; // 1 minute
  
  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error('Circuit breaker OPEN: too many failures');
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private isOpen(): boolean {
    return this.failures >= this.threshold 
      && Date.now() - this.lastFailTime < this.timeout;
  }
}
```

---

## 🎯 Error Categories & Handling

| Category | Examples | Handling Strategy |
|----------|----------|-------------------|
| **User Error** | Invalid input, missing file | Clear error + suggestion |
| **System Error** | OOM, disk full | Graceful fail + workaround |
| **Network Error** | API timeout, no connection | Retry + fallback |
| **Logic Error** | Circular deps, conflicts | Detect early + fix suggestion |
| **External Error** | SF API error, AI unavailable | Fallback + degrade gracefully |
| **Security Error** | Permissions, credentials | Clear error + security info |

---

## 🚀 EDD Workflow

```
1. Define Error Scenarios (Brainstorm what can go wrong)
   ↓
2. Write Negative Tests (Test errors are handled)
   ↓
3. Implement Error Handling (Make tests pass)
   ↓
4. Write Positive Tests (Now test happy path)
   ↓
5. Implement Happy Path (Build the feature)
   ↓
6. Refactor (Optimize both paths)
```

---

## 📝 EDD Checklist

- [ ] All inputs are validated
- [ ] All external errors are handled
- [ ] Fallbacks exist for critical services
- [ ] Errors have actionable messages
- [ ] Errors include context (file, line, etc.)
- [ ] Negative tests pass
- [ ] Coverage includes error paths (>90%)
- [ ] Useful logs for debugging
- [ ] Recovery paths are tested
- [ ] Edge cases are covered

---

## 💡 EDD Manifesto

> **"If you haven't thought about how it fails, you haven't thought about how it works."**

1. Everything can fail, and will fail
2. Errors are features, not bugs
3. A good error is better than a bad success
4. Fail fast, fail loud, fail clear
5. Recovery is part of design, not an afterthought

---

## 📚 References

- [Chaos Engineering Principles](https://principlesofchaos.org/)
- [Site Reliability Engineering - Error Budgets](https://sre.google/sre-book/embracing-risk/)
- [Release It! - Michael Nygard](https://pragprog.com/titles/mnee2/release-it-second-edition/)
