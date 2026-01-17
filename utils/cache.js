/**
 * LRU (Least Recently Used) Cache implementation
 * Provides memory-efficient caching with automatic eviction
 */

class LRUCache {
  /**
   * Create an LRU cache
   * @param {number} maxSize - Maximum number of items in cache
   */
  constructor(maxSize = 5000) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  /**
   * Get an item from cache
   * @param {string|number} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * Set an item in cache
   * @param {string|number} key - Cache key
   * @param {*} value - Value to cache
   * @returns {*} The cached value
   */
  set(key, value) {
    // Delete if exists to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest items if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, value);
    return value;
  }

  /**
   * Check if key exists in cache
   * @param {string|number} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Delete an item from cache
   * @param {string|number} key - Cache key
   * @returns {boolean} Whether the item was deleted
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Clear all items from cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache size
   * @returns {number} Current number of items
   */
  get size() {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilizationPercent: Math.round((this.cache.size / this.maxSize) * 100)
    };
  }
}

/**
 * Simple in-memory cache for images
 * Stores image buffers with size limits
 */
class ImageCache {
  /**
   * Create an image cache
   * @param {number} maxSizeBytes - Maximum total cache size in bytes (default 50MB)
   */
  constructor(maxSizeBytes = 50 * 1024 * 1024) {
    this.maxSizeBytes = maxSizeBytes;
    this.cache = new Map();
    this.currentSize = 0;
  }

  /**
   * Get an image from cache
   * @param {string} key - Image path/key
   * @returns {Buffer|undefined} Image buffer or undefined
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    // Update access time
    entry.lastAccess = Date.now();
    return entry.buffer;
  }

  /**
   * Set an image in cache
   * @param {string} key - Image path/key
   * @param {Buffer} buffer - Image buffer
   * @returns {boolean} Whether the image was cached
   */
  set(key, buffer) {
    if (!Buffer.isBuffer(buffer)) {
      return false;
    }

    const size = buffer.length;

    // Don't cache if single item exceeds limit
    if (size > this.maxSizeBytes / 2) {
      return false;
    }

    // Evict oldest items if needed
    while (this.currentSize + size > this.maxSizeBytes && this.cache.size > 0) {
      this._evictOldest();
    }

    // Remove existing entry if present
    if (this.cache.has(key)) {
      const existing = this.cache.get(key);
      this.currentSize -= existing.buffer.length;
    }

    this.cache.set(key, {
      buffer,
      size,
      lastAccess: Date.now()
    });
    this.currentSize += size;

    return true;
  }

  /**
   * Check if image is cached
   * @param {string} key - Image path/key
   * @returns {boolean}
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Evict the least recently accessed item
   * @private
   */
  _evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      this.currentSize -= entry.size;
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clear all cached images
   */
  clear() {
    this.cache.clear();
    this.currentSize = 0;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    return {
      itemCount: this.cache.size,
      currentSizeBytes: this.currentSize,
      currentSizeMB: Math.round(this.currentSize / 1024 / 1024 * 100) / 100,
      maxSizeMB: Math.round(this.maxSizeBytes / 1024 / 1024),
      utilizationPercent: Math.round((this.currentSize / this.maxSizeBytes) * 100)
    };
  }
}

module.exports = {
  LRUCache,
  ImageCache
};
