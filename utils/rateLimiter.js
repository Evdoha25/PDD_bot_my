/**
 * Rate Limiter for controlling request frequency per user
 * Implements sliding window algorithm
 */

class RateLimiter {
  /**
   * Create a rate limiter
   * @param {number} maxRequests - Maximum requests per window
   * @param {number} windowMs - Time window in milliseconds
   */
  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
    
    // Cleanup old entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Check if a request is allowed
   * @param {string|number} userId - User identifier
   * @returns {Object} { allowed: boolean, remaining: number, resetIn: number }
   */
  check(userId) {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    
    // Filter requests within the current window
    const validRequests = userRequests.filter(
      timestamp => now - timestamp < this.windowMs
    );
    
    const remaining = Math.max(0, this.maxRequests - validRequests.length);
    const oldestRequest = validRequests[0] || now;
    const resetIn = Math.max(0, this.windowMs - (now - oldestRequest));

    return {
      allowed: validRequests.length < this.maxRequests,
      remaining,
      resetIn: Math.ceil(resetIn / 1000) // in seconds
    };
  }

  /**
   * Record a request
   * @param {string|number} userId - User identifier
   * @returns {Object} { allowed: boolean, remaining: number, resetIn: number }
   */
  hit(userId) {
    const status = this.check(userId);
    
    if (status.allowed) {
      const now = Date.now();
      const userRequests = this.requests.get(userId) || [];
      
      // Filter and add new request
      const validRequests = userRequests.filter(
        timestamp => now - timestamp < this.windowMs
      );
      validRequests.push(now);
      
      this.requests.set(userId, validRequests);
      
      return {
        allowed: true,
        remaining: Math.max(0, this.maxRequests - validRequests.length),
        resetIn: Math.ceil(this.windowMs / 1000)
      };
    }
    
    return status;
  }

  /**
   * Clean up old request records
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [userId, requests] of this.requests) {
      const validRequests = requests.filter(
        timestamp => now - timestamp < this.windowMs
      );
      
      if (validRequests.length === 0) {
        this.requests.delete(userId);
        cleaned++;
      } else if (validRequests.length < requests.length) {
        this.requests.set(userId, validRequests);
      }
    }
    
    if (cleaned > 0) {
      console.log(`[RateLimiter] Cleaned up ${cleaned} expired rate limit entries`);
    }
  }

  /**
   * Reset rate limit for a specific user
   * @param {string|number} userId - User identifier
   */
  reset(userId) {
    this.requests.delete(userId);
  }

  /**
   * Get rate limiter statistics
   * @returns {Object} Stats
   */
  getStats() {
    return {
      trackedUsers: this.requests.size,
      maxRequests: this.maxRequests,
      windowSeconds: this.windowMs / 1000
    };
  }

  /**
   * Stop the cleanup interval
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

module.exports = RateLimiter;
