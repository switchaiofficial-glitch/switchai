/**
 * Response Cache Service for Website
 * Caches AI responses for instant retrieval on repeated queries
 * Based on mobile app implementation
 */

interface CacheEntry {
  response: string;
  timestamp: number;
  model: string;
  tokens: number;
}

class ResponseCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize = 100, ttl = 3600000) { // 1 hour default TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * Generate a cache key from messages and model
   */
  private generateKey(messages: any[], model: string): string {
    try {
      // Create a deterministic string from messages
      const messagesStr = JSON.stringify(messages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      })));
      
      // Simple hash function
      let hash = 0;
      const str = `${model}:${messagesStr}`;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      return `${model}_${Math.abs(hash).toString(36)}`;
    } catch (error) {
      console.error('[Cache] Error generating key:', error);
      return '';
    }
  }

  /**
   * Get cached response if available and not expired
   */
  get(messages: any[], model: string): string | null {
    try {
      const key = this.generateKey(messages, model);
      if (!key) return null;

      const entry = this.cache.get(key);
      if (!entry) return null;

      // Check if expired
      const now = Date.now();
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        return null;
      }

      console.log(`[Cache] HIT for ${model} (${entry.tokens} tokens saved)`);
      return entry.response;
    } catch (error) {
      console.error('[Cache] Error getting cached response:', error);
      return null;
    }
  }

  /**
   * Store response in cache with LRU eviction
   */
  set(messages: any[], model: string, response: string, tokens: number = 0): void {
    try {
      const key = this.generateKey(messages, model);
      if (!key || !response || response.length < 10) return;

      // LRU eviction: if cache is full, remove oldest entry
      if (this.cache.size >= this.maxSize) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) {
          this.cache.delete(oldestKey);
        }
      }

      this.cache.set(key, {
        response,
        timestamp: Date.now(),
        model,
        tokens
      });

      console.log(`[Cache] STORED for ${model} (${tokens} tokens, cache size: ${this.cache.size})`);
    } catch (error) {
      console.error('[Cache] Error storing response:', error);
    }
  }

  /**
   * Clear all cached responses
   */
  clear(): void {
    this.cache.clear();
    console.log('[Cache] Cleared all entries');
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; ttl: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl
    };
  }

  /**
   * Remove expired entries
   */
  cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[Cache] Cleaned up ${removed} expired entries`);
    }
  }
}

// Export singleton instance
const responseCache = new ResponseCache(100, 3600000); // 100 entries, 1 hour TTL

// Cleanup expired entries every 10 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    responseCache.cleanup();
  }, 600000); // 10 minutes
}

export default responseCache;
