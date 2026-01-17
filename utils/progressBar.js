/**
 * Progress bar utility for visualizing ticket completion
 */

/**
 * Generate a text-based progress bar
 * @param {number} current - Current question number (1-based)
 * @param {number} total - Total number of questions
 * @param {number} barLength - Length of the progress bar (default: 10)
 * @returns {string} Progress bar string
 */
function generateProgressBar(current, total, barLength = 10) {
  const progress = current / total;
  const filledLength = Math.round(progress * barLength);
  const emptyLength = barLength - filledLength;
  
  const filled = '🟩'.repeat(filledLength);
  const empty = '⬜'.repeat(emptyLength);
  
  return `${filled}${empty} ${current}/${total}`;
}

/**
 * Generate a simple text progress indicator
 * @param {number} current - Current question number (1-based)
 * @param {number} total - Total number of questions
 * @returns {string} Progress text
 */
function generateProgressText(current, total) {
  return `📝 Вопрос ${current} из ${total}`;
}

/**
 * Generate completion statistics
 * @param {number} correct - Number of correct answers
 * @param {number} incorrect - Number of incorrect answers
 * @param {number} ticketNumber - Ticket number
 * @returns {string} Statistics message
 */
function generateStatistics(correct, incorrect, ticketNumber) {
  const total = correct + incorrect;
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
  
  let emoji;
  if (percentage >= 90) {
    emoji = '🏆';
  } else if (percentage >= 70) {
    emoji = '👍';
  } else if (percentage >= 50) {
    emoji = '📚';
  } else {
    emoji = '💪';
  }

  return `${emoji} Билет ${ticketNumber} завершён!\n\n` +
    `✅ Правильных: ${correct}\n` +
    `❌ Неправильных: ${incorrect}\n` +
    `📊 Результат: ${percentage}%`;
}

module.exports = {
  generateProgressBar,
  generateProgressText,
  generateStatistics
};
