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
 * Generate safe filename from cache key
 */
function getCacheFileName(key: string): string {
  const hash = Buffer.from(key).toString('base64').replaceAll(/[/+=]/g, '_');
  return `cache_${hash}.json`;
}

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
  private static lockFilePath: string | null = null;

  private cache: Map<string, CacheEntry<unknown>>;
  private config: CacheConfig;
  private stats: CacheStats;
  private lockFileHandle: fs.FileHandle | null = null;

  /**
   * Private constructor - use getInstance() instead
   * Singleton pattern prevents multiple instances
   */
  private constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
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
    if (CacheManager.instance?.lockFileHandle) {
      void CacheManager.instance.releaseLock();
    }

    CacheManager.instance = null;
    CacheManager.lockFilePath = null;
  }

  /**
   * Acquire file lock to prevent concurrent access across processes
   *
   * @param orgAlias - Salesforce org alias to lock
   * @returns True if lock acquired, false if already locked
   */
  public async acquireLock(orgAlias: string): Promise<boolean> {
    if (!this.config.enableLocking) {
      return true;
    }

    try {
      const lockDir = path.join(os.tmpdir(), 'sf-smart-deployment-locks');
      await fs.mkdir(lockDir, { recursive: true });

      const lockFileName = `${orgAlias.replaceAll(/[^\w-]/g, '_')}.lock`;
      CacheManager.lockFilePath = path.join(lockDir, lockFileName);

      // Try to open lock file exclusively (fails if already locked)
      this.lockFileHandle = await fs.open(CacheManager.lockFilePath, 'wx');

      // Write process info to lock file
      const lockInfo = {
        pid: process.pid,
        orgAlias,
        timestamp: new Date().toISOString(),
        hostname: os.hostname(),
      };

      await this.lockFileHandle.writeFile(JSON.stringify(lockInfo, null, 2));

      return true;
    } catch (error) {
      // Lock file already exists - another process is running
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        return false;
      }

      // Other errors - log but don't block deployments
      logger.warn('Failed to acquire lock, continuing without locking', { error, orgAlias });
      return true;
    }
  }

  /**
   * Release file lock
   */
  public async releaseLock(): Promise<void> {
    if (!this.lockFileHandle || !CacheManager.lockFilePath) {
      return;
    }

    try {
      await this.lockFileHandle.close();
      await fs.unlink(CacheManager.lockFilePath);
      this.lockFileHandle = null;
      CacheManager.lockFilePath = null;
    } catch (error) {
      logger.warn('Failed to release lock', { error, lockFilePath: CacheManager.lockFilePath });
    }
  }

  /**
   * Check if another instance is running for the same org
   */
  public async isLocked(orgAlias: string): Promise<
    | false
    | {
        pid: number;
        timestamp: string;
        hostname: string;
      }
  > {
    if (!this.config.enableLocking) {
      return false;
    }

    try {
      const lockDir = path.join(os.tmpdir(), 'sf-smart-deployment-locks');
      const lockFileName = `${orgAlias.replaceAll(/[^\w-]/g, '_')}.lock`;
      const lockFilePath = path.join(lockDir, lockFileName);

      const lockContent = await fs.readFile(lockFilePath, 'utf-8');
      const lockInfo = JSON.parse(lockContent) as {
        pid: number;
        timestamp: string;
        hostname: string;
      };

      // Check if process is still running
      try {
        process.kill(lockInfo.pid, 0); // Signal 0 = check existence
        return lockInfo; // Process exists
      } catch {
        // Process doesn't exist - stale lock, remove it
        await fs.unlink(lockFilePath);
        return false;
      }
    } catch {
      // Lock file doesn't exist
      return false;
    }
  }

  /**
   * Get value from cache
   */
  public get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Update hit count
    entry.hits++;
    this.stats.hits++;
    this.updateHitRate();

    return entry.value;
  }

  /**
   * Set value in cache with TTL
   */
  public async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const ttl = ttlMs ?? this.config.ttlMs;
    const now = Date.now();

    // Evict if at capacity
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      value,
      expiresAt: now + ttl,
      createdAt: now,
      hits: 0,
    };

    this.cache.set(key, entry as CacheEntry<unknown>);
    this.stats.size = this.cache.size;

    // Persist to disk if enabled
    if (this.config.enablePersistence) {
      await this.persistEntry(key, entry);
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
    const deleted = this.cache.delete(key);
    this.stats.size = this.cache.size;

    if (deleted && this.config.enablePersistence) {
      await this.deletePersistedEntry(key);
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
      try {
        await fs.rm(this.config.cacheDirectory, { recursive: true, force: true });
      } catch (error) {
        logger.warn('Failed to clear cache directory', { error, cacheDirectory: this.config.cacheDirectory });
      }
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
      const files = await fs.readdir(this.config.cacheDirectory);
      const cacheFiles = files.filter((file) => file.startsWith('cache_'));

      // Load all files in parallel
      const results = await Promise.all(
        cacheFiles.map(async (file) => {
          try {
            const filePath = path.join(this.config.cacheDirectory!, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const entry = JSON.parse(content) as CacheEntry<unknown>;

            // Skip expired entries
            if (Date.now() > entry.expiresAt) {
              await fs.unlink(filePath);
              return null;
            }

            // Reconstruct key from filename
            const hash = file.replace('cache_', '').replace('.json', '');
            return { hash, entry };
          } catch (error) {
            logger.warn('Skipping invalid cache file', { error, file });
            return null;
          }
        })
      );

      // Load valid entries into cache
      let loaded = 0;
      for (const result of results) {
        if (result) {
          this.cache.set(result.hash, result.entry);
          loaded++;
        }
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
    const now = Date.now();
    const expiredKeys: string[] = [];

    // Collect expired keys
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }

    // Delete from cache (synchronous)
    for (const key of expiredKeys) {
      this.cache.delete(key);
    }

    // Delete persisted entries in parallel
    if (this.config.enablePersistence && expiredKeys.length > 0) {
      await Promise.all(expiredKeys.map((key) => this.deletePersistedEntry(key)));
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
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
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

  /**
   * Persist entry to disk
   */
  private async persistEntry<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    if (!this.config.cacheDirectory) {
      return;
    }

    try {
      await fs.mkdir(this.config.cacheDirectory, { recursive: true });

      const fileName = getCacheFileName(key);
      const filePath = path.join(this.config.cacheDirectory, fileName);

      await fs.writeFile(filePath, JSON.stringify(entry), 'utf-8');
    } catch (error) {
      logger.warn('Failed to persist cache entry', { error, key, cacheDirectory: this.config.cacheDirectory });
    }
  }

  /**
   * Delete persisted entry
   */
  private async deletePersistedEntry(key: string): Promise<void> {
    if (!this.config.cacheDirectory) {
      return;
    }

    try {
      const fileName = getCacheFileName(key);
      const filePath = path.join(this.config.cacheDirectory, fileName);
      await fs.unlink(filePath);
    } catch {
      // Ignore if file doesn't exist
    }
  }
}

/**
 * Get default cache instance (singleton)
 */
export function getCacheManager(config?: Partial<CacheConfig>): CacheManager {
  return CacheManager.getInstance(config);
}
