/**
 * PDD Trainer Bot - Main Entry Point
 * Telegram bot for practicing Russian driving theory (ПДД) tickets
 */

require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// Import utilities
const SessionManager = require('./utils/sessionManager');
const QueueManager = require('./queues/queueManager');
const { generateProgressBar, generateProgressText, generateStatistics } = require('./utils/progressBar');
const { generateTicketKeyboard, generateAnswerKeyboard, generateCompletionKeyboard, removeKeyboard } = require('./utils/keyboard');

// Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SESSION_TTL = parseInt(process.env.SESSION_TTL_MINUTES) || 30;

// Validate token
if (!BOT_TOKEN) {
  console.error('Error: TELEGRAM_BOT_TOKEN is not set in environment variables');
  console.error('Please copy .env.example to .env and set your bot token');
  process.exit(1);
}

// Load questions data
let questions = [];
try {
  const questionsPath = path.join(__dirname, 'pdd_questions.json');
  const questionsData = fs.readFileSync(questionsPath, 'utf8');
  questions = JSON.parse(questionsData);
  console.log(`[Bot] Loaded ${questions.length} questions`);
} catch (error) {
  console.error('Error loading questions:', error.message);
  process.exit(1);
}

// Create indexes for fast question lookup
const questionsByTicket = {};
const questionById = {};

questions.forEach(q => {
  if (!questionsByTicket[q.ticketNumber]) {
    questionsByTicket[q.ticketNumber] = [];
  }
  questionsByTicket[q.ticketNumber].push(q);
  questionById[q.questionId] = q;
});

console.log(`[Bot] Indexed ${Object.keys(questionsByTicket).length} tickets`);

// Initialize session manager
const sessionManager = new SessionManager(SESSION_TTL);

// Initialize queue manager
const queueManager = new QueueManager();

// Initialize Telegram bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('[Bot] Starting PDD Trainer Bot...');

// ==================== Helper Functions ====================

/**
 * Get questions for a specific ticket
 * @param {number} ticketNumber - Ticket number (1-40)
 * @returns {Array} Array of questions
 */
function getTicketQuestions(ticketNumber) {
  return questionsByTicket[ticketNumber] || [];
}

/**
 * Get current question for user session
 * @param {Object} session - User session
 * @returns {Object|null} Current question or null
 */
function getCurrentQuestion(session) {
  const ticketQuestions = getTicketQuestions(session.currentTicket);
  return ticketQuestions[session.currentQuestion - 1] || null;
}

/**
 * Send question to user
 * @param {number} chatId - Telegram chat ID
 * @param {Object} question - Question object
 * @param {Object} session - User session
 */
async function sendQuestion(chatId, question, session) {
  const ticketQuestions = getTicketQuestions(session.currentTicket);
  const totalQuestions = ticketQuestions.length;
  
  // Generate progress bar
  const progressBar = generateProgressBar(session.currentQuestion, totalQuestions);
  const progressText = generateProgressText(session.currentQuestion, totalQuestions);
  
  // Prepare message text
  const messageText = `${progressText}\n${progressBar}\n\n${question.text}`;
  
  // Prepare answer keyboard
  const keyboard = generateAnswerKeyboard(question.options, question.questionId);
  
  // Check if image exists
  const imagePath = path.join(__dirname, question.imageUrl);
  
  try {
    if (fs.existsSync(imagePath)) {
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
  const ticketQuestions = getTicketQuestions(ticketNumber);
  
  if (ticketQuestions.length === 0) {
    await bot.sendMessage(chatId, `❌ Билет ${ticketNumber} не найден. Пожалуйста, выберите другой билет.`);
    await sendTicketSelection(chatId);
    return;
  }
  
  // Create new session
  const session = sessionManager.set(userId, {
    currentTicket: ticketNumber,
    currentQuestion: 1,
    correctAnswers: 0,
    incorrectAnswers: 0,
    startTime: new Date().toISOString()
  });
  
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
  
  const question = questionById[questionId];
  
  if (!question) {
    await bot.answerCallbackQuery(callbackQueryId, {
      text: '❌ Вопрос не найден',
      show_alert: true
    });
    return;
  }
  
  // Check if answer is correct
  const isCorrect = answerIndex === question.correctAnswerIndex;
  
  // Update session
  if (isCorrect) {
    session.correctAnswers++;
    await bot.answerCallbackQuery(callbackQueryId, {
      text: '✅ Правильно!',
      show_alert: false
    });
  } else {
    session.incorrectAnswers++;
    const correctAnswer = question.options[question.correctAnswerIndex];
    await bot.answerCallbackQuery(callbackQueryId, {
      text: `❌ Неправильно!\n\nПравильный ответ:\n${correctAnswer}`,
      show_alert: true
    });
  }
  
  // Move to next question
  session.currentQuestion++;
  sessionManager.update(userId, session);
  
  // Check if ticket is completed
  const ticketQuestions = getTicketQuestions(session.currentTicket);
  
  if (session.currentQuestion > ticketQuestions.length) {
    // Ticket completed - show statistics
    const stats = generateStatistics(
      session.correctAnswers,
      session.incorrectAnswers,
      session.currentTicket
    );
    
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
  const queueStats = await queueManager.getStats();
  
  let statsText = '📊 *Статистика бота*\n\n';
  statsText += `👥 Активные сессии: ${sessionStats.activeSessions}\n`;
  statsText += `⏱ TTL сессии: ${sessionStats.ttlMinutes} мин\n`;
  statsText += `📚 Всего вопросов: ${questions.length}\n`;
  statsText += `📋 Всего билетов: ${Object.keys(questionsByTicket).length}\n\n`;
  
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
  
  // Stop polling
  await bot.stopPolling();
  
  // Clean up session manager
  sessionManager.destroy();
  
  // Close queue connections
  await queueManager.shutdown();
  
  console.log('[Bot] Shutdown complete');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ==================== Initialization ====================

async function init() {
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
