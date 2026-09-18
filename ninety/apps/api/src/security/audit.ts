import { getDb } from '../db/client.js';
import { identityAccessLog } from '../db/schema.js';
import { log } from '../core/logger.js';

/**
 * Supplier-identity access audit.
 *
 * Every access to supplier identity from a non-admin code path is recorded with
 * the actor, the route and the time. The admin console is the one place identity
 * is legitimately visible, and even there every access is logged.
 *
 * The point is not to prevent the access — some of it is necessary, like
 * resolving which yard won an order — but to make an anomalous pattern visible.
 * A leak of this kind is discovered by noticing that something started reading
 * identity at a rate it never used to.
 */

export interface IdentityAccess {
  readonly actorUserId: string | null;
  readonly actorRole: string | null;
  readonly route: string;
  readonly supplierId: string | null;
  readonly fields: readonly string[];
  readonly allowed: boolean;
  readonly requestId: string;
}

export async function logIdentityAccess(access: IdentityAccess): Promise<void> {
  try {
    await getDb().insert(identityAccessLog).values({
      actorUserId: access.actorUserId,
      actorRole: access.actorRole,
      route: access.route,
      supplierId: access.supplierId,
      fields: [...access.fields],
      allowed: access.allowed,
      requestId: access.requestId,
    });
    if (!access.allowed) {
      log.warn('supplier identity access refused', {
        route: access.route,
        actorUserId: access.actorUserId,
        actorRole: access.actorRole,
      });
    }
  } catch (err) {
    // An audit failure must not take down the request it was auditing, but it
    // must be loud: an audit log nobody notices failing is not an audit log.
    log.error('identity access audit failed to write', {
      route: access.route,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Anomaly check: unusually many identity reads by one actor in a short window.
 *
 * Deliberately simple. The value is in having a number someone looks at, not in
 * the sophistication of the detector.
 */
export async function identityAccessAnomalies(withinMinutes = 60, threshold = 100) {
  const { getSql } = await import('../db/client.js');
  return getSql()<{ actor_user_id: string | null; actor_role: string | null; accesses: string }[]>`
    SELECT actor_user_id, actor_role, count(*)::text AS accesses
      FROM identity_access_log
     WHERE created_at > now() - make_interval(mins => ${withinMinutes})
     GROUP BY actor_user_id, actor_role
    HAVING count(*) >= ${threshold}
     ORDER BY count(*) DESC
  `;
}
