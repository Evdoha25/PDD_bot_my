/**
 * PDD Trainer Bot - Main Entry Point
 * Telegram bot for practicing Russian driving theory (ПДД) tickets
 */

require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

// Import utilities
const SessionManager = require('./utils/sessionManager');
const QueueManager = require('./queues/queueManager');
const RateLimiter = require('./utils/rateLimiter');
const { generateProgressBar, generateProgressText } = require('./utils/progressBar');
const { generateTicketKeyboard, generateAnswerKeyboard, generateCompletionKeyboard, removeKeyboard } = require('./utils/keyboard');

// Import services
const QuestionService = require('./src/questionService');
const ImageService = require('./src/imageService');
const HealthCheckServer = require('./src/healthCheck');
const MemoryMonitor = require('./src/memoryMonitor');
const { generateCompletionStats } = require('./src/statistics');

// Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SESSION_TTL = parseInt(process.env.SESSION_TTL_MINUTES) || 30;
const MAX_SESSIONS = parseInt(process.env.MAX_SESSIONS) || 5000;
const RATE_LIMIT_REQUESTS = parseInt(process.env.RATE_LIMIT_REQUESTS) || 10;
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000;
const HEALTH_CHECK_PORT = parseInt(process.env.HEALTH_CHECK_PORT) || 3000;
const MEMORY_WARNING_THRESHOLD = parseInt(process.env.MEMORY_WARNING_THRESHOLD) || 70;
const MEMORY_CRITICAL_THRESHOLD = parseInt(process.env.MEMORY_CRITICAL_THRESHOLD) || 80;

// Validate token
if (!BOT_TOKEN) {
  console.error('Error: TELEGRAM_BOT_TOKEN is not set in environment variables');
  console.error('Please copy .env.example to .env and set your bot token');
  process.exit(1);
}

// Initialize Question Service
const questionService = new QuestionService();
const questionsPath = path.join(__dirname, 'pdd_questions.json');
if (!questionService.load(questionsPath)) {
  console.error('Failed to load questions. Exiting.');
  process.exit(1);
}

// Initialize Image Service
const imageService = new ImageService(__dirname);

// Initialize Session Manager with LRU cache
const sessionManager = new SessionManager(SESSION_TTL, MAX_SESSIONS);

// Initialize Rate Limiter
const rateLimiter = new RateLimiter(RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_MS);

// Initialize Queue Manager
const queueManager = new QueueManager();

// Initialize Health Check Server
const healthServer = new HealthCheckServer(HEALTH_CHECK_PORT);

// Initialize Memory Monitor
const memoryMonitor = new MemoryMonitor({
  warningThreshold: MEMORY_WARNING_THRESHOLD,
  criticalThreshold: MEMORY_CRITICAL_THRESHOLD,
  checkIntervalMs: 60000
});

// Initialize Telegram bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('[Bot] Starting PDD Trainer Bot...');

// ==================== Helper Functions ====================

/**
 * Check rate limit for a user
 * @param {number} userId - User ID
 * @param {string} callbackQueryId - Callback query ID (optional)
 * @returns {boolean} Whether the request is allowed
 */
async function checkRateLimit(userId, callbackQueryId = null) {
  const status = rateLimiter.hit(userId);
  
  if (!status.allowed) {
    const message = `⏳ Слишком много запросов. Подождите ${status.resetIn} сек.`;
    
    if (callbackQueryId) {
      await bot.answerCallbackQuery(callbackQueryId, {
        text: message,
        show_alert: true
      });
    }
    
    return false;
  }
  
  return true;
}

/**
 * Get current question for user session
 * @param {Object} session - User session
 * @returns {Object|null} Current question or null
 */
function getCurrentQuestion(session) {
  return questionService.getQuestion(session.currentTicket, session.currentQuestion);
}

/**
 * Send question to user
 * @param {number} chatId - Telegram chat ID
 * @param {Object} question - Question object
 * @param {Object} session - User session
 */
