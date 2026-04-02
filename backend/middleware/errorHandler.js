const logger = require('../utils/logger');

/**
 * Global Express error handler
 */
function errorHandler(err, req, res, next) {
  const statusCode = err?.statusCode || err?.status || 500;
  const message = err?.message || 'Internal Server Error';

  // Log the error
  if (statusCode >= 500) {
    logger?.error(`[${req?.method}] ${req?.path} - ${statusCode}: ${message}`, {
      stack: err?.stack,
      body: req?.body,
      params: req?.params,
      query: req?.query
    });
  } else {
    logger?.warn(`[${req?.method}] ${req?.path} - ${statusCode}: ${message}`);
  }

  // Don't expose stack traces in production
  const response = {
    error: message,
    status: statusCode
  };

  if (process.env.NODE_ENV !== 'production') {
    response.stack = err?.stack;
  }

  res?.status(statusCode)?.json(response);
}

/**
 * Async wrapper to catch errors in async route handlers
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next))?.catch(next);
  };
}

module.exports = { errorHandler, asyncHandler };
