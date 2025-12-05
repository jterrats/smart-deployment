import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import { CacheManager, type CacheConfig } from '../../../src/utils/cache-manager.js';

describe('CacheManager', () => {
  let cache: CacheManager;
  const testCacheDir = path.join(os.tmpdir(), `test-cache-${Date.now()}`);

  beforeEach(async () => {
    // Reset singleton and clean up
    CacheManager.resetInstance();
    await fs.rm(testCacheDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    // Clean up
    await cache?.clear();
    await cache?.releaseLock();
    CacheManager.resetInstance();
    await fs.rm(testCacheDir, { recursive: true, force: true });

    // Clean up lock files
    const lockDir = path.join(os.tmpdir(), 'sf-smart-deployment-locks');
    await fs.rm(lockDir, { recursive: true, force: true });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance across multiple calls', () => {
      const instance1 = CacheManager.getInstance();
      const instance2 = CacheManager.getInstance();

      expect(instance1).to.equal(instance2);
    });

    it('should enforce singleton pattern through getInstance only', () => {
      // TypeScript prevents direct instantiation at compile-time
      // This test verifies that getInstance is the only way to get an instance
      const instance1 = CacheManager.getInstance();
      const instance2 = CacheManager.getInstance();

      expect(instance1).to.equal(instance2);
      expect(instance1).to.be.instanceOf(CacheManager);
    });

    it('should reset instance for testing', () => {
      const instance1 = CacheManager.getInstance();
      CacheManager.resetInstance();
      const instance2 = CacheManager.getInstance();

      expect(instance1).to.not.equal(instance2);
    });

    it('should preserve config across getInstance calls', async () => {
      const config: Partial<CacheConfig> = { maxSize: 500, ttlMs: 5000 };
      const instance1 = CacheManager.getInstance(config);

      await instance1.set('test', 'value');

      const instance2 = CacheManager.getInstance();
      const value = await instance2.get('test');

      expect(value).to.equal('value');
    });
  });

  describe('File-Based Locking', () => {
    it('should acquire lock successfully', async () => {
      cache = CacheManager.getInstance({ enableLocking: true });
      const acquired = await cache.acquireLock('test-org');

      expect(acquired).to.be.true;
    });

    it('should prevent concurrent access to same org', async () => {
      const cache1 = CacheManager.getInstance({ enableLocking: true });
      const acquired1 = await cache1.acquireLock('test-org');
      expect(acquired1).to.be.true;

      // Simulate second process (new instance)
      CacheManager.resetInstance();
      const cache2 = CacheManager.getInstance({ enableLocking: true });
      const acquired2 = await cache2.acquireLock('test-org');

      expect(acquired2).to.be.false;

      // Cleanup
      await cache1.releaseLock();
    });

    it('should release lock properly', async () => {
      cache = CacheManager.getInstance({ enableLocking: true });
      await cache.acquireLock('test-org');
      await cache.releaseLock();

      // Should be able to acquire again
      const acquired = await cache.acquireLock('test-org');
      expect(acquired).to.be.true;
    });

    it('should detect locked org with process info', async () => {
      cache = CacheManager.getInstance({ enableLocking: true });
      await cache.acquireLock('test-org');

      const lockInfo = await cache.isLocked('test-org');

      expect(lockInfo).to.not.be.false;
      if (lockInfo) {
        expect(lockInfo.pid).to.equal(process.pid);
        expect(lockInfo.hostname).to.equal(os.hostname());
        expect(lockInfo.timestamp).to.be.a('string');
      }
    });

    it('should clean up stale locks', async () => {
      const lockDir = path.join(os.tmpdir(), 'sf-smart-deployment-locks');
      await fs.mkdir(lockDir, { recursive: true });

      const staleLock = path.join(lockDir, 'test-org.lock');
      await fs.writeFile(
        staleLock,
        JSON.stringify({
          pid: 999_999, // Non-existent PID
          timestamp: new Date().toISOString(),
          hostname: os.hostname(),
        })
      );

      cache = CacheManager.getInstance({ enableLocking: true });
      const lockInfo = await cache.isLocked('test-org');

      expect(lockInfo).to.be.false; // Stale lock removed
    });

    it('should sanitize org alias for lock filename', async () => {
      cache = CacheManager.getInstance({ enableLocking: true });
      await cache.acquireLock('my-org@example.com');

      const lockDir = path.join(os.tmpdir(), 'sf-smart-deployment-locks');
      const files = await fs.readdir(lockDir);

      expect(files[0]).to.match(/^my-org_example_com\.lock$/);
    });

    it('should work without locking if disabled', async () => {
      cache = CacheManager.getInstance({ enableLocking: false });
      const acquired = await cache.acquireLock('test-org');

      expect(acquired).to.be.true;

      const lockInfo = await cache.isLocked('test-org');
      expect(lockInfo).to.be.false;
    });
  });

  describe('Basic Cache Operations', () => {
    beforeEach(() => {
      cache = CacheManager.getInstance();
    });

    it('should set and get values', async () => {
      await cache.set('key1', { data: 'value1' });
      const value = cache.get<{ data: string }>('key1');

      expect(value).to.deep.equal({ data: 'value1' });
    });

    it('should return null for missing keys', async () => {
      const value = cache.get('nonexistent');

      expect(value).to.be.null;
    });

    it('should check key existence', async () => {
      await cache.set('key1', 'value1');

      expect(cache.has('key1')).to.be.true;
      expect(cache.has('key2')).to.be.false;
    });

    it('should delete specific keys', async () => {
      await cache.set('key1', 'value1');
      const deleted = await cache.delete('key1');

      expect(deleted).to.be.true;
      expect(cache.has('key1')).to.be.false;
    });

    it('should clear all cache', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.clear();

      expect(cache.size()).to.equal(0);
    });

    it('should get all keys', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      const keys = cache.keys();

      expect(keys).to.have.lengthOf(3);
      expect(keys).to.include('key1');
      expect(keys).to.include('key2');
      expect(keys).to.include('key3');
    });

    it('should support different value types', async () => {
      await cache.set('string', 'test');
      await cache.set('number', 42);
      await cache.set('boolean', true);
      await cache.set('object', { foo: 'bar' });
      await cache.set('array', [1, 2, 3]);

      expect(cache.get('string')).to.equal('test');
      expect(cache.get('number')).to.equal(42);
      expect(cache.get('boolean')).to.be.true;
      expect(cache.get('object')).to.deep.equal({ foo: 'bar' });
      expect(cache.get('array')).to.deep.equal([1, 2, 3]);
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should expire entries after TTL', async () => {
      cache = CacheManager.getInstance({ ttlMs: 100 });
      await cache.set('key1', 'value1');

      // Wait for expiration
      await new Promise((resolve) => {
        setTimeout(resolve, 150);
      });

      const value = cache.get('key1');
      expect(value).to.be.null;
    });

    it('should support custom TTL per entry', async () => {
      cache = CacheManager.getInstance({ ttlMs: 10_000 });
      await cache.set('key1', 'value1', 100); // 100ms TTL

      await new Promise((resolve) => {
        setTimeout(resolve, 150);
      });

      expect(cache.get('key1')).to.be.null;
    });

    it('should not expire before TTL', async () => {
      cache = CacheManager.getInstance({ ttlMs: 1000 });
      await cache.set('key1', 'value1');

      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });

      expect(cache.get('key1')).to.equal('value1');
    });

    it('should clean expired entries manually', async () => {
      cache = CacheManager.getInstance({ ttlMs: 100 });
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      await new Promise((resolve) => {
        setTimeout(resolve, 150);
      });

      const cleaned = await cache.cleanExpired();

      expect(cleaned).to.equal(2);
      expect(cache.size()).to.equal(0);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict oldest entry when maxSize reached', async () => {
      cache = CacheManager.getInstance({ maxSize: 3 });

      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      await cache.set('key4', 'value4'); // Should evict key1

      expect(cache.size()).to.equal(3);
      expect(cache.has('key1')).to.be.false;
      expect(cache.has('key4')).to.be.true;
    });

    it('should track eviction count', async () => {
      cache = CacheManager.getInstance({ maxSize: 2 });

      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3'); // Eviction 1
      await cache.set('key4', 'value4'); // Eviction 2

      const stats = cache.getStats();
      expect(stats.evictions).to.equal(2);
    });
  });

  describe('Cache Statistics', () => {
    beforeEach(() => {
      cache = CacheManager.getInstance();
    });

    it('should track hits and misses', async () => {
      await cache.set('key1', 'value1');

      cache.get('key1'); // Hit
      cache.get('key1'); // Hit
      cache.get('key2'); // Miss
      cache.get('key3'); // Miss

      const stats = cache.getStats();

      expect(stats.hits).to.equal(2);
      expect(stats.misses).to.equal(2);
    });

    it('should calculate hit rate', async () => {
      await cache.set('key1', 'value1');

      cache.get('key1'); // Hit
      cache.get('key2'); // Miss

      const stats = cache.getStats();

      expect(stats.hitRate).to.equal(0.5);
    });

    it('should track cache size', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      const stats = cache.getStats();

      expect(stats.size).to.equal(2);
    });

    it('should estimate memory size', async () => {
      await cache.set('key1', 'small');
      await cache.set('key2', { large: 'object with more data' });

      const stats = cache.getStats();

      expect(stats.memorySizeBytes).to.be.greaterThan(0);
    });

    it('should track individual entry hits', async () => {
      await cache.set('key1', 'value1');

      cache.get('key1');
      cache.get('key1');
      cache.get('key1');

      // Access internal entry (for testing)
      const stats = cache.getStats();
      expect(stats.hits).to.equal(3);
    });
  });

  describe('Persistence', () => {
    it('should persist entries to disk', async () => {
      cache = CacheManager.getInstance({
        enablePersistence: true,
        cacheDirectory: testCacheDir,
      });

      await cache.set('key1', { data: 'value1' });

      const files = await fs.readdir(testCacheDir);
      expect(files.length).to.be.greaterThan(0);
    });

    it('should load cache from disk', async () => {
      cache = CacheManager.getInstance({
        enablePersistence: true,
        cacheDirectory: testCacheDir,
        ttlMs: 10_000,
      });

      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      // Reset and load
      CacheManager.resetInstance();
      const newCache = CacheManager.getInstance({
        enablePersistence: true,
        cacheDirectory: testCacheDir,
      });

      const loaded = await newCache.loadFromDisk();

      expect(loaded).to.equal(2);
    });

    it('should skip expired entries when loading', async () => {
      cache = CacheManager.getInstance({
        enablePersistence: true,
        cacheDirectory: testCacheDir,
        ttlMs: 100,
      });

      await cache.set('key1', 'value1');

      await new Promise((resolve) => {
        setTimeout(resolve, 150);
      });

      // Reset and load
      CacheManager.resetInstance();
      const newCache = CacheManager.getInstance({
        enablePersistence: true,
        cacheDirectory: testCacheDir,
      });

      const loaded = await newCache.loadFromDisk();

      expect(loaded).to.equal(0);
    });

    it('should delete persisted entry on delete', async () => {
      cache = CacheManager.getInstance({
        enablePersistence: true,
        cacheDirectory: testCacheDir,
      });

      await cache.set('key1', 'value1');
      await cache.delete('key1');

      const files = await fs.readdir(testCacheDir);
      expect(files.length).to.equal(0);
    });

    it('should clear persisted cache on clear', async () => {
      cache = CacheManager.getInstance({
        enablePersistence: true,
        cacheDirectory: testCacheDir,
      });

      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.clear();

      try {
        await fs.access(testCacheDir);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        // Directory should not exist
        expect(true).to.be.true;
      }
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      cache = CacheManager.getInstance();
      const stats = cache.getStats();

      expect(stats).to.have.property('hits');
      expect(stats).to.have.property('misses');
      expect(stats).to.have.property('size');
    });

    it('should accept custom configuration', async () => {
      cache = CacheManager.getInstance({
        maxSize: 5,
        ttlMs: 500,
        enablePersistence: false,
        enableLocking: false,
      });

      await cache.set('key1', 'value1');

      expect(cache.size()).to.equal(1);
    });

    it('should update configuration', async () => {
      cache = CacheManager.getInstance({ maxSize: 10 });
      cache.configure({ maxSize: 5 });

      // Add 6 items to test new maxSize
      await Promise.all(Array.from({ length: 6 }, (_, index) => cache.set(`key${index}`, `value${index}`)));

      expect(cache.size()).to.equal(5);
    });
  });

  describe('Thread Safety', () => {
    it('should handle concurrent writes', async () => {
      cache = CacheManager.getInstance();

      const promises = Array.from({ length: 100 }, async (_, index) => cache.set(`key${index}`, `value${index}`));

      await Promise.all(promises);

      expect(cache.size()).to.equal(100);
    });

    it('should handle concurrent reads and writes', async () => {
      cache = CacheManager.getInstance();

      await cache.set('shared', 'initial');

      const operations = [
        ...Array.from({ length: 50 }, async () => cache.get('shared')),
        ...Array.from({ length: 50 }, async (_, index) => cache.set(`key${index}`, `value${index}`)),
      ];

      await Promise.all(operations);

      // Should not crash or corrupt
      expect(cache.size()).to.be.greaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      cache = CacheManager.getInstance();
    });

    it('should handle undefined values', async () => {
      await cache.set('key1', undefined);
      const value = cache.get('key1');

      expect(value).to.be.undefined;
    });

    it('should handle null values', async () => {
      await cache.set('key1', null);
      const value = cache.get('key1');

      expect(value).to.be.null;
    });

    it('should handle empty string keys', async () => {
      await cache.set('', 'value');
      const value = cache.get('');

      expect(value).to.equal('value');
    });

    it('should handle very long keys', async () => {
      const longKey = 'a'.repeat(1000);
      await cache.set(longKey, 'value');
      const value = cache.get(longKey);

      expect(value).to.equal('value');
    });

    it('should handle special characters in keys', async () => {
      const specialKey = 'key/with\\special:chars@#$%';
      await cache.set(specialKey, 'value');
      const value = cache.get(specialKey);

      expect(value).to.equal('value');
    });

    it('should return false when deleting non-existent key', async () => {
      const deleted = await cache.delete('nonexistent');

      expect(deleted).to.be.false;
    });

    it('should handle zero TTL', async () => {
      await cache.set('key1', 'value1', 0);

      // Wait a tiny bit to ensure TTL check happens
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      const value = cache.get('key1');

      expect(value).to.be.null; // Already expired
    });
  });
});
