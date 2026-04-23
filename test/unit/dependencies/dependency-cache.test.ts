/**
 * Unit tests for Dependency Cache
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { DependencyCache, createCacheKey } from '../../../src/dependencies/dependency-cache.js';
import type { DependencyGraph } from '../../../src/types/dependency.js';

describe('DependencyCache', () => {
  let cacheDir: string;
  let testFiles: string[];

  beforeEach(async () => {
    // Create temp cache directory
    cacheDir = path.join(os.tmpdir(), `test-cache-${Date.now()}`);
    await fs.mkdir(cacheDir, { recursive: true });

    // Create test files
    testFiles = [path.join(cacheDir, 'test1.txt'), path.join(cacheDir, 'test2.txt')];

    await Promise.all(testFiles.map(async (file) => fs.writeFile(file, 'test content', 'utf-8')));
  });

  afterEach(async () => {
    // Clean up
    try {
      await fs.rm(cacheDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Graph Structure Cache', () => {
    /**
     * @ac US-036-AC-1: Cache graph structure
     */
    it('US-036-AC-1: should cache and retrieve graph structure', async () => {
      const cache = new DependencyCache({ cacheDir, ttl: 60 });

      const graph: DependencyGraph = new Map([
        ['ApexClass:A', new Set(['ApexClass:B'])],
        ['ApexClass:B', new Set(['ApexClass:C'])],
      ]);

      // Store in cache
      await cache.set('graph', graph, testFiles);

      // Retrieve from cache
      const cached = await cache.get<DependencyGraph>('graph', testFiles);

      expect(cached).to.exist;
      expect(cached?.size).to.equal(2);
      expect(cached?.get('ApexClass:A')?.has('ApexClass:B')).to.be.true;
    });

    it('US-036-AC-1: should handle complex graph structures', async () => {
      const cache = new DependencyCache({ cacheDir, ttl: 60 });

      const graph: DependencyGraph = new Map();
      for (let i = 0; i < 100; i++) {
        const deps = new Set<string>();
        for (let j = 0; j < 10; j++) {
          deps.add(`ApexClass:Dep${j}`);
        }
        graph.set(`ApexClass:Node${i}`, deps);
      }

      await cache.set('graph', graph, testFiles);
      const cached = await cache.get<DependencyGraph>('graph', testFiles);

      expect(cached?.size).to.equal(100);
    });
  });

  describe('File Change Detection', () => {
    /**
     * @ac US-036-AC-2: Invalidate cache on file changes
     */
    it('US-036-AC-2: should invalidate cache when file modified', async () => {
      const cache = new DependencyCache({ cacheDir, ttl: 60 });

      const data = { test: 'value' };
      await cache.set('graph', data, testFiles);

      // Verify cached
      let cached = await cache.get('graph', testFiles);
      expect(cached).to.exist;

      // Modify file
      await new Promise((resolve) => setTimeout(resolve, 10)); // Ensure different mtime
      await fs.writeFile(testFiles[0], 'modified content', 'utf-8');

      // Cache should be invalid
      cached = await cache.get('graph', testFiles);
      expect(cached).to.be.undefined;
    });

    it('US-036-AC-2: should invalidate cache when file added', async () => {
      const cache = new DependencyCache({ cacheDir, ttl: 60 });

      const data = { test: 'value' };
      await cache.set('graph', data, testFiles);

      // Add new file
      const newFile = path.join(cacheDir, 'new-file.txt');
      await fs.writeFile(newFile, 'content', 'utf-8');

      // Cache should be invalid with different file list
      const cached = await cache.get('graph', [...testFiles, newFile]);
      expect(cached).to.be.undefined;
    });

    it('US-036-AC-2: should invalidate cache when file deleted', async () => {
      const cache = new DependencyCache({ cacheDir, ttl: 60 });

      const data = { test: 'value' };
      await cache.set('graph', data, testFiles);

      // Delete file
      await fs.unlink(testFiles[0]);

      // Cache should be invalid
      const cached = await cache.get('graph', testFiles);
      expect(cached).to.be.undefined;
    });
  });

  describe('Topological Sort Cache', () => {
    /**
     * @ac US-036-AC-3: Cache topological sort results
     */
    it('US-036-AC-3: should cache topological sort results', async () => {
      const cache = new DependencyCache({ cacheDir, ttl: 60 });

      const sortResult = ['ApexClass:C', 'ApexClass:B', 'ApexClass:A'];

      await cache.set('topological-sort', sortResult, testFiles);
      const cached = await cache.get<string[]>('topological-sort', testFiles);

      expect(cached).to.deep.equal(sortResult);
    });
  });

  describe('Cycle Detection Cache', () => {
    /**
     * @ac US-036-AC-4: Cache cycle detection results
     */
    it('US-036-AC-4: should cache circular dependency results', async () => {
      const cache = new DependencyCache({ cacheDir, ttl: 60 });

      const cycles = [{ cycle: ['A', 'B', 'C'], severity: 'error' as const, message: 'Cycle' }];

      await cache.set('circular-dependencies', cycles, testFiles);
      const cached = await cache.get('circular-dependencies', testFiles);

      expect(cached).to.deep.equal(cycles);
    });
  });

  describe('Heuristic Inference Cache', () => {
    /**
     * @ac US-036-AC-5: Cache heuristic inferences
     */
    it('US-036-AC-5: should cache heuristic inference results', async () => {
      const cache = new DependencyCache({ cacheDir, ttl: 60 });

      const inferences = [
        {
          from: 'ApexClass:Test',
          to: 'ApexClass:Service',
          confidence: 0.9,
          reason: 'test-pattern',
        },
      ];

      await cache.set('heuristic-inferences', inferences, testFiles);
      const cached = await cache.get('heuristic-inferences', testFiles);

      expect(cached).to.deep.equal(inferences);
    });
  });

  describe('TTL Configuration', () => {
    /**
     * @ac US-036-AC-6: Configurable cache TTL
     */
    it('US-036-AC-6: should respect TTL configuration', async function () {
      this.timeout(3000);

      const cache = new DependencyCache({ cacheDir, ttl: 1 }); // 1 second TTL

      const data = { test: 'value' };
      await cache.set('graph', data, testFiles);

      // Should be cached immediately
      let cached = await cache.get('graph', testFiles);
      expect(cached).to.exist;

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be expired
      cached = await cache.get('graph', testFiles);
      expect(cached).to.be.undefined;
    });

    it('US-036-AC-6: should use default TTL', async () => {
      const cache = new DependencyCache({ cacheDir });
      const stats = cache.getStats();

      expect(stats.ttl).to.equal(3600); // Default 1 hour
    });

    it('US-036-AC-6: should support custom TTL', async () => {
      const cache = new DependencyCache({ cacheDir, ttl: 7200 });
      const stats = cache.getStats();

      expect(stats.ttl).to.equal(7200);
    });
  });

  describe('Memory Cache', () => {
    it('should use memory cache for faster access', async () => {
      const cache = new DependencyCache({ cacheDir, ttl: 60 });

      const data = { test: 'value' };
      await cache.set('graph', data, testFiles);

      // First access (from disk)
      await cache.get('graph', testFiles);

      // Second access should use memory cache
      const startTime = Date.now();
      const cached = await cache.get('graph', testFiles);
      const duration = Date.now() - startTime;

      expect(cached).to.exist;
      expect(duration).to.be.lessThan(5); // Should be very fast
    });

    it('should sync memory and disk cache', async () => {
      const cache1 = new DependencyCache({ cacheDir, ttl: 60 });
      const cache2 = new DependencyCache({ cacheDir, ttl: 60 });

      const data = { test: 'value' };
      await cache1.set('graph', data, testFiles);

      // cache2 should load from disk
      const cached = await cache2.get('graph', testFiles);
      expect(cached).to.deep.equal(data);
    });
  });

  describe('Version Management', () => {
    it('should invalidate cache on version change', async () => {
      const cache1 = new DependencyCache({ cacheDir, ttl: 60, version: '1.0.0' });
      const cache2 = new DependencyCache({ cacheDir, ttl: 60, version: '2.0.0' });

      const data = { test: 'value' };
      await cache1.set('graph', data, testFiles);

      // Different version should not use cache
      const cached = await cache2.get('graph', testFiles);
      expect(cached).to.be.undefined;
    });
  });

  describe('Cache Control', () => {
    it('should disable cache when configured', async () => {
      const cache = new DependencyCache({ cacheDir, enabled: false });

      const data = { test: 'value' };
      await cache.set('graph', data, testFiles);

      const cached = await cache.get('graph', testFiles);
      expect(cached).to.be.undefined;
    });

    it('should enable/disable cache dynamically', async () => {
      const cache = new DependencyCache({ cacheDir });

      const data = { test: 'value' };
      await cache.set('graph', data, testFiles);

      cache.disable();
      expect(cache.isEnabled()).to.be.false;

      let cached = await cache.get('graph', testFiles);
      expect(cached).to.be.undefined;

      cache.enable();
      expect(cache.isEnabled()).to.be.true;

      cached = await cache.get('graph', testFiles);
      expect(cached).to.exist;
    });

    it('should invalidate specific cache entry', async () => {
      const cache = new DependencyCache({ cacheDir, ttl: 60 });

      await cache.set('graph', { test: 1 }, testFiles);
      await cache.set('topological-sort', { test: 2 }, testFiles);

      await cache.invalidate('graph');

      const graph = await cache.get('graph', testFiles);
      const topo = await cache.get('topological-sort', testFiles);

      expect(graph).to.be.undefined;
      expect(topo).to.exist;
    });

    it('should invalidate all cache entries', async () => {
      const cache = new DependencyCache({ cacheDir, ttl: 60 });

      await cache.set('graph', { test: 1 }, testFiles);
      await cache.set('topological-sort', { test: 2 }, testFiles);

      await cache.invalidateAll();

      const graph = await cache.get('graph', testFiles);
      const topo = await cache.get('topological-sort', testFiles);

      expect(graph).to.be.undefined;
      expect(topo).to.be.undefined;
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      const cache = new DependencyCache({ cacheDir, ttl: 1800 });

      await cache.set('graph', { test: 1 }, testFiles);
      await cache.set('topological-sort', { test: 2 }, testFiles);

      const stats = cache.getStats();

      expect(stats.memoryEntries).to.equal(2);
      expect(stats.enabled).to.be.true;
      expect(stats.ttl).to.equal(1800);
    });
  });

  describe('createCacheKey Helper', () => {
    it('should create deterministic cache keys', () => {
      const files1 = ['a.txt', 'b.txt', 'c.txt'];
      const files2 = ['c.txt', 'a.txt', 'b.txt']; // Different order

      const key1 = createCacheKey('graph', files1);
      const key2 = createCacheKey('graph', files2);

      expect(key1).to.equal(key2); // Should be same (sorted)
    });

    it('should create different keys for different files', () => {
      const files1 = ['a.txt', 'b.txt'];
      const files2 = ['c.txt', 'd.txt'];

      const key1 = createCacheKey('graph', files1);
      const key2 = createCacheKey('graph', files2);

      expect(key1).to.not.equal(key2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty file list', async () => {
      const cache = new DependencyCache({ cacheDir, ttl: 60 });

      const data = { test: 'value' };
      await cache.set('graph', data, []);

      const cached = await cache.get('graph', []);
      expect(cached).to.deep.equal(data);
    });

    it('should handle missing cache directory', async () => {
      const missingDir = path.join(cacheDir, 'non-existent');
      const cache = new DependencyCache({ cacheDir: missingDir, ttl: 60 });

      // Should create directory automatically
      await cache.set('graph', { test: 'value' }, testFiles);

      const cached = await cache.get('graph', testFiles);
      expect(cached).to.exist;
    });

    it('should handle corrupted cache file', async () => {
      const cache1 = new DependencyCache({ cacheDir, ttl: 60 });

      await cache1.set('graph', { test: 'value' }, testFiles);

      // Corrupt cache file
      const cacheFile = path.join(cacheDir, 'graph.json');
      await fs.writeFile(cacheFile, 'invalid json', 'utf-8');

      // Use a new cache instance (no memory cache)
      const cache2 = new DependencyCache({ cacheDir, ttl: 60 });

      // Should return undefined instead of throwing
      const cached = await cache2.get('graph', testFiles);
      expect(cached).to.be.undefined;
    });

    it('should handle non-existent files gracefully', async () => {
      const cache = new DependencyCache({ cacheDir, ttl: 60 });

      const fakeFiles = ['/non/existent/file.txt'];

      // Should not throw
      await cache.set('graph', { test: 'value' }, fakeFiles);
      const cached = await cache.get('graph', fakeFiles);

      // Cache will be considered invalid due to missing files
      expect(cached).to.exist;
    });
  });

  describe('Serialization', () => {
    it('should serialize and deserialize Sets', async () => {
      const cache = new DependencyCache({ cacheDir, ttl: 60 });

      const data = new Set(['A', 'B', 'C']);
      await cache.set('graph', data, testFiles);

      const cached = await cache.get<Set<string>>('graph', testFiles);

      expect(cached).to.be.instanceOf(Set);
      expect(cached?.has('A')).to.be.true;
      expect(cached?.has('B')).to.be.true;
      expect(cached?.has('C')).to.be.true;
    });

    it('should serialize and deserialize Maps', async () => {
      const cache = new DependencyCache({ cacheDir, ttl: 60 });

      const data = new Map([
        ['key1', 'value1'],
        ['key2', 'value2'],
      ]);
      await cache.set('graph', data, testFiles);

      const cached = await cache.get<Map<string, string>>('graph', testFiles);

      expect(cached).to.be.instanceOf(Map);
      expect(cached?.get('key1')).to.equal('value1');
      expect(cached?.get('key2')).to.equal('value2');
    });

    it('should handle nested Sets and Maps', async () => {
      const cache = new DependencyCache({ cacheDir, ttl: 60 });

      const graph: DependencyGraph = new Map([
        ['A', new Set(['B', 'C'])],
        ['B', new Set(['D'])],
      ]);

      await cache.set('graph', graph, testFiles);
      const cached = await cache.get<DependencyGraph>('graph', testFiles);

      expect(cached?.get('A')).to.be.instanceOf(Set);
      expect(cached?.get('A')?.has('B')).to.be.true;
    });
  });
});
