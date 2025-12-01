# 🧪 Testing Strategy - TDD & BDD

## Testing Philosophy

The Smart Deployment plugin follows a multi-level testing strategy:

1. **TDD (Test-Driven Development)**: Write tests BEFORE implementation
2. **BDD (Behavior-Driven Development)**: Define expected behavior in natural language
3. **Integration Tests**: Test interaction between layers
4. **E2E Tests**: Test complete deployment flow

---

## 🎯 Testing Levels

```
┌─────────────────────────────────────────────┐
│  E2E Tests (Cucumber/Gherkin)               │ ← BDD
│  "Given-When-Then" scenarios                │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Integration Tests (Jest)                   │
│  Layer interaction                          │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Unit Tests (Jest)                          │ ← TDD
│  Individual pure functions                  │
└─────────────────────────────────────────────┘
```

---

## 📊 Test Matrix by Layer

### Layer 1: Types (No tests required)
- Type definitions validated by TypeScript

### Layer 2: Constants

| Component | Test Type | Cases | Priority |
|-----------|-----------|-------|----------|
| `salesforce-limits.ts` | Unit | Validate known limits | High |
| `deployment-order.ts` | Unit | Validate type order | High |
| `metadata-types.ts` | Unit | Validate type mapping | High |

**Test Count**: 15 tests

---

### Layer 3: Utils

#### 3.1 Functional Utils (TDD)

| Function | Tests | Test Cases |
|----------|-------|------------|
| `pipe()` | 5 | - 2-function composition<br>- N-function composition<br>- Async pipe<br>- Empty pipe<br>- Pipe with error |
| `compose()` | 5 | - Right-to-left composition<br>- Async compose<br>- Empty compose<br>- Error handling<br>- Type safety |
| `curry()` | 4 | - Curry 2 params<br>- Curry N params<br>- Partial application<br>- Type preservation |
| `memoize()` | 6 | - Cache hit<br>- Cache miss<br>- Cache invalidation<br>- Multiple args<br>- Cache size limit<br>- Performance gain |

**Test Count**: 20 tests

#### 3.2 Graph Algorithms (TDD)

| Function | Tests | Test Cases |
|----------|-------|------------|
| `topologicalSort()` | 8 | - Simple graph (A→B→C)<br>- Fork graph (A→B,C)<br>- Join graph (B,C→D)<br>- Empty graph<br>- Isolated node<br>- Graph with cycle<br>- Complex graph (50+ nodes)<br>- Performance (1000+ nodes) |
| `detectCycles()` | 6 | - No cycles<br>- Simple cycle (A→B→A)<br>- Complex cycle<br>- Multiple cycles<br>- Self-loop<br>- Performance |
| `calculateDepth()` | 5 | - Depth 0 (no deps)<br>- Depth 1<br>- Max depth<br>- With cycles<br>- Performance |
| `findShortestPath()` | 4 | - Direct path<br>- Indirect path<br>- No path<br>- Multiple paths |

**Test Count**: 23 tests

#### 3.3 File System Utils (TDD)

| Function | Tests | Test Cases |
|----------|-------|------------|
| `readProjectFile()` | 6 | - File exists<br>- File not found<br>- Permission denied<br>- Large file<br>- Binary file<br>- Encoding issues |
| `scanDirectory()` | 7 | - Recursive scan<br>- Non-recursive scan<br>- With glob patterns<br>- Empty directory<br>- Symlinks<br>- Hidden files<br>- Performance (1000+ files) |
| `parseXml()` | 5 | - Valid XML<br>- Invalid XML<br>- Large XML<br>- XML with namespaces<br>- Malformed XML |

**Test Count**: 18 tests

**Total Utils Tests**: 61 tests

---

### Layer 4: Parsers

#### 4.1 Apex Parser (TDD)

| Method | Tests | Test Cases |
|--------|-------|------------|
| `parseApexClass()` | 15 | - Simple class<br>- Class with extends<br>- Class with implements<br>- Class with static calls<br>- Class with instantiation<br>- Test class<br>- Utility class<br>- Handler class<br>- Service class<br>- With comments<br>- With strings<br>- Dynamic instantiation (Type.forName)<br>- Inner classes<br>- Abstract class<br>- Interface |
| `extractDependencies()` | 10 | - No dependencies<br>- Single dependency<br>- Multiple dependencies<br>- Circular reference<br>- Self reference<br>- SObject reference<br>- Custom metadata reference<br>- Standard classes (ignore)<br>- Managed packages<br>- Performance (1000+ lines) |

