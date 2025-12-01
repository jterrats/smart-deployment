# 🎯 Acceptance Criteria Testing Guide

Complete guide for linking tests to acceptance criteria and automated validation.

---

## 📋 Overview

This project enforces that **all acceptance criteria must be covered by tests** before a PR can be merged.

### How It Works

1. **Create User Story**: Issue with acceptance criteria checkboxes
2. **Create Branch**: Format `feat/123-description` (123 = issue number)
3. **Write Tests**: Annotate tests with `@ac` to link to specific AC
4. **Push Code**: CI automatically validates AC coverage
5. **AC Auto-Checked**: Issue checkboxes are automatically marked
6. **Merge Blocked**: If AC not covered, merge is blocked

---

## ✅ Writing Tests with AC Annotations

### Basic Annotation

Use JSDoc `@ac` annotation to link test to acceptance criterion:

```typescript
// test/unit/utils/functional.test.ts
import { describe, it, expect } from '@jest/globals';
import { pipe } from '../../../src/utils/functional.js';

describe('pipe()', () => {
  /**
   * @ac US-001-AC-1: pipe() should execute functions left-to-right
   */
  it('should execute functions left-to-right', () => {
    const add = (x: number) => x + 1;
    const multiply = (x: number) => x * 2;
    
    const result = pipe(add, multiply)(5);
    
    expect(result).toBe(12); // (5 + 1) * 2
  });

  /**
   * @ac US-001-AC-2: pipe() should handle async functions
   */
  it('should handle async functions', async () => {
    const fetchData = async (id: number) => ({ id, name: 'Test' });
    const extractName = (data: { name: string }) => data.name;
    
    const result = await pipe(fetchData, extractName)(1);
    
    expect(result).toBe('Test');
  });
});
```

### Annotation Format

```
@ac US-<ISSUE_NUMBER>-AC-<AC_NUMBER>: <DESCRIPTION>
```

- `US-<ISSUE_NUMBER>`: User story issue number
- `AC-<AC_NUMBER>`: Acceptance criterion number (1, 2, 3, ...)
- `<DESCRIPTION>`: Brief description of what this test covers

**Examples**:
```typescript
/**
 * @ac US-013-AC-1: Extract extends relationships
 */

/**
 * @ac US-013-AC-2: Extract implements relationships
 */

/**
 * @ac US-013-AC-10: Handle Type.forName() dynamic instantiation
 */
```

---

## 📝 Complete Example

### User Story Issue #13

```markdown
## User Story

**As a** developer  
**I want** to parse Apex classes and extract dependencies  
**So that** I can build the dependency graph

## Acceptance Criteria

- [ ] Extract `extends` relationships
- [ ] Extract `implements` relationships
- [ ] Extract static method calls
- [ ] Extract object instantiations
- [ ] Extract variable declarations
- [ ] Handle inner classes
- [ ] Ignore standard classes (System.*, etc.)
- [ ] Handle managed packages
- [ ] Remove comments before parsing
- [ ] Handle Type.forName() dynamic instantiation
```

### Test File with AC Annotations

