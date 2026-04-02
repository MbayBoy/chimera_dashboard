const cron = require('node-cron');
const logger = require('../utils/logger');

let healthMonitor, aiGovernor, campaignDispatcher, engagementSegmenter, bounceProcessor, intelligenceCrawler;

// Lazy load to avoid circular deps
function loadWorkflows() {
  healthMonitor = require('./healthMonitor');
  aiGovernor = require('./aiGovernor');
  campaignDispatcher = require('./campaignDispatcher');
  engagementSegmenter = require('./engagementSegmenter');
  bounceProcessor = require('./bounceProcessor');
  intelligenceCrawler = require('./intelligenceCrawler');
}

/**
 * Wrap workflow execution with error handling and logging
 */
async function runWorkflow(name, fn) {
  const start = Date.now();
  logger?.info(`[CRON] Starting: ${name}`);
  try {
    await fn();
    logger?.info(`[CRON] Completed: ${name} in ${Date.now() - start}ms`);
  } catch (error) {
    logger?.error(`[CRON] Failed: ${name} - ${error?.message}`);
  }
}

/**
 * Initialize all cron jobs
 */
function initializeCronJobs() {
  loadWorkflows();

  // ─── Health Monitor: Every 5 minutes ──────────────────────────────────────
  cron?.schedule('*/5 * * * *', () => {
    runWorkflow('Health Monitor', healthMonitor);
  }, { name: 'health-monitor' });

  // ─── Campaign Dispatcher: Every 1 minute ──────────────────────────────────
  cron?.schedule('* * * * *', () => {
    runWorkflow('Campaign Dispatcher', campaignDispatcher);
  }, { name: 'campaign-dispatcher' });

  // ─── Bounce Processor: Every 10 minutes ───────────────────────────────────
  cron?.schedule('*/10 * * * *', () => {
    runWorkflow('Bounce Processor', bounceProcessor);
  }, { name: 'bounce-processor' });

  // ─── AI Governor: Daily at 2 AM ───────────────────────────────────────────
  cron?.schedule('0 2 * * *', () => {
    runWorkflow('AI Governor', aiGovernor);
  }, { name: 'ai-governor' });

  // ─── Engagement Segmenter: Daily at midnight ──────────────────────────────
  cron?.schedule('0 0 * * *', () => {
    runWorkflow('Engagement Segmenter', engagementSegmenter);
  }, { name: 'engagement-segmenter' });

  // ─── Intelligence Crawler: Every 6 hours ──────────────────────────────────
  cron?.schedule('0 */6 * * *', () => {
    runWorkflow('Intelligence Crawler', intelligenceCrawler);
  }, { name: 'intelligence-crawler' });

  logger?.info('[CRON] All 6 workflows scheduled:');
  logger?.info('  - Health Monitor: every 5 minutes');
  logger?.info('  - Campaign Dispatcher: every 1 minute');
  logger?.info('  - Bounce Processor: every 10 minutes');
  logger?.info('  - AI Governor: daily at 2:00 AM');
  logger?.info('  - Engagement Segmenter: daily at midnight');
  logger?.info('  - Intelligence Crawler: every 6 hours');
}

/**
 * Get status of all scheduled tasks
 */
function getScheduledTasks() {
  return cron?.getTasks ? [...cron?.getTasks()?.entries()]?.map(([name, task]) => ({
    name,
    running: task?.getStatus ? task?.getStatus() : 'unknown'
  })) : [];
}

module.exports = { initializeCronJobs, getScheduledTasks };
