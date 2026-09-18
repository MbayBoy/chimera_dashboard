import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../core/errors.js';
import { log } from '../core/logger.js';
import { t } from '../i18n/index.js';

/**
 * One error shape, in the caller's language.
 *
 * An ar-AE user receives an Arabic error — including a validation failure and
 * including a 500. Stack traces never cross the wire: an internal error returns
 * a generic, translated message and the detail goes to the log under the same
 * request id.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | Error, req: FastifyRequest, reply: FastifyReply) => {
    const locale = req.ctx?.locale ?? 'en';
    const requestId = req.ctx?.requestId ?? 'unknown';

    if (error instanceof AppError) {
      log[error.statusCode >= 500 ? 'error' : 'warn']('request failed', {
        requestId,
        code: error.code,
        messageKey: error.messageKey,
        route: req.routeOptions?.url ?? req.url,
      });
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: t(error.messageKey, locale, error.params),
          messageKey: error.messageKey,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
        requestId,
      });
    }

    if (error instanceof ZodError) {
      log.warn('validation failed', { requestId, issues: error.issues, route: req.routeOptions?.url ?? req.url });
      return reply.status(400).send({
        error: {
          code: 'validation_failed',
          message: t('error.validation_failed', locale),
          messageKey: 'error.validation_failed',
          details: error.issues.map((i) => ({ path: i.path.join('.'), code: i.code, message: i.message })),
        },
        requestId,
      });
    }

    const statusCode = (error as FastifyError).statusCode ?? 500;
    if (statusCode === 429) {
      return reply.status(429).send({
        error: { code: 'rate_limited', message: t('error.rate_limited', locale), messageKey: 'error.rate_limited' },
        requestId,
      });
    }
    if (statusCode >= 400 && statusCode < 500) {
      const messageKey = statusCode === 401 ? 'error.unauthenticated' : statusCode === 404 ? 'error.not_found' : 'error.validation_failed';
      log.warn('client error', { requestId, statusCode, route: req.routeOptions?.url ?? req.url, err: error.message });
      return reply.status(statusCode).send({
        error: { code: statusCode === 401 ? 'unauthenticated' : 'validation_failed', message: t(messageKey, locale), messageKey },
        requestId,
      });
    }

    log.error('unhandled error', { requestId, route: req.routeOptions?.url ?? req.url, err: error });
    return reply.status(500).send({
      error: { code: 'internal_error', message: t('error.internal', locale), messageKey: 'error.internal' },
      requestId,
    });
  });

  app.setNotFoundHandler((req: FastifyRequest, reply: FastifyReply) => {
    const locale = req.ctx?.locale ?? 'en';
    return reply.status(404).send({
      error: { code: 'not_found', message: t('error.not_found', locale), messageKey: 'error.not_found' },
      requestId: req.ctx?.requestId ?? 'unknown',
    });
  });
}