```typescript
// test/unit/parsers/apex-parser.test.ts
import { describe, it, expect } from '@jest/globals';
import { ApexParser } from '../../../src/parsers/apex-parser.js';

describe('ApexParser', () => {
  let parser: ApexParser;

  beforeEach(() => {
    parser = new ApexParser();
  });

  /**
   * @ac US-013-AC-1: Extract extends relationships
   */
  it('should extract extends relationships', () => {
    const content = 'public class MyClass extends BaseClass {}';
    
    const result = parser.parseClass(content);
    
    expect(result.dependencies).toContain('BaseClass');
  });

  /**
   * @ac US-013-AC-2: Extract implements relationships
   */
  it('should extract implements relationships', () => {
    const content = 'public class MyClass implements IService {}';
    
    const result = parser.parseClass(content);
    
    expect(result.dependencies).toContain('IService');
  });

  /**
   * @ac US-013-AC-3: Extract static method calls
   */
  it('should extract static method calls', () => {
    const content = `
      public class MyClass {
        public void doSomething() {
          HelperClass.staticMethod();
        }
      }
    `;
    
    const result = parser.parseClass(content);
    
    expect(result.dependencies).toContain('HelperClass');
  });

  /**
   * @ac US-013-AC-4: Extract object instantiations
   */
  it('should extract object instantiations', () => {
    const content = `
      public class MyClass {
        public void doSomething() {
          ServiceClass service = new ServiceClass();
        }
      }
    `;
    
    const result = parser.parseClass(content);
    
    expect(result.dependencies).toContain('ServiceClass');
  });

  /**
   * @ac US-013-AC-5: Extract variable declarations
   */
  it('should extract variable declarations', () => {
    const content = `
      public class MyClass {
        private HandlerClass handler;
      }
    `;
    
    const result = parser.parseClass(content);
    
    expect(result.dependencies).toContain('HandlerClass');
  });

  /**
   * @ac US-013-AC-6: Handle inner classes
   */
  it('should handle inner classes', () => {
    const content = `
      public class OuterClass {
        public class InnerClass {}
        
        public void useInner() {
          InnerClass inner = new InnerClass();
        }
      }
    `;
    
    const result = parser.parseClass(content);
    
    expect(result.innerClasses).toContain('InnerClass');
  });

  /**
   * @ac US-013-AC-7: Ignore standard classes (System.*, etc.)
   */
  it('should ignore standard classes', () => {
    const content = `
      public class MyClass {
        public void log() {
          System.debug('test');
          String s = 'test';
        }
      }
    `;
    
    const result = parser.parseClass(content);
    
    expect(result.dependencies).not.toContain('System');
    expect(result.dependencies).not.toContain('String');
  });

  /**
   * @ac US-013-AC-8: Handle managed packages
   */
  it('should handle managed packages', () => {
    const content = `
      public class MyClass extends ns__PackageClass {}
    `;
    
    const result = parser.parseClass(content);
    
    expect(result.dependencies).toContain('ns__PackageClass');
    expect(result.managedPackages).toContain('ns');
  });

  /**
   * @ac US-013-AC-9: Remove comments before parsing
   */
  it('should remove comments before parsing', () => {
    const content = `
      // This is a comment with FakeClass
      /* Block comment with AnotherFakeClass */
      public class MyClass extends RealClass {}
    `;
    
    const result = parser.parseClass(content);
    
    expect(result.dependencies).toContain('RealClass');
    expect(result.dependencies).not.toContain('FakeClass');
    expect(result.dependencies).not.toContain('AnotherFakeClass');
  });

  /**
   * @ac US-013-AC-10: Handle Type.forName() dynamic instantiation
   */
  it('should handle Type.forName() dynamic instantiation', () => {
    const content = `
      public class MyClass {
        public void create() {
          Type t = Type.forName('DynamicClass');
          Object obj = t.newInstance();
        }
      }
    `;
    
    const result = parser.parseClass(content);
    
    expect(result.dependencies).toContain('DynamicClass');
  });
});
```

---

## 🤖 Automated Validation

### CI/CD Workflow

When you push to a PR:

1. **Branch Name Parsing**: Extracts issue number from branch name
2. **Test Execution**: Runs all tests (unit, integration, E2E, NUTs)
3. **AC Validation**: Parses test files for `@ac` annotations
4. **Issue Update**: Automatically checks/unchecks AC in the issue
5. **PR Comment**: Posts AC coverage status to the PR
6. **Merge Block**: Blocks merge if AC are not covered

### PR Comment Example

```markdown
## ✅ Acceptance Criteria Status

**User Story**: #13

### Summary
- **Total AC**: 10
- **Completed**: 10 ✅
- **Pending**: 0 ⏳
- **Coverage**: 100%

### ✅ Completed Acceptance Criteria

- [x] Extract `extends` relationships
  - Covered by: test/unit/parsers/apex-parser.test.ts
- [x] Extract `implements` relationships
  - Covered by: test/unit/parsers/apex-parser.test.ts
- [x] Extract static method calls
  - Covered by: test/unit/parsers/apex-parser.test.ts
...

---

🎉 **This PR is ready for review!** All acceptance criteria are covered by tests.
```

---

## ⚠️ Merge Requirements

### Branch Protection Rules

The `main` branch is protected with these rules:

- ✅ Status checks must pass
- ✅ Acceptance Criteria Validation must pass
- ✅ All AC must be covered by tests
- ✅ Test coverage >90%
- ✅ No linter errors
- ✅ 1 approval required

