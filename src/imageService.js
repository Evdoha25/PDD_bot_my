/**
 * Image Service - Handles image loading and caching
 */

const fs = require('fs');
const path = require('path');
const { ImageCache } = require('../utils/cache');

class ImageService {
  /**
   * Create an image service
   * @param {string} basePath - Base directory for images
   * @param {number} maxCacheSizeMB - Maximum cache size in MB (default 50MB)
   */
  constructor(basePath, maxCacheSizeMB = 50) {
    this.basePath = basePath;
    this.cache = new ImageCache(maxCacheSizeMB * 1024 * 1024);
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      loadErrors: 0
    };
  }

  /**
   * Get image buffer, using cache when available
   * @param {string} imagePath - Relative path to image
   * @returns {Buffer|null} Image buffer or null if not found
   */
  getImage(imagePath) {
    const fullPath = path.join(this.basePath, imagePath);
    const cacheKey = imagePath;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      this.stats.cacheHits++;
      return this.cache.get(cacheKey);
    }

    // Load from disk
    try {
      if (fs.existsSync(fullPath)) {
        const buffer = fs.readFileSync(fullPath);
        this.cache.set(cacheKey, buffer);
        this.stats.cacheMisses++;
        return buffer;
      }
    } catch (error) {
      console.error(`[ImageService] Error loading image ${imagePath}:`, error.message);
      this.stats.loadErrors++;
    }

    return null;
  }

  /**
   * Check if an image exists
   * @param {string} imagePath - Relative path to image
   * @returns {boolean}
   */
  imageExists(imagePath) {
    // Check cache first
    if (this.cache.has(imagePath)) {
      return true;
    }

    // Check filesystem
    const fullPath = path.join(this.basePath, imagePath);
    return fs.existsSync(fullPath);
  }

  /**
   * Get full path to an image
   * @param {string} imagePath - Relative path to image
   * @returns {string} Full path
   */
  getFullPath(imagePath) {
    return path.join(this.basePath, imagePath);
  }

  /**
   * Preload images for a specific ticket
   * @param {Array} questions - Array of question objects
   */
  preloadTicketImages(questions) {
    for (const question of questions) {
      if (question.imageUrl) {
        this.getImage(question.imageUrl);
      }
    }
  }

  /**
   * Clear the image cache
   */
  clearCache() {
    this.cache.clear();
    console.log('[ImageService] Cache cleared');
  }

  /**
   * Get service statistics
   * @returns {Object} Stats
   */
  getStats() {
    const cacheStats = this.cache.getStats();
    const hitRate = this.stats.cacheHits + this.stats.cacheMisses > 0
      ? Math.round((this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100)
      : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      cache: cacheStats
    };
  }
}

module.exports = ImageService;
