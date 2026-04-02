const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Create a rate limiter with custom window and max requests
 * @param {number} windowMs - Time window in milliseconds
 * @param {number} max - Max requests per window
 */
function createRateLimiter(windowMs = 15 * 60 * 1000, max = 100) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many requests, please try again later.',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    handler: (req, res, next, options) => {
      logger?.warn(`Rate limit exceeded: ${req?.ip} on ${req?.path}`);
      res?.status(429)?.json(options?.message);
    }
  });
}

module.exports = { createRateLimiter };
