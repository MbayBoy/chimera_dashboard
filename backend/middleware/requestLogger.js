const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * API Request Logging Middleware
 * Logs every API request to system_logs table for audit trail
 */
function requestLogger(req, res, next) {
  const requestId = uuidv4();
  const startTime = Date.now();

  req.requestId = requestId;
  res?.setHeader('X-Request-ID', requestId);

  const originalJson = res?.json?.bind(res);
  res.json = function (body) {
    return originalJson(body);
  };

  res?.on('finish', async () => {
    const responseTime = Date.now() - startTime;
    const userId = req?.user?.id || null;
    const method = req?.method;
    const endpoint = req?.originalUrl || req?.url;
    const statusCode = res?.statusCode;
    const ip = req?.ip || req?.headers?.['x-forwarded-for'] || req?.connection?.remoteAddress;
    const userAgent = req?.headers?.['user-agent'] || '';

    let sanitizedBody = null;
    if (['POST', 'PUT', 'PATCH']?.includes(method) && req?.body) {
      const body = { ...req?.body };
      delete body?.password;
      delete body?.password_confirmation;
      delete body?.current_password;
      delete body?.secret;
      delete body?.token;
      sanitizedBody = JSON.stringify(body)?.substring(0, 2000);
    }

    const level = statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO';
    const message = `${method} ${endpoint} ${statusCode} ${responseTime}ms`;

    logger?.[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'info'](message, {
      requestId,
      userId,
      ip,
      responseTime,
    });

    try {
      await supabase?.from('system_logs')?.insert({
        log_level: level,
        source: 'API_Request',
        message,
        log_timestamp: new Date(startTime)?.toISOString(),
        metadata: {
          request_id: requestId,
          method,
          endpoint,
          status_code: statusCode,
          response_time_ms: responseTime,
          user_id: userId,
          ip_address: ip,
          user_agent: userAgent,
          request_body: sanitizedBody,
        },
      });
    } catch (err) {
      logger?.error('Failed to write request log to DB:', err?.message);
    }
  });

  res?.on('error', async (err) => {
    const responseTime = Date.now() - startTime;
    try {
      await supabase?.from('system_logs')?.insert({
        log_level: 'ERROR',
        source: 'API_Request',
        message: `${req?.method} ${req?.originalUrl} - Error: ${err?.message}`,
        log_timestamp: new Date(startTime)?.toISOString(),
        metadata: {
          request_id: requestId,
          method: req?.method,
          endpoint: req?.originalUrl,
          response_time_ms: responseTime,
          user_id: req?.user?.id || null,
          error_stack: err?.stack?.substring(0, 3000),
        },
      });
    } catch (logErr) {
      logger?.error('Failed to write error log to DB:', logErr?.message);
    }
  });

  next();
}

module.exports = requestLogger;
