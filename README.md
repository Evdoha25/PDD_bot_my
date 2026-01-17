# PDD Trainer Bot 🚗

A Telegram bot for practicing Russian driving theory exams (ПДД - Правила Дорожного Движения).

## Features

- **40 tickets** with 20 questions each (800 total questions)
- **Interactive UI** with inline buttons for answers
- **Progress tracking** with visual progress bar
- **Instant feedback** - correct/incorrect answer notifications
- **End-of-ticket statistics** showing score, performance, and time spent
- **Session management** with LRU cache and automatic TTL-based cleanup
- **Rate limiting** to prevent abuse (10 requests/minute per user)
- **Health check HTTP endpoint** for monitoring and load balancers
- **Memory monitoring** with automatic alerts at 70%/80% thresholds
- **Image caching** for optimized performance
- **Horizontal scaling** support via PM2 clustering or native Node.js cluster

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

**Production mode with native Node.js clustering:**
```bash
npm run cluster:native
```

## Project Structure

```
/workspace
├── bot.js                    # Main bot entry point
├── cluster.js                # Native Node.js clustering setup
├── pdd_questions.json        # Question database (800 questions)
├── package.json              # Dependencies and scripts
├── ecosystem.config.js       # PM2 cluster configuration
├── .env.example              # Environment template
├── /images                   # Question images (optional)
├── /src
│   ├── questionService.js    # Question retrieval and validation
│   ├── imageService.js       # Image loading with caching
│   ├── statistics.js         # Results calculation
│   ├── healthCheck.js        # HTTP health check server
│   └── memoryMonitor.js      # Memory usage monitoring
├── /queues
│   └── queueManager.js       # Bull Queue manager (Redis)
├── /utils
│   ├── sessionManager.js     # LRU session management with TTL
│   ├── progressBar.js        # Progress bar generation
│   ├── keyboard.js           # Telegram keyboard generation
│   ├── cache.js              # LRU and image cache utilities
│   └── rateLimiter.js        # Request rate limiting
├── /scripts
│   └── generateQuestions.js  # Sample question generator
└── README.md
```

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Start the bot and show ticket selection |
| `/help` | Show help information |
| `/stats` | Show bot statistics (includes memory, sessions, cache) |

## User Flow

1. **Start**: User sends `/start` → bot displays ticket selection (4 columns × 10 rows)
2. **Ticket Selection**: User taps a ticket number → bot loads first question
3. **Question Display**:
   - Shows question text + image (if available)
   - Displays progress bar (e.g., "Question 5/20")
   - Presents answer options as inline buttons
4. **Answer Submission**:
   - User taps inline button → bot validates answer
   - Instant popup: "✅ Правильно!" or "❌ Неправильно! Правильный ответ: [option]"
5. **Navigation**: Auto-advances to next question after feedback
6. **Completion**: After last question → displays statistics with time spent and restart options

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token | **Required** |
| `SESSION_TTL_MINUTES` | Session expiration time | `30` |
| `MAX_SESSIONS` | Maximum concurrent sessions (LRU) | `5000` |
| `RATE_LIMIT_REQUESTS` | Max requests per window | `10` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms | `60000` |
| `HEALTH_CHECK_PORT` | HTTP health check port | `3000` |
| `MEMORY_WARNING_THRESHOLD` | Memory warning % | `70` |
| `MEMORY_CRITICAL_THRESHOLD` | Memory critical % | `80` |
| `MAX_WORKERS` | Max cluster workers | `4` |
| `REDIS_HOST` | Redis server host | `localhost` |
| `REDIS_PORT` | Redis server port | `6379` |
| `REDIS_PASSWORD` | Redis password | *empty* |
| `NODE_ENV` | Environment mode | `development` |

### PM2 Cluster Settings

Edit `ecosystem.config.js` to adjust:
- `instances`: Number of worker processes (default: 4)
- `max_memory_restart`: Memory limit per instance (default: 200MB)

## Scaling Options

### Option 1: Native Node.js Clustering

Uses built-in Node.js cluster module. No PM2 required.

```bash
npm run cluster:native
```

### Option 2: PM2 Clustering (Recommended for Production)

More features: process management, logs, monitoring.

```bash
# Start cluster
npm run cluster

# View status
npm run cluster:status

# View logs
npm run cluster:logs

# Stop cluster
npm run cluster:stop

# Delete from PM2
npm run cluster:delete
```

### Option 3: Bull Queue with Redis (Advanced)

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

## Health Check & Monitoring

### HTTP Endpoints

The bot exposes health check endpoints (default port 3000):

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health status, uptime, PID |
| `GET /ready` | Readiness probe for k8s |
| `GET /stats` | Full statistics (sessions, memory, cache) |
| `GET /memory` | Detailed memory usage |

```bash
# Quick health check
npm run health

# Full stats
npm run stats

# Or use curl directly
curl http://localhost:3000/health
curl http://localhost:3000/stats
curl http://localhost:3000/memory
```

### Memory Monitoring

The bot monitors memory usage and:
- Logs warnings at 70% heap usage
- Triggers garbage collection at 80% (if `--expose-gc` flag is set)
- Clears image cache on critical memory situations

### Telegram /stats Command

Send `/stats` to the bot for real-time statistics:
- Active sessions and utilization
- Question database info
- Memory usage and status
- Image cache hit rate
- Rate limiter status
- Queue status (if Redis enabled)

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

Images are automatically cached in memory for better performance.

## Performance

Designed for 2,000-3,000 daily active users:

- **Memory**: ~50-100MB per instance
- **Response time**: < 2 seconds
- **Session capacity**: 5,000 concurrent sessions (LRU eviction)
- **Rate limiting**: 10 requests/minute per user
- **Session cleanup**: Automatic every 5 minutes
- **Image caching**: Up to 50MB of images cached in memory

### Memory Estimates

| Component | Memory |
|-----------|--------|
| Session data (5000 users) | ~10MB |
| Questions JSON | ~5MB |
| Image cache (max) | ~50MB |
| Node.js overhead | ~30MB |
| **Total per worker** | ~100MB |

## Development

### Regenerate Sample Questions

```bash
npm run generate-questions
```

### Project Scripts

```bash
npm start              # Start single instance
npm run dev            # Development mode
npm run cluster        # Start PM2 cluster
npm run cluster:native # Start native cluster
npm run cluster:stop   # Stop PM2 cluster
npm run cluster:logs   # View PM2 logs
npm run cluster:status # View PM2 status
npm run health         # Check health endpoint
npm run stats          # Check stats endpoint
```

## Troubleshooting

### Bot not responding

1. Check bot token is correct
2. Verify network connectivity
3. Check for polling errors in logs

### High memory usage

1. Reduce `MAX_SESSIONS`
2. Reduce image cache size in `imageService.js`
3. Lower `MEMORY_CRITICAL_THRESHOLD` for earlier cleanup
4. Add more PM2 instances with lower memory limits

### Rate limit errors

Users seeing "Too many requests" message:
1. This is working as intended to prevent abuse
2. Adjust `RATE_LIMIT_REQUESTS` if needed
3. Default: 10 requests per 60 seconds

### Redis connection issues

1. Verify Redis is running: `redis-cli ping`
2. Check Redis credentials in `.env`
3. Bot works without Redis (uses direct processing)

### Health check port in use

If port 3000 is busy, the server automatically tries the next port.
Or set a different port: `HEALTH_CHECK_PORT=3001`

## License

MIT

## Support

For issues and feature requests, please open a GitHub issue.