**Test Count**: 25 tests

#### 4.2 Flow Parser (TDD)

| Method | Tests | Test Cases |
|--------|-------|------------|
| `parseFlow()` | 12 | - Screen flow<br>- Record-triggered flow<br>- Scheduled flow<br>- Autolaunched flow<br>- With Apex action<br>- With subflow<br>- With GenAI prompt<br>- With decision elements<br>- With loops<br>- With assignments<br>- Complex flow (50+ elements)<br>- Performance |

**Test Count**: 12 tests

#### 4.3 LWC Parser (TDD)

| Method | Tests | Test Cases |
|--------|-------|------------|
| `parseLwc()` | 10 | - Simple component<br>- With Apex import<br>- With other LWC import<br>- With wire adapter<br>- With @api properties<br>- With navigation<br>- TypeScript component<br>- Missing meta file<br>- Invalid structure<br>- Performance |

**Test Count**: 10 tests

#### 4.4 More Parsers

- **PermissionSet**: 8 tests
- **Profile**: 6 tests
- **CustomObject**: 12 tests
- **Layout**: 7 tests
- **FlexiPage**: 9 tests
- **Site**: 6 tests
- **Bot**: 5 tests

**Total Parsers Tests**: 100 tests

---

### Layer 5: Services

#### 5.1 Metadata Scanner (TDD)

| Method | Tests | Test Cases |
|--------|-------|------------|
| `scanProject()` | 10 | - Standard structure<br>- Multi-package<br>- Metadata API format<br>- Custom structure<br>- Empty project<br>- With .forceignore<br>- Monorepo<br>- Symlinks<br>- Large project (5000+ files)<br>- Performance |
| `detectStructure()` | 6 | - SFDX standard<br>- Multi-package<br>- Metadata API<br>- Unknown<br>- Mixed format<br>- Corrupted project |

**Test Count**: 16 tests

#### 5.2 Dependency Resolver (TDD)

| Method | Tests | Test Cases |
|--------|-------|------------|
| `resolveDependencies()` | 12 | - No dependencies<br>- Simple chain (A→B→C)<br>- Complex graph (50+ nodes)<br>- With cycles<br>- With isolated nodes<br>- With heuristics<br>- Test-Production sync<br>- Handler-Service pattern<br>- Trigger-Handler pattern<br>- Performance (1000+ components)<br>- With AI inference<br>- Fallback without AI |

**Test Count**: 12 tests

#### 5.3 Wave Generator (TDD)

| Method | Tests | Test Cases |
|--------|-------|------------|
| `generateWaves()` | 15 | - Single wave<br>- Multiple waves<br>- Wave splitting (>300 components)<br>- CMT splitting (>200 records)<br>- Test optimization<br>- With priorities<br>- With circular deps<br>- Empty input<br>- Large input (2000+ components)<br>- Merge waves<br>- Split waves<br>- With AI validation<br>- Without AI<br>- Performance<br>- Quality score |

**Test Count**: 15 tests

#### 5.4 Agentforce Service (TDD + BDD)

| Method | Tests | Test Cases |
|--------|-------|------------|
| `analyzeDependencies()` | 8 | - With cache hit<br>- Cache miss<br>- API timeout<br>- API error<br>- Invalid response<br>- Confidence threshold<br>- Large input<br>- Retry logic |
| `validateWaves()` | 6 | - Valid waves<br>- Invalid waves<br>- With optimizations<br>- Quality score<br>- API failure fallback<br>- Performance |

**Test Count**: 14 tests

**Total Services Tests**: 57 tests

---

### Layer 6: Core

#### 6.1 Dependency Engine (TDD + Integration)

| Method | Tests | Test Cases |
|--------|-------|------------|
| `analyze()` | 10 | - Full analysis<br>- With AI<br>- Without AI<br>- With errors<br>- Partial success<br>- Cache usage<br>- Performance<br>- Metrics collection<br>- Error recovery<br>- Integration test |

**Test Count**: 10 tests

#### 6.2 Deployment Orchestrator (Integration + E2E)

| Method | Tests | Test Cases |
|--------|-------|------------|
| `execute()` | 12 | - Full deployment<br>- Dry run<br>- With failures<br>- Resume from failure<br>- Cancel deployment<br>- Sandbox vs Production<br>- With tests<br>- Without tests<br>- Performance<br>- Rollback<br>- Progress reporting<br>- E2E test |

**Test Count**: 12 tests

**Total Core Tests**: 22 tests

---

