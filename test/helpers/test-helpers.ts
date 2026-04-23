/**
 * Test Helper Utilities - US-061
 * Provides common test utilities, mocks, and fixtures
 *
 * @ac US-061-AC-1: Test utilities and helpers
 * @ac US-061-AC-2: Mock data generators
 * @ac US-061-AC-3: Assertion helpers
 * @issue #61
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { MetadataComponent, MetadataType } from '../../src/types/metadata.js';
import type { DependencyGraph } from '../../src/types/dependency.js';
import type { Wave } from '../../src/waves/wave-builder.js';

/**
 * @ac US-061-AC-2: Mock data generators
 * Create mock metadata component
 */
export function createMockComponent(overrides?: Partial<MetadataComponent>): MetadataComponent {
  const defaults: MetadataComponent = {
    name: 'MockComponent',
    type: 'ApexClass' as MetadataType,
    filePath: '/mock/path/MockComponent.cls',
    dependencies: new Set(),
    dependents: new Set(),
    priorityBoost: 0,
  };

  return {
    ...defaults,
    ...overrides,
    dependencies: overrides?.dependencies ?? defaults.dependencies,
    dependents: overrides?.dependents ?? defaults.dependents,
  };
}

/**
 * @ac US-061-AC-2: Mock data generators
 * Create mock dependency graph
 */
export function createMockGraph(components: MetadataComponent[]): DependencyGraph {
  const graph = new Map<string, Set<string>>();

  for (const component of components) {
    graph.set(component.name, component.dependencies);
  }

  return graph;
}

/**
 * @ac US-061-AC-2: Mock data generators
 * Create mock wave
 */
export function createMockWave(number: number, componentCount: number): Wave {
  const components: string[] = [];
  for (let i = 0; i < componentCount; i++) {
    components.push(`Component${number}_${i}`);
  }

  return {
    number,
    components,
    metadata: {
      componentCount,
      types: ['ApexClass' as MetadataType],
      maxDepth: 0,
      hasCircularDeps: false,
      estimatedTime: componentCount * 0.5,
    },
  };
}

/**
 * @ac US-061-AC-3: Assertion helpers
 * Assert that all items in array are unique
 */
export function assertUnique<T>(items: T[], message?: string): void {
  const seen = new Set<T>();
  const duplicates: T[] = [];

  for (const item of items) {
    if (seen.has(item)) {
      duplicates.push(item);
    }
    seen.add(item);
  }

  if (duplicates.length > 0) {
    throw new Error(message ?? `Expected all items to be unique, but found duplicates: ${JSON.stringify(duplicates)}`);
  }
}

/**
 * @ac US-061-AC-3: Assertion helpers
 * Assert that array is sorted
 */
export function assertSorted<T>(items: T[], compareFn?: (a: T, b: T) => number, message?: string): void {
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const curr = items[i];
    const comparison = compareFn ? compareFn(prev, curr) : (prev as unknown as number) - (curr as unknown as number);

    if (comparison > 0) {
      throw new Error(message ?? `Expected array to be sorted, but items at index ${i - 1} and ${i} are out of order`);
    }
  }
}

/**
 * @ac US-061-AC-3: Assertion helpers
 * Assert that dependency graph is acyclic
 */
export function assertAcyclic(graph: DependencyGraph): void {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(node: string): boolean {
    if (recursionStack.has(node)) {
      return true;
    }

    if (visited.has(node)) {
      return false;
    }

    visited.add(node);
    recursionStack.add(node);

    const dependencies = graph.get(node);
    if (dependencies) {
      for (const dep of dependencies) {
        if (hasCycle(dep)) {
          return true;
        }
      }
    }

    recursionStack.delete(node);
    return false;
  }

  for (const node of graph.keys()) {
    if (hasCycle(node)) {
      throw new Error(`Graph contains cycle involving node: ${node}`);
    }
  }
}

/**
 * @ac US-061-AC-1: Test utilities
 * Wait for condition to be true (polling)
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options?: {
    timeout?: number;
    interval?: number;
    message?: string;
  }
): Promise<void> {
  const timeout = options?.timeout ?? 5000;
  const interval = options?.interval ?? 100;
  const message = options?.message ?? 'Condition not met within timeout';
  const deadline = Date.now() + timeout;

  const poll = async (): Promise<void> => {
    if (await Promise.resolve(condition())) {
      return;
    }

    if (Date.now() >= deadline) {
      throw new Error(message);
    }

    await new Promise((resolve) => {
      setTimeout(resolve, interval);
    });
    await poll();
  };

  await poll();
}

/**
 * @ac US-061-AC-1: Test utilities
 * Measure execution time of a function
 */
export async function measureTime<T>(fn: () => T | Promise<T>): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await Promise.resolve(fn());
  const duration = Date.now() - start;

  return { result, duration };
}

/**
 * @ac US-061-AC-1: Test utilities
 * Create temporary test directory
 */
export function createTempDir(prefix = 'test-'): string {
  const tempDir = path.join(os.tmpdir(), `${prefix}${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(tempDir, { recursive: true });

  return tempDir;
}

/**
 * @ac US-061-AC-1: Test utilities
 * Clean up temporary directory
 */
export function cleanupTempDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * @ac US-061-AC-2: Mock data generators
 * Create mock file system structure
 */
export function createMockFS(structure: Record<string, string>): Map<string, string> {
  const mockFS = new Map<string, string>();

  for (const [filePath, content] of Object.entries(structure)) {
    mockFS.set(filePath, content);
  }

  return mockFS;
}

/**
 * @ac US-061-AC-3: Assertion helpers
 * Assert that execution time is within bounds
 */
export function assertPerformance<T>(fn: () => T | Promise<T>, maxDuration: number, message?: string): Promise<T> {
  return measureTime(fn).then(({ result, duration }) => {
    if (duration > maxDuration) {
      throw new Error(message ?? `Expected execution to take less than ${maxDuration}ms, but took ${duration}ms`);
    }
    return result;
  });
}

/**
 * @ac US-061-AC-1: Test utilities
 * Suppress console output during test
 */
export function suppressConsole<T>(fn: () => T): T {
  const runtimeConsole = globalThis['console'];
  const originalLog = runtimeConsole.log.bind(runtimeConsole);
  const originalWarn = runtimeConsole.warn.bind(runtimeConsole);
  const originalError = runtimeConsole.error.bind(runtimeConsole);

  runtimeConsole.log = () => {};
  runtimeConsole.warn = () => {};
  runtimeConsole.error = () => {};

  try {
    return fn();
  } finally {
    runtimeConsole.log = originalLog;
    runtimeConsole.warn = originalWarn;
    runtimeConsole.error = originalError;
  }
}

/**
 * @ac US-061-AC-2: Mock data generators
 * Generate random metadata components
 */
export function generateRandomComponents(
  count: number,
  options?: {
    types?: MetadataType[];
    withDependencies?: boolean;
  }
): MetadataComponent[] {
  const types = options?.types ?? ['ApexClass' as MetadataType];
  const components: MetadataComponent[] = [];

  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    const component = createMockComponent({
      name: `Component${i}`,
      type,
      filePath: `/path/to/Component${i}`,
    });

    // Add random dependencies
    if (options?.withDependencies && i > 0) {
      const depCount = Math.floor(Math.random() * Math.min(3, i));
      for (let j = 0; j < depCount; j++) {
        const depIndex = Math.floor(Math.random() * i);
        component.dependencies.add(`Component${depIndex}`);
      }
    }

    components.push(component);
  }

  return components;
}
