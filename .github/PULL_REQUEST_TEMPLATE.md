# Pull Request

## 📋 Description

Brief description of changes made in this PR.

## 🔗 Related Issues

Closes #___
Related to #___

## 🏷️ Type of Change

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation update
- [ ] ♻️ Code refactoring
- [ ] ⚡ Performance improvement
- [ ] ✅ Test update

## 🧪 Testing

### Test Coverage

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated (BDD)
- [ ] Negative scenario tests added (EDD)
- [ ] Manual testing completed

### Test Results

```bash
# Paste test output here
yarn test
```

**Coverage**: ___% (must be >90% for modified code)

## 📝 Documentation

- [ ] Code comments added to complex logic
- [ ] JSDoc added to all new functions
- [ ] README updated (if needed)
- [ ] Architecture docs updated (if architecture changed)
- [ ] User stories linked
- [ ] Examples provided for new features

## ✅ Code Quality Checklist

### Architecture

- [ ] Follows layered architecture (Commands → Core → Services → Parsers → Utils)
- [ ] No upward dependencies between layers
- [ ] Single Responsibility Principle followed
- [ ] Dependency Injection used where appropriate

### Code Standards

- [ ] Follows TypeScript strict mode
- [ ] No `any` types used
- [ ] Pure functions where possible
- [ ] Immutability maintained
- [ ] Functional composition used (pipe/compose)
- [ ] Proper error handling implemented
- [ ] Functions are small and focused (<50 lines)
- [ ] Max 3 parameters per function (or options object)

### Testing

- [ ] All tests pass locally
- [ ] Coverage >90% for modified code
- [ ] TDD approach followed
- [ ] BDD scenarios added for user-facing features
- [ ] EDD negative scenarios included

### Code Review

- [ ] Self-review completed
- [ ] No console.log or debug code
- [ ] No commented-out code
- [ ] Code is DRY (Don't Repeat Yourself)
- [ ] Variable names are descriptive
- [ ] No code smells

### CI/CD

- [ ] No linter errors (`yarn lint`)
- [ ] No TypeScript errors (`yarn compile`)
- [ ] All CI checks pass
- [ ] No merge conflicts
- [ ] Branch is up-to-date with main

## 🚀 Deployment Notes

Any special considerations for deployment?

- [ ] Requires dependency installation
- [ ] Requires configuration changes
- [ ] Breaking changes documented
- [ ] Migration guide provided (if breaking)

## 📸 Screenshots / Demo

If applicable, add screenshots or demo output.

```bash
# Example command output
$ sf smart-deployment analyze
...
```

## ⚠️ Breaking Changes

List any breaking changes and migration path:

1. Change 1: How to migrate
2. Change 2: How to migrate

## 🎯 Performance Impact

Describe any performance implications:

- [ ] No performance impact
- [ ] Performance improved
- [ ] Performance may be affected (explain why acceptable)

**Benchmarks** (if applicable):

```
Before: X ms
After: Y ms
```

## 🔒 Security Considerations

- [ ] No security implications
- [ ] Security review completed
- [ ] Input validation added
- [ ] No sensitive data in logs
- [ ] Error messages don't leak information

## 📊 Definition of Done

- [ ] All acceptance criteria met
- [ ] Code reviewed and approved
- [ ] Tests passing with >90% coverage
- [ ] Documentation complete
- [ ] No linter errors
- [ ] CI/CD passing
- [ ] Ready to merge

---

## 👀 Reviewer Checklist

For reviewers:

- [ ] Code follows style guidelines
- [ ] Architecture principles respected
- [ ] Tests are comprehensive
- [ ] Documentation is clear
- [ ] No performance issues
- [ ] Error handling is robust
- [ ] Security considerations addressed

## 💬 Additional Comments

Add any additional comments for reviewers here.

