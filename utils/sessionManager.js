/**
 * Session Manager with TTL-based cleanup
 * Stores user sessions in memory with automatic expiration
 */

class SessionManager {
  constructor(ttlMinutes = 30) {
    this.sessions = new Map();
    this.ttlMs = ttlMinutes * 60 * 1000;
    
    // Start cleanup interval (runs every 5 minutes)
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Create or update a user session
   * @param {number} userId - Telegram user ID
   * @param {Object} data - Session data
   * @returns {Object} The session object
   */
  set(userId, data) {
    const session = {
      userId,
      ...data,
      lastActivity: Date.now()
    };
    this.sessions.set(userId, session);
    return session;
  }

  /**
   * Get user session
   * @param {number} userId - Telegram user ID
   * @returns {Object|null} Session data or null if not found/expired
   */
  get(userId) {
    const session = this.sessions.get(userId);
    
    if (!session) {
      return null;
    }

    // Check if session has expired
    if (Date.now() - session.lastActivity > this.ttlMs) {
      this.sessions.delete(userId);
      return null;
    }

    // Update last activity
    session.lastActivity = Date.now();
    return session;
  }

  /**
   * Update specific fields in a session
   * @param {number} userId - Telegram user ID
   * @param {Object} updates - Fields to update
   * @returns {Object|null} Updated session or null if not found
   */
  update(userId, updates) {
    const session = this.get(userId);
    
    if (!session) {
      return null;
    }

    Object.assign(session, updates, { lastActivity: Date.now() });
    return session;
  }

  /**
   * Delete a user session
   * @param {number} userId - Telegram user ID
   * @returns {boolean} True if deleted, false if not found
   */
  delete(userId) {
    return this.sessions.delete(userId);
  }

  /**
   * Check if user has an active session
   * @param {number} userId - Telegram user ID
   * @returns {boolean}
   */
  has(userId) {
    return this.get(userId) !== null;
  }

  /**
   * Clean up expired sessions
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [userId, session] of this.sessions) {
      if (now - session.lastActivity > this.ttlMs) {
        this.sessions.delete(userId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[SessionManager] Cleaned up ${cleaned} expired sessions`);
    }
  }

  /**
   * Get session statistics
   * @returns {Object} Stats object
   */
  getStats() {
    return {
      activeSessions: this.sessions.size,
      ttlMinutes: this.ttlMs / 60 / 1000
    };
  }

  /**
   * Stop the cleanup interval (for graceful shutdown)
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

module.exports = SessionManager;
