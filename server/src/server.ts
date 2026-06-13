import dotenv from 'dotenv';
import express from 'express';
import { mkdirSync } from 'fs';
import { createServer } from 'http';
import { join } from 'path';
import { Server } from 'socket.io';

import { DatabaseManager } from './models/database';
import feedRouter from './routes/feed';
import positionsRouter from './routes/positions';
import telegramRouter, { initializeTelegramBot } from './routes/telegram';
import { TelegramBotService } from './services/TelegramBot';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  // CORS is handled by nginx
  cors: {
    origin: false // Disable CORS handling in Socket.IO
  }
});

const PORT = process.env.PORT || 3001;

// Create data directory if it doesn't exist
const dataDir = join(__dirname, '../data');
try {
  mkdirSync(dataDir, { recursive: true });
} catch (error) {
  // Directory already exists
}

// Initialize database
DatabaseManager.getInstance();

// Initialize Telegram bot
const telegramBot = new TelegramBotService({
  token: process.env.TELEGRAM_BOT_TOKEN || '',
  pollingInterval: parseInt(process.env.TELEGRAM_POLLING_INTERVAL || '1000')
});

if (process.env.TELEGRAM_BOT_TOKEN) {
  telegramBot.initialize();
  initializeTelegramBot(telegramBot);

  // Start polling for messages
  telegramBot.startPolling().catch(error => {
    console.error('Failed to start Telegram polling:', error);
  });
} else {
  console.log('ℹ️  Telegram bot token not configured, Telegram integration disabled');
}

// Middleware
// In production, CORS is handled by nginx. In local dev, Express handles it.
if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cors = require('cors');
  app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy for accurate IP detection
app.set('trust proxy', true);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'vartarvipavag-server'
  });
});

// API routes
app.use('/api/positions', positionsRouter);
app.use('/api/telegram', telegramRouter);
app.use('/api/feed', feedRouter);

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');

  // Stop Telegram polling
  if (telegramBot.isInitialized()) {
    await telegramBot.stopPolling();
  }

  server.close(() => {
    console.log('Server closed');
    DatabaseManager.getInstance().close();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');

  // Stop Telegram polling
  if (telegramBot.isInitialized()) {
    await telegramBot.stopPolling();
  }

  server.close(() => {
    console.log('Server closed');
    DatabaseManager.getInstance().close();
    process.exit(0);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Position API: http://localhost:${PORT}/api/positions`);
  console.log(`🔒 Write operations restricted to localhost only`);
  console.log(`💡 Health check: http://localhost:${PORT}/health`);
});

export { io };
