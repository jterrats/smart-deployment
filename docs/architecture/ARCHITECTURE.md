# 🏗️ Smart Deployment Plugin Architecture

## Philosophy

This plugin is designed with the following principles:

1. **Functional Programming**: Pure functions, immutability, composition
2. **Layered Architecture**: Separation of concerns
3. **Modularity**: Small, testable, and reusable components
4. **Type Safety**: Strict TypeScript to prevent errors
5. **Testability**: Each layer is independently testable

---

## Layer Structure

```
┌─────────────────────────────────────────────┐
│         COMMANDS (CLI Interface)            │
│   sf smart-deployment start|analyze|etc     │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│          CORE (Business Logic)              │
│  - DependencyEngine                         │
│  - DeploymentOrchestrator                   │
│  - TestOptimizer                            │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│         SERVICES (Operations)               │
│  - MetadataScanner                          │
│  - DependencyResolver                       │
│  - WaveGenerator                            │
│  - DeploymentExecutor                       │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│         PARSERS (Metadata Analysis)         │
│  - ApexParser                               │
│  - FlowParser                               │
│  - LwcParser                                │
│  - PermissionSetParser                      │
│  - ... (50+ metadata types)                 │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│       GENERATORS (Output Creation)          │
│  - ManifestGenerator                        │
│  - ReportGenerator                          │
│  - ErrorFormatter                           │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│         UTILS (Helpers)                     │
│  - FileSystem                               │
│  - XmlParser                                │
│  - GraphAlgorithms                          │
└─────────────────────────────────────────────┘
```

---

## Data Flow (Functional Approach)

```typescript
// Functional composition of operations
const deploymentPipeline = pipe(
  scanMetadata,              // Scan project files
  parseComponents,           // Parse each component
  resolveDependencies,       // Build dependency graph
  optimizeDependencyGraph,   // Apply heuristics
  generateWaves,             // Split into waves
  optimizeTests,             // Optimize test execution
  splitLargeWaves,          // Split large waves
  generateManifests          // Generate package.xml
);

// Execute pipeline
const result = await deploymentPipeline(projectPath);
```

---

## Layer Details

### 1. Commands Layer (CLI Interface)

**Responsibility**: Expose CLI commands, validate inputs, invoke Core

```
commands/
├── smart-deployment/
│   ├── start.ts         # Main deployment command
│   ├── analyze.ts       # Analysis only (dry-run)
│   ├── validate.ts      # Deployment validation
│   ├── resume.ts        # Resume failed deployment
│   └── status.ts        # View deployment status
```

**Features**:
- Uses `@oclif/core` for command definition
- Flag and argument validation
- Progress bars and UX
- User-friendly error handling

---

### 2. Core Layer (Business Logic)

**Responsibility**: Main business logic, orchestration

```
core/
├── dependency-engine.ts         # Dependency analysis engine
├── deployment-orchestrator.ts   # Deployment orchestrator
├── test-optimizer.ts            # Test optimizer
├── wave-splitter.ts             # Wave splitting
└── heuristics.ts                # Inference heuristics
```

**Example - Dependency Engine**:

```typescript
export const analyzeDependencies = (
  components: Component[]
): DependencyGraph => {
  return pipe(
    buildInitialGraph,
    applyHeuristics,
    detectCircularDependencies,
    calculateDepth
  )(components);
};
```

---

### 3. Services Layer (Operations)

**Responsibility**: Specific operations, without complex business logic

```
services/
├── metadata-scanner.ts          # Scan project files
├── dependency-resolver.ts       # Resolve component dependencies
├── wave-generator.ts            # Generate deployment waves
├── deployment-executor.ts       # Execute deployment via SF CLI
├── manifest-validator.ts        # Validate generated manifests
└── forceignore-reader.ts        # Read .forceignore
```

**Example - Metadata Scanner**:

```typescript
export const scanMetadata = async (
  projectPath: string
): Promise<ComponentFile[]> => {
  const metadataPath = join(projectPath, 'force-app/main/default');
  const ignorePatterns = await readForceignore(projectPath);
  
  return pipe(
    findAllMetadataFiles,
    filterIgnoredFiles(ignorePatterns),
    groupByType
  )(metadataPath);
};
```

---

### 4. Parsers Layer (Metadata Analysis)

**Responsibility**: Parse specific metadata and extract dependencies

```
parsers/
├── index.ts                     # Barrel export + factory
├── apex-parser.ts               # Parse Apex classes/triggers
├── flow-parser.ts               # Parse Flows
├── lwc-parser.ts                # Parse LWC
├── aura-parser.ts               # Parse Aura
├── permission-set-parser.ts     # Parse Permission Sets
├── profile-parser.ts            # Parse Profiles
├── object-parser.ts             # Parse Custom Objects
├── layout-parser.ts             # Parse Layouts
├── flexipage-parser.ts          # Parse FlexiPages
├── vf-parser.ts                 # Parse Visualforce
├── bot-parser.ts                # Parse Bots
├── site-parser.ts               # Parse Sites
├── network-parser.ts            # Parse Networks
├── genai-parser.ts              # Parse GenAI metadata
└── ... (more parsers)
```

**Functional Design**:

```typescript
// Common interface for all parsers
export type MetadataParser<T extends MetadataComponent> = (
  filePath: string,
  content: string
) => ParseResult<T>;

// Example: Apex Parser
export const parseApexClass: MetadataParser<ApexClass> = (filePath, content) => {
  const dependencies = pipe(
    removeComments,
    extractExtends,
    extractImplements,
    extractInstantiations,
    extractStaticCalls,
    extractVariableDeclarations
  )(content);

  return {
    name: extractClassName(filePath),
    type: 'ApexClass',
    dependencies,
    filePath,
  };
};
```

