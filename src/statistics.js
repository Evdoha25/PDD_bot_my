/**
 * Statistics Service - Handles calculation and formatting of results
 */

/**
 * Calculate score percentage
 * @param {number} correct - Number of correct answers
 * @param {number} total - Total number of questions
 * @returns {number} Percentage score (0-100)
 */
function calculatePercentage(correct, total) {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

/**
 * Get grade emoji based on score
 * @param {number} percentage - Score percentage
 * @returns {string} Grade emoji
 */
function getGradeEmoji(percentage) {
  if (percentage >= 90) return '🏆';
  if (percentage >= 70) return '👍';
  if (percentage >= 50) return '📚';
  return '💪';
}

/**
 * Get grade text in Russian
 * @param {number} percentage - Score percentage
 * @returns {string} Grade text
 */
function getGradeText(percentage) {
  if (percentage >= 90) return 'Отлично!';
  if (percentage >= 70) return 'Хорошо!';
  if (percentage >= 50) return 'Удовлетворительно';
  return 'Нужно подтянуть знания';
}

/**
 * Calculate time spent
 * @param {string|Date} startTime - Start time
 * @param {string|Date} endTime - End time (optional, defaults to now)
 * @returns {Object} { minutes: number, seconds: number, formatted: string }
 */
function calculateTimeSpent(startTime, endTime = new Date()) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end - start;
  
  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  let formatted;
  if (minutes > 0) {
    formatted = `${minutes} мин ${seconds} сек`;
  } else {
    formatted = `${seconds} сек`;
  }
  
  return { minutes, seconds, totalSeconds, formatted };
}

/**
 * Generate completion statistics message
 * @param {Object} options - Statistics options
 * @param {number} options.correct - Number of correct answers
 * @param {number} options.incorrect - Number of incorrect answers
 * @param {number} options.ticketNumber - Ticket number
 * @param {string} options.startTime - Session start time (optional)
 * @returns {string} Formatted statistics message
 */
function generateCompletionStats(options) {
  const { correct, incorrect, ticketNumber, startTime } = options;
  const total = correct + incorrect;
  const percentage = calculatePercentage(correct, total);
  const emoji = getGradeEmoji(percentage);
  const grade = getGradeText(percentage);
  
  let message = `${emoji} Билет ${ticketNumber} завершён!\n\n`;
  message += `✅ Правильных: ${correct}\n`;
  message += `❌ Неправильных: ${incorrect}\n`;
  message += `📊 Результат: ${percentage}%\n`;
  message += `\n${grade}`;
  
  // Add time if available
  if (startTime) {
    const time = calculateTimeSpent(startTime);
    message += `\n\n⏱ Время: ${time.formatted}`;
  }
  
  return message;
}

/**
 * Generate a simple progress report
 * @param {number} current - Current question number
 * @param {number} total - Total questions
 * @param {number} correct - Correct answers so far
 * @returns {string} Progress report
 */
function generateProgressReport(current, total, correct) {
  const answered = current - 1;
  const incorrect = answered - correct;
  const percentage = answered > 0 ? calculatePercentage(correct, answered) : 0;
  
  return `📊 Прогресс: ${answered}/${total} | ✅ ${correct} | ❌ ${incorrect} (${percentage}%)`;
}

/**
 * Calculate if user passed the exam
 * @param {number} correct - Number of correct answers
 * @param {number} total - Total number of questions
 * @param {number} passingPercentage - Required percentage to pass (default 80%)
 * @returns {boolean}
 */
function isPassed(correct, total, passingPercentage = 80) {
  return calculatePercentage(correct, total) >= passingPercentage;
}

module.exports = {
  calculatePercentage,
  getGradeEmoji,
  getGradeText,
  calculateTimeSpent,
  generateCompletionStats,
  generateProgressReport,
  isPassed
};
