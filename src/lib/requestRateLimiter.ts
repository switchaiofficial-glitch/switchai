/**
 * Request Rate Limiter for Website
 * Prevents API abuse and manages request throttling
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RequestRecord {
  timestamp: number;
  count: number;
}

class RequestRateLimiter {
  private requests: Map<string, RequestRecord[]> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = { maxRequests: 60, windowMs: 60000 }) {
    this.config = config;
  }

  /**
   * Check if a request is allowed
   */
  async checkLimit(key: string = 'default'): Promise<{ allowed: boolean; retryAfter?: number }> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get existing requests for this key
    let keyRequests = this.requests.get(key) || [];

    // Filter out old requests outside the window
    keyRequests = keyRequests.filter(req => req.timestamp > windowStart);

    // Count requests in current window
    const requestCount = keyRequests.reduce((sum, req) => sum + req.count, 0);

    if (requestCount >= this.config.maxRequests) {
      // Rate limit exceeded
      const oldestRequest = keyRequests[0];
      const retryAfter = oldestRequest ? oldestRequest.timestamp + this.config.windowMs - now : this.config.windowMs;
      
      return {
        allowed: false,
        retryAfter: Math.ceil(retryAfter / 1000), // Convert to seconds
      };
    }

    // Add new request
    keyRequests.push({ timestamp: now, count: 1 });
    this.requests.set(key, keyRequests);

    // Clean up old entries periodically
    this.cleanup();

    return { allowed: true };
  }

  /**
   * Record a request
   */
  async recordRequest(key: string = 'default'): Promise<void> {
    await this.checkLimit(key);
  }

  /**
   * Clean up old request records
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs * 2; // Keep 2x window for safety

    for (const [key, requests] of this.requests.entries()) {
      const filtered = requests.filter(req => req.timestamp > windowStart);
      if (filtered.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, filtered);
      }
    }
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string = 'default'): void {
    this.requests.delete(key);
  }

  /**
   * Get current request count for a key
   */
  getRequestCount(key: string = 'default'): number {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const keyRequests = this.requests.get(key) || [];
    const validRequests = keyRequests.filter(req => req.timestamp > windowStart);
    return validRequests.reduce((sum, req) => sum + req.count, 0);
  }
}

// Export singleton instance
const rateLimiter = new RequestRateLimiter({
  maxRequests: 60, // 60 requests
  windowMs: 60000, // per minute
});

export default rateLimiter;

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error.status === 401 || error.status === 403 || error.status === 404) {
        throw error;
      }
      
      // Don't retry on abort
      if (error.name === 'AbortError') {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = initialDelay * Math.pow(2, attempt);
      const jitter = Math.random() * 200; // Add jitter to prevent thundering herd
      
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}
