import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

/**
 * Simple internal logger for CacheManager
 * TODO: Replace with Logger utility when Issue #7 is completed
 */
const logger = {
  warn: (message: string, context?: Record<string, unknown>): void => {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    // eslint-disable-next-line no-console
    console.warn(`[${timestamp}] [WARN] [CacheManager] ${message}${contextStr}`);
  },
  error: (message: string, context?: Record<string, unknown>): void => {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    // eslint-disable-next-line no-console
    console.error(`[${timestamp}] [ERROR] [CacheManager] ${message}${contextStr}`);
  },
};

/**
 * Cache entry with TTL (Time To Live)
 */
export type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  createdAt: number;
  hits: number;
};

/**
 * Cache statistics for monitoring
 */
export type CacheStats = {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  evictions: number;
  memorySizeBytes: number;
};

/**
 * Cache configuration
 */
export type CacheConfig = {
  /** Max entries in cache */
  maxSize: number;
  /** Time to live in milliseconds */
  ttlMs: number;
  /** Enable persistent cache (disk) */
  enablePersistence: boolean;
  /** Cache directory for persistent cache */
  cacheDirectory?: string;
  /** Enable file locking to prevent concurrent access */
  enableLocking: boolean;
};

/**
 * Default cache configuration
 */
const DEFAULT_CONFIG: CacheConfig = {
  maxSize: 1000,
  ttlMs: 3_600_000, // 1 hour
  enablePersistence: false,
  enableLocking: true,
};

type LockInfo = {
  pid: number;
  timestamp: string;
  hostname: string;
};

type PersistedCacheEntry = {
  key: string;
  entry: CacheEntry<unknown>;
};

type CacheMutationResult = {
  changed: boolean;
  deletedKeys: string[];
};

class CacheKeyDerivation {
  private static readonly CACHE_FILE_PREFIX = 'cache_';
  private static readonly CACHE_FILE_SUFFIX = '.json';
  private static readonly LOCK_DIRECTORY_NAME = 'sf-smart-deployment-locks';

  public toPersistedFileName(key: string): string {
    const hash = Buffer.from(key).toString('base64').replaceAll(/[/+=]/g, '_');
    return `${CacheKeyDerivation.CACHE_FILE_PREFIX}${hash}${CacheKeyDerivation.CACHE_FILE_SUFFIX}`;
  }

  public isPersistedCacheFile(fileName: string): boolean {
    return (
      fileName.startsWith(CacheKeyDerivation.CACHE_FILE_PREFIX) &&
      fileName.endsWith(CacheKeyDerivation.CACHE_FILE_SUFFIX)
    );
  }

  public toPersistedKey(fileName: string): string {
    return fileName.replace(CacheKeyDerivation.CACHE_FILE_PREFIX, '').replace(CacheKeyDerivation.CACHE_FILE_SUFFIX, '');
  }

  public sanitizeLockTarget(orgAlias: string): string {
    return orgAlias.replaceAll(/[^\w-]/g, '_');
  }

  public resolveLockDirectory(): string {
    return path.join(os.tmpdir(), CacheKeyDerivation.LOCK_DIRECTORY_NAME);
  }

  public resolveLockFilePath(orgAlias: string): string {
    return path.join(this.resolveLockDirectory(), `${this.sanitizeLockTarget(orgAlias)}.lock`);
  }
}

class CacheEntrySerializer {
  public serialize<T>(entry: CacheEntry<T>): string {
    return JSON.stringify(entry);
  }

  public deserialize(content: string): CacheEntry<unknown> {
    return JSON.parse(content) as CacheEntry<unknown>;
  }

  public serializeLock(lockInfo: LockInfo): string {
    return JSON.stringify(lockInfo, null, 2);
  }

  public deserializeLock(content: string): LockInfo {
    return JSON.parse(content) as LockInfo;
  }
}

class CacheExpiryPolicy {
  public createEntry<T>(value: T, ttlMs: number, now = Date.now()): CacheEntry<T> {
    return {
      value,
      expiresAt: now + ttlMs,
      createdAt: now,
      hits: 0,
    };
  }

