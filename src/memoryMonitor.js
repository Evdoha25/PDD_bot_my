/**
 * Memory Monitor - Tracks memory usage and triggers alerts
 */

const os = require('os');

class MemoryMonitor {
  /**
   * Create a memory monitor
   * @param {Object} options - Configuration options
   * @param {number} options.warningThreshold - Warning threshold percentage (default 70%)
   * @param {number} options.criticalThreshold - Critical threshold percentage (default 80%)
   * @param {number} options.checkIntervalMs - Check interval in ms (default 60000)
   */
  constructor(options = {}) {
    this.warningThreshold = options.warningThreshold || 70;
    this.criticalThreshold = options.criticalThreshold || 80;
    this.checkIntervalMs = options.checkIntervalMs || 60000;
    
    this.interval = null;
    this.lastAlert = null;
    this.alertCooldownMs = 300000; // 5 minutes between alerts
    
    this.onWarning = null;
    this.onCritical = null;
    this.onRecovered = null;
    
    this.lastStatus = 'normal';
  }

  /**
   * Start monitoring
   */
  start() {
    if (this.interval) {
      return;
    }

    console.log(`[MemoryMonitor] Starting (warning: ${this.warningThreshold}%, critical: ${this.criticalThreshold}%)`);
    
    this.interval = setInterval(() => {
      this.check();
    }, this.checkIntervalMs);

    // Initial check
    this.check();
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('[MemoryMonitor] Stopped');
    }
  }

  /**
   * Check memory usage
   * @returns {Object} Memory status
   */
  check() {
    const stats = this.getStats();
    const status = this._determineStatus(stats.usedPercent);

    // Handle status changes
    if (status !== this.lastStatus) {
      this._handleStatusChange(status, stats);
      this.lastStatus = status;
    }

    return stats;
  }

  /**
   * Get current memory statistics
   * @returns {Object} Memory stats
   */
  getStats() {
    const memUsage = process.memoryUsage();
    const heapUsed = memUsage.heapUsed;
    const heapTotal = memUsage.heapTotal;
    
    // Calculate process memory percentage of heap
    const heapUsedPercent = Math.round((heapUsed / heapTotal) * 100);
    
    // System memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const systemUsedPercent = Math.round((usedMem / totalMem) * 100);

    return {
      process: {
        heapUsed: heapUsed,
        heapUsedMB: Math.round(heapUsed / 1024 / 1024),
        heapTotal: heapTotal,
        heapTotalMB: Math.round(heapTotal / 1024 / 1024),
        heapUsedPercent,
        rss: memUsage.rss,
        rssMB: Math.round(memUsage.rss / 1024 / 1024),
        external: memUsage.external,
        externalMB: Math.round(memUsage.external / 1024 / 1024)
      },
      system: {
        total: totalMem,
        totalMB: Math.round(totalMem / 1024 / 1024),
        free: freeMem,
        freeMB: Math.round(freeMem / 1024 / 1024),
        used: usedMem,
        usedMB: Math.round(usedMem / 1024 / 1024),
        usedPercent: systemUsedPercent
      },
      usedPercent: heapUsedPercent,
      status: this._determineStatus(heapUsedPercent)
    };
  }

  /**
   * Determine status based on usage percentage
   * @private
   */
  _determineStatus(usedPercent) {
    if (usedPercent >= this.criticalThreshold) {
      return 'critical';
    }
    if (usedPercent >= this.warningThreshold) {
      return 'warning';
    }
    return 'normal';
  }

  /**
   * Handle status change
   * @private
   */
  _handleStatusChange(newStatus, stats) {
    const now = Date.now();

    // Check cooldown
    if (this.lastAlert && (now - this.lastAlert) < this.alertCooldownMs) {
      return;
    }

    switch (newStatus) {
      case 'critical':
        console.warn(`[MemoryMonitor] ⚠️ CRITICAL: Memory usage at ${stats.usedPercent}%`);
        if (this.onCritical) {
          this.onCritical(stats);
        }
        this.lastAlert = now;
        break;

      case 'warning':
        console.warn(`[MemoryMonitor] ⚠️ WARNING: Memory usage at ${stats.usedPercent}%`);
        if (this.onWarning) {
          this.onWarning(stats);
        }
        this.lastAlert = now;
        break;

      case 'normal':
        if (this.lastStatus !== 'normal') {
          console.log(`[MemoryMonitor] ✅ Memory recovered: ${stats.usedPercent}%`);
          if (this.onRecovered) {
            this.onRecovered(stats);
          }
        }
        break;
    }
  }

  /**
   * Set warning callback
   * @param {Function} callback - Function to call on warning
   */
  setWarningHandler(callback) {
    this.onWarning = callback;
  }

  /**
   * Set critical callback
   * @param {Function} callback - Function to call on critical
   */
  setCriticalHandler(callback) {
    this.onCritical = callback;
  }

  /**
   * Set recovered callback
   * @param {Function} callback - Function to call on recovery
   */
  setRecoveredHandler(callback) {
    this.onRecovered = callback;
  }

  /**
   * Force garbage collection if available
   * @returns {boolean} Whether GC was triggered
   */
  forceGC() {
    if (global.gc) {
      console.log('[MemoryMonitor] Forcing garbage collection...');
      global.gc();
      return true;
    }
    return false;
  }
}

module.exports = MemoryMonitor;
