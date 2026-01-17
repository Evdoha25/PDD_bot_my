// PM2 Ecosystem Configuration for horizontal scaling
module.exports = {
  apps: [
    {
      name: 'pdd-trainer-bot',
      script: 'bot.js',
      instances: process.env.MAX_WORKERS || 4, // Number of instances (adjust based on CPU cores)
      exec_mode: 'cluster',
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        HEALTH_CHECK_PORT: 3000
      },
      env_development: {
        NODE_ENV: 'development',
        HEALTH_CHECK_PORT: 3000
      },
      // Restart on file changes (development only)
      watch: false,
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      merge_logs: true,
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      // Health check
      exp_backoff_restart_delay: 100,
      // Memory management - enable GC exposure for memory monitor
      node_args: '--expose-gc'
    }
  ]
};
