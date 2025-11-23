/**
 * Status Line Cache
 *
 * Caches generated status lines to prevent expensive regeneration
 * during scrolling and list updates. Uses LRU-style eviction.
 */

interface StatusLineEntry {
  text: string;
  icon?: string;
  timestamp: number;
}

interface CacheKey {
  friendId: string;
  lastUpdated: number; // Use timestamp for cache key
  weaveScore: number;
  archetype: string;
}

class StatusLineCache {
  private cache = new Map<string, StatusLineEntry>();
  private maxSize = 100; // Keep last 100 status lines
  private ttl = 5 * 60 * 1000; // 5 minutes TTL

  private generateKey(key: CacheKey): string {
    // Round lastUpdated to nearest second to reduce cache misses
    const roundedTimestamp = Math.floor(key.lastUpdated / 1000) * 1000;
    return `${key.friendId}-${roundedTimestamp}-${Math.floor(key.weaveScore)}-${key.archetype}`;
  }

  get(key: CacheKey): { text: string; icon?: string } | null {
    const cacheKey = this.generateKey(key);
    const entry = this.cache.get(cacheKey);

    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(cacheKey);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(cacheKey);
    this.cache.set(cacheKey, entry);

    return { text: entry.text, icon: entry.icon };
  }

  set(key: CacheKey, value: { text: string; icon?: string }): void {
    const cacheKey = this.generateKey(key);

    // LRU eviction if at max size
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(cacheKey, {
      text: value.text,
      icon: value.icon,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  // Invalidate all entries for a specific friend
  invalidateFriend(friendId: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${friendId}-`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }
}

// Singleton instance
export const statusLineCache = new StatusLineCache();
