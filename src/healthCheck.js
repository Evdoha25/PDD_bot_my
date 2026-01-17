/**
 * Health Check HTTP Server
 * Provides endpoints for monitoring and load balancer health checks
 */

const http = require('http');

class HealthCheckServer {
  /**
   * Create a health check server
   * @param {number} port - HTTP port (default 3000)
   */
  constructor(port = 3000) {
    this.port = port;
    this.server = null;
    this.isHealthy = true;
    this.statsProvider = null;
    this.startTime = Date.now();
  }

  /**
   * Set the stats provider function
   * @param {Function} provider - Function that returns stats object
   */
  setStatsProvider(provider) {
    this.statsProvider = provider;
  }

  /**
   * Set health status
   * @param {boolean} healthy - Whether the service is healthy
   */
  setHealthy(healthy) {
    this.isHealthy = healthy;
  }

  /**
   * Start the health check server
   * @returns {Promise<void>}
   */
  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this._handleRequest(req, res);
      });

      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.log(`[HealthCheck] Port ${this.port} in use, trying ${this.port + 1}`);
          this.port++;
          this.server.listen(this.port);
        } else {
          console.error('[HealthCheck] Server error:', error.message);
          reject(error);
        }
      });

      this.server.listen(this.port, () => {
        console.log(`[HealthCheck] Server running on port ${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Handle incoming HTTP request
   * @private
   */
  _handleRequest(req, res) {
    const url = req.url;

    // Health check endpoint
    if (url === '/health') {
      return this._handleHealth(req, res);
    }

    // Ready check endpoint
    if (url === '/ready') {
      return this._handleReady(req, res);
    }

    // Stats endpoint
    if (url === '/stats') {
      return this._handleStats(req, res);
    }

    // Memory usage endpoint
    if (url === '/memory') {
      return this._handleMemory(req, res);
    }

    // 404 for other endpoints
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  /**
   * Handle /health endpoint
   * @private
   */
  _handleHealth(req, res) {
    const status = this.isHealthy ? 200 : 503;
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: this.isHealthy ? 'healthy' : 'unhealthy',
      uptime: uptime,
      uptimeFormatted: this._formatUptime(uptime),
      pid: process.pid,
      timestamp: new Date().toISOString()
    }));
  }

  /**
   * Handle /ready endpoint
   * @private
   */
  _handleReady(req, res) {
    const status = this.isHealthy ? 200 : 503;
    
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ready: this.isHealthy
    }));
  }

  /**
   * Handle /stats endpoint
   * @private
   */
  _handleStats(req, res) {
    let stats = {};
    
    if (this.statsProvider) {
      try {
        stats = this.statsProvider();
      } catch (error) {
        console.error('[HealthCheck] Error getting stats:', error.message);
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ...stats,
      pid: process.pid,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString()
    }));
  }

  /**
   * Handle /memory endpoint
   * @private
   */
  _handleMemory(req, res) {
    const memUsage = process.memoryUsage();
    const totalMem = require('os').totalmem();
    const usedPercent = Math.round((memUsage.heapUsed / totalMem) * 100);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
      external: Math.round(memUsage.external / 1024 / 1024) + ' MB',
      rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
      systemTotal: Math.round(totalMem / 1024 / 1024) + ' MB',
      usedPercent,
      pid: process.pid
    }));
  }

  /**
   * Format uptime in human readable format
   * @private
   */
  _formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);

    return parts.join(' ');
  }

  /**
   * Stop the health check server
   * @returns {Promise<void>}
   */
  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('[HealthCheck] Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = HealthCheckServer;