async function sendQuestion(chatId, question, session) {
  const totalQuestions = questionService.getTicketQuestionCount(session.currentTicket);
  
  // Generate progress bar
  const progressBar = generateProgressBar(session.currentQuestion, totalQuestions);
  const progressText = generateProgressText(session.currentQuestion, totalQuestions);
  
  // Prepare message text
  const messageText = `${progressText}\n${progressBar}\n\n${question.text}`;
  
  // Prepare answer keyboard
  const keyboard = generateAnswerKeyboard(question.options, question.questionId);
  
  try {
    // Try to get image from cache or filesystem
    if (question.imageUrl && imageService.imageExists(question.imageUrl)) {
      const imagePath = imageService.getFullPath(question.imageUrl);
      // Send photo with caption
      await bot.sendPhoto(chatId, imagePath, {
        caption: messageText,
        reply_markup: keyboard
      });
    } else {
      // Send text message only
      await bot.sendMessage(chatId, messageText, {
        reply_markup: keyboard
      });
    }
  } catch (error) {
    console.error(`[Bot] Error sending question: ${error.message}`);
    // Fallback to text message
    await bot.sendMessage(chatId, messageText, {
      reply_markup: keyboard
    });
  }
}

/**
 * Send ticket selection menu
 * @param {number} chatId - Telegram chat ID
 */
async function sendTicketSelection(chatId) {
  const welcomeText = '🚗 Добро пожаловать в ПДД Тренер!\n\n' +
    'Выберите номер билета для начала тренировки:';
  
  await bot.sendMessage(chatId, welcomeText, {
    reply_markup: generateTicketKeyboard()
  });
}

/**
 * Start a new ticket
 * @param {number} chatId - Telegram chat ID
 * @param {number} userId - Telegram user ID
 * @param {number} ticketNumber - Ticket number to start
 */
async function startTicket(chatId, userId, ticketNumber) {
  if (!questionService.ticketExists(ticketNumber)) {
    await bot.sendMessage(chatId, `❌ Билет ${ticketNumber} не найден. Пожалуйста, выберите другой билет.`);
    await sendTicketSelection(chatId);
    return;
  }
  
  const ticketQuestions = questionService.getTicketQuestions(ticketNumber);
  
  // Create new session
  const session = sessionManager.set(userId, {
    currentTicket: ticketNumber,
    currentQuestion: 1,
    correctAnswers: 0,
    incorrectAnswers: 0,
    startTime: new Date().toISOString()
  });
  
  // Preload images for this ticket (optional optimization)
  imageService.preloadTicketImages(ticketQuestions);
  
  // Remove reply keyboard and send confirmation
  await bot.sendMessage(chatId, `📋 Билет ${ticketNumber}\nВсего вопросов: ${ticketQuestions.length}\n\nНачинаем!`, {
    reply_markup: removeKeyboard()
  });
  
  // Send first question
  const firstQuestion = ticketQuestions[0];
  await sendQuestion(chatId, firstQuestion, session);
}

/**
 * Process user's answer
 * @param {number} chatId - Telegram chat ID
 * @param {number} userId - Telegram user ID
 * @param {string} questionId - Question ID
 * @param {number} answerIndex - Selected answer index
 * @param {string} callbackQueryId - Callback query ID for popup
 */
async function processAnswer(chatId, userId, questionId, answerIndex, callbackQueryId) {
  const session = sessionManager.get(userId);
  
  if (!session) {
    await bot.answerCallbackQuery(callbackQueryId, {
      text: '⚠️ Сессия истекла. Начните заново с /start',
      show_alert: true
    });
    return;
  }
  
  // Validate answer using question service
  const validation = questionService.validateAnswer(questionId, answerIndex);
  
  if (validation.error) {
    await bot.answerCallbackQuery(callbackQueryId, {
      text: '❌ Вопрос не найден',
      show_alert: true
    });
    return;
  }
  
  // Update session
  if (validation.isCorrect) {
    session.correctAnswers++;
    await bot.answerCallbackQuery(callbackQueryId, {
      text: '✅ Правильно!',
      show_alert: false
    });
  } else {
    session.incorrectAnswers++;
    await bot.answerCallbackQuery(callbackQueryId, {
      text: `❌ Неправильно!\n\nПравильный ответ:\n${validation.correctAnswer}`,
      show_alert: true
    });
  }
  
  // Move to next question
  session.currentQuestion++;
  sessionManager.update(userId, session);
  
  // Check if ticket is completed
  const totalQuestions = questionService.getTicketQuestionCount(session.currentTicket);
  
  if (session.currentQuestion > totalQuestions) {
    // Ticket completed - show statistics
    const stats = generateCompletionStats({
      correct: session.correctAnswers,
      incorrect: session.incorrectAnswers,
      ticketNumber: session.currentTicket,
      startTime: session.startTime
    });
    
    await bot.sendMessage(chatId, stats, {
      reply_markup: generateCompletionKeyboard(session.currentTicket)
    });
    
    // Clear session
    sessionManager.delete(userId);
  } else {
    // Send next question
    const nextQuestion = getCurrentQuestion(session);
    if (nextQuestion) {
      await sendQuestion(chatId, nextQuestion, session);
    }
  }
}

