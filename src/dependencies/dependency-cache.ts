/**
 * Dependency Cache
 * Caches dependency analysis results for faster subsequent runs
 * 
 * @ac US-036-AC-1: Cache graph structure
 * @ac US-036-AC-2: Invalidate cache on file changes
 * @ac US-036-AC-3: Cache topological sort results
 * @ac US-036-AC-4: Cache cycle detection results
 * @ac US-036-AC-5: Cache heuristic inferences
 * @ac US-036-AC-6: Configurable cache TTL
 * 
 * @issue #36
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('DependencyCache');

/**
 * Cache entry structure
 */
export type CacheEntry<T> = {
  data: T;
  timestamp: number;
  version: string;
  fileHashes: Map<string, string>;
};

/**
 * Cache key types
 */
export type CacheKey = 
  | 'graph'
  | 'topological-sort'
  | 'circular-dependencies'
  | 'heuristic-inferences'
  | 'depth-analysis'
  | 'impact-analysis';

/**
 * Cache options
 */
export type CacheOptions = {
  /** Cache directory */
  cacheDir?: string;
  /** Time to live in seconds (default: 3600 = 1 hour) */
  ttl?: number;
  /** Enable cache (default: true) */
  enabled?: boolean;
  /** Cache version (for invalidation) */
  version?: string;
};

/**
 * Dependency Cache
 * 
 * Caches dependency analysis results to speed up subsequent runs.
 * Automatically invalidates cache when files change.
 * 
 * Performance: O(1) read/write
 * 
 * @example
 * const cache = new DependencyCache({ ttl: 3600 });
 * 
 * // Try to load from cache
 * const graph = await cache.get('graph', filePaths);
 * if (graph) {
 *   console.log('Using cached graph');
 * } else {
 *   const newGraph = buildGraph();
 *   await cache.set('graph', newGraph, filePaths);
 * }
 */
export class DependencyCache {
  private options: Required<CacheOptions>;
  private memoryCache: Map<CacheKey, CacheEntry<unknown>>;

  public constructor(options: CacheOptions = {}) {
    this.options = {
      cacheDir: options.cacheDir ?? path.join(process.cwd(), '.sf-deploy-cache'),
      ttl: options.ttl ?? 3600,
      enabled: options.enabled ?? true,
      version: options.version ?? '1.0.0',
    };

    this.memoryCache = new Map();

    logger.debug('Initialized DependencyCache', {
      cacheDir: this.options.cacheDir,
      ttl: this.options.ttl,
      enabled: this.options.enabled,
    });
  }

  /**
   * @ac US-036-AC-1: Cache graph structure
   */
  public async get<T>(key: CacheKey, filePaths: string[]): Promise<T | undefined> {
    if (!this.options.enabled) {
      return undefined;
    }

    // Try memory cache first
    const memEntry = this.memoryCache.get(key) as CacheEntry<T> | undefined;
    if (memEntry && await this.isValid(memEntry, filePaths)) {
      logger.debug('Cache hit (memory)', { key });
      return memEntry.data;
    }

    // Try disk cache
    try {
      const cacheFile = this.getCacheFilePath(key);
      const content = await fs.readFile(cacheFile, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(content, this.reviver);

      if (await this.isValid(entry, filePaths)) {
        // Store in memory for faster access
        this.memoryCache.set(key, entry);
        logger.debug('Cache hit (disk)', { key });
        return entry.data;
      } else {
        logger.debug('Cache invalid', { key });
        await this.delete(key);
      }
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn('Failed to read cache', { key, error });
      }
    }

    logger.debug('Cache miss', { key });
    return undefined;
  }

