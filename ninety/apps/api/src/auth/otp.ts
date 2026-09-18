import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { otpCodes } from '../db/schema.js';
import { AppError } from '../core/errors.js';
import { log } from '../core/logger.js';
import { env } from '../env.js';
import { OTP_CODE_LENGTH } from '@ninety/shared';

/**
 * Phone OTP.
 *
 * No SMS provider is integrated: in development the code is logged, and the
 * sender is an interface so that wiring a real provider later touches one file.
 * Codes are stored as hashes with an attempt counter, because a six-digit code
 * with unlimited attempts is a four-digit code.
 */

const CODE_LENGTH = OTP_CODE_LENGTH;
const TTL_SECONDS = 300;
const MAX_ATTEMPTS = 5;

export interface OtpSender {
  send(phone: string, code: string, locale: string): Promise<void>;
}

/**
 * Development sender: writes the code to stdout and nowhere else.
 *
 * Deliberately bypasses the structured logger, which redacts anything called a
 * code or a token. That redaction is correct and stays; this one line is the
 * explicit, clearly-labelled exception, and it refuses to run in production.
 */
export const consoleOtpSender: OtpSender = {
  async send(phone, code) {
    if (env().NODE_ENV === 'production') {
      throw new Error('the console OTP sender must never be used in production');
    }
    log.info('OTP issued (development sender — no SMS provider is integrated)', { phone });
    process.stdout.write(`[dev-otp] ${phone} -> ${code}\n`);
  },
};

let sender: OtpSender = consoleOtpSender;
export function setOtpSender(next: OtpSender): void {
  sender = next;
}

function hash(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generate(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += String(randomInt(0, 10));
  return out;
}

export interface OtpRequestResult {
  readonly expiresAt: Date;
  /** Present only when OTP_ECHO_IN_RESPONSE is on, which production refuses. */
  readonly devCode?: string;
}

export async function requestOtp(marketId: string, phone: string, locale: string): Promise<OtpRequestResult> {
  const code = generate();
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000);
  await getDb().insert(otpCodes).values({ marketId, phone, codeHash: hash(code), expiresAt });
  await sender.send(phone, code, locale);
  return env().OTP_ECHO_IN_RESPONSE ? { expiresAt, devCode: code } : { expiresAt };
}

export async function verifyOtp(marketId: string, phone: string, code: string): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.marketId, marketId), eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, new Date())))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  const row = rows[0];
  if (!row) throw new AppError('unauthenticated', 'error.otp_expired');
  if (row.attempts >= MAX_ATTEMPTS) throw new AppError('unauthenticated', 'error.otp_too_many_attempts');

  const expected = Buffer.from(row.codeHash, 'hex');
  const supplied = Buffer.from(hash(code), 'hex');
  const matches = expected.length === supplied.length && timingSafeEqual(expected, supplied);
  if (!matches) {
    await db.update(otpCodes).set({ attempts: row.attempts + 1 }).where(eq(otpCodes.id, row.id));
    throw new AppError('unauthenticated', 'error.otp_invalid');
  }
  await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, row.id));
}