// ==================== Command Handlers ====================

// /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  // Clear any existing session
  sessionManager.delete(userId);
  
  await sendTicketSelection(chatId);
});

// /help command
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  
  const helpText = '📖 *Справка по ПДД Тренер*\n\n' +
    '*Команды:*\n' +
    '/start - Начать тренировку\n' +
    '/help - Показать справку\n' +
    '/stats - Статистика сессий (админ)\n\n' +
    '*Как пользоваться:*\n' +
    '1. Выберите номер билета (1-40)\n' +
    '2. Отвечайте на вопросы, нажимая кнопки\n' +
    '3. После каждого ответа вы увидите результат\n' +
    '4. В конце билета отобразится статистика\n\n' +
    '*Удачи на экзамене!* 🍀';
  
  await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
});

// /stats command (admin - for monitoring)
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  
  const sessionStats = sessionManager.getStats();
  const questionStats = questionService.getStats();
  const imageStats = imageService.getStats();
  const memoryStats = memoryMonitor.getStats();
  const rateLimitStats = rateLimiter.getStats();
  const queueStats = await queueManager.getStats();
  
  let statsText = '📊 *Статистика бота*\n\n';
  
  // Session stats
  statsText += '*Сессии:*\n';
  statsText += `👥 Активные: ${sessionStats.activeSessions}/${sessionStats.maxSessions}\n`;
  statsText += `⏱ TTL: ${sessionStats.ttlMinutes} мин\n`;
  statsText += `📈 Использование: ${sessionStats.utilizationPercent}%\n\n`;
  
  // Question stats
  statsText += '*Вопросы:*\n';
  statsText += `📚 Всего: ${questionStats.totalQuestions}\n`;
  statsText += `📋 Билетов: ${questionStats.totalTickets}\n\n`;
  
  // Memory stats
  statsText += '*Память:*\n';
  statsText += `💾 Heap: ${memoryStats.process.heapUsedMB}/${memoryStats.process.heapTotalMB} MB\n`;
  statsText += `📊 Статус: ${memoryStats.status}\n\n`;
  
  // Image cache stats
  statsText += '*Кэш изображений:*\n';
  statsText += `🖼 Файлов: ${imageStats.cache.itemCount}\n`;
  statsText += `💿 Размер: ${imageStats.cache.currentSizeMB}/${imageStats.cache.maxSizeMB} MB\n`;
  statsText += `🎯 Hit rate: ${imageStats.hitRate}\n\n`;
  
  // Rate limiter stats
  statsText += '*Rate Limiter:*\n';
  statsText += `👤 Отслеживается: ${rateLimitStats.trackedUsers} пользователей\n`;
  statsText += `⚡ Лимит: ${rateLimitStats.maxRequests}/${rateLimitStats.windowSeconds}сек\n\n`;
  
  // Queue stats
  if (queueStats.enabled) {
    statsText += '*Очереди (Redis):*\n';
    statsText += `📨 Сообщения: ${JSON.stringify(queueStats.messages)}\n`;
    statsText += `🔔 Callbacks: ${JSON.stringify(queueStats.callbacks)}\n`;
  } else {
    statsText += '⚙️ Режим: прямая обработка (без Redis)\n';
  }
  
  await bot.sendMessage(chatId, statsText, { parse_mode: 'Markdown' });
});

// ==================== Message Handlers ====================

// Handle ticket selection from reply keyboard
bot.on('message', async (msg) => {
  // Skip commands
  if (msg.text && msg.text.startsWith('/')) {
    return;
  }
  
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text || '';
  
  // Check for ticket selection pattern (📋 1, 📋 2, etc.)
  const ticketMatch = text.match(/📋\s*(\d+)/);
  
  if (ticketMatch) {
    const ticketNumber = parseInt(ticketMatch[1]);
    
    if (ticketNumber >= 1 && ticketNumber <= 40) {
      await startTicket(chatId, userId, ticketNumber);
    } else {
      await bot.sendMessage(chatId, '❌ Пожалуйста, выберите билет от 1 до 40');
    }
  }
});

