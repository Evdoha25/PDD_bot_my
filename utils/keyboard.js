/**
 * Keyboard generation utilities for Telegram bot
 */

/**
 * Generate ticket selection keyboard (40 tickets, 4 columns × 10 rows)
 * Layout optimized for mobile display as per PRD requirements
 * @returns {Object} Reply keyboard markup
 */
function generateTicketKeyboard() {
  const keyboard = [];
  const ticketsPerRow = 4;
  const totalTickets = 40;

  for (let i = 0; i < totalTickets; i += ticketsPerRow) {
    const row = [];
    for (let j = i; j < Math.min(i + ticketsPerRow, totalTickets); j++) {
      row.push({ text: `📋 ${j + 1}` });
    }
    keyboard.push(row);
  }

  return {
    keyboard,
    resize_keyboard: true,
    one_time_keyboard: true
  };
}

/**
 * Generate answer inline keyboard
 * @param {string[]} options - Answer options
 * @param {string} questionId - Question identifier for callback data
 * @returns {Object} Inline keyboard markup
 */
function generateAnswerKeyboard(options, questionId) {
  const keyboard = options.map((option, index) => [{
    text: option,
    callback_data: `answer_${questionId}_${index}`
  }]);

  return {
    inline_keyboard: keyboard
  };
}

/**
 * Generate post-completion keyboard
 * @param {number} ticketNumber - Current ticket number
 * @returns {Object} Inline keyboard markup
 */
function generateCompletionKeyboard(ticketNumber) {
  return {
    inline_keyboard: [
      [
        { text: '🔄 Повторить билет', callback_data: `restart_${ticketNumber}` }
      ],
      [
        { text: '📋 Выбрать другой билет', callback_data: 'choose_ticket' }
      ]
    ]
  };
}

/**
 * Remove keyboard
 * @returns {Object} Remove keyboard markup
 */
function removeKeyboard() {
  return {
    remove_keyboard: true
  };
}

module.exports = {
  generateTicketKeyboard,
  generateAnswerKeyboard,
  generateCompletionKeyboard,
  removeKeyboard
};