  /**
   * @ac US-036-AC-1: Cache graph structure
   * @ac US-036-AC-3: Cache topological sort results
   * @ac US-036-AC-4: Cache cycle detection results
   * @ac US-036-AC-5: Cache heuristic inferences
   */
  public async set<T>(key: CacheKey, data: T, filePaths: string[]): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    const fileHashes = await this.hashFiles(filePaths);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      version: this.options.version,
      fileHashes,
    };

    // Store in memory
    this.memoryCache.set(key, entry as CacheEntry<unknown>);

    // Store on disk
    try {
      await fs.mkdir(this.options.cacheDir, { recursive: true });
      const cacheFile = this.getCacheFilePath(key);
      const content = JSON.stringify(entry, this.replacer, 2);
      await fs.writeFile(cacheFile, content, 'utf-8');
      logger.debug('Cache stored', { key, files: filePaths.length });
    } catch (error: unknown) {
      logger.warn('Failed to write cache', { key, error });
    }
  }

  /**
   * @ac US-036-AC-2: Invalidate cache on file changes
   */
  public async invalidate(key: CacheKey): Promise<void> {
    await this.delete(key);
    logger.debug('Cache invalidated', { key });
  }

  /**
   * Invalidate all cache entries
   */
  public async invalidateAll(): Promise<void> {
    this.memoryCache.clear();
    
    try {
      await fs.rm(this.options.cacheDir, { recursive: true, force: true });
      logger.debug('All cache invalidated');
    } catch (error: unknown) {
      logger.warn('Failed to invalidate all cache', { error });
    }
  }

  /**
   * Delete a cache entry
   */
  private async delete(key: CacheKey): Promise<void> {
    this.memoryCache.delete(key);

    try {
      const cacheFile = this.getCacheFilePath(key);
      await fs.unlink(cacheFile);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn('Failed to delete cache file', { key, error });
      }
    }
  }

  /**
   * @ac US-036-AC-2: Invalidate cache on file changes
   * @ac US-036-AC-6: Configurable cache TTL
   */
  private async isValid<T>(entry: CacheEntry<T>, filePaths: string[]): Promise<boolean> {
    // Check version
    if (entry.version !== this.options.version) {
      logger.debug('Cache version mismatch', {
        cached: entry.version,
        current: this.options.version,
      });
      return false;
    }

    // Check TTL
    const age = (Date.now() - entry.timestamp) / 1000;
    if (age > this.options.ttl) {
      logger.debug('Cache expired', { age, ttl: this.options.ttl });
      return false;
    }

    // Check file hashes
    const currentHashes = await this.hashFiles(filePaths);
    
    if (currentHashes.size !== entry.fileHashes.size) {
      logger.debug('File count changed', {
        cached: entry.fileHashes.size,
        current: currentHashes.size,
      });
      return false;
    }

    for (const [file, hash] of currentHashes.entries()) {
      if (entry.fileHashes.get(file) !== hash) {
        logger.debug('File modified', { file });
        return false;
      }
    }

    return true;
  }

  /**
   * Hash files for change detection
   */
  private async hashFiles(filePaths: string[]): Promise<Map<string, string>> {
    const hashes = new Map<string, string>();

    for (const filePath of filePaths) {
      try {
        const stat = await fs.stat(filePath);
        // Simple hash: mtime + size
        const hash = crypto
          .createHash('md5')
          .update(`${stat.mtimeMs}-${stat.size}`)
          .digest('hex');
        hashes.set(filePath, hash);
      } catch (error: unknown) {
        logger.warn('Failed to hash file', { filePath, error });
      }
    }

    return hashes;
  }

  /**
   * Get cache file path
   */
  private getCacheFilePath(key: CacheKey): string {
    return path.join(this.options.cacheDir, `${key}.json`);
  }

  /**
   * JSON replacer for Sets and Maps
   */
  private replacer(_key: string, value: unknown): unknown {
    if (value instanceof Set) {
      return {
        __type: 'Set',
        __data: Array.from(value),
      };
    }
    if (value instanceof Map) {
      return {
        __type: 'Map',
        __data: Array.from(value.entries()),
      };
    }
    return value;
  }

  /**
   * JSON reviver for Sets and Maps
   */
  private reviver(_key: string, value: unknown): unknown {
    if (typeof value === 'object' && value !== null) {
      const obj = value as { __type?: string; __data?: unknown };
      if (obj.__type === 'Set' && Array.isArray(obj.__data)) {
        return new Set(obj.__data);
      }
      if (obj.__type === 'Map' && Array.isArray(obj.__data)) {
        return new Map(obj.__data as Array<[unknown, unknown]>);
      }
    }
    return value;
  }

  /**
   * Get cache statistics
   */
  public getStats(): { 
    memoryEntries: number;
    enabled: boolean;
    ttl: number;
  } {
    return {
      memoryEntries: this.memoryCache.size,
      enabled: this.options.enabled,
      ttl: this.options.ttl,
    };
  }

  /**
   * Check if cache is enabled
   */
  public isEnabled(): boolean {
    return this.options.enabled;
  }

  /**
   * Enable cache
   */
  public enable(): void {
    this.options.enabled = true;
    logger.debug('Cache enabled');
  }

  /**
   * Disable cache
   */
  public disable(): void {
    this.options.enabled = false;
    logger.debug('Cache disabled');
  }
}

/**
 * Helper: Create a cache key from file paths
 */
export function createCacheKey(baseKey: CacheKey, filePaths: string[]): string {
  const hash = crypto
    .createHash('md5')
    .update(filePaths.sort().join('|'))
    .digest('hex');
  return `${baseKey}-${hash.substring(0, 8)}`;
}

