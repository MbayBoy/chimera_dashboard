import { randomUUID } from 'node:crypto';

/**
 * Structured JSON logging with a request id on every line.
 *
 * Fastify's own pino logger handles request logging; this is the same shape for
 * everything that happens outside a request — timers, sweeps, queue workers —
 * so a single job's story can be reconstructed from one grep.
 */

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

const LEVEL_ORDER: Record<LogLevel, number> = { fatal: 60, error: 50, warn: 40, info: 30, debug: 20, trace: 10 };

export interface LogContext {
  readonly requestId?: string;
  readonly [key: string]: unknown;
}

function threshold(): number {
  const configured = (process.env.LOG_LEVEL ?? 'info') as LogLevel | 'silent';
  if (configured === 'silent') return Number.POSITIVE_INFINITY;
  return LEVEL_ORDER[configured] ?? LEVEL_ORDER.info;
}

function write(level: LogLevel, msg: string, context: LogContext): void {
  if (LEVEL_ORDER[level] < threshold()) return;
  const line = { level, time: new Date().toISOString(), msg, ...context };
  const out = level === 'error' || level === 'fatal' ? process.stderr : process.stdout;
  out.write(`${JSON.stringify(line, replacer)}\n`);
}

/** Never log a secret or a card token, whatever a caller passes in. */
const REDACTED_KEYS = new Set(['password', 'token', 'secret', 'authorization', 'card', 'cvc', 'pan', 'otp', 'code']);

function replacer(key: string, value: unknown): unknown {
  if (REDACTED_KEYS.has(key.toLowerCase())) return '[redacted]';
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  return value;
}

export const log = {
  fatal: (msg: string, ctx: LogContext = {}) => write('fatal', msg, ctx),
  error: (msg: string, ctx: LogContext = {}) => write('error', msg, ctx),
  warn: (msg: string, ctx: LogContext = {}) => write('warn', msg, ctx),
  info: (msg: string, ctx: LogContext = {}) => write('info', msg, ctx),
  debug: (msg: string, ctx: LogContext = {}) => write('debug', msg, ctx),
  trace: (msg: string, ctx: LogContext = {}) => write('trace', msg, ctx),
  child: (base: LogContext) => ({
    fatal: (msg: string, ctx: LogContext = {}) => write('fatal', msg, { ...base, ...ctx }),
    error: (msg: string, ctx: LogContext = {}) => write('error', msg, { ...base, ...ctx }),
    warn: (msg: string, ctx: LogContext = {}) => write('warn', msg, { ...base, ...ctx }),
    info: (msg: string, ctx: LogContext = {}) => write('info', msg, { ...base, ...ctx }),
    debug: (msg: string, ctx: LogContext = {}) => write('debug', msg, { ...base, ...ctx }),
    trace: (msg: string, ctx: LogContext = {}) => write('trace', msg, { ...base, ...ctx }),
  }),
};

export function newRequestId(): string {
  return randomUUID();
}
