# 💻 Code Standards

Comprehensive coding standards for the Smart Deployment Plugin project.

---

## 📋 Table of Contents

- [TypeScript Standards](#typescript-standards)
- [Functional Programming](#functional-programming)
- [Architecture Patterns](#architecture-patterns)
- [Error Handling](#error-handling)
- [Testing Standards](#testing-standards)
- [Performance Guidelines](#performance-guidelines)
- [Security Standards](#security-standards)

---

## 🔷 TypeScript Standards

### Strict Mode

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Type Annotations

#### ✅ DO: Explicit Types

```typescript
// Function signatures
export function parseApexClass(
  filePath: string,
  content: string
): ParseResult<ApexClass> {
  // Implementation
}

// Complex return types
export async function scanProject(
  path: string
): Promise<{
  components: Component[];
  errors: Error[];
  stats: ProjectStats;
}> {
  // Implementation
}

// Generic constraints
export function filterBy<T extends MetadataComponent>(
  predicate: (item: T) => boolean
): (items: T[]) => T[] {
  return (items) => items.filter(predicate);
}
```

#### ❌ DON'T: Implicit or Any Types

```typescript
// BAD: No return type
function calculate(x, y) {
  return x + y;
}

// BAD: Using 'any'
function process(data: any): any {
  return data.result;
}

// BAD: Implicit generic
function map(fn) {
  return (items) => items.map(fn);
}
```

### Type Definitions

```typescript
// types/metadata.ts

// Use interfaces for object shapes
export interface MetadataComponent {
  readonly id: string;
  readonly type: MetadataType;
  readonly name: string;
  readonly path: string;
  readonly dependencies: ReadonlyArray<string>;
}

// Use type aliases for unions, intersections, utilities
export type ParseResult<T> = 
  | { success: true; data: T }
  | { success: false; error: Error };

export type DeploymentStatus = 
  | 'pending'
  | 'in_progress'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

// Use enums for known constants
export enum MetadataType {
  ApexClass = 'ApexClass',
  ApexTrigger = 'ApexTrigger',
  Flow = 'Flow',
  LWC = 'LightningComponentBundle',
}

// Use const assertions for immutable objects
export const SALESFORCE_LIMITS = {
  MAX_COMPONENTS_PER_WAVE: 300,
  MAX_CMT_RECORDS_PER_WAVE: 200,
  MAX_FILES_PER_DEPLOYMENT: 500,
} as const;

// Use readonly for immutability
export interface DependencyNode {
  readonly id: string;
  readonly dependencies: ReadonlySet<string>;
  readonly depth: number;
}
```

---

## 🔮 Functional Programming

### Pure Functions

```typescript
// ✅ GOOD: Pure function
export const add = (a: number, b: number): number => a + b;

export const filterByType = (type: MetadataType) =>
  (components: Component[]): Component[] =>
    components.filter(c => c.type === type);

// ❌ BAD: Side effects
let counter = 0;
export const incrementAndAdd = (a: number, b: number): number => {
  counter++; // Side effect!
  console.log('Adding...'); // Side effect!
  return a + b;
};
```

### Immutability

```typescript
// ✅ GOOD: Immutable operations
const addComponent = (
  components: Component[],
  newComponent: Component
): Component[] => [...components, newComponent];

const updateComponent = (
  component: Component,
  updates: Partial<Component>
): Component => ({ ...component, ...updates });

const removeComponent = (
  components: Component[],
  id: string
): Component[] => components.filter(c => c.id !== id);

// ❌ BAD: Mutations
const addComponent = (
  components: Component[],
  newComponent: Component
): void => {
  components.push(newComponent); // Mutation!
};

const updateComponent = (component: Component, name: string): void => {
  component.name = name; // Mutation!
};
```

### Function Composition

```typescript
// ✅ GOOD: Composable functions
import { pipe, compose } from './utils/functional.js';

// Pipe: left-to-right
export const processMetadata = pipe(
  scanProjectFiles,
  parseComponents,
  filterValidComponents,
  extractDependencies,
  buildDependencyGraph
);

// Compose: right-to-left
export const deploymentPipeline = compose(
  generateManifests,
  splitIntoWaves,
  resolveDependencies,
  analyzeComponents
);

// Higher-order functions
export const withRetry = <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): (() => Promise<T>) => {
  return async () => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await sleep(Math.pow(2, i) * 1000);
      }
    }
    throw new Error('Unreachable');
  };
};

// Currying
export const filterByPredicate = <T>(
  predicate: (item: T) => boolean
) => (items: T[]): T[] => items.filter(predicate);

const isApexClass = (c: Component) => c.type === MetadataType.ApexClass;
const getApexClasses = filterByPredicate(isApexClass);
```

---

## 🏗️ Architecture Patterns

### Layered Architecture

```
Commands (CLI Interface)
    ↓
Core (Business Logic)
    ↓
Services (Operations)
    ↓
Parsers (Metadata Analysis)
    ↓
Utils (Helpers)
```

#### Layer Rules

1. **Downward dependencies only**: Upper layers depend on lower layers
2. **No circular dependencies**: Between any layers
3. **Single responsibility**: Each layer has one purpose
4. **Interface segregation**: Use interfaces between layers

```typescript
// ✅ GOOD: Command depends on Core
// commands/smart-deployment/start.ts
import { DeploymentOrchestrator } from '../../core/orchestrator.js';

export default class Start extends SfCommand {
  async run(): Promise<void> {
    const orchestrator = new DeploymentOrchestrator();
    await orchestrator.execute();
  }
}

// ✅ GOOD: Core depends on Services
// core/orchestrator.ts
import { MetadataScanner } from '../services/metadata-scanner.js';
import { DependencyResolver } from '../services/dependency-resolver.js';

export class DeploymentOrchestrator {
  async execute(): Promise<DeployResult> {
    const components = await MetadataScanner.scan();
    const graph = await DependencyResolver.resolve(components);
    // ...
  }
}

// ❌ BAD: Service depends on Core (upward dependency)
// services/metadata-scanner.ts
import { DeploymentOrchestrator } from '../core/orchestrator.js'; // BAD!
```

### Dependency Injection

```typescript
// ✅ GOOD: Constructor injection
export class DeploymentOrchestrator {
  constructor(
    private readonly scanner: IMetadataScanner,
    private readonly resolver: IDependencyResolver,
    private readonly generator: IWaveGenerator
  ) {}
  
  async execute(): Promise<DeployResult> {
    const components = await this.scanner.scan();
    const graph = await this.resolver.resolve(components);
    const waves = await this.generator.generate(graph);
    return { waves };
  }
}

// Usage with dependency injection
const orchestrator = new DeploymentOrchestrator(
  new MetadataScanner(),
  new DependencyResolver(),
  new WaveGenerator()
);

// ❌ BAD: Hard-coded dependencies
export class DeploymentOrchestrator {
  async execute(): Promise<DeployResult> {
    const scanner = new MetadataScanner(); // Hard-coded!
    const resolver = new DependencyResolver(); // Hard-coded!
    // ...
  }
}
```

### Repository Pattern

```typescript
// ✅ GOOD: Repository abstraction
export interface IComponentRepository {
  findAll(): Promise<Component[]>;
  findById(id: string): Promise<Component | null>;
  findByType(type: MetadataType): Promise<Component[]>;
  save(component: Component): Promise<void>;
}

export class FileSystemComponentRepository implements IComponentRepository {
  async findAll(): Promise<Component[]> {
    // Implementation
  }
  
  async findById(id: string): Promise<Component | null> {
    // Implementation
  }
}

export class CachedComponentRepository implements IComponentRepository {
  constructor(
    private readonly innerRepo: IComponentRepository,
    private readonly cache: ICache
  ) {}
  
  async findById(id: string): Promise<Component | null> {
    const cached = await this.cache.get(id);
    if (cached) return cached;
    
    const component = await this.innerRepo.findById(id);
    if (component) await this.cache.set(id, component);
    return component;
  }
}
```

---

## ⚠️ Error Handling

### Custom Error Classes

```typescript
// utils/errors.ts
export class SmartDeploymentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ParseError extends SmartDeploymentError {
  constructor(options: {
    file: string;
    line?: number;
    column?: number;
    originalError?: Error;
  }) {
    super(
      `Failed to parse file: ${options.file}${
        options.line ? ` at line ${options.line}` : ''
      }`,
      'PARSE_ERROR',
      options
    );
  }
}

export class DependencyError extends SmartDeploymentError {
  constructor(message: string, public readonly cycle?: string[]) {
    super(message, 'DEPENDENCY_ERROR', { cycle });
  }
}
```

### Error Handling Patterns

#### Pattern 1: Try-Catch with Context

```typescript
export async function parseApexClass(
  filePath: string
): Promise<ParseResult<ApexClass>> {
  try {
    const content = await readFile(filePath);
    const ast = parseContent(content);
    return { success: true, data: extractMetadata(ast) };
  } catch (error) {
    throw new ParseError({
      file: filePath,
      originalError: error as Error,
    });
  }
}
```

#### Pattern 2: Result Type

```typescript
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export async function parseApexClass(
  filePath: string
): Promise<Result<ApexClass, ParseError>> {
  try {
    const content = await readFile(filePath);
    const data = parse(content);
    return { ok: true, value: data };
  } catch (error) {
    return {
      ok: false,
      error: new ParseError({ file: filePath, originalError: error as Error }),
    };
  }
}

// Usage
const result = await parseApexClass('MyClass.cls');
if (result.ok) {
  console.log(result.value.name);
} else {
  console.error(result.error.message);
}
```

#### Pattern 3: Fallback Chain

```typescript
export async function analyzeWithAI(
  components: Component[]
): Promise<AnalysisResult> {
  try {
    return await agentforceService.analyze(components);
  } catch (error) {
    logger.warn('AI analysis failed, falling back to static analysis');
    return await staticAnalysis(components);
  }
}
```

#### Pattern 4: Retry with Exponential Backoff

```typescript
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
  } = {}
): Promise<T> {
  const { maxRetries = 3, initialDelay = 1000, maxDelay = 30000 } = options;
  
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        const delay = Math.min(
          initialDelay * Math.pow(2, attempt),
          maxDelay
        );
        await sleep(delay);
      }
    }
  }
  
  throw lastError!;
}
```

#### Pattern 5: Circuit Breaker

```typescript
export class CircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailTime < this.timeout) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
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
  
  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}
```

---

## 🧪 Testing Standards

### Test Structure (AAA Pattern)

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('ApexParser', () => {
  let parser: ApexParser;
  
  beforeEach(() => {
    parser = new ApexParser();
  });
  
  describe('parseClass()', () => {
    it('should extract class name', () => {
      // Arrange
      const content = 'public class MyClass {}';
      
      // Act
      const result = parser.parseClass(content);
      
      // Assert
      expect(result.name).toBe('MyClass');
    });
    
    it('should extract extends relationship', () => {
      // Arrange
      const content = 'public class MyClass extends BaseClass {}';
      
      // Act
      const result = parser.parseClass(content);
      
      // Assert
      expect(result.dependencies).toContain('BaseClass');
    });
  });
});
```

### Test Naming

```typescript
// ✅ GOOD: Descriptive test names
it('should return empty array when no components found', () => {});
it('should throw ParseError when file is corrupted', () => {});
it('should cache result after first call', () => {});

// ❌ BAD: Vague test names
it('works', () => {});
it('test1', () => {});
it('should parse', () => {}); // Parse what? How?
```

### Mocking

```typescript
// ✅ GOOD: Mock external dependencies
import { jest } from '@jest/globals';

describe('DeploymentOrchestrator', () => {
  it('should call scanner.scan()', async () => {
    // Arrange
    const mockScanner = {
      scan: jest.fn().mockResolvedValue([]),
    };
    const orchestrator = new DeploymentOrchestrator(mockScanner);
    
    // Act
    await orchestrator.execute();
    
    // Assert
    expect(mockScanner.scan).toHaveBeenCalledTimes(1);
  });
});
```

---

## ⚡ Performance Guidelines

### Lazy Loading

```typescript
// ✅ GOOD: Lazy load heavy dependencies
export class ApexParser {
  private compiler?: ApexCompiler;
  
  private getCompiler(): ApexCompiler {
    if (!this.compiler) {
      this.compiler = new ApexCompiler();
    }
    return this.compiler;
  }
}
```

### Caching

```typescript
// ✅ GOOD: Memoize expensive operations
import { memoize } from '../utils/functional.js';

export const parseApexClass = memoize(
  (filePath: string, content: string) => {
    // Expensive parsing logic
  }
);
```

### Streaming for Large Files

```typescript
// ✅ GOOD: Stream large files
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

export async function* readLargeFile(
  filePath: string
): AsyncGenerator<string> {
  const fileStream = createReadStream(filePath);
  const rl = createInterface({ input: fileStream });
  
  for await (const line of rl) {
    yield line;
  }
}
```

---

## 🔒 Security Standards

### Input Validation

```typescript
// ✅ GOOD: Validate all inputs
export function parseApexClass(filePath: string, content: string): ApexClass {
  if (!filePath) {
    throw new ValidationError('filePath is required');
  }
  
  if (!content || content.trim().length === 0) {
    throw new ValidationError('content cannot be empty');
  }
  
  // Validate file extension
  if (!filePath.endsWith('.cls')) {
    throw new ValidationError('filePath must end with .cls');
  }
  
  // Implementation
}
```

### Avoid Code Injection

```typescript
// ❌ BAD: eval() is dangerous
const result = eval(userInput); // NEVER DO THIS

// ✅ GOOD: Use safe parsing
const result = JSON.parse(userInput);
```

### Sanitize XML

```typescript
// ✅ GOOD: Use XML parser with external entity protection
import { parseXml } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  allowBooleanAttributes: true,
  // Protect against XXE attacks
  processEntities: false,
});
```

---

## 📏 Code Metrics

### Function Complexity

- **Max lines per function**: 50
- **Max cyclomatic complexity**: 10
- **Max parameters**: 3 (use options object if more)

```typescript
// ✅ GOOD: Simple, focused function
export function calculateDepth(
  node: DependencyNode,
  graph: DependencyGraph
): number {
  if (node.dependencies.size === 0) return 0;
  
  const depths = Array.from(node.dependencies).map(depId => {
    const depNode = graph.get(depId);
    return depNode ? calculateDepth(depNode, graph) : 0;
  });
  
  return Math.max(...depths) + 1;
}

// ❌ BAD: Too many parameters
export function deployWave(
  wave: Wave,
  targetOrg: string,
  testLevel: string,
  timeout: number,
  retries: number,
  skipTests: boolean
) {
  // Too many parameters!
}

// ✅ GOOD: Use options object
export function deployWave(
  wave: Wave,
  options: DeploymentOptions
) {
  // Clean!
}
```

---

## 📚 Additional Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Functional Programming Principles](https://github.com/getify/Functional-Light-JS)
- [Clean Code JavaScript](https://github.com/ryanmcdermott/clean-code-javascript)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)

---

**Version**: 1.0.0  
**Last Updated**: December 1, 2025

