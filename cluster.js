/**
 * Node.js Cluster Setup for Horizontal Scaling
 * Forks worker processes for each CPU core
 */

const cluster = require('cluster');
const os = require('os');

// Configuration
const numCPUs = os.cpus().length;
const MAX_WORKERS = parseInt(process.env.MAX_WORKERS) || 4;
const WORKER_COUNT = Math.min(numCPUs, MAX_WORKERS);

if (cluster.isMaster) {
  console.log(`[Cluster] Master process ${process.pid} starting...`);
  console.log(`[Cluster] CPU cores available: ${numCPUs}`);
  console.log(`[Cluster] Starting ${WORKER_COUNT} worker(s)...`);

  // Track worker restarts
  const workerRestarts = new Map();
  const MAX_RESTARTS = 5;
  const RESTART_WINDOW_MS = 60000; // 1 minute

  // Fork workers
  for (let i = 0; i < WORKER_COUNT; i++) {
    cluster.fork();
  }

  // Handle worker exit
  cluster.on('exit', (worker, code, signal) => {
    const workerId = worker.process.pid;
    console.log(`[Cluster] Worker ${workerId} died (code: ${code}, signal: ${signal})`);

    // Check restart frequency
    const now = Date.now();
    const restarts = workerRestarts.get(workerId) || [];
    const recentRestarts = restarts.filter(t => now - t < RESTART_WINDOW_MS);

    if (recentRestarts.length >= MAX_RESTARTS) {
      console.error(`[Cluster] Worker ${workerId} has restarted too many times. Not restarting.`);
      return;
    }

    // Record restart
    recentRestarts.push(now);
    
    // Fork new worker
    console.log('[Cluster] Starting new worker...');
    const newWorker = cluster.fork();
    workerRestarts.set(newWorker.process.pid, recentRestarts);
  });

  // Handle worker online
  cluster.on('online', (worker) => {
    console.log(`[Cluster] Worker ${worker.process.pid} is online`);
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n[Cluster] Received ${signal}. Shutting down workers...`);
    
    for (const id in cluster.workers) {
      cluster.workers[id].kill('SIGTERM');
    }

    // Force exit after timeout
    setTimeout(() => {
      console.log('[Cluster] Forcing exit...');
      process.exit(0);
    }, 10000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Log master process info
  console.log(`[Cluster] Master ready. PID: ${process.pid}`);

} else {
  // Worker process - run the bot
  console.log(`[Cluster] Worker ${process.pid} starting bot...`);
  require('./bot.js');
}