---

### 5. Generators Layer (Output Creation)

**Responsibility**: Generate outputs (manifests, reports, etc.)

```
generators/
├── manifest-generator.ts        # Generate package.xml
├── report-generator.ts          # Generate JSON/HTML reports
├── error-formatter.ts           # Format user-friendly errors
└── wave-metadata-generator.ts   # Generate wave_metadata.json
```

**Example - Manifest Generator**:

```typescript
export const generateManifest = (
  components: Component[]
): string => {
  const grouped = groupByMetadataType(components);
  
  return pipe(
    createXmlRoot,
    addTypes(grouped),
    addVersion('65.0'),
    formatXml
  )();
};
```

---

### 6. Utils Layer (Helpers)

**Responsibility**: Pure utility functions

```
utils/
├── fs-utils.ts                  # File system operations
├── xml-utils.ts                 # XML parsing/generation
├── graph-algorithms.ts          # Topological sort, cycle detection
├── string-utils.ts              # String manipulation
├── logger.ts                    # Logging utilities
└── functional.ts                # Functional utilities (pipe, compose)
```

**Example - Graph Algorithms**:

```typescript
export const topologicalSort = <T>(
  graph: Map<T, Set<T>>
): T[][] => {
  const inDegree = calculateInDegree(graph);
  const queue = nodesWithZeroInDegree(inDegree);
  const waves: T[][] = [];

  while (queue.length > 0) {
    waves.push([...queue]);
    const nextQueue = reduceInDegree(graph, queue, inDegree);
    queue.length = 0;
    queue.push(...nextQueue);
  }

  return waves;
};
```

---

### 7. Types Layer (Type Definitions)

**Responsibility**: Shared type definitions

```
types/
├── metadata.ts                  # Metadata types
├── dependency.ts                # Dependency types
├── deployment.ts                # Deployment types
├── graph.ts                     # Graph types
└── config.ts                    # Configuration types
```

---

### 8. Constants Layer (Configuration)

**Responsibility**: Constants and configuration

```
constants/
├── salesforce-limits.ts         # Salesforce API limits
├── deployment-order.ts          # Deployment order by type
└── metadata-types.ts            # 50+ type definitions
```

---

## End-to-End Implementation Example

### Start Command (commands/smart-deployment/start.ts)

```typescript
export default class Start extends SfCommand<StartResult> {
  async run(): Promise<StartResult> {
    const { flags } = await this.parse(Start);
    const projectPath = flags['project-path'] ?? process.cwd();
    
    // Main orchestrator
    const orchestrator = new DeploymentOrchestrator(projectPath);
    
    return await orchestrator.execute({
      targetOrg: flags['target-org'],
      testLevel: flags['test-level'],
      failFast: flags['fail-fast'],
      dryRun: flags['dry-run'],
    });
  }
}
```

### Orchestrator (core/deployment-orchestrator.ts)

```typescript
export class DeploymentOrchestrator {
  async execute(options: DeploymentOptions): Promise<DeployResult> {
    // Functional pipeline
    const pipeline = pipe(
      this.scanProject,
      this.analyzeComponents,
      this.resolveDependencies,
      this.generateWaves,
      this.optimizeTests,
      this.validateWaves,
      this.deployWaves
    );
    
    return await pipeline(this.projectPath, options);
  }
  
  private scanProject = async (path: string) => {
    return await scanMetadata(path);
  };
  
  private analyzeComponents = (files: ComponentFile[]) => {
    return parseComponents(files);
  };
  
  // ... more methods
}
```

---

## Testing Strategy

### Unit Tests (Per Layer)

```typescript
describe('ApexParser', () => {
  it('should extract extends dependencies', () => {
    const content = 'public class MyClass extends BaseClass {}';
    const result = parseApexClass('MyClass.cls', content);
    expect(result.dependencies).toContain('BaseClass');
  });
});

describe('TopologicalSort', () => {
  it('should sort graph correctly', () => {
    const graph = new Map([
      ['A', new Set(['B', 'C'])],
      ['B', new Set(['C'])],
      ['C', new Set()],
    ]);
    const result = topologicalSort(graph);
    expect(result).toEqual([['C'], ['B'], ['A']]);
  });
});
```

---

## Architecture Benefits

1. **Modularity**: Each layer has a single responsibility
2. **Testability**: Pure functions are easy to test
3. **Maintainability**: Changes are localized to specific layers
4. **Scalability**: Easy to add new parsers/generators
5. **Reusability**: Utils and parsers are reusable
6. **Type Safety**: TypeScript prevents errors at compile-time
7. **Composition**: Readable functional pipelines

---

## Migration from Python

Migration from `sf_dependency_analyzer.py` follows this mapping:

| Python | TypeScript |
|--------|------------|
| `SalesforceDependencyAnalyzer.analyze()` | `core/dependency-engine.ts` |
| `_analyze_apex_classes()` | `parsers/apex-parser.ts` |
| `_analyze_flows()` | `parsers/flow-parser.ts` |
| `generate_deployment_order()` | `services/wave-generator.ts` |
| `topological_sort()` | `utils/graph-algorithms.ts` |
| `generate_deployment_manifest()` | `generators/manifest-generator.ts` |

---

## Next Steps

1. Create directory structure
2. Define types in `types/`
3. Implement functional utils
4. Implement parsers (starting with Apex)
5. Implement core engine
6. Implement CLI commands
7. Unit tests per layer
8. End-to-end integration tests
