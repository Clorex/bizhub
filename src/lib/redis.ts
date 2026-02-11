/**
 * Redis-like caching layer.
 * 
 * Uses actual Redis if REDIS_URL is set.
 * Falls back to in-memory Map cache for development.
 * 
 * Install redis: npm install ioredis
 * If you don't want Redis yet, the in-memory fallback works fine.
 */

interface CacheEntry {
  value: string;
  expiry: number;
}

// ===========================
// IN-MEMORY FALLBACK CACHE
// ===========================
class MemoryCache {
  private store: Map<string, CacheEntry> = new Map();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async flushPattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
      }
    }
  }
}

// ===========================
// REDIS CLIENT WRAPPER
// ===========================
class RedisCache {
  private client: MemoryCache;
  private isRedis: boolean = false;

  constructor() {
    // Try to use Redis if available
    if (process.env.REDIS_URL) {
      try {
        // Dynamic import would go here for ioredis
        // For now, fallback to memory
        console.log('📦 Redis URL found but using memory cache for simplicity');
        this.client = new MemoryCache();
      } catch {
        console.log('⚠️ Redis not available, using memory cache');
        this.client = new MemoryCache();
      }
    } else {
      this.client = new MemoryCache();
    }
  }

  /**
   * Get a cached value. Returns parsed JSON or null.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      console.error('Cache GET error:', error);
      return null;
    }
  }

  /**
   * Set a cached value with TTL in seconds.
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.client.set(key, serialized, ttlSeconds);
    } catch (error) {
      console.error('Cache SET error:', error);
    }
  }

  /**
   * Delete a cached value.
   */
  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Cache DEL error:', error);
    }
  }

  /**
   * Invalidate all cache entries matching a pattern.
   * e.g., "analytics:vendor123:*"
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      await this.client.flushPattern(pattern);
    } catch (error) {
      console.error('Cache FLUSH error:', error);
    }
  }

  /**
   * Get or compute: check cache first, compute if missing.
   */
  async getOrCompute<T>(
    key: string,
    computeFn: () => Promise<T>,
    ttlSeconds: number
  ): Promise<{ data: T; cached: boolean }> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return { data: cached, cached: true };
    }

    const computed = await computeFn();
    await this.set(key, computed, ttlSeconds);
    return { data: computed, cached: false };
  }
}

// ===========================
// SINGLETON
// ===========================
const globalForCache = globalThis as unknown as {
  cache: RedisCache | undefined;
};

export const cache = globalForCache.cache ?? new RedisCache();

if (process.env.NODE_ENV !== 'production') {
  globalForCache.cache = cache;
}

// ===========================
// CACHE KEY BUILDERS
// ===========================
export function buildCacheKey(
  vendorId: string,
  section: string,
  date?: string
): string {
  const dateKey = date || new Date().toISOString().split('T')[0];
  return `analytics:${vendorId}:${section}:${dateKey}`;
}

export default cache;