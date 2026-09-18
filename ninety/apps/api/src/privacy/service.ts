import { eq } from 'drizzle-orm';
import { getDb, getSql } from '../db/client.js';
import { dataDeletionRequests, markets, users } from '../db/schema.js';
import { AppError } from '../core/errors.js';
import { log } from '../core/logger.js';
import { logIdentityAccess } from '../security/audit.js';

/**
 * Erasure.
 *
 * Both launch markets give a person the right to have their personal data
 * deleted, and both allow — in the UAE's case require — the financial record of
 * a completed sale to be kept for a fixed number of years. Those two rules meet
 * here.
 *
 * The resolution is erasure by anonymisation, not by DELETE:
 *
 *  - Identifiers are overwritten in place. The row survives, so every order,
 *    payment, dispute and payout that points at it still resolves. A cascade
 *    delete would take the invoices with it and leave the books unauditable.
 *  - The precise delivery pin is coarsened rather than dropped. The column is
 *    NOT NULL and the demand dataset — the most valuable thing this business
 *    produces — is about which city wanted which part, not which workshop.
 *  - Anything whose only purpose was to reach the person (notifications, OTP
 *    codes, refresh tokens, uploaded photos) is deleted outright.
 *
 * The result is written to the request as a report. An erasure you cannot
 * evidence afterwards is not compliance, it is a claim.
 */

export interface ErasureReport {
  readonly userId: string;
  readonly executedAt: string;
  readonly anonymised: Record<string, number>;
  readonly deleted: Record<string, number>;
  readonly retained: Record<string, { readonly rows: number; readonly until: string; readonly basis: string }>;
}

export async function requestErasure(input: {
  userId: string;
  requestedBy: string;
  reason?: string | null;
}): Promise<{ id: string; status: string }> {
  const existing = await getSql()<{ id: string; status: string }[]>`
    SELECT id, status FROM data_deletion_requests
     WHERE user_id = ${input.userId} AND status = 'pending'
     LIMIT 1
  `;
  if (existing[0] !== undefined) return existing[0];

  const rows = await getDb()
    .insert(dataDeletionRequests)
    .values({ userId: input.userId, requestedBy: input.requestedBy, reason: input.reason ?? null })
    .returning({ id: dataDeletionRequests.id, status: dataDeletionRequests.status });
  log.info('erasure requested', { userId: input.userId, requestedBy: input.requestedBy });
  return rows[0]!;
}

/** A tombstone that keeps the unique index honest without carrying a real number. */
function tombstonePhone(userId: string): string {
  return `+deleted-${userId.replace(/-/g, '').slice(0, 16)}`;
}

