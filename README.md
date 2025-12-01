# SF Smart Deployment Plugin - Development

This directory contains the base files for developing the `@salesforce/plugin-smart-deployment` plugin.

## 📁 Current Structure

```
smart-deployment/
├── docs/
│   ├── ARCHITECTURE.md                          # Layered architecture design
│   ├── AGENTFORCE_INTEGRATION.md               # AI-powered dependency inference
│   ├── PROJECT_AGNOSTIC_DESIGN.md              # Structure-agnostic scanning
│   ├── TESTING_STRATEGY.md                     # TDD & BDD approach
│   ├── ERROR_DRIVEN_DEVELOPMENT.md             # EDD methodology
│   └── SF_SMART_DEPLOYMENT_PLUGIN_PROPOSAL.md  # Complete plugin proposal
├── sf_dependency_analyzer.py                    # Core logic (Python - base for TypeScript)
├── cleanup_old_flow_versions.py                 # Flow version management
├── deploy_custom_metadata_smart_batches.py      # CMT batch deployment
├── src/
│   ├── commands/                                # CLI commands
│   ├── core/                                    # Business logic
│   ├── services/                                # Operations
│   ├── parsers/                                 # Metadata analysis
│   ├── generators/                              # Output creation
│   ├── utils/                                   # Helpers
│   ├── types/                                   # Type definitions
│   └── constants/                               # Configuration
├── test/
│   ├── unit/                                    # Unit tests (TDD)
│   ├── integration/                             # Integration tests
│   └── e2e/                                     # E2E tests (BDD)
└── README.md                                     # This file
```

## 🎯 Next Steps

### 1. Implement Constants
```bash
# Create Salesforce limits, deployment order, and metadata types
src/constants/
├── salesforce-limits.ts
├── deployment-order.ts
└── metadata-types.ts
```

### 2. Implement Functional Utils
```bash
# Create functional programming utilities
src/utils/
├── functional.ts         # pipe, compose, curry, memoize
├── graph-algorithms.ts   # topological sort, cycle detection
├── fs-utils.ts          # File system operations
└── xml-utils.ts         # XML parsing/generation
```

### 3. Implement Parsers
```bash
# Create metadata parsers (50+ types)
src/parsers/
├── apex-parser.ts
├── flow-parser.ts
├── lwc-parser.ts
├── permission-set-parser.ts
└── ... (more parsers)
```

### 4. Implement Services
```bash
# Create service layer
src/services/
├── metadata-scanner.ts
├── dependency-resolver.ts
├── wave-generator.ts
└── deployment-executor.ts
```

### 5. Implement Core Engine
```bash
# Create business logic
src/core/
├── dependency-engine.ts
├── deployment-orchestrator.ts
└── test-optimizer.ts
```

### 6. Implement CLI Commands
```bash
src/commands/smart-deployment/
├── start.ts      # Main deployment command
├── analyze.ts    # Analysis only
├── validate.ts   # Dry-run
├── status.ts     # Progress check
└── resume.ts     # Resume from failure
```

### 7. Testing
```bash
npm test                    # Unit tests
npm run test:integration    # Integration tests
npm run test:e2e           # E2E tests (BDD)
npm run test:coverage      # Coverage report
```

### 8. Publication
```bash
npm publish --access public
```

---

## 🏗️ Architecture

The plugin follows a **layered architecture** with functional programming principles:

```
Commands → Core → Services → Parsers → Utils
    ↓                ↓
Generators      AI Services (Agentforce)
```

### Key Principles
- **Functional Programming**: Pure functions, immutability, composition
- **Modularity**: Small, testable, reusable components
- **Type Safety**: Strict TypeScript
- **Project Agnostic**: Works with any Salesforce project structure
- **AI-Enhanced**: Agentforce for intelligent dependency inference

---

## 🤖 Agentforce Integration

The plugin uses **Agentforce** (Salesforce's LLM) for:
1. **Dependency Inference**: Detect non-obvious dependencies
2. **Priority Weighting**: Suggest optimal deployment order
3. **Wave Validation**: Validate generated deployment waves
4. **Test Optimization**: Suggest relevant tests per wave
5. **Risk Assessment**: Evaluate deployment risk

---

## 🔑 Key Concepts

### Hardcoded Limits (NOT user-configurable)
- **Max components per wave**: 300 (avoids UNKNOWN_EXCEPTION)
- **Max CMT records per wave**: 200 (proven SF limit)
- **Max files per deployment**: ~400-500 (API limit)

These should NOT be public flags - they are technical Salesforce limits.

### Metadata Type Mapping
The analyzer must use exact names expected by SF CLI in package.xml:
- `Translations` (not `Translation`)
- `CustomNotificationType` (not `NotificationType`)
- `Settings` (not `OrgSettings`)
- Documents: `FolderName/DocumentName`
- DigitalExperienceBundle: `site/SiteName`

---

## 🧪 Testing Strategy

### Test Coverage Goals

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

### Testing Approaches
- **TDD (Test-Driven Development)**: Write tests before implementation
- **BDD (Behavior-Driven Development)**: User-centric scenarios with Gherkin
- **EDD (Error-Driven Development)**: Negative scenarios and error handling

---

## 📚 References

- [Salesforce CLI Plugin Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_plugins.meta/sfdx_cli_plugins/)
- [Salesforce Metadata API](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/)
- [Agentforce DX Documentation](https://developer.salesforce.com/docs/einstein/genai/guide/agent-dx.html)
- [OCLIF Framework](https://oclif.io/)

---

## 🎓 Key Learnings

1. **Component vs File count**: Some components generate multiple files (CustomObject with fields)
2. **CMT limits**: CustomMetadataRecords have lower limits than general metadata
3. **Path formatting**: Documents and DigitalExperience require full path in member name
4. **Test optimization**: Running tests only in waves with Apex/Flow saves 40-60% time
5. **Fail-fast vs retry**: Production = fail-fast, Sandbox = retry without tests

---

## 📊 Project Status

**Status**: 🟡 Initial development  
**Owner**: @jterrats  
**Created**: Dec 1, 2025  
**Language**: TypeScript  
**Framework**: OCLIF (Salesforce CLI Plugin Framework)  
**Testing**: Jest + Cucumber  
**CI/CD**: GitHub Actions (coming soon)  

---

## 🚀 Quick Start

```bash
# Clone repository
git clone git@github.com:jterrats/smart-deployment.git
cd smart-deployment

# Install dependencies
yarn install

# Build plugin
yarn build

# Link plugin to SF CLI
sf plugins link .

# Run command
sf smart-deployment start --help
```

---

## 🤝 Contributing

Contributions are welcome! Please:
1. Read the architecture documentation in `docs/`
2. Follow TDD/BDD/EDD testing approaches
3. Maintain test coverage >90%
4. Use functional programming principles
5. Add documentation for new features

---

## 📝 License

MIT License - see LICENSE file for details
