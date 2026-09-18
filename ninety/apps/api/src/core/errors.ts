/**
 * Errors.
 *
 * One shape reaches a client, always:
 *
 *   { error: { code, message, details? }, requestId }
 *
 * `message` is resolved from the locale catalogue against the caller's locale,
 * never written as English in a controller — an ar-AE user gets an Arabic error,
 * including a validation failure, including a 500.
 */

export type ErrorCode =
  | 'validation_failed'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'illegal_transition'
  | 'rate_limited'
  | 'contact_details_rejected'
  | 'payment_failed'
  | 'courier_unavailable'
  | 'market_not_live'
  | 'upstream_unavailable'
  | 'internal_error';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  validation_failed: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  illegal_transition: 409,
  rate_limited: 429,
  contact_details_rejected: 422,
  payment_failed: 402,
  courier_unavailable: 503,
  market_not_live: 403,
  upstream_unavailable: 502,
  internal_error: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  /** i18n key for the message shown to the caller. */
  readonly messageKey: string;
  readonly params: Record<string, string | number>;
  readonly details: unknown;
  /** Safe to show the caller? Internal errors never leak their cause. */
  readonly expose: boolean;

  constructor(
    code: ErrorCode,
    messageKey: string,
    opts: { params?: Record<string, string | number>; details?: unknown; cause?: unknown } = {},
  ) {
    super(`${code}: ${messageKey}`);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = STATUS_BY_CODE[code];
    this.messageKey = messageKey;
    this.params = opts.params ?? {};
    this.details = opts.details;
    this.expose = code !== 'internal_error';
    if (opts.cause !== undefined) this.cause = opts.cause;
  }
}

export const notFound = (messageKey = 'error.not_found') => new AppError('not_found', messageKey);
export const forbidden = (messageKey = 'error.forbidden') => new AppError('forbidden', messageKey);
export const unauthenticated = (messageKey = 'error.unauthenticated') => new AppError('unauthenticated', messageKey);
export const conflict = (messageKey: string, params?: Record<string, string | number>) =>
  new AppError('conflict', messageKey, { params });
export const validationFailed = (messageKey: string, details?: unknown) =>
  new AppError('validation_failed', messageKey, { details });