// ==================== Callback Query Handlers ====================

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;
  
  try {
    // Check rate limit
    if (!await checkRateLimit(userId, query.id)) {
      return;
    }
    
    // Handle answer callbacks
    if (data.startsWith('answer_')) {
      const parts = data.split('_');
      const questionId = `${parts[1]}_${parts[2]}`;
      const answerIndex = parseInt(parts[3]);
      
      await processAnswer(chatId, userId, questionId, answerIndex, query.id);
    }
    // Handle restart ticket
    else if (data.startsWith('restart_')) {
      const ticketNumber = parseInt(data.split('_')[1]);
      await bot.answerCallbackQuery(query.id);
      await startTicket(chatId, userId, ticketNumber);
    }
    // Handle choose another ticket
    else if (data === 'choose_ticket') {
      await bot.answerCallbackQuery(query.id);
      sessionManager.delete(userId);
      await sendTicketSelection(chatId);
    }
  } catch (error) {
    console.error(`[Bot] Error handling callback: ${error.message}`);
    await bot.answerCallbackQuery(query.id, {
      text: '❌ Произошла ошибка. Попробуйте ещё раз.',
      show_alert: true
    });
  }
});

// ==================== Error Handling ====================

bot.on('polling_error', (error) => {
  console.error('[Bot] Polling error:', error.message);
});

bot.on('error', (error) => {
  console.error('[Bot] Error:', error.message);
});

// ==================== Graceful Shutdown ====================

async function shutdown(signal) {
  console.log(`\n[Bot] Received ${signal}. Shutting down gracefully...`);
  
  // Set health check to unhealthy
  healthServer.setHealthy(false);
  
  // Stop polling
  await bot.stopPolling();
  
  // Stop memory monitor
  memoryMonitor.stop();
  
  // Stop rate limiter
  rateLimiter.destroy();
  
  // Clean up session manager
  sessionManager.destroy();
  
  // Stop health check server
  await healthServer.stop();
  
  // Close queue connections
  await queueManager.shutdown();
  
  console.log('[Bot] Shutdown complete');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ==================== Initialization ====================

async function init() {
  // Set up health check stats provider
  healthServer.setStatsProvider(() => ({
    sessions: sessionManager.getStats(),
    questions: questionService.getStats(),
    images: imageService.getStats(),
    memory: memoryMonitor.getStats(),
    rateLimit: rateLimiter.getStats()
  }));
  
  // Start health check server
  try {
    await healthServer.start();
  } catch (error) {
    console.warn('[Bot] Health check server failed to start:', error.message);
  }
  
  // Start memory monitor
  memoryMonitor.setWarningHandler((stats) => {
    console.warn(`[Bot] Memory warning: ${stats.usedPercent}% - consider cleanup`);
  });
  
  memoryMonitor.setCriticalHandler((stats) => {
    console.error(`[Bot] Memory critical: ${stats.usedPercent}% - triggering GC`);
    memoryMonitor.forceGC();
    // Clear image cache on critical memory
    imageService.clearCache();
  });
  
  memoryMonitor.start();
  
  // Try to initialize queue manager (optional - works without Redis)
  await queueManager.initialize();
  
  // If queue is enabled, set up processors
  if (queueManager.isEnabled) {
    queueManager.processMessages(async (data) => {
      // Queue-based message processing would go here
      console.log('[Queue] Processing message:', data);
    });
    
    queueManager.processCallbacks(async (data) => {
      // Queue-based callback processing would go here
      console.log('[Queue] Processing callback:', data);
    });
  }
  
  console.log('[Bot] PDD Trainer Bot is running!');
  console.log(`[Bot] Session TTL: ${SESSION_TTL} minutes`);
  console.log(`[Bot] Max sessions: ${MAX_SESSIONS}`);
  console.log(`[Bot] Rate limit: ${RATE_LIMIT_REQUESTS} requests per ${RATE_LIMIT_WINDOW_MS / 1000} seconds`);
  console.log('[Bot] Press Ctrl+C to stop');
}

// Start the bot
init().catch(error => {
  console.error('[Bot] Initialization error:', error);
  process.exit(1);
});

// Signal that bot is ready (for PM2)
if (process.send) {
  process.send('ready');
}