### Layer 7: Generators

#### 7.1 Manifest Generator (TDD)

| Method | Tests | Test Cases |
|--------|-------|------------|
| `generateManifest()` | 8 | - Empty manifest<br>- Single type<br>- Multiple types<br>- Large manifest (1000+ components)<br>- With special chars<br>- Type mapping<br>- XML validation<br>- Performance |

**Test Count**: 8 tests

#### 7.2 Report Generator (TDD)

| Method | Tests | Test Cases |
|--------|-------|------------|
| `generateReport()` | 6 | - JSON format<br>- HTML format<br>- With metrics<br>- With errors<br>- Large report<br>- Custom template |

**Test Count**: 6 tests

**Total Generators Tests**: 14 tests

---

### Layer 8: Commands (BDD)

#### 8.1 CLI Commands (BDD + E2E)

| Command | Scenarios | BDD Tests |
|---------|-----------|-----------|
| `start` | 10 | See BDD section below |
| `analyze` | 6 | See BDD section below |
| `validate` | 5 | See BDD section below |
| `resume` | 4 | See BDD section below |
| `status` | 3 | See BDD section below |

**Test Count**: 28 BDD scenarios

---

## 🎭 BDD Scenarios (Gherkin)

### Feature: Smart Deployment Start

```gherkin
Feature: Smart Deployment Start
  As a Salesforce developer
  I want to deploy metadata intelligently
  So that I avoid deployment failures

  Background:
    Given a Salesforce project with metadata
    And a target org "production"

  Scenario: Successful deployment with AI analysis
    Given the project has 100 Apex classes
    And the project has 50 Flows
    And Agentforce is enabled
    When I run "sf smart-deployment start --target-org production --use-ai"
    Then Agentforce should analyze dependencies
    And the deployment should generate 8 waves
    And all waves should deploy successfully
    And the deployment should complete in less than 15 minutes

  Scenario: Deployment without AI (fallback)
    Given Agentforce is unavailable
    When I run "sf smart-deployment start --target-org production"
    Then the deployment should use static analysis only
    And the deployment should still succeed
    And a warning should be shown about AI unavailability

  Scenario: Deployment with test optimization
    Given the project has 50 test classes
    And waves 1-3 have Apex changes
    And waves 4-6 have no Apex changes
    When I run "sf smart-deployment start --target-org production"
    Then tests should run only in waves 1-3
    And waves 4-6 should skip tests
    And deployment time should be reduced by 40%
```

---

## 🎯 Test Coverage Goals

| Layer | Unit Tests | Integration Tests | E2E Tests | Coverage Goal |
|-------|-----------|-------------------|-----------|---------------|
| Utils | 61 | 0 | 0 | 100% |
| Parsers | 100 | 5 | 0 | 95% |
| Services | 57 | 10 | 3 | 90% |
| Core | 22 | 8 | 5 | 90% |
| Generators | 14 | 2 | 0 | 95% |
| Commands | 0 | 5 | 28 | 85% |
| **TOTAL** | **254** | **30** | **36** | **92%** |

**Total Tests: 320**

---

## 🚀 Testing Commands

```bash
# Unit tests
npm test

# Unit tests in watch mode (TDD)
npm run test:watch

# Integration tests
npm run test:integration

# E2E tests (BDD)
npm run test:e2e

# All tests
npm run test:all

# Coverage
npm run test:coverage

# Coverage with threshold
npm run test:coverage:strict  # Fails if < 90%

# Specific test
npm test -- apex-parser.test.ts

# Debug tests
npm run test:debug
```

---

## 📊 Test Summary Matrix

```
Total Tests: 320
├── Unit Tests: 254 (79%)
│   ├── Utils: 61
│   ├── Parsers: 100
│   ├── Services: 57
│   ├── Core: 22
│   └── Generators: 14
├── Integration Tests: 30 (9%)
└── E2E Tests (BDD): 36 (12%)

Estimated Test Execution Time:
├── Unit: ~2 minutes
├── Integration: ~5 minutes
└── E2E: ~15 minutes
Total: ~22 minutes (with parallelization: ~8 minutes)
```

---

## ✅ Testing Checklist

- [ ] All unit tests pass
- [ ] Coverage > 90% per layer
- [ ] All integration tests pass
- [ ] All BDD scenarios pass
- [ ] Performance tests within limits
- [ ] No flaky tests
- [ ] Mocks are up to date
- [ ] Fixtures are versioned
- [ ] Tests are deterministic
- [ ] CI/CD runs all tests