### Merge Blocked Example

If AC are not covered:

```
❌ Cannot merge: 3 acceptance criteria are not covered by tests

Please add tests that cover the following acceptance criteria:
  - Extract variable declarations
  - Handle managed packages
  - Remove comments before parsing
```

---

## 📊 Checking AC Coverage Locally

Before pushing, check AC coverage locally:

```bash
# Run validation script
GITHUB_TOKEN=<your-token> \
ISSUE_NUMBER=13 \
REPOSITORY=jterrats/smart-deployment \
node scripts/validate-acceptance-criteria.js
```

**Output**:
```
🚀 Acceptance Criteria Validator

📋 Issue: #13
📦 Repository: jterrats/smart-deployment

📖 Issue Title: [US-013] Apex Class Parser

📋 Found 10 acceptance criteria

🧪 Found 15 test files

🔍 Analyzing test coverage for AC...

✅ AC-1: Extract extends relationships
   Covered by: 1 test(s)
   - test/unit/parsers/apex-parser.test.ts

✅ AC-2: Extract implements relationships
   Covered by: 1 test(s)
   - test/unit/parsers/apex-parser.test.ts

...

📊 Validation Results:
   Total AC: 10
   Completed: 10 ✅
   Pending: 0 ⏳
   Coverage: 100%

✅ All acceptance criteria are covered by tests!
```

---

## 🎨 Best Practices

### 1. One Test Per AC (Preferred)

```typescript
/**
 * @ac US-013-AC-1: Extract extends relationships
 */
it('should extract extends relationships', () => {
  // Single, focused test
});
```

### 2. Multiple Tests for Complex AC

```typescript
/**
 * @ac US-013-AC-3: Extract static method calls
 */
describe('static method call extraction', () => {
  it('should extract direct static calls', () => {
    // Test case 1
  });

  /**
   * @ac US-013-AC-3: Extract static method calls
   */
  it('should extract chained static calls', () => {
    // Test case 2
  });

  /**
   * @ac US-013-AC-3: Extract static method calls
   */
  it('should extract static calls in expressions', () => {
    // Test case 3
  });
});
```

### 3. Integration Tests for Multiple AC

```typescript
/**
 * @ac US-013-AC-1: Extract extends relationships
 * @ac US-013-AC-2: Extract implements relationships
 * @ac US-013-AC-3: Extract static method calls
 */
it('should extract all dependencies from complex class', () => {
  // Integration test covering multiple AC
});
```

### 4. E2E Tests for User Stories

```gherkin
# test/e2e/features/apex-parsing.feature

# @ac US-013 (covers all AC in the user story)
Feature: Apex Class Parsing
  Scenario: Parse complex Apex class
    Given a complex Apex class file
    When I parse the class
    Then all dependencies should be extracted
    And extends relationships should be identified
    And implements relationships should be identified
```

---

## 🔧 Troubleshooting

### AC Not Being Detected

**Problem**: Tests have `@ac` annotations but AC not marked as covered

**Solutions**:
1. Check annotation format: `@ac US-<NUMBER>-AC-<NUMBER>: description`
2. Ensure issue number in annotation matches branch name
3. Check that test file is in `test/unit`, `test/integration`, or `test/e2e`
4. Verify test file has `.test.ts` or `.spec.ts` extension

### Issue Not Found

**Problem**: CI cannot find the issue

**Solutions**:
1. Check branch name format: `feat/123-description`
2. Ensure issue #123 exists in GitHub
3. Verify issue has "Acceptance Criteria" section
4. Check GitHub token has `repo` scope

### Tests Pass But Merge Blocked

**Problem**: All tests pass but CI blocks merge

**Solution**: Some AC are not covered by tests. Add missing test annotations or write new tests.

---

## 📚 Additional Resources

- [User Stories Documentation](../USER_STORIES.md)
- [Testing Strategy](../methodology/TESTING_STRATEGY.md)
- [TDD/BDD/EDD Guide](../methodology/ERROR_DRIVEN_DEVELOPMENT.md)
- [Contributing Guide](../../CONTRIBUTING.md)

---

**Last Updated**: December 1, 2025  
**Version**: 1.0.0

