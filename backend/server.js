require('dotenv')?.config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { initializeCronJobs } = require('./workflows/cronService');
const { errorHandler } = require('./middleware/errorHandler');
const { createRateLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');
const requestLogger = require('./middleware/requestLogger');

// Route imports
const campaignsRouter = require('./routes/campaigns');
const serversRouter = require('./routes/servers');
const contactsRouter = require('./routes/contacts');
const listsRouter = require('./routes/lists');
const verificationRouter = require('./routes/verification');
const analyticsRouter = require('./routes/analytics');
const systemRouter = require('./routes/system');
const anomaliesRouter = require('./routes/anomalies');
const intelligenceRouter = require('./routes/intelligence');

const app = express();
const PORT = process.env.PORT || 3001;

// Security Middleware
app?.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app?.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS?.split(',')?.map(o => o?.trim())
      : [
          'http://localhost:5173',
          'http://localhost:3000',
          'https://chimerada7417.builtwithrocket.new'
        ];
    
    if (allowedOrigins?.includes(origin) || allowedOrigins?.includes('*')) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all in production - restrict via nginx
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Body Parsing
app?.use(express?.json({ limit: '10mb' }));
app?.use(express?.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app?.use(morgan('combined', {
  stream: { write: (message) => logger?.info(message?.trim()) }
}));

// API Request Audit Logger
app?.use('/api/', requestLogger);

// Rate Limiting
const generalLimit = parseInt(process.env.RATE_LIMIT_GENERAL || '200');
const authLimit = parseInt(process.env.RATE_LIMIT_AUTH || '10');
app?.use('/api/', createRateLimiter(15 * 60 * 1000, generalLimit));
app?.use('/api/auth/', createRateLimiter(15 * 60 * 1000, authLimit));

// Basic Health Check (no auth required)
app?.get('/health', (req, res) => {
  res?.json({
    status: 'ok',
    version: '5.0.0',
    timestamp: new Date()?.toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Deep Health Check - validates all services
app?.get('/health/deep', async (req, res) => {
  const startTime = Date.now();
  const checks = {};
  let overallStatus = 'ok';

  // 1. Supabase connectivity
  try {
    const supabase = require('./config/supabase');
    const { error } = await supabase?.from('servers')?.select('id')?.limit(1);
    checks.supabase = { status: error ? 'error' : 'ok', error: error ? error?.message : null };
    if (error) overallStatus = 'degraded';
  } catch (err) {
    checks.supabase = { status: 'error', error: err?.message };
    overallStatus = 'degraded';
  }

  // 2. Cron jobs status
  try {
    const { getScheduledTasks } = require('./workflows/cronService');
    const tasks = getScheduledTasks();
    checks.cronJobs = {
      status: 'ok',
      enabled: process.env.ENABLE_CRON_JOBS === 'true',
      taskCount: tasks?.length,
      tasks
    };
  } catch (err) {
    checks.cronJobs = { status: 'error', error: err?.message };
  }

  // 3. Memory usage
  const mem = process.memoryUsage();
  const heapUsedMB = Math.round(mem?.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(mem?.heapTotal / 1024 / 1024);
  const heapUsagePercent = Math.round((heapUsedMB / heapTotalMB) * 100);
  checks.memory = {
    status: heapUsagePercent > 90 ? 'warn' : 'ok',
    heapUsedMB,
    heapTotalMB,
    heapUsagePercent,
    rssMB: Math.round(mem?.rss / 1024 / 1024)
  };
  if (heapUsagePercent > 90) overallStatus = 'degraded';

  // 4. Environment variables check
  const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
  const missingVars = requiredEnvVars?.filter(v => !process.env[v]);
  checks.environment = {
    status: missingVars?.length > 0 ? 'error' : 'ok',
    missingVars,
    nodeEnv: process.env.NODE_ENV || 'development',
    cronEnabled: process.env.ENABLE_CRON_JOBS === 'true',
    bounceProcessingEnabled: !!(process.env.BOUNCE_IMAP_HOST && process.env.BOUNCE_IMAP_USER),
    fblProcessingEnabled: !!(process.env.FBL_IMAP_HOST && process.env.FBL_IMAP_USER),
    aiEnabled: !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here')
  };
  if (missingVars?.length > 0) overallStatus = 'error';

  // 5. Logs directory check
  try {
    const fs = require('fs');
    const path = require('path');
    const logsDir = path?.join(__dirname, 'logs');
    const logsExist = fs?.existsSync(logsDir);
    checks.logs = { status: logsExist ? 'ok' : 'warn', logsDir, exists: logsExist };
  } catch (err) {
    checks.logs = { status: 'warn', error: err?.message };
  }

  const responseTime = Date.now() - startTime;

  res?.status(overallStatus === 'error' ? 503 : 200)?.json({
    status: overallStatus,
    version: '5.0.0',
    timestamp: new Date()?.toISOString(),
    uptime: process.uptime(),
    responseTimeMs: responseTime,
    checks
  });
});

// API Routes
app?.use('/api/campaigns', campaignsRouter);
app?.use('/api/servers', serversRouter);
app?.use('/api/contacts', contactsRouter);
app?.use('/api/lists', listsRouter);
app?.use('/api/verification', verificationRouter);
app?.use('/api/analytics', analyticsRouter);
app?.use('/api/system', systemRouter);
app?.use('/api/anomalies', anomaliesRouter);
app?.use('/api/intelligence', intelligenceRouter);

// 404 Handler
app?.use('*', (req, res) => {
  res?.status(404)?.json({ error: 'Endpoint not found', path: req?.originalUrl });
});

// Global Error Handler
app?.use(errorHandler);

// Startup Checks
async function runStartupChecks() {
  logger?.info('Running startup checks...');

  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
  const missing = required?.filter(v => !process.env[v]);
  if (missing?.length > 0) {
    logger?.error('Missing required environment variables: ' + missing?.join(', '));
    logger?.error('Please configure your .env file. See .env.example for reference.');
    process.exit(1);
  }

  const fs = require('fs');
  const path = require('path');

  const logsDir = path?.join(__dirname, 'logs');
  if (!fs?.existsSync(logsDir)) {
    fs?.mkdirSync(logsDir, { recursive: true });
    logger?.info('Created logs directory');
  }

  const backupsDir = path?.join(__dirname, 'backups');
  if (!fs?.existsSync(backupsDir)) {
    fs?.mkdirSync(backupsDir, { recursive: true });
    logger?.info('Created backups directory');
  }

  logger?.info('Startup checks passed');
}

// Start Server
async function startServer() {
  await runStartupChecks();

  const server = app?.listen(PORT, () => {
    logger?.info('='?.repeat(60));
    logger?.info('  CHIMERA BACKEND v5.0 STARTED');
    logger?.info('='?.repeat(60));
    logger?.info('  Port:        ' + PORT);
    logger?.info('  Environment: ' + (process.env.NODE_ENV || 'development'));
    logger?.info('  Health:      http://localhost:' + PORT + '/health');
    logger?.info('  Deep Health: http://localhost:' + PORT + '/health/deep');
    logger?.info('  API Base:    http://localhost:' + PORT + '/api');
    logger?.info('='?.repeat(60));

    if (process.env.ENABLE_CRON_JOBS === 'true') {
      initializeCronJobs();
      logger?.info('Cron workflows initialized');
    } else {
      logger?.info('Cron jobs disabled (set ENABLE_CRON_JOBS=true to enable)');
    }
  });

  const gracefulShutdown = (signal) => {
    logger?.info(signal + ' received. Starting graceful shutdown...');

    server?.close((err) => {
      if (err) {
        logger?.error('Error during shutdown:', err);
        process.exit(1);
      }
      logger?.info('HTTP server closed. Exiting process.');
      process.exit(0);
    });

    setTimeout(() => {
      logger?.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('unhandledRejection', (reason, promise) => {
    logger?.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (error) => {
    logger?.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });

  return server;
}

startServer()?.catch((err) => {
  logger?.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app;
