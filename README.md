# PDD Trainer Bot 🚗

A Telegram bot for practicing Russian driving theory exams (ПДД - Правила Дорожного Движения).

## Features

- **40 tickets** with 20 questions each (800 total questions)
- **Interactive UI** with inline buttons for answers
- **Progress tracking** with visual progress bar
- **Instant feedback** - correct/incorrect answer notifications
- **End-of-ticket statistics** showing score and performance
- **Session management** with automatic cleanup (TTL-based)
- **Horizontal scaling** support via PM2 clustering or Bull Queue (Redis)

## Prerequisites

- Node.js 18+ 
- Telegram Bot Token (get from [@BotFather](https://t.me/BotFather))
- Redis (optional - for Bull Queue scaling)

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd pdd-trainer-bot
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your Telegram bot token:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
SESSION_TTL_MINUTES=30
```

### 3. Run the Bot

**Development mode:**
```bash
npm start
```

**Production mode with PM2 clustering:**
```bash
npm run cluster
```

## Project Structure

```
/workspace
├── bot.js                  # Main bot entry point
├── pdd_questions.json      # Question database (800 questions)
├── package.json            # Dependencies and scripts
├── ecosystem.config.js     # PM2 cluster configuration
├── .env.example            # Environment template
├── /images                 # Question images (optional)
├── /queues
│   └── queueManager.js     # Bull Queue manager
├── /utils
│   ├── sessionManager.js   # Session management with TTL
│   ├── progressBar.js      # Progress bar generation
│   └── keyboard.js         # Telegram keyboard generation
├── /scripts
│   └── generateQuestions.js # Sample question generator
└── README.md
```

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Start the bot and show ticket selection |
| `/help` | Show help information |
| `/stats` | Show bot statistics (admin) |

## User Flow

1. **Start**: User sends `/start` → bot displays ticket selection (buttons 1-40)
2. **Ticket Selection**: User taps a ticket number → bot loads first question
3. **Question Display**:
   - Shows question text + image (if available)
   - Displays progress bar (e.g., "Question 5/20")
   - Presents answer options as inline buttons
4. **Answer Submission**:
   - User taps inline button → bot validates answer
   - Instant popup: "✅ Правильно!" or "❌ Неправильно! Правильный ответ: [option]"
5. **Navigation**: Auto-advances to next question after feedback
6. **Completion**: After last question → displays statistics with restart options

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token | **Required** |
| `SESSION_TTL_MINUTES` | Session expiration time | `30` |
| `REDIS_HOST` | Redis server host | `localhost` |
| `REDIS_PORT` | Redis server port | `6379` |
| `REDIS_PASSWORD` | Redis password | *empty* |
| `NODE_ENV` | Environment mode | `development` |

### PM2 Cluster Settings

Edit `ecosystem.config.js` to adjust:
- `instances`: Number of worker processes (default: 4)
- `max_memory_restart`: Memory limit per instance (default: 200MB)

## Scaling Options

### Option 1: PM2 Clustering (Simpler)

No Redis required. Uses Node.js cluster module.

```bash
# Start cluster
npm run cluster

# View logs
npm run cluster:logs

# Stop cluster
npm run cluster:stop
```

### Option 2: Bull Queue with Redis (Advanced)

For distributed task processing across multiple servers.

1. Install and start Redis:
```bash
# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis
```

2. Configure Redis in `.env`:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

3. Start bot - it will auto-detect Redis and use Bull queues.

## Adding Real Questions

Replace `pdd_questions.json` with actual PDD questions:

```json
[
  {
    "questionId": "1_1",
    "ticketNumber": 1,
    "questionNumber": 1,
    "text": "Question text in Russian...",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correctAnswerIndex": 0,
    "imageUrl": "images/1_1.jpg"
  }
]
```

## Adding Question Images

Place images in the `/images` folder with naming format:
- `{ticketNumber}_{questionNumber}.jpg`
- Example: `1_1.jpg`, `5_12.jpg`, `40_20.jpg`

Supported formats: JPG, PNG, GIF

## Performance

Designed for 2,000-3,000 daily active users (~50 concurrent):

- **Memory**: ~50MB per instance
- **Response time**: < 2 seconds
- **Session cleanup**: Automatic every 5 minutes
- **Stateless design**: Easy horizontal scaling

## Monitoring

### Health Check

The bot provides a `/stats` command for basic monitoring:
- Active sessions count
- Queue statistics (if Redis enabled)
- Total questions/tickets loaded

### Logs

With PM2:
```bash
pm2 logs pdd-trainer-bot
```

Log files location:
- `logs/out.log` - Standard output
- `logs/err.log` - Error output

## Development

### Regenerate Sample Questions

```bash
node scripts/generateQuestions.js
```

### Run Tests

```bash
npm test
```

## Troubleshooting

### Bot not responding

1. Check bot token is correct
2. Verify network connectivity
3. Check for polling errors in logs

### High memory usage

1. Reduce `SESSION_TTL_MINUTES`
2. Increase cleanup frequency in `sessionManager.js`
3. Add more PM2 instances with lower memory limits

### Redis connection issues

1. Verify Redis is running: `redis-cli ping`
2. Check Redis credentials in `.env`
3. Bot works without Redis (uses direct processing)

## License

MIT

## Support

For issues and feature requests, please open a GitHub issue.
