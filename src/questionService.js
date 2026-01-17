/**
 * Question Service - Handles question data retrieval and indexing
 */

const fs = require('fs');
const path = require('path');

class QuestionService {
  constructor() {
    this.questions = [];
    this.questionsByTicket = {};
    this.questionById = {};
    this.isLoaded = false;
  }

  /**
   * Load questions from JSON file
   * @param {string} questionsPath - Path to questions JSON file
   * @returns {boolean} Whether loading was successful
   */
  load(questionsPath) {
    try {
      const data = fs.readFileSync(questionsPath, 'utf8');
      this.questions = JSON.parse(data);
      
      // Build indexes for fast lookup
      this._buildIndexes();
      
      this.isLoaded = true;
      console.log(`[QuestionService] Loaded ${this.questions.length} questions`);
      console.log(`[QuestionService] Indexed ${this.getTicketCount()} tickets`);
      
      return true;
    } catch (error) {
      console.error('[QuestionService] Error loading questions:', error.message);
      return false;
    }
  }

  /**
   * Build indexes for fast question lookup
   * @private
   */
  _buildIndexes() {
    this.questionsByTicket = {};
    this.questionById = {};

    this.questions.forEach(q => {
      // Index by ticket number
      if (!this.questionsByTicket[q.ticketNumber]) {
        this.questionsByTicket[q.ticketNumber] = [];
      }
      this.questionsByTicket[q.ticketNumber].push(q);
      
      // Index by question ID
      this.questionById[q.questionId] = q;
    });
  }

  /**
   * Get all questions for a specific ticket
   * @param {number} ticketNumber - Ticket number (1-40)
   * @returns {Array} Array of questions
   */
  getTicketQuestions(ticketNumber) {
    return this.questionsByTicket[ticketNumber] || [];
  }

  /**
   * Get a specific question by ID
   * @param {string} questionId - Question ID (e.g., "1_1")
   * @returns {Object|null} Question object or null
   */
  getQuestionById(questionId) {
    return this.questionById[questionId] || null;
  }

  /**
   * Get question by ticket and question number
   * @param {number} ticketNumber - Ticket number
   * @param {number} questionNumber - Question number within ticket
   * @returns {Object|null} Question object or null
   */
  getQuestion(ticketNumber, questionNumber) {
    const ticketQuestions = this.getTicketQuestions(ticketNumber);
    return ticketQuestions[questionNumber - 1] || null;
  }

  /**
   * Get total number of tickets
   * @returns {number}
   */
  getTicketCount() {
    return Object.keys(this.questionsByTicket).length;
  }

  /**
   * Get total number of questions
   * @returns {number}
   */
  getQuestionCount() {
    return this.questions.length;
  }

  /**
   * Get number of questions in a specific ticket
   * @param {number} ticketNumber - Ticket number
   * @returns {number}
   */
  getTicketQuestionCount(ticketNumber) {
    return this.getTicketQuestions(ticketNumber).length;
  }

  /**
   * Check if a ticket exists
   * @param {number} ticketNumber - Ticket number
   * @returns {boolean}
   */
  ticketExists(ticketNumber) {
    return !!this.questionsByTicket[ticketNumber];
  }

  /**
   * Validate an answer
   * @param {string} questionId - Question ID
   * @param {number} answerIndex - Selected answer index
   * @returns {Object} { isCorrect: boolean, correctAnswer: string, correctIndex: number }
   */
  validateAnswer(questionId, answerIndex) {
    const question = this.getQuestionById(questionId);
    
    if (!question) {
      return {
        isCorrect: false,
        correctAnswer: null,
        correctIndex: null,
        error: 'Question not found'
      };
    }

    const isCorrect = answerIndex === question.correctAnswerIndex;
    
    return {
      isCorrect,
      correctAnswer: question.options[question.correctAnswerIndex],
      correctIndex: question.correctAnswerIndex
    };
  }

  /**
   * Get service statistics
   * @returns {Object} Stats
   */
  getStats() {
    return {
      isLoaded: this.isLoaded,
      totalQuestions: this.questions.length,
      totalTickets: this.getTicketCount(),
      questionsPerTicket: this.questions.length > 0 
        ? Math.round(this.questions.length / this.getTicketCount()) 
        : 0
    };
  }
}

module.exports = QuestionService;