export async function executeErasure(deletionRequestId: string, adminId: string): Promise<ErasureReport> {
  const db = getDb();
  const sql = getSql();

  const requestRow = (
    await db.select().from(dataDeletionRequests).where(eq(dataDeletionRequests.id, deletionRequestId)).limit(1)
  )[0];
  if (requestRow === undefined) throw new AppError('not_found', 'error.not_found');
  if (requestRow.status !== 'pending') {
    throw new AppError('conflict', 'error.conflict', { details: { status: requestRow.status } });
  }

  const user = (await db.select().from(users).where(eq(users.id, requestRow.userId)).limit(1))[0];
  if (user === undefined) throw new AppError('not_found', 'error.not_found');

  const market = (await db.select().from(markets).where(eq(markets.id, user.marketId)).limit(1))[0];
  if (market === undefined) throw new AppError('not_found', 'error.not_found');

  const anonymised: Record<string, number> = {};
  const deleted: Record<string, number> = {};
  const retained: ErasureReport['retained'] = {};

  // One transaction. A half-erased person is worse than an un-erased one: they
  // cannot sign in to ask again and their records no longer agree with each other.
  await sql.begin(async (tx) => {
    const count = (rows: readonly unknown[]): number => rows.length;

    anonymised.users = count(await tx`
      UPDATE users
         SET phone = ${tombstonePhone(user.id)},
             email = NULL,
             display_name = NULL,
             is_active = false,
             deleted_at = now()
       WHERE id = ${user.id}
      RETURNING id
    `);

    anonymised.buyers = count(await tx`
      UPDATE buyers
         SET business_name = NULL, tax_number = NULL, default_address = NULL, default_location = NULL
       WHERE user_id = ${user.id}
      RETURNING id
    `);

    // A yard's trading name is the business, not the person, and it appears on
    // invoices that must be kept. The person's contact details are on the user
    // row above and are gone; the business record stays.
    anonymised.suppliers = count(await tx`
      UPDATE suppliers SET address = '{}'::jsonb WHERE user_id = ${user.id} RETURNING id
    `);

    anonymised.requests = count(await tx`
      UPDATE requests r
         SET delivery_address = '{}'::jsonb,
             -- Coarsened to roughly a kilometre: enough to keep the demand map
             -- honest, not enough to find a workshop.
             delivery_location = ST_SnapToGrid(r.delivery_location::geometry, 0.01)::geography
        FROM buyers b
       WHERE b.id = r.buyer_id AND b.user_id = ${user.id}
      RETURNING r.id
    `);

    deleted.request_media = count(await tx`
      DELETE FROM request_media m
       USING requests r JOIN buyers b ON b.id = r.buyer_id
       WHERE m.request_id = r.id AND b.user_id = ${user.id}
      RETURNING m.id
    `);

    deleted.notifications = count(await tx`
      DELETE FROM notifications WHERE user_id = ${user.id} RETURNING id
    `);
    deleted.otp_codes = count(await tx`
      DELETE FROM otp_codes WHERE phone = ${user.phone} RETURNING id
    `);
    deleted.refresh_tokens = count(await tx`
      DELETE FROM refresh_tokens WHERE user_id = ${user.id} RETURNING id
    `);

    // Behavioural analytics keep their shape, not their subject.
    anonymised.funnel_events = count(await tx`
      UPDATE funnel_events SET user_id = NULL WHERE user_id = ${user.id} RETURNING id
    `);

    const orders = await tx<{ n: string }[]>`
      SELECT count(*)::text AS n FROM orders o
        JOIN buyers b ON b.id = o.buyer_id
       WHERE b.user_id = ${user.id}
    `;
    const until = new Date();
    until.setFullYear(until.getFullYear() + market.financialRetentionYears);
    retained.orders = {
      rows: Number(orders[0]?.n ?? '0'),
      until: until.toISOString(),
      basis: `financial record retention: ${market.financialRetentionYears} years (${market.code})`,
    };

    const disputesRows = await tx<{ n: string }[]>`
      SELECT count(*)::text AS n FROM disputes WHERE raised_by_user_id = ${user.id}
    `;
    retained.disputes = {
      rows: Number(disputesRows[0]?.n ?? '0'),
      until: until.toISOString(),
      basis: 'evidence of a resolved claim, kept with the order it belongs to',
    };

    await tx`
      UPDATE data_deletion_requests
         SET status = 'completed', completed_at = now(), executed_by = ${adminId},
             report = ${JSON.stringify({ anonymised, deleted, retained })}::jsonb
       WHERE id = ${deletionRequestId}
    `;
  });

  // The erasure itself is an identity access: someone looked up a real person
  // and acted on them, and that is exactly what the audit log is for.
  await logIdentityAccess({
    actorUserId: adminId,
    actorRole: 'admin',
    route: 'POST /v1/admin/deletion-requests/:id/execute',
    supplierId: null,
    fields: ['phone', 'email', 'display_name'],
    allowed: true,
    requestId: deletionRequestId,
  });

  const report: ErasureReport = {
    userId: user.id,
    executedAt: new Date().toISOString(),
    anonymised,
    deleted,
    retained,
  };
  log.info('erasure executed', { userId: user.id, adminId, report });
  return report;
}