  public isExpired(entry: CacheEntry<unknown>, now = Date.now()): boolean {
    return now > entry.expiresAt;
  }

  public collectExpiredKeys(cache: ReadonlyMap<string, CacheEntry<unknown>>, now = Date.now()): string[] {
    const expiredKeys: string[] = [];

    for (const [key, entry] of cache.entries()) {
      if (this.isExpired(entry, now)) {
        expiredKeys.push(key);
      }
    }

    return expiredKeys;
  }

  public selectOldestKey(cache: ReadonlyMap<string, CacheEntry<unknown>>): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    return oldestKey;
  }
}

class CacheStorage {
  public constructor(
    private readonly getConfig: () => CacheConfig,
    private readonly keyDerivation: CacheKeyDerivation,
    private readonly serializer: CacheEntrySerializer
  ) {}

  public async persistEntry<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    const config = this.getConfig();
    if (!config.cacheDirectory) {
      return;
    }

    try {
      await fs.mkdir(config.cacheDirectory, { recursive: true });
      const fileName = this.keyDerivation.toPersistedFileName(key);
      const filePath = path.join(config.cacheDirectory, fileName);
      await fs.writeFile(filePath, this.serializer.serialize(entry), 'utf-8');
    } catch (error) {
      logger.warn('Failed to persist cache entry', { error, key, cacheDirectory: config.cacheDirectory });
    }
  }

  public async deletePersistedEntry(key: string): Promise<void> {
    const config = this.getConfig();
    if (!config.cacheDirectory) {
      return;
    }

    try {
      const fileName = this.keyDerivation.toPersistedFileName(key);
      const filePath = path.join(config.cacheDirectory, fileName);
      await fs.unlink(filePath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  public async clearPersistedCache(): Promise<void> {
    const config = this.getConfig();
    if (!config.cacheDirectory) {
      return;
    }

    try {
      await fs.rm(config.cacheDirectory, { recursive: true, force: true });
    } catch (error) {
      logger.warn('Failed to clear cache directory', { error, cacheDirectory: config.cacheDirectory });
    }
  }

  public async loadEntriesFromDisk(expiryPolicy: CacheExpiryPolicy): Promise<PersistedCacheEntry[]> {
    const config = this.getConfig();
    if (!config.cacheDirectory) {
      return [];
    }

    const files = await fs.readdir(config.cacheDirectory);
    const cacheFiles = files.filter((file) => this.keyDerivation.isPersistedCacheFile(file));
    const results = await Promise.all(cacheFiles.map(async (file) => this.loadPersistedEntry(file, expiryPolicy)));

    return results.filter((result): result is PersistedCacheEntry => result !== null);
  }

  private async loadPersistedEntry(file: string, expiryPolicy: CacheExpiryPolicy): Promise<PersistedCacheEntry | null> {
    const config = this.getConfig();
    try {
      const filePath = path.join(config.cacheDirectory!, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const entry = this.serializer.deserialize(content);

      if (expiryPolicy.isExpired(entry)) {
        await fs.unlink(filePath);
        return null;
      }

      const key = this.keyDerivation.toPersistedKey(file);
      return { key, entry };
    } catch (error) {
      logger.warn('Skipping invalid cache file', { error, file });
      return null;
    }
  }
}

class CacheLockLifecycle {
  private lockFilePath: string | null = null;
  private lockFileHandle: fs.FileHandle | null = null;

  public constructor(
    private readonly getConfig: () => CacheConfig,
    private readonly keyDerivation: CacheKeyDerivation,
    private readonly serializer: CacheEntrySerializer
  ) {}

  public hasActiveLock(): boolean {
    return this.lockFileHandle !== null;
  }

  public async acquireLock(orgAlias: string): Promise<boolean> {
    if (!this.getConfig().enableLocking) {
      return true;
    }

    try {
      const lockDir = this.keyDerivation.resolveLockDirectory();
      await fs.mkdir(lockDir, { recursive: true });

      this.lockFilePath = this.keyDerivation.resolveLockFilePath(orgAlias);
      this.lockFileHandle = await fs.open(this.lockFilePath, 'wx');

      const lockInfo = {
        pid: process.pid,
        timestamp: new Date().toISOString(),
        hostname: os.hostname(),
      };

      await this.lockFileHandle.writeFile(this.serializer.serializeLock(lockInfo));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        return false;
      }

      logger.warn('Failed to acquire lock, continuing without locking', { error, orgAlias });
      return true;
    }
  }

  public async releaseLock(): Promise<void> {
    if (!this.lockFileHandle || !this.lockFilePath) {
      return;
    }

    const lockFilePath = this.lockFilePath;

    try {
      await this.lockFileHandle.close();
      await fs.unlink(lockFilePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn('Failed to release lock', { error, lockFilePath });
      }
    } finally {
      this.lockFileHandle = null;
      this.lockFilePath = null;
    }
  }

  public async isLocked(orgAlias: string): Promise<false | LockInfo> {
    if (!this.getConfig().enableLocking) {
      return false;
    }

    try {
      const lockFilePath = this.keyDerivation.resolveLockFilePath(orgAlias);
      const lockContent = await fs.readFile(lockFilePath, 'utf-8');
      const lockInfo = this.serializer.deserializeLock(lockContent);

      try {
        process.kill(lockInfo.pid, 0);
        return lockInfo;
      } catch {
        await fs.unlink(lockFilePath);
        return false;
      }
    } catch {
      return false;
    }
  }
}

/**
 * Singleton Cache Manager with TTL, persistence, and locking
 *
 * **Singleton Pattern**: Ensures only one instance exists per process
 * **File Locking**: Prevents concurrent access across processes
 * **Thread-safe**: Safe for concurrent operations within same process
 *
 * @example
 * ```typescript
 * const cache = CacheManager.getInstance();
 * await cache.set('key', { data: 'value' });
 * const value = await cache.get('key');
 * ```
 */
export class CacheManager {
  private static instance: CacheManager | null = null;

  private cache: Map<string, CacheEntry<unknown>>;
  private config: CacheConfig;
  private stats: CacheStats;
  private readonly storage: CacheStorage;
  private readonly expiryPolicy: CacheExpiryPolicy;
  private readonly lockLifecycle: CacheLockLifecycle;
  private readonly keyDerivation: CacheKeyDerivation;
  private readonly serializer: CacheEntrySerializer;

  /**
   * Private constructor - use getInstance() instead
   * Singleton pattern prevents multiple instances
   */
  private constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
    this.keyDerivation = new CacheKeyDerivation();
    this.serializer = new CacheEntrySerializer();
    this.expiryPolicy = new CacheExpiryPolicy();
    this.storage = new CacheStorage(() => this.config, this.keyDerivation, this.serializer);
    this.lockLifecycle = new CacheLockLifecycle(() => this.config, this.keyDerivation, this.serializer);
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
      evictions: 0,
      memorySizeBytes: 0,
    };
  }

  /**
   * Get singleton instance
   * Thread-safe within same process
   */
  public static getInstance(config?: Partial<CacheConfig>): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config);
    }

    return CacheManager.instance;
  }

  /**
   * Reset singleton (for testing only)
   */
  public static resetInstance(): void {
    CacheManager.instance = null;
  }

  /**
   * Acquire file lock to prevent concurrent access across processes
   *
   * @param orgAlias - Salesforce org alias to lock
   * @returns True if lock acquired, false if already locked
   */
  public async acquireLock(orgAlias: string): Promise<boolean> {
    return this.lockLifecycle.acquireLock(orgAlias);
  }

  /**
   * Release file lock
   */
  public async releaseLock(): Promise<void> {
    await this.lockLifecycle.releaseLock();
  }

  /**
   * Check if another instance is running for the same org
   */
  public async isLocked(orgAlias: string): Promise<false | LockInfo> {
    return this.lockLifecycle.isLocked(orgAlias);
  }

  /**
   * Get value from cache
   */
  public get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.recordMiss();
      return null;
    }

    if (this.expiryPolicy.isExpired(entry)) {
      this.cache.delete(key);
      this.recordMiss();
      return null;
    }

    entry.hits++;
    this.recordHit();

    return entry.value;
  }

  /**
   * Set value in cache with TTL
   */
  public async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const ttl = ttlMs ?? this.config.ttlMs;
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    const entry = this.expiryPolicy.createEntry(value, ttl);
    this.cache.set(key, entry as CacheEntry<unknown>);
    this.stats.size = this.cache.size;

    if (this.config.enablePersistence) {
      await this.storage.persistEntry(key, entry);
    }
  }

  /**
   * Check if key exists and is not expired
   */
  public has(key: string): boolean {
    const value = this.get(key);
    return value !== null;
  }

  /**
   * Delete specific key
   */
  public async delete(key: string): Promise<boolean> {
    const deleted = this.deleteFromMemory(key).changed;
    this.stats.size = this.cache.size;

    if (deleted && this.config.enablePersistence) {
      await this.storage.deletePersistedEntry(key);
    }

    return deleted;
  }

  /**
   * Clear all cache entries
   */
  public async clear(): Promise<void> {
    this.cache.clear();
    this.stats.size = 0;
    this.stats.evictions = 0;

    if (this.config.enablePersistence && this.config.cacheDirectory) {
      await this.storage.clearPersistedCache();
    }
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    this.updateMemorySize();
    return { ...this.stats };
  }

  /**
   * Load cache from disk
   */
  public async loadFromDisk(): Promise<number> {
    if (!this.config.enablePersistence || !this.config.cacheDirectory) {
      return 0;
    }

    try {
      const results = await this.storage.loadEntriesFromDisk(this.expiryPolicy);
      let loaded = 0;
      for (const result of results) {
        this.cache.set(result.key, result.entry);
        loaded++;
      }

      this.stats.size = this.cache.size;
      return loaded;
    } catch (error) {
      logger.error('Failed to load cache from disk', { error, cacheDirectory: this.config.cacheDirectory });
      return 0;
    }
  }

  /**
   * Clean expired entries (garbage collection)
   */
  public async cleanExpired(): Promise<number> {
    const expiredKeys = this.expiryPolicy.collectExpiredKeys(this.cache);
    this.deleteManyFromMemory(expiredKeys);

    if (this.config.enablePersistence && expiredKeys.length > 0) {
      await Promise.all(expiredKeys.map(async (key) => this.storage.deletePersistedEntry(key)));
    }

    this.stats.size = this.cache.size;
    return expiredKeys.length;
  }

  /**
   * Get all keys in cache
   */
  public keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  public size(): number {
    return this.cache.size;
  }

  /**
   * Update configuration
   */
  public configure(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Evict oldest entry (LRU-like)
   */
  private evictOldest(): void {
    const oldestKey = this.expiryPolicy.selectOldestKey(this.cache);
    if (oldestKey) {
      this.deleteFromMemory(oldestKey);
      this.stats.evictions++;
    }
  }

  private deleteFromMemory(key: string): CacheMutationResult {
    const changed = this.cache.delete(key);
    return {
      changed,
      deletedKeys: changed ? [key] : [],
    };
  }

  private deleteManyFromMemory(keys: readonly string[]): CacheMutationResult {
    let changed = false;
    const deletedKeys: string[] = [];

    for (const key of keys) {
      if (this.cache.delete(key)) {
        changed = true;
        deletedKeys.push(key);
      }
    }

    return {
      changed,
      deletedKeys,
    };
  }

  private recordHit(): void {
    this.stats.hits++;
    this.updateHitRate();
  }

  private recordMiss(): void {
    this.stats.misses++;
    this.updateHitRate();
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Estimate memory size
   */
  private updateMemorySize(): void {
    let totalSize = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Rough estimation: key + JSON stringified value
      totalSize += key.length * 2; // UTF-16
      totalSize += JSON.stringify(entry.value).length * 2;
      totalSize += 64; // Overhead for metadata
    }

    this.stats.memorySizeBytes = totalSize;
  }
}

/**
 * Get default cache instance (singleton)
 */
export function getCacheManager(config?: Partial<CacheConfig>): CacheManager {
  return CacheManager.getInstance(config);
}
