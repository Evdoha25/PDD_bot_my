/**
 * Bull Queue Manager for horizontal scaling
 * Handles task distribution across multiple workers
 */

const Queue = require('bull');

class QueueManager {
  constructor(redisConfig = {}) {
    this.redisConfig = {
      host: redisConfig.host || process.env.REDIS_HOST || 'localhost',
      port: redisConfig.port || process.env.REDIS_PORT || 6379,
      password: redisConfig.password || process.env.REDIS_PASSWORD || undefined
    };
    
    this.queues = {};
    this.isEnabled = false;
  }

  /**
   * Initialize queues
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async initialize() {
    try {
      // Test Redis connection
      const Redis = require('ioredis');
      const testClient = new Redis(this.redisConfig);
      
      await new Promise((resolve, reject) => {
        testClient.on('ready', () => {
          testClient.quit();
          resolve();
        });
        testClient.on('error', (err) => {
          testClient.quit();
          reject(err);
        });
        
        // Timeout after 5 seconds
        setTimeout(() => {
          testClient.quit();
          reject(new Error('Redis connection timeout'));
        }, 5000);
      });

      // Create queues
      this.queues.messages = new Queue('pdd-messages', {
        redis: this.redisConfig,
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: 100,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000
          }
        }
      });

      this.queues.callbacks = new Queue('pdd-callbacks', {
        redis: this.redisConfig,
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: 100,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000
          }
        }
      });

      this.isEnabled = true;
      console.log('[QueueManager] Successfully connected to Redis');
      return true;
    } catch (error) {
      console.log('[QueueManager] Redis not available, using direct processing:', error.message);
      this.isEnabled = false;
      return false;
    }
  }

  /**
   * Add a message processing job to the queue
   * @param {Object} messageData - Telegram message data
   * @returns {Promise<Object|null>} Job object or null if queues disabled
   */
  async addMessageJob(messageData) {
    if (!this.isEnabled) {
      return null;
    }

    return await this.queues.messages.add('process-message', messageData, {
      priority: 1
    });
  }

  /**
   * Add a callback processing job to the queue
   * @param {Object} callbackData - Telegram callback data
   * @returns {Promise<Object|null>} Job object or null if queues disabled
   */
  async addCallbackJob(callbackData) {
    if (!this.isEnabled) {
      return null;
    }

    return await this.queues.callbacks.add('process-callback', callbackData, {
      priority: 1
    });
  }

  /**
   * Register message processor
   * @param {Function} processor - Async function to process messages
   */
  processMessages(processor) {
    if (!this.isEnabled) {
      return;
    }

    this.queues.messages.process('process-message', async (job) => {
      return await processor(job.data);
    });
  }

  /**
   * Register callback processor
   * @param {Function} processor - Async function to process callbacks
   */
  processCallbacks(processor) {
    if (!this.isEnabled) {
      return;
    }

    this.queues.callbacks.process('process-callback', async (job) => {
      return await processor(job.data);
    });
  }

  /**
   * Get queue statistics
   * @returns {Promise<Object>} Queue stats
   */
  async getStats() {
    if (!this.isEnabled) {
      return { enabled: false };
    }

    const [messageStats, callbackStats] = await Promise.all([
      this.queues.messages.getJobCounts(),
      this.queues.callbacks.getJobCounts()
    ]);

    return {
      enabled: true,
      messages: messageStats,
      callbacks: callbackStats
    };
  }

  /**
   * Gracefully shutdown queues
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (!this.isEnabled) {
      return;
    }

    await Promise.all([
      this.queues.messages?.close(),
      this.queues.callbacks?.close()
    ]);

    console.log('[QueueManager] Queues closed');
  }
}

module.exports = QueueManager;
